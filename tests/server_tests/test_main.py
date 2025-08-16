"""Tests for main FastAPI application (REST-only)."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch
from server.main import app


class TestMainApp:
    """Test cases for main FastAPI application (REST-only)."""
    
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
    
    # WebSocket-related tests removed: REST API is the supported surface now
    
    def test_app_title(self):
        """Test that the app has the correct title."""
        assert app.title == "WOMBAT Simulation Server"
    
    def test_app_routes(self):
        """Test that expected routes are registered."""
        routes = [route.path for route in app.routes]
        
        assert "/healthz" in routes
        # REST router mounted at /api
        assert any(path.startswith("/api") for path in routes)


if __name__ == "__main__":
    pytest.main([__file__])
