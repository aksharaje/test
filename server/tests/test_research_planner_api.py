"""
Tests for Research Planner API Endpoints

Tests the FastAPI endpoints for CX research planning workflow.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.models.research_planner import (
    ResearchPlanSession,
    RecommendedMethod,
    InterviewGuide,
    Survey,
    ResearchPlanSession,
    RecommendedMethod,
    InterviewGuide,
    Survey,
    RecruitingPlan
)
from app.models.knowledge_base import KnowledgeBase
from app.models.ideation import IdeationSession
from app.models.feasibility import FeasibilitySession
from app.models.business_case import BusinessCaseSession


# Set up test database at module level
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SQLModel.metadata.create_all(engine)


def get_test_session():
    """Override session dependency"""
    with Session(engine) as session:
        yield session


# Override dependency and create client
app.dependency_overrides[get_session] = get_test_session
client = TestClient(app)


@pytest.fixture
def clean_db():
    """Clean database before each test"""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


class TestResearchPlannerAPI:
    """Test suite for Research Planner API endpoints"""

    @patch('app.services.research_planner_service.research_planner_service.run_method_recommendation_pipeline')
    def test_create_session_success(self, mock_pipeline, clean_db):
        """Test creating a new research planning session"""
        response = client.post(
            "/api/cx/research-planner/sessions",
            json={
                "objective": "Why are enterprise customers dropping off during onboarding? We've seen a 30% drop in completion rates.",
                "constraints": {
                    "budget": "moderate",
                    "timeline": "normal",
                    "userAccess": True,
                    "remoteOnly": False
                }
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["status"] == "pending"
        assert data["objective"] is not None
        assert data["constraints"]["budget"] == "moderate"

    @patch('app.services.research_planner_service.research_planner_service.run_method_recommendation_pipeline')
    def test_create_session_with_context_sources(self, mock_pipeline, clean_db):
        """Test creating a session with optional context sources"""
        response = client.post(
            "/api/cx/research-planner/sessions",
            json={
                "objective": "Understand user pain points in the checkout flow based on prior ideation work.",
                "knowledgeBaseIds": [1, 2],
                "ideationSessionId": 5,
                "feasibilitySessionId": 3,
                "businessCaseSessionId": 2
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["knowledgeBaseIds"] == [1, 2]
        assert data["ideationSessionId"] == 5
        assert data["feasibilitySessionId"] == 3
        assert data["businessCaseSessionId"] == 2

    @patch('app.services.research_planner_service.research_planner_service.run_method_recommendation_pipeline')
    def test_create_session_validation_min_length(self, mock_pipeline, clean_db):
        """Test validation: objective too short"""
        response = client.post(
            "/api/cx/research-planner/sessions",
            json={
                "objective": "Short",  # Less than 10 chars
            },
        )

        assert response.status_code == 422  # Validation error

    def test_get_session_status(self, clean_db):
        """Test getting session status for polling"""
        # First create a session directly in DB
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Test research objective for status check",
                status="recommending",
                progress_step=1,
                progress_message="Analyzing research objective..."
            )
            session.add(research_session)
            session.commit()
            session_id = research_session.id

        # Get status
        response = client.get(f"/api/cx/research-planner/sessions/{session_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["status"] == "recommending"
        assert data["progressStep"] == 1
        assert data["progressMessage"] == "Analyzing research objective..."

    def test_get_session_detail(self, clean_db):
        """Test getting full session detail"""
        # Create session with recommended methods
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Understand checkout abandonment",
                status="selecting",
                progress_step=2
            )
            session.add(research_session)
            session.commit()
            session_id = research_session.id

            method = RecommendedMethod(
                session_id=session_id,
                method_name="user_interviews",
                method_label="User Interviews",
                rationale="Deep dive into user behavior",
                effort="medium",
                cost_estimate="$1,500-2,000",
                timeline="2-3 weeks",
                participant_count="8-12",
                confidence_score=0.85,
                display_order=0
            )
            session.add(method)
            session.commit()

        # Get detail
        response = client.get(f"/api/cx/research-planner/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["id"] == session_id
        assert len(data["recommendedMethods"]) == 1
        assert data["recommendedMethods"][0]["methodName"] == "user_interviews"

    def test_get_session_not_found(self, clean_db):
        """Test getting non-existent session"""
        response = client.get("/api/cx/research-planner/sessions/99999/status")
        assert response.status_code == 404

    def test_select_methods(self, clean_db):
        """Test selecting methods to proceed with"""
        # Create session with methods
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Research checkout flow issues",
                status="selecting",
                progress_step=2
            )
            session.add(research_session)
            session.commit()
            session_id = research_session.id

            for method_name in ["user_interviews", "surveys", "usability_testing"]:
                method = RecommendedMethod(
                    session_id=session_id,
                    method_name=method_name,
                    method_label=method_name.replace("_", " ").title(),
                    rationale="Recommended method",
                    effort="medium",
                    cost_estimate="$1,000",
                    timeline="2 weeks",
                    participant_count="10",
                    confidence_score=0.8,
                    display_order=0
                )
                session.add(method)
            session.commit()

        # Select methods
        response = client.post(
            f"/api/cx/research-planner/sessions/{session_id}/select-methods",
            json={"methodNames": ["user_interviews", "surveys"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert set(data["selectedMethods"]) == {"user_interviews", "surveys"}

    @patch('app.services.research_planner_service.research_planner_service.run_instrument_generation_pipeline')
    def test_generate_instruments(self, mock_pipeline, clean_db):
        """Test generating research instruments"""
        # Create session with selected methods
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Research user onboarding experience",
                status="selecting",
                selected_methods=["user_interviews", "surveys"],
                progress_step=2
            )
            session.add(research_session)
            session.commit()
            session_id = research_session.id

        # Generate instruments
        response = client.post(
            f"/api/cx/research-planner/sessions/{session_id}/generate-instruments",
            json={
                "interviewGuideConfig": {
                    "participantType": "New users",
                    "durationMinutes": 45,
                    "focusAreas": ["onboarding", "first impressions"]
                },
                "surveyConfig": {
                    "targetAudience": "Users who completed onboarding",
                    "surveyLength": "medium"
                },
                "recruitingConfig": {
                    "participantCriteria": {
                        "role": "Product Manager",
                        "companySize": "50-200"
                    },
                    "participantCount": 12
                }
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_update_interview_guide(self, clean_db):
        """Test updating interview guide content"""
        # Create session with interview guide
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Research feature adoption",
                status="completed",
                progress_step=5
            )
            session.add(research_session)
            session.commit()

            guide = InterviewGuide(
                session_id=research_session.id,
                participant_type="Power users",
                duration_minutes=60,
                content_markdown="# Original Guide\n\nSample content",
                is_edited=False
            )
            session.add(guide)
            session.commit()
            guide_id = guide.id

        # Update guide
        response = client.patch(
            f"/api/cx/research-planner/interview-guides/{guide_id}",
            json={"contentMarkdown": "# Updated Guide\n\nNew content"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userEditedContent"] == "# Updated Guide\n\nNew content"
        assert data["isEdited"] is True

    def test_delete_session(self, clean_db):
        """Test deleting a session and all related data"""
        # Create session with related data
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Test session for deletion",
                status="completed"
            )
            session.add(research_session)
            session.commit()
            session_id = research_session.id

            method = RecommendedMethod(
                session_id=session_id,
                method_name="surveys",
                method_label="Surveys",
                rationale="Quick feedback",
                effort="low",
                cost_estimate="$500",
                timeline="1 week",
                participant_count="50+",
                confidence_score=0.9,
                display_order=0
            )
            session.add(method)
            session.commit()

        # Delete session
        response = client.delete(f"/api/cx/research-planner/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify deletion
        response = client.get(f"/api/cx/research-planner/sessions/{session_id}/status")
        assert response.status_code == 404

    @patch('app.services.research_planner_service.research_planner_service.run_method_recommendation_pipeline')
    def test_retry_session(self, mock_pipeline, clean_db):
        """Test retrying a failed session"""
        # Create failed session
        with Session(engine) as session:
            research_session = ResearchPlanSession(
                objective="Failed research planning session",
                status="failed",
                error_message="API timeout",
                progress_step=0
            )
            session.add(research_session)
            session.commit()
            session_id = research_session.id

        # Retry
        response = client.post(f"/api/cx/research-planner/sessions/{session_id}/retry")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["errorMessage"] is None

    def test_get_context_sources(self, clean_db):
        """Test getting available context sources"""
        # Create some test data
        with Session(engine) as session:
            # Create Knowledge Base
            kb = KnowledgeBase(name="Test KB", description="Test Desc", index_name="test")
            session.add(kb)
            
            # Create Ideation Session
            ideation = IdeationSession(problem_statement="Test Problem", status="completed", confidence="high")
            session.add(ideation)
            
            # Create Feasibility Session
            # Note: Checking required fields for FeasibilitySession
            feasibility = FeasibilitySession(
                feature_description="Test Feature",
                status="completed",
                confidence_level="high",
                go_no_go_recommendation="go"
            )
            session.add(feasibility)
            
            # Create Business Case Session
            # Note: Checking required fields for BusinessCaseSession
            business_case = BusinessCaseSession(
                feature_name="Test Business Case", 
                status="completed",
                recommendation="invest"
            )
            session.add(business_case)
            
            session.commit()

        response = client.get("/api/cx/research-planner/context-sources")

        assert response.status_code == 200
        data = response.json()
        
        assert "knowledgeBases" in data
        assert "ideationSessions" in data
        assert "feasibilitySessions" in data
        assert "businessCaseSessions" in data
        
        # Verify lists are not empty
        assert len(data["knowledgeBases"]) == 1
        assert data["knowledgeBases"][0]["name"] == "Test KB"
        
        assert len(data["ideationSessions"]) == 1
        assert data["ideationSessions"][0]["problemStatement"] == "Test Problem"
        
        assert len(data["feasibilitySessions"]) == 1
        assert data["feasibilitySessions"][0]["featureDescription"] == "Test Feature"
        
        assert len(data["businessCaseSessions"]) == 1
        assert data["businessCaseSessions"][0]["featureName"] == "Test Business Case"


class TestResearchPlannerServiceUnit:
    """Unit tests for ResearchPlannerService methods"""

    def test_mask_pii_email(self, clean_db):
        """Test PII masking for emails"""
        from app.services.research_planner_service import research_planner_service

        text = "Contact john.doe@example.com for more info"
        masked = research_planner_service._mask_pii(text)

        assert "john.doe@example.com" not in masked
        assert "[EMAIL]" in masked

    def test_mask_pii_phone(self, clean_db):
        """Test PII masking for phone numbers"""
        from app.services.research_planner_service import research_planner_service

        text = "Call me at 555-123-4567 or (555) 987-6543"
        masked = research_planner_service._mask_pii(text)

        assert "555-123-4567" not in masked
        assert "(555) 987-6543" not in masked
        assert "[PHONE]" in masked

    def test_parse_llm_json_valid(self, clean_db):
        """Test JSON parsing with valid input"""
        from app.services.research_planner_service import research_planner_service

        content = '{"key": "value", "number": 42}'
        result = research_planner_service._parse_llm_json(content, "test")

        assert result["key"] == "value"
        assert result["number"] == 42

    def test_parse_llm_json_with_markdown(self, clean_db):
        """Test JSON parsing with markdown fences"""
        from app.services.research_planner_service import research_planner_service

        content = '```json\n{"key": "value"}\n```'
        result = research_planner_service._parse_llm_json(content, "test")

        assert result["key"] == "value"

    def test_parse_llm_json_empty(self, clean_db):
        """Test JSON parsing with empty input"""
        from app.services.research_planner_service import research_planner_service

        with pytest.raises(ValueError, match="Empty response"):
            research_planner_service._parse_llm_json("", "test")

    def test_parse_llm_json_no_json(self, clean_db):
        """Test JSON parsing with no JSON content"""
        from app.services.research_planner_service import research_planner_service

        with pytest.raises(ValueError, match="No JSON object found"):
            research_planner_service._parse_llm_json("This is just text", "test")
