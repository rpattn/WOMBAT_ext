"""Simulation management for WOMBAT server."""

import asyncio
import threading
import logging
from fastapi import WebSocket
from client_manager import client_manager
from simulations import run_wombat_simulation

logger = logging.getLogger("uvicorn.error")

async def handle_run_simulation(websocket: WebSocket, client_id: str) -> bool:
    """Handle run simulation command for a specific client."""
    # Get client's simulation state
    sim_state = client_manager.get_client_simulation_state(client_id)
    running = sim_state.get("running", False)
    
    if running:
        await websocket.send_text("simulation already running")
        return True

    await websocket.send_text("starting simulation...")
    loop = asyncio.get_running_loop()

    new_done_event = threading.Event()
    
    async def ticker() -> None:
        """Send periodic updates to the client during simulation."""
        seconds = 0
        while new_done_event is not None and not new_done_event.is_set():
            try:
                # Send only to this specific client
                update_text = f"running... {seconds}s" if seconds > 0 else "running..."
                await websocket.send_text(update_text)
            except Exception:
                break
            seconds += 5
            await asyncio.sleep(5)

    new_ticker_task = loop.create_task(ticker())

    def worker() -> None:
        """Run the simulation in a separate thread."""
        try:
            # Get client-specific project directory
            from client_manager import client_manager
            project_dir = client_manager.get_client_project_dir(client_id)
            
            if project_dir:
                result = run_wombat_simulation(library=project_dir)
            else:
                # Fallback to default
                result = run_wombat_simulation()
            
            # Send results only to the client that initiated the simulation
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
        # Update client's simulation state
        client_manager.update_client_simulation_state(
            client_id, 
            running=False, 
            done_event=None, 
            ticker_task=None
        )

    # Update client's simulation state
    client_manager.update_client_simulation_state(
        client_id,
        running=True,
        done_event=new_done_event,
        ticker_task=new_ticker_task
    )

    # Start simulation in a separate thread
    t = threading.Thread(target=worker, name=f"wombat-sim-{client_id}", daemon=True)
    t.start()
    return True
