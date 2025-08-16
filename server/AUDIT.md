# Server Audit (FastAPI/Python)

## Overview
- Stack: FastAPI, Pydantic (via REST models), Python 3, file-based project data per session.
- Key areas reviewed:
  - `server/rest_api.py` (~232 LOC)
  - `server/client_manager.py` (~240 LOC)
  - `server/library_manager.py` (~430 LOC)
  - `server/event_handlers.py` (~450 LOC)

## Findings
- __Large/complex files__
  - `server/library_manager.py` centralizes many responsibilities (YAML/CSV IO, path safety, saved library lifecycle, scanning). At ~430 LOC it’s a complexity hotspot and mixes sync/async APIs.
  - `server/event_handlers.py` contains WebSocket event routing, file ops, saved-library ops, and config access; also large.
- __REST vs WebSocket divergence__
  - REST endpoints in `server/rest_api.py` and WebSocket handlers in `server/event_handlers.py` duplicate capabilities (file read/write, list, save/load libraries, temp sweep). This increases maintenance risk and inconsistency.
- __Session/project model__
  - `server/client_manager.py` provisions per-session temp project dirs under `server/temp/client_<id>` and saved libraries under `server/client_library`. Good isolation; sweeping utilities provided.
- __Path safety__
  - Many operations attempt path normalization and inside-base checks (good). Some code paths need tightening (see Bugs).
- __Synchronous long-running work__
  - `rest_api.py` `run_simulation` executes synchronously and blocks the request. For long simulations, consider background tasks or async progress via WebSocket/Server-Sent Events.

## Bugs / Defects
- __Undefined variable in delete flow__
  - File: `server/library_manager.py`. In `delete_client_library_file()` when `target_file` doesn’t exist, code references `safe_rel` (lines ~209–214) which is not defined in the function scope. This will raise `NameError` and break delete requests.
- __Duplicate except blocks (syntax/logic issue)__
  - File: `server/event_handlers.py`, `handle_delete_saved_library()`: two consecutive `except Exception ...` blocks (lines ~255–259) after a try; the second is unreachable and invalid in Python. Needs consolidation into a single except with appropriate logic.
- __Inconsistent return shapes__
  - `get_client_library_file()` returns `{}` for missing YAML and `''` for missing text; callers likely expect consistent error signaling. `event_handlers.handle_file_select` checks `None` but the function returns `{}`/`''` not `None`.
- __Mixed sync/async boundaries__
  - `library_manager.py` exposes both async (`handle_settings_update`) and sync functions; ensure FastAPI/WebSocket handlers await only async parts.

## Inconsistencies & Smells
- __Duplication between REST and WS__
  - Saved library list/load/delete and file CRUD appear in both layers with slightly different responses. Standardize core operations in a shared service module and thin REST/WS adapters.
- __Error propagation__
  - Some handlers send plain strings on error, others send structured JSON. Adopt a consistent error schema.
- __Logging__
  - Logging generally good, but error logs sometimes swallow context; include client_id, file_path, and base/abs paths consistently.

## Opportunities for Refactoring
- __Extract service layer__
  - Move core operations from `library_manager.py` into smaller focused modules:
    - `services/libraries.py` (list/read/write/delete; path safety utils)
    - `services/saved_libraries.py` (save/load/delete saved projects)
    - `services/scan.py` (recursive scanning and mime classification)
  - Keep WebSocket and REST as thin adapters that call the services and map responses.
- __Path utilities__
  - Centralize safe path join/resolve and inside-directory checks to avoid drift and bugs like the `safe_rel` issue.
- __Consistent response schemas__
  - Create Pydantic models for REST responses and mirror a similar JSON shape for WS events (`event`, `ok`, `message`, `data`).
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
- [ ] Fix `server/library_manager.py` `delete_client_library_file()` undefined `safe_rel`; ensure consistent missing-file handling and return values.
- [ ] Fix duplicate `except` blocks in `server/event_handlers.py` `handle_delete_saved_library()`; consolidate and ensure a single error path.
- [ ] Normalize `get_client_library_file()` return contract; return `None` on missing, or a typed result with `ok/data/error`.
- [ ] Extract path safety helpers (resolve, inside_base check) into a shared utility and use everywhere.
- [ ] Create a service layer for library operations; make REST/WS thin wrappers.
- [ ] Define Pydantic response models for REST and align WS event schemas.
- [ ] Consider background job for `run_simulation` with progress updates.
- [ ] Add server-side tests for REST endpoints (success + error cases) and for path traversal protections.

## Notes
- No code changes made. This document records issues and recommended refactors to improve reliability, maintainability, and consistency across interfaces.
