"""
Tests for Roadmap Planner Service

Tests the multi-agent pipeline for transforming backlog items into roadmaps.
"""
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from sqlmodel import Session

from app.models.roadmap_planner import (
    RoadmapSession,
    RoadmapItem,
    RoadmapItemSegment,
    RoadmapDependency,
    RoadmapTheme,
    RoadmapMilestone,
    RoadmapSessionCreate,
    RoadmapItemUpdate,
    RoadmapDependencyCreate,
    RoadmapMilestoneCreate,
    RoadmapSegmentCreate,
    RoadmapSegmentUpdate,
    RoadmapSegmentBulkUpdate,
)
from app.services.roadmap_planner_service import RoadmapPlannerService


class TestRoadmapPlannerService:
    """Tests for RoadmapPlannerService"""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create a service instance with mocked dependencies"""
        return RoadmapPlannerService(mock_db)

    # =========================================================================
    # Session Management Tests
    # =========================================================================

    def test_create_session(self, service, mock_db):
        """Test creating a new roadmap session"""
        data = RoadmapSessionCreate(
            name="Q1 2025 Roadmap",
            artifactIds=[1, 2, 3],
            sprintLengthWeeks=2,
            teamVelocity=40,
            teamCount=2,
            bufferPercentage=20,
        )

        # Mock the session creation
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        result = service.create_session(data, user_id=1)

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert result.name == "Q1 2025 Roadmap"
        assert result.artifact_ids == [1, 2, 3]
        assert result.sprint_length_weeks == 2
        assert result.team_velocity == 40
        assert result.team_count == 2
        assert result.buffer_percentage == 20
        assert result.status == "draft"

    def test_create_session_default_team_count(self, service, mock_db):
        """Test creating session with default team count"""
        data = RoadmapSessionCreate(
            name="Single Team Roadmap",
            artifactIds=[1],
        )

        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        result = service.create_session(data)

        assert result.team_count == 1

    def test_get_session(self, service, mock_db):
        """Test getting a session by ID"""
        mock_session = RoadmapSession(id=1, name="Test Roadmap")
        mock_db.get = MagicMock(return_value=mock_session)

        result = service.get_session(1)

        mock_db.get.assert_called_once_with(RoadmapSession, 1)
        assert result == mock_session

    def test_get_session_not_found(self, service, mock_db):
        """Test getting a non-existent session"""
        mock_db.get = MagicMock(return_value=None)

        result = service.get_session(999)

        assert result is None

    def test_delete_session(self, service, mock_db):
        """Test deleting a session"""
        mock_session = RoadmapSession(id=1, name="Test Roadmap")
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.exec = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
        mock_db.delete = MagicMock()
        mock_db.commit = MagicMock()

        result = service.delete_session(1)

        assert result is True
        mock_db.delete.assert_called_with(mock_session)
        mock_db.commit.assert_called()

    # =========================================================================
    # Items CRUD Tests
    # =========================================================================

    def test_update_item(self, service, mock_db):
        """Test updating a roadmap item"""
        mock_item = RoadmapItem(
            id=1,
            session_id=1,
            title="Original Title",
            priority=3,
            effort_points=5,
        )
        mock_db.get = MagicMock(return_value=mock_item)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        update_data = RoadmapItemUpdate(
            title="Updated Title",
            priority=1,
            assignedSprint=2,
        )

        result = service.update_item(1, update_data)

        assert result.title == "Updated Title"
        assert result.priority == 1
        assert result.assigned_sprint == 2
        assert result.is_manually_positioned is True

    def test_update_item_not_found(self, service, mock_db):
        """Test updating a non-existent item"""
        mock_db.get = MagicMock(return_value=None)

        update_data = RoadmapItemUpdate(title="New Title")
        result = service.update_item(999, update_data)

        assert result is None

    # =========================================================================
    # Dependencies Tests
    # =========================================================================

    def test_create_dependency(self, service, mock_db):
        """Test creating a manual dependency"""
        mock_session = RoadmapSession(id=1, total_dependencies=0)
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapDependencyCreate(
            fromItemId=1,
            toItemId=2,
            dependencyType="blocks",
            rationale="Item 1 must complete before Item 2",
        )

        result = service.create_dependency(1, data)

        assert result.from_item_id == 1
        assert result.to_item_id == 2
        assert result.dependency_type == "blocks"
        assert result.is_manual is True
        assert result.confidence == 1.0

    def test_delete_dependency(self, service, mock_db):
        """Test deleting a dependency"""
        mock_session = RoadmapSession(id=1, total_dependencies=5)
        mock_dep = RoadmapDependency(id=1, session_id=1, from_item_id=1, to_item_id=2)

        mock_db.get = MagicMock(side_effect=[mock_dep, mock_session])
        mock_db.add = MagicMock()
        mock_db.delete = MagicMock()
        mock_db.commit = MagicMock()

        result = service.delete_dependency(1)

        assert result is True
        mock_db.delete.assert_called_with(mock_dep)

    # =========================================================================
    # Dependency Graph Tests
    # =========================================================================

    def test_detect_cycles_no_cycles(self, service, mock_db):
        """Test cycle detection with no cycles"""
        items = [
            RoadmapItem(id=1, session_id=1, title="Item 1"),
            RoadmapItem(id=2, session_id=1, title="Item 2"),
            RoadmapItem(id=3, session_id=1, title="Item 3"),
        ]
        dependencies = [
            RoadmapDependency(id=1, session_id=1, from_item_id=1, to_item_id=2, dependency_type="blocks"),
            RoadmapDependency(id=2, session_id=1, from_item_id=2, to_item_id=3, dependency_type="blocks"),
        ]

        has_cycles, cycle_items = service._detect_cycles(items, dependencies)

        assert has_cycles is False
        assert len(cycle_items) == 0

    def test_detect_cycles_with_cycle(self, service, mock_db):
        """Test cycle detection with a cycle present"""
        items = [
            RoadmapItem(id=1, session_id=1, title="Item 1"),
            RoadmapItem(id=2, session_id=1, title="Item 2"),
            RoadmapItem(id=3, session_id=1, title="Item 3"),
        ]
        # Create a cycle: 1 -> 2 -> 3 -> 1
        dependencies = [
            RoadmapDependency(id=1, session_id=1, from_item_id=1, to_item_id=2, dependency_type="blocks"),
            RoadmapDependency(id=2, session_id=1, from_item_id=2, to_item_id=3, dependency_type="blocks"),
            RoadmapDependency(id=3, session_id=1, from_item_id=3, to_item_id=1, dependency_type="blocks"),
        ]

        has_cycles, cycle_items = service._detect_cycles(items, dependencies)

        assert has_cycles is True
        assert len(cycle_items) > 0

    # =========================================================================
    # Topological Sort Tests
    # =========================================================================

    def test_topological_sort_simple(self, service, mock_db):
        """Test topological sort with simple dependencies"""
        items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", sequence_order=2),
            RoadmapItem(id=3, session_id=1, title="Item 3", sequence_order=3),
        ]
        # 1 blocks 2, 2 blocks 3
        dependencies = [
            RoadmapDependency(id=1, session_id=1, from_item_id=1, to_item_id=2, dependency_type="blocks"),
            RoadmapDependency(id=2, session_id=1, from_item_id=2, to_item_id=3, dependency_type="blocks"),
        ]

        result = service._topological_sort(items, dependencies)

        assert len(result) == 3
        # Item 1 should come before Item 2, Item 2 before Item 3
        assert result.index(items[0]) < result.index(items[1])
        assert result.index(items[1]) < result.index(items[2])

    def test_topological_sort_no_dependencies(self, service, mock_db):
        """Test topological sort with no dependencies preserves sequence order"""
        items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", sequence_order=3),
            RoadmapItem(id=2, session_id=1, title="Item 2", sequence_order=1),
            RoadmapItem(id=3, session_id=1, title="Item 3", sequence_order=2),
        ]

        result = service._topological_sort(items, [])

        # Should be sorted by sequence_order
        assert result[0].sequence_order == 1
        assert result[1].sequence_order == 2
        assert result[2].sequence_order == 3

    # =========================================================================
    # Milestone Tests
    # =========================================================================

    def test_create_milestone(self, service, mock_db):
        """Test creating a milestone"""
        mock_session = RoadmapSession(id=1, total_milestones=0)
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapMilestoneCreate(
            name="MVP Release",
            description="First release with core features",
            targetSprint=4,
            criteria=["Feature A complete", "Feature B complete"],
        )

        result = service.create_milestone(1, data)

        assert result.name == "MVP Release"
        assert result.target_sprint == 4
        assert len(result.criteria) == 2

    def test_delete_milestone(self, service, mock_db):
        """Test deleting a milestone"""
        mock_session = RoadmapSession(id=1, total_milestones=3)
        mock_milestone = RoadmapMilestone(id=1, session_id=1, name="Test")

        mock_db.get = MagicMock(side_effect=[mock_milestone, mock_session])
        mock_db.add = MagicMock()
        mock_db.delete = MagicMock()
        mock_db.commit = MagicMock()

        result = service.delete_milestone(1)

        assert result is True
        mock_db.delete.assert_called_with(mock_milestone)

    # =========================================================================
    # Sprint Summaries Tests
    # =========================================================================

    def test_get_sprint_summaries_single_team(self, service, mock_db):
        """Test getting sprint summaries with single team"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=1,
            buffer_percentage=20,
            sprint_length_weeks=2,
            start_date=datetime(2025, 1, 1),
        )
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", assigned_sprint=1, effort_points=10, is_excluded=False),
            RoadmapItem(id=2, session_id=1, title="Item 2", assigned_sprint=1, effort_points=15, is_excluded=False),
            RoadmapItem(id=3, session_id=1, title="Item 3", assigned_sprint=2, effort_points=20, is_excluded=False),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.exec = MagicMock(return_value=MagicMock(all=MagicMock(return_value=mock_items)))

        # Mock get_items
        with patch.object(service, 'get_items', return_value=mock_items):
            result = service.get_sprint_summaries(1)

        assert len(result) == 2  # Two sprints
        assert result[0].sprint_number == 1
        assert result[0].total_points == 25  # 10 + 15
        assert result[0].capacity == 32  # 40 * 1 * 0.8
        assert result[1].sprint_number == 2
        assert result[1].total_points == 20

    def test_get_sprint_summaries_multiple_teams(self, service, mock_db):
        """Test getting sprint summaries with multiple teams"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=3,  # 3 teams
            buffer_percentage=20,
            sprint_length_weeks=2,
            start_date=datetime(2025, 1, 1),
        )
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", assigned_sprint=1, effort_points=50, is_excluded=False),
            RoadmapItem(id=2, session_id=1, title="Item 2", assigned_sprint=1, effort_points=40, is_excluded=False),
        ]

        mock_db.get = MagicMock(return_value=mock_session)

        with patch.object(service, 'get_items', return_value=mock_items):
            result = service.get_sprint_summaries(1)

        assert len(result) == 1
        assert result[0].sprint_number == 1
        assert result[0].total_points == 90  # 50 + 40
        # Capacity = 40 * 3 * 0.8 = 96
        assert result[0].capacity == 96

    # =========================================================================
    # Export Tests
    # =========================================================================

    def test_export_roadmap_csv(self, service, mock_db):
        """Test CSV export"""
        mock_session = RoadmapSession(id=1, name="Test Roadmap")
        mock_items = [
            RoadmapItem(
                id=1,
                session_id=1,
                title="Item 1",
                item_type="story",
                priority=1,
                effort_points=5,
                assigned_sprint=1,
                status="planned",
                theme_id=None,
            ),
        ]
        mock_themes = []

        mock_db.get = MagicMock(return_value=mock_session)

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_themes', return_value=mock_themes):
                result = service.export_roadmap_csv(1)

        assert "ID,Title,Type,Priority,Effort,Sprint,Theme,Status" in result
        assert "Item 1" in result
        assert "story" in result

    def test_export_roadmap_json(self, service, mock_db):
        """Test JSON export"""
        mock_session = RoadmapSession(
            id=1,
            name="Test Roadmap",
            description="Test description",
            sprint_length_weeks=2,
            team_velocity=40,
            team_count=2,
            start_date=datetime(2025, 1, 1),
        )

        mock_db.get = MagicMock(return_value=mock_session)

        with patch.object(service, 'get_items', return_value=[]):
            with patch.object(service, 'get_themes', return_value=[]):
                with patch.object(service, 'get_dependencies', return_value=[]):
                    with patch.object(service, 'get_milestones', return_value=[]):
                        with patch.object(service, 'get_sprint_summaries', return_value=[]):
                            result = service.export_roadmap_json(1)

        assert result["session"]["name"] == "Test Roadmap"
        assert result["session"]["sprint_length_weeks"] == 2
        assert result["session"]["team_count"] == 2
        assert "items" in result
        assert "themes" in result
        assert "dependencies" in result

    # =========================================================================
    # Utility Tests
    # =========================================================================

    def test_safe_int_valid(self, service, mock_db):
        """Test _safe_int with valid values"""
        assert service._safe_int(5) == 5
        assert service._safe_int("10") == 10
        assert service._safe_int(3.7) == 3

    def test_safe_int_invalid(self, service, mock_db):
        """Test _safe_int with invalid values"""
        assert service._safe_int(None) is None
        assert service._safe_int(None, 5) == 5
        assert service._safe_int("abc") is None
        assert service._safe_int("abc", 10) == 10

    # =========================================================================
    # Capacity Calculation Tests
    # =========================================================================

    def test_capacity_calculation_single_team(self, service, mock_db):
        """Test capacity calculation with single team"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=1,
            buffer_percentage=20,
        )
        # Expected: 40 * 1 * 0.8 = 32
        expected = int(40 * 1 * (1 - 20 / 100))
        assert expected == 32

    def test_capacity_calculation_multiple_teams(self, service, mock_db):
        """Test capacity calculation with multiple teams"""
        # team_velocity=40, team_count=3, buffer=20%
        # Expected: 40 * 3 * 0.8 = 96
        expected = int(40 * 3 * (1 - 20 / 100))
        assert expected == 96

    def test_capacity_calculation_no_buffer(self, service, mock_db):
        """Test capacity calculation with no buffer"""
        # team_velocity=50, team_count=2, buffer=0%
        # Expected: 50 * 2 * 1.0 = 100
        expected = int(50 * 2 * (1 - 0 / 100))
        assert expected == 100

    def test_capacity_calculation_high_buffer(self, service, mock_db):
        """Test capacity calculation with high buffer"""
        # team_velocity=40, team_count=2, buffer=50%
        # Expected: 40 * 2 * 0.5 = 40
        expected = int(40 * 2 * (1 - 50 / 100))
        assert expected == 40

    # =========================================================================
    # Multi-Source Input Tests
    # =========================================================================

    def test_create_session_with_multiple_sources(self, service, mock_db):
        """Test creating session with feasibility and custom items"""
        data = RoadmapSessionCreate(
            name="Multi-Source Roadmap",
            artifactIds=[1, 2],
            feasibilityIds=[10, 11],
            customItems=[
                {"title": "Custom Feature 1", "description": "Description 1", "effortEstimate": 5},
                {"title": "Custom Feature 2", "effortEstimate": 8},
            ],
        )

        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        result = service.create_session(data)

        assert result.artifact_ids == [1, 2]
        assert result.feasibility_ids == [10, 11]
        assert len(result.custom_items) == 2
        assert result.custom_items[0]["title"] == "Custom Feature 1"
        assert result.custom_items[1]["effort_estimate"] == 8

    def test_create_session_empty_sources(self, service, mock_db):
        """Test creating session with no sources defaults to empty arrays"""
        data = RoadmapSessionCreate(name="Empty Sources Roadmap")

        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        result = service.create_session(data)

        assert result.artifact_ids == []
        assert result.feasibility_ids == []
        assert result.custom_items == []

    # =========================================================================
    # Team Assignment Tests
    # =========================================================================

    def test_team_assignment_single_team(self, service, mock_db):
        """Test that single team doesn't set assigned_team"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=1,
            buffer_percentage=20,
        )
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=10, sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", effort_points=15, sequence_order=2),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_dependencies', return_value=[]):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    service._stage_capacity(mock_session)
                )

        # Single team should not set assigned_team
        assert mock_items[0].assigned_team is None
        assert mock_items[1].assigned_team is None
        # But should set sprint
        assert mock_items[0].assigned_sprint == 1
        assert mock_items[1].assigned_sprint == 1

    def test_team_assignment_multiple_teams(self, service, mock_db):
        """Test that multiple teams distributes work across teams"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=2,
            buffer_percentage=20,
        )
        # Each team has 32 points capacity (40 * 0.8)
        # Items: 25 + 25 = 50 points total
        # Should distribute: Team 1 gets Item 1 (25 pts), Team 2 gets Item 2 (25 pts)
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=25, sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", effort_points=25, sequence_order=2),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_dependencies', return_value=[]):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    service._stage_capacity(mock_session)
                )

        # Both should be in sprint 1 but different teams
        assert mock_items[0].assigned_sprint == 1
        assert mock_items[1].assigned_sprint == 1
        assert mock_items[0].assigned_team == 1
        assert mock_items[1].assigned_team == 2

    def test_team_assignment_overflow_to_next_sprint(self, service, mock_db):
        """Test that items overflow to next sprint when team capacity is full"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=2,
            buffer_percentage=20,
        )
        # Each team has 32 points capacity
        # Items: 30 + 30 + 30 = 90 points
        # Sprint 1: Team 1 gets 30, Team 2 gets 30 (60 total)
        # Sprint 2: Team 1 gets 30
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=30, sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", effort_points=30, sequence_order=2),
            RoadmapItem(id=3, session_id=1, title="Item 3", effort_points=30, sequence_order=3),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_dependencies', return_value=[]):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    service._stage_capacity(mock_session)
                )

        # First two in sprint 1, third in sprint 2
        assert mock_items[0].assigned_sprint == 1
        assert mock_items[1].assigned_sprint == 1
        assert mock_items[2].assigned_sprint == 2
        # Different teams in sprint 1
        assert mock_items[0].assigned_team != mock_items[1].assigned_team

    def test_team_assignment_oversized_items(self, service, mock_db):
        """Test that oversized items span multiple sprints and are distributed across teams"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=2,
            buffer_percentage=20,
        )
        # Each team has 32 points capacity
        # Items: 160, 288, 96 points - all exceed capacity
        # Item 1 (160 pts): spans ceil(160/32) = 5 sprints
        # Item 2 (288 pts): spans ceil(288/32) = 9 sprints
        # Item 3 (96 pts): spans ceil(96/32) = 3 sprints
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="SSO Feature", effort_points=160, sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Adobe Analytics", effort_points=288, sequence_order=2),
            RoadmapItem(id=3, session_id=1, title="Apple Pay", effort_points=96, sequence_order=3),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_dependencies', return_value=[]):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    service._stage_capacity(mock_session)
                )

        # Items are distributed across teams with sprint spans
        # Item 1: Team 1, Sprint 1, spans 5 sprints (1-5)
        # Item 2: Team 2, Sprint 1, spans 9 sprints (1-9)
        # Item 3: Team 1, Sprint 6 (after Item 1 ends), spans 3 sprints (6-8)
        assert mock_items[0].assigned_sprint == 1
        assert mock_items[0].sprint_span == 5
        assert mock_items[0].assigned_team == 1
        assert mock_items[1].assigned_sprint == 1
        assert mock_items[1].sprint_span == 9
        assert mock_items[1].assigned_team == 2
        assert mock_items[2].assigned_sprint == 6
        assert mock_items[2].sprint_span == 3
        assert mock_items[2].assigned_team == 1

    def test_team_assignment_single_team_oversized(self, service, mock_db):
        """Test that single team handles oversized items with sprint spanning"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=1,
            buffer_percentage=20,
        )
        # Capacity is 32 points
        # Item 1 (50 pts): spans ceil(50/32) = 2 sprints
        # Item 2 (80 pts): spans ceil(80/32) = 3 sprints
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Feature 1", effort_points=50, sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Feature 2", effort_points=80, sequence_order=2),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_dependencies', return_value=[]):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    service._stage_capacity(mock_session)
                )

        # Item 1 starts at sprint 1, spans 2 sprints (1-2)
        # Item 2 starts at sprint 3, spans 3 sprints (3-5)
        assert mock_items[0].assigned_sprint == 1
        assert mock_items[0].sprint_span == 2
        assert mock_items[0].assigned_team is None
        assert mock_items[1].assigned_sprint == 3
        assert mock_items[1].sprint_span == 3
        assert mock_items[1].assigned_team is None

    # =========================================================================
    # Segment CRUD Tests
    # =========================================================================

    def test_create_segment(self, service, mock_db):
        """Test creating a new segment for an item"""
        mock_item = RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=30)
        mock_db.get = MagicMock(return_value=mock_item)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        # Mock get_segments_for_item to return empty list
        with patch.object(service, 'get_segments_for_item', return_value=[]):
            data = RoadmapSegmentCreate(
                itemId=1,
                assignedTeam=2,
                startSprint=3,
                sprintCount=2,
                effortPoints=15,
                label="Phase 1",
            )

            result = service.create_segment(data)

        assert result.item_id == 1
        assert result.assigned_team == 2
        assert result.start_sprint == 3
        assert result.sprint_count == 2
        assert result.effort_points == 15
        assert result.label == "Phase 1"
        assert result.is_manually_positioned is True
        assert result.sequence_order == 0

    def test_create_segment_with_existing_segments(self, service, mock_db):
        """Test creating a segment when item already has segments"""
        mock_item = RoadmapItem(id=1, session_id=1, title="Item 1")
        existing_segments = [
            RoadmapItemSegment(id=1, item_id=1, sequence_order=0),
            RoadmapItemSegment(id=2, item_id=1, sequence_order=1),
        ]
        mock_db.get = MagicMock(return_value=mock_item)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        with patch.object(service, 'get_segments_for_item', return_value=existing_segments):
            data = RoadmapSegmentCreate(itemId=1, assignedTeam=1)

            result = service.create_segment(data)

        # sequence_order should be max + 1 = 2
        assert result.sequence_order == 2

    def test_create_segment_item_not_found(self, service, mock_db):
        """Test creating segment for non-existent item raises error"""
        mock_db.get = MagicMock(return_value=None)

        data = RoadmapSegmentCreate(itemId=999, assignedTeam=1)

        with pytest.raises(ValueError, match="Item 999 not found"):
            service.create_segment(data)

    def test_update_segment(self, service, mock_db):
        """Test updating a segment"""
        mock_segment = RoadmapItemSegment(
            id=1,
            item_id=1,
            assigned_team=1,
            start_sprint=1,
            sprint_count=1,
            effort_points=10,
        )
        mock_db.get = MagicMock(return_value=mock_segment)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapSegmentUpdate(
            assignedTeam=2,
            startSprint=3,
            sprintCount=2,
        )

        result = service.update_segment(1, data)

        assert result.assigned_team == 2
        assert result.start_sprint == 3
        assert result.sprint_count == 2
        assert result.is_manually_positioned is True

    def test_update_segment_not_found(self, service, mock_db):
        """Test updating non-existent segment returns None"""
        mock_db.get = MagicMock(return_value=None)

        data = RoadmapSegmentUpdate(assignedTeam=2)
        result = service.update_segment(999, data)

        assert result is None

    def test_update_segment_only_status(self, service, mock_db):
        """Test updating segment status doesn't mark as manually positioned"""
        mock_segment = RoadmapItemSegment(
            id=1,
            item_id=1,
            assigned_team=1,
            start_sprint=1,
            is_manually_positioned=False,
        )
        mock_db.get = MagicMock(return_value=mock_segment)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapSegmentUpdate(status="completed")

        result = service.update_segment(1, data)

        assert result.status == "completed"
        # Status-only change shouldn't mark as manually positioned
        assert result.is_manually_positioned is False

    def test_delete_segment(self, service, mock_db):
        """Test deleting a segment"""
        mock_segment = RoadmapItemSegment(id=1, item_id=1)
        mock_db.get = MagicMock(return_value=mock_segment)
        mock_db.delete = MagicMock()
        mock_db.commit = MagicMock()

        result = service.delete_segment(1)

        assert result is True
        mock_db.delete.assert_called_with(mock_segment)

    def test_delete_segment_not_found(self, service, mock_db):
        """Test deleting non-existent segment returns False"""
        mock_db.get = MagicMock(return_value=None)

        result = service.delete_segment(999)

        assert result is False

    def test_delete_segments_for_item(self, service, mock_db):
        """Test deleting all segments for an item"""
        mock_segments = [
            RoadmapItemSegment(id=1, item_id=1),
            RoadmapItemSegment(id=2, item_id=1),
            RoadmapItemSegment(id=3, item_id=1),
        ]
        mock_db.delete = MagicMock()
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_segments_for_item', return_value=mock_segments):
            result = service.delete_segments_for_item(1)

        assert result == 3
        assert mock_db.delete.call_count == 3

    def test_regenerate_segments_for_item(self, service, mock_db):
        """Test regenerating segments from item's current assignment"""
        mock_item = RoadmapItem(
            id=1,
            session_id=1,
            title="Item 1",
            effort_points=40,
            assigned_sprint=2,
            sprint_span=3,
            assigned_team=2,
        )
        mock_db.get = MagicMock(return_value=mock_item)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        with patch.object(service, 'delete_segments_for_item', return_value=2):
            result = service.regenerate_segments_for_item(1)

        assert len(result) == 1
        segment = result[0]
        assert segment.item_id == 1
        assert segment.assigned_team == 2
        assert segment.start_sprint == 2
        assert segment.sprint_count == 3
        assert segment.effort_points == 40
        assert segment.is_manually_positioned is False

    def test_regenerate_segments_item_not_found(self, service, mock_db):
        """Test regenerating segments for non-existent item returns empty list"""
        mock_db.get = MagicMock(return_value=None)

        result = service.regenerate_segments_for_item(999)

        assert result == []

    def test_update_segments_bulk(self, service, mock_db):
        """Test bulk updating segments for drag-and-drop"""
        mock_item = RoadmapItem(id=1, session_id=1, title="Item 1")
        mock_segments = [
            RoadmapItemSegment(id=1, item_id=1, assigned_team=1, start_sprint=1),
            RoadmapItemSegment(id=2, item_id=1, assigned_team=1, start_sprint=2),
        ]

        def get_mock(model, id):
            if model == RoadmapItemSegment:
                return mock_segments[0] if id == 1 else mock_segments[1]
            return mock_item

        mock_db.get = MagicMock(side_effect=get_mock)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapSegmentBulkUpdate(
            segments=[
                {"id": 1, "assigned_team": 2, "start_sprint": 3},
                {"id": 2, "assigned_team": 3, "start_sprint": 4},
            ]
        )

        result = service.update_segments_bulk(1, data)

        assert len(result) == 2
        assert mock_segments[0].assigned_team == 2
        assert mock_segments[0].start_sprint == 3
        assert mock_segments[1].assigned_team == 3
        assert mock_segments[1].start_sprint == 4
        # All bulk updates mark as manually positioned
        assert mock_segments[0].is_manually_positioned is True
        assert mock_segments[1].is_manually_positioned is True

    def test_update_segments_bulk_skips_invalid_ids(self, service, mock_db):
        """Test bulk update skips segments that don't exist"""
        mock_item = RoadmapItem(id=1, session_id=1, title="Item 1")
        mock_segment = RoadmapItemSegment(id=1, item_id=1, assigned_team=1)

        def get_mock(model, id):
            if model == RoadmapItemSegment:
                return mock_segment if id == 1 else None
            return mock_item

        mock_db.get = MagicMock(side_effect=get_mock)
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapSegmentBulkUpdate(
            segments=[
                {"id": 1, "assigned_team": 2},
                {"id": 999, "assigned_team": 3},  # Non-existent
            ]
        )

        result = service.update_segments_bulk(1, data)

        assert len(result) == 1
        assert result[0].assigned_team == 2

    def test_update_segments_bulk_skips_wrong_session(self, service, mock_db):
        """Test bulk update skips segments that belong to different session"""
        mock_item_wrong_session = RoadmapItem(id=10, session_id=99, title="Wrong Session Item")
        mock_segment = RoadmapItemSegment(id=1, item_id=10, assigned_team=1)

        def get_mock(model, id):
            if model == RoadmapItemSegment:
                return mock_segment
            return mock_item_wrong_session

        mock_db.get = MagicMock(side_effect=get_mock)
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = RoadmapSegmentBulkUpdate(
            segments=[{"id": 1, "assigned_team": 2}]
        )

        # Updating session 1 but segment belongs to session 99
        result = service.update_segments_bulk(1, data)

        assert len(result) == 0

    # =========================================================================
    # Initial Segment Generation Tests
    # =========================================================================

    def test_generate_initial_segments(self, service, mock_db):
        """Test that capacity planning generates initial segments"""
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=20, assigned_sprint=1, sprint_span=1, assigned_team=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", effort_points=50, assigned_sprint=1, sprint_span=2, assigned_team=2),
        ]

        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        service._generate_initial_segments(mock_items, team_count=2)

        # Should have called add twice (once per item)
        assert mock_db.add.call_count == 2
        mock_db.commit.assert_called_once()

    def test_generate_initial_segments_skips_unassigned(self, service, mock_db):
        """Test that initial segment generation skips items without sprint assignment"""
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=20, assigned_sprint=1, sprint_span=1, assigned_team=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", effort_points=50, assigned_sprint=None),  # No sprint
        ]

        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()

        service._generate_initial_segments(mock_items, team_count=2)

        # Should only add segment for item with assigned sprint
        assert mock_db.add.call_count == 1

    def test_capacity_planning_creates_segments(self, service, mock_db):
        """Test that running capacity stage creates segments for all items"""
        mock_session = RoadmapSession(
            id=1,
            team_velocity=40,
            team_count=2,
            buffer_percentage=20,
        )
        mock_items = [
            RoadmapItem(id=1, session_id=1, title="Item 1", effort_points=25, sequence_order=1),
            RoadmapItem(id=2, session_id=1, title="Item 2", effort_points=25, sequence_order=2),
        ]

        mock_db.get = MagicMock(return_value=mock_session)
        add_calls = []
        mock_db.add = MagicMock(side_effect=lambda x: add_calls.append(x))
        mock_db.commit = MagicMock()

        with patch.object(service, 'get_items', return_value=mock_items):
            with patch.object(service, 'get_dependencies', return_value=[]):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    service._stage_capacity(mock_session)
                )

        # Should add items (2) + session updates + segments (2)
        # Check that RoadmapItemSegment instances were added
        segment_adds = [x for x in add_calls if isinstance(x, RoadmapItemSegment)]
        assert len(segment_adds) == 2

        # Verify segment properties
        for seg in segment_adds:
            assert seg.start_sprint is not None
            assert seg.assigned_team is not None
            assert seg.effort_points > 0
