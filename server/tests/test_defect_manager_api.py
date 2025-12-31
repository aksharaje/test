"""
Tests for Defect Manager API endpoints.
"""

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.defect_manager import (
    DefectManagerSession,
    AnalyzedDefect,
)
from app.models.jira import Integration


# =============================================================================
# FIXTURES
# =============================================================================


@pytest.fixture
def sample_integration(session: Session):
    """Create a sample connected integration."""
    integration = Integration(
        provider="jira",
        name="Test Jira",
        base_url="https://test.atlassian.net",
        cloud_id="test-cloud-id",
        auth_type="oauth",
        access_token="test-token",
        refresh_token="test-refresh",
        token_expires_at=datetime.utcnow() + timedelta(hours=1),
        scopes=["read:jira-work"],
        status="connected",
    )
    session.add(integration)
    session.commit()
    session.refresh(integration)
    return integration


@pytest.fixture
def defect_session(session: Session, sample_integration: Integration):
    """Create a sample defect analysis session."""
    defect_sess = DefectManagerSession(
        name="Sprint Defects",
        integration_id=sample_integration.id,
        data_level=2,
        status="draft",
    )
    session.add(defect_sess)
    session.commit()
    session.refresh(defect_sess)
    return defect_sess


@pytest.fixture
def analyzed_defects(session: Session, defect_session: DefectManagerSession):
    """Create sample analyzed defects."""
    defects = [
        AnalyzedDefect(
            session_id=defect_session.id,
            external_id="BUG-101",
            external_url="https://test.atlassian.net/browse/BUG-101",
            title="Login fails with special characters",
            item_type="Bug",
            status="Open",
            status_category="open",
            severity="critical",
            severity_source="explicit",
            severity_confidence=0.95,
            component="Authentication",
            assignee="John Doe",
            labels=["production"],
            days_open=5,
        ),
        AnalyzedDefect(
            session_id=defect_session.id,
            external_id="BUG-102",
            external_url="https://test.atlassian.net/browse/BUG-102",
            title="Dashboard loads slowly",
            item_type="Bug",
            status="In Progress",
            status_category="in_progress",
            severity="medium",
            severity_source="inferred",
            severity_confidence=0.6,
            component="Dashboard",
            assignee="Jane Smith",
            labels=["performance"],
            days_open=10,
        ),
        AnalyzedDefect(
            session_id=defect_session.id,
            external_id="BUG-103",
            external_url="https://test.atlassian.net/browse/BUG-103",
            title="Export fails for large reports",
            item_type="Bug",
            status="Resolved",
            status_category="resolved",
            severity="high",
            severity_source="priority",
            severity_confidence=0.85,
            component="Reports",
            assignee="Bob Wilson",
            labels=[],
            days_open=3,
        ),
    ]
    for d in defects:
        session.add(d)

    defect_session.status = "ready"
    defect_session.analysis_snapshot = {
        "total_defects": 3,
        "by_severity": {"critical": 1, "high": 1, "medium": 1, "low": 0},
        "by_status": {"open": 1, "in_progress": 1, "resolved": 1},
        "by_component": {"Authentication": 1, "Dashboard": 1, "Reports": 1},
        "potential_duplicates": 0,
        "aging_defects": 0,
        "critical_open": 1,
    }
    defect_session.last_analysis_at = datetime.utcnow()
    session.add(defect_session)
    session.commit()

    return defects


# =============================================================================
# INTEGRATION CHECK TESTS
# =============================================================================


