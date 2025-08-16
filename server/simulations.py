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
    from wombat.api.simulation_runner import get_simulation_dict
    return get_simulation_dict(library)

def run_wombat_simulation(library: str = "DINWOODIE", config: str = "base.yaml") -> dict[str, Any]:
    # Local import to keep example self-contained and to avoid import cycles.
    from wombat.api.simulation_runner import run_simulation
    
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
                from server.services.libraries import add_client_library_file, scan_client_library_files
                path = f"results/{time.strftime('%Y-%m-%d_%H-%M')}_summary.yaml"
                add_client_library_file(client_id, path, content=result)
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