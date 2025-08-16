from __future__ import annotations

"""Simulation routes: run simulations for a given client.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from fastapi import APIRouter, HTTPException

from server.client_manager import client_manager
from server.services.libraries import scan_client_library_files, add_client_library_file
from server.simulations import run_wombat_simulation, start_simulation_task, get_task_status
from server.models import SimulationResultResponse, SimulationTriggerResponse, SimulationStatusResponse

router = APIRouter(prefix="", tags=["simulation"])


@router.post("/{client_id}/simulate", response_model=SimulationResultResponse)
def run_simulation(client_id: str) -> dict:
    """Run the simulation synchronously and return results when done."""
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")

    project_dir = client_manager.get_client_project_dir(client_id)
    if project_dir:
        result = run_wombat_simulation(library=project_dir)
    else:
        result = run_wombat_simulation()

    try:
        import time
        path = f"results/{time.strftime('%Y-%m-%d_%H-%M')}_summary.yaml"
        add_client_library_file(client_id, path, content=result)
    except Exception:
        pass
    files = scan_client_library_files(client_id)
    return {"status": "finished", "results": result, "files": files}


@router.post("/{client_id}/simulate/trigger", response_model=SimulationTriggerResponse)
def trigger_simulation(client_id: str) -> dict:
    """Trigger an async simulation and return a task_id to poll."""
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    project_dir = client_manager.get_client_project_dir(client_id)
    task_id = start_simulation_task(client_id, project_dir)
    return {"task_id": task_id, "status": "running"}


@router.get("/simulate/status/{task_id}", response_model=SimulationStatusResponse)
def simulation_status(task_id: str) -> dict:
    """Get the status (and result if finished) for a background simulation task."""
    return get_task_status(task_id)
