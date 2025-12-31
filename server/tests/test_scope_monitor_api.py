"""
Tests for Scope Monitor API Endpoints

Comprehensive tests for scope monitoring workflow including:
- Session CRUD
- Baseline scope integration (from Scope Definition)
- Change detection and analysis
- Impact assessments
- Alerts
"""
import pytest
from contextlib import ExitStack
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.scope_monitor import service
from app.models.scope_monitor import (
    ScopeMonitorSession,
    ScopeChange,
    ImpactAssessment,
    ScopeAlert,
)


class TestScopeMonitorSessionAPI:
    """Tests for session endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'analyze_scope', mock_service.analyze_scope),
            patch.object(service, 'list_sessions', mock_service.list_sessions),
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'delete_session', mock_service.delete_session),
            patch.object(service, 'retry_session', mock_service.retry_session),
            patch.object(service, 'get_changes', mock_service.get_changes),
            patch.object(service, 'get_impact_assessments', mock_service.get_impact_assessments),
            patch.object(service, 'get_alerts', mock_service.get_alerts),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_session_success(self, client, mock_service):
        """Test creating a new scope monitor session"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Customer Portal V2",
            current_requirements="Phase 1 includes user authentication, dashboard, and basic reporting.",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "projectName": "Customer Portal V2",
                "currentRequirements": "Phase 1 includes user authentication, dashboard, and basic reporting. Stakeholder has requested additional export functionality and real-time notifications.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projectName"] == "Customer Portal V2"
        assert data["status"] == "pending"
        assert "id" in data

    def test_create_session_validation_min_length(self, client, mock_service):
        """Test validation: current requirements too short"""
        response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "projectName": "Test",
                "currentRequirements": "Too short",
            },
        )
        assert response.status_code == 422

    def test_create_session_with_baseline_description(self, client, mock_service):
        """Test creating session with custom baseline description"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            baseline_description="Original scope includes: user authentication, dashboard, and basic reporting features.",
            current_requirements="Current state: Authentication complete. Dashboard in progress.",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "projectName": "Test Project",
                "baselineDescription": "Original scope includes: user authentication, dashboard, and basic reporting features. Timeline: 3 months.",
                "currentRequirements": "Current state: Authentication complete. Dashboard in progress. Stakeholder requested analytics dashboard and export features not in original scope.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "baselineDescription" in data

    def test_create_session_with_change_context(self, client, mock_service):
        """Test creating session with change context (threshold)"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            current_requirements="Stakeholder requested additional features.",
            change_context="Change Threshold: high",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "projectName": "Test Project",
                "currentRequirements": "Stakeholder requested additional features: real-time notifications, export to PDF, and integration with third-party analytics.",
                "changeContext": "Change Threshold: high - Flag any deviation from approved scope",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "changeContext" in data

    def test_list_sessions(self, client, mock_service):
        """Test listing scope monitor sessions"""
        mock_sessions = [
            ScopeMonitorSession(id=1, project_name="Project 1", current_requirements="Req 1", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            ScopeMonitorSession(id=2, project_name="Project 2", current_requirements="Req 2", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            ScopeMonitorSession(id=3, project_name="Project 3", current_requirements="Req 3", status="failed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/scope-monitor/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_sessions_with_pagination(self, client, mock_service):
        """Test listing sessions with pagination"""
        mock_sessions = [
            ScopeMonitorSession(id=1, project_name="Project 1", current_requirements="Req 1", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            ScopeMonitorSession(id=2, project_name="Project 2", current_requirements="Req 2", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/scope-monitor/sessions?skip=0&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_session(self, client, mock_service):
        """Test getting a specific session"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            current_requirements="Test requirements",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/scope-monitor/sessions/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["projectName"] == "Test Project"

    def test_get_session_not_found(self, client, mock_service):
        """Test getting non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/scope-monitor/sessions/999")
        assert response.status_code == 404

    def test_get_session_full(self, client, mock_service):
        """Test getting session with all analysis components"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            current_requirements="Test requirements",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_changes = [
            ScopeChange(id=1, session_id=1, title="Change 1", description="Desc", change_type="addition", category="feature", impact_level="medium", is_scope_creep=True, display_order=0, created_at=datetime.utcnow()),
            ScopeChange(id=2, session_id=1, title="Change 2", description="Desc", change_type="modification", category="requirement", impact_level="low", is_scope_creep=False, display_order=1, created_at=datetime.utcnow()),
        ]
        mock_impacts = [ImpactAssessment(id=1, session_id=1, area="timeline", impact_description="Impact", impact_severity="minor_negative", display_order=0, created_at=datetime.utcnow())]
        mock_alerts = [ScopeAlert(id=1, session_id=1, alert_type="scope_creep", severity="warning", title="Alert", description="Alert desc", action_required=True, display_order=0, created_at=datetime.utcnow())]

        mock_service.get_session.return_value = mock_session
        mock_service.get_changes.return_value = mock_changes
        mock_service.get_impact_assessments.return_value = mock_impacts
        mock_service.get_alerts.return_value = mock_alerts

        response = client.get("/api/scope-monitor/sessions/1/full")
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "scope_creep_changes" in data
        assert "other_changes" in data
        assert "impact_assessments" in data
        assert "alerts" in data

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/scope-monitor/sessions/1")
        assert response.status_code == 200

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/scope-monitor/sessions/999")
        assert response.status_code == 404

    def test_retry_session(self, client, mock_service):
        """Test retrying a failed session"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            current_requirements="Test requirements",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.post("/api/scope-monitor/sessions/1/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    def test_retry_session_not_found(self, client, mock_service):
        """Test retrying non-existent session"""
        mock_service.get_session.return_value = None

        response = client.post("/api/scope-monitor/sessions/999/retry")
        assert response.status_code == 404


class TestScopeMonitorDataRetrieval:
    """Tests for retrieving analysis data"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_changes', mock_service.get_changes),
            patch.object(service, 'get_impact_assessments', mock_service.get_impact_assessments),
            patch.object(service, 'get_alerts', mock_service.get_alerts),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_get_changes(self, client, mock_service):
        """Test getting scope changes for a session"""
        mock_changes = [
            ScopeChange(id=1, session_id=1, title="New Export Feature", description="Added export", change_type="addition", category="feature", impact_level="medium", is_scope_creep=True, creep_type="feature_creep", recommendation="defer", display_order=0, created_at=datetime.utcnow()),
            ScopeChange(id=2, session_id=1, title="Performance Optimization", description="Improved performance", change_type="modification", category="requirement", impact_level="low", is_scope_creep=False, recommendation="accept", display_order=1, created_at=datetime.utcnow()),
        ]
        mock_service.get_changes.return_value = mock_changes

        response = client.get("/api/scope-monitor/sessions/1/changes")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        creep_changes = [c for c in data if c["isScopeCreep"]]
        assert len(creep_changes) == 1
        assert creep_changes[0]["title"] == "New Export Feature"

    def test_get_impact_assessments(self, client, mock_service):
        """Test getting impact assessments for a session"""
        mock_impacts = [
            ImpactAssessment(id=1, session_id=1, area="timeline", impact_description="Additional 2 weeks", impact_severity="minor_negative", display_order=0, created_at=datetime.utcnow()),
        ]
        mock_service.get_impact_assessments.return_value = mock_impacts

        response = client.get("/api/scope-monitor/sessions/1/impact-assessments")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["area"] == "timeline"

    def test_get_alerts(self, client, mock_service):
        """Test getting alerts for a session"""
        mock_alerts = [
            ScopeAlert(id=1, session_id=1, alert_type="scope_creep", severity="warning", title="Feature Creep Detected", description="Export feature was not in original scope", action_required=True, display_order=0, created_at=datetime.utcnow()),
        ]
        mock_service.get_alerts.return_value = mock_alerts

        response = client.get("/api/scope-monitor/sessions/1/alerts")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["alertType"] == "scope_creep"
        assert data[0]["actionRequired"] is True

    def test_get_full_session_with_data(self, client, mock_service):
        """Test getting full session includes all analysis data"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            current_requirements="Test requirements",
            status="completed",
            scope_health_score=75,
            creep_risk_level="medium",
            recommendations=["Recommendation 1", "Recommendation 2"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_changes = [
            ScopeChange(id=1, session_id=1, title="Creep Change", description="Desc", change_type="addition", category="feature", impact_level="medium", is_scope_creep=True, display_order=0, created_at=datetime.utcnow()),
            ScopeChange(id=2, session_id=1, title="Other Change", description="Desc", change_type="modification", category="requirement", impact_level="low", is_scope_creep=False, display_order=1, created_at=datetime.utcnow()),
        ]
        mock_impacts = [ImpactAssessment(id=1, session_id=1, area="timeline", impact_description="Impact", impact_severity="minor_negative", display_order=0, created_at=datetime.utcnow())]
        mock_alerts = [ScopeAlert(id=1, session_id=1, alert_type="scope_creep", severity="warning", title="Alert", description="Alert desc", action_required=True, display_order=0, created_at=datetime.utcnow())]

        mock_service.get_session.return_value = mock_session
        mock_service.get_changes.return_value = mock_changes
        mock_service.get_impact_assessments.return_value = mock_impacts
        mock_service.get_alerts.return_value = mock_alerts

        response = client.get("/api/scope-monitor/sessions/1/full")
        assert response.status_code == 200
        data = response.json()

        # Verify session data
        assert data["session"]["scopeHealthScore"] == 75
        assert data["session"]["creepRiskLevel"] == "medium"
        assert len(data["session"]["recommendations"]) == 2

        # Verify scope creep changes are separated
        assert len(data["scope_creep_changes"]) == 1
        assert data["scope_creep_changes"][0]["isScopeCreep"] is True

        # Verify other changes
        assert len(data["other_changes"]) == 1
        assert data["other_changes"][0]["isScopeCreep"] is False

        # Verify impact assessments
        assert len(data["impact_assessments"]) == 1

        # Verify alerts
        assert len(data["alerts"]) == 1


class TestScopeMonitorWithBaseline:
    """Tests for scope monitor with baseline scope ID"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'analyze_scope', mock_service.analyze_scope),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_session_with_baseline_scope_id(self, client, mock_service):
        """Test creating monitor session linked to scope definition"""
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Test Project",
            baseline_scope_id=5,
            baseline_description="Auto-populated from scope definition",
            current_requirements="Current state description",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "projectName": "Test Project",
                "baselineScopeId": 5,
                "currentRequirements": "Authentication complete. Dashboard done. Stakeholder now requesting additional export features and analytics not in original scope.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["baselineScopeId"] == 5
        assert "baselineDescription" in data


class TestScopeMonitorIntegration:
    """Integration tests for complete workflows"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'analyze_scope', mock_service.analyze_scope),
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_changes', mock_service.get_changes),
            patch.object(service, 'get_impact_assessments', mock_service.get_impact_assessments),
            patch.object(service, 'get_alerts', mock_service.get_alerts),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_full_monitoring_workflow(self, client, mock_service):
        """Test complete scope monitoring workflow"""
        # Setup mocks for create
        mock_session = ScopeMonitorSession(
            id=1,
            project_name="Full Workflow Test",
            baseline_description="Original scope",
            current_requirements="Current state",
            change_context="Change Threshold: medium",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        # 1. Create monitor session
        session_response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "projectName": "Full Workflow Test",
                "baselineDescription": "Original scope: User authentication, dashboard, basic reporting. Timeline: 8 weeks. Budget: $40,000.",
                "currentRequirements": "Current state: Auth complete. Dashboard 80% done. Stakeholder requests: export to PDF (new), real-time notifications (new), analytics dashboard (new). These are outside original scope.",
                "changeContext": "Change Threshold: medium - Balanced scope creep detection",
            },
        )
        assert session_response.status_code == 200
        assert session_response.json()["status"] == "pending"

        # Setup mocks for get
        mock_session_completed = ScopeMonitorSession(
            id=1,
            project_name="Full Workflow Test",
            current_requirements="Current state",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session_completed
        mock_service.get_changes.return_value = []
        mock_service.get_impact_assessments.return_value = []
        mock_service.get_alerts.return_value = []

        # 2. Check session status
        status_response = client.get("/api/scope-monitor/sessions/1")
        assert status_response.status_code == 200

        # 3. Get full session data
        full_response = client.get("/api/scope-monitor/sessions/1/full")
        assert full_response.status_code == 200
        data = full_response.json()

        # Verify structure
        assert "session" in data
        assert "scope_creep_changes" in data
        assert "other_changes" in data
        assert "impact_assessments" in data
        assert "alerts" in data

    def test_multiple_threshold_levels(self, client, mock_service):
        """Test sessions with different threshold levels"""
        thresholds = [
            ("low", "Only flag major scope changes"),
            ("medium", "Balanced scope creep detection"),
            ("high", "Flag any deviation from approved scope"),
        ]

        for idx, (threshold, description) in enumerate(thresholds):
            mock_session = ScopeMonitorSession(
                id=idx + 1,
                project_name=f"Test {threshold}",
                current_requirements=f"Requirements for testing {threshold}",
                change_context=f"Change Threshold: {threshold} - {description}",
                status="pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            mock_service.create_session.return_value = mock_session

            response = client.post(
                "/api/scope-monitor/sessions",
                json={
                    "projectName": f"Test {threshold}",
                    "currentRequirements": f"Requirements for testing {threshold} threshold with enough text.",
                    "changeContext": f"Change Threshold: {threshold} - {description}",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["changeContext"] == f"Change Threshold: {threshold} - {description}"
