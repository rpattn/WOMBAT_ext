# Routers

Modular FastAPI routers mounted by `server/rest_api.py` under the `/api` prefix.

## session.py
- POST `/api/session` — create a session, returns `{ client_id }`.
- DELETE `/api/session/{client_id}` — end a session.

Backed by: `server/client_manager.ClientManager`.

## library.py
- GET `/api/{client_id}/config` — returns config (library `project/config/base.yaml` or simulation defaults).
- GET `/api/{client_id}/library/files` — lists YAML/CSV/HTML/PNG files.
- GET `/api/{client_id}/refresh` — combined `{ files, config, saved }`.
- GET `/api/{client_id}/library/file?path=...&raw=bool` — read file (YAML/text or raw bytes as base64).
- POST `/api/{client_id}/library/file` — add file (payload: `AddOrReplacePayload`).
- PUT `/api/{client_id}/library/file` — replace file (payload: `AddOrReplacePayload`).
- DELETE `/api/{client_id}/library/file?file_path=...` — delete file.
- POST `/api/{client_id}/library/save` — save client library (payload: `SaveLibraryPayload`).

Models: `server/models.py`.
Services: `server/services/libraries.py`, `server/services/saved_libraries.py`.

## saved.py
- GET `/api/saved` — list saved libraries.
- POST `/api/{client_id}/saved/load` — load saved library to client (payload: `LoadSavedPayload`).
- DELETE `/api/saved/{name}` — delete saved library by name.

## temp.py
- DELETE `/api/{client_id}/temp` — clear a client's temp dir.
- POST `/api/temp/sweep` — remove stale temp dirs.
- POST `/api/temp/sweep_all` — remove all temp dirs.

## simulations.py
- POST `/api/{client_id}/simulate` — run a simulation synchronously and return results + updated files list.

Notes:
- All `{client_id}` endpoints 404 if the session is unknown.
- File operations respect path safety (see Path Safety).
