"""Saved library operations (save/load/delete)."""
from __future__ import annotations

from pathlib import Path
import logging
import shutil
from typing import Tuple

logger = logging.getLogger("uvicorn.error")


def save_client_library(client_id: str, project_name: str) -> Tuple[bool, str]:
    """Copy the client's temp library to the saved_library_dir under project_name."""
    from server.client_manager import client_manager
    try:
        if not client_id or client_id not in client_manager.client_projects:
            return False, "Client not found"
        src = Path(client_manager.get_client_project_dir(client_id)).resolve()
        if not src.exists():
            return False, "Source library does not exist"
        base_dest = client_manager.saved_library_dir
        base_dest.mkdir(parents=True, exist_ok=True)
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
    """Delete a saved library directory by name from server/client_library."""
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
    """Load a saved library into the client's temp project directory (replace current)."""
    from server.client_manager import client_manager
    try:
        if not client_id or client_id not in client_manager.client_projects:
            return False, "Client not found"
        dest_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
        base_saved = Path(client_manager.get_save_library_dir()).resolve()
        src_dir = (base_saved / saved_name).resolve()
        if not str(src_dir).startswith(str(base_saved)):
            return False, "Invalid saved library path"
        if not src_dir.exists() or not src_dir.is_dir():
            return False, "Saved library does not exist"
        if dest_dir.exists():
            shutil.rmtree(dest_dir, ignore_errors=False)
        shutil.copytree(src_dir, dest_dir, dirs_exist_ok=False)
        logger.info(f"Loaded saved library '{saved_name}' into client {client_id[:8]} project at {dest_dir}")
        return True, str(dest_dir)
    except Exception as e:
        logger.error(f"Error loading saved library for client {client_id[:8] if client_id else 'unknown'}: {e}")
        return False, str(e)