class TestIntegrationCheck:
    """Tests for /integrations/check endpoint."""

    def test_no_integrations(self, client):
        """Returns message when no integrations exist."""
        response = client.get("/api/defect-manager/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is False
        assert len(data["integrations"]) == 0

    def test_with_connected_integration(self, client, sample_integration):
        """Returns valid when integration is connected."""
        response = client.get("/api/defect-manager/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is True
        assert len(data["integrations"]) == 1
        assert data["integrations"][0]["provider"] == "jira"


# =============================================================================
# SESSION CRUD TESTS
# =============================================================================


class TestCreateSession:
    """Tests for POST /sessions endpoint."""

    def test_create_session(self, client, sample_integration):
        """Successfully creates a defect analysis session."""
        response = client.post(
            "/api/defect-manager/sessions",
            json={
                "name": "Q4 Defect Analysis",
                "integration_id": sample_integration.id,
                "project_filter": "PROJ",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Q4 Defect Analysis"
        assert data["integration_id"] == sample_integration.id
        assert data["status"] == "draft"
        assert data["data_level"] >= 1

    def test_create_with_invalid_integration(self, client):
        """Returns error for non-existent integration."""
        response = client.post(
            "/api/defect-manager/sessions",
            json={
                "integration_id": 9999,
            },
        )
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()


class TestListSessions:
    """Tests for GET /sessions endpoint."""

    def test_list_empty(self, client, sample_integration):
        """Returns empty list when no sessions exist."""
        response = client.get("/api/defect-manager/sessions")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_sessions(self, client, defect_session):
        """Returns list of sessions."""
        response = client.get("/api/defect-manager/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Sprint Defects"


class TestGetSession:
    """Tests for GET /sessions/{session_id} endpoint."""

    def test_get_session(self, client, defect_session):
        """Returns session details."""
        response = client.get(f"/api/defect-manager/sessions/{defect_session.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Sprint Defects"
        assert data["data_level"] == 2

    def test_get_not_found(self, client, sample_integration):
        """Returns 404 for non-existent session."""
        response = client.get("/api/defect-manager/sessions/9999")
        assert response.status_code == 404


class TestDeleteSession:
    """Tests for DELETE /sessions/{session_id} endpoint."""

    def test_delete_session(self, client, defect_session):
        """Successfully deletes a session."""
        response = client.delete(f"/api/defect-manager/sessions/{defect_session.id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deletion
        response = client.get(f"/api/defect-manager/sessions/{defect_session.id}")
        assert response.status_code == 404

    def test_delete_not_found(self, client, sample_integration):
        """Returns 404 for non-existent session."""
        response = client.delete("/api/defect-manager/sessions/9999")
        assert response.status_code == 404


# =============================================================================
# TRIAGE TESTS
# =============================================================================


class TestTriageResult:
    """Tests for GET /sessions/{session_id}/triage endpoint."""

    def test_get_triage_result(self, client, defect_session, analyzed_defects):
        """Returns triage results."""
        response = client.get(f"/api/defect-manager/sessions/{defect_session.id}/triage")
        assert response.status_code == 200
        data = response.json()
        assert data["total_defects"] == 3
        assert data["by_severity"]["critical"] == 1
        assert data["critical_open"] == 1
        assert len(data["defects"]) == 3

    def test_triage_not_ready(self, client, defect_session):
        """Returns 404 when analysis not complete."""
        # Session is in draft status (not ready)
        defect_session.status = "draft"
        response = client.get(f"/api/defect-manager/sessions/{defect_session.id}/triage")
        assert response.status_code == 404


# =============================================================================
# RECOMMENDATIONS TESTS
# =============================================================================


class TestPreventionRecommendations:
    """Tests for GET /sessions/{session_id}/recommendations endpoint."""

    def test_get_recommendations(self, client, defect_session, analyzed_defects):
        """Returns prevention recommendations."""
        response = client.get(f"/api/defect-manager/sessions/{defect_session.id}/recommendations")
        assert response.status_code == 200
        data = response.json()
        # Should have at least one recommendation due to critical defects
        assert len(data) >= 1
        assert any(r["category"] == "testing" for r in data)

    def test_recommendations_empty_session(self, client, defect_session):
        """Returns empty list for session without analysis."""
        response = client.get(f"/api/defect-manager/sessions/{defect_session.id}/recommendations")
        assert response.status_code == 200
        # No recommendations for draft session
        assert response.json() == []
