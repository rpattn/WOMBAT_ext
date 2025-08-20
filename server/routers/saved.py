from __future__ import annotations

"""Saved libraries routes: list, load into client, and delete saved libraries.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from fastapi import APIRouter, HTTPException, Query

from server.client_manager import client_manager
from server.models import LoadSavedPayload, SavedListResponse, OkWithFilesAndMessageResponse, OperationOkResponse
from server.services.libraries import scan_client_library_files, scan_library_files
from server.services.saved_libraries import (
    load_saved_library,
    delete_saved_library,
    restore_working_session,
)

router = APIRouter(prefix="", tags=["saved"])


@router.get("/saved", response_model=SavedListResponse)
def list_saved_libraries() -> dict:
    from pathlib import Path
    base = Path(client_manager.get_save_library_dir()).resolve()
    base.mkdir(parents=True, exist_ok=True)
    dirs = [p.name for p in base.iterdir() if p.is_dir()]
    dirs.sort()
    return {"dirs": dirs}


@router.post("/{client_id}/saved/load", response_model=OkWithFilesAndMessageResponse)
def load_saved(client_id: str, payload: LoadSavedPayload) -> dict:
    ok, msg = load_saved_library(client_id, payload.name)
    files = scan_client_library_files(client_id) if ok else {"yaml_files": [], "csv_files": [], "total_files": 0}
    return {"ok": bool(ok), "message": msg, "files": files}


@router.delete("/saved/{name}", response_model=OperationOkResponse)
def delete_saved(name: str) -> dict:
    ok, msg = delete_saved_library(name)
    return {"ok": bool(ok), "message": msg}


@router.post("/{client_id}/working/restore", response_model=OkWithFilesAndMessageResponse)
def restore_working(client_id: str) -> dict:
    ok, msg = restore_working_session(client_id)
    files = scan_client_library_files(client_id) if ok else {"yaml_files": [], "csv_files": [], "total_files": 0}
    return {"ok": bool(ok), "message": msg, "files": files}


@router.get("/saved/{name}/files")
def list_saved_library_files(name: str) -> dict:
    """List files inside a specific saved library directory without loading it."""
    from pathlib import Path
    from server.client_manager import client_manager

    base = Path(client_manager.get_save_library_dir()).resolve()
    base.mkdir(parents=True, exist_ok=True)
    target = (base / name).resolve()
    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid saved library path")
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail="Saved library does not exist")
    files = scan_library_files(str(target))
    return {"files": files}


@router.get("/saved/{name}/file")
def read_saved_library_file(
    name: str,
    path: str = Query(..., description="Relative path within the saved library"),
    raw: bool = Query(False, description="If true, returns raw file; may be base64 for binary"),
):
    """Read a file from a specific saved library without loading it into a client session."""
    from pathlib import Path
    import base64
    import mimetypes
    import yaml
    from server.client_manager import client_manager
    from server.utils.paths import resolve_inside

    base = Path(client_manager.get_save_library_dir()).resolve()
    src_dir = (base / name).resolve()
    if not str(src_dir).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid saved library path")
    if not src_dir.exists() or not src_dir.is_dir():
        raise HTTPException(status_code=404, detail="Saved library does not exist")

    abs_path = resolve_inside(src_dir, path)
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    if raw:
        mime_guess, _ = mimetypes.guess_type(abs_path.name)
        is_binary = abs_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp"}
        if is_binary:
            data_b64 = base64.b64encode(abs_path.read_bytes()).decode("ascii")
            return {"file": path, "data_b64": data_b64, "mime": mime_guess or "application/octet-stream", "raw": True}
        else:
            content = abs_path.read_text(encoding="utf-8")
            return {"file": path, "data": content, "mime": mime_guess or "text/plain", "raw": True}
    else:
        suffix = (abs_path.suffix or '').lower()
        if suffix in [".yaml", ".yml"]:
            with open(abs_path, 'r', encoding='utf-8') as f:
                return {"file": path, "data": yaml.safe_load(f)}
        else:
            with open(abs_path, 'r', encoding='utf-8', errors='replace') as f:
                return {"file": path, "data": f.read()}
