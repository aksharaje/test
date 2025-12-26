"""
Tests for Experience Gap Analyzer API Endpoints
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.core.db import get_session
from app.models.experience_gap_analyzer import GapAnalysisSession, GapItem
from app.models.journey_mapper import JourneyMapSession


# Mock database session for all tests
@pytest.fixture
def mock_db():
    """Create mock database session"""
    return Mock()


@pytest.fixture
def client(mock_db):
    """Create test client with mocked database"""
    def override_get_session():
        return mock_db

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class TestContextSources:
    """Tests for context sources endpoint"""

    def test_get_context_sources_returns_journey_maps(self, client, mock_db):
        """Test that context sources returns completed journey maps"""
        journeys = [
            JourneyMapSession(
                id=1,
                journey_description="Customer onboarding journey for SaaS product",
                mode="standard",
                status="completed",
                stages=[{"id": "s1"}, {"id": "s2"}],
                created_at=datetime.utcnow()
            )
        ]

        mock_result = Mock()
        mock_result.all.return_value = journeys
        mock_db.exec.return_value = mock_result

        response = client.get("/api/cx/gap-analyzer/context-sources")

        assert response.status_code == 200
        data = response.json()
        assert "journeyMaps" in data
        assert len(data["journeyMaps"]) == 1
        assert data["journeyMaps"][0]["id"] == 1


class TestSessionEndpoints:
    """Tests for session management endpoints"""

    def test_create_session_success(self, client, mock_db):
        """Test successful session creation"""
        created_session = GapAnalysisSession(
            id=1,
            analysis_type="competitive",
            analysis_name="Test Analysis",
            your_journey_id=1,
            status="pending",
            progress_step=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.create_session.return_value = created_session

            response = client.post(
                "/api/cx/gap-analyzer/sessions",
                json={
                    "analysisType": "competitive",
                    "yourJourneyId": 1,
                    "analysisName": "Test Analysis"
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["analysisType"] == "competitive"
            assert data["status"] == "pending"

    def test_create_session_invalid_journey(self, client, mock_db):
        """Test session creation fails with invalid journey"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.create_session.side_effect = ValueError("Your journey map not found")

            response = client.post(
                "/api/cx/gap-analyzer/sessions",
                json={
                    "analysisType": "competitive",
                    "yourJourneyId": 999
                }
            )

            assert response.status_code == 422
            assert "not found" in response.json()["detail"]

    def test_get_session_detail(self, client, mock_db):
        """Test getting session details"""
        session = GapAnalysisSession(
            id=1,
            analysis_type="competitive",
            status="completed",
            progress_step=5,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session_detail.return_value = {
                "session": session,
                "gaps": [],
                "capabilityMatrix": [],
                "stageAlignments": [],
                "yourJourney": None,
                "comparisonJourney": None
            }

            response = client.get("/api/cx/gap-analyzer/sessions/1")

            assert response.status_code == 200
            data = response.json()
            assert "session" in data
            assert data["session"]["id"] == 1

    def test_get_session_detail_not_found(self, client, mock_db):
        """Test getting non-existent session"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session_detail.return_value = None

            response = client.get("/api/cx/gap-analyzer/sessions/999")

            assert response.status_code == 404

    def test_get_session_status(self, client, mock_db):
        """Test getting session status for polling"""
        session = GapAnalysisSession(
            id=1,
            status="analyzing",
            progress_step=2,
            progress_message="Identifying gaps...",
            error_message=None
        )

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session.return_value = session

            response = client.get("/api/cx/gap-analyzer/sessions/1/status")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "analyzing"
            assert data["progressStep"] == 2
            assert data["progressMessage"] == "Identifying gaps..."

    def test_list_sessions(self, client, mock_db):
        """Test listing sessions"""
        sessions = [
            GapAnalysisSession(
                id=1,
                analysis_name="Analysis 1",
                analysis_type="competitive",
                status="completed",
                progress_step=5,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            GapAnalysisSession(
                id=2,
                analysis_name="Analysis 2",
                analysis_type="best_practice",
                status="pending",
                progress_step=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
        ]

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.list_sessions.return_value = sessions

            response = client.get("/api/cx/gap-analyzer/sessions")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["analysisName"] == "Analysis 1"

    def test_delete_session(self, client, mock_db):
        """Test deleting a session"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.delete_session.return_value = True

            response = client.delete("/api/cx/gap-analyzer/sessions/1")

            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_delete_session_not_found(self, client, mock_db):
        """Test deleting non-existent session"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.delete_session.return_value = False

            response = client.delete("/api/cx/gap-analyzer/sessions/999")

            assert response.status_code == 404

    def test_retry_session(self, client, mock_db):
        """Test retrying a failed session"""
        session = GapAnalysisSession(
            id=1,
            status="failed",
            progress_step=0,
            error_message="LLM error",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session.return_value = session

            response = client.post("/api/cx/gap-analyzer/sessions/1/retry")

            assert response.status_code == 200


class TestGapEndpoints:
    """Tests for gap management endpoints"""

    def test_update_gap(self, client, mock_db):
        """Test updating a gap"""
        updated_gap = GapItem(
            id=1,
            session_id=1,
            title="Updated Title",
            description="Updated description",
            category="experience",
            impact_score=8,
            urgency_score=7,
            effort_score=4,
            opportunity_score=14.0,
            priority_tier=2,
            is_user_edited=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.update_gap.return_value = updated_gap

            response = client.patch(
                "/api/cx/gap-analyzer/gaps/1",
                json={
                    "title": "Updated Title",
                    "impactScore": 8
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "Updated Title"
            assert data["impactScore"] == 8

    def test_update_gap_not_found(self, client, mock_db):
        """Test updating non-existent gap"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.update_gap.return_value = None

            response = client.patch(
                "/api/cx/gap-analyzer/gaps/999",
                json={"title": "New Title"}
            )

            assert response.status_code == 404

    def test_add_gap(self, client, mock_db):
        """Test adding a new gap"""
        new_gap = GapItem(
            id=1,
            session_id=1,
            title="New Gap",
            description="Gap description",
            category="experience",
            impact_score=7,
            urgency_score=6,
            effort_score=4,
            opportunity_score=10.5,
            priority_tier=2,
            is_user_edited=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.add_gap.return_value = new_gap

            response = client.post(
                "/api/cx/gap-analyzer/sessions/1/gaps",
                json={
                    "title": "New Gap",
                    "description": "Gap description",
                    "category": "experience",
                    "impactScore": 7,
                    "urgencyScore": 6,
                    "effortScore": 4
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "New Gap"

    def test_delete_gap(self, client, mock_db):
        """Test deleting a gap"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.delete_gap.return_value = True

            response = client.delete("/api/cx/gap-analyzer/gaps/1")

            assert response.status_code == 200
            assert response.json()["success"] is True


class TestRoadmapEndpoints:
    """Tests for roadmap management endpoints"""

    def test_reorder_roadmap(self, client, mock_db):
        """Test reordering gaps in roadmap"""
        updated_gap = GapItem(
            id=1,
            session_id=1,
            title="Gap",
            description="Desc",
            priority_tier=1,
            opportunity_score=20,
            impact_score=9,
            urgency_score=8,
            effort_score=3,
            is_user_edited=True,
            user_priority_override=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        session_detail = {
            "session": GapAnalysisSession(
                id=1,
                analysis_type="competitive",
                status="completed",
                progress_step=5,
                roadmap={"tier1": [{"gapId": 1}], "tier2": [], "tier3": []},
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            "gaps": [updated_gap],
            "capabilityMatrix": [],
            "stageAlignments": [],
            "yourJourney": None,
            "comparisonJourney": None
        }

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.reorder_roadmap.return_value = updated_gap
            mock_service.get_session_detail.return_value = session_detail

            response = client.post(
                "/api/cx/gap-analyzer/sessions/1/reorder-roadmap",
                json={
                    "gapId": 1,
                    "newTier": 1
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert "session" in data

    def test_reorder_roadmap_gap_not_found(self, client, mock_db):
        """Test reordering with invalid gap"""
        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.reorder_roadmap.return_value = None

            response = client.post(
                "/api/cx/gap-analyzer/sessions/1/reorder-roadmap",
                json={
                    "gapId": 999,
                    "newTier": 1
                }
            )

            assert response.status_code == 404


class TestExportEndpoints:
    """Tests for export endpoints"""

    def test_export_json(self, client, mock_db):
        """Test exporting analysis as JSON"""
        session_detail = {
            "session": GapAnalysisSession(
                id=1,
                analysis_type="competitive",
                status="completed",
                progress_step=5,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            "gaps": [],
            "capabilityMatrix": [],
            "stageAlignments": [],
            "yourJourney": None,
            "comparisonJourney": None
        }

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session_detail.return_value = session_detail

            response = client.get("/api/cx/gap-analyzer/sessions/1/export?format=json")

            assert response.status_code == 200

    def test_export_pdf_not_implemented(self, client, mock_db):
        """Test PDF export returns not implemented"""
        session_detail = {
            "session": GapAnalysisSession(
                id=1,
                status="completed",
                progress_step=5,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            "gaps": [],
            "capabilityMatrix": [],
            "stageAlignments": [],
            "yourJourney": None,
            "comparisonJourney": None
        }

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session_detail.return_value = session_detail

            response = client.get("/api/cx/gap-analyzer/sessions/1/export?format=pdf")

            assert response.status_code == 501

    def test_export_invalid_format(self, client, mock_db):
        """Test export with invalid format"""
        session_detail = {
            "session": GapAnalysisSession(
                id=1,
                status="completed",
                progress_step=5,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ),
            "gaps": [],
            "capabilityMatrix": [],
            "stageAlignments": [],
            "yourJourney": None,
            "comparisonJourney": None
        }

        with patch('app.api.api_v1.endpoints.experience_gap_analyzer.experience_gap_analyzer_service') as mock_service:
            mock_service.get_session_detail.return_value = session_detail

            response = client.get("/api/cx/gap-analyzer/sessions/1/export?format=xml")

            assert response.status_code == 400
