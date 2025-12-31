"""
Comprehensive tests for the integrations API endpoints.

Tests cover:
- List integrations
- Get single integration
- Delete integration
- Sync integration (ADO and Jira providers)
- Get available fields
- Field mappings CRUD
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.db import get_session
from app.models.jira import Integration


# Test fixtures
@pytest.fixture(name="session")
def session_fixture():
    """Create a fresh in-memory database for each test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Create a test client with database override."""
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_ado_integration(session: Session) -> Integration:
    """Create a sample ADO integration for testing."""
    integration = Integration(
        provider="ado",
        name="moodys-nwc",
        base_url="https://dev.azure.com",
        cloud_id="test-cloud-id-123",
        auth_type="oauth",
        access_token="test-access-token",
        refresh_token="test-refresh-token",
        token_expires_at=datetime.utcnow() + timedelta(hours=1),
        scopes=["vso.work_write", "vso.project", "vso.profile", "offline_access"],
        status="connected"
    )
    session.add(integration)
    session.commit()
    session.refresh(integration)
    return integration


@pytest.fixture
def sample_jira_integration(session: Session) -> Integration:
    """Create a sample Jira integration for testing."""
    integration = Integration(
        provider="jira",
        name="My Jira Cloud",
        base_url="https://mycompany.atlassian.net",
        cloud_id="jira-cloud-id-456",
        auth_type="oauth",
        access_token="jira-access-token",
        refresh_token="jira-refresh-token",
        token_expires_at=datetime.utcnow() + timedelta(hours=1),
        scopes=["read:jira-work", "write:jira-work"],
        status="connected"
    )
    session.add(integration)
    session.commit()
    session.refresh(integration)
    return integration


@pytest.fixture
def error_integration(session: Session) -> Integration:
    """Create an integration with error status for testing."""
    integration = Integration(
        provider="ado",
        name="error-integration",
        base_url="https://dev.azure.com",
        cloud_id="error-cloud-id",
        auth_type="oauth",
        access_token="expired-token",
        refresh_token="expired-refresh",
        token_expires_at=datetime.utcnow() - timedelta(hours=1),  # Expired
        scopes=["vso.work_write"],
        status="error",
        error_message="Token expired"
    )
    session.add(integration)
    session.commit()
    session.refresh(integration)
    return integration


# ===================
# List Integrations
# ===================

class TestListIntegrations:
    """Tests for GET /api/integrations"""

    def test_list_empty(self, client: TestClient):
        """Should return empty list when no integrations exist."""
        response = client.get("/api/integrations")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_single(self, client: TestClient, sample_ado_integration: Integration):
        """Should return single integration."""
        response = client.get("/api/integrations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == sample_ado_integration.id
        assert data[0]["provider"] == "ado"
        assert data[0]["name"] == "moodys-nwc"

    def test_list_multiple(self, client: TestClient, sample_ado_integration: Integration, sample_jira_integration: Integration):
        """Should return multiple integrations."""
        response = client.get("/api/integrations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        providers = {i["provider"] for i in data}
        assert providers == {"ado", "jira"}

    def test_list_includes_error_status(self, client: TestClient, error_integration: Integration):
        """Should include integrations with error status."""
        response = client.get("/api/integrations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "error"
        assert data[0]["error_message"] == "Token expired"


# ===================
# Get Single Integration
# ===================

class TestGetIntegration:
    """Tests for GET /api/integrations/{id}"""

    def test_get_existing(self, client: TestClient, sample_ado_integration: Integration):
        """Should return integration by ID."""
        response = client.get(f"/api/integrations/{sample_ado_integration.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_ado_integration.id
        assert data["provider"] == "ado"
        assert data["name"] == "moodys-nwc"
        assert data["status"] == "connected"

    def test_get_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.get("/api/integrations/9999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_includes_all_fields(self, client: TestClient, sample_ado_integration: Integration):
        """Should include all expected fields in response."""
        response = client.get(f"/api/integrations/{sample_ado_integration.id}")
        assert response.status_code == 200
        data = response.json()

        expected_fields = ["id", "provider", "name", "base_url", "auth_type", "status", "scopes"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"


# ===================
# Delete Integration
# ===================

class TestDeleteIntegration:
    """Tests for DELETE /api/integrations/{id}"""

    def test_delete_existing(self, client: TestClient, sample_ado_integration: Integration, session: Session):
        """Should delete integration and return success."""
        integration_id = sample_ado_integration.id
        response = client.delete(f"/api/integrations/{integration_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deletion
        session.expire_all()
        deleted = session.get(Integration, integration_id)
        assert deleted is None

    def test_delete_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.delete("/api/integrations/9999")
        assert response.status_code == 404

    def test_delete_does_not_affect_others(self, client: TestClient, sample_ado_integration: Integration, sample_jira_integration: Integration, session: Session):
        """Deleting one integration should not affect others."""
        client.delete(f"/api/integrations/{sample_ado_integration.id}")

        session.expire_all()
        jira = session.get(Integration, sample_jira_integration.id)
        assert jira is not None
        assert jira.provider == "jira"


# ===================
# Sync Integration
# ===================

class TestSyncIntegration:
    """Tests for POST /api/integrations/{id}/sync"""

    def test_sync_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.post("/api/integrations/9999/sync")
        assert response.status_code == 404

    @patch("httpx.AsyncClient")
    def test_sync_ado_success(self, mock_httpx, client: TestClient, sample_ado_integration: Integration):
        """Should successfully sync ADO integration."""
        # Mock successful ADO profile response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "user-123",
            "displayName": "Test User",
            "emailAddress": "test@example.com"
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.post(f"/api/integrations/{sample_ado_integration.id}/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        assert data["error_message"] is None

    @patch("httpx.AsyncClient")
    def test_sync_ado_token_expired_refresh_success(self, mock_httpx, client: TestClient, error_integration: Integration):
        """Should refresh token when expired and retry."""
        # First call fails with 401, refresh succeeds, retry succeeds
        mock_401_response = MagicMock()
        mock_401_response.status_code = 401

        mock_refresh_response = MagicMock()
        mock_refresh_response.status_code = 200
        mock_refresh_response.json.return_value = {
            "access_token": "new-token",
            "refresh_token": "new-refresh",
            "expires_in": 3600
        }

        mock_success_response = MagicMock()
        mock_success_response.status_code = 200
        mock_success_response.json.return_value = {"id": "user-123"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[mock_401_response, mock_success_response])
        mock_client.post = AsyncMock(return_value=mock_refresh_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.post(f"/api/integrations/{error_integration.id}/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"

    @patch("httpx.AsyncClient")
    def test_sync_ado_api_error(self, mock_httpx, client: TestClient, sample_ado_integration: Integration):
        """Should set error status when ADO API fails."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.post(f"/api/integrations/{sample_ado_integration.id}/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert "500" in data["error_message"]

    @patch("app.services.jira_service.jira_service.sync_integration")
    def test_sync_jira_delegates_to_service(self, mock_sync, client: TestClient, sample_jira_integration: Integration):
        """Should delegate Jira sync to jira_service."""
        mock_sync.return_value = sample_jira_integration

        response = client.post(f"/api/integrations/{sample_jira_integration.id}/sync")
        assert response.status_code == 200
        mock_sync.assert_called_once()


