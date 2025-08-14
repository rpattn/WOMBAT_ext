"""Library management for WOMBAT server - handles client-specific library modifications."""

import yaml
import logging
from pathlib import Path
from fastapi import WebSocket

logger = logging.getLogger("uvicorn.error")


async def handle_settings_update(websocket: WebSocket, data: dict, client_id: str = None) -> None:
    """Handle settings_update event from client."""
    from client_manager import client_manager

    settings_data = data.get('data', {})
    logger.info(f"Received settings update from client {client_id[:8] if client_id else 'unknown'}")

    if not client_id or client_id not in client_manager.client_projects:
        await websocket.send_text("Error: Client project not found")
        return

    try:
        # Resolve target file: use last selected file if available, otherwise fallback to base config
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        selected_rel_path = client_manager.get_last_selected_file(client_id)
        if selected_rel_path:
            target_file = project_dir / selected_rel_path
        else:
            target_file = project_dir / "project" / "config" / "base_2yr.yaml"

        # Ensure directory exists
        target_file.parent.mkdir(parents=True, exist_ok=True)

        if not target_file.exists():
            logger.warning(f"Target file did not exist, creating new: {target_file}")

        # Persist full content as provided by the client
        with open(target_file, 'w') as f:
            yaml.safe_dump(settings_data, f, default_flow_style=False)

        rel_display = str(target_file.relative_to(project_dir)) if project_dir in target_file.parents else str(target_file)
        await websocket.send_text(f"Saved settings to {rel_display} for client {client_id[:8]}")

    except Exception as e:
        logger.error(f"Error updating settings for client {client_id[:8] if client_id else 'unknown'}: {e}")
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
        
        logger.info(f"Updated library file for client {client_id[:8]}: {file_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error updating library file for client {client_id[:8]}: {e}")
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
        logger.error(f"Error reading library file for client {client_id[:8]}: {e}")
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
        logger.error(f"Error listing library files for client {client_id[:8]}: {e}")
        return []


def scan_library_files(library_path: str) -> dict:
    """
    Scan a WOMBAT library and return all .yaml and .csv files with their relative paths.
    
    Args:
        library_path: Path to the WOMBAT library directory
        
    Returns:
        Dictionary with 'yaml_files' and 'csv_files' lists containing relative paths
    """
    try:
        library_dir = Path(library_path)
        
        if not library_dir.exists():
            logger.warning(f"Library directory does not exist: {library_path}")
            return {"yaml_files": [], "csv_files": []}
        
        yaml_files = []
        csv_files = []
        
        # Recursively find all .yaml and .csv files
        for file_path in library_dir.rglob('*'):
            if file_path.is_file():
                relative_path = str(file_path.relative_to(library_dir))
                
                if file_path.suffix.lower() == '.yaml':
                    yaml_files.append(relative_path)
                elif file_path.suffix.lower() == '.csv':
                    csv_files.append(relative_path)
        
        # Sort the lists for consistent output
        yaml_files.sort()
        csv_files.sort()
        
        logger.info(f"Scanned library {library_path}: {len(yaml_files)} YAML files, {len(csv_files)} CSV files")
        
        return {
            "yaml_files": yaml_files,
            "csv_files": csv_files,
            "total_files": len(yaml_files) + len(csv_files)
        }
        
    except Exception as e:
        logger.error(f"Error scanning library files in {library_path}: {e}")
        return {"yaml_files": [], "csv_files": [], "total_files": 0}


def scan_client_library_files(client_id: str) -> dict:
    """
    Scan a client's WOMBAT library and return all .yaml and .csv files with their relative paths.
    
    Args:
        client_id: Client ID to scan library for
        
    Returns:
        Dictionary with 'yaml_files' and 'csv_files' lists containing relative paths
    """
    from client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        logger.warning(f"Client {client_id[:8] if client_id else 'unknown'} not found in client projects")
        return {"yaml_files": [], "csv_files": [], "total_files": 0}
    
    try:
        project_dir = client_manager.get_client_project_dir(client_id)
        logger.info(f"Scanning library files for client {client_id[:8]} in: {project_dir}")
        
        return scan_library_files(project_dir)
        
    except Exception as e:
        logger.error(f"Error scanning client library for {client_id[:8]}: {e}")
        return {"yaml_files": [], "csv_files": [], "total_files": 0}


def add_client_library_file(client_id: str, file_path: str, content=None) -> bool:
    """Add or overwrite a file in a client's library.

    Args:
        client_id: The client identifier
        file_path: Relative path within the client's project (e.g. "project/config/new.yaml")
        content: For YAML, can be a dict/object to dump or a YAML string. For CSV or text, pass a string.

    Returns:
        True on success, False on failure.
    """
    from client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        logger.warning(f"Client {client_id[:8] if client_id else 'unknown'} not found in client projects")
        return False
    
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = project_dir / file_path
        
        # Ensure directory exists
        target_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Determine how to write based on extension
        suffix = (target_file.suffix or '').lower()
        if suffix in ['.yaml', '.yml']:
            with open(target_file, 'w', encoding='utf-8') as f:
                if isinstance(content, str):
                    # If provided as YAML string, write directly
                    f.write(content)
                else:
                    # Dump dict/object as YAML
                    yaml.safe_dump(content if content is not None else {}, f, default_flow_style=False)
        else:
            # Treat everything else as plain text (e.g., CSV)
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write('' if content is None else str(content))
        
        rel_display = str(target_file.relative_to(project_dir)) if project_dir in target_file.parents else str(target_file)
        logger.info(f"Wrote file {rel_display} for client {client_id[:8]}")
    
    except Exception as e:
        logger.error(f"Error writing file for client {client_id[:8] if client_id else 'unknown'}: {e}")
        return False
    
    return True
