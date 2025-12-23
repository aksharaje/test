"""
Tests for Ideation API Endpoints

Tests the FastAPI endpoints for ideation workflow.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, MagicMock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.models.ideation import IdeationSession, GeneratedIdea, IdeaCluster


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
    # Clear all tables
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    # Cleanup after test
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


class TestIdeationAPI:
    """Test suite for Ideation API endpoints"""

    @patch('app.services.ideation_service.ideation_service.run_ideation_pipeline')
    def test_create_session_success(self, mock_pipeline, clean_db):
        """Test creating a new ideation session"""
        response = client.post(
            "/api/ideation/sessions",
            json={
                "problem_statement": "Test problem statement that is long enough to meet minimum character requirements for processing",
                "constraints": "Budget limited to $50k",
                "goals": "Increase engagement by 30%",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["status"] == "pending"
        assert "confidence" in data

    @patch('app.services.ideation_service.ideation_service.run_ideation_pipeline')
    def test_create_session_with_knowledge_bases(self, mock_pipeline, clean_db):
        """Test creating session with knowledge base IDs"""
        response = client.post(
            "/api/ideation/sessions",
            json={
                "problem_statement": "Test problem statement with sufficient length to meet requirements and provide good context",
                "knowledge_base_ids": [1, 2, 3],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["knowledgeBaseIds"] == [1, 2, 3]

    def test_get_session_status(self, clean_db):
        """Test getting session status for polling"""
        # Create session via API
        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            create_response = client.post(
                "/api/ideation/sessions",
                json={"problem_statement": "A" * 120},
            )
            session_id = create_response.json()["id"]

        # Get status
        response = client.get(f"/api/ideation/sessions/{session_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert "progressStep" in data
        assert "confidence" in data

    def test_get_session_status_not_found(self, clean_db):
        """Test getting status of non-existent session"""
        response = client.get("/api/ideation/sessions/999/status")
        assert response.status_code == 404

    def test_get_session_detail(self, clean_db):
        """Test getting full session detail with ideas and clusters"""
        # Create session
        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            create_response = client.post(
                "/api/ideation/sessions",
                json={"problem_statement": "A" * 120},
            )
            session_id = create_response.json()["id"]

        # Manually add cluster and idea to database
        with Session(engine) as db_session:
            cluster = IdeaCluster(
                session_id=session_id,
                cluster_number=1,
                theme_name="Innovation Theme",
                idea_count=1,
            )
            db_session.add(cluster)
            db_session.commit()
            db_session.refresh(cluster)

            idea = GeneratedIdea(
                session_id=session_id,
                cluster_id=cluster.id,
                title="Test Idea",
                description="Test Description",
                category="quick_wins",
                is_final=True,
            )
            db_session.add(idea)
            db_session.commit()

        # Get detail
        response = client.get(f"/api/ideation/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["id"] == session_id
        assert len(data["clusters"]) == 1
        assert data["clusters"][0]["themeName"] == "Innovation Theme"
        assert len(data["ideas"]) == 1

    def test_get_session_detail_not_found(self, clean_db):
        """Test getting detail of non-existent session"""
        response = client.get("/api/ideation/sessions/999")
        assert response.status_code == 404

    def test_list_sessions(self, clean_db):
        """Test listing all sessions"""
        # Create multiple sessions
        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            for i in range(3):
                client.post(
                    "/api/ideation/sessions",
                    json={"problem_statement": f"Problem {i}" + "A" * 100},
                )

        # List all sessions
        response = client.get("/api/ideation/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_update_idea(self, clean_db):
        """Test updating an idea"""
        # Create session
        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            create_response = client.post(
                "/api/ideation/sessions",
                json={"problem_statement": "A" * 120},
            )
            session_id = create_response.json()["id"]

        # Add idea to database
        with Session(engine) as db_session:
            idea = GeneratedIdea(
                session_id=session_id,
                title="Original Title",
                description="Original Description",
                category="quick_wins",
                use_cases=["Case 1"],
            )
            db_session.add(idea)
            db_session.commit()
            db_session.refresh(idea)
            idea_id = idea.id

        # Update idea
        response = client.patch(
            f"/api/ideation/ideas/{idea_id}",
            json={
                "title": "Updated Title",
                "use_cases": ["New Case 1", "New Case 2"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert len(data["useCases"]) == 2

    def test_update_idea_not_found(self, clean_db):
        """Test updating non-existent idea"""
        response = client.patch(
            "/api/ideation/ideas/999",
            json={"title": "Updated"},
        )
        assert response.status_code == 404

    def test_delete_session(self, clean_db):
        """Test deleting a session"""
        # Create session
        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            create_response = client.post(
                "/api/ideation/sessions",
                json={"problem_statement": "A" * 120},
            )
            session_id = create_response.json()["id"]

        # Delete session
        response = client.delete(f"/api/ideation/sessions/{session_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Session deleted successfully"

        # Verify deletion
        response = client.get(f"/api/ideation/sessions/{session_id}/status")
        assert response.status_code == 404

    def test_delete_session_not_found(self, clean_db):
        """Test deleting non-existent session"""
        response = client.delete("/api/ideation/sessions/999")
        assert response.status_code == 404

    def test_create_session_validation(self, clean_db):
        """Test request validation"""
        # Missing required field
        response = client.post(
            "/api/ideation/sessions",
            json={},
        )
        assert response.status_code == 422

    def test_session_workflow(self, clean_db):
        """Test complete session workflow: create, poll, retrieve"""
        # 1. Create session
        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            response = client.post(
                "/api/ideation/sessions",
                json={"problem_statement": "A" * 120},
            )
            assert response.status_code == 200
            session_id = response.json()["id"]

        # 2. Poll status
        response = client.get(f"/api/ideation/sessions/{session_id}/status")
        assert response.status_code == 200
        assert response.json()["status"] == "pending"

        # 3. Simulate completion (update status manually)
        with Session(engine) as db_session:
            session_obj = db_session.get(IdeationSession, session_id)
            session_obj.status = "completed"
            db_session.add(session_obj)
            db_session.commit()

        # 4. Get full results
        response = client.get(f"/api/ideation/sessions/{session_id}")
        assert response.status_code == 200
        assert response.json()["session"]["status"] == "completed"

    def test_concurrent_sessions(self, clean_db):
        """Test creating multiple concurrent sessions"""
        session_ids = []

        with patch('app.services.ideation_service.ideation_service.run_ideation_pipeline'):
            for i in range(5):
                response = client.post(
                    "/api/ideation/sessions",
                    json={"problem_statement": f"Problem {i}" + "X" * 100},
                )
                assert response.status_code == 200
                session_ids.append(response.json()["id"])

        # Verify all sessions exist
        for session_id in session_ids:
            response = client.get(f"/api/ideation/sessions/{session_id}/status")
            assert response.status_code == 200
