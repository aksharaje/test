"""
Tests for Roadmap Communicator API Endpoints

Tests the REST API for the Roadmap Communicator feature.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.roadmap_communicator import get_service
from app.models.roadmap_communicator import (
    CommunicatorSession,
    GeneratedPresentation,
    CommunicatorSessionResponse,
    AUDIENCE_CONFIGS,
)
from app.services.roadmap_communicator_service import RoadmapCommunicatorService


class TestRoadmapCommunicatorAPI:
    """Tests for Roadmap Communicator API endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock(spec=RoadmapCommunicatorService)

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with dependency override"""
        app.dependency_overrides[get_service] = lambda: mock_service
        yield TestClient(app)
        app.dependency_overrides.clear()

    # =========================================================================
    # Session Endpoints
    # =========================================================================

    def test_create_session(self, client, mock_service):
        """Test creating a new communicator session"""
        mock_session = CommunicatorSession(
            id=1,
            roadmap_session_id=10,
            name="Q1 Roadmap Presentations",
            status="draft",
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/roadmap-communicator/sessions",
            json={
                "roadmapSessionId": 10,
                "name": "Q1 Roadmap Presentations",
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Q1 Roadmap Presentations"
        assert data["status"] == "draft"
        assert data["roadmapSessionId"] == 10

    def test_create_session_with_scenario(self, client, mock_service):
        """Test creating session from scenario variant"""
        mock_session = CommunicatorSession(
            id=1,
            roadmap_session_id=10,
            scenario_variant_id=5,
            name="Scenario A Presentation",
            status="draft",
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/roadmap-communicator/sessions",
            json={
                "roadmapSessionId": 10,
                "scenarioVariantId": 5,
                "name": "Scenario A Presentation",
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["scenarioVariantId"] == 5

    def test_create_session_roadmap_not_found(self, client, mock_service):
        """Test creating session with non-existent roadmap"""
        mock_service.create_session.side_effect = ValueError("Roadmap session not found")

        response = client.post(
            "/api/roadmap-communicator/sessions",
            json={
                "roadmapSessionId": 999,
                "name": "Test",
            }
        )

        assert response.status_code == 404

    def test_list_sessions(self, client, mock_service):
        """Test listing all sessions"""
        mock_sessions = [
            CommunicatorSession(id=1, roadmap_session_id=10, name="Session 1", status="completed"),
            CommunicatorSession(id=2, roadmap_session_id=10, name="Session 2", status="draft"),
        ]
        mock_service.get_sessions.return_value = mock_sessions

        response = client.get("/api/roadmap-communicator/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_sessions_filtered_by_roadmap(self, client, mock_service):
        """Test listing sessions filtered by roadmap"""
        mock_sessions = [
            CommunicatorSession(id=1, roadmap_session_id=10, name="Session 1", status="completed"),
        ]
        mock_service.get_sessions_for_roadmap.return_value = mock_sessions

        response = client.get("/api/roadmap-communicator/sessions?roadmap_session_id=10")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        mock_service.get_sessions_for_roadmap.assert_called_once_with(10)

    def test_get_session(self, client, mock_service):
        """Test getting a session with all data"""
        mock_session = CommunicatorSession(id=1, roadmap_session_id=10, name="Test", status="completed")
        mock_presentations = [
            GeneratedPresentation(
                id=1,
                session_id=1,
                audience_type="executive",
                audience_name="Executive Leadership",
                status="completed",
            ),
            GeneratedPresentation(
                id=2,
                session_id=1,
                audience_type="engineering",
                audience_name="Engineering Team",
                status="completed",
            ),
        ]
        mock_response = CommunicatorSessionResponse(
            session=mock_session,
            presentations=mock_presentations,
        )
        mock_service.get_full_session.return_value = mock_response

        response = client.get("/api/roadmap-communicator/sessions/1")

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["name"] == "Test"
        assert len(data["presentations"]) == 2

    def test_get_session_not_found(self, client, mock_service):
        """Test getting a non-existent session"""
        mock_service.get_full_session.return_value = None

        response = client.get("/api/roadmap-communicator/sessions/999")

        assert response.status_code == 404

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/roadmap-communicator/sessions/1")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting a non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/roadmap-communicator/sessions/999")

        assert response.status_code == 404

    def test_get_session_status(self, client, mock_service):
        """Test getting session status for polling"""
        mock_session = CommunicatorSession(
            id=1,
            roadmap_session_id=10,
            name="Test",
            status="generating",
            progress_step=3,
            progress_total=5,
            progress_message="Generating narrative...",
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/roadmap-communicator/sessions/1/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "generating"
        assert data["progressStep"] == 3
        assert data["progressTotal"] == 5
        assert data["progressMessage"] == "Generating narrative..."

    def test_get_session_status_not_found(self, client, mock_service):
        """Test getting status for non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/roadmap-communicator/sessions/999/status")

        assert response.status_code == 404

    # =========================================================================
    # Presentation Endpoints
    # =========================================================================

    def test_get_presentations(self, client, mock_service):
        """Test getting presentations for a session"""
        mock_presentations = [
            GeneratedPresentation(id=1, session_id=1, audience_type="executive", status="completed"),
            GeneratedPresentation(id=2, session_id=1, audience_type="engineering", status="completed"),
        ]
        mock_service.get_presentations.return_value = mock_presentations

        response = client.get("/api/roadmap-communicator/sessions/1/presentations")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_presentation(self, client, mock_service):
        """Test getting a specific presentation"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            audience_name="Executive Leadership",
            formatted_content="# Roadmap Overview\n\n...",
            status="completed",
        )
        mock_service.get_presentation.return_value = mock_presentation

        response = client.get("/api/roadmap-communicator/presentations/1")

        assert response.status_code == 200
        data = response.json()
        assert data["audienceType"] == "executive"
        assert data["status"] == "completed"

    def test_get_presentation_not_found(self, client, mock_service):
        """Test getting a non-existent presentation"""
        mock_service.get_presentation.return_value = None

        response = client.get("/api/roadmap-communicator/presentations/999")

        assert response.status_code == 404

    def test_delete_presentation(self, client, mock_service):
        """Test deleting a presentation"""
        mock_service.delete_presentation.return_value = True

        response = client.delete("/api/roadmap-communicator/presentations/1")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_presentation_not_found(self, client, mock_service):
        """Test deleting non-existent presentation"""
        mock_service.delete_presentation.return_value = False

        response = client.delete("/api/roadmap-communicator/presentations/999")

        assert response.status_code == 404

    # =========================================================================
    # Export Endpoints
    # =========================================================================

    def test_export_markdown(self, client, mock_service):
        """Test markdown export"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            format="markdown",
            formatted_content="# Roadmap Overview\n\n## Strategic Priorities\n...",
            status="completed",
        )
        mock_service.get_presentation.return_value = mock_presentation

        response = client.get("/api/roadmap-communicator/presentations/1/export/markdown")

        assert response.status_code == 200
        assert "text/markdown" in response.headers["content-type"]
        assert response.text == "# Roadmap Overview\n\n## Strategic Priorities\n..."

    def test_export_html(self, client, mock_service):
        """Test HTML export"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            format="html",
            formatted_content="<html><body><h1>Roadmap Overview</h1></body></html>",
            status="completed",
        )
        mock_service.get_presentation.return_value = mock_presentation

        response = client.get("/api/roadmap-communicator/presentations/1/export/html")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_export_json(self, client, mock_service):
        """Test JSON export"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            format="json",
            formatted_content='{"title": "Roadmap Overview", "sections": []}',
            status="completed",
        )
        mock_service.get_presentation.return_value = mock_presentation

        response = client.get("/api/roadmap-communicator/presentations/1/export/json")

        assert response.status_code == 200
        assert "application/json" in response.headers["content-type"]

    def test_export_unsupported_format(self, client, mock_service):
        """Test export with unsupported format"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            format="markdown",
            formatted_content="# Test",
            status="completed",
        )
        mock_service.get_presentation.return_value = mock_presentation

        response = client.get("/api/roadmap-communicator/presentations/1/export/pdf")

        assert response.status_code == 400

    def test_export_presentation_not_found(self, client, mock_service):
        """Test export for non-existent presentation"""
        mock_service.get_presentation.return_value = None

        response = client.get("/api/roadmap-communicator/presentations/999/export/markdown")

        assert response.status_code == 404

    def test_export_different_format_conversion(self, client, mock_service):
        """Test export converts to requested format"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            format="markdown",  # stored as markdown
            formatted_content="# Test",
            status="completed",
        )
        mock_service.get_presentation.return_value = mock_presentation
        mock_service._format_presentation.return_value = "<h1>Test</h1>"

        response = client.get("/api/roadmap-communicator/presentations/1/export/html")

        assert response.status_code == 200
        # Should call format conversion
        mock_service._format_presentation.assert_called_once()

    # =========================================================================
    # Audience Types Endpoint
    # =========================================================================

    def test_get_audience_types(self, client, mock_service):
        """Test getting audience type configurations"""
        mock_service.get_audience_types.return_value = list(AUDIENCE_CONFIGS.values())

        response = client.get("/api/roadmap-communicator/audience-types")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        # Check that types have expected structure
        for audience_type in data:
            assert "name" in audience_type
            assert "description" in audience_type
            assert "default_profile" in audience_type


