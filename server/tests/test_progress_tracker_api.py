"""
Tests for Progress & Blocker Tracker API endpoints.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlmodel import Session, select

from app.models.progress_tracker import (
    ProgressTrackerSession,
    TrackedWorkItem,
    TRACKER_TEMPLATES,
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
def ado_integration(session: Session):
    """Create a sample ADO integration."""
    integration = Integration(
        provider="ado",
        name="Test ADO",
        base_url="https://dev.azure.com/test-org",
        auth_type="oauth",
        access_token="test-token",
        refresh_token="test-refresh",
        token_expires_at=datetime.utcnow() + timedelta(hours=1),
        scopes=["vso.work"],
        status="connected",
    )
    session.add(integration)
    session.commit()
    session.refresh(integration)
    return integration


@pytest.fixture
def disconnected_integration(session: Session):
    """Create a disconnected integration."""
    integration = Integration(
        provider="jira",
        name="Disconnected Jira",
        base_url="https://test2.atlassian.net",
        cloud_id="test-cloud-id-2",
        auth_type="oauth",
        access_token="test-token",
        status="error",
        error_message="Token expired",
    )
    session.add(integration)
    session.commit()
    session.refresh(integration)
    return integration


@pytest.fixture
def tracker_session(session: Session, sample_integration: Integration):
    """Create a sample tracker session."""
    tracker_sess = ProgressTrackerSession(
        name="Sprint 1 Tracker",
        integration_id=sample_integration.id,
        template_id="jira_scrum",
        sprint_filter={"sprint_ids": ["Sprint 1"]},
        status="draft",
    )
    session.add(tracker_sess)
    session.commit()
    session.refresh(tracker_sess)
    return tracker_sess


# Alias for backwards compatibility
@pytest.fixture
def sample_session(tracker_session: ProgressTrackerSession):
    """Alias for tracker_session fixture."""
    return tracker_session


@pytest.fixture
def session_with_items(session: Session, tracker_session: ProgressTrackerSession):
    """Create a session with tracked items."""
    items = [
        TrackedWorkItem(
            session_id=tracker_session.id,
            external_id="PROJ-1",
            external_url="https://test.atlassian.net/browse/PROJ-1",
            item_type="story",
            title="Implement feature A",
            status="In Progress",
            status_category="in_progress",
            assignee="John Doe",
            story_points=5,
            blocker_signals={},
            blocker_confidence=0,
            is_blocked=False,
            labels=[],
            links=[],
        ),
        TrackedWorkItem(
            session_id=tracker_session.id,
            external_id="PROJ-2",
            external_url="https://test.atlassian.net/browse/PROJ-2",
            item_type="story",
            title="Blocked story",
            status="Blocked",
            status_category="in_progress",
            assignee="Jane Doe",
            story_points=3,
            blocker_signals={"status_based": 0.95},
            blocker_confidence=95,
            is_blocked=True,
            blocker_reason="Status is 'Blocked'",
            labels=["blocked"],
            links=[],
        ),
        TrackedWorkItem(
            session_id=tracker_session.id,
            external_id="PROJ-3",
            external_url="https://test.atlassian.net/browse/PROJ-3",
            item_type="bug",
            title="Fix bug",
            status="Done",
            status_category="done",
            assignee="John Doe",
            story_points=2,
            blocker_signals={},
            blocker_confidence=0,
            is_blocked=False,
            labels=[],
            links=[],
        ),
    ]
    for item in items:
        session.add(item)

    tracker_session.status = "ready"
    tracker_session.items_synced = 3
    tracker_session.blockers_detected = 1
    tracker_session.last_sync_at = datetime.utcnow()
    session.add(tracker_session)
    session.commit()

    return tracker_session


# =============================================================================
# INTEGRATION CHECK TESTS
# =============================================================================


class TestIntegrationCheck:
    """Tests for /integrations/check endpoint."""

    def test_no_integrations(self, client):
        """Returns message when no integrations exist."""
        response = client.get("/api/progress-tracker/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is False
        assert len(data["integrations"]) == 0
        assert "connect" in data["message"].lower()

    def test_with_connected_jira(self, client, sample_integration):
        """Returns valid when Jira is connected."""
        response = client.get("/api/progress-tracker/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is True
        assert len(data["integrations"]) == 1
        assert data["integrations"][0]["provider"] == "jira"

    def test_with_connected_ado(self, client, ado_integration):
        """Returns valid when ADO is connected."""
        response = client.get("/api/progress-tracker/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is True
        assert data["integrations"][0]["provider"] == "ado"

    def test_ignores_disconnected(self, client, disconnected_integration):
        """Ignores integrations with error status."""
        response = client.get("/api/progress-tracker/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is False

    def test_multiple_integrations(self, client, sample_integration, ado_integration):
        """Returns all connected integrations."""
        response = client.get("/api/progress-tracker/integrations/check")
        assert response.status_code == 200
        data = response.json()
        assert data["has_valid_integration"] is True
        assert len(data["integrations"]) == 2


# =============================================================================
# TEMPLATE TESTS
# =============================================================================


class TestTemplates:
    """Tests for /templates endpoint."""

    def test_list_all_templates(self, client):
        """Returns all available templates."""
        response = client.get("/api/progress-tracker/templates")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == len(TRACKER_TEMPLATES)

        # Verify template structure
        for template in data:
            assert "id" in template
            assert "name" in template
            assert "description" in template
            assert "provider" in template
            assert "blocker_signals" in template

    def test_filter_by_jira(self, client):
        """Filters templates by Jira provider."""
        response = client.get("/api/progress-tracker/templates?provider=jira")
        assert response.status_code == 200
        data = response.json()
        for template in data:
            assert template["provider"] in ["jira", "any"]

    def test_filter_by_ado(self, client):
        """Filters templates by ADO provider."""
        response = client.get("/api/progress-tracker/templates?provider=ado")
        assert response.status_code == 200
        data = response.json()
        for template in data:
            assert template["provider"] in ["ado", "any"]


# =============================================================================
# SESSION CRUD TESTS
# =============================================================================


class TestCreateSession:
    """Tests for POST /sessions endpoint."""

    def test_create_session(self, client, sample_integration):
        """Creates a new tracker session."""
        response = client.post(
            "/api/progress-tracker/sessions",
            json={
                "name": "My Sprint Tracker",
                "integration_id": sample_integration.id,
                "template_id": "jira_scrum",
                "sprint_filter": {"sprint_ids": ["Sprint 1"]},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "My Sprint Tracker"
        assert data["integration_id"] == sample_integration.id
        assert data["template_id"] == "jira_scrum"
        assert data["status"] == "draft"
        assert data["integration_name"] == "Test Jira"
        assert data["integration_provider"] == "jira"

    def test_create_with_defaults(self, client, sample_integration):
        """Creates session with default values."""
        response = client.post(
            "/api/progress-tracker/sessions",
            json={"integration_id": sample_integration.id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Sprint Tracker"
        assert data["template_id"] == "basic"

    def test_create_with_invalid_integration(self, client):
        """Fails when integration doesn't exist."""
        response = client.post(
            "/api/progress-tracker/sessions",
            json={"integration_id": 9999},
        )
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()

    def test_create_with_disconnected_integration(self, client, disconnected_integration):
        """Fails when integration is not connected."""
        response = client.post(
            "/api/progress-tracker/sessions",
            json={"integration_id": disconnected_integration.id},
        )
        assert response.status_code == 400
        assert "not connected" in response.json()["detail"].lower()

    def test_create_with_invalid_template(self, client, sample_integration):
        """Fails when template doesn't exist."""
        response = client.post(
            "/api/progress-tracker/sessions",
            json={
                "integration_id": sample_integration.id,
                "template_id": "nonexistent",
            },
        )
        assert response.status_code == 400
        assert "template" in response.json()["detail"].lower()


