from __future__ import annotations

"""WOMBAT Simulation Server - Main FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.rest_api import router as rest_router  # type: ignore[relative-beyond-top-level]

app = FastAPI(title="WOMBAT Simulation Server")

# Mount REST API router
app.include_router(rest_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload_excludes=["server/temp/*", "server/client_library/*"], reload=True)
