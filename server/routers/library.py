from __future__ import annotations

"""Library-related routes: file CRUD, listing, config, and saving client library.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from typing import Any
from fastapi import APIRouter, HTTPException, Query

from server.client_manager import client_manager
from server.models import (
    AddOrReplacePayload,
    SaveLibraryPayload,
    FileListResponse,
    RefreshResponse,
    FileContentResponse,
    RawFileContentResponse,
    OperationOkResponse,
)
from server.services.libraries import (
    get_client_library_file,
    scan_client_library_files,
    add_client_library_file,
    delete_client_library_file,
)
from server.services.saved_libraries import save_client_library

router = APIRouter(prefix="", tags=["library"])


@router.get("/{client_id}/config")
def get_config(client_id: str) -> Any:
    from server.simulations import get_simulation
    from server.library_manager import get_client_library_file as compat_get_file

    if client_manager.get_client_project_dir(client_id):
        data = compat_get_file(client_id, "project/config/base.yaml")
        if data:
            return data
    return get_simulation()


@router.get("/{client_id}/library/files", response_model=FileListResponse)
def list_library_files(client_id: str) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    files = scan_client_library_files(client_id)
    return {"files": files}


@router.get("/{client_id}/refresh", response_model=RefreshResponse)
def refresh_state(client_id: str) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")

    files = scan_client_library_files(client_id)
    cfg = get_config(client_id)

    from pathlib import Path
    base = Path(client_manager.get_save_library_dir()).resolve()
    base.mkdir(parents=True, exist_ok=True)
    dirs = [p.name for p in base.iterdir() if p.is_dir()]
    dirs.sort()

    return {"files": files, "config": cfg, "saved": dirs}


# Use a union of raw and parsed responses; FastAPI will validate at runtime.
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


@router.post("/{client_id}/library/file", response_model=OperationOkResponse)
def add_file(client_id: str, payload: AddOrReplacePayload) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    ok = add_client_library_file(client_id, payload.file_path.strip().replace("\\", "/"), payload.content)
    files = scan_client_library_files(client_id)
    return {"ok": bool(ok), "files": files}


@router.put("/{client_id}/library/file", response_model=OperationOkResponse)
def replace_file(client_id: str, payload: AddOrReplacePayload) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    ok = add_client_library_file(client_id, payload.file_path.strip().replace("\\", "/"), payload.content)
    files = scan_client_library_files(client_id)
    return {"ok": bool(ok), "files": files}


@router.delete("/{client_id}/library/file", response_model=OperationOkResponse)
def delete_file(client_id: str, file_path: str = Query(...)) -> dict:
    if not client_manager.get_client_project_dir(client_id):
        raise HTTPException(status_code=404, detail="Unknown client_id")
    ok = delete_client_library_file(client_id, file_path)
    files = scan_client_library_files(client_id)
    return {"ok": bool(ok), "files": files}


@router.post("/{client_id}/library/save", response_model=OperationOkResponse)
def save_library_endpoint(client_id: str, payload: SaveLibraryPayload) -> dict:
    if not payload.project_name:
        raise HTTPException(status_code=400, detail="Missing project_name")
    ok, msg = save_client_library(client_id, payload.project_name)
    return {"ok": bool(ok), "message": msg}
