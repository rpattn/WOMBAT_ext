"""Intermediate script to allow running of different simulations
- Currently only implements WOMBAT simulations

Adds a minimal background task facility to trigger simulations asynchronously
and poll for status/results.
"""

import logging
from typing import Any, Dict, Optional
from pathlib import Path
import threading
import uuid

logger = logging.getLogger("uvicorn.error")

_TASKS: Dict[str, dict] = {}

def build_orbit_summary_payload(result_dict: dict) -> dict:
    """Build a compact ORBIT summary with highlights plus the original result."""
    try:
        import time
        ts = time.strftime('%Y-%m-%d_%H-%M-%S')
    except Exception:
        ts = ''
    highlights: Dict[str, Any] = {
        "engine": "ORBIT",
        "status": result_dict.get("status"),
    }
    def pick(key: str):
        if key in result_dict:
            return result_dict.get(key)
        inner = result_dict.get("results") or {}
        return inner.get(key)
    for k in [
        "total_cost",
        "duration_days",
        "num_turbines",
        "capacity_mw",
        "lcoe",
    ]:
        v = pick(k)
        if v is not None:
            highlights[k] = v
    # Make a shallow copy and strip actions from nested results if present
    result_copy: Dict[str, Any] = dict(result_dict) if isinstance(result_dict, dict) else {"result": result_dict}
    try:
        inner = result_copy.get("results") or {}
        if isinstance(inner, dict):
            inner = dict(inner)
            inner.pop("actions", None)
            # also avoid duplicating very large raw_results.actions
            raw = inner.get("raw_results")
            if isinstance(raw, dict) and "actions" in raw:
                raw = dict(raw)
                raw.pop("actions", None)
                inner["raw_results"] = raw
            result_copy["results"] = inner
    except Exception:
        pass
    return {
        "generated_at": ts,
        "highlights": highlights,
        "result": result_copy,
    }

def get_simulation(library: str = "DINWOODIE"):
    from wombat_api.api.simulation_runner import get_simulation_dict
    return get_simulation_dict(library)

def run_wombat_simulation(library: str = "DINWOODIE", config: str = "base.yaml", post_finalize_cb=None) -> dict[str, Any]:
    # Local import to keep example self-contained and to avoid import cycles.
    from wombat_api.api.simulation_runner import run_simulation
    
    # If a specific library path is provided (from client manager), use it directly
    if library != "DINWOODIE" and Path(library).exists():
        # Use the client-specific library path
        library_path = str(library)
        logger.info(f"Running simulation with client library: {library_path}")
    else:
        # Fallback to default DINWOODIE library
        library_path = library
        logger.info(f"Running simulation with default library: {library_path}")
    
    try:
        # Run simulation with the specified library path
        # Use post_finalize_cb to copy artifacts before WOMBAT log cleanup
        result = run_simulation(library=library_path, config=config, delete_logs=True, post_finalize_cb=post_finalize_cb)
        return result
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        return {"error": str(e), "status": "failed"}

def _normalize_orbit_config(config: Optional[str]) -> Optional[str]:
    """Normalize a config path coming from the client for ORBIT.

    The ORBIT loader joins Path(library)/"project"/"config" with the provided config.
    So the provided value should generally be just a filename like "base.yaml".

    Users might pass values like "project/config/base.yaml" or "config/base.yaml".
    This function strips those prefixes and returns only the trailing filename.
    """
    if not config:
        return None
    try:
        s = str(config).replace("\\", "/").strip()
        low = s.lower()
        for prefix in ("project/config/", "config/"):
            if low.startswith(prefix):
                # Keep original case of the tail after the matched prefix length
                return s[len(prefix):]
        # If the string still contains slashes, return the basename
        if "/" in s:
            return s.rsplit("/", 1)[-1]
        return s
    except Exception:
        return config

