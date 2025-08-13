from __future__ import annotations

import asyncio
import os
import shutil
import threading
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulations import run_wombat_simulation, get_simulation  # type: ignore

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


# WebSocket Event Handlers
async def handle_settings_update(websocket: WebSocket, data: dict) -> None:
    """Handle settings_update event from client."""
    settings_data = data.get('data', {})
    print(f"Received settings update: {settings_data}")
    await websocket.send_text("Settings received successfully")


async def handle_json_event(websocket: WebSocket, data: str) -> bool:
    """Parse and handle JSON events. Returns True if handled, False otherwise."""
    try:
        import json
        json_data = json.loads(data)
        if isinstance(json_data, dict) and "event" in json_data:
            event_type = json_data.get("event")
            
            # Event routing
            if event_type == "settings_update":
                await handle_settings_update(websocket, json_data)
                return True
            else:
                print(f"Unknown event type: {event_type}")
                await websocket.send_text(f"Unknown event: {event_type}")
                return True
                
    except json.JSONDecodeError:
        # Not JSON, let caller handle as text command
        pass
    
    return False


async def handle_message(websocket: WebSocket, data: str, running: bool, done_event, ticker_task) -> tuple[bool, bool, any, any]:
    """Handle incoming WebSocket messages. Returns (handled, new_running, new_done_event, new_ticker_task)."""
    text = (data or "").strip().lower()
    
    # Try JSON event handling first
    if await handle_json_event(websocket, data):
        return True, running, done_event, ticker_task
    
    # Handle text commands
    if text.startswith("run"):
        if running:
            await websocket.send_text("simulation already running")
            return True, running, done_event, ticker_task

        await websocket.send_text("starting simulation...")
        loop = asyncio.get_running_loop()

        new_done_event = threading.Event()
        new_running = True

        async def ticker() -> None:
            seconds = 1
            while new_done_event is not None and not new_done_event.is_set():
                try:
                    await websocket.send_text(f"running... {seconds}s")
                except Exception:
                    break
                seconds += 10
                await asyncio.sleep(10)

        new_ticker_task = loop.create_task(ticker())

        def set_not_running() -> None:
            nonlocal new_running
            new_running = False

        def worker() -> None:
            try:
                result = run_wombat_simulation()
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
            if new_done_event is not None:
                new_done_event.set()
            loop.call_soon_threadsafe(set_not_running)

        t = threading.Thread(target=worker, name="wombat-sim-thread", daemon=True)
        t.start()
        return True, new_running, new_done_event, new_ticker_task
        
    elif text == "clear_temp":
        temp_dir = Path("server/temp")
        print("Found ", os.listdir(temp_dir))
        for folder_name in os.listdir(temp_dir):
            path = os.path.join(temp_dir, folder_name)
            if os.path.isdir(path):
                shutil.rmtree(path)
                print("Cleaned ", path)
        return True, running, done_event, ticker_task
        
    elif text == "get_config":
        config = get_simulation()
        await websocket.send_text(config)
        return True, running, done_event, ticker_task
    
    # Not handled
    return False, running, done_event, ticker_task


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
            
            # Handle all messages through the unified handler
            handled, running, done_event, ticker_task = await handle_message(
                websocket, data, running, done_event, ticker_task
            )
            
            if not handled:
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
