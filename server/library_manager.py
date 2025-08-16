"""Library management for WOMBAT server - handles client-specific library modifications."""

import yaml
import logging
from pathlib import Path
import os
import shutil
from typing import Tuple

logger = logging.getLogger("uvicorn.error")

# Thin compatibility layer: delegate to services
from server.services.libraries import (
    update_client_library_file as _svc_update_file,
    get_client_library_file as _svc_get_file,
    list_client_library_files as _svc_list_files,
    scan_library_files as _svc_scan_library,
    scan_client_library_files as _svc_scan_client_library,
    add_client_library_file as _svc_add_file,
    delete_client_library_file as _svc_delete_file,
)
from server.services.saved_libraries import (
    save_client_library as _svc_save_library,
    delete_saved_library as _svc_delete_saved,
    load_saved_library as _svc_load_saved,
)


# WebSocket-based settings update handler removed as part of REST-only migration


# ---- Path safety helpers ----
def _normalize_rel(path_like: str) -> str:
    """Normalize a relative path string to forward-slash form without leading separators."""
    s = str(path_like).replace('\\\\', '/').lstrip('/')
    return s


def _resolve_inside(base_dir: Path, rel_path: str) -> Path:
    """Resolve rel_path under base_dir and ensure it stays inside base_dir.

    Raises ValueError if the resolved path escapes the base directory.
    """
    base = Path(base_dir).resolve()
    target = (base / _normalize_rel(rel_path)).resolve()
    base_nc = os.path.normcase(str(base))
    target_nc = os.path.normcase(str(target))
    if not (target_nc == base_nc or target_nc.startswith(base_nc + os.sep)):
        raise ValueError(f"Path outside base: {target} (base={base})")
    return target


async def update_client_library_file(client_id: str, file_path: str, content: dict) -> bool:
    """Compatibility wrapper: delegates to services.libraries.update_client_library_file."""
    return await _svc_update_file(client_id, file_path, content)


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
    """Compatibility wrapper: delegates to services.saved_libraries.save_client_library."""
    return _svc_save_library(client_id, project_name)


def delete_saved_library(saved_name: str) -> Tuple[bool, str]:
    """Compatibility wrapper: delegates to services.saved_libraries.delete_saved_library."""
    return _svc_delete_saved(saved_name)

def load_saved_library(client_id: str, saved_name: str) -> Tuple[bool, str]:
    """Compatibility wrapper: delegates to services.saved_libraries.load_saved_library."""
    return _svc_load_saved(client_id, saved_name)


def delete_client_library_file(client_id: str, file_path: str) -> bool:
    """Compatibility wrapper: delegates to services.libraries.delete_client_library_file."""
    return _svc_delete_file(client_id, file_path)


def get_client_library_file(client_id: str, file_path: str):
    """Compatibility wrapper: delegates to services.libraries.get_client_library_file."""
    return _svc_get_file(client_id, file_path)


def list_client_library_files(client_id: str, directory: str = "") -> list:
    """Compatibility wrapper: delegates to services.libraries.list_client_library_files."""
    return _svc_list_files(client_id, directory)


def scan_library_files(library_path: str) -> dict:
    """Compatibility wrapper: delegates to services.libraries.scan_library_files."""
    return _svc_scan_library(library_path)


def scan_client_library_files(client_id: str) -> dict:
    """Compatibility wrapper: delegates to services.libraries.scan_client_library_files."""
    return _svc_scan_client_library(client_id)


def add_client_library_file(client_id: str, file_path: str, content=None) -> bool:
    """Compatibility wrapper: delegates to services.libraries.add_client_library_file."""
    return _svc_add_file(client_id, file_path, content)
