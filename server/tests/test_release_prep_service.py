"""
Unit tests for Release Prep Service

Tests the service layer for Release Prep Agent functionality.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from app.models.release_prep import (
    ReleasePrepSession,
    ReleasePrepSessionCreate,
    ReleaseStory,
    ReleaseNote,
    ReleaseNoteUpdate,
    Decision,
    DecisionUpdate,
    TechnicalDebtItem,
    TechnicalDebtItemUpdate,
    TechnicalDebtItemCreate,
)
from app.services.release_prep_service import ReleasePrepService


class TestReleasePrepService:
    """Tests for ReleasePrepService"""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        db = Mock()
        db.add = Mock()
        db.commit = Mock()
        db.refresh = Mock(side_effect=lambda x: setattr(x, 'id', 1))
        db.get = Mock()
        db.exec = Mock()
        db.delete = Mock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create a service instance with mock db"""
        return ReleasePrepService(mock_db)

    # =========================================================================
    # Session Management Tests
    # =========================================================================

    def test_create_session_basic(self, service, mock_db):
        """Test creating a basic session"""
        data = ReleasePrepSessionCreate(
            release_name="Test Release",
        )

        session = service.create_session(data)

        assert session.release_name == "Test Release"
        assert session.status == "draft"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_create_session_with_stories(self, service, mock_db):
        """Test creating a session with story artifact IDs"""
        data = ReleasePrepSessionCreate(
            release_name="Release with Stories",
            story_artifact_ids=[1, 2, 3],
        )

        session = service.create_session(data)

        assert session.story_artifact_ids == [1, 2, 3]

    def test_create_session_with_manual_stories(self, service, mock_db):
        """Test creating a session with manual stories"""
        data = ReleasePrepSessionCreate(
            release_name="Manual Release",
            manual_stories=[
                {"title": "Manual Story 1", "content": "Description", "story_type": "feature"}
            ],
        )

        session = service.create_session(data)

        assert len(session.manual_stories) == 1
        assert session.manual_stories[0]["title"] == "Manual Story 1"

    def test_create_session_with_knowledge_bases(self, service, mock_db):
        """Test creating a session with knowledge base IDs"""
        data = ReleasePrepSessionCreate(
            release_name="Release with KB",
            knowledge_base_ids=[10, 20, 30],
        )

        session = service.create_session(data)

        assert session.knowledge_base_ids == [10, 20, 30]
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_get_session_found(self, service, mock_db):
        """Test getting an existing session"""
        mock_session = ReleasePrepSession(
            id=1,
            release_name="Test",
            status="draft",
        )
        mock_db.get.return_value = mock_session

        result = service.get_session(1)

        assert result == mock_session
        mock_db.get.assert_called_once_with(ReleasePrepSession, 1)

    def test_get_session_not_found(self, service, mock_db):
        """Test getting a non-existent session"""
        mock_db.get.return_value = None

        result = service.get_session(999)

        assert result is None

    def test_get_sessions_all(self, service, mock_db):
        """Test getting all sessions"""
        mock_sessions = [
            ReleasePrepSession(id=1, release_name="Test 1", status="draft"),
            ReleasePrepSession(id=2, release_name="Test 2", status="completed"),
        ]
        mock_result = Mock()
        mock_result.all.return_value = mock_sessions
        mock_db.exec.return_value = mock_result

        result = service.get_sessions()

        assert len(result) == 2

    def test_delete_session(self, service, mock_db):
        """Test deleting a session"""
        mock_session = ReleasePrepSession(id=1, release_name="Test", status="draft")
        mock_db.get.return_value = mock_session

        mock_result = Mock()
        mock_result.all.return_value = []
        mock_db.exec.return_value = mock_result

        result = service.delete_session(1)

        assert result is True
        mock_db.delete.assert_called()
        mock_db.commit.assert_called()

    def test_delete_session_not_found(self, service, mock_db):
        """Test deleting a non-existent session"""
        mock_db.get.return_value = None

        result = service.delete_session(999)

        assert result is False

    # =========================================================================
    # Release Note Update Tests
    # =========================================================================

    def test_update_release_note(self, service, mock_db):
        """Test updating a release note"""
        mock_note = ReleaseNote(
            id=1,
            session_id=1,
            title="Original Title",
            description="Original description",
            category="feature",
        )
        mock_db.get.return_value = mock_note

        update_data = ReleaseNoteUpdate(
            title="Updated Title",
            description="Updated description",
        )

        result = service.update_release_note(1, update_data)

        assert result.title == "Updated Title"
        assert result.description == "Updated description"
        assert result.is_user_edited is True

    def test_update_release_note_not_found(self, service, mock_db):
        """Test updating a non-existent release note"""
        mock_db.get.return_value = None

        update_data = ReleaseNoteUpdate(title="New Title")
        result = service.update_release_note(999, update_data)

        assert result is None

    def test_update_release_note_exclude(self, service, mock_db):
        """Test excluding a release note"""
        mock_note = ReleaseNote(
            id=1,
            session_id=1,
            title="Title",
            description="Description",
            category="feature",
            is_excluded=False,
        )
        mock_db.get.return_value = mock_note

        update_data = ReleaseNoteUpdate(is_excluded=True)
        result = service.update_release_note(1, update_data)

        assert result.is_excluded is True

    # =========================================================================
    # Decision Update Tests
    # =========================================================================

    def test_update_decision(self, service, mock_db):
        """Test updating a decision"""
        mock_decision = Decision(
            id=1,
            session_id=1,
            title="Original Decision",
            description="Original description",
            decision_type="technical",
        )
        mock_db.get.return_value = mock_decision

        update_data = DecisionUpdate(
            title="Updated Decision",
            rationale="New rationale",
        )

        result = service.update_decision(1, update_data)

        assert result.title == "Updated Decision"
        assert result.rationale == "New rationale"
        assert result.is_user_edited is True

    def test_update_decision_not_found(self, service, mock_db):
        """Test updating a non-existent decision"""
        mock_db.get.return_value = None

        update_data = DecisionUpdate(title="New Title")
        result = service.update_decision(999, update_data)

        assert result is None

    # =========================================================================
    # Technical Debt Tests
    # =========================================================================

    def test_update_debt_item(self, service, mock_db):
        """Test updating a debt item"""
        mock_item = TechnicalDebtItem(
            id=1,
            session_id=1,
            title="Original Debt",
            description="Original description",
            debt_type="code",
        )
        mock_db.get.return_value = mock_item

        update_data = TechnicalDebtItemUpdate(
            title="Updated Debt",
            impact_level="high",
        )

        result = service.update_debt_item(1, update_data)

        assert result.title == "Updated Debt"
        assert result.impact_level == "high"
        assert result.is_user_edited is True

    def test_create_debt_item(self, service, mock_db):
        """Test creating a new debt item manually"""
        mock_session = ReleasePrepSession(
            id=1,
            release_name="Test",
            total_debt_items=0,
        )
        mock_db.get.return_value = mock_session

        data = TechnicalDebtItemCreate(
            title="Manual Debt Item",
            description="Added manually",
            debt_type="architecture",
            impact_level="high",
        )

        result = service.create_debt_item(1, data)

        assert result.title == "Manual Debt Item"
        assert result.is_user_added is True
        assert result.introduced_in_release == "Test"

    def test_create_debt_item_session_not_found(self, service, mock_db):
        """Test creating debt item with invalid session"""
        mock_db.get.return_value = None

        data = TechnicalDebtItemCreate(
            title="Debt Item",
            description="Description",
        )

        with pytest.raises(ValueError, match="Session .* not found"):
            service.create_debt_item(999, data)

    # =========================================================================
    # Effort Parsing Tests
    # =========================================================================

    def test_parse_effort_days_range(self, service):
        """Test parsing day ranges"""
        assert service._parse_effort_to_days("2-3 days") == 2  # Average of 2,3

    def test_parse_effort_sprint(self, service):
        """Test parsing sprint references"""
        assert service._parse_effort_to_days("1 sprint") == 10
        assert service._parse_effort_to_days("2 sprints") == 20

    def test_parse_effort_weeks(self, service):
        """Test parsing week references"""
        assert service._parse_effort_to_days("1 week") == 5
        assert service._parse_effort_to_days("2 weeks") == 10

    def test_parse_effort_days(self, service):
        """Test parsing day references"""
        assert service._parse_effort_to_days("3 days") == 3
        assert service._parse_effort_to_days("5 days") == 5

    def test_parse_effort_empty(self, service):
        """Test parsing empty string"""
        assert service._parse_effort_to_days("") is None
        assert service._parse_effort_to_days(None) is None

    # =========================================================================
    # Export Tests
    # =========================================================================

    def test_export_release_notes_markdown(self, service, mock_db):
        """Test exporting release notes as markdown"""
        mock_session = ReleasePrepSession(
            id=1,
            release_name="Test Release",
        )
        mock_db.get.return_value = mock_session

        mock_notes = [
            ReleaseNote(
                id=1, session_id=1,
                title="New Dashboard",
                description="A brand new dashboard with analytics",
                category="feature",
                is_excluded=False,
                is_highlighted=True,
            ),
            ReleaseNote(
                id=2, session_id=1,
                title="Bug Fix",
                description="Fixed login issue",
                category="fix",
                is_excluded=False,
            ),
        ]
        mock_result = Mock()
        mock_result.all.return_value = mock_notes
        mock_db.exec.return_value = mock_result

        markdown = service.export_release_notes_markdown(1)

        assert "# Release Notes - Test Release" in markdown
        assert "## New Features" in markdown
        assert "### New Dashboard ⭐" in markdown
        assert "## Bug Fixes" in markdown
        assert "### Bug Fix" in markdown

    def test_export_release_notes_excludes_removed(self, service, mock_db):
        """Test that excluded notes are not exported"""
        mock_session = ReleasePrepSession(
            id=1,
            release_name="Test",
        )
        mock_db.get.return_value = mock_session

        mock_notes = [
            ReleaseNote(
                id=1, session_id=1,
                title="Included Note",
                description="This is included",
                category="feature",
                is_excluded=False,
            ),
            ReleaseNote(
                id=2, session_id=1,
                title="Excluded Note",
                description="This is excluded",
                category="feature",
                is_excluded=True,
            ),
        ]
        mock_result = Mock()
        mock_result.all.return_value = mock_notes
        mock_db.exec.return_value = mock_result

        markdown = service.export_release_notes_markdown(1)

        assert "Included Note" in markdown
        assert "Excluded Note" not in markdown

    def test_export_decision_log_markdown(self, service, mock_db):
        """Test exporting decision log as markdown"""
        mock_session = ReleasePrepSession(
            id=1,
            release_name="Test",
        )
        mock_db.get.return_value = mock_session

        mock_decisions = [
            Decision(
                id=1, session_id=1,
                title="Use PostgreSQL",
                description="We chose PostgreSQL for the database",
                decision_type="technical",
                context="Need a reliable database",
                rationale="Best fit for our requirements",
                alternatives_considered=["MySQL", "MongoDB"],
                impact_level="high",
                consequences="Better query performance",
                is_excluded=False,
            ),
        ]
        mock_result = Mock()
        mock_result.all.return_value = mock_decisions
        mock_db.exec.return_value = mock_result

        markdown = service.export_decision_log_markdown(1)

        assert "# Decision Log - Test" in markdown
        assert "## Use PostgreSQL" in markdown
        assert "**Type:** Technical" in markdown
        assert "### Rationale" in markdown
        assert "Best fit for our requirements" in markdown
        assert "### Alternatives Considered" in markdown
        assert "- MySQL" in markdown

    def test_export_debt_inventory_markdown(self, service, mock_db):
        """Test exporting debt inventory as markdown"""
        mock_session = ReleasePrepSession(
            id=1,
            release_name="Test",
        )
        mock_db.get.return_value = mock_session

        mock_debt = [
            TechnicalDebtItem(
                id=1, session_id=1,
                title="Refactor Auth Module",
                description="The auth module needs cleanup",
                debt_type="code",
                affected_area="Authentication",
                impact_level="high",
                effort_estimate="3 days",
                risk_if_unaddressed="Security vulnerabilities",
                status="identified",
                is_excluded=False,
            ),
            TechnicalDebtItem(
                id=2, session_id=1,
                title="Add Unit Tests",
                description="Missing tests for API",
                debt_type="testing",
                impact_level="medium",
                status="identified",
                is_excluded=False,
            ),
        ]
        mock_result = Mock()
        mock_result.all.return_value = mock_debt
        mock_db.exec.return_value = mock_result

        markdown = service.export_debt_inventory_markdown(1)

        assert "# Technical Debt Inventory - Test" in markdown
        assert "**Total Items:** 2" in markdown
        assert "🟠 High: 1" in markdown
        assert "🟡 Medium: 1" in markdown
        assert "### 🟠 Refactor Auth Module" in markdown
        assert "**Risk if Unaddressed:** Security vulnerabilities" in markdown


