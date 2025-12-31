"""
Tests for Competitive Analysis API Endpoints

Comprehensive tests for competitive analysis workflow including:
- Session CRUD
- Problem area options
- Analysis workflow
"""
import pytest
from contextlib import ExitStack
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.competitive_analysis import service
from app.models.competitive_analysis import (
    CompetitiveAnalysisSession,
    PROBLEM_AREAS,
)


class TestCompetitiveAnalysisAPI:
    """Tests for competitive analysis endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        mock = MagicMock()
        mock.run_analysis = AsyncMock()
        return mock

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'run_analysis', mock_service.run_analysis),
            patch.object(service, 'list_sessions', mock_service.list_sessions),
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'delete_session', mock_service.delete_session),
            patch.object(service, 'retry_session', mock_service.retry_session),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_get_problem_areas(self, client, mock_service):
        """Test getting problem area options"""
        response = client.get("/api/competitive-analysis/problem-areas")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 16  # 15 areas + "other"
        assert data[0]["value"] == "login_auth"
        assert data[0]["label"] == "Login & Authentication"

    def test_create_session_success(self, client, mock_service):
        """Test creating a new competitive analysis session"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            problem_area="login_auth",
            reference_competitors=["Google", "Amazon"],
            include_direct_competitors=True,
            include_best_in_class=True,
            include_adjacent_industries=False,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "problemArea": "login_auth",
                "referenceCompetitors": ["Google", "Amazon"],
                "includeDirectCompetitors": True,
                "includeBestInClass": True,
                "includeAdjacentIndustries": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["problemArea"] == "login_auth"
        assert data["status"] == "pending"
        assert "id" in data

    def test_create_session_with_custom_problem_area(self, client, mock_service):
        """Test creating session with custom problem area"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            problem_area="other",
            custom_problem_area="Gamification & Rewards",
            reference_competitors=[],
            include_direct_competitors=True,
            include_best_in_class=True,
            include_adjacent_industries=True,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "problemArea": "other",
                "customProblemArea": "Gamification & Rewards",
                "includeAdjacentIndustries": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["problemArea"] == "other"
        assert data["customProblemArea"] == "Gamification & Rewards"

    def test_create_session_validation_invalid_problem_area(self, client, mock_service):
        """Test validation: invalid problem area"""
        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "problemArea": "invalid_area",
            },
        )
        assert response.status_code == 422

    def test_list_sessions(self, client, mock_service):
        """Test listing competitive analysis sessions"""
        mock_sessions = [
            CompetitiveAnalysisSession(id=1, problem_area="login_auth", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=2, problem_area="onboarding", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=3, problem_area="checkout_payments", status="failed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/competitive-analysis/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_sessions_with_pagination(self, client, mock_service):
        """Test listing sessions with pagination"""
        mock_sessions = [
            CompetitiveAnalysisSession(id=1, problem_area="login_auth", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=2, problem_area="onboarding", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/competitive-analysis/sessions?skip=0&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_session(self, client, mock_service):
        """Test getting a specific session"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            problem_area="login_auth",
            status="completed",
            executive_summary="Test summary",
            industry_standards=["Standard 1", "Standard 2"],
            best_practices=["Best practice 1"],
            common_pitfalls=["Pitfall 1"],
            product_gaps=["Gap 1"],
            opportunities=[{"text": "Opportunity 1", "tag": "High Impact", "priority": "high"}],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/competitive-analysis/sessions/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["problemArea"] == "login_auth"
        assert data["status"] == "completed"
        assert len(data["industryStandards"]) == 2

    def test_get_session_not_found(self, client, mock_service):
        """Test getting non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/competitive-analysis/sessions/999")
        assert response.status_code == 404

    def test_get_session_status(self, client, mock_service):
        """Test getting session status for polling"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            problem_area="login_auth",
            status="analyzing",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/competitive-analysis/sessions/1/status")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["status"] == "analyzing"
        assert data["errorMessage"] is None

    def test_get_session_status_with_error(self, client, mock_service):
        """Test getting session status with error"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            problem_area="login_auth",
            status="failed",
            error_message="LLM call failed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/competitive-analysis/sessions/1/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["errorMessage"] == "LLM call failed"

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/competitive-analysis/sessions/1")
        assert response.status_code == 200

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/competitive-analysis/sessions/999")
        assert response.status_code == 404

    def test_retry_session(self, client, mock_service):
        """Test retrying a failed session"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            problem_area="login_auth",
            status="pending",
            error_message=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.retry_session.return_value = mock_session

        response = client.post("/api/competitive-analysis/sessions/1/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    def test_retry_session_not_found(self, client, mock_service):
        """Test retrying non-existent session"""
        mock_service.retry_session.return_value = None

        response = client.post("/api/competitive-analysis/sessions/999/retry")
        assert response.status_code == 404


class TestCompetitiveAnalysisSessionWorkflow:
    """Tests for complete analysis workflow"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        mock = MagicMock()
        mock.run_analysis = AsyncMock()
        return mock

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'run_analysis', mock_service.run_analysis),
            patch.object(service, 'get_session', mock_service.get_session),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_full_analysis_workflow(self, client, mock_service):
        """Test complete competitive analysis workflow"""
        # Setup mocks for create
        mock_session_pending = CompetitiveAnalysisSession(
            id=1,
            problem_area="onboarding",
            reference_competitors=["Slack", "Notion", "Figma"],
            include_direct_competitors=True,
            include_best_in_class=True,
            include_adjacent_industries=False,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session_pending

        # 1. Create session
        create_response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "problemArea": "onboarding",
                "referenceCompetitors": ["Slack", "Notion", "Figma"],
                "includeDirectCompetitors": True,
                "includeBestInClass": True,
            },
        )
        assert create_response.status_code == 200
        assert create_response.json()["status"] == "pending"

        # Setup mock for completed session
        mock_session_completed = CompetitiveAnalysisSession(
            id=1,
            problem_area="onboarding",
            reference_competitors=["Slack", "Notion", "Figma"],
            status="completed",
            executive_summary="Onboarding is critical for user retention.",
            industry_standards=["Progress indicators", "Skip option", "Welcome tutorial"],
            best_practices=["Interactive tours", "Personalization", "Empty state guidance"],
            common_pitfalls=["Too many steps", "Forced registration", "No skip option"],
            product_gaps=["Lack of personalization", "Long onboarding time"],
            opportunities=[
                {"text": "Add progress bar", "tag": "Reduces drop-off", "priority": "high"},
                {"text": "Implement skip option", "tag": "Improves UX", "priority": "medium"},
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session_completed

        # 2. Get completed results
        results_response = client.get("/api/competitive-analysis/sessions/1")
        assert results_response.status_code == 200
        data = results_response.json()
        assert data["status"] == "completed"
        assert len(data["industryStandards"]) == 3
        assert len(data["opportunities"]) == 2

    def test_all_problem_areas_valid(self, client, mock_service):
        """Test that all problem areas can create sessions"""
        for area in PROBLEM_AREAS:
            mock_session = CompetitiveAnalysisSession(
                id=1,
                problem_area=area["value"],
                status="pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            mock_service.create_session.return_value = mock_session

            response = client.post(
                "/api/competitive-analysis/sessions",
                json={"problemArea": area["value"]},
            )
            assert response.status_code == 200, f"Failed for problem area: {area['value']}"