def start_simulation_task(client_id: str, project_dir: Optional[str], config: Optional[str] = None) -> str:
    """Start a background simulation task for a client. Returns task_id."""

    task_id = uuid.uuid4().hex
    _TASKS[task_id] = {
        "status": "running",
        "result": None,
        "files": None,
        "client_id": client_id,
        "progress": {"now": 0.0, "percent": None, "message": "queued"},
    }

    def _worker():
        try:
            # Local import to avoid circular deps at module load
            from wombat_api.api.simulation_runner import run_simulation_with_progress

            # Define a progress callback to update in-memory task state
            def _progress_cb(update: dict):
                try:
                    _TASKS[task_id]["progress"] = {
                        "now": float(update.get("now", 0.0) or 0.0),
                        "percent": update.get("percent"),
                        "message": str(update.get("message", "running")),
                    }
                except Exception:
                    # best-effort only; don't crash on progress issues
                    pass

            # Define a post-finalize callback to copy artifacts before log cleanup
            def _post_finalize_cb(result_dict: dict):
                try:
                    import time
                    from server.services.libraries import add_client_library_file
                    ts = time.strftime('%Y-%m-%d_%H-%M-%S')
                    base_dir = f"results/{ts}"
                    # Save structured summary (pre-serialize to YAML text to avoid empty files)
                    def _sanitize(obj: Any):
                        try:
                            import numpy as np  # type: ignore
                        except Exception:
                            np = None  # type: ignore
                        from decimal import Decimal
                        import datetime as _dt
                        from pathlib import Path as _Path
                        if obj is None or isinstance(obj, (bool, int, float, str)):
                            return obj
                        if isinstance(obj, Decimal):
                            return float(obj)
                        if isinstance(obj, (_Path,)):
                            return str(obj)
                        if isinstance(obj, (_dt.datetime, _dt.date)):
                            return obj.isoformat()
                        if np is not None and isinstance(obj, (getattr(np, 'generic', ()),)):
                            try:
                                return obj.item()
                            except Exception:
                                return float(obj) if hasattr(obj, '__float__') else str(obj)
                        if np is not None and hasattr(np, 'ndarray') and isinstance(obj, np.ndarray):
                            return [_sanitize(x) for x in obj.tolist()]
                        if isinstance(obj, (list, tuple, set)):
                            return [_sanitize(x) for x in list(obj)]
                        if isinstance(obj, dict):
                            return {str(k): _sanitize(v) for k, v in obj.items()}
                        return str(obj)
                    safe_payload = _sanitize(result_dict)
                    try:
                        import yaml
                        summary_yaml = yaml.safe_dump(safe_payload, default_flow_style=False, sort_keys=False, allow_unicode=True)
                    except Exception:
                        def _to_str(o: Any):
                            if isinstance(o, dict):
                                return {str(k): _to_str(v) for k, v in o.items()}
                            if isinstance(o, (list, tuple, set)):
                                return [_to_str(v) for v in o]
                            return str(o)
                        import yaml
                        summary_yaml = yaml.safe_dump(_to_str(safe_payload), default_flow_style=False, sort_keys=False, allow_unicode=True)
                    add_client_library_file(client_id, f"{base_dir}/summary.yaml", content=summary_yaml)
                    # Persist selected artifacts
                    res_files = (result_dict or {}).get("results", {})
                    file_map = {
                        "events": "events.csv",
                        "operations": "operations.csv",
                        "power_potential": "power_potential.csv",
                        "power_production": "power_production.csv",
                        "metrics_input": "metrics_input.csv",
                        "gantt": "gantt.html",
                    }
                    for key, target_name in file_map.items():
                        src = res_files.get(key)
                        if not src:
                            continue
                        try:
                            p = Path(src)
                            # Resolve relative paths against the client project_dir
                            if not p.is_absolute() and project_dir:
                                p = Path(project_dir) / p
                            if p.exists() and p.is_file():
                                # Read as text; if binary sneaks in, fallback to bytes decoded as latin-1
                                try:
                                    content_text = p.read_text(encoding="utf-8", errors="replace")
                                except Exception:
                                    content_text = p.read_bytes().decode("latin-1", errors="replace")
                                add_client_library_file(client_id, f"{base_dir}/{target_name}", content=content_text)
                                # If gantt HTML, also copy PNG sibling then delete originals if outside new subtree
                                if key == "gantt":
                                    try:
                                        p_png = p.with_suffix(".png")
                                        if p_png.exists() and p_png.is_file():
                                            try:
                                                png_text = p_png.read_bytes().decode("latin-1", errors="replace")
                                            except Exception:
                                                png_text = p_png.read_text(encoding="utf-8", errors="replace")
                                            add_client_library_file(client_id, f"{base_dir}/gantt.png", content=png_text)
                                        if project_dir:
                                            try:
                                                proj = Path(project_dir).resolve()
                                                rel_html = str(p.resolve().relative_to(proj)).replace('\\','/')
                                                if not rel_html.startswith(f"{base_dir}/") and p.exists():
                                                    try:
                                                        p.unlink()
                                                    except Exception:
                                                        pass
                                                if p_png.exists():
                                                    rel_png = str(p_png.resolve().relative_to(proj)).replace('\\','/')
                                                    if not rel_png.startswith(f"{base_dir}/"):
                                                        try:
                                                            p_png.unlink()
                                                        except Exception:
                                                            pass
                                            except Exception:
                                                pass
                                    except Exception:
                                        pass
                        except Exception:
                            continue
                except Exception:
                    pass
            
            # Normalize config to avoid double "project/config" prefixing
            norm_cfg = _normalize_orbit_config(config) or "base.yaml"
            # Run the simulation using client project_dir if available
            if project_dir:
                result = run_simulation_with_progress(library=project_dir, config=norm_cfg, progress_cb=_progress_cb, progress_interval_steps=2000, delete_logs=True, post_finalize_cb=_post_finalize_cb)
            else:
                result = run_simulation_with_progress(config=norm_cfg, progress_cb=_progress_cb, progress_interval_steps=2000, delete_logs=True, post_finalize_cb=_post_finalize_cb)

            # After run, scan client files (artifacts were saved in the callback)
            try:
                from server.services.libraries import scan_client_library_files
                files = scan_client_library_files(client_id)
            except Exception as save_err:
                logger.warning(f"Failed to list simulation results for {client_id}: {save_err}")
                files = None

            _TASKS[task_id].update({
                "status": "finished",
                "result": result,
                "files": files if files is not None else {},
                "progress": {"now": float(_TASKS[task_id].get("progress", {}).get("now", 0.0)), "percent": 100.0, "message": "finished"},
            })
        except Exception as e:
            logger.exception(f"Background simulation task failed: {e}")
            _TASKS[task_id].update({
                "status": "failed",
                "result": {"error": str(e)},
                "files": {},
                "progress": {"now": float(_TASKS[task_id].get("progress", {}).get("now", 0.0)), "percent": None, "message": "failed"},
            })

    t = threading.Thread(target=_worker, name=f"sim-task-{task_id}", daemon=True)
    t.start()
    return task_id

