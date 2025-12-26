"""
Tests for Research Planner Service

Unit tests for the research planner service business logic.
"""
import pytest
from unittest.mock import patch, Mock, MagicMock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from datetime import datetime

from app.models.research_planner import (
    ResearchPlanSession,
    RecommendedMethod,
    InterviewGuide,
    Survey,
    RecruitingPlan
)
from app.services.research_planner_service import ResearchPlannerService, research_planner_service


# Set up test database
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@pytest.fixture
def db_session():
    """Create fresh database session for each test"""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


class TestResearchPlannerServiceSessionManagement:
    """Test suite for session management methods"""

    def test_create_session_basic(self, db_session):
        """Test basic session creation"""
        service = ResearchPlannerService()

        session = service.create_session(
            db=db_session,
            objective="Understand why users abandon checkout",
            constraints={"budget": "moderate", "timeline": "normal"}
        )

        assert session.id is not None
        assert session.objective == "Understand why users abandon checkout"
        assert session.status == "pending"
        assert session.constraints["budget"] == "moderate"

    def test_create_session_with_context_sources(self, db_session):
        """Test session creation with context sources"""
        service = ResearchPlannerService()

        session = service.create_session(
            db=db_session,
            objective="Research user pain points based on prior analysis",
            knowledge_base_ids=[1, 2, 3],
            ideation_session_id=5,
            feasibility_session_id=10,
            business_case_session_id=15
        )

        assert session.knowledge_base_ids == [1, 2, 3]
        assert session.ideation_session_id == 5
        assert session.feasibility_session_id == 10
        assert session.business_case_session_id == 15

    def test_create_session_validation(self, db_session):
        """Test validation for short objective"""
        service = ResearchPlannerService()

        with pytest.raises(ValueError, match="at least 10 characters"):
            service.create_session(
                db=db_session,
                objective="Short"  # Less than 10 chars
            )

    def test_get_session(self, db_session):
        """Test retrieving a session by ID"""
        service = ResearchPlannerService()

        # Create session
        created = service.create_session(
            db=db_session,
            objective="Test session retrieval"
        )

        # Retrieve session
        retrieved = service.get_session(db_session, created.id)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.objective == "Test session retrieval"

    def test_get_session_not_found(self, db_session):
        """Test retrieving non-existent session"""
        service = ResearchPlannerService()
        result = service.get_session(db_session, 99999)
        assert result is None

    def test_list_sessions(self, db_session):
        """Test listing sessions"""
        service = ResearchPlannerService()

        # Create multiple sessions
        for i in range(5):
            service.create_session(
                db=db_session,
                objective=f"Test session number {i}"
            )

        sessions = service.list_sessions(db_session)

        assert len(sessions) == 5

    def test_list_sessions_with_pagination(self, db_session):
        """Test session listing with pagination"""
        service = ResearchPlannerService()

        # Create 10 sessions
        for i in range(10):
            service.create_session(
                db=db_session,
                objective=f"Paginated session {i}"
            )

        # Get first page
        page1 = service.list_sessions(db_session, skip=0, limit=5)
        assert len(page1) == 5

        # Get second page
        page2 = service.list_sessions(db_session, skip=5, limit=5)
        assert len(page2) == 5

    def test_select_methods(self, db_session):
        """Test selecting methods for a session"""
        service = ResearchPlannerService()

        # Create session
        session = service.create_session(
            db=db_session,
            objective="Test method selection"
        )

        # Add recommended methods
        for method_name in ["user_interviews", "surveys", "usability_testing"]:
            method = RecommendedMethod(
                session_id=session.id,
                method_name=method_name,
                method_label=method_name.replace("_", " ").title(),
                rationale="Test rationale",
                effort="medium",
                cost_estimate="$1000",
                timeline="2 weeks",
                participant_count="10",
                confidence_score=0.8,
                display_order=0
            )
            db_session.add(method)
        db_session.commit()

        # Select methods
        updated = service.select_methods(
            db=db_session,
            session_id=session.id,
            method_names=["user_interviews", "surveys"]
        )

        assert set(updated.selected_methods) == {"user_interviews", "surveys"}

    def test_retry_session(self, db_session):
        """Test retrying a failed session"""
        service = ResearchPlannerService()

        # Create failed session
        session = ResearchPlanSession(
            objective="Failed session for retry test",
            status="failed",
            error_message="Test error",
            progress_step=1
        )
        db_session.add(session)
        db_session.commit()

        # Retry
        retried = service.retry_session(db_session, session.id)

        assert retried.status == "pending"
        assert retried.error_message is None
        assert retried.progress_step == 0

    def test_delete_session(self, db_session):
        """Test deleting a session"""
        service = ResearchPlannerService()

        # Create session with related data
        session = service.create_session(
            db=db_session,
            objective="Session to be deleted"
        )

        method = RecommendedMethod(
            session_id=session.id,
            method_name="test",
            method_label="Test",
            rationale="Test",
            effort="low",
            cost_estimate="$0",
            timeline="1 day",
            participant_count="1",
            confidence_score=0.5,
            display_order=0
        )
        db_session.add(method)
        db_session.commit()

        # Delete
        result = service.delete_session(db_session, session.id)

        assert result is True
        assert service.get_session(db_session, session.id) is None


