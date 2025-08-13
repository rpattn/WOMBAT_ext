"""WebSocket event handlers for WOMBAT server."""

import json
from fastapi import WebSocket
from simulations import get_simulation


async def handle_settings_update(websocket: WebSocket, data: dict) -> None:
    """Handle settings_update event from client."""
    settings_data = data.get('data', {})
    print(f"Received settings update: {settings_data}")
    await websocket.send_text("Settings received successfully")


async def handle_json_event(websocket: WebSocket, data: str) -> bool:
    """Parse and handle JSON events. Returns True if handled, False otherwise."""
    try:
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


async def handle_get_config(websocket: WebSocket) -> None:
    """Handle get_config command."""
    config = get_simulation()
    await websocket.send_text(config)


async def handle_clear_temp(websocket: WebSocket) -> None:
    """Handle clear_temp command."""
    import os
    import shutil
    from pathlib import Path
    
    temp_dir = Path("server/temp")
    print("Found ", os.listdir(temp_dir))
    for folder_name in os.listdir(temp_dir):
        path = os.path.join(temp_dir, folder_name)
        if os.path.isdir(path):
            shutil.rmtree(path)
            print("Cleaned ", path)
