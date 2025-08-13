"""Intermediate script to allow running of different simulations
- Currently only implements WOMBAT simulations"""

from typing import Any


def get_simulation(library: str = "DINWOODIE"):
    from wombat.api.simulation_runner import get_simulation_dict
    return get_simulation_dict(library)

def run_wombat_simulation(library: str = "DINWOODIE", config: str = "base_2yr.yaml") -> dict[str, Any]:
    # Local import to keep example self-contained and to avoid import cycles.
    from wombat.api.simulation_setup import create_temp_config, create_temp_library
    from wombat.api.simulation_runner import run_simulation

    # Create temporary library and config
    temp_library = create_temp_library()
    temp_config = create_temp_config(temp_library, config)
    
    try:
        # Run simulation with temp library path
        result = run_simulation(library=str(temp_library), config=config)
        return result
    finally:
        # Clean up temp directory (optional - you might want to keep results)
        # shutil.rmtree(temp_library)
        pass