# ===================
# Get Integration Fields
# ===================

class TestGetIntegrationFields:
    """Tests for GET /api/integrations/{id}/fields"""

    def test_fields_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.get("/api/integrations/9999/fields")
        assert response.status_code == 404

    def test_fields_ado_returns_standard_fields(self, client: TestClient, sample_ado_integration: Integration):
        """Should return standard ADO work item fields."""
        response = client.get(f"/api/integrations/{sample_ado_integration.id}/fields")
        assert response.status_code == 200
        data = response.json()

        # Should have multiple fields
        assert len(data) >= 5

        # Check expected fields exist
        field_ids = {f["id"] for f in data}
        assert "System.Title" in field_ids
        assert "Microsoft.VSTS.Scheduling.StoryPoints" in field_ids
        assert "System.IterationPath" in field_ids
        assert "System.Tags" in field_ids

    def test_fields_ado_field_structure(self, client: TestClient, sample_ado_integration: Integration):
        """Should return fields with correct structure."""
        response = client.get(f"/api/integrations/{sample_ado_integration.id}/fields")
        assert response.status_code == 200
        data = response.json()

        # Check field structure
        for field in data:
            assert "id" in field
            assert "name" in field
            assert "key" in field
            assert "custom" in field
            assert "schema" in field
            assert "type" in field["schema"]

    @patch("httpx.AsyncClient")
    def test_fields_jira_fetches_from_api(self, mock_httpx, client: TestClient, sample_jira_integration: Integration):
        """Should fetch Jira fields from API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": "summary", "name": "Summary", "key": "summary", "custom": False, "schema": {"type": "string"}},
            {"id": "customfield_10001", "name": "Story Points", "key": "storypoints", "custom": True, "schema": {"type": "number"}},
        ]

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.get(f"/api/integrations/{sample_jira_integration.id}/fields")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Summary"

    @patch("httpx.AsyncClient")
    def test_fields_jira_api_error(self, mock_httpx, client: TestClient, sample_jira_integration: Integration):
        """Should return 500 when Jira API fails."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.get(f"/api/integrations/{sample_jira_integration.id}/fields")
        assert response.status_code == 500


# ===================
# Field Mappings
# ===================

