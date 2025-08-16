"""Deprecated compatibility layer.

This module now only forwards calls to the service implementations in
`server/services/libraries.py` and `server/services/saved_libraries.py`.

Prefer importing directly from the services modules in new code. This file
remains to avoid breaking imports during the transition.
"""

import logging
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


async def update_client_library_file(client_id: str, file_path: str, content: dict) -> bool:
    """Compatibility wrapper: delegates to services.libraries.update_client_library_file."""
    return await _svc_update_file(client_id, file_path, content)


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
