"""Tests for simulation_manager module."""

import pytest
import asyncio
import threading
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import sys
import os

# Add server directory to path to import modules
server_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'server')
sys.path.insert(0, server_dir)

from simulation_manager import handle_run_simulation


class TestSimulationManager:
    """Test cases for simulation manager functions."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.mock_websocket = Mock()
        self.mock_websocket.send_text = AsyncMock()
        self.client_id = "test-client-123"
    
    @pytest.mark.asyncio
    @patch('simulation_manager.client_manager')
    async def test_handle_run_simulation_already_running(self, mock_client_manager):
        """Test run simulation when simulation is already running."""
        # Mock client manager to return running state
        mock_client_manager.get_client_simulation_state.return_value = {
            "running": True,
            "done_event": None,
            "ticker_task": None
        }
        
        result = await handle_run_simulation(self.mock_websocket, self.client_id)
        
        assert result is True
        self.mock_websocket.send_text.assert_called_once_with("simulation already running")
        mock_client_manager.update_client_simulation_state.assert_not_called()
    
    @pytest.mark.asyncio
    @patch('simulation_manager.client_manager')
    @patch('simulation_manager.threading.Thread')
    @patch('simulation_manager.run_wombat_simulation')
    async def test_handle_run_simulation_success(self, mock_run_sim, mock_thread, mock_client_manager):
        """Test successful simulation run."""
        # Mock client manager to return not running state
        mock_client_manager.get_client_simulation_state.return_value = {
            "running": False,
            "done_event": None,
            "ticker_task": None
        }
        
        # Mock simulation result
        mock_run_sim.return_value = "simulation_result.json"
        
        # Mock thread
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        result = await handle_run_simulation(self.mock_websocket, self.client_id)
        
        assert result is True
        
        # Check initial message was sent
        assert self.mock_websocket.send_text.call_count >= 1
        self.mock_websocket.send_text.assert_any_call("starting simulation...")
        
        # Check client state was updated to running
        mock_client_manager.update_client_simulation_state.assert_called()
        update_calls = mock_client_manager.update_client_simulation_state.call_args_list
        
        # Find the call that sets running=True
        running_call = None
        for call in update_calls:
            args, kwargs = call
            if kwargs.get("running") is True:
                running_call = call
                break
        
        assert running_call is not None
        assert running_call[0][0] == self.client_id  # First positional arg should be client_id
        
        # Check thread was started
        mock_thread_instance.start.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('simulation_manager.client_manager')
    async def test_handle_run_simulation_client_state_management(self, mock_client_manager):
        """Test that client state is properly managed during simulation."""
        # Mock client manager
        mock_client_manager.get_client_simulation_state.return_value = {
            "running": False,
            "done_event": None,
            "ticker_task": None
        }
        
        with patch('simulation_manager.threading.Thread') as mock_thread:
            mock_thread_instance = Mock()
            mock_thread.return_value = mock_thread_instance
            
            result = await handle_run_simulation(self.mock_websocket, self.client_id)
            
            assert result is True
            
            # Verify client state was updated with simulation details
            mock_client_manager.update_client_simulation_state.assert_called()
            
            # Get the call arguments
            call_args = mock_client_manager.update_client_simulation_state.call_args
            args, kwargs = call_args
            
            # Check that client_id was passed
            assert args[0] == self.client_id
            
            # Check that running was set to True
            assert kwargs.get("running") is True
            
            # Check that done_event and ticker_task were set
            assert "done_event" in kwargs
            assert "ticker_task" in kwargs
            assert isinstance(kwargs["done_event"], threading.Event)
    
    @pytest.mark.asyncio
    @patch('simulation_manager.client_manager')
    @patch('simulation_manager.asyncio.get_running_loop')
    async def test_handle_run_simulation_ticker_task_creation(self, mock_get_loop, mock_client_manager):
        """Test that ticker task is properly created."""
        # Mock client manager
        mock_client_manager.get_client_simulation_state.return_value = {
            "running": False,
            "done_event": None,
            "ticker_task": None
        }
        
        # Mock event loop
        mock_loop = Mock()
        mock_task = Mock()
        mock_loop.create_task.return_value = mock_task
        mock_get_loop.return_value = mock_loop
        
        with patch('simulation_manager.threading.Thread') as mock_thread:
            mock_thread_instance = Mock()
            mock_thread.return_value = mock_thread_instance
            
            result = await handle_run_simulation(self.mock_websocket, self.client_id)
            
            assert result is True
            
            # Check that create_task was called
            mock_loop.create_task.assert_called_once()
            
            # Check that the task was stored in client state
            call_args = mock_client_manager.update_client_simulation_state.call_args
            args, kwargs = call_args
            assert kwargs.get("ticker_task") == mock_task


if __name__ == "__main__":
    pytest.main([__file__])