class TestListSessions:
    """Tests for GET /sessions endpoint."""

    def test_list_empty(self, client):
        """Returns empty list when no sessions exist."""
        response = client.get("/api/progress-tracker/sessions")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_sessions(self, client, sample_session):
        """Returns all sessions."""
        response = client.get("/api/progress-tracker/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == sample_session.id

    def test_list_includes_integration_details(self, client, sample_session):
        """Sessions include integration name and provider."""
        response = client.get("/api/progress-tracker/sessions")
        assert response.status_code == 200
        data = response.json()
        assert data[0]["integration_name"] == "Test Jira"
        assert data[0]["integration_provider"] == "jira"


class TestGetSession:
    """Tests for GET /sessions/{id} endpoint."""

    def test_get_session(self, client, sample_session):
        """Returns session details."""
        response = client.get(f"/api/progress-tracker/sessions/{sample_session.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_session.id
        assert data["name"] == "Sprint 1 Tracker"

    def test_get_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.get("/api/progress-tracker/sessions/9999")
        assert response.status_code == 404


class TestUpdateSession:
    """Tests for PATCH /sessions/{id} endpoint."""

    def test_update_name(self, client, sample_session):
        """Updates session name."""
        response = client.patch(
            f"/api/progress-tracker/sessions/{sample_session.id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_template(self, client, sample_session):
        """Updates session template."""
        response = client.patch(
            f"/api/progress-tracker/sessions/{sample_session.id}",
            json={"template_id": "basic"},
        )
        assert response.status_code == 200
        assert response.json()["template_id"] == "basic"

    def test_update_invalid_template(self, client, sample_session):
        """Fails when updating to invalid template."""
        response = client.patch(
            f"/api/progress-tracker/sessions/{sample_session.id}",
            json={"template_id": "nonexistent"},
        )
        assert response.status_code == 400

    def test_update_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.patch(
            "/api/progress-tracker/sessions/9999",
            json={"name": "Test"},
        )
        assert response.status_code == 404


class TestDeleteSession:
    """Tests for DELETE /sessions/{id} endpoint."""

    def test_delete_session(self, client, sample_session, session: Session):
        """Deletes session and its items."""
        session_id = sample_session.id
        response = client.delete(f"/api/progress-tracker/sessions/{session_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deletion
        assert session.get(ProgressTrackerSession, session_id) is None

    def test_delete_cascades_items(self, client, session_with_items, session: Session):
        """Deleting session also deletes tracked items."""
        session_id = session_with_items.id

        # Verify items exist before deletion
        items = session.exec(
            select(TrackedWorkItem).where(TrackedWorkItem.session_id == session_id)
        ).all()
        assert len(items) == 3

        response = client.delete(f"/api/progress-tracker/sessions/{session_id}")
        assert response.status_code == 200

        # Verify items deleted
        items = session.exec(
            select(TrackedWorkItem).where(TrackedWorkItem.session_id == session_id)
        ).all()
        assert len(items) == 0

    def test_delete_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.delete("/api/progress-tracker/sessions/9999")
        assert response.status_code == 404


# =============================================================================
# METRICS & BLOCKERS TESTS
# =============================================================================


class TestGetMetrics:
    """Tests for GET /sessions/{id}/metrics endpoint."""

    def test_get_metrics_empty_session(self, client, sample_session):
        """Returns zero metrics for empty session."""
        response = client.get(f"/api/progress-tracker/sessions/{sample_session.id}/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_items"] == 0
        assert data["items_todo"] == 0
        assert data["items_in_progress"] == 0
        assert data["items_done"] == 0

    def test_get_metrics_with_items(self, client, session_with_items):
        """Returns computed metrics for session with items."""
        response = client.get(f"/api/progress-tracker/sessions/{session_with_items.id}/metrics")
        assert response.status_code == 200
        data = response.json()

        assert data["total_items"] == 3
        assert data["items_in_progress"] == 2  # PROJ-1 and PROJ-2
        assert data["items_done"] == 1  # PROJ-3
        assert data["total_points"] == 10  # 5 + 3 + 2
        assert data["blocked_items"] == 1
        assert data["blocked_points"] == 3

    def test_get_metrics_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.get("/api/progress-tracker/sessions/9999/metrics")
        assert response.status_code == 404


class TestGetBlockers:
    """Tests for GET /sessions/{id}/blockers endpoint."""

    def test_get_blockers_empty(self, client, sample_session):
        """Returns empty list for session with no blockers."""
        response = client.get(f"/api/progress-tracker/sessions/{sample_session.id}/blockers")
        assert response.status_code == 200
        data = response.json()
        assert data["total_blockers"] == 0
        assert data["blockers"] == []

    def test_get_blockers_with_items(self, client, session_with_items):
        """Returns blocked items sorted by confidence."""
        response = client.get(f"/api/progress-tracker/sessions/{session_with_items.id}/blockers")
        assert response.status_code == 200
        data = response.json()

        assert data["total_blockers"] == 1
        assert data["high_confidence_blockers"] == 1  # 95% confidence
        assert data["blocked_points"] == 3

        blocker = data["blockers"][0]
        assert blocker["external_id"] == "PROJ-2"
        assert blocker["blocker_confidence"] == 95
        assert "status" in blocker["blocker_reason"].lower()

    def test_get_blockers_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.get("/api/progress-tracker/sessions/9999/blockers")
        assert response.status_code == 404


# =============================================================================
# ITEMS TESTS
# =============================================================================


class TestGetItems:
    """Tests for GET /sessions/{id}/items endpoint."""

    def test_get_all_items(self, client, session_with_items):
        """Returns all tracked items."""
        response = client.get(f"/api/progress-tracker/sessions/{session_with_items.id}/items")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_filter_by_status_category(self, client, session_with_items):
        """Filters items by status category."""
        response = client.get(
            f"/api/progress-tracker/sessions/{session_with_items.id}/items?status_category=done"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["external_id"] == "PROJ-3"

    def test_filter_blocked_items(self, client, session_with_items):
        """Filters blocked items."""
        response = client.get(
            f"/api/progress-tracker/sessions/{session_with_items.id}/items?is_blocked=true"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["external_id"] == "PROJ-2"

    def test_get_items_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.get("/api/progress-tracker/sessions/9999/items")
        assert response.status_code == 404


# =============================================================================
# SYNC TESTS
# =============================================================================


class TestSyncSession:
    """Tests for POST /sessions/{id}/sync endpoint."""

    def test_sync_status_endpoint(self, client, sample_session):
        """Get sync status returns current progress."""
        response = client.get(
            f"/api/progress-tracker/sessions/{sample_session.id}/status"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "draft"
        assert data["progress_step"] == 0


# =============================================================================
# BLOCKER CONFIG TESTS
# =============================================================================


class TestBlockerConfig:
    """Tests for PUT /sessions/{id}/blocker-config endpoint."""

    def test_update_blocker_config(self, client, sample_session):
        """Updates blocker detection configuration."""
        new_config = {
            "status_based": {"enabled": True, "weight": 0.9, "statuses": ["Blocked"]},
            "label_based": {"enabled": False},
        }
        response = client.put(
            f"/api/progress-tracker/sessions/{sample_session.id}/blocker-config",
            json=new_config,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["blocker_config"] == new_config

    def test_update_blocker_config_not_found(self, client):
        """Returns 404 when session doesn't exist."""
        response = client.put(
            "/api/progress-tracker/sessions/9999/blocker-config",
            json={},
        )
        assert response.status_code == 404


# =============================================================================
# SPRINTS ENDPOINT TESTS
# =============================================================================


class TestGetSprints:
    """Tests for GET /integrations/{id}/sprints endpoint."""

    def test_get_sprints_not_found(self, client):
        """Returns 404 when integration doesn't exist."""
        response = client.get(
            "/api/progress-tracker/integrations/9999/sprints"
        )
        assert response.status_code == 404


# =============================================================================
# BLOCKER DETECTION TESTS
# =============================================================================


class TestBlockerDetection:
    """Tests for blocker detection logic."""

    def test_status_based_detection(self, session: Session, sample_session):
        """Detects blockers based on status."""
        item = TrackedWorkItem(
            session_id=sample_session.id,
            external_id="TEST-1",
            item_type="story",
            title="Blocked item",
            status="Blocked",
            status_category="in_progress",
            labels=[],
            links=[],
            raw_data={},
        )

        from app.services.progress_tracker_service import ProgressTrackerService
        service = ProgressTrackerService(session)
        blocker_config = TRACKER_TEMPLATES["jira_scrum"]["blocker_signals"]

        item = service._detect_blockers(item, blocker_config)

        assert item.is_blocked is True
        assert item.blocker_confidence >= 90
        assert "status_based" in item.blocker_signals

    def test_label_based_detection(self, session: Session, sample_session):
        """Detects blockers based on labels."""
        item = TrackedWorkItem(
            session_id=sample_session.id,
            external_id="TEST-2",
            item_type="story",
            title="Item with blocker label",
            status="In Progress",
            status_category="in_progress",
            labels=["blocked", "urgent"],
            links=[],
            raw_data={},
        )

        from app.services.progress_tracker_service import ProgressTrackerService
        service = ProgressTrackerService(session)
        blocker_config = TRACKER_TEMPLATES["jira_scrum"]["blocker_signals"]

        item = service._detect_blockers(item, blocker_config)

        assert item.is_blocked is True
        assert "label_based" in item.blocker_signals

    def test_keyword_analysis_detection(self, session: Session, sample_session):
        """Detects blockers based on keywords in title/description."""
        item = TrackedWorkItem(
            session_id=sample_session.id,
            external_id="TEST-3",
            item_type="story",
            title="Feature blocked by API team",
            description="We can't proceed until the API is ready",
            status="In Progress",
            status_category="in_progress",
            labels=[],
            links=[],
            raw_data={},
        )

        from app.services.progress_tracker_service import ProgressTrackerService
        service = ProgressTrackerService(session)
        blocker_config = TRACKER_TEMPLATES["jira_scrum"]["blocker_signals"]

        item = service._detect_blockers(item, blocker_config)

        assert item.is_blocked is True
        assert "keyword_analysis" in item.blocker_signals

    def test_velocity_anomaly_detection(self, session: Session, sample_session):
        """Detects blockers based on stale items."""
        item = TrackedWorkItem(
            session_id=sample_session.id,
            external_id="TEST-4",
            item_type="story",
            title="Stale item",
            status="In Progress",
            status_category="in_progress",
            days_in_status=10,  # > 5 days threshold
            labels=[],
            links=[],
            raw_data={},
        )

        from app.services.progress_tracker_service import ProgressTrackerService
        service = ProgressTrackerService(session)
        blocker_config = TRACKER_TEMPLATES["jira_scrum"]["blocker_signals"]

        item = service._detect_blockers(item, blocker_config)

        assert item.is_blocked is True
        assert "velocity_anomaly" in item.blocker_signals

    def test_no_blockers_detected(self, session: Session, sample_session):
        """Does not flag items without blocker signals."""
        item = TrackedWorkItem(
            session_id=sample_session.id,
            external_id="TEST-5",
            item_type="story",
            title="Normal item",
            status="In Progress",
            status_category="in_progress",
            days_in_status=1,
            labels=[],
            links=[],
            raw_data={},
        )

        from app.services.progress_tracker_service import ProgressTrackerService
        service = ProgressTrackerService(session)
        blocker_config = TRACKER_TEMPLATES["jira_scrum"]["blocker_signals"]

        item = service._detect_blockers(item, blocker_config)

        assert item.is_blocked is False
        assert item.blocker_confidence == 0

    def test_explicit_flag_detection(self, session: Session, sample_session):
        """Detects blockers based on explicit flag field."""
        item = TrackedWorkItem(
            session_id=sample_session.id,
            external_id="TEST-6",
            item_type="story",
            title="Flagged item",
            status="In Progress",
            status_category="in_progress",
            labels=[],
            links=[],
            raw_data={"fields": {"flagged": True}},
        )

        from app.services.progress_tracker_service import ProgressTrackerService
        service = ProgressTrackerService(session)
        blocker_config = TRACKER_TEMPLATES["jira_scrum"]["blocker_signals"]

        item = service._detect_blockers(item, blocker_config)

        assert item.is_blocked is True
        assert item.blocker_confidence == 100  # Weight 1.0 * 100
        assert "explicit_flag" in item.blocker_signals