class TestPresentationGeneration:
    """Tests for presentation generation endpoint (async)"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service with async methods"""
        service = MagicMock(spec=RoadmapCommunicatorService)
        # Mock async method
        service.generate_presentation = AsyncMock()
        return service

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with dependency override"""
        app.dependency_overrides[get_service] = lambda: mock_service
        yield TestClient(app)
        app.dependency_overrides.clear()

    def test_generate_presentation_executive(self, client, mock_service):
        """Test generating executive presentation"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            audience_name="C-Suite",
            formatted_content="# Executive Overview...",
            status="completed",
        )
        mock_service.generate_presentation.return_value = mock_presentation

        response = client.post(
            "/api/roadmap-communicator/sessions/1/generate",
            json={
                "audienceType": "executive",
                "audienceName": "C-Suite",
                "tone": "professional",
                "format": "markdown",
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["audienceType"] == "executive"
        assert data["status"] == "completed"

    def test_generate_presentation_with_profile(self, client, mock_service):
        """Test generating presentation with custom audience profile"""
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="engineering",
            status="completed",
        )
        mock_service.generate_presentation.return_value = mock_presentation

        response = client.post(
            "/api/roadmap-communicator/sessions/1/generate",
            json={
                "audienceType": "engineering",
                "audienceProfile": {
                    "interests": ["technical dependencies", "capacity"],
                    "detailLevel": "detailed",
                    "concerns": ["technical debt", "velocity"],
                },
                "tone": "collaborative",
                "format": "html",
            }
        )

        assert response.status_code == 200

    def test_generate_presentation_session_not_found(self, client, mock_service):
        """Test generating presentation for non-existent session"""
        mock_service.generate_presentation.side_effect = ValueError("Session not found")

        response = client.post(
            "/api/roadmap-communicator/sessions/999/generate",
            json={
                "audienceType": "executive",
                "tone": "professional",
                "format": "markdown",
            }
        )

        assert response.status_code == 404

    def test_generate_presentation_error(self, client, mock_service):
        """Test handling generation errors"""
        mock_service.generate_presentation.side_effect = Exception("LLM error")

        response = client.post(
            "/api/roadmap-communicator/sessions/1/generate",
            json={
                "audienceType": "executive",
                "tone": "professional",
                "format": "markdown",
            }
        )

        assert response.status_code == 500
