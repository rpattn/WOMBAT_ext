from __future__ import annotations

"""Simulation routes: run simulations for a given client.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from fastapi import APIRouter, HTTPException, Query

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
    # Build a post-finalize callback to copy artifacts before WOMBAT cleanup
    from pathlib import Path
    def _post_finalize_cb(result_dict: dict):
        try:
            import time
            ts = time.strftime('%Y-%m-%d_%H-%M-%S')
            base_dir = f"results/{ts}"
            add_client_library_file(client_id, f"{base_dir}/summary.yaml", content=result_dict)
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
                    if not p.is_absolute() and project_dir:
                        p = Path(project_dir) / p
                    if p.exists() and p.is_file():
                        try:
                            content_text = p.read_text(encoding='utf-8', errors='replace')
                        except Exception:
                            content_text = p.read_bytes().decode('latin-1', errors='replace')
                        add_client_library_file(client_id, f"{base_dir}/{target_name}", content=content_text)
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

    # Run simulation with delete_logs=True, copying via callback pre-cleanup
    if project_dir:
        result = run_wombat_simulation(library=project_dir, post_finalize_cb=_post_finalize_cb)
    else:
        result = run_wombat_simulation(post_finalize_cb=_post_finalize_cb)

    files = scan_client_library_files(client_id)
    return {"status": "finished", "results": result, "files": files}


@router.post("/{client_id}/simulate/trigger", response_model=SimulationTriggerResponse)
def trigger_simulation(client_id: str, config: str | None = Query(default=None)) -> dict:
    """Trigger an async simulation and return a task_id to poll."""
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    project_dir = client_manager.get_client_project_dir(client_id)
    task_id = start_simulation_task(client_id, project_dir, config=config)
    return {"task_id": task_id, "status": "running"}


@router.get("/simulate/status/{task_id}", response_model=SimulationStatusResponse)
def simulation_status(task_id: str) -> dict:
    """Get the status (and result if finished) for a background simulation task."""
    return get_task_status(task_id)
