# Path Safety

WOMBAT server emphasizes safe file operations to prevent path traversal attacks.

## Helpers

`server/utils/paths.py` exposes:
- `normalize_rel(path_like: str) -> str`
  - Normalizes separators to `/` and strips leading `/` to ensure a relative path.
- `resolve_inside(base_dir: Path, rel_path: str) -> Path`
  - Resolves `rel_path` under `base_dir` and verifies the result stays inside `base_dir` (case-insensitive on Windows). Raises `ValueError` if it escapes.

## Usage
- All file CRUD in `server/services/libraries.py` uses `resolve_inside()` before touching the filesystem.
- Routers that expose raw file reads validate that resolved paths start with the client's project directory.

## Guidelines
- Treat client-supplied paths as untrusted input; always normalize and resolve.
- Avoid joining with `..` segments directly; use `resolve_inside()`.
- Avoid returning absolute filesystem paths to clients; prefer relative paths.
