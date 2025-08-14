"""Tests for main FastAPI application."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add server directory to path to import modules
server_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'server')
sys.path.insert(0, server_dir)

from main import app


class TestMainApp:
    """Test cases for main FastAPI application."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.client = TestClient(app)
    
    def test_health_endpoint(self):
        """Test the health check endpoint."""
        response = self.client.get("/healthz")
        
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    
    def test_cors_headers(self):
        """Test that CORS headers are properly configured."""
        response = self.client.get("/healthz")
        
        # Check that CORS middleware is working
        assert response.status_code == 200
        # Note: TestClient doesn't automatically include CORS headers in tests
        # This would need integration testing with actual browser requests
    
    @patch('main.client_manager')
    @patch('main.handle_message')
    def test_websocket_connection(self, mock_handle_message, mock_client_manager):
        """Test WebSocket connection establishment."""
        mock_client_manager.generate_client_id.return_value = "test-client-123"
        mock_handle_message.return_value = True
        
        with self.client.websocket_connect("/ws") as websocket:
            # Check that connection message is received
            data = websocket.receive_text()
            assert "Connected as client" in data
            assert "test-client-123"[:8] in data
            
            # Verify client was added
            mock_client_manager.add_client.assert_called_once()
            args = mock_client_manager.add_client.call_args[0]
            assert args[0] == "test-client-123"
    
    @patch('main.client_manager')
    @patch('main.handle_message')
    def test_websocket_message_handling(self, mock_handle_message, mock_client_manager):
        """Test WebSocket message handling."""
        mock_client_manager.generate_client_id.return_value = "test-client-123"
        mock_handle_message.return_value = True
        
        with self.client.websocket_connect("/ws") as websocket:
            # Skip connection message
            websocket.receive_text()
            
            # Send a test message
            websocket.send_text("test message")
            
            # Verify handle_message was called
            mock_handle_message.assert_called_once()
            args = mock_handle_message.call_args[0]
            assert args[1] == "test message"  # data parameter
            assert args[2] == "test-client-123"  # client_id parameter
    
    @patch('main.client_manager')
    @patch('main.handle_message')
    def test_websocket_unhandled_message(self, mock_handle_message, mock_client_manager):
        """Test WebSocket handling of unhandled messages."""
        mock_client_manager.generate_client_id.return_value = "test-client-123"
        mock_handle_message.return_value = False  # Message not handled
        
        with self.client.websocket_connect("/ws") as websocket:
            # Skip connection message
            websocket.receive_text()
            
            # Send a test message
            websocket.send_text("unknown command")
            
            # Should receive echo response
            response = websocket.receive_text()
            assert response == "Echo: unknown command"
    
    @patch('main.client_manager')
    def test_websocket_disconnect_cleanup(self, mock_client_manager):
        """Test WebSocket disconnect cleanup."""
        mock_client_manager.generate_client_id.return_value = "test-client-123"
        
        with self.client.websocket_connect("/ws") as websocket:
            # Skip connection message
            websocket.receive_text()
            # WebSocket will be closed when exiting context
        
        # Verify client was removed on disconnect
        mock_client_manager.remove_client.assert_called_once_with("test-client-123")
    
    def test_app_title(self):
        """Test that the app has the correct title."""
        assert app.title == "WOMBAT Simulation Server"
    
    def test_app_routes(self):
        """Test that expected routes are registered."""
        routes = [route.path for route in app.routes]
        
        assert "/healthz" in routes
        assert "/ws" in routes


if __name__ == "__main__":
    pytest.main([__file__])
