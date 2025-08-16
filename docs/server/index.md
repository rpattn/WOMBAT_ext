# WOMBAT Server Architecture

This section documents the REST-only WOMBAT server. It outlines the architecture, routing modules, services, shared utilities, and design decisions after the refactor away from WebSockets.

- Components:
  - `server/rest_api.py`: Aggregates and mounts modular routers under `/api`.
  - `server/routers/`: Feature-grouped FastAPI routers.
  - `server/services/`: Business logic (file/library ops, saved libraries).
  - `server/utils/`: Shared utilities (e.g., path safety helpers).
  - `server/library_manager.py`: Deprecated thin-compat layer forwarding to services.
  - `server/client_manager.py`: REST-only client session and temp-dir management.

- Key design choices:
  - REST-only communication.
  - Strong path traversal protection using normalized and resolved paths.
  - Separation of concerns between routing and services.
  - Backward-compat via thin `library_manager` wrappers.

## Directory Overview

- `server/rest_api.py` — includes routers under `/api`.
- `server/routers/`
  - `session.py` — create/end sessions
  - `library.py` — library CRUD, listing, config, save
  - `saved.py` — list/load/delete saved libraries
  - `temp.py` — sweep and clear temp
  - `simulations.py` — run simulations
- `server/services/`
  - `libraries.py` — file CRUD, scans
  - `saved_libraries.py` — save/load/delete saved libraries
- `server/utils/`
  - `paths.py` — `normalize_rel()`, `resolve_inside()`

See the dedicated pages for details:

- [Routers](routers.md)
- [Services](services.md)
- [Path Safety](path_safety.md)
- [Migration Notes](migration.md)
