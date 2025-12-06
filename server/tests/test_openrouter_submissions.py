import pytest
import json
from unittest.mock import MagicMock, patch
from sqlmodel import Session, SQLModel, create_engine
from app.services.story_generator_service import StoryGeneratorService
from app.services.prd_generator_service import PrdGeneratorService
from app.services.library_service import LibraryService
from app.services.code_chat_service import CodeChatService
from app.services.optimize_service import OptimizeService
from app.services.embedding_service import EmbeddingService
from app.models.story_generator import GeneratedArtifact
from app.models.prd import GeneratedPrd
from app.models.library import LibraryBook
from app.models.code_chat import CodeChatSession
from app.models.knowledge_base import KnowledgeBase

# Setup in-memory DB for testing
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture
def mock_openai():
    with patch("openai.OpenAI") as mock:
        # Create a mock client instance
        mock_client = MagicMock()
        mock.return_value = mock_client
        yield mock_client

class TestStoryGeneratorService:
    def test_generate_success(self, session, mock_openai):
        service = StoryGeneratorService()
        # Force the service to use our mock client
        service._client = mock_openai
        
        # Mock response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"epic": {"title": "Test Epic"}}'
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_openai.chat.completions.create.return_value = mock_response

        request = {
            "type": "epic",
            "title": "Test Epic",
            "description": "A test epic",
            "knowledgeBaseIds": [],
            "files": []
        }

        artifact = service.generate(session, request)

        assert artifact.title == "Test Epic"
        assert artifact.type == "epic"
        assert artifact.status == "draft"
        mock_openai.chat.completions.create.assert_called_once()

    def test_generate_json_error(self, session, mock_openai):
        service = StoryGeneratorService()
        service._client = mock_openai
        
        # Mock invalid JSON response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = 'Invalid JSON'
        mock_openai.chat.completions.create.return_value = mock_response

        request = {
            "type": "epic",
            "title": "Test Epic",
            "description": "A test epic",
            "knowledgeBaseIds": [],
            "files": []
        }

        with pytest.raises(ValueError, match="Failed to parse LLM response"):
            service.generate(session, request)

class TestPrdGeneratorService:
    def test_generate_prd_success(self, session, mock_openai):
        service = PrdGeneratorService()
        service._client = mock_openai
        
        # Mock response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            "title": "Test PRD",
            "sections": [
                {"key": "overview", "title": "Overview", "content": "Test overview"}
            ]
        })
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_openai.chat.completions.create.return_value = mock_response

        request = {
            "title": "Test PRD",
            "description": "A test PRD",
            "format": "markdown"
        }

        # Method name is generate, not generate_prd
        prd = service.generate(session, request)

        assert prd.title == "Test PRD"
        assert "Test overview" in prd.content
        mock_openai.chat.completions.create.assert_called_once()

# ... (LibraryService and CodeChatService tests remain unchanged) ...

class TestOptimizeService:
    @pytest.mark.asyncio
    async def test_generate_feedback_summary(self, session):
        service = OptimizeService()
        
        # Seed negative feedback
        from app.models.agent import Agent
        from app.models.optimize import AgentExecution
        from app.models.feedback import Feedback
        
        agent = Agent(name="Test Agent", description="Test", system_prompt="Test", model="test")
        session.add(agent)
        session.commit()
        
        execution = AgentExecution(agent_id=agent.id, input_prompt="test", response="test")
        session.add(execution)
        session.commit()
        
        feedback = Feedback(execution_id=execution.id, sentiment="negative", text="Bad result")
        session.add(feedback)
        session.commit()
        
        # Mock OpenRouterService
        with patch("app.services.openrouter_service.openrouter_service.chat") as mock_chat:
            mock_chat.return_value = {"content": "Test Summary"}
            
            summary = await service.generate_feedback_summary(session, f"agent:{agent.id}")
            
            assert summary == "Test Summary"
            mock_chat.assert_called_once()

class TestEmbeddingService:
    def test_generate_query_embedding_success(self, mock_openai):
        service = EmbeddingService()
        service._client = mock_openai
        
        # Mock response
        mock_response = MagicMock()
        mock_data = MagicMock()
        mock_data.embedding = [0.1, 0.2, 0.3]
        mock_response.data = [mock_data]
        mock_openai.embeddings.create.return_value = mock_response

        # Method is generate_query_embedding
        embedding = service.generate_query_embedding("Test text")

        assert embedding == [0.1, 0.2, 0.3]
        mock_openai.embeddings.create.assert_called_once()
