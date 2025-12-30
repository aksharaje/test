import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from app.main import app
from app.core.db import get_session
from app.models.jira import Integration
from datetime import datetime
from sqlalchemy.pool import StaticPool

# Create in-memory DB for integration tests
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
SQLModel.metadata.create_all(engine)

def get_test_session():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_test_session
client = TestClient(app)

@pytest.fixture
def test_integration():
    with Session(engine) as session:
        integration = Integration(
            provider="jira",
            name="Test Jira",
            base_url="https://test.atlassian.net",
            cloud_id="cloud-123",
            auth_type="oauth",
            access_token="old-token",
            refresh_token="valid-refresh-token",
            token_expires_at=datetime.utcnow(),
            scopes=["read:jira-work"],
            status="connected"
        )
        session.add(integration)
        session.commit()
        session.refresh(integration)
        return integration

@patch("app.services.jira_service.httpx.AsyncClient")
def test_sync_integration_success(mock_client_cls, test_integration):
    # Setup mock
    mock_client = MagicMock()
    mock_client_cls.return_value.__aenter__.return_value = mock_client
    
    # Mock successful response
    mock_response = MagicMock()
    mock_response.status_code = 200
    
    # helper for async return
    import asyncio
    f = asyncio.Future()
    f.set_result(mock_response)
    mock_client.get.return_value = f
    
    response = client.post(f"/api/integrations/{test_integration.id}/sync")
    
    # Print response if failed
    if response.status_code != 200:
        print(response.json())
        
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "connected"
    assert data["last_sync_at"] is not None

@patch("app.services.jira_service.httpx.AsyncClient")
def test_sync_integration_refresh_success(mock_client_cls, test_integration):
    # Setup mock
    mock_client = MagicMock()
    mock_client_cls.return_value.__aenter__.return_value = mock_client
    
    import asyncio
    
    # Mock 401 first, then success after refresh
    fail_response = MagicMock()
    fail_response.status_code = 401
    
    success_response = MagicMock()
    success_response.status_code = 200
    
    f1 = asyncio.Future()
    f1.set_result(fail_response)
    f2 = asyncio.Future()
    f2.set_result(success_response)
    
    mock_client.get.side_effect = [f1, f2]
    
    # Mock refresh response
    refresh_response = MagicMock()
    refresh_response.status_code = 200
    refresh_response.json.return_value = {
        "access_token": "new-token",
        "refresh_token": "new-refresh-token",
        "expires_in": 3600
    }
    f_refresh = asyncio.Future()
    f_refresh.set_result(refresh_response)
    mock_client.post.return_value = f_refresh
    
    response = client.post(f"/api/integrations/{test_integration.id}/sync")
    
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "new-token"
    assert data["status"] == "connected"

@patch("app.services.jira_service.httpx.AsyncClient")
def test_sync_integration_failure(mock_client_cls, test_integration):
    # Setup mock
    mock_client = MagicMock()
    mock_client_cls.return_value.__aenter__.return_value = mock_client
    
    import asyncio
    
    # Mock 500 failure
    fail_response = MagicMock()
    fail_response.status_code = 500
    
    f = asyncio.Future()
    f.set_result(fail_response)
    mock_client.get.return_value = f
    
    response = client.post(f"/api/integrations/{test_integration.id}/sync")
    
    assert response.status_code == 200 
    data = response.json()
    assert data["status"] == "error"
    assert "500" in data["error_message"]
