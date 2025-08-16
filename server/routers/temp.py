from __future__ import annotations

from fastapi import APIRouter

from server.client_manager import client_manager

router = APIRouter(prefix="", tags=["temp"])


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
