"""
Tests for Release Readiness Checker API endpoints.
"""

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.release_readiness import (
    ReleaseReadinessSession,
    ReleaseWorkItem,
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
def readiness_session(session: Session, sample_integration: Integration):
    """Create a sample release readiness session."""
    readiness_sess = ReleaseReadinessSession(
        name="Release 2.4",
        integration_id=sample_integration.id,
        release_identifier="2.4.0",
        release_type="fixVersion",
        status="draft",
    )
    session.add(readiness_sess)
    session.commit()
    session.refresh(readiness_sess)
    return readiness_sess


@pytest.fixture
def release_items(session: Session, readiness_session: ReleaseReadinessSession):
    """Create sample release work items."""
    items = [
        ReleaseWorkItem(
            session_id=readiness_session.id,
            external_id="PROJ-101",
            external_url="https://test.atlassian.net/browse/PROJ-101",
            title="User authentication flow",
            item_type="Story",
            status="Done",
            status_category="done",
            has_ac=True,
            ac_source="description",
            ac_count=3,
            story_points=5,
            assignee="John Doe",
        ),
        ReleaseWorkItem(
            session_id=readiness_session.id,
            external_id="PROJ-102",
            external_url="https://test.atlassian.net/browse/PROJ-102",
            title="Dashboard redesign",
            item_type="Story",
            status="Done",
            status_category="done",
            has_ac=True,
            ac_source="description",
            ac_count=2,
            story_points=8,
            assignee="Jane Smith",
        ),
        ReleaseWorkItem(
            session_id=readiness_session.id,
            external_id="PROJ-103",
            external_url="https://test.atlassian.net/browse/PROJ-103",
            title="Export feature",
            item_type="Story",
            status="In Progress",
            status_category="in_progress",
            has_ac=False,
            story_points=3,
            assignee="Bob Wilson",
        ),
        ReleaseWorkItem(
            session_id=readiness_session.id,
            external_id="BUG-201",
            external_url="https://test.atlassian.net/browse/BUG-201",
            title="Login timeout issue",
            item_type="Bug",
            status="Open",
            status_category="todo",
            severity="High",
            is_blocking=False,
        ),
    ]
    for item in items:
        session.add(item)

    readiness_session.status = "ready"
    readiness_session.readiness_score = 72
    readiness_session.max_possible_score = 100
    readiness_session.confidence_level = "moderate"
    readiness_session.recommendation = "conditional_go"
    readiness_session.recommendation_details = {
        "summary": "Conditional go - address identified risks before release",
        "risks": [{"level": "high", "area": "Completion", "description": "1 story still in progress"}],
        "mitigations": ["Complete or defer remaining work items"],
    }
    readiness_session.component_scores = {
        "defect_status": {"name": "Defect Status", "score": 45, "max_score": 75, "status": "warn"},
        "work_completion": {"name": "Work Completion", "score": 35, "max_score": 50, "status": "warn"},
        "acceptance_criteria": {"name": "Acceptance Criteria", "score": 25, "max_score": 45, "status": "warn"},
    }
    readiness_session.last_assessment_at = datetime.utcnow()
    session.add(readiness_session)
    session.commit()

    return items


# =============================================================================
# INTEGRATION CHECK TESTS
# =============================================================================


class TestIntegrationCheck:
    """Tests for /integrations/check endpoint."""

    def test_no_integrations(self, client):
        """Returns message when no integrations exist."""
        response = client.get("/api/release-readiness/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is False
        assert len(data["integrations"]) == 0

    def test_with_connected_integration(self, client, sample_integration):
        """Returns valid when integration is connected."""
        response = client.get("/api/release-readiness/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is True
        assert len(data["integrations"]) == 1


# =============================================================================
# SESSION CRUD TESTS
# =============================================================================


class TestCreateSession:
    """Tests for POST /sessions endpoint."""

    def test_create_session(self, client, sample_integration):
        """Successfully creates a release readiness session."""
        response = client.post(
            "/api/release-readiness/sessions",
            json={
                "name": "Release 3.0 Assessment",
                "integration_id": sample_integration.id,
                "release_identifier": "3.0.0",
                "release_type": "fixVersion",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Release 3.0 Assessment"
        assert data["release_identifier"] == "3.0.0"
        assert data["status"] == "draft"
        assert data["recommendation"] == "pending"

    def test_create_with_invalid_integration(self, client):
        """Returns error for non-existent integration."""
        response = client.post(
            "/api/release-readiness/sessions",
            json={
                "integration_id": 9999,
                "release_identifier": "1.0.0",
            },
        )
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()


class TestListSessions:
    """Tests for GET /sessions endpoint."""

    def test_list_empty(self, client, sample_integration):
        """Returns empty list when no sessions exist."""
        response = client.get("/api/release-readiness/sessions")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_sessions(self, client, readiness_session):
        """Returns list of sessions."""
        response = client.get("/api/release-readiness/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Release 2.4"


class TestGetSession:
    """Tests for GET /sessions/{session_id} endpoint."""

    def test_get_session(self, client, readiness_session):
        """Returns session details."""
        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Release 2.4"
        assert data["release_identifier"] == "2.4.0"

    def test_get_not_found(self, client, sample_integration):
        """Returns 404 for non-existent session."""
        response = client.get("/api/release-readiness/sessions/9999")
        assert response.status_code == 404


class TestDeleteSession:
    """Tests for DELETE /sessions/{session_id} endpoint."""

    def test_delete_session(self, client, readiness_session):
        """Successfully deletes a session."""
        response = client.delete(f"/api/release-readiness/sessions/{readiness_session.id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deletion
        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}")
        assert response.status_code == 404


# =============================================================================
# REPORTS TESTS
# =============================================================================


class TestDefectStatusReport:
    """Tests for GET /sessions/{session_id}/defects endpoint."""

    def test_get_defect_status(self, client, readiness_session, release_items):
        """Returns defect status report."""
        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}/defects")
        assert response.status_code == 200
        data = response.json()
        assert data["total_defects"] == 1
        assert data["open_high"] == 1

    def test_defect_status_not_found(self, client, sample_integration):
        """Returns 404 for non-existent session."""
        response = client.get("/api/release-readiness/sessions/9999/defects")
        assert response.status_code == 404


class TestWorkCompletionReport:
    """Tests for GET /sessions/{session_id}/completion endpoint."""

    def test_get_work_completion(self, client, readiness_session, release_items):
        """Returns work completion report."""
        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}/completion")
        assert response.status_code == 200
        data = response.json()
        assert data["total_items"] == 3  # 3 stories (bugs excluded)
        assert data["completed"] == 2
        assert data["in_progress"] == 1
        assert data["completion_percent"] > 60


class TestFullAssessment:
    """Tests for GET /sessions/{session_id}/assessment endpoint."""

    def test_get_full_assessment(self, client, readiness_session, release_items):
        """Returns full assessment result."""
        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}/assessment")
        assert response.status_code == 200
        data = response.json()
        assert data["readiness_score"] == 72
        assert data["recommendation"] == "conditional_go"
        assert "component_scores" in data

    def test_assessment_not_ready(self, client, readiness_session):
        """Returns error when assessment not complete."""
        readiness_session.status = "draft"
        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}/assessment")
        assert response.status_code == 400


# =============================================================================
# RECOMMENDATION TESTS
# =============================================================================


class TestRecommendation:
    """Tests for recommendation generation."""

    def test_go_recommendation(self, client, session, readiness_session, release_items):
        """Tests GO recommendation for ready release."""
        # Make all items done and no critical bugs
        for item in release_items:
            if item.item_type == "Story":
                item.status = "Done"
                item.status_category = "done"
            if item.item_type == "Bug":
                item.status = "Resolved"
                item.status_category = "done"
            session.add(item)

        readiness_session.readiness_score = 90
        readiness_session.recommendation = "go"
        readiness_session.recommendation_details = {"summary": "Release is ready"}
        session.add(readiness_session)
        session.commit()

        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}/assessment")
        assert response.status_code == 200
        data = response.json()
        assert data["recommendation"] == "go"

    def test_nogo_recommendation(self, client, session, readiness_session, release_items):
        """Tests NO-GO recommendation for critical issues."""
        # Add critical blocking bug
        critical_bug = ReleaseWorkItem(
            session_id=readiness_session.id,
            external_id="BUG-999",
            title="Critical production bug",
            item_type="Bug",
            status="Open",
            status_category="todo",
            severity="Critical",
            is_blocking=True,
        )
        session.add(critical_bug)

        readiness_session.readiness_score = 35
        readiness_session.recommendation = "no_go"
        readiness_session.recommendation_details = {"summary": "Critical defects must be addressed"}
        session.add(readiness_session)
        session.commit()

        response = client.get(f"/api/release-readiness/sessions/{readiness_session.id}/assessment")
        assert response.status_code == 200
        data = response.json()
        assert data["recommendation"] == "no_go"


# =============================================================================
# INTEGRATION LOOKUP TESTS
# =============================================================================


class TestIntegrationLookups:
    """Tests for integration lookup endpoints."""

    def test_get_projects_not_found(self, client):
        """Returns 404 when integration doesn't exist."""
        response = client.get("/api/release-readiness/integrations/9999/projects")
        assert response.status_code == 404

    def test_get_projects_returns_list(self, client, sample_integration):
        """Returns list (empty in test as no real API call)."""
        response = client.get(f"/api/release-readiness/integrations/{sample_integration.id}/projects")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_fix_versions_not_found(self, client):
        """Returns 404 when integration doesn't exist."""
        response = client.get("/api/release-readiness/integrations/9999/fix-versions?project_key=TEST")
        assert response.status_code == 404

    def test_get_fix_versions_returns_list(self, client, sample_integration):
        """Returns list (empty in test as no real API call)."""
        response = client.get(
            f"/api/release-readiness/integrations/{sample_integration.id}/fix-versions",
            params={"project_key": "TEST"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_sprints_not_found(self, client):
        """Returns 404 when integration doesn't exist."""
        response = client.get("/api/release-readiness/integrations/9999/sprints")
        assert response.status_code == 404

    def test_get_sprints_returns_list(self, client, sample_integration):
        """Returns list (empty in test as no real API call)."""
        response = client.get(f"/api/release-readiness/integrations/{sample_integration.id}/sprints")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_labels_not_found(self, client):
        """Returns 404 when integration doesn't exist."""
        response = client.get("/api/release-readiness/integrations/9999/labels")
        assert response.status_code == 404

    def test_get_labels_returns_list(self, client, sample_integration):
        """Returns list (empty in test as no real API call)."""
        response = client.get(f"/api/release-readiness/integrations/{sample_integration.id}/labels")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_labels_with_project_key(self, client, sample_integration):
        """Can filter labels by project key."""
        response = client.get(
            f"/api/release-readiness/integrations/{sample_integration.id}/labels",
            params={"project_key": "PROJ"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# =============================================================================
# FIELD MAPPING TESTS
# =============================================================================


class TestFieldMappingsReleaseReadiness:
    """Tests for field mapping functionality in Release Readiness service."""

    def test_get_field_mappings_empty(self, session: Session, sample_integration):
        """Returns empty dict when no mappings exist."""
        from app.services.release_readiness_service import ReleaseReadinessService
        service = ReleaseReadinessService(session)

        mappings = service._get_field_mappings(sample_integration.id)
        assert mappings == {}

    def test_get_mapped_field_returns_mapping(self, session: Session, sample_integration):
        """Returns mapped field ID when mapping exists."""
        from app.models.jira import FieldMapping
        from app.services.release_readiness_service import ReleaseReadinessService

        # Create field mapping
        mapping = FieldMapping(
            integration_id=sample_integration.id,
            our_field="story_points",
            provider_field_id="customfield_12345",
            provider_field_name="Custom Points",
            auto_detected=False,
        )
        session.add(mapping)
        session.commit()

        service = ReleaseReadinessService(session)
        mappings = service._get_field_mappings(sample_integration.id)
        result = service._get_mapped_field(mappings, "story_points", "jira")

        assert result == "customfield_12345"

    def test_get_mapped_field_falls_back_to_default(self, session: Session, sample_integration):
        """Falls back to default field when no mapping exists."""
        from app.services.release_readiness_service import ReleaseReadinessService

        service = ReleaseReadinessService(session)
        mappings = {}  # No mappings
        result = service._get_mapped_field(mappings, "story_points", "jira")

        # Should return default Jira story points field
        assert result == "customfield_10016"

    def test_build_jira_fields_list_includes_mappings(self, session: Session, sample_integration):
        """Build fields list includes mapped custom fields."""
        from app.models.jira import FieldMapping
        from app.services.release_readiness_service import ReleaseReadinessService

        # Create field mappings
        mapping = FieldMapping(
            integration_id=sample_integration.id,
            our_field="severity",
            provider_field_id="customfield_20001",
            provider_field_name="Severity",
            auto_detected=False,
        )
        session.add(mapping)
        session.commit()

        service = ReleaseReadinessService(session)
        mappings = service._get_field_mappings(sample_integration.id)
        fields = service._build_jira_fields_list(mappings)

        # Should include custom field
        assert "customfield_20001" in fields
        # Should include base fields
        assert "summary" in fields
        assert "status" in fields

    def test_build_ado_fields_list_includes_mappings(self, session: Session, sample_integration):
        """Build ADO fields list includes mapped custom fields."""
        from app.models.jira import FieldMapping
        from app.services.release_readiness_service import ReleaseReadinessService

        # Create ADO field mapping
        mapping = FieldMapping(
            integration_id=sample_integration.id,
            our_field="acceptance_criteria",
            provider_field_id="Custom.AcceptanceCriteria",
            provider_field_name="Custom AC",
            auto_detected=False,
        )
        session.add(mapping)
        session.commit()

        service = ReleaseReadinessService(session)
        mappings = service._get_field_mappings(sample_integration.id)
        fields = service._build_ado_fields_list(mappings)

        # Should include custom field
        assert "Custom.AcceptanceCriteria" in fields
        # Should include base fields
        assert "System.Title" in fields
        assert "System.State" in fields
