"""Run with: fastapi dev examples/api/wombat_simulation_server.py"""

from __future__ import annotations

import asyncio
from typing import Any
import threading

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="WOMBAT Simulation Server")

try:
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
except Exception:
    CORSMiddleware = None  # type: ignore[assignment]

if CORSMiddleware is not None:
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


def _run_wombat_simulation(library: str = "DINWOODIE", config: str = "base_2yr.yaml") -> dict[str, Any]:
    from wombat import Simulation

    sim = Simulation.from_config(library, config)
    sim.run()
    # Minimal result payload; expand as needed
    return {"status": "completed", "name": sim.config.name}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_text(
        "Connected. Send 'run' to start a WOMBAT simulation (DINWOODIE/base_2yr.yaml)."
    )

    try:
        while True:
            data = await websocket.receive_text()
            text = (data or "").strip().lower()

            if text.startswith("run"):
                await websocket.send_text("starting simulation...")
                loop = asyncio.get_running_loop()

                def worker() -> None:
                    try:
                        result = _run_wombat_simulation()
                        asyncio.run_coroutine_threadsafe(
                            websocket.send_text(f"simulation finished: {result}"),
                            loop,
                        )
                    except Exception as exc:  # noqa: BLE001
                        try:
                            asyncio.run_coroutine_threadsafe(
                                websocket.send_text(f"simulation error: {exc}"),
                                loop,
                            )
                        except Exception:
                            pass

                t = threading.Thread(target=worker, name="wombat-sim-thread", daemon=True)
                t.start()
                continue

            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        return


