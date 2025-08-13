"""Tests for event_handlers module."""

import pytest
import json
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add server directory to path to import modules
server_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'server')
sys.path.insert(0, server_dir)

from event_handlers import (
    handle_settings_update,
    handle_json_event,
    handle_get_config,
    handle_clear_temp
)


class TestEventHandlers:
    """Test cases for event handler functions."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.mock_websocket = Mock()
        self.mock_websocket.send_text = AsyncMock()
    
    @pytest.mark.asyncio
    async def test_handle_settings_update(self):
        """Test settings update handler."""
        test_data = {
            "event": "settings_update",
            "data": {
                "name": "test_config",
                "library": "TEST_LIB",
                "project_capacity": 100
            }
        }
        
        await handle_settings_update(self.mock_websocket, test_data)
        
        # Check that confirmation was sent
        self.mock_websocket.send_text.assert_called_once_with("Settings received successfully")
    
    @pytest.mark.asyncio
    async def test_handle_json_event_settings_update(self):
        """Test JSON event handler with settings_update event."""
        json_data = {
            "event": "settings_update",
            "data": {"name": "test"}
        }
        json_string = json.dumps(json_data)
        
        result = await handle_json_event(self.mock_websocket, json_string)
        
        assert result is True
        self.mock_websocket.send_text.assert_called_once_with("Settings received successfully")
    
    @pytest.mark.asyncio
    async def test_handle_json_event_unknown_event(self):
        """Test JSON event handler with unknown event type."""
        json_data = {
            "event": "unknown_event",
            "data": {"test": "data"}
        }
        json_string = json.dumps(json_data)
        
        result = await handle_json_event(self.mock_websocket, json_string)
        
        assert result is True
        self.mock_websocket.send_text.assert_called_once_with("Unknown event: unknown_event")
    
    @pytest.mark.asyncio
    async def test_handle_json_event_invalid_json(self):
        """Test JSON event handler with invalid JSON."""
        invalid_json = "not valid json"
        
        result = await handle_json_event(self.mock_websocket, invalid_json)
        
        assert result is False
        self.mock_websocket.send_text.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_handle_json_event_no_event_field(self):
        """Test JSON event handler with JSON that has no event field."""
        json_data = {"data": {"test": "value"}}
        json_string = json.dumps(json_data)
        
        result = await handle_json_event(self.mock_websocket, json_string)
        
        assert result is False
        self.mock_websocket.send_text.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_handle_json_event_non_dict_json(self):
        """Test JSON event handler with JSON that's not a dictionary."""
        json_string = json.dumps(["array", "data"])
        
        result = await handle_json_event(self.mock_websocket, json_string)
        
        assert result is False
        self.mock_websocket.send_text.assert_not_called()
    
    @pytest.mark.asyncio
    @patch('event_handlers.get_simulation')
    async def test_handle_get_config(self, mock_get_simulation):
        """Test get config handler."""
        mock_config = '{"name": "test_config", "library": "TEST"}'
        mock_get_simulation.return_value = mock_config
        
        await handle_get_config(self.mock_websocket)
        
        mock_get_simulation.assert_called_once()
        self.mock_websocket.send_text.assert_called_once_with(mock_config)
    
    @pytest.mark.asyncio
    @patch('os.listdir')
    @patch('os.path.join')
    @patch('os.path.isdir')
    @patch('shutil.rmtree')
    @patch('pathlib.Path')
    async def test_handle_clear_temp(self, mock_path, mock_rmtree, mock_isdir, mock_join, mock_listdir):
        """Test clear temp handler."""
        # Mock directory structure
        mock_listdir.return_value = ["folder1", "folder2", "file.txt"]
        mock_join.side_effect = lambda base, name: f"{base}/{name}"
        mock_isdir.side_effect = lambda path: "folder" in path
        
        # Mock Path to return a string representation
        mock_path_instance = mock_path.return_value
        mock_path_instance.__str__ = lambda self: "server/temp"
        
        await handle_clear_temp(self.mock_websocket)
        
        # Check that directories were processed
        # os.listdir is called twice: once for print, once for loop
        assert mock_listdir.call_count == 2
        # Check that rmtree was called with the joined paths
        assert mock_rmtree.call_count == 2  # Two folders should be removed
        # Verify the paths that were passed to rmtree
        rmtree_calls = [call[0][0] for call in mock_rmtree.call_args_list]
        assert "server/temp/folder1" in rmtree_calls
        assert "server/temp/folder2" in rmtree_calls
    
    @pytest.mark.asyncio
    @patch('os.listdir')
    async def test_handle_clear_temp_empty_directory(self, mock_listdir):
        """Test clear temp handler with empty directory."""
        mock_listdir.return_value = []
        
        # Should not raise an error
        await handle_clear_temp(self.mock_websocket)
        
        # os.listdir is called twice: once for print, once for loop
        assert mock_listdir.call_count == 2


if __name__ == "__main__":
    pytest.main([__file__])