class TestAcceptanceCriteriaExtraction:
    """Tests for acceptance criteria extraction from structured content"""

    @pytest.fixture
    def service(self):
        mock_db = Mock()
        return ReleasePrepService(mock_db)

    def test_extract_from_epic(self, service):
        """Test extracting acceptance criteria from epic structure"""
        content = {
            "epic": {
                "features": [
                    {
                        "acceptanceCriteria": [
                            {"scenario": "Test 1", "given": "G", "when": "W", "then": "T"}
                        ],
                        "stories": [
                            {
                                "acceptanceCriteria": [
                                    {"scenario": "Test 2", "given": "G2", "when": "W2", "then": "T2"}
                                ]
                            }
                        ]
                    }
                ]
            }
        }

        result = service._extract_acceptance_criteria(content, "epic")

        assert len(result) == 2
        assert result[0]["scenario"] == "Test 1"
        assert result[1]["scenario"] == "Test 2"

    def test_extract_from_feature(self, service):
        """Test extracting acceptance criteria from feature structure"""
        content = {
            "feature": {
                "acceptanceCriteria": [
                    {"scenario": "Feature AC", "given": "G", "when": "W", "then": "T"}
                ],
                "stories": [
                    {
                        "acceptanceCriteria": [
                            {"scenario": "Story AC", "given": "G", "when": "W", "then": "T"}
                        ]
                    }
                ]
            }
        }

        result = service._extract_acceptance_criteria(content, "feature")

        assert len(result) == 2

    def test_extract_from_user_story(self, service):
        """Test extracting acceptance criteria from user story structure"""
        content = {
            "stories": [
                {
                    "acceptanceCriteria": [
                        {"scenario": "AC 1", "given": "G", "when": "W", "then": "T"},
                        {"scenario": "AC 2", "given": "G", "when": "W", "then": "T"},
                    ]
                }
            ]
        }

        result = service._extract_acceptance_criteria(content, "user_story")

        assert len(result) == 2

    def test_extract_empty_content(self, service):
        """Test extracting from empty content"""
        result = service._extract_acceptance_criteria({}, "epic")
        assert result == []

    def test_extract_missing_criteria(self, service):
        """Test extracting when no criteria exist"""
        content = {
            "feature": {
                "stories": []
            }
        }

        result = service._extract_acceptance_criteria(content, "feature")
        assert result == []


