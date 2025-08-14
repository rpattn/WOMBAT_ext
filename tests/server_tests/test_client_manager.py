"""Tests for client_manager module."""

import pytest
from unittest.mock import Mock, AsyncMock
import uuid

# Add server directory to path to import modules
import sys
import os
server_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'server')
sys.path.insert(0, server_dir)

from client_manager import ClientManager


class TestClientManager:
    """Test cases for ClientManager class."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.client_manager = ClientManager()
        self.mock_websocket = Mock()
        self.mock_websocket.send_text = AsyncMock()
        self.client_id = "test-client-123"
    
    def test_init(self):
        """Test ClientManager initialization."""
        assert isinstance(self.client_manager.clients, dict)
        assert isinstance(self.client_manager.client_simulations, dict)
        assert len(self.client_manager.clients) == 0
        assert len(self.client_manager.client_simulations) == 0
    
    def test_add_client(self):
        """Test adding a client."""
        self.client_manager.add_client(self.client_id, self.mock_websocket)
        
        # Check client is added
        assert self.client_id in self.client_manager.clients
        assert self.client_manager.clients[self.client_id] == self.mock_websocket
        
        # Check simulation state is initialized
        assert self.client_id in self.client_manager.client_simulations
        sim_state = self.client_manager.client_simulations[self.client_id]
        assert sim_state["running"] is False
        assert sim_state["done_event"] is None
        assert sim_state["ticker_task"] is None
    
    def test_remove_client(self):
        """Test removing a client."""
        # Add client first
        self.client_manager.add_client(self.client_id, self.mock_websocket)
        assert len(self.client_manager.clients) == 1
        
        # Remove client
        self.client_manager.remove_client(self.client_id)
        
        # Check client is removed
        assert self.client_id not in self.client_manager.clients
        assert self.client_id not in self.client_manager.client_simulations
        assert len(self.client_manager.clients) == 0
    
    def test_remove_nonexistent_client(self):
        """Test removing a client that doesn't exist."""
        # Should not raise an error
        self.client_manager.remove_client("nonexistent-client")
        assert len(self.client_manager.clients) == 0
    
    def test_get_client_simulation_state(self):
        """Test getting client simulation state."""
        # Test with nonexistent client
        state = self.client_manager.get_client_simulation_state("nonexistent")
        assert state == {}
        
        # Test with existing client
        self.client_manager.add_client(self.client_id, self.mock_websocket)
        state = self.client_manager.get_client_simulation_state(self.client_id)
        assert isinstance(state, dict)
        assert "running" in state
        assert "done_event" in state
        assert "ticker_task" in state
    
    def test_update_client_simulation_state(self):
        """Test updating client simulation state."""
        # Add client first
        self.client_manager.add_client(self.client_id, self.mock_websocket)
        
        # Update state
        self.client_manager.update_client_simulation_state(
            self.client_id, 
            running=True, 
            custom_field="test_value"
        )
        
        # Check state is updated
        state = self.client_manager.get_client_simulation_state(self.client_id)
        assert state["running"] is True
        assert state["custom_field"] == "test_value"
    
    def test_update_nonexistent_client_simulation_state(self):
        """Test updating simulation state for nonexistent client."""
        # Should not raise an error
        self.client_manager.update_client_simulation_state(
            "nonexistent", 
            running=True
        )
    
    def test_generate_client_id(self):
        """Test client ID generation."""
        client_id = self.client_manager.generate_client_id()
        
        # Should be a valid UUID string
        assert isinstance(client_id, str)
        assert len(client_id) > 0
        
        # Should be able to parse as UUID
        uuid.UUID(client_id)  # Will raise ValueError if invalid
        
        # Should generate unique IDs
        client_id2 = self.client_manager.generate_client_id()
        assert client_id != client_id2
    
    def test_multiple_clients(self):
        """Test managing multiple clients."""
        client_ids = ["client-1", "client-2", "client-3"]
        websockets = [Mock() for _ in client_ids]
        
        # Add multiple clients
        for client_id, websocket in zip(client_ids, websockets):
            self.client_manager.add_client(client_id, websocket)
        
        assert len(self.client_manager.clients) == 3
        assert len(self.client_manager.client_simulations) == 3
        
        # Remove one client
        self.client_manager.remove_client(client_ids[1])
        assert len(self.client_manager.clients) == 2
        assert client_ids[1] not in self.client_manager.clients
        assert client_ids[0] in self.client_manager.clients
        assert client_ids[2] in self.client_manager.clients


if __name__ == "__main__":
    pytest.main([__file__])
