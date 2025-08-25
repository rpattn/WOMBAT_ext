from __future__ import annotations

from typing import Any, Callable, Optional
from pathlib import Path
import json
import time
try:
    import pandas as pd  # used by user-added code paths
except Exception:  # pragma: no cover
    pd = None  # type: ignore

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


def _resolve_local_library_paths(library: str, cfg: dict[str, Any]) -> dict[str, Any]:
    """Rewrite config entries to prefer client project's local library files.

    Currently handles:
    - turbine: if a YAML exists at <library>/library/turbines/<name>.yaml and the
      config value looks like a bare name (no slashes), replace with absolute path.
    This helps avoid ORBIT looking up resources from a package-installed 'library/'.
    """
    try:
        root = Path(library)
        if not root.exists():
            return cfg
        cfg2 = dict(cfg)
        # Common locations for turbine reference: top-level 'turbine' or under 'plant.turbine'
        def _maybe_resolve(name: Optional[str]) -> Optional[str]:
            if not name or "/" in name or "\\" in name:
                return name
            cand = root / "library" / "turbines" / f"{name}.yaml"
            if cand.exists():
                return str(cand.resolve())
            return name
        # top-level
        if isinstance(cfg2.get("turbine"), str):
            cfg2["turbine"] = _maybe_resolve(cfg2.get("turbine"))
        # nested under plant
        plant = cfg2.get("plant")
        if isinstance(plant, dict) and isinstance(plant.get("turbine"), str):
            plant = dict(plant)
            plant["turbine"] = _maybe_resolve(plant.get("turbine"))
            cfg2["plant"] = plant
        return cfg2
    except Exception:
        return cfg


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
    print(f"Loading configuration from {library}/{config}")
    cfg_dict = _load_config_from_library(library, config)
    cfg_dict = _resolve_local_library_paths(library, cfg_dict)

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
        pm = ProjectManager(cfg_dict, library_path=library)  # common signature

        # Always initialize to a safe default to avoid UnboundLocalError
        results_raw: dict[str, Any] = {}

        try:
            pm.run()  # typical ORBIT API executes the pipeline
            # Prefer capex_breakdown if available
            if hasattr(pm, "capex_breakdown") and isinstance(getattr(pm, "capex_breakdown"), dict):
                results_raw = getattr(pm, "capex_breakdown")  # type: ignore[assignment]
        except Exception as e:
            print(f"ERROR: ORBIT simulation failed: {e}")
            # keep results_raw as {}

        # Enrich results by probing common ORBIT exports, if available
        enriched: dict[str, Any] = {}
        if isinstance(results_raw, dict) and results_raw:
            enriched.update(results_raw)
        # Try to include high-level project/system exports
        try:
            if hasattr(pm, "export_project_outputs"):
                proj_out = pm.export_project_outputs()
                if proj_out:
                    enriched["project_outputs"] = proj_out
        except Exception:
            pass
        try:
            if hasattr(pm, "export_system_design"):
                sys_design = pm.export_system_design()
                if sys_design:
                    enriched["system_design"] = sys_design
        except Exception:
            pass
        # Other common locations across ORBIT versions
        try:
            if hasattr(pm, "results") and pm.results:
                enriched.setdefault("raw_results", pm.results)
        except Exception:
            pass
        try:
            if hasattr(pm, "get_results"):
                gr = pm.get_results()
                if gr:
                    enriched.setdefault("raw_results", gr)
        except Exception:
            pass
        try:
            proj = getattr(pm, "project", None)
            if proj is not None:
                if hasattr(proj, "export_system_design"):
                    sd = proj.export_system_design()
                    if sd:
                        enriched.setdefault("system_design", sd)
                if hasattr(proj, "export_project_outputs"):
                    po = proj.export_project_outputs()
                    if po:
                        enriched.setdefault("project_outputs", po)
                # Sometimes design is accessible as attribute
                if hasattr(proj, "system_design"):
                    sd2 = getattr(proj, "system_design")
                    if sd2:
                        enriched.setdefault("system_design", sd2)
        except Exception:
            pass

        # Try to capture action log if exposed by ORBIT
        try:
            actions = None
            proj = getattr(pm, "project", None)
            if proj is not None and hasattr(proj, "actions"):
                actions = getattr(proj, "actions")
            elif hasattr(pm, "actions"):
                actions = getattr(pm, "actions")
            if actions:
                enriched.setdefault("actions", actions)
        except Exception:
            pass

        # Build a normalized result payload similar to WOMBAT
        out: dict[str, Any] = {
            "status": "completed",
            "name": cfg_dict.get("project", {}).get("project_name")
            or cfg_dict.get("project_name")
            or "ORBIT Project",
            "library": str(Path(library).resolve()),
            "results": enriched or {},
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
