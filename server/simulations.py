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

def get_simulation(library: str = "DINWOODIE"):
    from wombat_api.api.simulation_runner import get_simulation_dict
    return get_simulation_dict(library)

def run_wombat_simulation(library: str = "DINWOODIE", config: str = "base.yaml") -> dict[str, Any]:
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
        result = run_simulation(library=library_path, config=config)
        return result
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        return {"error": str(e), "status": "failed"}

def start_simulation_task(client_id: str, project_dir: Optional[str]) -> str:
    """Start a background simulation task for a client. Returns task_id."""

    task_id = uuid.uuid4().hex
    _TASKS[task_id] = {"status": "running", "result": None, "files": None, "client_id": client_id}

    def _worker():
        try:
            # Run the simulation using client project_dir if available
            if project_dir:
                result = run_wombat_simulation(library=project_dir)
            else:
                result = run_wombat_simulation()

            # Attempt to save results into client library
            try:
                import time
                from server.services.libraries import add_client_library_file, scan_client_library_files, delete_client_library_file
                ts = time.strftime('%Y-%m-%d_%H-%M-%S')
                base_dir = f"results/{ts}"
                # Save structured summary
                add_client_library_file(client_id, f"{base_dir}/summary.yaml", content=result)

                # Try to persist selected artifacts from the result payload
                try:
                    res_files = (result or {}).get("results", {})
                    # Map of key -> desired target filename
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
                                # If this is the gantt HTML, also try to persist a PNG sibling
                                if key == "gantt":
                                    try:
                                        p_png = p.with_suffix(".png")
                                        if p_png.exists() and p_png.is_file():
                                            try:
                                                png_text = p_png.read_bytes().decode("latin-1", errors="replace")
                                            except Exception:
                                                png_text = p_png.read_text(encoding="utf-8", errors="replace")
                                            add_client_library_file(client_id, f"{base_dir}/gantt.png", content=png_text)
                                            # delete original png if different location
                                            if project_dir:
                                                proj = Path(project_dir).resolve()
                                                try:
                                                    rel_png = str(p_png.resolve().relative_to(proj))
                                                    if not rel_png.replace('\\','/').startswith(f"{base_dir}/"):
                                                        delete_client_library_file(client_id, rel_png)
                                                except Exception:
                                                    pass
                                    except Exception:
                                        pass
                                # Attempt to delete the original to avoid duplicates in results root
                                try:
                                    if project_dir:
                                        proj = Path(project_dir).resolve()
                                        rel = str(p.resolve().relative_to(proj))
                                        # Only delete if different from the new location
                                        if not rel.replace('\\','/').startswith(f"{base_dir}/"):
                                            delete_client_library_file(client_id, rel)
                                except Exception:
                                    pass
                        except Exception:
                            continue
                except Exception:
                    pass
                files = scan_client_library_files(client_id)
            except Exception as save_err:
                logger.warning(f"Failed to persist simulation results for {client_id}: {save_err}")
                files = None

            _TASKS[task_id].update({
                "status": "finished",
                "result": result,
                "files": files if files is not None else {},
            })
        except Exception as e:
            logger.exception(f"Background simulation task failed: {e}")
            _TASKS[task_id].update({"status": "failed", "result": {"error": str(e)}, "files": {}})

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
    }