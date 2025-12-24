"""
Tests for Feasibility API Endpoints

Tests the FastAPI endpoints for feasibility analysis workflow.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.models.feasibility import (
    FeasibilitySession,
    TechnicalComponent,
    TimelineScenario,
    RiskAssessment,
    SkillRequirement,
    ActualResult
)


# Set up test database at module level
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SQLModel.metadata.create_all(engine)


def get_test_session():
    """Override session dependency"""
    with Session(engine) as session:
        yield session


# Override dependency and create client
app.dependency_overrides[get_session] = get_test_session
client = TestClient(app)


@pytest.fixture
def clean_db():
    """Clean database before each test"""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


class TestFeasibilityAPI:
    """Test suite for Feasibility API endpoints"""

    @patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline')
    def test_create_session_success(self, mock_pipeline, clean_db):
        """Test creating a new feasibility session"""
        response = client.post(
            "/api/feasibility/sessions",
            json={
                "featureDescription": "Build a real-time collaboration feature allowing multiple users to edit documents simultaneously with conflict resolution",
                "technicalConstraints": "Must integrate with existing authentication system",
                "targetUsers": "Enterprise customers with 10+ team members",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["status"] == "pending"
        assert data["featureDescription"] is not None
        assert "confidenceLevel" in data

    @patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline')
    def test_create_session_validation_min_length(self, mock_pipeline, clean_db):
        """Test validation: feature description too short"""
        response = client.post(
            "/api/feasibility/sessions",
            json={
                "featureDescription": "Too short",  # Less than 100 chars
            },
        )

        assert response.status_code == 422  # Validation error

    @patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline')
    def test_create_session_validation_max_length(self, mock_pipeline, clean_db):
        """Test validation: feature description too long"""
        response = client.post(
            "/api/feasibility/sessions",
            json={
                "featureDescription": "A" * 2001,  # More than 2000 chars
            },
        )

        assert response.status_code == 422  # Validation error

    def test_get_session_status(self, clean_db):
        """Test getting session status for polling"""
        # Create session via API
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline'):
            create_response = client.post(
                "/api/feasibility/sessions",
                json={"featureDescription": "A" * 120},
            )
            session_id = create_response.json()["id"]

        # Get status
        response = client.get(f"/api/feasibility/sessions/{session_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert "progressStep" in data
        assert "progressMessage" in data

    def test_get_session_status_not_found(self, clean_db):
        """Test getting status for non-existent session"""
        response = client.get("/api/feasibility/sessions/999/status")
        assert response.status_code == 404

    def test_get_session_detail(self, clean_db):
        """Test getting full session detail"""
        # Create session via API
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline'):
            create_response = client.post(
                "/api/feasibility/sessions",
                json={"featureDescription": "B" * 120},
            )
            session_id = create_response.json()["id"]

        # Get detail
        response = client.get(f"/api/feasibility/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "components" in data
        assert "scenarios" in data
        assert "risks" in data
        assert "skills" in data

    def test_get_session_detail_not_found(self, clean_db):
        """Test getting detail for non-existent session"""
        response = client.get("/api/feasibility/sessions/999")
        assert response.status_code == 404

    def test_list_sessions(self, clean_db):
        """Test listing all sessions"""
        # Create multiple sessions
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline'):
            client.post("/api/feasibility/sessions", json={"featureDescription": "C" * 120})
            client.post("/api/feasibility/sessions", json={"featureDescription": "D" * 120})

        # List sessions
        response = client.get("/api/feasibility/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all("id" in session for session in data)

    def test_list_sessions_filtered_by_user(self, clean_db):
        """Test listing sessions filtered by user_id"""
        # Create sessions with different user IDs
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline'):
            client.post("/api/feasibility/sessions", json={"featureDescription": "E" * 120, "userId": 1})
            client.post("/api/feasibility/sessions", json={"featureDescription": "F" * 120, "userId": 2})

        # List sessions for user 1
        response = client.get("/api/feasibility/sessions?user_id=1")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["userId"] == 1

    def test_update_component_estimates(self, clean_db):
        """Test updating component estimates"""
        # Create session and component manually
        with Session(engine) as db:
            session_obj = FeasibilitySession(
                feature_description="G" * 120,
                status="completed"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)

            component = TechnicalComponent(
                session_id=session_obj.id,
                component_name="Test Component",
                component_description="Test description",
                technical_category="backend",
                optimistic_hours=10.0,
                realistic_hours=20.0,
                pessimistic_hours=30.0,
                confidence_level="medium",
                display_order=0
            )
            db.add(component)
            db.commit()
            db.refresh(component)
            component_id = component.id

        # Update component
        response = client.patch(
            f"/api/feasibility/components/{component_id}",
            json={
                "optimisticHours": 8.0,
                "realisticHours": 16.0,
                "pessimisticHours": 24.0,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["optimisticHours"] == 8.0
        assert data["realisticHours"] == 16.0
        assert data["pessimisticHours"] == 24.0
        assert data["estimatedByAgent"] is False  # Manually edited

    def test_update_component_not_found(self, clean_db):
        """Test updating non-existent component"""
        response = client.patch(
            "/api/feasibility/components/999",
            json={"realisticHours": 15.0},
        )
        assert response.status_code == 404

    def test_update_component_locked(self, clean_db):
        """Test updating a locked component"""
        # Create locked component
        with Session(engine) as db:
            session_obj = FeasibilitySession(
                feature_description="H" * 120,
                status="completed"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)

            component = TechnicalComponent(
                session_id=session_obj.id,
                component_name="Locked Component",
                component_description="Test",
                technical_category="backend",
                optimistic_hours=10.0,
                realistic_hours=20.0,
                pessimistic_hours=30.0,
                confidence_level="medium",
                is_editable=False,  # Locked
                display_order=0
            )
            db.add(component)
            db.commit()
            db.refresh(component)
            component_id = component.id

        # Try to update
        response = client.patch(
            f"/api/feasibility/components/{component_id}",
            json={"realisticHours": 15.0},
        )
        assert response.status_code == 422  # Validation error

    def test_capture_actuals(self, clean_db):
        """Test capturing actual results for learning"""
        # Create session and components
        with Session(engine) as db:
            session_obj = FeasibilitySession(
                feature_description="I" * 120,
                status="completed"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)

            component1 = TechnicalComponent(
                session_id=session_obj.id,
                component_name="Component 1",
                component_description="Test 1",
                technical_category="backend",
                optimistic_hours=10.0,
                realistic_hours=20.0,
                pessimistic_hours=30.0,
                confidence_level="medium",
                display_order=0
            )
            component2 = TechnicalComponent(
                session_id=session_obj.id,
                component_name="Component 2",
                component_description="Test 2",
                technical_category="frontend",
                optimistic_hours=8.0,
                realistic_hours=15.0,
                pessimistic_hours=25.0,
                confidence_level="high",
                display_order=1
            )
            db.add(component1)
            db.add(component2)
            db.commit()
            db.refresh(component1)
            db.refresh(component2)
            session_id = session_obj.id
            comp1_id = component1.id
            comp2_id = component2.id

        # Capture actuals
        response = client.post(
            f"/api/feasibility/sessions/{session_id}/actuals",
            json={
                "actuals": [
                    {
                        "componentId": comp1_id,
                        "actualHoursSpent": 22.0,
                        "lessonsLearned": "Took longer due to integration complexity"
                    },
                    {
                        "componentId": comp2_id,
                        "actualHoursSpent": 14.0,
                        "lessonsLearned": "Went faster than expected"
                    }
                ],
                "recordedByUserId": 1
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["actualsCount"] == 2

    def test_capture_actuals_session_not_found(self, clean_db):
        """Test capturing actuals for non-existent session"""
        response = client.post(
            "/api/feasibility/sessions/999/actuals",
            json={
                "actuals": [
                    {"componentId": 1, "actualHoursSpent": 10.0}
                ]
            },
        )
        assert response.status_code == 404

    def test_delete_session(self, clean_db):
        """Test deleting a session"""
        # Create session
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline'):
            create_response = client.post(
                "/api/feasibility/sessions",
                json={"featureDescription": "J" * 120},
            )
            session_id = create_response.json()["id"]

        # Delete session
        response = client.delete(f"/api/feasibility/sessions/{session_id}")

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify session is deleted
        get_response = client.get(f"/api/feasibility/sessions/{session_id}")
        assert get_response.status_code == 404

    def test_delete_session_not_found(self, clean_db):
        """Test deleting non-existent session"""
        response = client.delete("/api/feasibility/sessions/999")
        assert response.status_code == 404

    def test_session_workflow_end_to_end(self, clean_db):
        """Test complete workflow: create → poll → retrieve"""
        # Step 1: Create session
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline'):
            create_response = client.post(
                "/api/feasibility/sessions",
                json={
                    "featureDescription": "Build an AI-powered recommendation engine that suggests relevant products based on user browsing history and preferences",
                    "technicalConstraints": "Must support 1M+ users, < 100ms response time",
                },
            )
            assert create_response.status_code == 200
            session_id = create_response.json()["id"]

        # Step 2: Poll status
        status_response = client.get(f"/api/feasibility/sessions/{session_id}/status")
        assert status_response.status_code == 200
        assert status_response.json()["status"] == "pending"

        # Step 3: Retrieve full detail
        detail_response = client.get(f"/api/feasibility/sessions/{session_id}")
        assert detail_response.status_code == 200
        data = detail_response.json()
        assert "session" in data
        assert data["session"]["id"] == session_id

    def test_pii_masking(self, clean_db):
        """Test that PII is masked before sending to API"""
        # Create session with PII in description
        with patch('app.services.feasibility_service.feasibility_service.run_feasibility_pipeline') as mock_pipeline:
            response = client.post(
                "/api/feasibility/sessions",
                json={
                    "featureDescription": "Build a user profile system that stores email@example.com and phone 555-123-4567 for contact purposes. The system should validate credit card 1234-5678-9012-3456.",
                },
            )

            assert response.status_code == 200
            # Note: Actual PII masking is tested at service layer
            # This just ensures the endpoint accepts the data
