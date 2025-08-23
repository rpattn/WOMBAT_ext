from __future__ import annotations

from typing import Any, Callable, Optional
from wombat.core.library import load_yaml
from pathlib import Path
import json
import time
from wombat_api.api.simulation_results import create_detailed_gantt_chart_plotly

def get_simulation_dict(library: str = "DINWOODIE"):
    source_lib = Path("library/code_comparison/dinwoodie")

    yaml = load_yaml(source_lib / "project/config", "base.yaml")
    return json.dumps(yaml)

def _finalize_results(sim, env, library: str, create_metrics: bool, delete_logs: bool, save_metrics_inputs: bool, post_finalize_cb: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    from wombat_api.api.simulation_results import extract_maintenance_requests, maintenance_summary_statistics, power_production_summary_statistics

    if create_metrics:
        sim.initialize_metrics()
    if save_metrics_inputs:
        sim.save_metrics_inputs()

    # Extract maintenance data
    maintenance_data = extract_maintenance_requests(sim)

    # get summary statistics
    maintenance_stats = maintenance_summary_statistics(maintenance_data)

    # get power production summary statistics
    power_production_stats = power_production_summary_statistics(env)

    # Attempt to create a detailed Gantt chart in the project's results directory
    import time as _time
    gantt_rel = None
    try:
        if library and Path(library).exists():
            timestamp = _time.strftime("%Y-%m-%d_%H-%M")
            gantt_html = create_detailed_gantt_chart_plotly(sim, Path(library), filename=f"{timestamp}_gantt_detailed.html")
            if gantt_html:
                # Provide relative path if under project library dir
                try:
                    gantt_rel = str(Path(gantt_html).resolve().relative_to(Path(library).resolve()))
                except Exception:
                    gantt_rel = gantt_html
    except Exception:
        gantt_rel = None

    result: dict[str, Any] = {
        "status": "completed",
        "name": sim.config.name,
        "library": str(sim.library_path),
        "results": {
            "events": str(env.events_log_fname),
            "operations": str(env.operations_log_fname),
            "power_potential": str(env.power_potential_fname),
            "power_production": str(env.power_production_fname),
            "metrics_input": str(env.metrics_input_fname),
            **({"gantt": gantt_rel} if gantt_rel else {}),
        },
        "stats": {
            "maintenance": maintenance_stats,
            "power_production": power_production_stats
        }
    }
    # Allow caller to copy artifacts before cleanup
    try:
        if post_finalize_cb is not None:
            post_finalize_cb(result)
    except Exception:
        # best-effort; copying issues shouldn't crash finalize
        pass
    # Perform WOMBAT log cleanup after copying
    if delete_logs:
        try:
            sim.env.cleanup_log_files()
        except Exception:
            pass
    return result


def run_simulation_with_progress(
    library: str = "DINWOODIE",
    config: str = "base.yaml",
    *,
    create_metrics: bool = True,
    delete_logs: bool = False,
    save_metrics_inputs: bool = True,
    progress_cb: Optional[Callable[[dict[str, Any]], None]] = None,
    progress_interval_steps: int = 1000,
    post_finalize_cb: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """Run a WOMBAT simulation, optionally reporting progress via a callback.

    The callback, if provided, receives a dict like:
        {"now": float, "percent": Optional[float], "message": str}
    """
    from wombat import Simulation

    sim = Simulation.from_config(library, config)

    # Try to estimate a total duration from configuration (best-effort)
    total_hours: Optional[float] = None
    try:
        start_year = getattr(sim.config, "start_year", None)
        end_year = getattr(sim.config, "end_year", None)
        if start_year is not None and end_year is not None and end_year >= start_year:
            # Approximate to 365 days per year to avoid calendar complexity
            total_hours = (end_year - start_year + 1) * 365.0 * 24.0
    except Exception:
        total_hours = None

    # If no callback, just run to completion
    if progress_cb is None:
        sim.env.run()
        return _finalize_results(sim, sim.env, library, create_metrics, delete_logs, save_metrics_inputs, post_finalize_cb)

    # Step the SimPy environment to provide progress updates
    steps = 0
    env = sim.env
    # Detect potential stalls where env.peek() never advances (e.g., zero-time loops)
    last_peek = None
    stagnant_steps = 0
    STAGNANT_STEP_LIMIT = 20000  # safety guard; adjust as needed
    try:
        # Emit an initial progress update
        try:
            pct = (env.now / total_hours * 100.0) if (total_hours and total_hours > 0) else None
        except Exception:
            pct = None
        progress_cb({"now": float(getattr(env, "now", 0.0) or 0.0), "percent": pct, "message": "started"})

        while True:
            # No more scheduled events
            cur_peek = env.peek()
            if cur_peek == float("inf"):
                break
            # Stall detection: if the next event time never changes across many steps,
            # bail out to avoid infinite loop on zero-delay rescheduling.
            if last_peek is None or cur_peek != last_peek:
                last_peek = cur_peek
                stagnant_steps = 0
            else:
                stagnant_steps += 1
                if stagnant_steps >= STAGNANT_STEP_LIMIT:
                    try:
                        print(f"[wombat] Detected stall at env.peek()={cur_peek}; breaking after {stagnant_steps} steps without time advance")
                    except Exception:
                        pass
                    break

            env.step()
            steps += 1

            if steps % progress_interval_steps == 0:
                try:
                    pct = (env.now / total_hours * 100.0) if (total_hours and total_hours > 0) else None
                except Exception:
                    pct = None
                progress_cb({
                    "now": float(getattr(env, "now", 0.0) or 0.0),
                    "percent": pct,
                    "message": "running"
                })
    finally:
        # Emit a final progress update before finalization
        try:
            progress_cb({"now": float(getattr(env, "now", 0.0) or 0.0), "percent": 100.0, "message": "finalizing"})
        except Exception:
            pass

    return _finalize_results(sim, env, library, create_metrics, delete_logs, save_metrics_inputs, post_finalize_cb)


def run_simulation(library: str = "DINWOODIE", config: str = "base.yaml", create_metrics: bool = True, delete_logs: bool = False, save_metrics_inputs: bool = True, post_finalize_cb: Optional[Callable[[dict[str, Any]], None]] = None) -> dict[str, Any]:
    """Run a WOMBAT simulation and return result info, including output file paths.

    Parameters
    ----------
    library : str
        A key understood by WOMBAT's library mapper (e.g., "DINWOODIE", "IEA_26", "COREWIND")
        or a full library path.
    config : str
        The configuration YAML filename inside `<library>/project/config/>`.
    """
    return run_simulation_with_progress(
        library=library,
        config=config,
        create_metrics=create_metrics,
        delete_logs=delete_logs,
        save_metrics_inputs=save_metrics_inputs,
        progress_cb=None,
        post_finalize_cb=post_finalize_cb,
    )