def get_task_status(task_id: str) -> dict:
    """Return the status dict for a task_id."""
    if task_id not in _TASKS:
        return {"task_id": task_id, "status": "not_found"}
    state = _TASKS[task_id]
    return {
        "task_id": task_id,
        "status": state.get("status", "unknown"),
        "result": state.get("result"),
        "files": state.get("files"),
        "progress": state.get("progress"),
    }

def run_orbit_simulation(library: str = "DINWOODIE", config: str = "base.yaml", post_finalize_cb=None) -> dict[str, Any]:
    """Run an ORBIT simulation synchronously and return results.

    Mirrors run_wombat_simulation but uses orbit_api.
    """
    try:
        from orbit_api.api.simulation_runner import run_simulation as run_orbit
    except Exception as e:
        logger.error(f"Unable to import ORBIT API: {e}")
        return {"error": str(e), "status": "failed"}

    # If a specific library path exists, use it directly
    if library != "DINWOODIE" and Path(library).exists():
        library_path = str(library)
        logger.info(f"Running ORBIT simulation with client library: {library_path}")
    else:
        library_path = library
        logger.info(f"Running ORBIT simulation with default library: {library_path}")

    # Normalize config to avoid double "project/config" prefixing
    norm_cfg = _normalize_orbit_config(config) or "base.yaml"
    try:
        result = run_orbit(library=library_path, config=norm_cfg, delete_logs=True, post_finalize_cb=post_finalize_cb)
        return result
    except Exception as e:
        logger.error(f"ORBIT simulation error: {e}")
        return {"error": str(e), "status": "failed"}

