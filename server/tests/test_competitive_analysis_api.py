"""
Tests for Competitive Analysis API Endpoints

Comprehensive tests for competitive analysis workflow including:
- Session CRUD
- Focus area options
- Knowledge base integration
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
    FOCUS_AREAS,
    INDUSTRIES,
    INPUT_SOURCE_TYPES,
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

    def test_get_focus_areas(self, client, mock_service):
        """Test getting focus area options"""
        response = client.get("/api/competitive-analysis/focus-areas")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 27  # 25 areas + "other" + "source_based"
        # Verify alphabetical order (Other and source_based should be at end)
        values = [area["value"] for area in data]
        assert "other" in values[-2:]
        assert "source_based" in values[-2:]
        # Check first item is alphabetically first (Accessibility)
        assert data[0]["value"] == "accessibility"
        assert data[0]["label"] == "Accessibility & Inclusive Design"

    def test_get_focus_areas_contains_expected_values(self, client, mock_service):
        """Test that focus areas contain expected common areas"""
        response = client.get("/api/competitive-analysis/focus-areas")
        data = response.json()
        values = [area["value"] for area in data]

        expected_areas = [
            "login_auth",
            "onboarding",
            "checkout_payments",
            "search_discovery",
            "notifications",
            "messaging_chat",
            "dashboard_analytics",
            "gamification",
        ]
        for area in expected_areas:
            assert area in values, f"Expected {area} in focus areas"

    def test_get_industries(self, client, mock_service):
        """Test getting industry options"""
        response = client.get("/api/competitive-analysis/industries")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 30  # 29 industries + "other"
        # Verify alphabetical order (Other should be last)
        assert data[-1]["value"] == "other"
        assert data[-1]["label"] == "Other"
        # Check first item is alphabetically first
        assert data[0]["value"] == "aerospace_defense"

    def test_get_industries_contains_expected_values(self, client, mock_service):
        """Test that industries contain expected common industries"""
        response = client.get("/api/competitive-analysis/industries")
        data = response.json()
        values = [ind["value"] for ind in data]

        expected_industries = [
            "healthcare",
            "banking",
            "technology",
            "education",
            "hospitality",
            "real_estate",
        ]
        for ind in expected_industries:
            assert ind in values, f"Expected {ind} in industries"

    def test_get_input_source_types(self, client, mock_service):
        """Test getting input source type options"""
        response = client.get("/api/competitive-analysis/input-source-types")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 4
        values = [src["value"] for src in data]
        assert "none" in values
        assert "epic_feature" in values
        assert "scope_definition" in values
        assert "ideation" in values

    def test_create_session_success(self, client, mock_service):
        """Test creating a new competitive analysis session"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            reference_competitors=["Google", "Amazon"],
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
                "focusArea": "login_auth",
                "referenceCompetitors": ["Google", "Amazon"],
                "includeBestInClass": True,
                "includeAdjacentIndustries": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["focusArea"] == "login_auth"
        assert data["status"] == "pending"
        assert "id" in data

    def test_create_session_with_custom_focus_area(self, client, mock_service):
        """Test creating session with custom focus area"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="other",
            custom_focus_area="AI-Powered Recommendations",
            reference_competitors=[],
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
                "focusArea": "other",
                "customFocusArea": "AI-Powered Recommendations",
                "includeAdjacentIndustries": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["focusArea"] == "other"
        assert data["customFocusArea"] == "AI-Powered Recommendations"

    def test_create_session_with_knowledge_base(self, client, mock_service):
        """Test creating session with knowledge base for code comparison"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            reference_competitors=["Stripe", "Square"],
            include_best_in_class=True,
            include_adjacent_industries=False,
            knowledge_base_id=5,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "focusArea": "checkout_payments",
                "referenceCompetitors": ["Stripe", "Square"],
                "knowledgeBaseId": 5,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["focusArea"] == "checkout_payments"
        assert data["knowledgeBaseId"] == 5

    def test_create_session_with_industry_and_input_source(self, client, mock_service):
        """Test creating session with industry and input source"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="onboarding",
            reference_competitors=[],
            include_best_in_class=True,
            include_adjacent_industries=True,
            target_industry="healthcare",
            input_source_type="epic_feature",
            input_source_id=42,
            input_source_description="Patient onboarding flow for healthcare app",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "focusArea": "onboarding",
                "includeAdjacentIndustries": True,
                "targetIndustry": "healthcare",
                "inputSourceType": "epic_feature",
                "inputSourceId": 42,
                "inputSourceDescription": "Patient onboarding flow for healthcare app",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["focusArea"] == "onboarding"
        assert data["targetIndustry"] == "healthcare"
        assert data["inputSourceType"] == "epic_feature"
        assert data["inputSourceId"] == 42

    def test_create_session_validation_invalid_focus_area(self, client, mock_service):
        """Test validation: invalid focus area"""
        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "focusArea": "invalid_area",
            },
        )
        assert response.status_code == 422

    def test_create_session_validation_invalid_industry(self, client, mock_service):
        """Test validation: invalid industry"""
        response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "focusArea": "login_auth",
                "targetIndustry": "invalid_industry",
            },
        )
        assert response.status_code == 422

    def test_list_sessions(self, client, mock_service):
        """Test listing competitive analysis sessions"""
        mock_sessions = [
            CompetitiveAnalysisSession(id=1, focus_area="login_auth", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=2, focus_area="onboarding", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=3, focus_area="checkout_payments", status="failed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/competitive-analysis/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_sessions_with_pagination(self, client, mock_service):
        """Test listing sessions with pagination"""
        mock_sessions = [
            CompetitiveAnalysisSession(id=1, focus_area="login_auth", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=2, focus_area="onboarding", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
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
            focus_area="login_auth",
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
        assert data["focusArea"] == "login_auth"
        assert data["status"] == "completed"
        assert len(data["industryStandards"]) == 2

    def test_get_session_with_code_comparison(self, client, mock_service):
        """Test getting session with code comparison results"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            knowledge_base_id=5,
            status="completed",
            executive_summary="Test summary",
            industry_standards=["Standard 1"],
            best_practices=["Best practice 1"],
            common_pitfalls=["Pitfall 1"],
            product_gaps=["Gap 1"],
            opportunities=[{"text": "Opportunity 1", "tag": "High Impact", "priority": "high"}],
            code_comparison="Your checkout implementation uses a traditional form approach. Consider adopting a single-page checkout like Stripe's for improved conversion.",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/competitive-analysis/sessions/1")
        assert response.status_code == 200
        data = response.json()
        assert data["codeComparison"] is not None
        assert "checkout" in data["codeComparison"].lower()

    def test_get_session_not_found(self, client, mock_service):
        """Test getting non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/competitive-analysis/sessions/999")
        assert response.status_code == 404

    def test_get_session_status(self, client, mock_service):
        """Test getting session status for polling"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
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
            focus_area="login_auth",
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
            focus_area="login_auth",
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


