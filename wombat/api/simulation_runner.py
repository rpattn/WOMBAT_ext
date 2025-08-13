from __future__ import annotations

from typing import Any
from wombat.core.library import load_yaml
from pathlib import Path
import json

def get_simulation_dict(library: str = "DINWOODIE"):
    source_lib = Path("library/code_comparison/dinwoodie")

    yaml = load_yaml(source_lib / "project/config", "base_2yr.yaml")
    return json.dumps(yaml)

def run_simulation(library: str = "DINWOODIE", config: str = "base_2yr.yaml") -> dict[str, Any]:
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

    sim = Simulation.from_config(library, config)
    sim.run()

    env = sim.env
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
        },
    }

    return result


