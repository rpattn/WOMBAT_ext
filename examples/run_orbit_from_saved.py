#!/usr/bin/env python3
"""
Run an ORBIT simulation from a saved client library.

By default, libraries saved from the UI/API are stored under:
  server/client_library/<saved_name>

This script mirrors the server's loading logic (see `server/client_manager.py` and
`server/services/saved_libraries.py`) by allowing you to point ORBIT to that saved
library directory and run a simulation, writing a summary artifact back into the
same library under results/<TIMESTAMP>/orbit_summary.json.

Usage:
  python examples/run_orbit_from_saved.py --saved <NAME>
  python examples/run_orbit_from_saved.py --path  <PATH_TO_LIBRARY>

Optional:
  --config base.yaml

Notes:
- This requires the ORBIT API to be installed and importable (orbit_api).
- The script prints coarse progress updates if available.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Any, Optional, Callable

# Ensure the project root is on sys.path so local packages (e.g., orbit_api) can be imported
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _resolve_library_path(saved: Optional[str], direct_path: Optional[str]) -> Path:
    if direct_path:
        p = Path(direct_path).resolve()
        if not p.exists() or not p.is_dir():
            raise SystemExit(f"Library path does not exist or is not a directory: {p}")
        return p
    if not saved:
        raise SystemExit("Provide --saved <NAME> or --path <DIR> to the library")
    base = Path("server/client_library")
    p = (base / saved).resolve()
    if not p.exists() or not p.is_dir():
        raise SystemExit(f"Saved library not found: {p} (expected under server/client_library/<NAME>)")
    return p


def _progress_printer(update: dict[str, Any]) -> None:
    try:
        now = update.get("now")
        percent = update.get("percent")
        message = update.get("message") or "running"
        if percent is None:
            txt = f"now={now:.1f} | {message}"
        else:
            try:
                p = float(percent)
                txt = f"{p:6.2f}% | now={now:.1f} | {message}"
            except Exception:
                txt = f"{percent} | now={now:.1f} | {message}"
        print(txt, flush=True)
    except Exception:
        # best-effort only; avoid crashing on malformed updates
        pass


def _build_summary_payload(result_dict: dict[str, Any]) -> dict[str, Any]:
    """Return a compact summary with highlights plus the original result."""
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    highlights: dict[str, Any] = {
        "engine": "ORBIT",
        "status": result_dict.get("status"),
    }
    def pick(key: str):
        if key in result_dict:
            return result_dict.get(key)
        inner = result_dict.get("results") or {}
        return inner.get(key)
    for k in [
        "total_cost",
        "duration_days",
        "num_turbines",
        "capacity_mw",
        "lcoe",
    ]:
        v = pick(k)
        if v is not None:
            highlights[k] = v
    return {"generated_at": ts, "highlights": highlights, "result": result_dict}


def _write_summary(library_dir: Path, result_dict: dict[str, Any]) -> Path:
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out_dir = library_dir / "results" / ts
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "orbit_summary.json"
    payload = _build_summary_payload(result_dict)
    # ensure JSON-serializable
    try:
        out_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    except Exception:
        # fallback: attempt a lossy dump
        def _safe(obj):
            try:
                json.dumps(obj)
                return obj
            except Exception:
                return str(obj)
        out_path.write_text(json.dumps(payload, indent=2, default=_safe), encoding="utf-8")
    return out_path


def run_orbit_from_library(library_dir: Path, config: str = "base.yaml") -> int:
    try:
        from orbit_api.api.simulation_runner import run_simulation_with_progress
    except Exception as e:
        print(f"ERROR: Unable to import ORBIT API (orbit_api): {e}", file=sys.stderr)
        return 2

    # Post-finalize callback: persist a summary into the library results folder
    def _post_finalize_cb(result_dict: dict[str, Any]):
        try:
            out = _write_summary(library_dir, result_dict)
            print(f"Summary written to: {out}")
        except Exception as err:
            print(f"WARN: Failed to write summary artifact: {err}", file=sys.stderr)

    print(f"Running ORBIT with library: {library_dir}")
    try:
        result = run_simulation_with_progress(
            library=str(library_dir),
            config=config,
            delete_logs=False,
            progress_cb=_progress_printer,
            post_finalize_cb=_post_finalize_cb,
        )
    except Exception as e:
        print(f"ERROR: ORBIT simulation failed: {e}", file=sys.stderr)
        return 1

    # Print a brief top-level status
    status = result.get("status") if isinstance(result, dict) else None
    if status:
        print(f"Simulation status: {status}")
    else:
        print("Simulation finished.")

    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Run ORBIT from a saved client library")
    ap.add_argument("--saved", help="Name under server/client_library/<NAME>")
    ap.add_argument("--path", help="Direct path to a library directory (overrides --saved)")
    ap.add_argument("--config", default="base.yaml", help="Config filename (default: base.yaml)")
    args = ap.parse_args(argv)

    lib = _resolve_library_path(args.saved, args.path)
    return run_orbit_from_library(lib, config=args.config)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
