import pytest
import json
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from app.main import app
from app.core.db import get_session

# Import all models to ensure they are registered with SQLModel
from app.models import *
from app.models.user import User
from app.models.flow import Flow, FlowExecution
from app.models.jira import Integration, JiraProject
from app.models.knowledge_base import Document, DocumentChunk
from app.models.pi_planning import PiSession, PiSessionBoard, PiFeature, PiSprint, PiFeatureAssignment, HolidayConfig

from sqlalchemy.pool import StaticPool

# Create in-memory DB for integration tests
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
print(f"Registered tables: {SQLModel.metadata.tables.keys()}")
SQLModel.metadata.create_all(engine)

def get_test_session():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_test_session
client = TestClient(app)

@pytest.fixture
def mock_openai():
    with patch("openai.OpenAI") as mock:
        mock_client = MagicMock()
        mock.return_value = mock_client
        yield mock_client

@pytest.fixture
def mock_services(mock_openai):
    # Mock responses for all services
    
    # Common mock response structure
    def create_mock_response(content_dict=None, content_str=None):
        mock_resp = MagicMock()
        if content_dict:
            mock_resp.choices[0].message.content = json.dumps(content_dict)
        else:
            mock_resp.choices[0].message.content = content_str
        
        # Mock usage to avoid serialization errors
        mock_resp.usage.prompt_tokens = 10
        mock_resp.usage.completion_tokens = 20
        mock_resp.usage.total_tokens = 30
        return mock_resp
    
    # Story Generator Mock
    mock_story_response = create_mock_response(content_dict={
        "title": "Integration Epic",
        "description": "Generated via integration test",
        "acceptanceCriteria": ["AC1", "AC2"]
    })
    
    # Code Chat Mock
    mock_chat_response = create_mock_response(content_str="I can help with that code.")
    
    # Library Mock
    mock_lib_structure = create_mock_response(content_dict={
        "title": "Integration Book",
        "chapters": [{"title": "Chapter 1", "sections": ["Section 1"]}]
    })
    mock_lib_page = create_mock_response(content_str="# Chapter 1\nContent")
    
    # PRD Mock
    mock_prd_response = create_mock_response(content_dict={
        "title": "Integration PRD",
        "sections": [{"key": "overview", "title": "Overview", "content": "PRD Content"}]
    })

    # Apply mocks to service instances
    from app.services.story_generator_service import story_generator_service
    from app.services.code_chat_service import code_chat_service
    from app.services.library_service import library_service
    from app.services.prd_generator_service import prd_generator_service
    from app.services.embedding_service import embedding_service
    from app.services.knowledge_base_service import knowledge_base_service
    
    # We need to set the _client on the singleton instances
    story_generator_service._client = mock_openai
    code_chat_service._client = mock_openai
    library_service._client = mock_openai
    prd_generator_service._client = mock_openai
    embedding_service._client = mock_openai
    
    # Mock knowledge_base_service.search to avoid pgvector syntax error in sqlite
    knowledge_base_service.search = MagicMock(return_value=[
        {
            "documentId": 1,
            "documentName": "test_doc.py",
            "content": "def test(): pass",
            "similarity": 0.9,
            "metadata": {"path": "test_doc.py"}
        }
    ])
    
    return mock_openai

def test_story_generator_flow(mock_services):
    # Configure mock for Story Generator
    mock_response = MagicMock()
    mock_response.choices[0].message.content = json.dumps({
        "title": "Integration Epic",
        "description": "Generated via integration test",
        "acceptanceCriteria": ["AC1", "AC2"]
    })
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 20
    mock_response.usage.total_tokens = 30
    
    mock_services.chat.completions.create.return_value = mock_response

    # Simulate file upload
    files = [
        ('files', ('test.txt', b'some content', 'text/plain'))
    ]
    
    response = client.post(
        "/api/story-generator/generate",
        data={
            "type": "epic",
            "title": "Integration Test Epic",
            "description": "Testing the flow",
            "knowledgeBaseIds": "[]"
        },
        files=files
    )
    
    if response.status_code != 200:
        print(f"Story Gen Error: {response.text}")
    assert response.status_code == 200
    data = response.json()
    # The service uses the input title for the artifact
    assert data["title"] == "Integration Test Epic"
    assert data["type"] == "epic"

