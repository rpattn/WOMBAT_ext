from __future__ import annotations

from typing import Any


def run_simulation(library: str = "DINWOODIE", config: str = "base_2yr.yaml") -> dict[str, Any]:
    """Run a WOMBAT simulation and return a minimal result payload.

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

    return {
        "status": "completed",
        "name": sim.config.name,
    }


