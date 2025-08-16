"""Tests for client_manager module (REST-only)."""

import pytest
import uuid

# Add server directory to path to import modules
import sys
import os
server_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'server')
sys.path.insert(0, server_dir)

from client_manager import ClientManager


class TestClientManager:
    """Test cases for ClientManager class (REST-only)."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.client_manager = ClientManager()
    
    def test_init(self):
        """Test ClientManager initialization."""
        assert isinstance(self.client_manager.client_simulations, dict)
        assert isinstance(self.client_manager.client_projects, dict)
        assert len(self.client_manager.client_simulations) == 0
        assert len(self.client_manager.client_projects) == 0
    
    def test_create_session(self):
        """Test creating a REST session initializes state and project dir."""
        client_id = self.client_manager.create_session()
        assert client_id in self.client_manager.client_simulations
        assert client_id in self.client_manager.client_projects
        sim_state = self.client_manager.client_simulations[client_id]
        assert sim_state["running"] is False
        assert sim_state["done_event"] is None
        assert sim_state["ticker_task"] is None
    
    def test_end_session(self):
        """Test ending a session cleans up state and project mapping."""
        client_id = self.client_manager.create_session()
        assert client_id in self.client_manager.client_projects
        self.client_manager.end_session(client_id)
        assert client_id not in self.client_manager.client_projects
        assert client_id not in self.client_manager.client_simulations
    
    def test_end_nonexistent_session(self):
        """Ending a nonexistent session should not raise."""
        self.client_manager.end_session("nonexistent-client")
        assert len(self.client_manager.client_projects) == 0
        assert len(self.client_manager.client_simulations) == 0
    
    def test_get_client_simulation_state(self):
        """Test getting client simulation state."""
        # Nonexistent client
        state = self.client_manager.get_client_simulation_state("nonexistent")
        assert state == {}
        
        # Existing client
        client_id = self.client_manager.create_session()
        state = self.client_manager.get_client_simulation_state(client_id)
        assert isinstance(state, dict)
        assert "running" in state
        assert "done_event" in state
        assert "ticker_task" in state
    
    def test_update_client_simulation_state(self):
        """Test updating client simulation state for an existing session."""
        client_id = self.client_manager.create_session()
        self.client_manager.update_client_simulation_state(
            client_id,
            running=True,
            custom_field="test_value",
        )
        state = self.client_manager.get_client_simulation_state(client_id)
        assert state["running"] is True
        assert state["custom_field"] == "test_value"
    
    def test_update_nonexistent_client_simulation_state(self):
        """Updating simulation state for nonexistent client should not raise."""
        self.client_manager.update_client_simulation_state("nonexistent", running=True)
    
    def test_generate_client_id(self):
        """Test client ID generation."""
        client_id = self.client_manager.generate_client_id()
        assert isinstance(client_id, str)
        assert len(client_id) > 0
        uuid.UUID(client_id)
        client_id2 = self.client_manager.generate_client_id()
        assert client_id != client_id2
    
    def test_multiple_sessions(self):
        """Test managing multiple REST sessions."""
        client_ids = [self.client_manager.create_session() for _ in range(3)]
        assert len(self.client_manager.client_projects) == 3
        assert len(self.client_manager.client_simulations) == 3
        # End one session
        self.client_manager.end_session(client_ids[1])
        assert len(self.client_manager.client_projects) == 2
        assert len(self.client_manager.client_simulations) == 2


if __name__ == "__main__":
    pytest.main([__file__])
