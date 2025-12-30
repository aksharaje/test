"""
Tests for Scenario Modeler API Endpoints

Tests the REST API for the Scenario Modeler feature.
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.scenario_modeler import get_service
from app.models.scenario_modeler import (
    ScenarioSession,
    ScenarioVariant,
    ScenarioSessionResponse,
    ScenarioComparisonReport,
    SCENARIO_TEMPLATES,
)
from app.services.scenario_modeler_service import ScenarioModelerService


class TestScenarioModelerAPI:
    """Tests for Scenario Modeler API endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock(spec=ScenarioModelerService)

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
        """Test creating a new scenario session"""
        mock_session = ScenarioSession(
            id=1,
            roadmap_session_id=10,
            name="Q1 Scenario Analysis",
            status="draft",
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/scenario-modeler/sessions",
            json={
                "roadmapSessionId": 10,
                "name": "Q1 Scenario Analysis",
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Q1 Scenario Analysis"
        assert data["status"] == "draft"
        assert data["roadmapSessionId"] == 10

    def test_create_session_roadmap_not_found(self, client, mock_service):
        """Test creating session with non-existent roadmap"""
        mock_service.create_session.side_effect = ValueError("Roadmap session not found")

        response = client.post(
            "/api/scenario-modeler/sessions",
            json={
                "roadmapSessionId": 999,
                "name": "Test",
            }
        )

        assert response.status_code == 404

    def test_list_sessions(self, client, mock_service):
        """Test listing all sessions"""
        mock_sessions = [
            ScenarioSession(id=1, roadmap_session_id=10, name="Scenario 1", status="completed"),
            ScenarioSession(id=2, roadmap_session_id=10, name="Scenario 2", status="draft"),
        ]
        mock_service.get_sessions.return_value = mock_sessions

        response = client.get("/api/scenario-modeler/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_sessions_filtered_by_roadmap(self, client, mock_service):
        """Test listing sessions filtered by roadmap"""
        mock_sessions = [
            ScenarioSession(id=1, roadmap_session_id=10, name="Scenario 1", status="completed"),
        ]
        mock_service.get_sessions_for_roadmap.return_value = mock_sessions

        response = client.get("/api/scenario-modeler/sessions?roadmap_session_id=10")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        mock_service.get_sessions_for_roadmap.assert_called_once_with(10)

    def test_get_session(self, client, mock_service):
        """Test getting a session with all data"""
        mock_session = ScenarioSession(id=1, roadmap_session_id=10, name="Test", status="completed")
        mock_variants = [
            ScenarioVariant(id=1, session_id=1, name="Baseline", is_baseline=True, risk_score=30),
            ScenarioVariant(id=2, session_id=1, name="Variant A", is_baseline=False, risk_score=45),
        ]
        mock_comparison = ScenarioComparisonReport(
            session_id=1,
            baseline_variant_id=1,
            variants=mock_variants,
            recommendations=["Consider variant A for faster delivery"],
        )
        mock_response = ScenarioSessionResponse(
            session=mock_session,
            variants=mock_variants,
            comparison=mock_comparison,
        )
        mock_service.get_full_session.return_value = mock_response

        response = client.get("/api/scenario-modeler/sessions/1")

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["name"] == "Test"
        assert len(data["variants"]) == 2
        assert data["comparison"]["recommendations"][0] == "Consider variant A for faster delivery"

    def test_get_session_not_found(self, client, mock_service):
        """Test getting a non-existent session"""
        mock_service.get_full_session.return_value = None

        response = client.get("/api/scenario-modeler/sessions/999")

        assert response.status_code == 404

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/scenario-modeler/sessions/1")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting a non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/scenario-modeler/sessions/999")

        assert response.status_code == 404

    def test_get_session_status(self, client, mock_service):
        """Test getting session status for polling"""
        mock_session = ScenarioSession(
            id=1,
            roadmap_session_id=10,
            name="Test",
            status="generating",
            progress_step=2,
            progress_total=4,
            progress_message="Generating what-if scenarios...",
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/scenario-modeler/sessions/1/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "generating"
        assert data["progressStep"] == 2
        assert data["progressTotal"] == 4
        assert data["progressMessage"] == "Generating what-if scenarios..."

    def test_get_session_status_not_found(self, client, mock_service):
        """Test getting status for non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/scenario-modeler/sessions/999/status")

        assert response.status_code == 404

    # =========================================================================
    # Variant Endpoints
    # =========================================================================

    def test_get_variants(self, client, mock_service):
        """Test getting variants for a session"""
        mock_variants = [
            ScenarioVariant(id=1, session_id=1, name="Baseline", is_baseline=True),
            ScenarioVariant(id=2, session_id=1, name="Add Team", is_baseline=False),
        ]
        mock_service.get_variants.return_value = mock_variants

        response = client.get("/api/scenario-modeler/sessions/1/variants")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["isBaseline"] is True

    def test_get_variant(self, client, mock_service):
        """Test getting a specific variant"""
        mock_variant = ScenarioVariant(
            id=1,
            session_id=1,
            name="Baseline",
            is_baseline=True,
            risk_score=30,
            is_viable=True,
        )
        mock_service.get_variant.return_value = mock_variant

        response = client.get("/api/scenario-modeler/sessions/1/variants/1")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Baseline"
        assert data["riskScore"] == 30

    def test_get_variant_not_found(self, client, mock_service):
        """Test getting a non-existent variant"""
        mock_service.get_variant.return_value = None

        response = client.get("/api/scenario-modeler/sessions/1/variants/999")

        assert response.status_code == 404

    def test_get_variant_wrong_session(self, client, mock_service):
        """Test getting variant that belongs to different session"""
        mock_variant = ScenarioVariant(id=1, session_id=2, name="Test")  # Different session_id
        mock_service.get_variant.return_value = mock_variant

        response = client.get("/api/scenario-modeler/sessions/1/variants/1")

        assert response.status_code == 404

    def test_create_variant(self, client, mock_service):
        """Test creating a new variant"""
        mock_variant = ScenarioVariant(
            id=2,
            session_id=1,
            name="Add Team Member",
            description="Increase capacity by 20%",
            variable_changes=[
                {"change_type": "capacity", "target": "team_capacity", "value": "+20%"}
            ],
        )
        mock_service.create_variant.return_value = mock_variant

        response = client.post(
            "/api/scenario-modeler/sessions/1/variants",
            json={
                "name": "Add Team Member",
                "description": "Increase capacity by 20%",
                "variableChanges": [
                    {"changeType": "capacity", "target": "team_capacity", "value": "+20%"}
                ]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Add Team Member"

    def test_create_variant_from_template(self, client, mock_service):
        """Test creating variant from template"""
        mock_variant = ScenarioVariant(
            id=2,
            session_id=1,
            name="Add Team Member",
            variable_changes=[
                {"change_type": "capacity", "target": "team_capacity", "value": "+20%"}
            ],
        )
        mock_service.create_variant_from_template.return_value = mock_variant

        response = client.post(
            "/api/scenario-modeler/sessions/1/variants/from-template?template_name=add_team_member"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Add Team Member"

    def test_create_variant_from_template_invalid(self, client, mock_service):
        """Test creating variant from invalid template"""
        mock_service.create_variant_from_template.side_effect = ValueError("Unknown template")

        response = client.post(
            "/api/scenario-modeler/sessions/1/variants/from-template?template_name=invalid_template"
        )

        assert response.status_code == 400

    def test_update_variant(self, client, mock_service):
        """Test updating a variant"""
        mock_variant = ScenarioVariant(
            id=1,
            session_id=1,
            name="Updated Name",
        )
        mock_service.update_variant.return_value = mock_variant

        response = client.patch(
            "/api/scenario-modeler/sessions/1/variants/1",
            json={"name": "Updated Name"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    def test_update_variant_not_found(self, client, mock_service):
        """Test updating non-existent variant"""
        mock_service.update_variant.return_value = None

        response = client.patch(
            "/api/scenario-modeler/sessions/1/variants/999",
            json={"name": "Test"}
        )

        assert response.status_code == 404

    def test_delete_variant(self, client, mock_service):
        """Test deleting a variant"""
        mock_service.delete_variant.return_value = True

        response = client.delete("/api/scenario-modeler/sessions/1/variants/2")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_variant_not_found(self, client, mock_service):
        """Test deleting non-existent variant"""
        mock_service.delete_variant.return_value = False

        response = client.delete("/api/scenario-modeler/sessions/1/variants/999")

        assert response.status_code == 404

    def test_delete_baseline_variant_error(self, client, mock_service):
        """Test deleting baseline variant returns error"""
        mock_service.delete_variant.side_effect = ValueError("Cannot delete baseline variant")

        response = client.delete("/api/scenario-modeler/sessions/1/variants/1")

        assert response.status_code == 400

    # =========================================================================
    # Comparison Endpoints
    # =========================================================================

    def test_get_comparison(self, client, mock_service):
        """Test getting comparison report"""
        mock_session = ScenarioSession(id=1, roadmap_session_id=10, name="Test", status="completed")
        mock_variants = [
            ScenarioVariant(id=1, session_id=1, name="Baseline", is_baseline=True, risk_score=30),
            ScenarioVariant(id=2, session_id=1, name="Variant A", is_baseline=False, risk_score=45),
        ]
        mock_comparison = ScenarioComparisonReport(
            session_id=1,
            baseline_variant_id=1,
            variants=mock_variants,
            timeline_comparison={
                "1": {"total_sprints": 12, "delta_from_baseline": 0},
                "2": {"total_sprints": 10, "delta_from_baseline": -2},
            },
            risk_comparison={
                "1": {"risk_score": 30},
                "2": {"risk_score": 45},
            },
            recommendations=["Consider variant A for faster delivery"],
        )
        mock_response = ScenarioSessionResponse(
            session=mock_session,
            variants=mock_variants,
            comparison=mock_comparison,
        )
        mock_service.get_full_session.return_value = mock_response

        response = client.get("/api/scenario-modeler/sessions/1/comparison")

        assert response.status_code == 200
        data = response.json()
        assert data["sessionId"] == 1
        assert data["baselineVariantId"] == 1
        assert len(data["recommendations"]) == 1

    def test_get_comparison_not_ready(self, client, mock_service):
        """Test getting comparison when not enough variants"""
        mock_session = ScenarioSession(id=1, roadmap_session_id=10, name="Test", status="draft")
        mock_response = ScenarioSessionResponse(
            session=mock_session,
            variants=[],
            comparison=None,
        )
        mock_service.get_full_session.return_value = mock_response

        response = client.get("/api/scenario-modeler/sessions/1/comparison")

        assert response.status_code == 400

    def test_get_comparison_session_not_found(self, client, mock_service):
        """Test getting comparison for non-existent session"""
        mock_service.get_full_session.return_value = None

        response = client.get("/api/scenario-modeler/sessions/999/comparison")

        assert response.status_code == 404

    # =========================================================================
    # Template Endpoints
    # =========================================================================

    def test_get_templates(self, client, mock_service):
        """Test getting scenario templates"""
        mock_service.get_scenario_templates.return_value = list(SCENARIO_TEMPLATES.values())

        response = client.get("/api/scenario-modeler/templates")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        # Check that templates have expected structure
        for template in data:
            assert "name" in template
            assert "description" in template
            assert "variable_changes" in template