class TestCodeKnowledgeBasesAPI:
    """Tests for code knowledge bases endpoint"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock()

    def test_get_code_knowledge_bases_endpoint_exists(self):
        """Test that the code knowledge bases endpoint exists"""
        client = TestClient(app)
        # The endpoint should exist (may return empty or error depending on db state)
        response = client.get("/api/competitive-analysis/code-knowledge-bases")
        # Should not be 404 (endpoint exists)
        assert response.status_code != 404


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
            focus_area="onboarding",
            reference_competitors=["Slack", "Notion", "Figma"],
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
                "focusArea": "onboarding",
                "referenceCompetitors": ["Slack", "Notion", "Figma"],
                "includeBestInClass": True,
            },
        )
        assert create_response.status_code == 200
        assert create_response.json()["status"] == "pending"

        # Setup mock for completed session
        mock_session_completed = CompetitiveAnalysisSession(
            id=1,
            focus_area="onboarding",
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

    def test_workflow_with_code_comparison(self, client, mock_service):
        """Test analysis workflow with code knowledge base"""
        # Create session with KB
        mock_session_pending = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            knowledge_base_id=5,
            reference_competitors=["Stripe"],
            include_best_in_class=True,
            include_adjacent_industries=False,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session_pending

        create_response = client.post(
            "/api/competitive-analysis/sessions",
            json={
                "focusArea": "checkout_payments",
                "referenceCompetitors": ["Stripe"],
                "knowledgeBaseId": 5,
            },
        )
        assert create_response.status_code == 200
        assert create_response.json()["knowledgeBaseId"] == 5

        # Completed with code comparison
        mock_session_completed = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            knowledge_base_id=5,
            status="completed",
            executive_summary="Payment flows require careful UX.",
            industry_standards=["PCI compliance", "Guest checkout"],
            best_practices=["Single-page checkout", "Apple/Google Pay"],
            common_pitfalls=["Too many form fields"],
            product_gaps=["No express checkout"],
            opportunities=[
                {"text": "Add Apple Pay", "tag": "Faster checkout", "priority": "high"},
            ],
            code_comparison="Your current implementation has a multi-step checkout. Top performers like Stripe use single-page flows.",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session_completed

        results_response = client.get("/api/competitive-analysis/sessions/1")
        data = results_response.json()
        assert data["codeComparison"] is not None
        assert "multi-step" in data["codeComparison"]

    def test_all_focus_areas_valid(self, client, mock_service):
        """Test that all focus areas can create sessions"""
        for area in FOCUS_AREAS:
            mock_session = CompetitiveAnalysisSession(
                id=1,
                focus_area=area["value"],
                status="pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            mock_service.create_session.return_value = mock_session

            response = client.post(
                "/api/competitive-analysis/sessions",
                json={"focusArea": area["value"]},
            )
            assert response.status_code == 200, f"Failed for focus area: {area['value']}"
