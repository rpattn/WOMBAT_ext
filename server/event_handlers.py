"""WebSocket event handlers for WOMBAT server."""

import json
import logging
from fastapi import WebSocket
from simulations import get_simulation

logger = logging.getLogger("uvicorn.error")


async def handle_json_event(websocket: WebSocket, data: str, client_id: str = None) -> bool:
    """Parse and handle JSON events. Returns True if handled, False otherwise."""
    try:
        json_data = json.loads(data)
        if isinstance(json_data, dict) and "event" in json_data:
            event_type = json_data.get("event")
            
            # Event routing
            if event_type == "settings_update":
                from library_manager import handle_settings_update
                await handle_settings_update(websocket, json_data, client_id)
                return True
            else:
                logger.warning(f"Unknown event type: {event_type}")
                await websocket.send_text(f"Unknown event: {event_type}")
                return True
                
    except json.JSONDecodeError:
        # Not JSON, let caller handle as text command
        pass
    
    return False


async def handle_get_config(websocket: WebSocket, client_id: str = None) -> None:
    """Handle get_config command."""
    from client_manager import client_manager
    from library_manager import get_client_library_file
    import json
    
    if client_id and client_id in client_manager.client_projects:
        # Get client-specific configuration from their project
        project_dir = client_manager.get_client_project_dir(client_id)
        logger.info(f"Getting config for client {client_id[:8]} from: {project_dir}")
        
        # Read the client's configuration file directly
        config_data = get_client_library_file(client_id, "project/config/base_2yr.yaml")
        
        if config_data:
            # Convert to JSON string for sending
            config = json.dumps(config_data, indent=2)
        else:
            # Config file not found, regenerate full library for this client
            logger.warning(f"Config file not found for client {client_id[:8]}, regenerating full library")
            
            try:
                # Regenerate the full client project with library and config
                from client_manager import client_manager
                new_project_dir = client_manager._create_client_project(client_id)
                
                # Update the client's project directory reference
                client_manager.client_projects[client_id] = new_project_dir
                
                logger.info(f"Regenerated full library for client {client_id[:8]}: {new_project_dir}")
                
                # Now try to get the config again from the newly created library
                config_data = get_client_library_file(client_id, "project/config/base_2yr.yaml")
                
                if config_data:
                    config = json.dumps(config_data, indent=2)
                    logger.info(f"Successfully loaded config from regenerated library for client {client_id[:8]}")
                else:
                    # Final fallback to simulation API
                    logger.error(f"Failed to load config even after library regeneration for client {client_id[:8]}")
                    config = get_simulation()
                    
            except Exception as e:
                logger.error(f"Failed to regenerate library for client {client_id[:8]}: {e}")
                # Fallback to simulation API
                config = get_simulation()
    else:
        # Fallback to default configuration
        config = get_simulation()
    
    await websocket.send_text(config)


async def handle_clear_temp(websocket: WebSocket) -> None:
    """Handle clear_temp command."""
    import os
    import shutil
    from pathlib import Path
    
    temp_dir = Path("server/temp")
    logger.info(f"Found temp directories: {os.listdir(temp_dir)}")
    for folder_name in os.listdir(temp_dir):
        path = os.path.join(temp_dir, folder_name)
        if os.path.isdir(path):
            shutil.rmtree(path)
            logger.info(f"Cleaned temp directory: {path}")