class TestResearchPlannerServiceInstrumentUpdates:
    """Test suite for instrument update methods"""

    def test_update_interview_guide(self, db_session):
        """Test updating interview guide content"""
        service = ResearchPlannerService()

        # Create session and guide
        session = ResearchPlanSession(
            objective="Test interview guide update",
            status="completed"
        )
        db_session.add(session)
        db_session.commit()

        guide = InterviewGuide(
            session_id=session.id,
            participant_type="Users",
            duration_minutes=45,
            content_markdown="# Original\n\nContent",
            is_edited=False
        )
        db_session.add(guide)
        db_session.commit()

        # Update
        updated = service.update_interview_guide(
            db=db_session,
            guide_id=guide.id,
            content_markdown="# Updated\n\nNew content"
        )

        assert updated.user_edited_content == "# Updated\n\nNew content"
        assert updated.is_edited is True

    def test_update_survey(self, db_session):
        """Test updating survey questions"""
        service = ResearchPlannerService()

        # Create session and survey
        session = ResearchPlanSession(
            objective="Test survey update",
            status="completed"
        )
        db_session.add(session)
        db_session.commit()

        survey = Survey(
            session_id=session.id,
            target_audience="All users",
            survey_length="medium",
            questions=[{"id": "q1", "text": "Original question"}],
            is_edited=False
        )
        db_session.add(survey)
        db_session.commit()

        # Update
        new_questions = [
            {"id": "q1", "text": "Updated question 1"},
            {"id": "q2", "text": "New question 2"}
        ]
        updated = service.update_survey(
            db=db_session,
            survey_id=survey.id,
            questions=new_questions
        )

        assert len(updated.questions) == 2
        assert updated.is_edited is True


class TestResearchPlannerServiceHelpers:
    """Test suite for helper methods"""

    def test_mask_pii_comprehensive(self):
        """Test comprehensive PII masking"""
        service = ResearchPlannerService()

        text = """
        Contact: john.doe@company.com
        Phone: 555-123-4567
        Alt Phone: (555) 987-6543
        SSN: 123-45-6789
        Card: 4111111111111111
        """

        masked = service._mask_pii(text)

        assert "john.doe@company.com" not in masked
        assert "555-123-4567" not in masked
        assert "(555) 987-6543" not in masked
        assert "123-45-6789" not in masked
        assert "4111111111111111" not in masked
        assert "[EMAIL]" in masked
        assert "[PHONE]" in masked
        assert "[SSN]" in masked
        assert "[CARD]" in masked

    def test_mask_pii_empty(self):
        """Test PII masking with empty input"""
        service = ResearchPlannerService()
        assert service._mask_pii("") == ""
        assert service._mask_pii(None) is None

    def test_parse_llm_json_array(self):
        """Test parsing JSON array"""
        service = ResearchPlannerService()

        content = '[{"item": 1}, {"item": 2}]'
        result = service._parse_llm_json(content, "test")

        assert isinstance(result, list)
        assert len(result) == 2

    def test_parse_llm_json_with_prefix_text(self):
        """Test parsing JSON with text before it"""
        service = ResearchPlannerService()

        content = 'Here is the analysis:\n{"result": "success"}'
        result = service._parse_llm_json(content, "test")

        assert result["result"] == "success"

    def test_parse_llm_json_nested(self):
        """Test parsing nested JSON"""
        service = ResearchPlannerService()

        content = '{"outer": {"inner": {"deep": "value"}}}'
        result = service._parse_llm_json(content, "test")

        assert result["outer"]["inner"]["deep"] == "value"


