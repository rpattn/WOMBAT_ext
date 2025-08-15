from __future__ import annotations

from typing import Any
from wombat.core.library import load_yaml
from pathlib import Path
import json
import time
from wombat.api.simulation_results import create_detailed_gantt_chart_plotly

def get_simulation_dict(library: str = "DINWOODIE"):
    source_lib = Path("library/code_comparison/dinwoodie")

    yaml = load_yaml(source_lib / "project/config", "base.yaml")
    return json.dumps(yaml)

def run_simulation(library: str = "DINWOODIE", config: str = "base.yaml") -> dict[str, Any]:
    """Run a WOMBAT simulation and return result info, including output file paths.

    Parameters
    ----------
    library : str
        A key understood by WOMBAT's library mapper (e.g., "DINWOODIE", "IEA_26", "COREWIND")
        or a full library path.
    config : str
        The configuration YAML filename inside `<library>/project/config/>`.
    """
    from wombat import Simulation
    from wombat.api.simulation_results import extract_maintenance_requests, maintenance_summary_statistics, power_production_summary_statistics

    sim = Simulation.from_config(library, config)   
    sim.run()

    env = sim.env

    # Extract maintenance data
    maintenance_data = extract_maintenance_requests(sim)
    
    # get summary statistics
    maintenance_stats = maintenance_summary_statistics(maintenance_data)

    # get power production summary statistics
    power_production_stats = power_production_summary_statistics(env)

    # Attempt to create a detailed Gantt chart in the project's results directory
    gantt_rel = None
    try:
        if library and Path(library).exists():
            timestamp = time.strftime("%Y-%m-%d_%H-%M")
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

    return result


