"""Message handling for WebSocket connections."""

from fastapi import WebSocket
from server.event_handlers import handle_json_event, handle_get_config, handle_clear_temp, handle_get_library_files
from server.simulation_manager import handle_run_simulation

async def handle_message(websocket: WebSocket, data: str, client_id: str) -> bool:
    """Handle incoming WebSocket messages for a specific client. Returns True if handled."""
    text = (data or "").strip().lower()
    
    # Try JSON event handling first
    if await handle_json_event(websocket, data, client_id):
        return True
    
    # Handle text commands
    if text.startswith("run"):
        return await handle_run_simulation(websocket, client_id)
        
    elif text == "clear_temp":
        await handle_clear_temp(websocket)
        return True
        
    elif text == "get_config":
        await handle_get_config(websocket, client_id)
        return True
    
    elif text == "get_library_files":
        await handle_get_library_files(websocket, client_id)
        return True
    
    # Not handled
    return False
