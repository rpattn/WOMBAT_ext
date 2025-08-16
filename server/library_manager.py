"""Library management for WOMBAT server - handles client-specific library modifications."""

import yaml
import logging
from pathlib import Path
import os
import shutil
from typing import Tuple

logger = logging.getLogger("uvicorn.error")


# WebSocket-based settings update handler removed as part of REST-only migration


async def update_client_library_file(client_id: str, file_path: str, content: dict) -> bool:
    """Update a specific file in the client's library."""
    from server.client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        return False
    
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
        safe_rel = file_path.replace('\\', '/') if isinstance(file_path, str) else str(file_path)
        target_file = (project_dir / safe_rel)
        
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


def _unique_destination(base_dir: Path, desired_name: str) -> Path:
    """Return a unique destination directory under base_dir for desired_name."""
    safe = desired_name.strip().replace('\r', '').replace('\n', '').strip('/\\') or 'project'
    dest = base_dir / safe
    if not dest.exists():
        return dest
    i = 1
    while True:
        candidate = base_dir / f"{safe}-{i}"
        if not candidate.exists():
            return candidate
        i += 1


def save_client_library(client_id: str, project_name: str) -> Tuple[bool, str]:
    """
    Copy the current client's temp library to the saved_library_dir under project_name.

    Returns (ok, destination_path_str)
    """
    from server.client_manager import client_manager
    
    try:
        if not client_id or client_id not in client_manager.client_projects:
            return False, "Client not found"

        src = Path(client_manager.get_client_project_dir(client_id)).resolve()
        if not src.exists():
            return False, "Source library does not exist"

        base_dest = client_manager.saved_library_dir
        base_dest.mkdir(parents=True, exist_ok=True)
        # Overwrite if a project with the same name exists
        safe = project_name.strip().replace('\r', '').replace('\n', '').strip('/\\') or 'project'
        dest = (base_dest / safe)
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=False)
        shutil.copytree(src, dest, dirs_exist_ok=False)
        logger.info(f"Saved client {client_id[:8]} library from {src} to {dest}")
        return True, str(dest)
    except Exception as e:
        logger.error(f"Error saving library for client {client_id[:8] if client_id else 'unknown'}: {e}")
        return False, str(e)


def delete_saved_library(saved_name: str) -> Tuple[bool, str]:
    """Delete a saved library directory by name from server/client_library.

    Returns (ok, message)
    """
    from server.client_manager import client_manager
    try:
        base_saved = Path(client_manager.get_save_library_dir()).resolve()
        target = (base_saved / saved_name).resolve()
        if not str(target).startswith(str(base_saved)):
            return False, "Invalid saved library path"
        if not target.exists() or not target.is_dir():
            return False, "Saved library does not exist"
        shutil.rmtree(target, ignore_errors=False)
        logger.info(f"Deleted saved library '{saved_name}' from {target}")
        return True, f"Deleted '{saved_name}'"
    except Exception as e:
        logger.error(f"Error deleting saved library '{saved_name}': {e}")
        return False, str(e)

def load_saved_library(client_id: str, saved_name: str) -> Tuple[bool, str]:
    """Load a saved library into the client's temp project directory.

    This will REPLACE the client's current temp project directory with the
    contents of server/client_library/<saved_name>.

    Returns (ok, message_or_dest_path)
    """
    from server.client_manager import client_manager
    try:
        if not client_id or client_id not in client_manager.client_projects:
            return False, "Client not found"

        dest_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
        base_saved = Path(client_manager.get_save_library_dir()).resolve()
        src_dir = (base_saved / saved_name).resolve()

        # Ensure src_dir is inside base_saved to avoid path traversal
        if not str(src_dir).startswith(str(base_saved)):
            return False, "Invalid saved library path"
        if not src_dir.exists() or not src_dir.is_dir():
            return False, "Saved library does not exist"

        # Remove current dest_dir and replace with copy of src_dir
        if dest_dir.exists():
            shutil.rmtree(dest_dir, ignore_errors=False)
        shutil.copytree(src_dir, dest_dir, dirs_exist_ok=False)
        logger.info(f"Loaded saved library '{saved_name}' into client {client_id[:8]} project at {dest_dir}")
        return True, str(dest_dir)
    except Exception as e:
        logger.error(f"Error loading saved library for client {client_id[:8] if client_id else 'unknown'}: {e}")
        return False, str(e)


