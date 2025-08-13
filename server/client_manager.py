"""WebSocket client management for WOMBAT server."""

import uuid
from typing import Dict
from fastapi import WebSocket


class ClientManager:
    """Manages WebSocket client connections and their simulation states."""
    
    def __init__(self):
        self.clients: Dict[str, WebSocket] = {}
        self.client_simulations: Dict[str, Dict] = {}  # Track which client is running which simulation
    
    def add_client(self, client_id: str, websocket: WebSocket) -> None:
        """Add a new client to the manager."""
        self.clients[client_id] = websocket
        self.client_simulations[client_id] = {
            "running": False,
            "done_event": None,
            "ticker_task": None
        }
        print(f"Client {client_id} connected. Total clients: {len(self.clients)}")
    
    def remove_client(self, client_id: str) -> None:
        """Remove a client and clean up any running simulations."""
        if client_id in self.clients:
            # Clean up any running simulation for this client
            sim_state = self.client_simulations.get(client_id, {})
            if sim_state.get("done_event"):
                sim_state["done_event"].set()
            if sim_state.get("ticker_task"):
                sim_state["ticker_task"].cancel()
            
            del self.clients[client_id]
            del self.client_simulations[client_id]
            print(f"Client {client_id} disconnected. Total clients: {len(self.clients)}")
    
    def get_client_simulation_state(self, client_id: str) -> Dict:
        """Get the simulation state for a specific client."""
        return self.client_simulations.get(client_id, {})
    
    def update_client_simulation_state(self, client_id: str, **kwargs) -> None:
        """Update the simulation state for a specific client."""
        if client_id in self.client_simulations:
            self.client_simulations[client_id].update(kwargs)
    
    def generate_client_id(self) -> str:
        """Generate a unique client ID."""
        return str(uuid.uuid4())


# Global client manager instance
client_manager = ClientManager()
