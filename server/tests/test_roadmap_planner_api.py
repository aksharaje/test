"""
Tests for Roadmap Planner API Endpoints

Tests the REST API for the Roadmap Planner feature.
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.roadmap_planner import get_service
from app.models.roadmap_planner import (
    RoadmapSession,
    RoadmapItem,
    RoadmapDependency,
    RoadmapTheme,
    RoadmapMilestone,
    RoadmapSessionResponse,
    SprintSummary,
    DependencyGraph,
    AvailableArtifactForRoadmap,
)
from app.services.roadmap_planner_service import RoadmapPlannerService


class TestRoadmapPlannerAPI:
    """Tests for Roadmap Planner API endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock(spec=RoadmapPlannerService)

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
        """Test creating a new roadmap session"""
        mock_session = RoadmapSession(
            id=1,
            name="Q1 Roadmap",
            status="draft",
            artifact_ids=[1, 2, 3],
            sprint_length_weeks=2,
            team_velocity=40,
            team_count=2,
            buffer_percentage=20,
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/roadmap-planner/sessions",
            json={
                "name": "Q1 Roadmap",
                "artifactIds": [1, 2, 3],
                "sprintLengthWeeks": 2,
                "teamVelocity": 40,
                "teamCount": 2,
                "bufferPercentage": 20,
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Q1 Roadmap"
        assert data["status"] == "draft"
        assert data["teamCount"] == 2

    def test_list_sessions(self, client, mock_service):
        """Test listing all sessions"""
        mock_sessions = [
            RoadmapSession(id=1, name="Roadmap 1", status="completed"),
            RoadmapSession(id=2, name="Roadmap 2", status="draft"),
        ]
        mock_service.get_sessions.return_value = mock_sessions

        response = client.get("/api/roadmap-planner/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_session(self, client, mock_service):
        """Test getting a session with all data"""
        mock_session = RoadmapSession(id=1, name="Test Roadmap", status="completed")
        mock_items = [RoadmapItem(id=1, session_id=1, title="Item 1")]
        mock_deps = []
        mock_themes = [RoadmapTheme(id=1, session_id=1, name="Theme 1", color="#3b82f6")]
        mock_milestones = []

        mock_service.get_session.return_value = mock_session
        mock_service.get_items.return_value = mock_items
        mock_service.get_dependencies.return_value = mock_deps
        mock_service.get_themes.return_value = mock_themes
        mock_service.get_milestones.return_value = mock_milestones

        response = client.get("/api/roadmap-planner/sessions/1")

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["name"] == "Test Roadmap"
        assert len(data["items"]) == 1
        assert len(data["themes"]) == 1

    def test_get_session_not_found(self, client, mock_service):
        """Test getting a non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/roadmap-planner/sessions/999")

        assert response.status_code == 404

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/roadmap-planner/sessions/1")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting a non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/roadmap-planner/sessions/999")

        assert response.status_code == 404

    def test_get_session_status(self, client, mock_service):
        """Test getting session status for polling"""
        mock_session = RoadmapSession(
            id=1,
            name="Test",
            status="processing",
            progress_step=2,
            progress_total=5,
            progress_message="Identifying dependencies...",
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/roadmap-planner/sessions/1/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["progressStep"] == 2
        assert data["progressTotal"] == 5
        assert data["progressMessage"] == "Identifying dependencies..."

    # =========================================================================
    # Available Artifacts (Epics/Features)
    # =========================================================================

    def test_get_available_artifacts(self, client, mock_service):
        """Test getting available epics/features for roadmap"""
        mock_artifacts = [
            AvailableArtifactForRoadmap(
                id=1,
                title="Epic 1",
                type="epic",
                status="draft",
                created_at=datetime.now(),
                preview="Test preview...",
                child_count=5,
            ),
            AvailableArtifactForRoadmap(
                id=2,
                title="Feature 1",
                type="feature",
                status="final",
                created_at=datetime.now(),
                preview="Another preview...",
                child_count=3,
                effort_estimate=20,
            ),
        ]
        mock_service.get_available_artifacts.return_value = mock_artifacts

        response = client.get("/api/roadmap-planner/available-artifacts")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["title"] == "Epic 1"
        assert data[0]["type"] == "epic"
        assert data[0]["childCount"] == 5
        assert data[1]["title"] == "Feature 1"
        assert data[1]["type"] == "feature"

    # =========================================================================
    # Items Endpoints
    # =========================================================================

    def test_get_items(self, client, mock_service):
        """Test getting items for a session"""
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", priority=1, effort_points=5),
            RoadmapItem(id=2, session_id=1, title="Item 2", priority=2, effort_points=3),
        ]
        mock_service.get_items.return_value = mock_items

        response = client.get("/api/roadmap-planner/sessions/1/items")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_item(self, client, mock_service):
        """Test updating an item"""
        mock_item = RoadmapItem(
            id=1,
            session_id=1,
            title="Updated Title",
            priority=1,
            assigned_sprint=2,
        )
        mock_service.update_item.return_value = mock_item

        response = client.patch(
            "/api/roadmap-planner/sessions/1/items/1",
            json={"title": "Updated Title", "priority": 1, "assignedSprint": 2}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    # =========================================================================
    # Dependencies Endpoints
    # =========================================================================

    def test_create_dependency(self, client, mock_service):
        """Test creating a dependency"""
        mock_dep = RoadmapDependency(
            id=1,
            session_id=1,
            from_item_id=1,
            to_item_id=2,
            dependency_type="blocks",
            is_manual=True,
        )
        mock_service.create_dependency.return_value = mock_dep

        response = client.post(
            "/api/roadmap-planner/sessions/1/dependencies",
            json={"fromItemId": 1, "toItemId": 2, "dependencyType": "blocks"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["fromItemId"] == 1
        assert data["toItemId"] == 2

    def test_delete_dependency(self, client, mock_service):
        """Test deleting a dependency"""
        mock_service.delete_dependency.return_value = True

        response = client.delete("/api/roadmap-planner/sessions/1/dependencies/1")

        assert response.status_code == 200

    def test_get_dependency_graph(self, client, mock_service):
        """Test getting dependency graph"""
        mock_graph = DependencyGraph(
            nodes=[],
            edges=[],
            has_cycles=False,
            cycle_items=[],
        )
        mock_service.get_dependency_graph.return_value = mock_graph

        response = client.get("/api/roadmap-planner/sessions/1/dependency-graph")

        assert response.status_code == 200
        data = response.json()
        assert data["hasCycles"] is False

    # =========================================================================
    # Milestones Endpoints
    # =========================================================================

    def test_create_milestone(self, client, mock_service):
        """Test creating a milestone"""
        mock_milestone = RoadmapMilestone(
            id=1,
            session_id=1,
            name="MVP Release",
            target_sprint=4,
            status="planned",
        )
        mock_service.create_milestone.return_value = mock_milestone

        response = client.post(
            "/api/roadmap-planner/sessions/1/milestones",
            json={"name": "MVP Release", "targetSprint": 4}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "MVP Release"

    def test_delete_milestone(self, client, mock_service):
        """Test deleting a milestone"""
        mock_service.delete_milestone.return_value = True

        response = client.delete("/api/roadmap-planner/sessions/1/milestones/1")

        assert response.status_code == 200

    # =========================================================================
    # Sprints Endpoint
    # =========================================================================

    def test_get_sprint_summaries(self, client, mock_service):
        """Test getting sprint summaries"""
        mock_summaries = [
            SprintSummary(
                sprint_number=1,
                total_points=25,
                capacity=32,
                utilization_percentage=78.1,
                item_count=3,
                items=[],
            ),
        ]
        mock_service.get_sprint_summaries.return_value = mock_summaries

        response = client.get("/api/roadmap-planner/sessions/1/sprints")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["sprintNumber"] == 1

    # =========================================================================
    # Export Endpoints
    # =========================================================================

    def test_export_json(self, client, mock_service):
        """Test JSON export"""
        mock_session = RoadmapSession(id=1, name="Test")
        mock_service.get_session.return_value = mock_session
        mock_service.export_roadmap_json.return_value = {
            "session": {"id": 1, "name": "Test"},
            "items": [],
            "themes": [],
        }

        response = client.get("/api/roadmap-planner/sessions/1/export/json")

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["name"] == "Test"

    def test_export_csv(self, client, mock_service):
        """Test CSV export"""
        mock_session = RoadmapSession(id=1, name="Test")
        mock_service.get_session.return_value = mock_session
        mock_service.export_roadmap_csv.return_value = "ID,Title,Type\n1,Item 1,story"

        response = client.get("/api/roadmap-planner/sessions/1/export/csv")

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

    def test_export_unsupported_format(self, client, mock_service):
        """Test export with unsupported format"""
        mock_session = RoadmapSession(id=1, name="Test")
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/roadmap-planner/sessions/1/export/pdf")

        assert response.status_code == 400