class TestResearchPlannerServiceContextFetching:
    """Test suite for context fetching methods"""

    def test_fetch_ideation_context_not_found(self, db_session):
        """Test fetching context from non-existent ideation session"""
        service = ResearchPlannerService()

        result = service._fetch_ideation_context(db_session, 99999)

        assert result["text"] == ""
        assert result["metadata"] is None

    def test_fetch_feasibility_context_not_found(self, db_session):
        """Test fetching context from non-existent feasibility session"""
        service = ResearchPlannerService()

        result = service._fetch_feasibility_context(db_session, 99999)

        assert result["text"] == ""
        assert result["metadata"] is None

    def test_fetch_business_case_context_not_found(self, db_session):
        """Test fetching context from non-existent business case session"""
        service = ResearchPlannerService()

        result = service._fetch_business_case_context(db_session, 99999)

        assert result["text"] == ""
        assert result["metadata"] is None

    def test_build_aggregated_context_empty(self, db_session):
        """Test building context with no sources"""
        service = ResearchPlannerService()

        context_text, context_summary = service._build_aggregated_context(
            db=db_session,
            objective="Test objective"
        )

        assert context_text == ""
        assert context_summary == {}

    @patch('app.services.research_planner_service.research_planner_service._fetch_ideation_context')
    @patch('app.services.research_planner_service.research_planner_service._fetch_feasibility_context')
    def test_build_aggregated_context_with_data(self, mock_fetch_feasibility, mock_fetch_ideation, db_session):
        """Test building context with sources"""
        # Setup mocks
        mock_fetch_ideation.return_value = {
            "text": "Ideation context.",
            "metadata": {"ideaCount": 5}
        }
        mock_fetch_feasibility.return_value = {
            "text": "Feasibility context.",
            "metadata": {"goDecision": "go"}
        }

        service = ResearchPlannerService()

        context_text, context_summary = service._build_aggregated_context(
            db=db_session,
            objective="Test objective",
            ideation_session_id=1,
            feasibility_session_id=2
        )

        assert "Ideation context." in context_text
        assert "Feasibility context." in context_text
        assert context_summary["ideation"]["ideaCount"] == 5
        assert context_summary["feasibility"]["goDecision"] == "go"


class TestResearchPlannerServiceSessionDetail:
    """Test suite for session detail retrieval"""

    def test_get_session_detail_complete(self, db_session):
        """Test getting complete session detail with all instruments"""
        service = ResearchPlannerService()

        # Create session
        session = ResearchPlanSession(
            objective="Complete session detail test",
            status="completed",
            selected_methods=["user_interviews", "surveys"]
        )
        db_session.add(session)
        db_session.commit()

        # Add recommended methods
        method = RecommendedMethod(
            session_id=session.id,
            method_name="user_interviews",
            method_label="User Interviews",
            rationale="Deep insights",
            effort="medium",
            cost_estimate="$2000",
            timeline="3 weeks",
            participant_count="10",
            confidence_score=0.9,
            display_order=0,
            is_selected=True
        )
        db_session.add(method)

        # Add interview guide
        guide = InterviewGuide(
            session_id=session.id,
            participant_type="Power users",
            duration_minutes=60,
            content_markdown="# Guide\n\nContent",
            is_edited=False
        )
        db_session.add(guide)

        # Add survey
        survey = Survey(
            session_id=session.id,
            target_audience="All users",
            survey_length="medium",
            questions=[{"id": "q1", "text": "Question"}],
            is_edited=False
        )
        db_session.add(survey)

        # Add recruiting plan
        plan = RecruitingPlan(
            session_id=session.id,
            participant_count=12,
            expected_response_rate=0.15,
            contacts_needed=80,
            is_edited=False
        )
        db_session.add(plan)

        db_session.commit()

        # Get detail
        detail = service.get_session_detail(db_session, session.id)

        assert detail is not None
        assert detail["session"].id == session.id
        assert len(detail["recommendedMethods"]) == 1
        assert len(detail["interviewGuides"]) == 1
        assert len(detail["surveys"]) == 1
        assert len(detail["recruitingPlans"]) == 1

    def test_get_session_detail_not_found(self, db_session):
        """Test getting detail for non-existent session"""
        service = ResearchPlannerService()

        detail = service.get_session_detail(db_session, 99999)

        assert detail is None