def delete_client_library_file(client_id: str, file_path: str) -> bool:
    """Delete a file from a client's library.

    Args:
        client_id: The client identifier
        file_path: Relative path within the client's project

    Returns:
        True on success, False on failure or if file does not exist.
    """
    from server.client_manager import client_manager
    try:
        if not client_id or client_id not in client_manager.client_projects:
            logger.warning(f"Client {client_id[:8] if client_id else 'unknown'} not found in client projects")
            return False

        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = project_dir / file_path

        # Normalize and ensure path stays within project_dir
        try:
            target_file = target_file.resolve()
            # Robust inside-project check (Windows-safe)
            base = os.path.normcase(os.path.abspath(str(project_dir)))
            cand = os.path.normcase(os.path.abspath(str(target_file)))
            if not (cand == base or cand.startswith(base + os.sep)):
                logger.error(f"Refusing to delete outside project dir: {target_file} (base={base}, cand={cand})")
                return False
        except Exception:
            logger.error(f"Refusing to delete outside project dir (resolve/check failed): {target_file}")
            return False

        if not target_file.exists():
            # Try alternate normalization (backslashes) in case of oddities
            alt_rel = str(file_path).replace('/', '\\')
            alt_target = (project_dir / alt_rel)
            exists_alt = alt_target.exists()
            logger.info(f"Delete requested for non-existent file: {target_file} | alt: {alt_target} exists={exists_alt}")
            if not exists_alt:
                return False
            target_file = alt_target.resolve()

        target_file.unlink()
        try:
            rel = target_file.relative_to(project_dir)
        except Exception:
            rel = target_file.name
        logger.info(f"Deleted file {rel} for client {client_id[:8]}")
        return True
    except Exception as e:
        logger.error(f"Error deleting file for client {client_id[:8] if client_id else 'unknown'}: {e}")
        return False
        
    


def get_client_library_file(client_id: str, file_path: str):
    """Get the content of a specific file from the client's library.

    Returns:
        - dict for YAML files
        - str for CSV/text files
        - {} or '' on error
    """
    from server.client_manager import client_manager
    
    if not client_id or client_id not in client_manager.client_projects:
        return {} if str(file_path).lower().endswith(('.yaml', '.yml')) else ''
    
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = project_dir / file_path
        
        if not target_file.exists():
            return {}
        
        suffix = (target_file.suffix or '').lower()
        if suffix in ['.yaml', '.yml']:
            with open(target_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        else:
            # Treat CSV and any other non-YAML files as plain UTF-8 text
            with open(target_file, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
            
    except Exception as e:
        logger.error(f"Error reading library file for client {client_id[:8]}: {e}")
        return {}


def list_client_library_files(client_id: str, directory: str = "") -> list:
    """List files in the client's library directory."""
    from server.client_manager import client_manager
    
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
            return {"yaml_files": [], "csv_files": [], "html_files": [], "png_files": [], "total_files": 0}
        
        yaml_files = []
        csv_files = []
        html_files = []
        png_files = []
        
        # Recursively find all .yaml and .csv files
        for file_path in library_dir.rglob('*'):
            if file_path.is_file():
                relative_path = str(file_path.relative_to(library_dir))
                
                if file_path.suffix.lower() == '.yaml':
                    yaml_files.append(relative_path)
                elif file_path.suffix.lower() == '.csv':
                    csv_files.append(relative_path)
                elif file_path.suffix.lower() == '.html':
                    html_files.append(relative_path)
                elif file_path.suffix.lower() == '.png':
                    png_files.append(relative_path)
        
        # Sort the lists for consistent output
        yaml_files.sort()
        csv_files.sort()
        html_files.sort()
        png_files.sort()
        
        logger.info(f"Scanned library {library_path}: {len(yaml_files)} YAML files, {len(csv_files)} CSV files")
        
        return {
            "yaml_files": yaml_files,
            "csv_files": csv_files,
            "html_files": html_files,
            "png_files": png_files,
            "total_files": len(yaml_files) + len(csv_files) + len(html_files) + len(png_files)
        }
        
    except Exception as e:
        logger.error(f"Error scanning library files in {library_path}: {e}")
        return {"yaml_files": [], "csv_files": [], "html_files": [], "png_files": [], "total_files": 0}


def scan_client_library_files(client_id: str) -> dict:
    """
    Scan a client's WOMBAT library and return all .yaml and .csv files with their relative paths.
    
    Args:
        client_id: Client ID to scan library for
        
    Returns:
        Dictionary with 'yaml_files' and 'csv_files' lists containing relative paths
    """
    from server.client_manager import client_manager
    
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
    from server.client_manager import client_manager
    
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
