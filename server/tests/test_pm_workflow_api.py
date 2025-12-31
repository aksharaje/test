"""
Comprehensive tests for PM Workflow API endpoints.

Tests for:
- Goal Setting
- OKR Generator
- KPI Assignment
- Measurement Framework
- Scope Definition
- Scope Monitor
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.api.deps import get_db


# Create in-memory database for testing
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_db] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


# ==================== GOAL SETTING TESTS ====================

class TestGoalSettingAPI:
    """Tests for Goal Setting endpoints."""

    def test_create_session(self, client: TestClient):
        """Test creating a new goal setting session."""
        response = client.post(
            "/api/goal-setting/sessions",
            json={
                "domain": "Onboarding + Authentication",
                "strategy": "Increase user activation and reduce churn",
                "teamCharter": "Enable seamless user onboarding",
                "problemStatements": "Users drop off during signup",
                "baselines": "Current activation rate: 40%",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["domain"] == "Onboarding + Authentication"
        assert data["strategy"] == "Increase user activation and reduce churn"
        assert data["status"] == "pending"

    def test_list_sessions(self, client: TestClient):
        """Test listing goal setting sessions."""
        # Create a session first
        client.post(
            "/api/goal-setting/sessions",
            json={
                "domain": "Test Domain",
                "strategy": "Test Strategy",
            },
        )
        response = client.get("/api/goal-setting/sessions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_session(self, client: TestClient):
        """Test getting a specific session."""
        # Create first
        create_response = client.post(
            "/api/goal-setting/sessions",
            json={
                "domain": "Test Domain",
                "strategy": "Test Strategy",
            },
        )
        session_id = create_response.json()["id"]

        # Get
        response = client.get(f"/api/goal-setting/sessions/{session_id}")
        assert response.status_code == 200
        assert response.json()["id"] == session_id

    def test_delete_session(self, client: TestClient):
        """Test deleting a session."""
        # Create first
        create_response = client.post(
            "/api/goal-setting/sessions",
            json={
                "domain": "Test Domain",
                "strategy": "Test Strategy",
            },
        )
        session_id = create_response.json()["id"]

        # Delete
        response = client.delete(f"/api/goal-setting/sessions/{session_id}")
        assert response.status_code == 200

        # Verify deleted
        get_response = client.get(f"/api/goal-setting/sessions/{session_id}")
        assert get_response.status_code == 404


# ==================== OKR GENERATOR TESTS ====================

class TestOkrGeneratorAPI:
    """Tests for OKR Generator endpoints."""

    def test_create_session(self, client: TestClient):
        """Test creating a new OKR session."""
        response = client.post(
            "/api/okr-generator/sessions",
            json={
                "goal_description": "Improve user activation from 40% to 55% by enhancing the onboarding experience",
                "timeframe": "Q2 2025",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "activat" in data["goalDescription"].lower()
        assert data["timeframe"] == "Q2 2025"
        assert data["status"] == "pending"

    def test_list_sessions(self, client: TestClient):
        """Test listing OKR sessions."""
        response = client.get("/api/okr-generator/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_session_not_found(self, client: TestClient):
        """Test getting non-existent session."""
        response = client.get("/api/okr-generator/sessions/99999")
        assert response.status_code == 404


# ==================== KPI ASSIGNMENT TESTS ====================

class TestKpiAssignmentAPI:
    """Tests for KPI Assignment endpoints."""

    def test_list_sessions(self, client: TestClient):
        """Test listing KPI assignment sessions."""
        response = client.get("/api/kpi-assignment/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_session_without_okr(self, client: TestClient):
        """Test creating KPI session without valid OKR session fails."""
        response = client.post(
            "/api/kpi-assignment/sessions",
            json={"okr_session_id": 99999},
        )
        # Should fail because OKR session doesn't exist
        assert response.status_code == 400


# ==================== MEASUREMENT FRAMEWORK TESTS ====================

class TestMeasurementFrameworkAPI:
    """Tests for Measurement Framework endpoints."""

    def test_create_session(self, client: TestClient):
        """Test creating a new measurement framework session."""
        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "Login Metrics Framework",
                "objectives_description": "Track and measure login success rate, authentication latency, and support ticket volume to improve user activation.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Login Metrics Framework"
        assert data["status"] == "pending"

    def test_list_sessions(self, client: TestClient):
        """Test listing measurement framework sessions."""
        response = client.get("/api/measurement-framework/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ==================== SCOPE DEFINITION TESTS ====================

class TestScopeDefinitionAPI:
    """Tests for Scope Definition endpoints."""

    def test_create_session(self, client: TestClient):
        """Test creating a new scope definition session."""
        response = client.post(
            "/api/scope-definition/sessions",
            json={
                "project_name": "Customer Portal V2",
                "product_vision": "Build a self-service portal that allows customers to manage their accounts, view usage, and resolve issues without contacting support. This will reduce support costs and improve customer satisfaction.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projectName"] == "Customer Portal V2"
        assert data["status"] == "pending"

    def test_create_session_validation(self, client: TestClient):
        """Test validation for minimum vision length."""
        response = client.post(
            "/api/scope-definition/sessions",
            json={
                "project_name": "Test",
                "product_vision": "Too short",  # Less than 50 chars
            },
        )
        assert response.status_code == 422  # Validation error

    def test_list_sessions(self, client: TestClient):
        """Test listing scope definition sessions."""
        response = client.get("/api/scope-definition/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ==================== SCOPE MONITOR TESTS ====================

class TestScopeMonitorAPI:
    """Tests for Scope Monitor endpoints."""

    def test_create_session(self, client: TestClient):
        """Test creating a new scope monitor session."""
        response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "project_name": "Customer Portal V2",
                "current_requirements": "Phase 1 includes user authentication, dashboard, and basic reporting. We have completed authentication and dashboard. Now working on reporting module. Stakeholders requested additional export functionality.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projectName"] == "Customer Portal V2"
        assert data["status"] == "pending"

    def test_list_sessions(self, client: TestClient):
        """Test listing scope monitor sessions."""
        response = client.get("/api/scope-monitor/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ==================== INTEGRATION TESTS ====================

class TestWorkflowIntegration:
    """Integration tests for the full PM workflow."""

    def test_goal_to_okr_flow(self, client: TestClient):
        """Test the flow from goal setting to OKR generation."""
        # Create goal setting session
        goal_response = client.post(
            "/api/goal-setting/sessions",
            json={
                "domain": "Onboarding + Authentication",
                "strategy": "Improve activation and reduce support load",
            },
        )
        assert goal_response.status_code == 200
        goal_session = goal_response.json()

        # Create OKR session based on goals
        okr_response = client.post(
            "/api/okr-generator/sessions",
            json={
                "goal_description": f"Based on goals from session {goal_session['id']}: Improve user activation rate from 40% to 55% by enhancing onboarding",
                "timeframe": "Q2 2025",
            },
        )
        assert okr_response.status_code == 200
        okr_session = okr_response.json()
        assert okr_session["status"] == "pending"

    def test_scope_definition_to_monitor_flow(self, client: TestClient):
        """Test the flow from scope definition to monitoring."""
        # Create scope definition
        scope_response = client.post(
            "/api/scope-definition/sessions",
            json={
                "project_name": "Test Project",
                "product_vision": "A comprehensive test project that demonstrates the full workflow from scope definition to monitoring and change management.",
            },
        )
        assert scope_response.status_code == 200
        scope_session = scope_response.json()

        # Create scope monitor linking to scope definition
        monitor_response = client.post(
            "/api/scope-monitor/sessions",
            json={
                "project_name": scope_session["projectName"],
                "baseline_scope_id": scope_session["id"],
                "current_requirements": "The project is in Phase 2. We have added several features beyond the original scope including advanced analytics and custom reporting.",
            },
        )
        assert monitor_response.status_code == 200
