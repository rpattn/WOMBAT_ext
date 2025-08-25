from __future__ import annotations

"""ORBIT Simulation routes: run ORBIT simulations for a given client.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from fastapi import APIRouter, HTTPException

from server.client_manager import client_manager
from server.services.libraries import scan_client_library_files, add_client_library_file
from server.simulations import run_orbit_simulation, start_orbit_simulation_task, get_task_status

router = APIRouter(prefix="", tags=["orbit-simulation"])


@router.post("/{client_id}/orbit/simulate")
def run_orbit(client_id: str) -> dict:
    """Run the ORBIT simulation synchronously and return results when done."""
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")

    project_dir = client_manager.get_client_project_dir(client_id)

    # Build a post-finalize callback to persist a summary artifact
    def _post_finalize_cb(result_dict: dict):
        try:
            import time
            ts = time.strftime('%Y-%m-%d_%H-%M-%S')
            base_dir = f"results/{ts}"
            add_client_library_file(client_id, f"{base_dir}/orbit_summary.json", content=result_dict)
        except Exception:
            pass

    if project_dir:
        result = run_orbit_simulation(library=project_dir, post_finalize_cb=_post_finalize_cb)
    else:
        result = run_orbit_simulation(post_finalize_cb=_post_finalize_cb)

    files = scan_client_library_files(client_id)
    return {"status": "finished", "results": result, "files": files}


@router.post("/{client_id}/orbit/simulate/trigger")
def trigger_orbit(client_id: str) -> dict:
    """Trigger an async ORBIT simulation and return a task_id to poll."""
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    project_dir = client_manager.get_client_project_dir(client_id)
    task_id = start_orbit_simulation_task(client_id, project_dir)
    return {"task_id": task_id, "status": "running"}


@router.get("/orbit/simulate/status/{task_id}")
def orbit_status(task_id: str) -> dict:
    """Get the status (and result if finished) for a background ORBIT simulation task."""
    return get_task_status(task_id)
