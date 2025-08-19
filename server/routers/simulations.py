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
        from pathlib import Path
        from server.services.libraries import delete_client_library_file
        ts = time.strftime('%Y-%m-%d_%H-%M-%S')
        base_dir = f"results/{ts}"
        add_client_library_file(client_id, f"{base_dir}/summary.yaml", content=result)

        # Persist artifacts like events/operations/power/gantt
        try:
            res_files = (result or {}).get("results", {})
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
                    # Resolve relative paths to the project_dir when not absolute
                    if not p.is_absolute() and project_dir:
                        p = Path(project_dir) / p
                    if p.exists() and p.is_file():
                        try:
                            content_text = p.read_text(encoding='utf-8', errors='replace')
                        except Exception:
                            content_text = p.read_bytes().decode('latin-1', errors='replace')
                        add_client_library_file(client_id, f"{base_dir}/{target_name}", content=content_text)
                        # If gantt HTML, also try to copy PNG sibling
                        if key == "gantt":
                            try:
                                p_png = p.with_suffix('.png')
                                if p_png.exists() and p_png.is_file():
                                    try:
                                        png_text = p_png.read_bytes().decode('latin-1', errors='replace')
                                    except Exception:
                                        png_text = p_png.read_text(encoding='utf-8', errors='replace')
                                    add_client_library_file(client_id, f"{base_dir}/gantt.png", content=png_text)
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
                        # Delete original file to avoid duplicates where possible
                        try:
                            if project_dir:
                                proj = Path(project_dir).resolve()
                                rel = str(p.resolve().relative_to(proj))
                                if not rel.replace('\\','/').startswith(f"{base_dir}/"):
                                    delete_client_library_file(client_id, rel)
                        except Exception:
                            pass
                except Exception:
                    continue
        except Exception:
            pass
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
