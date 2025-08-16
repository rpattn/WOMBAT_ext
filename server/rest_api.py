from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from server.client_manager import client_manager
from server.library_manager import (
    get_client_library_file,
    scan_client_library_files,
    add_client_library_file,
    delete_client_library_file,
    save_client_library,
    load_saved_library,
    delete_saved_library,
)
from server.event_handlers import handle_get_config  # for fallback logic if needed
from server.simulations import run_wombat_simulation

router = APIRouter(prefix="/api", tags=["wombat-rest"])


class AddOrReplacePayload(BaseModel):
    file_path: str
    content: Any | None = None


class SaveLibraryPayload(BaseModel):
    project_name: str


class LoadSavedPayload(BaseModel):
    name: str


@router.post("/session")
def create_session() -> dict[str, str]:
    client_id = client_manager.create_session()
    return {"client_id": client_id}


@router.delete("/session/{client_id}")
def end_session(client_id: str) -> dict[str, str]:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    client_manager.end_session(client_id)
    return {"status": "ended"}


@router.get("/{client_id}/config")
def get_config(client_id: str) -> Any:
    # Similar to WS handle_get_config: try library file first; fallback to simulation defaults
    from server.simulations import get_simulation
    from server.library_manager import get_client_library_file

    if client_manager.get_client_project_dir(client_id):
        data = get_client_library_file(client_id, "project/config/base.yaml")
        if data:
            return data
    # fallback
    return get_simulation()


@router.get("/{client_id}/library/files")
def list_library_files(client_id: str) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    return scan_client_library_files(client_id)


@router.get("/{client_id}/refresh")
def refresh_state(client_id: str) -> dict:
    """Return combined state: files, config, and saved libraries in one call."""
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")

    # Files
    files = scan_client_library_files(client_id)

    # Config (re-use existing logic)
    cfg = get_config(client_id)

    # Saved libraries
    from pathlib import Path
    base = Path(client_manager.get_save_library_dir()).resolve()
    base.mkdir(parents=True, exist_ok=True)
    dirs = [p.name for p in base.iterdir() if p.is_dir()]
    dirs.sort()

    return {"files": files, "config": cfg, "saved": dirs}


@router.get("/{client_id}/library/file")
def read_library_file(
    client_id: str,
    path: str = Query(..., description="Relative path within client project"),
    raw: bool = Query(False, description="If true, returns raw file; may be base64 for binary"),
) -> Any:
    from pathlib import Path
    import base64
    import mimetypes

    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")

    if raw:
        project_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
        abs_path = (project_dir / path.replace("\\", "/")).resolve()
        if not str(abs_path).startswith(str(project_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")
        if not abs_path.exists() or not abs_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        mime_guess, _ = mimetypes.guess_type(abs_path.name)
        is_binary = abs_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp"}
        client_manager.set_last_selected_file(client_id, path)
        if is_binary:
            data_b64 = base64.b64encode(abs_path.read_bytes()).decode("ascii")
            return {"file": path, "data_b64": data_b64, "mime": mime_guess or "application/octet-stream", "raw": True}
        else:
            content = abs_path.read_text(encoding="utf-8")
            return {"file": path, "data": content, "mime": mime_guess or "text/plain", "raw": True}
    else:
        file_content = get_client_library_file(client_id, path)
        if file_content is None:
            raise HTTPException(status_code=404, detail="File not found")
        client_manager.set_last_selected_file(client_id, path)
        return {"file": path, "data": file_content}


@router.post("/{client_id}/library/file")
def add_file(client_id: str, payload: AddOrReplacePayload) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    ok = add_client_library_file(client_id, payload.file_path.strip().replace("\\", "/"), payload.content)
    files = scan_client_library_files(client_id)
    return {"ok": bool(ok), "files": files}


@router.put("/{client_id}/library/file")
def replace_file(client_id: str, payload: AddOrReplacePayload) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    ok = add_client_library_file(client_id, payload.file_path.strip().replace("\\", "/"), payload.content)
    files = scan_client_library_files(client_id)
    return {"ok": bool(ok), "files": files}


@router.delete("/{client_id}/library/file")
def delete_file(client_id: str, file_path: str = Query(...)) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    ok = delete_client_library_file(client_id, file_path)
    files = scan_client_library_files(client_id)
    return {"ok": bool(ok), "files": files}


@router.post("/{client_id}/library/save")
def save_library_endpoint(client_id: str, payload: SaveLibraryPayload) -> dict:
    if not payload.project_name:
        raise HTTPException(status_code=400, detail="Missing project_name")
    ok, msg = save_client_library(client_id, payload.project_name)
    return {"ok": bool(ok), "message": msg}


@router.get("/saved")
def list_saved_libraries() -> dict:
    from pathlib import Path
    base = Path(client_manager.get_save_library_dir()).resolve()
    base.mkdir(parents=True, exist_ok=True)
    dirs = [p.name for p in base.iterdir() if p.is_dir()]
    dirs.sort()
    return {"dirs": dirs}


@router.post("/{client_id}/saved/load")
def load_saved(client_id: str, payload: LoadSavedPayload) -> dict:
    ok, msg = load_saved_library(client_id, payload.name)
    files = scan_client_library_files(client_id) if ok else {"yaml_files": [], "csv_files": [], "total_files": 0}
    return {"ok": bool(ok), "message": msg, "files": files}


@router.delete("/saved/{name}")
def delete_saved(name: str) -> dict:
    ok, msg = delete_saved_library(name)
    return {"ok": bool(ok), "message": msg}


@router.delete("/{client_id}/temp")
def clear_client_temp(client_id: str) -> dict:
    """Force-clear the temp directory for a specific client."""
    ok = client_manager.clear_client_temp(client_id)
    return {"ok": bool(ok)}


@router.post("/temp/sweep")
def sweep_temp() -> dict:
    """Remove temp client directories not associated with active sessions."""
    removed = client_manager.sweep_unused_temp()
    return {"removed": removed}

@router.post("/temp/sweep_all")
def sweep_temp_all() -> dict:
    """Remove all temp client directories."""
    removed = client_manager.sweep_all_temp()
    return {"removed": removed}


@router.post("/{client_id}/simulate")
def run_simulation(client_id: str) -> dict:
    """Run the simulation synchronously and return results when done.

    Note: This is a blocking call; for long simulations consider async/polling later.
    """
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")

    project_dir = client_manager.get_client_project_dir(client_id)
    if project_dir:
        result = run_wombat_simulation(library=project_dir)
    else:
        result = run_wombat_simulation()
    # best-effort: results were previously saved to results/ via WS thread; ensure same here
    try:
        import time
        path = f"results/{time.strftime('%Y-%m-%d_%H-%M')}_summary.yaml"
        add_client_library_file(client_id, path, content=result)
    except Exception:
        pass
    files = scan_client_library_files(client_id)
    return {"status": "finished", "results": result, "files": files}
