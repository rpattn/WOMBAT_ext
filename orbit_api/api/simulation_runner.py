from __future__ import annotations

from typing import Any, Callable, Optional
from pathlib import Path
import json
import time

# Reuse WOMBAT's YAML loader to read config from the shared library layout
try:
    from wombat.core.library import load_yaml  # type: ignore
except Exception:  # pragma: no cover - fallback if not present
    load_yaml = None  # type: ignore


def _load_config_from_library(library: str, config: str) -> dict[str, Any]:
    """Load a YAML config from `<library>/project/config/<config>`.

    Falls back to simple file read if WOMBAT's loader isn't available.
    """
    cfg_path = Path(library) / "project" / "config" / config
    if load_yaml is not None:
        return load_yaml(Path(library) / "project" / "config", config)  # type: ignore
    import yaml  # lazy import
    with open(cfg_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _import_orbit_project_manager():
    """Attempt to import ORBIT's ProjectManager from common locations."""
    exc: Optional[Exception] = None
    for mod, name in (
        ("ORBIT", "ProjectManager"),
        ("orbit", "ProjectManager"),
        ("wisdem.orbit", "ProjectManager"),
    ):
        try:
            module = __import__(mod, fromlist=[name])
            return getattr(module, name)
        except Exception as e:  # try next option
            exc = e
            continue
    # If we get here, raise the last error with guidance
    raise ImportError(
        "Could not import ORBIT ProjectManager. Please install the ORBIT package (e.g., `pip install ORBIT`)."
    ) from exc


def get_simulation_dict(library: str = "DINWOODIE") -> str:
    """Return the default ORBIT configuration as JSON string for the given library.

    Mirrors WOMBAT's helper to feed the client JSON editor.
    """
    # Default to same example library layout; caller can pass a project dir
    cfg = _load_config_from_library(library, "base.yaml")
    return json.dumps(cfg)


def run_simulation_with_progress(
    library: str = "DINWOODIE",
    config: str = "base.yaml",
    *,
    delete_logs: bool = False,  # kept for interface parity; unused by ORBIT
    progress_cb: Optional[Callable[[dict[str, Any]], None]] = None,
    post_finalize_cb: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """Run an ORBIT simulation, optionally reporting minimal progress.

    ORBIT does not expose a step-wise simulation clock like WOMBAT, so we
    emit coarse progress signals: started -> running -> finalizing.
    """
    # Resolve configuration
    cfg_dict = _load_config_from_library(library, config)

    # Obtain ORBIT's ProjectManager
    ProjectManager = _import_orbit_project_manager()

    # Emit initial progress
    if progress_cb is not None:
        try:
            progress_cb({"now": 0.0, "percent": None, "message": "started"})
        except Exception:
            pass

    # Run ORBIT simulation
    start = time.time()
    try:
        # Instantiate; support both dict and explicit kw styles
        try:
            pm = ProjectManager(cfg_dict)  # common signature
        except TypeError:
            pm = ProjectManager(input_dict=cfg_dict)

        results: dict[str, Any]
        try:
            results = pm.run()  # typical ORBIT API returns a results dict
        except TypeError:
            # Some versions use execute()
            results = pm.execute()

        # Build a normalized result payload similar to WOMBAT
        out: dict[str, Any] = {
            "status": "completed",
            "name": cfg_dict.get("project", {}).get("project_name")
            or cfg_dict.get("project_name")
            or "ORBIT Project",
            "library": str(Path(library).resolve()),
            "results": results or {},
            "stats": {
                "runtime_seconds": round(time.time() - start, 3),
            },
        }

        # Allow server to copy artifacts (if it knows where they are)
        if post_finalize_cb is not None:
            try:
                post_finalize_cb(out)
            except Exception:
                pass

        # Interface parity only; ORBIT generally doesn't write sim logs to clean up
        _ = delete_logs

        return out
    except Exception as e:
        # Failure path
        out = {
            "status": "failed",
            "error": str(e),
            "library": str(Path(library).resolve()),
        }
        if post_finalize_cb is not None:
            try:
                post_finalize_cb(out)
            except Exception:
                pass
        return out
    finally:
        if progress_cb is not None:
            try:
                progress_cb({"now": 1.0, "percent": 100.0, "message": "finalizing"})
            except Exception:
                pass


def run_simulation(
    library: str = "DINWOODIE",
    config: str = "base.yaml",
    *,
    delete_logs: bool = False,
    post_finalize_cb: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """Synchronous ORBIT simulation wrapper matching WOMBAT's interface."""
    return run_simulation_with_progress(
        library=library,
        config=config,
        delete_logs=delete_logs,
        progress_cb=None,
        post_finalize_cb=post_finalize_cb,
    )
