from __future__ import annotations

from fastapi import APIRouter, HTTPException

from server.client_manager import client_manager
from server.services.libraries import scan_client_library_files, add_client_library_file
from server.simulations import run_wombat_simulation

router = APIRouter(prefix="", tags=["simulation"])


@router.post("/{client_id}/simulate")
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