class TestKnowledgeBaseIntegration:
    """Tests for KB context retrieval"""

    @pytest.fixture
    def mock_db(self):
        db = Mock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ReleasePrepService(mock_db)

    def test_get_kb_context_no_kbs(self, service):
        """Test that empty string returned when no KBs configured"""
        session = ReleasePrepSession(
            id=1,
            release_name="Test",
            knowledge_base_ids=None,
        )
        result = service._get_kb_context(session, "test query")
        assert result == ""

    def test_get_kb_context_empty_list(self, service):
        """Test that empty string returned for empty KB list"""
        session = ReleasePrepSession(
            id=1,
            release_name="Test",
            knowledge_base_ids=[],
        )
        result = service._get_kb_context(session, "test query")
        assert result == ""

    @patch('app.services.release_prep_service.knowledge_base_service')
    def test_get_kb_context_with_results(self, mock_kb_service, service, mock_db):
        """Test KB context formatting with search results"""
        mock_kb_service.search.return_value = [
            {"documentName": "Doc1.pdf", "content": "Relevant content 1"},
            {"documentName": "Doc2.pdf", "content": "Relevant content 2"},
        ]

        session = ReleasePrepSession(
            id=1,
            release_name="Test",
            knowledge_base_ids=[10],
        )

        result = service._get_kb_context(session, "test query")

        assert "Doc1.pdf" in result
        assert "Relevant content 1" in result
        assert "Doc2.pdf" in result
        mock_kb_service.search.assert_called_once()

    @patch('app.services.release_prep_service.knowledge_base_service')
    def test_get_kb_context_handles_errors(self, mock_kb_service, service, mock_db):
        """Test that KB search errors don't break the pipeline"""
        mock_kb_service.search.side_effect = Exception("KB not found")

        session = ReleasePrepSession(
            id=1,
            release_name="Test",
            knowledge_base_ids=[10],
        )

        result = service._get_kb_context(session, "test query")
        assert result == ""  # Returns empty on error, doesn't raise


