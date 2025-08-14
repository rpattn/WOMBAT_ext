"""Intermediate script to allow running of different simulations
- Currently only implements WOMBAT simulations"""

from typing import Any
from pathlib import Path


def get_simulation(library: str = "DINWOODIE"):
    from wombat.api.simulation_runner import get_simulation_dict
    return get_simulation_dict(library)

def run_wombat_simulation(library: str = "DINWOODIE", config: str = "base_2yr.yaml") -> dict[str, Any]:
    # Local import to keep example self-contained and to avoid import cycles.
    from wombat.api.simulation_runner import run_simulation
    
    # If a specific library path is provided (from client manager), use it directly
    if library != "DINWOODIE" and Path(library).exists():
        # Use the client-specific library path
        library_path = str(library)
        print(f"Running simulation with client library: {library_path}")
    else:
        # Fallback to default DINWOODIE library
        library_path = library
        print(f"Running simulation with default library: {library_path}")
    
    try:
        # Run simulation with the specified library path
        result = run_simulation(library=library_path, config=config)
        return result
    except Exception as e:
        print(f"Simulation error: {e}")
        return {"error": str(e), "status": "failed"}