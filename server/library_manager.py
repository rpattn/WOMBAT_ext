"""Library management for WOMBAT server - handles client-specific library modifications."""

import yaml
from pathlib import Path
from fastapi import WebSocket


async def handle_settings_update(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle settings_update event from client."""
    from client_manager import client_manager
    
    settings_data = data.get('data', {})
    print(f"Received settings update from client {client_id[:8] if client_id else 'unknown'}: {settings_data}")
    
    if not client_id or client_id not in client_manager.client_projects:
        await websocket.send_text("Error: Client project not found")
        return
    
    try:
        # Get client's project directory
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        config_file = project_dir / "project" / "config" / "base_2yr.yaml"
        
        if not config_file.exists():
            await websocket.send_text("Error: Configuration file not found")
            return
        
        # Load existing config
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)
        
        # Update config with new settings
        for key, value in settings_data.items():
            if key in config:
                if config[key] == value:
                    continue
                config[key] = value
                print(f"Updated {key}: {value}")
        
        # Save updated config back to client's project
        with open(config_file, 'w') as f:
            yaml.safe_dump(config, f, default_flow_style=False)
        
        await websocket.send_text(f"Settings updated successfully for client {client_id[:8]}")
        
    except Exception as e:
        print(f"Error updating settings for client {client_id[:8] if client_id else 'unknown'}: {e}")
        await websocket.send_text(f"Error updating settings: {str(e)}")


async def update_client_library_file(client_id: str, file_path: str, content: dict) -> bool:
    """Update a specific file in the client's library."""
    from client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        return False
    
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = project_dir / file_path
        
        # Ensure directory exists
        target_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Save content to file
        with open(target_file, 'w') as f:
            yaml.safe_dump(content, f, default_flow_style=False)
        
        print(f"Updated library file for client {client_id[:8]}: {file_path}")
        return True
        
    except Exception as e:
        print(f"Error updating library file for client {client_id[:8]}: {e}")
        return False


def get_client_library_file(client_id: str, file_path: str) -> dict:
    """Get the content of a specific file from the client's library."""
    from client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        return {}
    
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = project_dir / file_path
        
        if not target_file.exists():
            return {}
        
        with open(target_file, 'r') as f:
            return yaml.safe_load(f) or {}
            
    except Exception as e:
        print(f"Error reading library file for client {client_id[:8]}: {e}")
        return {}


def list_client_library_files(client_id: str, directory: str = "") -> list:
    """List files in the client's library directory."""
    from client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        return []
    
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_dir = project_dir / directory if directory else project_dir
        
        if not target_dir.exists():
            return []
        
        files = []
        for item in target_dir.iterdir():
            if item.is_file():
                files.append(str(item.relative_to(project_dir)))
            elif item.is_dir():
                files.extend([
                    str(subitem.relative_to(project_dir)) 
                    for subitem in item.rglob('*') 
                    if subitem.is_file()
                ])
        
        return sorted(files)
        
    except Exception as e:
        print(f"Error listing library files for client {client_id[:8]}: {e}")
        return []
