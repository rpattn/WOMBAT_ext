from __future__ import annotations

"""Saved libraries routes: list, load into client, and delete saved libraries.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from fastapi import APIRouter

from server.client_manager import client_manager
from server.models import LoadSavedPayload
from server.services.libraries import scan_client_library_files
from server.services.saved_libraries import (
    load_saved_library,
    delete_saved_library,
)

router = APIRouter(prefix="", tags=["saved"])


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
