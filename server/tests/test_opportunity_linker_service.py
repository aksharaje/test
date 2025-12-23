"""
Tests for Opportunity Linker Service
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from sqlmodel import Session, select
from app.services.opportunity_linker_service import OpportunityLinkerService
from app.models.opportunity_linker import PrioritizationSession, PrioritizedIdea
from app.models.ideation import IdeationSession, GeneratedIdea


@pytest.fixture
def service():
    """Get opportunity linker service instance"""
    return OpportunityLinkerService()


@pytest.fixture
def mock_ideation_session():
    """Mock ideation session"""
    return IdeationSession(
        id=1,
        problem_statement="Users struggle with onboarding",
        status="completed",
        structured_problem={
            "who": "new users",
            "what": "struggle with onboarding",
            "impact": "$100K annually",
            "affects": "30% of users"
        }
    )


@pytest.fixture
def mock_generated_idea():
    """Mock generated idea"""
    return GeneratedIdea(
        id=1,
        session_id=1,
        title="Interactive Tutorial",
        description="Add an interactive tutorial to guide users",
        category="quick_wins",
        impact_score=8.0,
        feasibility_score=7.0,
        effort_score=6.0,
        risk_score=8.0,
        is_final=True
    )


def test_create_session_success(service, mock_ideation_session):
    """Test creating a prioritization session successfully"""
    mock_db = Mock(spec=Session)
    mock_db.get.return_value = mock_ideation_session
    mock_db.commit = Mock()
    mock_db.refresh = Mock(side_effect=lambda x: setattr(x, 'id', 1))

    session = service.create_session(mock_db, ideation_session_id=1)

    assert session.ideation_session_id == 1
    assert session.status == "pending"
    assert session.progress_step == 0
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()


def test_create_session_ideation_not_found(service):
    """Test error when ideation session not found"""
    mock_db = Mock(spec=Session)
    mock_db.get.return_value = None

    with pytest.raises(ValueError, match="Ideation session not found"):
        service.create_session(mock_db, ideation_session_id=999)


def test_create_session_ideation_not_completed(service):
    """Test error when ideation session not completed"""
    incomplete_session = IdeationSession(
        id=1,
        problem_statement="Test problem",
        status="processing"  # Not completed
    )
    mock_db = Mock(spec=Session)
    mock_db.get.return_value = incomplete_session

    with pytest.raises(ValueError, match="must be completed"):
        service.create_session(mock_db, ideation_session_id=1)


def test_agent_10_prioritization_p0_tier(service, mock_generated_idea):
    """Test prioritization assigns P0 tier for high scores"""
    # Set all scores high to ensure P0 tier
    mock_generated_idea.impact_score = 9.0
    mock_generated_idea.feasibility_score = 8.5
    mock_generated_idea.effort_score = 8.0
    mock_generated_idea.risk_score = 8.5

    # High strategic fit should result in P0
    result = service._agent_10_prioritization(mock_generated_idea, strategic_fit_score=9.0)

    assert result["priority_score"] >= 8.0
    assert result["priority_tier"] == "P0"


def test_agent_10_prioritization_p1_tier(service, mock_generated_idea):
    """Test prioritization assigns P1 tier for medium-high scores"""
    mock_generated_idea.impact_score = 6.0
    result = service._agent_10_prioritization(mock_generated_idea, strategic_fit_score=7.0)

    assert 6.5 <= result["priority_score"] < 8.0
    assert result["priority_tier"] == "P1"


def test_agent_10_prioritization_p3_tier(service, mock_generated_idea):
    """Test prioritization assigns P3 tier for low scores"""
    mock_generated_idea.impact_score = 3.0
    mock_generated_idea.feasibility_score = 4.0
    result = service._agent_10_prioritization(mock_generated_idea, strategic_fit_score=3.0)

    assert result["priority_score"] < 5.0
    assert result["priority_tier"] == "P3"


def test_agent_10_weighted_average_formula(service, mock_generated_idea):
    """Test that prioritization uses correct weighted average formula"""
    impact = 8.0
    strategic_fit = 7.0
    effort = 6.0
    feasibility = 7.0
    risk = 8.0

    mock_generated_idea.impact_score = impact
    mock_generated_idea.effort_score = effort
    mock_generated_idea.feasibility_score = feasibility
    mock_generated_idea.risk_score = risk

    result = service._agent_10_prioritization(mock_generated_idea, strategic_fit)

    # Expected: impact*0.30 + strategic_fit*0.25 + effort*0.20 + feasibility*0.15 + risk*0.10
    expected = (8.0 * 0.30) + (7.0 * 0.25) + (6.0 * 0.20) + (7.0 * 0.15) + (8.0 * 0.10)
    assert result["priority_score"] == round(expected, 2)


@patch('app.services.opportunity_linker_service.requests.post')
def test_call_llm_success(mock_post, service):
    """Test successful LLM call with JSON response"""
    mock_response = Mock()
    mock_response.json.return_value = {
        "choices": [{
            "message": {
                "content": '{"strategic_fit_score": 8.5, "rationale": "Direct solution"}'
            }
        }]
    }
    mock_response.raise_for_status = Mock()
    mock_post.return_value = mock_response

    result = service._call_llm("test prompt", "test system")

    assert result["strategic_fit_score"] == 8.5
    assert "rationale" in result
    mock_post.assert_called_once()


@patch('app.services.opportunity_linker_service.requests.post')
def test_call_llm_handles_prefix_characters(mock_post, service):
    """Test LLM call handles model quirks like prefix characters"""
    mock_response = Mock()
    # Simulate model returning prefix before JSON
    mock_response.json.return_value = {
        "choices": [{
            "message": {
                "content": '.{"score": 7.0}'
            }
        }]
    }
    mock_response.raise_for_status = Mock()
    mock_post.return_value = mock_response

    result = service._call_llm("test prompt")

    assert result["score"] == 7.0


@patch('app.services.opportunity_linker_service.requests.post')
def test_call_llm_timeout_retry(mock_post, service):
    """Test LLM call retries on timeout"""
    import requests

    # First call times out, second succeeds
    mock_post.side_effect = [
        requests.Timeout("Timeout"),
        Mock(
            json=lambda: {"choices": [{"message": {"content": '{"success": true}'}}]},
            raise_for_status=lambda: None
        )
    ]

    result = service._call_llm("test prompt", retry_count=2)

    assert result["success"] is True
    assert mock_post.call_count == 2


@patch('app.services.opportunity_linker_service.requests.post')
def test_call_llm_timeout_failure(mock_post, service):
    """Test LLM call fails after max retries"""
    import requests

    mock_post.side_effect = requests.Timeout("Timeout")

    with pytest.raises(Exception, match="timed out after retry"):
        service._call_llm("test prompt", retry_count=2)


def test_generate_portfolio_summary(service, mock_generated_idea):
    """Test portfolio summary generation"""
    prioritized_ideas = [
        PrioritizedIdea(
            id=1,
            prioritization_session_id=1,
            generated_idea_id=1,
            priority_tier="P0",
            priority_score=8.5,
            tshirt_size="M"
        ),
        PrioritizedIdea(
            id=2,
            prioritization_session_id=1,
            generated_idea_id=2,
            priority_tier="P0",
            priority_score=8.2,
            tshirt_size="S"
        ),
        PrioritizedIdea(
            id=3,
            prioritization_session_id=1,
            generated_idea_id=3,
            priority_tier="P1",
            priority_score=7.0,
            tshirt_size="L"
        ),
    ]

    original_ideas = [mock_generated_idea] * 3

    summary = service._generate_portfolio_summary(prioritized_ideas, original_ideas)

    assert summary["by_tier"]["p0"] == 2
    assert summary["by_tier"]["p1"] == 1
    assert summary["by_effort"]["M"] == 1
    assert summary["by_effort"]["S"] == 1
    assert summary["by_effort"]["L"] == 1
    assert len(summary["top_p0_recommendations"]) == 2  # Only 2 P0 ideas


def test_get_session(service):
    """Test getting a session by ID"""
    mock_db = Mock(spec=Session)
    mock_session = PrioritizationSession(id=1, ideation_session_id=1)
    mock_db.get.return_value = mock_session

    result = service.get_session(mock_db, 1)

    assert result.id == 1
    mock_db.get.assert_called_once_with(PrioritizationSession, 1)


def test_delete_session(service):
    """Test deleting a session"""
    mock_db = Mock(spec=Session)
    mock_session = PrioritizationSession(id=1, ideation_session_id=1)
    mock_db.get.return_value = mock_session
    mock_db.exec.return_value.all.return_value = []

    result = service.delete_session(mock_db, 1)

    assert result is True
    mock_db.delete.assert_called_once_with(mock_session)
    mock_db.commit.assert_called_once()


def test_delete_session_not_found(service):
    """Test deleting non-existent session"""
    mock_db = Mock(spec=Session)
    mock_db.get.return_value = None

    result = service.delete_session(mock_db, 999)

    assert result is False
