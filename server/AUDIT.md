# Server Audit (FastAPI/Python)

## Overview
- Stack: FastAPI, Pydantic, Python 3, file-based project data per session.
- Current structure (post-refactor):
  - `server/rest_api.py` — mounts modular routers under `/api`.
  - `server/routers/` — `session.py`, `library.py`, `saved.py`, `temp.py`, `simulations.py`.
  - `server/services/` — `libraries.py`, `saved_libraries.py`.
  - `server/utils/paths.py` — shared path helpers.
  - `server/library_manager.py` — deprecated thin compatibility layer delegating to services.
  - `server/client_manager.py` — session and temp-dir management.
  - `server/event_handlers.py` — legacy WS handlers (may become deprecated if REST-only).

## Findings
- __Modularization achieved__
  - Routing split into focused modules under `server/routers/` and included from `server/rest_api.py`.
  - Business logic extracted to `server/services/` with clear boundaries.
- __Session/project model__
  - `server/client_manager.py` provisions per-session temp project dirs under `server/temp/client_<id>` and saved libraries under `server/client_library`. Good isolation; sweeping utilities provided.
- __Path safety__
  - Centralized in `server/utils/paths.py` and used by services; raw reads validate resolved paths.
- __Synchronous long-running work__
  - `/{client_id}/simulate` is synchronous; consider BackgroundTasks or async/polling.

## Bugs / Defects
- __RESOLVED: undefined variable in delete flow__
  - Previous: `server/library_manager.py` referenced `safe_rel` in `delete_client_library_file()`.
  - Now: Deletion is delegated to `server/services/libraries.py::delete_client_library_file()` with consistent handling and path safety.
- __Duplicate except blocks (syntax/logic issue)__
  - File: `server/event_handlers.py`, `handle_delete_saved_library()` likely has duplicate excepts. Consolidate into one.
- __RESOLVED: inconsistent return shapes__
  - `get_client_library_file()` now returns `None` on missing; YAML returns dict, others return str.

## Inconsistencies & Smells
- __Duplication between REST and WS__
  - Saved library list/load/delete and file CRUD appear in both layers with slightly different responses. Standardize core operations in a shared service module and thin REST/WS adapters.
- __Error propagation__
  - Some handlers send plain strings on error, others send structured JSON. Adopt a consistent error schema.
- __Logging__
  - Logging generally good, but error logs sometimes swallow context; include client_id, file_path, and base/abs paths consistently.

## Opportunities for Refactoring
- __DONE: Extract service layer__
  - Implemented `server/services/libraries.py` and `server/services/saved_libraries.py`.
- __DONE: Path utilities__
  - Implemented `server/utils/paths.py`; used throughout services and raw reads.
- __Response schemas__
  - Request models centralized in `server/models.py`. Response models still ad-hoc; consider adding Pydantic response models for consistency.
- __Background execution__
  - For `run_simulation`, consider FastAPI BackgroundTasks or a task queue; emit progress via WS or polling endpoints.

## Security Considerations
- __Path traversal__
  - Good checks in places (`startswith(base + os.sep)`), but ensure all file operations consistently normalize and validate paths.
- __Temp sweeping__
  - `ClientManager.sweep_*` functions operate within `server/temp`. Ensure no external paths are removed; they currently gate by prefix, which is good.

## Testing
- __Server tests coverage__
  - Add REST tests for: session lifecycle, file CRUD, saved library save/load/delete, scanning, and simulation run (can be mocked).
  - Add WS tests (if WS retained) for key events and error flows.

## Potential Legacy/Dead Code
- If moving toward REST-only, `event_handlers.py` may become legacy. Conversely, if WS is primary, consider trimming REST or ensuring parity via shared services.

## TODOs (Incremental)
- [x] Extract path safety helpers into `server/utils/paths.py` and use in services.
- [x] Create a service layer for library operations; make REST/WS thin wrappers.
- [x] Normalize `get_client_library_file()` return contract to `None` on missing.
- [x] Modularize REST endpoints into routers under `server/routers/` and include from `rest_api.py`.
- [ ] Fix duplicate `except` blocks in `server/event_handlers.py` `handle_delete_saved_library()`.
- [ ] Define Pydantic response models for REST and align WS event schemas.
- [ ] Consider background job for `run_simulation` with progress updates.
- [ ] Add server-side tests for REST endpoints (success + error cases) and for path traversal protections.

## Notes
- No code changes made. This document records issues and recommended refactors to improve reliability, maintainability, and consistency across interfaces.
