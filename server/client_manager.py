"""WebSocket client management for WOMBAT server."""

import uuid
import shutil
import logging
from pathlib import Path
from typing import Dict
from fastapi import WebSocket

logger = logging.getLogger("uvicorn.error")


class ClientManager:
    """Manages WebSocket client connections and their simulation states."""
    
    def __init__(self):
        self.clients: Dict[str, WebSocket] = {}
        self.client_simulations: Dict[str, Dict] = {}  # Track which client is running which simulation
        self.client_projects: Dict[str, str] = {}  # Track client project directories
        self.temp_base_dir = Path("server/temp")
        # Track the last selected file per client for saving edits to the correct file
        self.client_last_selected_file: Dict[str, str] = {}
    
    def add_client(self, client_id: str, websocket: WebSocket) -> None:
        """Add a new client to the manager."""
        self.clients[client_id] = websocket
        self.client_simulations[client_id] = {
            "running": False,
            "done_event": None,
            "ticker_task": None
        }
        
        # Create per-client project directory
        project_dir = self._create_client_project(client_id)
        self.client_projects[client_id] = project_dir
        
        logger.info(f"Client {client_id} connected. Total clients: {len(self.clients)}")
        logger.info(f"Created project directory: {project_dir}")
    
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
            
            # Clean up client project directory
            if client_id in self.client_projects:
                self._cleanup_client_project(client_id)
                del self.client_projects[client_id]
            # Remove any stored state
            if client_id in self.client_last_selected_file:
                del self.client_last_selected_file[client_id]
            
            logger.info(f"Client {client_id} disconnected. Total clients: {len(self.clients)}")
    
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
    
    def get_client_project_dir(self, client_id: str) -> str:
        """Get the project directory path for a specific client."""
        return self.client_projects.get(client_id, "")

    def set_last_selected_file(self, client_id: str, file_path: str) -> None:
        """Store the last file selected by the client (relative to project dir)."""
        self.client_last_selected_file[client_id] = file_path

    def get_last_selected_file(self, client_id: str) -> str:
        """Retrieve the last file selected by the client, if any."""
        return self.client_last_selected_file.get(client_id, "")
    
    def _create_client_project(self, client_id: str) -> str:
        """Create a per-client project directory and configuration."""
        from wombat.api.simulation_setup import create_temp_config, create_temp_library
        import os
        
        # Create client-specific directory
        client_dir = self.temp_base_dir / f"client_{client_id[:8]}"
        client_dir.mkdir(parents=True, exist_ok=True)
        
        # Create temporary library and config for this client
        try:
            # Create temp library in the client directory
            temp_library = create_temp_library(client_dir, "library/code_comparison/dinwoodie_slim")
            #temp_config = create_temp_config(temp_library, "base_2yr.yaml")
            
            logger.info(f"Created temp library for client {client_id[:8]}: {temp_library}")
            return str(temp_library)
        except Exception as e:
            logger.error(f"Error creating client project for {client_id[:8]}: {e}")
            # Fallback to just the client directory
            return str(client_dir)
    
    def _cleanup_client_project(self, client_id: str) -> None:
        """Clean up the project directory for a client."""
        if client_id in self.client_projects:
            project_path = Path(self.client_projects[client_id]).parent
            if project_path.exists():
                try:
                    shutil.rmtree(project_path)
                    logger.info(f"Cleaned up project directory for client {client_id[:8]}")
                except Exception as e:
                    logger.error(f"Error cleaning up project for client {client_id[:8]}: {e}")


# Global client manager instance
client_manager = ClientManager()
