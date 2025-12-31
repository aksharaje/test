"""
Unit tests for PM Workflow services.

Tests service layer logic without external dependencies.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.services.goal_setting_service import GoalSettingService
from app.services.okr_generator_service import OkrGeneratorService
from app.services.kpi_assignment_service import KpiAssignmentService
from app.services.measurement_framework_service import MeasurementFrameworkService
from app.services.scope_definition_service import ScopeDefinitionService
from app.services.scope_monitor_service import ScopeMonitorService

from app.models.goal_setting import GoalSettingSession, GoalSettingSessionCreate, Goal
from app.models.okr_generator import OkrSession, OkrSessionCreate, Objective, KeyResult
from app.models.kpi_assignment import KpiAssignmentSession, KpiAssignmentSessionCreate, KpiAssignment


@pytest.fixture(name="db")
def db_fixture():
    """Create an in-memory database session for testing."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


# ==================== GOAL SETTING SERVICE TESTS ====================

class TestGoalSettingService:
    """Tests for GoalSettingService."""

    def test_create_session(self, db: Session):
        """Test session creation."""
        service = GoalSettingService()
        data = GoalSettingSessionCreate(
            domain="Test Domain",
            strategy="Test Strategy",
            team_charter="Test Charter",
        )
        session = service.create_session(db, data)
        assert session.id is not None
        assert session.domain == "Test Domain"
        assert session.strategy == "Test Strategy"
        assert session.status == "pending"

    def test_get_session(self, db: Session):
        """Test getting a session by ID."""
        service = GoalSettingService()
        # Create first
        data = GoalSettingSessionCreate(
            domain="Test Domain",
            strategy="Test Strategy",
        )
        created = service.create_session(db, data)

        # Get
        retrieved = service.get_session(db, created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    def test_list_sessions(self, db: Session):
        """Test listing sessions with pagination."""
        service = GoalSettingService()
        # Create multiple sessions
        for i in range(5):
            service.create_session(db, GoalSettingSessionCreate(
                domain=f"Domain {i}",
                strategy=f"Strategy {i}",
            ))

        # List with pagination
        sessions = service.list_sessions(db, skip=0, limit=3)
        assert len(sessions) == 3

    def test_delete_session(self, db: Session):
        """Test deleting a session."""
        service = GoalSettingService()
        data = GoalSettingSessionCreate(
            domain="To Delete",
            strategy="Test",
        )
        session = service.create_session(db, data)
        session_id = session.id

        result = service.delete_session(db, session_id)
        assert result is True

        # Verify deleted
        retrieved = service.get_session(db, session_id)
        assert retrieved is None

    def test_parse_llm_json(self, db: Session):
        """Test robust JSON parsing."""
        service = GoalSettingService()

        # Test with markdown code fence
        content = '```json\n{"key": "value"}\n```'
        result = service._parse_llm_json(content, "Test")
        assert result == {"key": "value"}

        # Test with plain JSON
        content = '{"key": "value"}'
        result = service._parse_llm_json(content, "Test")
        assert result == {"key": "value"}

        # Test with leading text
        content = 'Here is the JSON:\n{"key": "value"}'
        result = service._parse_llm_json(content, "Test")
        assert result == {"key": "value"}

    def test_parse_llm_json_error(self, db: Session):
        """Test JSON parsing error handling."""
        service = GoalSettingService()

        # Empty content
        with pytest.raises(ValueError, match="Empty response"):
            service._parse_llm_json("", "Test")

        # No JSON found
        with pytest.raises(ValueError, match="No JSON"):
            service._parse_llm_json("Just plain text", "Test")


# ==================== OKR GENERATOR SERVICE TESTS ====================

class TestOkrGeneratorService:
    """Tests for OkrGeneratorService."""

    def test_create_session(self, db: Session):
        """Test OKR session creation."""
        service = OkrGeneratorService()
        data = OkrSessionCreate(
            goal_description="Improve user activation rate from 40% to 55% by improving onboarding flow",
            timeframe="Q2 2025",
        )
        session = service.create_session(db, data)
        assert session.id is not None
        assert session.status == "pending"

    def test_get_session(self, db: Session):
        """Test getting an OKR session."""
        service = OkrGeneratorService()
        data = OkrSessionCreate(
            goal_description="Improve user activation rate from 40% to 55% by improving onboarding flow",
            timeframe="Q1",
        )
        created = service.create_session(db, data)
        retrieved = service.get_session(db, created.id)
        assert retrieved is not None
        assert "activation" in retrieved.goal_description


# ==================== KPI ASSIGNMENT SERVICE TESTS ====================

class TestKpiAssignmentService:
    """Tests for KpiAssignmentService."""

    def test_list_sessions(self, db: Session):
        """Test listing KPI assignment sessions."""
        service = KpiAssignmentService()
        sessions = service.list_sessions(db)
        assert isinstance(sessions, list)

    def test_get_session_not_found(self, db: Session):
        """Test getting non-existent session."""
        service = KpiAssignmentService()
        session = service.get_session(db, 99999)
        assert session is None


# ==================== MEASUREMENT FRAMEWORK SERVICE TESTS ====================

class TestMeasurementFrameworkService:
    """Tests for MeasurementFrameworkService."""

    def test_create_session(self, db: Session):
        """Test session creation."""
        service = MeasurementFrameworkService()
        from app.models.measurement_framework import MeasurementFrameworkSessionCreate

        data = MeasurementFrameworkSessionCreate(
            name="Login Metrics Framework",
            objectives_description="Track and measure login success rate, authentication latency, and support ticket volume to improve user activation.",
        )
        session = service.create_session(db, data)
        assert session.id is not None
        assert session.name == "Login Metrics Framework"


# ==================== SCOPE DEFINITION SERVICE TESTS ====================

class TestScopeDefinitionService:
    """Tests for ScopeDefinitionService."""

    def test_create_session(self, db: Session):
        """Test session creation."""
        service = ScopeDefinitionService()
        from app.models.scope_definition import ScopeDefinitionSessionCreate

        data = ScopeDefinitionSessionCreate(
            project_name="Test Project",
            product_vision="A" * 60,  # Min 50 chars
        )
        session = service.create_session(db, data)
        assert session.id is not None
        assert session.project_name == "Test Project"


# ==================== SCOPE MONITOR SERVICE TESTS ====================

class TestScopeMonitorService:
    """Tests for ScopeMonitorService."""

    def test_create_session(self, db: Session):
        """Test session creation."""
        service = ScopeMonitorService()
        from app.models.scope_monitor import ScopeMonitorSessionCreate

        data = ScopeMonitorSessionCreate(
            project_name="Test Project",
            current_requirements="A" * 60,  # Min 50 chars
        )
        session = service.create_session(db, data)
        assert session.id is not None
        assert session.status == "pending"


# ==================== INTEGRATION TESTS ====================

class TestServiceIntegration:
    """Integration tests across services."""

    def test_goal_to_okr_data_flow(self, db: Session):
        """Test data flow from Goal Setting to OKR Generator."""
        goal_service = GoalSettingService()
        okr_service = OkrGeneratorService()

        # Create goal setting session
        goal_session = goal_service.create_session(db, GoalSettingSessionCreate(
            domain="Onboarding",
            strategy="Improve activation rate from 40% to 55%",
            problem_statements="Users drop off during signup",
        ))

        # Create OKR session based on goals
        okr_session = okr_service.create_session(db, OkrSessionCreate(
            goal_description=f"Based on goal session {goal_session.id}: Improve user activation rate from 40% to 55% by enhancing the onboarding experience.",
            timeframe="Q2 2025",
        ))

        assert okr_session.id is not None
        assert "activation" in okr_session.goal_description
