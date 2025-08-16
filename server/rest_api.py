from __future__ import annotations

from fastapi import APIRouter

from server.routers import session as session_router
from server.routers import library as library_router
from server.routers import saved as saved_router
from server.routers import temp as temp_router
from server.routers import simulations as simulations_router


router = APIRouter(prefix="/api", tags=["wombat-rest"])

# Mount sub-routers under the /api prefix
router.include_router(session_router.router)
router.include_router(library_router.router)
router.include_router(saved_router.router)
router.include_router(temp_router.router)
router.include_router(simulations_router.router)
