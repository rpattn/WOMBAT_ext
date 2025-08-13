# WOMBAT Server Tests

This directory contains comprehensive tests for the WOMBAT server modules.

## Test Structure

```
tests/
├── __init__.py                 # Test package initialization
├── conftest.py                 # Pytest configuration and fixtures
├── requirements-test.txt       # Test dependencies
├── README.md                   # This file
├── test_client_manager.py      # Tests for client_manager module
├── test_event_handlers.py      # Tests for event_handlers module
├── test_simulation_manager.py  # Tests for simulation_manager module
├── test_message_handler.py     # Tests for message_handler module
└── test_main.py               # Tests for main FastAPI application
```

## Test Coverage

### ClientManager Tests (`test_client_manager.py`)
- ✅ Client initialization and state management
- ✅ Adding and removing clients
- ✅ Simulation state tracking per client
- ✅ Client ID generation
- ✅ Multiple client management
- ✅ Error handling for nonexistent clients

### Event Handlers Tests (`test_event_handlers.py`)
- ✅ Settings update event handling
- ✅ JSON event parsing and routing
- ✅ Configuration retrieval (get_config)
- ✅ Temporary file cleanup (clear_temp)
- ✅ Invalid JSON handling
- ✅ Unknown event type handling

### Simulation Manager Tests (`test_simulation_manager.py`)
- ✅ Simulation execution workflow
- ✅ Client state management during simulation
- ✅ Concurrent simulation prevention
- ✅ Ticker task creation and management
- ✅ Thread management for simulations
- ✅ Error handling during simulation

### Message Handler Tests (`test_message_handler.py`)
- ✅ Message routing to appropriate handlers
- ✅ JSON vs text command differentiation
- ✅ Case-insensitive command handling
- ✅ Whitespace handling
- ✅ Unhandled message fallback
- ✅ Edge cases (empty strings, None values)

### Main Application Tests (`test_main.py`)
- ✅ FastAPI application setup
- ✅ Health endpoint functionality
- ✅ WebSocket connection establishment
- ✅ WebSocket message handling
- ✅ Client cleanup on disconnect
- ✅ CORS configuration
- ✅ Route registration

## Running Tests

### Prerequisites

Install test dependencies:
```bash
pip install -r tests/requirements-test.txt
```

### Run All Tests

From the server directory:
```bash
python run_tests.py
```

Or using pytest directly:
```bash
pytest tests/ -v --cov=. --cov-report=html
```

### Run Specific Test Files

```bash
# Run client manager tests only
python run_tests.py client_manager

# Run event handler tests only
python run_tests.py event_handlers

# Run simulation manager tests only
python run_tests.py simulation_manager
```

### Run Individual Test Methods

```bash
# Run a specific test method
pytest tests/test_client_manager.py::TestClientManager::test_add_client -v
```

## Test Features

### Async Testing
- Uses `pytest-asyncio` for testing async functions
- Properly mocks WebSocket connections and async operations
- Tests WebSocket message handling workflows

### Mocking
- Comprehensive mocking of external dependencies
- WebSocket connections mocked for isolated testing
- File system operations mocked to avoid side effects
- Simulation functions mocked to avoid long-running operations

### Coverage Reporting
- Line coverage reporting with `pytest-cov`
- HTML coverage reports generated in `htmlcov/`
- Missing line identification for incomplete coverage

### Fixtures
- Reusable test fixtures in `conftest.py`
- Mock WebSocket objects
- Sample data for consistent testing
- Client ID generation for tests

## Test Philosophy

### Unit Testing
- Each module tested in isolation
- Dependencies mocked to focus on unit behavior
- Fast execution with no external dependencies

### Integration Points
- WebSocket endpoint tests verify integration between modules
- Message routing tests ensure proper handler coordination
- Client lifecycle tests verify end-to-end workflows

### Error Handling
- Tests cover both success and failure scenarios
- Edge cases and invalid inputs tested
- Proper cleanup and resource management verified

## Continuous Integration

These tests are designed to be run in CI/CD pipelines:
- No external dependencies required
- Fast execution (< 30 seconds)
- Clear pass/fail indicators
- Coverage reporting for quality metrics

## Adding New Tests

When adding new functionality:

1. **Create test file**: Follow naming convention `test_<module_name>.py`
2. **Use fixtures**: Leverage existing fixtures in `conftest.py`
3. **Mock dependencies**: Keep tests isolated and fast
4. **Test edge cases**: Include error conditions and invalid inputs
5. **Update this README**: Document new test coverage

### Test Template

```python
import pytest
from unittest.mock import Mock, AsyncMock, patch

class TestNewModule:
    def setup_method(self):
        # Set up test fixtures
        pass
    
    @pytest.mark.asyncio
    async def test_new_functionality(self):
        # Test implementation
        assert True
```

## Troubleshooting

### Common Issues

**Import Errors**: Ensure the server directory is in Python path
```bash
export PYTHONPATH="${PYTHONPATH}:/path/to/server"
```

**Async Test Failures**: Ensure `pytest-asyncio` is installed and tests are marked with `@pytest.mark.asyncio`

**Mock Issues**: Verify mock objects are properly configured before use

**Coverage Issues**: Check that all code paths are tested, including error conditions

### Debug Mode

Run tests with more verbose output:
```bash
pytest tests/ -v -s --tb=long
```

Run specific failing test:
```bash
pytest tests/test_module.py::TestClass::test_method -v -s
```
