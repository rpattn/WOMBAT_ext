from __future__ import annotations

"""Session routes: create and end client sessions.

Routes are included under the `/api` prefix from `server/rest_api.py`.
"""

from fastapi import APIRouter, HTTPException

from server.client_manager import client_manager

router = APIRouter(prefix="", tags=["session"])


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
