# Services

Service modules implement the business logic used by routers.

## libraries.py
Responsibilities:
- Read, add/replace, and delete client library files.
- Scan a library path or client library for file inventories.
- YAML-aware read/write; text passthrough for non-YAML.
- Path traversal protection via `server/utils/paths.py`.

Key functions:
- `get_client_library_file(client_id, file_path)` → dict | str | None
- `add_client_library_file(client_id, file_path, content)` → bool
- `delete_client_library_file(client_id, file_path)` → bool
- `update_client_library_file(client_id, file_path, content)` → bool (async)
- `scan_library_files(library_path)` → dict
- `scan_client_library_files(client_id)` → dict

## saved_libraries.py
Responsibilities:
- Save a client's temp library to a named folder.
- Load a named saved library into a client's temp library.
- Delete a saved library.

Key functions:
- `save_client_library(client_id, project_name)` → (ok: bool, msg: str)
- `load_saved_library(client_id, saved_name)` → (ok: bool, msg: str)
- `delete_saved_library(saved_name)` → (ok: bool, msg: str)

## Utilities
- `server/utils/paths.py` provides `normalize_rel()` and `resolve_inside()` to normalize relative paths and ensure resolved paths remain inside a base directory.
