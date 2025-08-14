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
            elif event_type == "replace_file":
                await handle_replace_file(websocket, json_data, client_id)
                return True
            elif event_type == "save_library":
                await handle_save_library(websocket, json_data, client_id)
                return True
            elif event_type == "list_saved_libraries":
                await handle_list_saved_libraries(websocket)
                return True
            elif event_type == "load_saved_library":
                await handle_load_saved_library(websocket, json_data, client_id)
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
        config_data = get_client_library_file(client_id, "project/config/base.yaml")
        
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
                config_data = get_client_library_file(client_id, "project/config/base.yaml")
                
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
    raw = bool(data.get('raw'))
    if not file_path:
        await websocket.send_text("Error: No file path provided")
        return
    
    try:
        if raw:
            # Read the file directly as UTF-8 text (used for downloads)
            from pathlib import Path
            project_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
            abs_path = (project_dir / file_path).resolve()
            # Safety: ensure path is within the project directory
            if not str(abs_path).startswith(str(project_dir)):
                await websocket.send_text("Error: Invalid file path")
                return
            if not abs_path.exists() or not abs_path.is_file():
                await websocket.send_text(f"Error: File not found: {file_path}")
                return
            content = abs_path.read_text(encoding='utf-8')
            client_manager.set_last_selected_file(client_id, file_path)
            response = {
                'event': 'file_content',
                'file': file_path,
                'data': content,
                'raw': True
            }
            await websocket.send_text(json.dumps(response))
        else:
            # Get the file content via library manager (may parse YAML -> dict)
            file_content = get_client_library_file(client_id, file_path)
            if file_content is None:
                await websocket.send_text(f"Error: File not found: {file_path}")
                return
            # Persist the last selected file for this client so saves target the right path
            client_manager.set_last_selected_file(client_id, file_path)
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


async def handle_replace_file(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle replace_file event from client by overwriting the file content.

    Accepts payload:
    { "event": "replace_file", "data": { "file_path": "...", "content": "..." } }
    """
    from library_manager import add_client_library_file, scan_client_library_files
    from client_manager import client_manager
    import json

    if not (client_id and client_id in client_manager.client_projects):
        await websocket.send_text("Error: Client not found")
        return

    payload = data.get('data') if isinstance(data, dict) and 'data' in data else data
    file_path = payload.get('file_path') if isinstance(payload, dict) else None
    content = payload.get('content') if isinstance(payload, dict) else None
    if isinstance(file_path, str):
        file_path = file_path.strip().replace('\\', '/')
    if not file_path:
        await websocket.send_text("Error: Missing file_path in replace_file payload")
        return

    # Use add_client_library_file to overwrite existing file safely
    ok = add_client_library_file(client_id, file_path, content)
    await websocket.send_text(json.dumps({
        'event': 'replace_file_result',
        'ok': bool(ok),
        'file_path': file_path
    }))

    # Refresh library list
    try:
        files = scan_client_library_files(client_id)
        await websocket.send_text(json.dumps({'event': 'library_files', 'files': files}))
    except Exception:
        pass


async def handle_list_saved_libraries(websocket: WebSocket) -> None:
    """Return the list of directories under saved_library_dir."""
    import json
    from client_manager import client_manager
    from pathlib import Path
    try:
        base = Path(client_manager.get_save_library_dir()).resolve()
        if not base.exists():
            base.mkdir(parents=True, exist_ok=True)
        dirs = [p.name for p in base.iterdir() if p.is_dir()]
        dirs.sort()
        await websocket.send_text(json.dumps({
            'event': 'saved_libraries',
            'dirs': dirs
        }))
    except Exception as e:
        await websocket.send_text(json.dumps({
            'event': 'toast',
            'level': 'error',
            'message': f'Failed to list saved libraries: {e}'
        }))


async def handle_load_saved_library(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Load a saved library for the given client and refresh library files."""
    import json
    from library_manager import load_saved_library, scan_client_library_files
    from client_manager import client_manager
    try:
        saved_name = (data.get('data') or {}).get('name')
        if not saved_name:
            await websocket.send_text(json.dumps({
                'event': 'toast', 'level': 'error', 'message': 'Missing saved library name'
            }))
            return
        if not client_id or client_id not in client_manager.client_projects:
            await websocket.send_text(json.dumps({
                'event': 'toast', 'level': 'error', 'message': 'Client not found'
            }))
            return

        ok, msg = load_saved_library(client_id, saved_name)
        if ok:
            await websocket.send_text(json.dumps({
                'event': 'toast', 'level': 'success', 'message': f"Loaded saved library '{saved_name}'"
            }))
            # Refresh library files
            files = scan_client_library_files(client_id)
            await websocket.send_text(json.dumps({'event': 'library_files', 'files': files}))
        else:
            await websocket.send_text(json.dumps({
                'event': 'toast', 'level': 'error', 'message': f"Failed to load '{saved_name}': {msg}"
            }))
    except Exception as e:
        await websocket.send_text(json.dumps({
            'event': 'toast', 'level': 'error', 'message': f'Error loading saved library: {e}'
        }))

async def handle_save_library(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle save_library event from client."""
    from library_manager import save_client_library
    from client_manager import client_manager
    import json

    if not data['data']['project_name']:
        await websocket.send_text("Error: Missing project_name in save_library payload")
        return
    project_name = data['data']['project_name']
    
    if not (client_id and client_id in client_manager.client_projects):
        await websocket.send_text("Error: Client not found")
        return
    
    # Get client-specific project directory
    project_dir = client_manager.get_save_library_dir()
    
    if project_dir:
        result = save_client_library(client_id, project_name)
    else:
        # Fallback to default
        result = save_client_library(project_name)
    
    await websocket.send_text(json.dumps({
        'event': 'save_library_result',
        'ok': bool(result),
        'project_dir': project_dir
    }))
    
    # Refresh library list
    try:
        files = scan_client_library_files(client_id)
        await websocket.send_text(json.dumps({'event': 'library_files', 'files': files}))
    except Exception:
        pass