class TestFieldMappings:
    """Tests for field mapping endpoints."""

    def test_get_mappings_empty(self, client: TestClient, sample_ado_integration: Integration):
        """Should return empty list when no mappings exist."""
        response = client.get(f"/api/integrations/{sample_ado_integration.id}/mappings")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_mappings_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.get("/api/integrations/9999/mappings")
        assert response.status_code == 404

    def test_update_mapping(self, client: TestClient, sample_ado_integration: Integration):
        """Should create/update a field mapping."""
        response = client.put(
            f"/api/integrations/{sample_ado_integration.id}/mappings/story_points",
            json={
                "providerFieldId": "Microsoft.VSTS.Scheduling.StoryPoints",
                "providerFieldName": "Story Points",
                "providerFieldType": "number"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ourField"] == "story_points"
        assert data["providerFieldId"] == "Microsoft.VSTS.Scheduling.StoryPoints"
        assert data["providerFieldName"] == "Story Points"
        assert data["adminConfirmed"] is True

    def test_update_mapping_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.put(
            "/api/integrations/9999/mappings/story_points",
            json={"providerFieldId": "test", "providerFieldName": "Test"}
        )
        assert response.status_code == 404

    def test_delete_mapping(self, client: TestClient, sample_ado_integration: Integration):
        """Should delete a field mapping."""
        response = client.delete(f"/api/integrations/{sample_ado_integration.id}/mappings/story_points")
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_delete_mapping_not_found(self, client: TestClient):
        """Should return 404 for non-existent integration."""
        response = client.delete("/api/integrations/9999/mappings/story_points")
        assert response.status_code == 404

    def test_update_multiple_mappings(self, client: TestClient, sample_ado_integration: Integration):
        """Should handle multiple field mappings."""
        mappings = [
            ("story_points", "Microsoft.VSTS.Scheduling.StoryPoints", "Story Points"),
            ("sprint", "System.IterationPath", "Iteration Path"),
            ("priority", "Microsoft.VSTS.Common.Priority", "Priority"),
        ]

        for our_field, provider_id, provider_name in mappings:
            response = client.put(
                f"/api/integrations/{sample_ado_integration.id}/mappings/{our_field}",
                json={"providerFieldId": provider_id, "providerFieldName": provider_name}
            )
            assert response.status_code == 200
            assert response.json()["ourField"] == our_field


# ===================
# Edge Cases & Error Handling
# ===================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_invalid_integration_id_format(self, client: TestClient):
        """Should handle invalid ID formats gracefully."""
        response = client.get("/api/integrations/invalid")
        assert response.status_code == 422  # Validation error

    def test_sync_with_missing_tokens(self, client: TestClient, session: Session):
        """Should handle integration with missing tokens."""
        integration = Integration(
            provider="ado",
            name="no-tokens",
            base_url="https://dev.azure.com",
            auth_type="oauth",
            access_token="",  # Empty token
            status="connected"
        )
        session.add(integration)
        session.commit()
        session.refresh(integration)

        with patch("httpx.AsyncClient") as mock_httpx:
            mock_response = MagicMock()
            mock_response.status_code = 401

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.return_value = mock_client

            response = client.post(f"/api/integrations/{integration.id}/sync")
            assert response.status_code == 200
            assert response.json()["status"] == "error"

    def test_concurrent_operations(self, client: TestClient, sample_ado_integration: Integration):
        """Should handle concurrent reads without issues."""
        import concurrent.futures

        def get_integration():
            return client.get(f"/api/integrations/{sample_ado_integration.id}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(get_integration) for _ in range(10)]
            results = [f.result() for f in futures]

        assert all(r.status_code == 200 for r in results)


# ===================
# Integration Status Transitions
# ===================

class TestStatusTransitions:
    """Tests for integration status state machine."""

    @patch("httpx.AsyncClient")
    def test_connected_to_error_on_api_failure(self, mock_httpx, client: TestClient, sample_ado_integration: Integration):
        """Status should change from connected to error on API failure."""
        assert sample_ado_integration.status == "connected"

        mock_response = MagicMock()
        mock_response.status_code = 403

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.post(f"/api/integrations/{sample_ado_integration.id}/sync")
        assert response.json()["status"] == "error"

    @patch("httpx.AsyncClient")
    def test_error_to_connected_on_successful_sync(self, mock_httpx, client: TestClient, error_integration: Integration):
        """Status should change from error to connected on successful sync."""
        assert error_integration.status == "error"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "user-123"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.post(f"/api/integrations/{error_integration.id}/sync")
        assert response.json()["status"] == "connected"
        assert response.json()["error_message"] is None

    @patch("httpx.AsyncClient")
    def test_last_sync_updated_on_success(self, mock_httpx, client: TestClient, sample_ado_integration: Integration):
        """last_sync_at should be updated on successful sync."""
        original_sync = sample_ado_integration.last_sync_at

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "user-123"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_httpx.return_value = mock_client

        response = client.post(f"/api/integrations/{sample_ado_integration.id}/sync")
        assert response.status_code == 200

        new_sync = response.json().get("last_sync_at")
        # Should be set (was None before or updated)
        assert new_sync is not None or original_sync != new_sync
