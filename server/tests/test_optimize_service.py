import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session, select
from datetime import datetime, timedelta

from app.services.optimize_service import OptimizeService
from app.models.agent import Agent
from app.models.optimize import AgentExecution, PromptVersion, SplitTest
from app.models.feedback import Feedback
from app.models.story_generator import GeneratedArtifact, PromptTemplate, GenerationFeedback, StoryGeneratorSplitTest

@pytest.fixture
def optimize_service():
    return OptimizeService()

@pytest.fixture
def mock_session():
    session = MagicMock(spec=Session)
    session.exec = MagicMock()
    session.get = MagicMock()
    return session

class TestOptimizeServiceStats:
    
    def test_get_agent_feedback_stats_all(self, optimize_service, mock_session):
        # Setup mock data for active and inactive versions
        mock_results = [
            ("positive", 5), # Active
            ("negative", 1), # Active
            ("positive", 2), # Inactive
            ("negative", 2)  # Inactive
        ]
        
        # When only_active=False (default behavior implied for internal helper if used without flag in older code, 
        # but modern usage splits it. Let's test the helper directly)
        
        # Mock the query execution for ALL stats (simplified mocking of chain)
        # In reality, sqlmodel mocking is complex. We'll test logic flow.
        
        # It's better to use an integration-style test with an in-memory DB or deeper mocking.
        # Given the environment, let's try to mock the session.exec().all() return value.
        pass

# Integration tests with DB are more reliable for complex queries
def test_optimize_service_integration(session: Session):
    service = OptimizeService()
    
    # 1. Setup Data
    # Agent
    agent = Agent(name="Test Agent", description="Desc", system_prompt="v1 prompt", model="gpt-4")
    session.add(agent)
    session.commit()
    session.refresh(agent)
    
    # Versions
    v1 = PromptVersion(agent_id=agent.id, version=1, system_prompt="v1", model="gpt-4", status="archived")
    v2 = PromptVersion(agent_id=agent.id, version=2, system_prompt="v2", model="gpt-4", status="active")
    session.add(v1)
    session.add(v2)
    session.commit()
    
    # Executions & Feedback
    # v1: 1 pos, 1 neg
    exec1 = AgentExecution(agent_id=agent.id, prompt_version_id=v1.id, input_prompt="in", response="out")
    session.add(exec1)
    session.commit()
    fb1 = Feedback(execution_id=exec1.id, sentiment="positive", text="good v1")
    session.add(fb1)
    
    exec2 = AgentExecution(agent_id=agent.id, prompt_version_id=v1.id, input_prompt="in", response="out")
    session.add(exec2)
    session.commit()
    fb2 = Feedback(execution_id=exec2.id, sentiment="negative", text="bad v1")
    session.add(fb2)
    
    # v2 (Active): 2 pos, 0 neg
    exec3 = AgentExecution(agent_id=agent.id, prompt_version_id=v2.id, input_prompt="in", response="out")
    session.add(exec3)
    session.commit()
    fb3 = Feedback(execution_id=exec3.id, sentiment="positive", text="good v2 a")
    session.add(fb3)

    exec4 = AgentExecution(agent_id=agent.id, prompt_version_id=v2.id, input_prompt="in", response="out")
    session.add(exec4)
    session.commit()
    fb4 = Feedback(execution_id=exec4.id, sentiment="positive", text="good v2 b")
    session.add(fb4)
    
    session.commit()
    
    # 2. Test get_agent_details (Stats)
    details = service.get_flow_details(session, f"agent:{agent.id}")
    
    # Verify top-level stats are ACTIVE ONLY (v2)
    # v2 has 2 positive, 0 negative
    assert details["feedbackStats"]["total"] == 2
    assert details["feedbackStats"]["positive"] == 2
    assert details["feedbackStats"]["negative"] == 0
    assert details["feedbackStats"]["positivePercent"] == 100
    
    # Verify version stats involved
    # Find v1 in versions
    v1_data = next(v for v in details["versions"] if v["version"] == 1)
    assert v1_data["feedbackStats"]["total"] == 2
    assert v1_data["feedbackStats"]["positive"] == 1
    assert v1_data["feedbackStats"]["negative"] == 1
    assert v1_data["feedbackStats"]["positivePercent"] == 50
    
    # Find v2 in versions
    v2_data = next(v for v in details["versions"] if v["version"] == 2)
    assert v2_data["feedbackStats"]["total"] == 2
    assert v2_data["feedbackStats"]["positive"] == 2
    
    # 3. Test Feedback List (Versions included)
    feedback_list = service.get_flow_feedback(session, f"agent:{agent.id}")
    assert len(feedback_list) == 4
    
    # Check fb3 (good v2 a)
    fb_item = next(f for f in feedback_list if f["text"] == "good v2 a")
    assert fb_item["version"] == 2
    assert fb_item["versionId"] == v2.id

def test_story_generator_optimization_integration(session: Session):
    service = OptimizeService()
    type_ = "feature"
    
    # 1. Setup Data
    # Templates
    t1 = PromptTemplate(name="v1", type=type_, version=1, system_prompt="v1", status="archived")
    t2 = PromptTemplate(name="v2", type=type_, version=2, system_prompt="v2", status="active")
    session.add(t1)
    session.add(t2)
    session.commit()
    
    # Artifacts & Feedback
    # v1: 1 negative
    a1 = GeneratedArtifact(type=type_, title="A1", content="c", input_description="d", prompt_template_id=t1.id)
    session.add(a1)
    session.commit()
    fb1 = GenerationFeedback(artifact_id=a1.id, sentiment="negative", text="bad v1")
    session.add(fb1)
    
    # v2: 1 positive
    a2 = GeneratedArtifact(type=type_, title="A2", content="c", input_description="d", prompt_template_id=t2.id)
    session.add(a2)
    session.commit()
    fb2 = GenerationFeedback(artifact_id=a2.id, sentiment="positive", text="good v2")
    session.add(fb2)
    
    session.commit()
    
    # 2. Test get_flow_details
    details = service.get_flow_details(session, f"story_generator:{type_}")
    
    # Verify active-only top stats (v2 only)
    assert details["feedbackStats"]["total"] == 1
    assert details["feedbackStats"]["positive"] == 1
    assert details["feedbackStats"]["negative"] == 0
    
    # Verify version stats
    v1_data = next(v for v in details["versions"] if v["version"] == 1)
    assert v1_data["feedbackStats"]["total"] == 1
    assert v1_data["feedbackStats"]["negative"] == 1
    
    v2_data = next(v for v in details["versions"] if v["version"] == 2)
    assert v2_data["feedbackStats"]["total"] == 1
    assert v2_data["feedbackStats"]["positive"] == 1
    
    # 3. Test Feedback List Versioning
    feedback_list = service.get_flow_feedback(session, f"story_generator:{type_}")
    
    fb_item = next(f for f in feedback_list if f["text"] == "bad v1")
    assert fb_item["version"] == 1
    
    fb_item_v2 = next(f for f in feedback_list if f["text"] == "good v2")
    assert fb_item_v2["version"] == 2
