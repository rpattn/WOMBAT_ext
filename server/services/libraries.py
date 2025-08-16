"""Library file operations and scanning services."""
from __future__ import annotations

from pathlib import Path
import logging
import yaml
import os
from typing import Tuple

from server.utils.paths import resolve_inside

logger = logging.getLogger("uvicorn.error")


async def update_client_library_file(client_id: str, file_path: str, content: dict) -> bool:
    from server.client_manager import client_manager
    if not client_id or client_id not in client_manager.client_projects:
        return False
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id)).resolve()
        target_file = resolve_inside(project_dir, file_path)
        target_file.parent.mkdir(parents=True, exist_ok=True)
        with open(target_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump(content, f, default_flow_style=False)
        logger.info(f"Updated library file for client {client_id[:8]}: {file_path}")
        return True
    except Exception as e:
        logger.error(f"Error updating library file for client {client_id[:8]}: {e}")
        return False


def get_client_library_file(client_id: str, file_path: str):
    """Return YAML as dict or text as str; None if missing/error."""
    from server.client_manager import client_manager
    if not client_id or client_id not in client_manager.client_projects:
        return None
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = resolve_inside(project_dir, file_path)
        if not target_file.exists():
            return None
        suffix = (target_file.suffix or '').lower()
        if suffix in ['.yaml', '.yml']:
            with open(target_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        else:
            with open(target_file, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
    except Exception as e:
        logger.error(f"Error reading library file for client {client_id[:8]}: {e}")
        return None


def list_client_library_files(client_id: str, directory: str = "") -> list:
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
    try:
        library_dir = Path(library_path)
        if not library_dir.exists():
            logger.warning(f"Library directory does not exist: {library_path}")
            return {"yaml_files": [], "csv_files": [], "html_files": [], "png_files": [], "total_files": 0}
        yaml_files: list[str] = []
        csv_files: list[str] = []
        html_files: list[str] = []
        png_files: list[str] = []
        for file_path in library_dir.rglob('*'):
            if file_path.is_file():
                relative_path = str(file_path.relative_to(library_dir))
                suf = file_path.suffix.lower()
                if suf == '.yaml':
                    yaml_files.append(relative_path)
                elif suf == '.csv':
                    csv_files.append(relative_path)
                elif suf == '.html':
                    html_files.append(relative_path)
                elif suf == '.png':
                    png_files.append(relative_path)
        yaml_files.sort(); csv_files.sort(); html_files.sort(); png_files.sort()
        logger.info(f"Scanned library {library_path}: {len(yaml_files)} YAML files, {len(csv_files)} CSV files")
        return {
            "yaml_files": yaml_files,
            "csv_files": csv_files,
            "html_files": html_files,
            "png_files": png_files,
            "total_files": len(yaml_files) + len(csv_files) + len(html_files) + len(png_files),
        }
    except Exception as e:
        logger.error(f"Error scanning library files in {library_path}: {e}")
        return {"yaml_files": [], "csv_files": [], "html_files": [], "png_files": [], "total_files": 0}


def scan_client_library_files(client_id: str) -> dict:
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
    from server.client_manager import client_manager
    if not client_id or client_id not in client_manager.client_projects:
        logger.warning(f"Client {client_id[:8] if client_id else 'unknown'} not found in client projects")
        return False
    try:
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        target_file = resolve_inside(project_dir, file_path)
        target_file.parent.mkdir(parents=True, exist_ok=True)
        suffix = (target_file.suffix or '').lower()
        if suffix in ['.yaml', '.yml']:
            with open(target_file, 'w', encoding='utf-8') as f:
                if isinstance(content, str):
                    f.write(content)
                else:
                    yaml.safe_dump(content if content is not None else {}, f, default_flow_style=False)
        else:
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write('' if content is None else str(content))
        try:
            rel_display = str(target_file.relative_to(project_dir))
        except Exception:
            rel_display = str(target_file)
        logger.info(f"Wrote file {rel_display} for client {client_id[:8]}")
        return True
    except Exception as e:
        logger.error(f"Error writing file for client {client_id[:8] if client_id else 'unknown'}: {e}")
        return False


def delete_client_library_file(client_id: str, file_path: str) -> bool:
    from server.client_manager import client_manager
    try:
        if not client_id or client_id not in client_manager.client_projects:
            logger.warning(f"Client {client_id[:8] if client_id else 'unknown'} not found in client projects")
            return False
        project_dir = Path(client_manager.get_client_project_dir(client_id))
        try:
            target_file = resolve_inside(project_dir, file_path)
        except ValueError as e:
            logger.error(str(e))
            return False
        if not target_file.exists():
            # attempt alt normalization
            alt_target = (project_dir / str(file_path).replace('/', '\\'))
            if not alt_target.exists():
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
