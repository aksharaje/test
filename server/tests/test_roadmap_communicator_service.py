"""
Tests for Roadmap Communicator Service

Tests the service layer for the Roadmap Communicator feature,
including session/presentation management and delete operations.
"""
import pytest
from unittest.mock import MagicMock
from sqlmodel import Session

from app.models.roadmap_communicator import (
    CommunicatorSession,
    GeneratedPresentation,
    CommunicatorSessionCreate,
)
from app.services.roadmap_communicator_service import RoadmapCommunicatorService


class TestRoadmapCommunicatorServiceDelete:
    """Tests for delete operations with FK constraints"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create service with mock db"""
        return RoadmapCommunicatorService(mock_db)

    def test_delete_session_with_presentations(self, service, mock_db):
        """Test deleting session properly deletes presentations first"""
        # Setup mock session
        mock_session = CommunicatorSession(
            id=1,
            roadmap_session_id=10,
            name="Test Session",
            status="completed",
        )
        mock_db.get.return_value = mock_session

        # Setup mock presentations
        mock_presentations = [
            GeneratedPresentation(
                id=1,
                session_id=1,
                audience_type="executive",
                status="completed",
            ),
            GeneratedPresentation(
                id=2,
                session_id=1,
                audience_type="engineering",
                status="completed",
            ),
        ]
        mock_db.exec.return_value.all.return_value = mock_presentations

        # Execute delete
        result = service.delete_session(1)

        # Verify presentations deleted first, then session
        assert result is True
        assert mock_db.delete.call_count == 3  # 2 presentations + 1 session
        assert mock_db.commit.call_count == 2  # One for presentations, one for session

        # Verify order: presentations deleted first
        delete_calls = mock_db.delete.call_args_list
        assert delete_calls[0][0][0] == mock_presentations[0]
        assert delete_calls[1][0][0] == mock_presentations[1]
        assert delete_calls[2][0][0] == mock_session

    def test_delete_session_not_found(self, service, mock_db):
        """Test deleting non-existent session returns False"""
        mock_db.get.return_value = None

        result = service.delete_session(999)

        assert result is False
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()

    def test_delete_session_no_presentations(self, service, mock_db):
        """Test deleting session with no presentations"""
        mock_session = CommunicatorSession(
            id=1,
            roadmap_session_id=10,
            name="Empty Session",
            status="draft",
        )
        mock_db.get.return_value = mock_session
        mock_db.exec.return_value.all.return_value = []  # No presentations

        result = service.delete_session(1)

        assert result is True
        assert mock_db.delete.call_count == 1  # Only session
        assert mock_db.commit.call_count == 2  # Still two commits (one empty for presentations)


class TestRoadmapCommunicatorServicePresentations:
    """Tests for presentation management"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create service with mock db"""
        return RoadmapCommunicatorService(mock_db)

    def test_delete_presentation(self, service, mock_db):
        """Test deleting a presentation"""
        mock_session = CommunicatorSession(
            id=1,
            roadmap_session_id=10,
            name="Test Session",
            total_presentations=2,
        )
        mock_presentation = GeneratedPresentation(
            id=1,
            session_id=1,
            audience_type="executive",
            status="completed",
        )

        # Mock db.get to return presentation first, then session
        mock_db.get.side_effect = [mock_presentation, mock_session]

        result = service.delete_presentation(1)

        assert result is True
        mock_db.delete.assert_called_once_with(mock_presentation)
        mock_db.commit.assert_called_once()
        assert mock_session.total_presentations == 1

    def test_delete_presentation_not_found(self, service, mock_db):
        """Test deleting non-existent presentation"""
        mock_db.get.return_value = None

        result = service.delete_presentation(999)

        assert result is False
        mock_db.delete.assert_not_called()

    def test_get_presentations(self, service, mock_db):
        """Test getting presentations for a session"""
        mock_presentations = [
            GeneratedPresentation(id=1, session_id=1, audience_type="executive"),
            GeneratedPresentation(id=2, session_id=1, audience_type="engineering"),
        ]
        mock_db.exec.return_value.all.return_value = mock_presentations

        result = service.get_presentations(1)

        assert len(result) == 2
        mock_db.exec.assert_called_once()
