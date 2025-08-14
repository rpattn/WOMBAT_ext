from __future__ import annotations

import asyncio
import os
import shutil
from typing import Any
import threading
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

from wombat.api.simulation_setup import create_temp_config, create_temp_library

app = FastAPI(title="WOMBAT Simulation Server")

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


def _run_wombat_simulation(library: str = "DINWOODIE", config: str = "base.yaml") -> dict[str, Any]:
    # Local import to keep example self-contained and to avoid import cycles.
    from wombat.api.simulation_runner import run_simulation

    # Create temporary library and config
    temp_library = create_temp_library()
    temp_config = create_temp_config(temp_library, config)
    
    try:
        # Run simulation with temp library path
        result = run_simulation(library=str(temp_library), config=config)
        return result
    finally:
        # Clean up temp directory (optional - you might want to keep results)
        # shutil.rmtree(temp_library)
        pass


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_text(
        "Connected. Send 'run' to start a WOMBAT simulation in temp library."
    )

    try:
        running = False
        done_event: threading.Event | None = None
        ticker_task: asyncio.Task | None = None

        while True:
            data = await websocket.receive_text()
            text = (data or "").strip().lower()

            if text.startswith("run"):
                if running:
                    await websocket.send_text("simulation already running")
                    continue

                await websocket.send_text("starting simulation...")
                loop = asyncio.get_running_loop()

                done_event = threading.Event()
                running = True

                async def ticker() -> None:
                    seconds = 1
                    while done_event is not None and not done_event.is_set():
                        try:
                            await websocket.send_text(f"running... {seconds}s")
                        except Exception:
                            break
                        seconds += 10
                        await asyncio.sleep(10)

                ticker_task = loop.create_task(ticker())

                def set_not_running() -> None:
                    nonlocal running
                    running = False

                def worker() -> None:
                    try:
                        result = _run_wombat_simulation()
                        asyncio.run_coroutine_threadsafe(
                            websocket.send_text(f"simulation finished: {result}"),
                            loop,
                        )
                        asyncio.run_coroutine_threadsafe(
                            websocket.send_text(f"Send 'clear_temp' to clean files when done"),
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

                    # Signal ticker to stop and clear running flag
                    if done_event is not None:
                        done_event.set()
                    loop.call_soon_threadsafe(set_not_running)

                t = threading.Thread(target=worker, name="wombat-sim-thread", daemon=True)
                t.start()
                continue
            elif text == "clear_temp":
                temp_dir = Path("server/temp")
                print("Found ", os.listdir(temp_dir))
                for folder_name in os.listdir(temp_dir):
                    path = os.path.join(temp_dir, folder_name)
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                        print("Cleaned ", path)
                continue

            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        try:
            if done_event is not None and not done_event.is_set():
                done_event.set()
        finally:
            return

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
