"""
Tests for Test Script Writer API Endpoints
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.api.deps import get_db
from app.models.test_script_writer import (
    TestScriptWriterSession,
    SOURCE_TYPES,
    NFR_OPTIONS,
)


@pytest.fixture
def mock_db():
    """Create mock database session"""
    db = MagicMock()
    return db


@pytest.fixture
def client(mock_db):
    """Create test client with mocked DB"""
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class TestStaticEndpoints:
    """Tests for static data endpoints"""

    def test_get_source_types(self, client):
        """Test getting source type options"""
        response = client.get("/api/test-script-writer/source-types")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 4
        values = [st["value"] for st in data]
        assert "epic" in values
        assert "feature" in values
        assert "user_story" in values
        assert "manual" in values

    def test_get_nfr_options(self, client):
        """Test getting NFR options"""
        response = client.get("/api/test-script-writer/nfr-options")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 9
        values = [nfr["value"] for nfr in data]
        assert "accessibility" in values
        assert "security" in values
        assert "performance" in values
        # Check that descriptions are included
        accessibility = next(n for n in data if n["value"] == "accessibility")
        assert "description" in accessibility


class TestArtifactEndpoints:
    """Tests for story generator artifact endpoints"""

    def test_get_epics(self, client, mock_db):
        """Test getting epics"""
        mock_artifacts = [
            MagicMock(id=1, title="Epic 1", input_description="Desc 1", type="epic"),
            MagicMock(id=2, title="Epic 2", input_description="Desc 2", type="epic"),
        ]
        mock_db.exec.return_value.all.return_value = mock_artifacts

        response = client.get("/api/test-script-writer/artifacts/epics")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["type"] == "epic"

    def test_get_features(self, client, mock_db):
        """Test getting features"""
        mock_artifacts = [
            MagicMock(id=1, title="Feature 1", input_description="Desc 1", type="feature"),
        ]
        mock_db.exec.return_value.all.return_value = mock_artifacts

        response = client.get("/api/test-script-writer/artifacts/features")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["type"] == "feature"

    def test_get_user_stories(self, client, mock_db):
        """Test getting user stories"""
        mock_artifacts = [
            MagicMock(id=1, title="Story 1", input_description="Desc 1", type="user_story"),
        ]
        mock_db.exec.return_value.all.return_value = mock_artifacts

        response = client.get("/api/test-script-writer/artifacts/user-stories")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["type"] == "user_story"

    def test_get_artifact_details_not_found(self, client, mock_db):
        """Test getting artifact details when not found"""
        mock_db.get.return_value = None

        response = client.get("/api/test-script-writer/artifacts/999")
        assert response.status_code == 404


class TestSessionEndpoints:
    """Tests for session CRUD endpoints"""

    def _make_session(self, **overrides):
        """Create a real session object for testing"""
        defaults = {
            "id": 1,
            "source_type": "manual",
            "source_id": None,
            "source_title": None,
            "stories": [],
            "selected_nfrs": [],
            "status": "completed",
            "error_message": None,
            "story_test_scripts": [],
            "summary": "Test",
            "total_test_cases": 5,
            "test_breakdown": {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        defaults.update(overrides)
        session = TestScriptWriterSession(**defaults)
        return session

    def test_list_sessions(self, client, mock_db):
        """Test listing sessions"""
        session = self._make_session()

        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.list_sessions",
            return_value=[session]
        ):
            response = client.get("/api/test-script-writer/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_create_session(self, client, mock_db):
        """Test creating a session"""
        session = self._make_session(
            status="pending",
            stories=[{"id": "1", "title": "Test", "description": "Desc"}],
            selected_nfrs=["accessibility"],
            summary=None,
            total_test_cases=0,
        )

        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.create_session",
            return_value=session
        ):
            response = client.post(
                "/api/test-script-writer/sessions",
                json={
                    "sourceType": "manual",
                    "stories": [{"id": "1", "title": "Test", "description": "Desc"}],
                    "selectedNfrs": ["accessibility"]
                }
            )

        assert response.status_code == 200
        data = response.json()
        assert data["sourceType"] == "manual"
        assert data["status"] == "pending"

    def test_get_session(self, client, mock_db):
        """Test getting a specific session"""
        session = self._make_session()

        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.get_session",
            return_value=session
        ):
            response = client.get("/api/test-script-writer/sessions/1")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1

    def test_get_session_not_found(self, client, mock_db):
        """Test getting a session that doesn't exist"""
        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.get_session",
            return_value=None
        ):
            response = client.get("/api/test-script-writer/sessions/999")

        assert response.status_code == 404

    def test_get_session_status(self, client, mock_db):
        """Test getting session status"""
        session = self._make_session(status="generating")

        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.get_session",
            return_value=session
        ):
            response = client.get("/api/test-script-writer/sessions/1/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "generating"

    def test_delete_session(self, client, mock_db):
        """Test deleting a session"""
        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.delete_session",
            return_value=True
        ):
            response = client.delete("/api/test-script-writer/sessions/1")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_session_not_found(self, client, mock_db):
        """Test deleting a session that doesn't exist"""
        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.delete_session",
            return_value=False
        ):
            response = client.delete("/api/test-script-writer/sessions/999")

        assert response.status_code == 404

    def test_retry_session(self, client, mock_db):
        """Test retrying a failed session"""
        session = self._make_session(status="pending")

        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.retry_session",
            return_value=session
        ):
            response = client.post("/api/test-script-writer/sessions/1/retry")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    def test_retry_session_not_found(self, client, mock_db):
        """Test retrying a session that doesn't exist"""
        with patch(
            "app.api.api_v1.endpoints.test_script_writer.test_script_writer_service.retry_session",
            return_value=None
        ):
            response = client.post("/api/test-script-writer/sessions/999/retry")

        assert response.status_code == 404