class TestReleaseTracking:
    """Tests for release tracking functionality"""

    @pytest.fixture
    def mock_db(self):
        db = Mock()
        db.add = Mock()
        db.commit = Mock()
        db.get = Mock()
        db.exec = Mock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ReleasePrepService(mock_db)

    def test_unrelease_artifact_success(self, service, mock_db):
        """Test unreleasing a single artifact"""
        from app.models.story_generator import GeneratedArtifact
        from datetime import datetime

        mock_artifact = Mock()
        mock_artifact.released_at = datetime.utcnow()
        mock_artifact.released_in_session_id = 1
        mock_db.get.return_value = mock_artifact

        result = service.unrelease_artifact(10)

        assert result is True
        assert mock_artifact.released_at is None
        assert mock_artifact.released_in_session_id is None
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_unrelease_artifact_not_found(self, service, mock_db):
        """Test unreleasing a non-existent artifact"""
        mock_db.get.return_value = None

        result = service.unrelease_artifact(999)

        assert result is False

    def test_unrelease_session_artifacts(self, service, mock_db):
        """Test unreleasing all artifacts from a session"""
        from app.models.story_generator import GeneratedArtifact

        mock_artifacts = [Mock(), Mock(), Mock()]
        mock_result = Mock()
        mock_result.all.return_value = mock_artifacts
        mock_db.exec.return_value = mock_result

        count = service.unrelease_session_artifacts(1)

        assert count == 3
        for artifact in mock_artifacts:
            assert artifact.released_at is None
            assert artifact.released_in_session_id is None