def start_orbit_simulation_task(client_id: str, project_dir: Optional[str], config: Optional[str] = None) -> str:
    """Start a background ORBIT simulation task. Returns task_id."""

    task_id = uuid.uuid4().hex
    _TASKS[task_id] = {
        "status": "running",
        "result": None,
        "files": None,
        "client_id": client_id,
        "progress": {"now": 0.0, "percent": None, "message": "queued"},
    }

    def _worker():
        try:
            from orbit_api.api.simulation_runner import run_simulation_with_progress as run_orbit_with_progress

            def _progress_cb(update: dict):
                try:
                    _TASKS[task_id]["progress"] = {
                        "now": float(update.get("now", 0.0) or 0.0),
                        "percent": update.get("percent"),
                        "message": str(update.get("message", "running")),
                    }
                except Exception:
                    pass

            def _post_finalize_cb(result_dict: dict):
                # For ORBIT, write a richer summary including highlights
                try:
                    import time
                    from server.services.libraries import add_client_library_file
                    ts = time.strftime('%Y-%m-%d_%H-%M-%S')
                    base_dir = f"results/{ts}"
                    payload = build_orbit_summary_payload(result_dict)
                    # Sanitize payload for YAML serialization
                    def _sanitize(obj: Any):
                        try:
                            import numpy as np  # type: ignore
                        except Exception:
                            np = None  # type: ignore
                        from decimal import Decimal
                        import datetime as _dt
                        from pathlib import Path as _Path
                        # Scalars
                        if obj is None or isinstance(obj, (bool, int, float, str)):
                            return obj
                        if isinstance(obj, Decimal):
                            return float(obj)
                        if isinstance(obj, (_Path,)):
                            return str(obj)
                        if isinstance(obj, (_dt.datetime, _dt.date)):
                            return obj.isoformat()
                        # numpy scalars -> python scalars
                        if np is not None and isinstance(obj, (getattr(np, 'generic', ()),)):
                            try:
                                return obj.item()
                            except Exception:
                                return float(obj) if hasattr(obj, '__float__') else str(obj)
                        # numpy arrays -> lists
                        if np is not None and hasattr(np, 'ndarray') and isinstance(obj, np.ndarray):
                            return [_sanitize(x) for x in obj.tolist()]
                        # Collections
                        if isinstance(obj, (list, tuple, set)):
                            return [_sanitize(x) for x in list(obj)]
                        if isinstance(obj, dict):
                            return {str(k): _sanitize(v) for k, v in obj.items()}
                        # Fallback to string
                        return str(obj)
                    safe_payload = _sanitize(payload)
                    # Pre-serialize to YAML text to avoid empty files if downstream serialization fails
                    try:
                        import yaml  # type: ignore
                        yaml_text = yaml.safe_dump(safe_payload, default_flow_style=False, sort_keys=False, allow_unicode=True)
                    except Exception:
                        # Last resort: stringify everything recursively, then YAML-dump
                        def _to_str(o: Any):
                            if isinstance(o, dict):
                                return {str(k): _to_str(v) for k, v in o.items()}
                            if isinstance(o, (list, tuple, set)):
                                return [_to_str(v) for v in o]
                            return str(o)
                        yaml_text = yaml.safe_dump(_to_str(safe_payload), default_flow_style=False, sort_keys=False, allow_unicode=True)
                    add_client_library_file(client_id, f"{base_dir}/orbit_summary.yaml", content=yaml_text)
                    # Attempt to write actions CSV if present
                    try:
                        actions = None
                        res = result_dict.get("results") if isinstance(result_dict, dict) else None
                        if isinstance(res, dict):
                            actions = res.get("actions") or (res.get("raw_results") or {}).get("actions")
                        if actions:
                            import csv
                            from io import StringIO
                            s = StringIO()
                            rows = []
                            headers = set()
                            if isinstance(actions, list):
                                for item in actions:
                                    if isinstance(item, dict):
                                        rows.append(item)
                                        headers.update(item.keys())
                                    else:
                                        rows.append({"value": item})
                                        headers.update(["value"])
                            elif isinstance(actions, dict):
                                for k, v in actions.items():
                                    rows.append({"key": k, "value": v})
                                headers.update(["key", "value"])
                            else:
                                rows = [{"value": str(actions)}]
                                headers.update(["value"])
                            if rows:
                                writer = csv.DictWriter(s, fieldnames=list(headers))
                                writer.writeheader()
                                for r in rows:
                                    writer.writerow({k: r.get(k, "") for k in writer.fieldnames})
                                add_client_library_file(client_id, f"{base_dir}/orbit_actions.csv", content=s.getvalue())
                    except Exception:
                        pass
                except Exception:
                    pass

            # Normalize config to avoid double "project/config" prefixing
            norm_cfg = _normalize_orbit_config(config) or "base.yaml"
            if project_dir:
                result = run_orbit_with_progress(library=project_dir, config=norm_cfg, progress_cb=_progress_cb, delete_logs=True, post_finalize_cb=_post_finalize_cb)
            else:
                result = run_orbit_with_progress(config=norm_cfg, progress_cb=_progress_cb, delete_logs=True, post_finalize_cb=_post_finalize_cb)

            try:
                from server.services.libraries import scan_client_library_files
                files = scan_client_library_files(client_id)
            except Exception as save_err:
                logger.warning(f"Failed to list ORBIT results for {client_id}: {save_err}")
                files = None

            _TASKS[task_id].update({
                "status": "finished",
                "result": result,
                "files": files if files is not None else {},
                "progress": {"now": float(_TASKS[task_id].get("progress", {}).get("now", 0.0)), "percent": 100.0, "message": "finished"},
            })
        except Exception as e:
            logger.exception(f"Background ORBIT simulation task failed: {e}")
            _TASKS[task_id].update({
                "status": "failed",
                "result": {"error": str(e)},
                "files": {},
                "progress": {"now": float(_TASKS[task_id].get("progress", {}).get("now", 0.0)), "percent": None, "message": "failed"},
            })

    t = threading.Thread(target=_worker, name=f"orbit-sim-task-{task_id}", daemon=True)
    t.start()
    return task_id