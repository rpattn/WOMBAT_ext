"""Path utility helpers for WOMBAT server."""
from __future__ import annotations

from pathlib import Path
import os


def normalize_rel(path_like: str) -> str:
    """Normalize a relative path string to forward-slash form without leading separators."""
    s = str(path_like).replace("\\", "/").lstrip("/")
    return s


def resolve_inside(base_dir: Path, rel_path: str) -> Path:
    """Resolve rel_path under base_dir and ensure it stays inside base_dir.

    Raises ValueError if the resolved path escapes the base directory.
    """
    base = Path(base_dir).resolve()
    target = (base / normalize_rel(rel_path)).resolve()
    base_nc = os.path.normcase(str(base))
    target_nc = os.path.normcase(str(target))
    if not (target_nc == base_nc or target_nc.startswith(base_nc + os.sep)):
        raise ValueError(f"Path outside base: {target} (base={base})")
    return target
