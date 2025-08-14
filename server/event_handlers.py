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
            elif event_type == "file_select":
                await handle_file_select(websocket, json_data, client_id)
                return True
            elif event_type == "add_file":
                await handle_add_file(websocket, json_data, client_id)
                return True
            elif event_type == "delete_file":
                await handle_delete_file(websocket, json_data, client_id)
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


async def handle_file_select(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle file_select event from client."""
    from client_manager import client_manager
    from library_manager import get_client_library_file
    import json
    import os
    
    if not client_id or client_id not in client_manager.client_projects:
        await websocket.send_text("Error: Client project not found")
        return
    
    file_path = data.get('data', '').replace('\\', '/')  # Normalize path separators
    if not file_path:
        await websocket.send_text("Error: No file path provided")
        return
    
    try:
        # Get the file content from the client's project
        file_content = get_client_library_file(client_id, file_path)
        
        if file_content is None:
            await websocket.send_text(f"Error: File not found: {file_path}")
            return
        
        # Persist the last selected file for this client so saves target the right path
        client_manager.set_last_selected_file(client_id, file_path)
            
        # Send the file content back to the client
        response = {
            'event': 'file_content',
            'file': file_path,
            'data': file_content
        }
        await websocket.send_text(json.dumps(response))
        
    except Exception as e:
        logger.error(f"Error reading file {file_path} for client {client_id[:8] if client_id else 'unknown'}: {e}")
        await websocket.send_text(f"Error reading file: {str(e)}")


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


async def handle_get_library_files(websocket: WebSocket, client_id: str = None) -> None:
    """Handle get_library_files command."""
    from library_manager import scan_client_library_files
    from client_manager import client_manager
    
    if client_id and client_id in client_manager.client_projects:
        files = scan_client_library_files(client_id)
        message = {
            'event': 'library_files',
            'files': files
        }
        await websocket.send_text(json.dumps(message))
    else:
        await websocket.send_text("Client not found")

async def handle_add_file(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle add_file event from client.

    Expected payloads:
    - { "event": "add_file", "data": { "file_path": "path/to/file.yaml", "content": {..}|"..." } }
    - { "event": "add_file", "file_path": "path/to/file.yaml", "content": {..}|"..." }
    """
    from library_manager import add_client_library_file, scan_client_library_files
    from client_manager import client_manager
    import json

    if not (client_id and client_id in client_manager.client_projects):
        await websocket.send_text("Error: Client not found")
        return

    payload = data.get('data') if isinstance(data, dict) and 'data' in data else data
    file_path = payload.get('file_path') if isinstance(payload, dict) else None
    if isinstance(file_path, str):
        file_path = file_path.strip()
        # Normalize to forward slashes; server-side delete handles both
        file_path = file_path.replace('\\', '/')
    content = payload.get('content') if isinstance(payload, dict) else None

    if not file_path:
        await websocket.send_text("Error: Missing file_path in add_file payload")
        return

    ok = add_client_library_file(client_id, file_path, content)

    # Send immediate result
    await websocket.send_text(json.dumps({
        'event': 'add_file_result',
        'ok': bool(ok),
        'file_path': file_path
    }))

    # Also refresh the library list for the client
    try:
        files = scan_client_library_files(client_id)
        await websocket.send_text(json.dumps({
            'event': 'library_files',
            'files': files
        }))
    except Exception as _:
        # Best-effort refresh; ignore errors here
        pass


async def handle_delete_file(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle delete_file event from client.

    Expected payloads:
    - { "event": "delete_file", "data": { "file_path": "path/to/file.yaml" } }
    - { "event": "delete_file", "file_path": "path/to/file.yaml" }
    """
    from library_manager import delete_client_library_file, scan_client_library_files
    from client_manager import client_manager
    from pathlib import Path
    import json

    if not (client_id and client_id in client_manager.client_projects):
        await websocket.send_text("Error: Client not found")
        return

    payload = data.get('data') if isinstance(data, dict) and 'data' in data else data
    file_path = payload.get('file_path') if isinstance(payload, dict) else None
    
    if not file_path:
        await websocket.send_text("Error: Missing file_path in delete_file payload")
        return

    # Normalize for logging/diagnostics
    norm_rel = file_path.replace('\\', '/').strip()
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
        abs_candidate = (project_dir / norm_rel).resolve()
    except Exception:
        project_dir = None
        abs_candidate = None

    ok = delete_client_library_file(client_id, norm_rel)

    result = {
        'event': 'delete_file_result',
        'ok': bool(ok),
        'file_path': file_path
    }
    if abs_candidate is not None and project_dir is not None:
        # Provide optional reason/context for debugging client issues
        result['abs'] = str(abs_candidate)
        result['base'] = str(project_dir)

    await websocket.send_text(json.dumps(result))

    # Refresh library list
    try:
        files = scan_client_library_files(client_id)
        await websocket.send_text(json.dumps({
            'event': 'library_files',
            'files': files
        }))
    except Exception:
        pass