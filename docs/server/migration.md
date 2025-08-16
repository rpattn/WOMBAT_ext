# Migration Notes: WebSocket to REST and Modularization

This document outlines the key changes made to migrate the WOMBAT server to REST-only and to refactor the codebase into modular routers and services.

## Summary of Changes
- Removed WebSocket endpoints, handlers, and client-side dependencies.
- Introduced REST-only session management in `server/client_manager.py`.
- Centralized path safety logic in `server/utils/paths.py`.
- Split monolithic logic into services under `server/services/`:
  - `libraries.py`: client library file operations and scanning
  - `saved_libraries.py`: save/load/delete saved libraries
- Split routes into routers under `server/routers/` and mounted from `server/rest_api.py`.
- Kept `server/library_manager.py` as a deprecated compatibility layer to preserve imports.

## New API Structure
- Base prefix: `/api`
- See [Routers](routers.md) for the full route list.

## Backward Compatibility
- `server/library_manager.py` forwards to the new services. Existing imports will continue to work, but new code should import from `server/services/*`.

## Testing
- Existing tests were updated to remove WebSocket usage and validate REST-only behavior. Run:
  - `python -m pytest -q tests/server_tests`
  - `python -m pytest -q`

## Security
- All file operations use `resolve_inside()` to prevent path traversal.

## Next Steps
- Consider defining explicit response models for key endpoints.
- Update external docs or client code to consume the new REST routes if necessary.
