"""Tests for message_handler module."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add server directory to path to import modules
server_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'server')
sys.path.insert(0, server_dir)

from message_handler import handle_message


class TestMessageHandler:
    """Test cases for message handler functions."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.mock_websocket = Mock()
        self.mock_websocket.send_text = AsyncMock()
        self.client_id = "test-client-123"
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    async def test_handle_message_json_event(self, mock_handle_json):
        """Test message handler with JSON event."""
        mock_handle_json.return_value = True
        
        result = await handle_message(self.mock_websocket, '{"event": "test"}', self.client_id)
        
        assert result is True
        mock_handle_json.assert_called_once_with(self.mock_websocket, '{"event": "test"}')
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    @patch('message_handler.handle_run_simulation')
    async def test_handle_message_run_command(self, mock_handle_run, mock_handle_json):
        """Test message handler with run command."""
        mock_handle_json.return_value = False  # Not a JSON event
        mock_handle_run.return_value = True
        
        result = await handle_message(self.mock_websocket, "run simulation", self.client_id)
        
        assert result is True
        mock_handle_json.assert_called_once()
        mock_handle_run.assert_called_once_with(self.mock_websocket, self.client_id)
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    @patch('message_handler.handle_clear_temp')
    async def test_handle_message_clear_temp_command(self, mock_handle_clear, mock_handle_json):
        """Test message handler with clear_temp command."""
        mock_handle_json.return_value = False  # Not a JSON event
        
        result = await handle_message(self.mock_websocket, "clear_temp", self.client_id)
        
        assert result is True
        mock_handle_json.assert_called_once()
        mock_handle_clear.assert_called_once_with(self.mock_websocket)
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    @patch('message_handler.handle_get_config')
    async def test_handle_message_get_config_command(self, mock_handle_get_config, mock_handle_json):
        """Test message handler with get_config command."""
        mock_handle_json.return_value = False  # Not a JSON event
        
        result = await handle_message(self.mock_websocket, "get_config", self.client_id)
        
        assert result is True
        mock_handle_json.assert_called_once()
        mock_handle_get_config.assert_called_once_with(self.mock_websocket)
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    async def test_handle_message_unhandled(self, mock_handle_json):
        """Test message handler with unhandled message."""
        mock_handle_json.return_value = False  # Not a JSON event
        
        result = await handle_message(self.mock_websocket, "unknown command", self.client_id)
        
        assert result is False
        mock_handle_json.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    @patch('message_handler.handle_run_simulation')
    async def test_handle_message_case_insensitive(self, mock_handle_run, mock_handle_json):
        """Test message handler is case insensitive."""
        mock_handle_json.return_value = False
        mock_handle_run.return_value = True
        
        # Test various cases
        test_cases = ["RUN", "Run", "run", "RUN SIMULATION", "run simulation"]
        
        for test_case in test_cases:
            mock_handle_run.reset_mock()
            result = await handle_message(self.mock_websocket, test_case, self.client_id)
            assert result is True
            mock_handle_run.assert_called_once_with(self.mock_websocket, self.client_id)
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    async def test_handle_message_whitespace_handling(self, mock_handle_json):
        """Test message handler handles whitespace correctly."""
        mock_handle_json.return_value = False
        
        # Test with extra whitespace
        result = await handle_message(self.mock_websocket, "  get_config  ", self.client_id)
        
        assert result is True  # Should be handled as get_config
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    async def test_handle_message_empty_string(self, mock_handle_json):
        """Test message handler with empty string."""
        mock_handle_json.return_value = False
        
        result = await handle_message(self.mock_websocket, "", self.client_id)
        
        assert result is False
        mock_handle_json.assert_called_once_with(self.mock_websocket, "")
    
    @pytest.mark.asyncio
    @patch('message_handler.handle_json_event')
    async def test_handle_message_none_data(self, mock_handle_json):
        """Test message handler with None data."""
        mock_handle_json.return_value = False
        
        result = await handle_message(self.mock_websocket, None, self.client_id)
        
        assert result is False
        mock_handle_json.assert_called_once_with(self.mock_websocket, None)


if __name__ == "__main__":
    pytest.main([__file__])