def test_code_chat_flow(mock_services):
    # Configure mock for Code Chat
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "I can help with that code."
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 20
    mock_response.usage.total_tokens = 30
    mock_services.chat.completions.create.return_value = mock_response

    # Mock embeddings (still needed if service calls it, but search is mocked now)
    mock_embedding_response = MagicMock()
    mock_embedding_response.data[0].embedding = [0.1] * 1536
    mock_services.embeddings.create.return_value = mock_embedding_response

    # 1. Create Session
    # Create KB first
    from app.models.knowledge_base import KnowledgeBase
    with Session(engine) as session:
        kb = KnowledgeBase(name="Test KB", description="Test", status="ready")
        session.add(kb)
        session.commit()
        kb_id = kb.id

    # Create Session
    res_session = client.post("/api/code-chat/sessions", json={"knowledgeBaseIds": [kb_id]})
    if res_session.status_code != 200:
        print(f"Code Chat Session Error: {res_session.text}")
    assert res_session.status_code == 200
    session_id = res_session.json()["id"]
    
    # 2. Send Message
    res_msg = client.post(
        f"/api/code-chat/sessions/{session_id}/messages",
        json={"content": "How do I fix this bug?"}
    )
    if res_msg.status_code != 200:
        print(f"Code Chat Message Error: {res_msg.text}")
    assert res_msg.status_code == 200
    data = res_msg.json()
    assert data["assistantMsg"]["content"] == "I can help with that code."
    
    # Verify title update
    res_session = client.get(f"/api/code-chat/sessions/{session_id}")
    assert res_session.status_code == 200
    assert res_session.json()["session"]["title"] != "New Chat"
    assert "How do I fix" in res_session.json()["session"]["title"]

    # 3. Delete Session
    res_del = client.delete(f"/api/code-chat/sessions/{session_id}")
    assert res_del.status_code == 204
    
    # Verify deletion
    res_get = client.get(f"/api/code-chat/sessions/{session_id}")
    assert res_get.status_code == 404

def test_library_flow(mock_services):
    # Configure mock for Library
    # It makes multiple calls: structure then pages.
    mock_structure = MagicMock()
    mock_structure.choices[0].message.content = json.dumps({
        "title": "Integration Book",
        "description": "Test Description",
        "chapters": [{
            "title": "Chapter 1", 
            "description": "Chapter Description",
            "sections": [{"title": "Section 1", "description": "Section Description"}]
        }]
    })
    mock_structure.usage.prompt_tokens = 10
    mock_structure.usage.completion_tokens = 20
    
    mock_page = MagicMock()
    mock_page.choices[0].message.content = "# Chapter 1\nContent"
    mock_page.usage.prompt_tokens = 10
    mock_page.usage.completion_tokens = 20
    
    mock_services.chat.completions.create.side_effect = [mock_structure, mock_page, mock_page]

    # Create KB
    from app.models.knowledge_base import KnowledgeBase
    with Session(engine) as session:
        kb = KnowledgeBase(name="Lib KB", description="Test", status="ready")
        session.add(kb)
        session.commit()
        kb_id = kb.id

    # Create Book
    res_book = client.post("/api/library/books", json={"knowledgeBaseId": kb_id})
    if res_book.status_code != 200:
        print(f"Library Book Error: {res_book.text}")
    assert res_book.status_code == 200
    book_id = res_book.json()["id"]
    
    # Background task should have run synchronously with TestClient
    # Verify pages were created
    res_pages = client.get(f"/api/library/books/{book_id}/pages")
    if res_pages.status_code != 200:
        print(f"Library Pages Error: {res_pages.text}")
    assert res_pages.status_code == 200
    pages = res_pages.json()
    print(f"Library Pages: {pages}")
    # Should have at least one page
    assert len(pages) >= 1
    # Check hierarchy: Root page is Chapter 1
    assert pages[0]["title"] == "Chapter 1"
    # Check children: Section 1
    assert len(pages[0]["children"]) >= 1
    assert pages[0]["children"][0]["title"] == "Section 1"

def test_prd_generator_flow(mock_services):
    # Configure mock for PRD
    mock_response = MagicMock()
    mock_response.choices[0].message.content = json.dumps({
        "title": "Integration PRD",
        "sections": [{"key": "overview", "title": "Overview", "content": "PRD Content"}]
    })
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 20
    mock_response.usage.total_tokens = 30
    
    mock_services.chat.completions.create.return_value = mock_response
    # Reset side_effect if it was set
    mock_services.chat.completions.create.side_effect = None

    # Populate default templates
    from app.services.prd_generator_service import prd_generator_service
    with Session(engine) as session:
        prd_generator_service.ensure_default_templates(session)

    # 1. List Templates
    res_templates = client.get("/api/prd-generator/templates")
    assert res_templates.status_code == 200
    templates = res_templates.json()
    assert len(templates) > 0
    template_id = templates[0]["id"]

    # 2. Generate PRD
    response = client.post(
        "/api/prd-generator/generate",
        data={
            "concept": "Integration PRD Concept",
            "targetProject": "Test Project",
            "templateId": str(template_id),
            "knowledgeBaseIds": "[]"
        }
    )
    
    if response.status_code != 200:
        print(f"PRD Gen Error: {response.text}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Integration PRD"
    prd_id = data["id"]

    # 3. Get PRD
    res_get = client.get(f"/api/prd-generator/{prd_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == prd_id

    # 4. Delete PRD
    res_del = client.delete(f"/api/prd-generator/{prd_id}")
    assert res_del.status_code == 204
    
    # Verify deletion
    res_get_after = client.get(f"/api/prd-generator/{prd_id}")
    assert res_get_after.status_code == 404
