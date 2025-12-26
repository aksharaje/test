"""
Tests for Journey Mapper API Endpoints

Tests the FastAPI endpoints for customer journey mapping workflow.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.models.journey_mapper import (
    JourneyMapSession,
    JourneyPainPoint,
    JourneyPersona,
    JourneyDivergencePoint,
    CompetitorJourneyObservation
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


class TestJourneyMapperAPI:
    """Test suite for Journey Mapper API endpoints"""

    @patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline')
    def test_create_session_standard_mode(self, mock_pipeline, clean_db):
        """Test creating a standard journey mapping session"""
        response = client.post(
            "/api/journey-mapper/sessions",
            data={
                "mode": "standard",
                "journeyDescription": "User onboarding flow for new enterprise customers including initial setup and training",
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["status"] == "pending"
        assert data["mode"] == "standard"
        assert "onboarding" in data["journeyDescription"].lower()

    @patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline')
    def test_create_session_with_knowledge_bases(self, mock_pipeline, clean_db):
        """Test creating session with knowledge base context"""
        response = client.post(
            "/api/journey-mapper/sessions",
            data={
                "mode": "standard",
                "journeyDescription": "Customer support escalation journey from initial contact to resolution",
                "knowledgeBaseIds": "[1, 2]"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["knowledgeBaseIds"] == [1, 2]

    @patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline')
    def test_create_session_multi_persona_mode(self, mock_pipeline, clean_db):
        """Test creating multi-persona journey mapping session"""
        response = client.post(
            "/api/journey-mapper/sessions",
            data={
                "mode": "multi_persona",
                "journeyDescription": "Product evaluation journey for B2B software purchase decision",
                "personas": '[{"name": "IT Admin", "description": "Technical decision maker"}, {"name": "End User", "description": "Daily user of the product"}]'
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "multi_persona"

    def test_create_session_competitive_mode_no_background_task(self, clean_db):
        """Test competitive mode doesn't trigger generation until observations added"""
        response = client.post(
            "/api/journey-mapper/sessions",
            data={
                "mode": "competitive",
                "journeyDescription": "Competitor checkout flow analysis for Stripe vs PayPal",
                "competitorName": "Stripe"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "competitive"
        assert data["competitorName"] == "Stripe"

    def test_create_session_validation_short_description(self, clean_db):
        """Test validation: journey description too short"""
        response = client.post(
            "/api/journey-mapper/sessions",
            data={
                "mode": "standard",
                "journeyDescription": "Ab",  # Less than 5 chars
            }
        )

        assert response.status_code == 422  # Validation error

    def test_get_session_status(self, clean_db):
        """Test getting session status for polling"""
        with patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline'):
            create_response = client.post(
                "/api/journey-mapper/sessions",
                data={
                    "mode": "standard",
                    "journeyDescription": "Test journey for status polling verification test",
                }
            )
            session_id = create_response.json()["id"]

        response = client.get(f"/api/journey-mapper/sessions/{session_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert "progressStep" in data
        assert "progressMessage" in data

    def test_get_session_status_not_found(self, clean_db):
        """Test getting status for non-existent session"""
        response = client.get("/api/journey-mapper/sessions/99999/status")
        assert response.status_code == 404

    def test_get_session_detail(self, clean_db):
        """Test getting full session detail"""
        with patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline'):
            create_response = client.post(
                "/api/journey-mapper/sessions",
                data={
                    "mode": "standard",
                    "journeyDescription": "Detailed test journey for retrieving full session data",
                }
            )
            session_id = create_response.json()["id"]

        response = client.get(f"/api/journey-mapper/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "painPoints" in data
        assert "personas" in data

    def test_get_session_detail_not_found(self, clean_db):
        """Test getting detail for non-existent session"""
        response = client.get("/api/journey-mapper/sessions/99999")
        assert response.status_code == 404

    def test_list_sessions(self, clean_db):
        """Test listing all sessions"""
        with patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline'):
            client.post("/api/journey-mapper/sessions", data={"mode": "standard", "journeyDescription": "First test journey for listing sessions"})
            client.post("/api/journey-mapper/sessions", data={"mode": "standard", "journeyDescription": "Second test journey for listing sessions"})

        response = client.get("/api/journey-mapper/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all("id" in session for session in data)

    def test_list_sessions_with_pagination(self, clean_db):
        """Test session listing with pagination"""
        with patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline'):
            for i in range(5):
                client.post(
                    "/api/journey-mapper/sessions",
                    data={"mode": "standard", "journeyDescription": f"Paginated test journey number {i} for testing"}
                )

        # Get first page
        page1 = client.get("/api/journey-mapper/sessions?skip=0&limit=3")
        assert page1.status_code == 200
        assert len(page1.json()) == 3

        # Get second page
        page2 = client.get("/api/journey-mapper/sessions?skip=3&limit=3")
        assert page2.status_code == 200
        assert len(page2.json()) == 2

    def test_delete_session(self, clean_db):
        """Test deleting a session"""
        with patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline'):
            create_response = client.post(
                "/api/journey-mapper/sessions",
                data={"mode": "standard", "journeyDescription": "Session to be deleted in this test"}
            )
            session_id = create_response.json()["id"]

        # Delete session
        response = client.delete(f"/api/journey-mapper/sessions/{session_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify session is deleted
        get_response = client.get(f"/api/journey-mapper/sessions/{session_id}")
        assert get_response.status_code == 404

    def test_delete_session_not_found(self, clean_db):
        """Test deleting non-existent session"""
        response = client.delete("/api/journey-mapper/sessions/99999")
        assert response.status_code == 404

    @patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline')
    def test_retry_session(self, mock_pipeline, clean_db):
        """Test retrying a failed session"""
        # Create a failed session directly
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Failed journey for retry testing purposes",
                mode="standard",
                status="failed",
                error_message="Test error",
                progress_step=1
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        # Retry
        response = client.post(f"/api/journey-mapper/sessions/{session_id}/retry")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    def test_retry_session_not_found(self, clean_db):
        """Test retrying non-existent session"""
        response = client.post("/api/journey-mapper/sessions/99999/retry")
        assert response.status_code == 404


class TestPainPointManagement:
    """Test suite for pain point CRUD operations"""

    def test_add_pain_point(self, clean_db):
        """Test adding a manual pain point"""
        # Create session
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey with pain points for testing",
                mode="standard",
                status="completed",
                stages=[{"id": "stage_1", "name": "Discovery", "order": 0}]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        # Add pain point
        response = client.post(
            f"/api/journey-mapper/sessions/{session_id}/pain-points",
            json={
                "stageId": "stage_1",
                "description": "Users struggle to find the search feature",
                "severity": 7.5
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Users struggle to find the search feature"
        assert data["severity"] == 7.5
        assert data["stageId"] == "stage_1"

    def test_update_pain_point(self, clean_db):
        """Test updating a pain point"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for pain point update test",
                mode="standard",
                status="completed"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)

            pain_point = JourneyPainPoint(
                journey_map_id=session_obj.id,
                stage_id="stage_1",
                description="Original description",
                severity=5.0
            )
            db.add(pain_point)
            db.commit()
            db.refresh(pain_point)
            pain_point_id = pain_point.id

        # Update pain point
        response = client.patch(
            f"/api/journey-mapper/pain-points/{pain_point_id}",
            json={
                "description": "Updated description",
                "severity": 8.0
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description"
        assert data["severity"] == 8.0
        assert data["isUserEdited"] is True

    def test_update_pain_point_not_found(self, clean_db):
        """Test updating non-existent pain point"""
        response = client.patch(
            "/api/journey-mapper/pain-points/99999",
            json={"description": "Updated"}
        )
        assert response.status_code == 404

    def test_delete_pain_point(self, clean_db):
        """Test deleting a pain point"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for pain point deletion test",
                mode="standard",
                status="completed"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)

            pain_point = JourneyPainPoint(
                journey_map_id=session_obj.id,
                stage_id="stage_1",
                description="Pain point to delete",
                severity=5.0
            )
            db.add(pain_point)
            db.commit()
            db.refresh(pain_point)
            pain_point_id = pain_point.id

        # Delete
        response = client.delete(f"/api/journey-mapper/pain-points/{pain_point_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_delete_pain_point_not_found(self, clean_db):
        """Test deleting non-existent pain point"""
        response = client.delete("/api/journey-mapper/pain-points/99999")
        assert response.status_code == 404


class TestStageManagement:
    """Test suite for stage CRUD operations"""

    def test_add_stage(self, clean_db):
        """Test adding a new stage"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for stage addition test",
                mode="standard",
                status="completed",
                stages=[
                    {"id": "stage_1", "name": "Discovery", "order": 0},
                    {"id": "stage_2", "name": "Evaluation", "order": 1}
                ]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        # Add stage
        response = client.post(
            f"/api/journey-mapper/sessions/{session_id}/stages",
            json={
                "name": "Comparison",
                "description": "User compares options",
                "insertAfterStageId": "stage_1"
            }
        )

        assert response.status_code == 200
        data = response.json()
        stages = data["stages"]
        assert len(stages) == 3
        # New stage should be after stage_1
        stage_names = [s["name"] for s in sorted(stages, key=lambda x: x["order"])]
        assert stage_names == ["Discovery", "Comparison", "Evaluation"]

    def test_update_stage(self, clean_db):
        """Test updating a stage"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for stage update test",
                mode="standard",
                status="completed",
                stages=[{"id": "stage_1", "name": "Original", "order": 0, "description": "Original desc"}]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        # Update stage
        response = client.patch(
            f"/api/journey-mapper/sessions/{session_id}/stages/stage_1",
            json={
                "name": "Updated Name",
                "description": "Updated description"
            }
        )

        assert response.status_code == 200
        data = response.json()
        stage = data["stages"][0]
        assert stage["name"] == "Updated Name"
        assert stage["description"] == "Updated description"

    def test_update_stage_not_found(self, clean_db):
        """Test updating non-existent stage"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for stage not found test",
                mode="standard",
                status="completed",
                stages=[{"id": "stage_1", "name": "Test", "order": 0}]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        response = client.patch(
            f"/api/journey-mapper/sessions/{session_id}/stages/nonexistent_stage",
            json={"name": "Updated"}
        )
        assert response.status_code == 404

    def test_delete_stage(self, clean_db):
        """Test deleting a stage"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for stage deletion test",
                mode="standard",
                status="completed",
                stages=[
                    {"id": "stage_1", "name": "First", "order": 0},
                    {"id": "stage_2", "name": "Second", "order": 1}
                ]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        # Delete stage
        response = client.delete(f"/api/journey-mapper/sessions/{session_id}/stages/stage_1")

        assert response.status_code == 200
        data = response.json()
        assert len(data["stages"]) == 1
        assert data["stages"][0]["id"] == "stage_2"


class TestCompetitiveJourney:
    """Test suite for competitive journey walkthrough"""

    def test_add_competitor_observation(self, clean_db):
        """Test adding competitor observation"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Competitive analysis for checkout flow",
                mode="competitive",
                competitor_name="Stripe",
                status="pending"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        # Add observation
        response = client.post(
            f"/api/journey-mapper/sessions/{session_id}/observations",
            json={
                "stageOrder": 1,
                "stageName": "Payment Form",
                "touchpointsObserved": ["Card input", "Address form"],
                "timeTaken": "2 minutes",
                "frictionPoints": ["Too many fields"],
                "strengthsObserved": ["Auto-complete works well"],
                "notes": "Clean UI overall"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["stageName"] == "Payment Form"
        assert data["stageOrder"] == 1
        assert "Too many fields" in data["frictionPoints"]

    def test_add_observation_wrong_mode(self, clean_db):
        """Test adding observation to non-competitive session fails"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Standard journey not competitive",
                mode="standard",
                status="pending"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        response = client.post(
            f"/api/journey-mapper/sessions/{session_id}/observations",
            json={
                "stageOrder": 1,
                "stageName": "Test"
            }
        )

        assert response.status_code == 400

    @patch('app.services.journey_mapper_service.journey_mapper_service.run_journey_generation_pipeline')
    def test_generate_from_observations(self, mock_pipeline, clean_db):
        """Test generating journey from observations"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Competitive analysis for checkout",
                mode="competitive",
                competitor_name="PayPal",
                status="pending"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

            # Add some observations
            obs = CompetitorJourneyObservation(
                journey_map_id=session_id,
                stage_order=1,
                stage_name="Login"
            )
            db.add(obs)
            db.commit()

        response = client.post(f"/api/journey-mapper/sessions/{session_id}/generate-from-observations")

        assert response.status_code == 200
        assert response.json()["success"] is True


class TestVersionControl:
    """Test suite for journey version control"""

    @patch('app.services.journey_mapper_service.journey_mapper_service.run_version_update_pipeline')
    def test_create_new_version(self, mock_pipeline, clean_db):
        """Test creating a new version of a journey"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Original journey version for testing",
                mode="standard",
                status="completed",
                version="1.0",
                stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        response = client.post(
            f"/api/journey-mapper/sessions/{session_id}/new-version",
            data={
                "updateType": "refresh",
                "knowledgeBaseIds": "[3, 4]"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["parentVersionId"] == session_id
        assert data["version"] == "2.0"

    def test_compare_versions(self, clean_db):
        """Test comparing two journey versions"""
        with Session(engine) as db:
            # Create parent version
            parent = JourneyMapSession(
                journey_description="Parent version journey",
                mode="standard",
                status="completed",
                version="1.0",
                stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
            )
            db.add(parent)
            db.commit()
            db.refresh(parent)

            # Create child version
            child = JourneyMapSession(
                journey_description="Child version journey",
                mode="standard",
                status="completed",
                version="2.0",
                parent_version_id=parent.id,
                stages=[
                    {"id": "s1", "name": "Stage 1 Updated", "order": 0},
                    {"id": "s2", "name": "Stage 2", "order": 1}
                ]
            )
            db.add(child)
            db.commit()
            db.refresh(child)
            parent_id = parent.id
            child_id = child.id

        response = client.get(f"/api/journey-mapper/sessions/{parent_id}/compare/{child_id}")

        assert response.status_code == 200
        data = response.json()
        assert "stageChanges" in data


class TestExport:
    """Test suite for journey export"""

    def test_export_json(self, clean_db):
        """Test exporting journey as JSON"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for export testing",
                mode="standard",
                status="completed",
                stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        response = client.get(f"/api/journey-mapper/sessions/{session_id}/export?format=json")

        assert response.status_code == 200
        data = response.json()
        assert "session" in data

    def test_export_pdf_not_implemented(self, clean_db):
        """Test PDF export returns not implemented"""
        with Session(engine) as db:
            session_obj = JourneyMapSession(
                journey_description="Journey for PDF export test",
                mode="standard",
                status="completed"
            )
            db.add(session_obj)
            db.commit()
            db.refresh(session_obj)
            session_id = session_obj.id

        response = client.get(f"/api/journey-mapper/sessions/{session_id}/export?format=pdf")
        assert response.status_code == 501  # Not Implemented

    def test_export_session_not_found(self, clean_db):
        """Test export for non-existent session"""
        response = client.get("/api/journey-mapper/sessions/99999/export?format=json")
        assert response.status_code == 404


class TestContextSources:
    """Test suite for context sources endpoint"""

    def test_get_context_sources(self, clean_db):
        """Test getting available context sources"""
        response = client.get("/api/journey-mapper/context-sources")

        assert response.status_code == 200
        data = response.json()
        assert "knowledgeBases" in data
        assert "ideationSessions" in data
        assert "feasibilitySessions" in data
        assert "businessCaseSessions" in data
