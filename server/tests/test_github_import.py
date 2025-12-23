import pytest
import os
import shutil
import tempfile
from unittest.mock import MagicMock, patch, ANY
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from app.main import app
from app.core.db import get_session
from sqlalchemy.pool import StaticPool
from app.models.knowledge_base import KnowledgeBase, Document

# Setup in-memory DB
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
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
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Generated Documentation"
        mock_client.chat.completions.create.return_value = mock_response
        
        mock_emb_response = MagicMock()
        mock_emb_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_client.embeddings.create.return_value = mock_emb_response
        
        yield mock_client

@pytest.fixture
def mock_git():
    with patch("git.Repo") as mock:
        yield mock

@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session

def test_github_service_process_repository(mock_git, mock_openai, db_session):
    # Setup KB
    kb = KnowledgeBase(name="Test KB", status="ready")
    db_session.add(kb)
    db_session.commit()
    kb_id = kb.id

    # Create placeholder doc
    placeholder = Document(knowledgeBaseId=kb_id, name="Import", source="github", status="processing")
    db_session.add(placeholder)
    db_session.commit()
    placeholder_id = placeholder.id

    # Mock filesystem walk
    with patch("os.walk") as mock_walk:
        # Simulate one file
        mock_walk.return_value = [("/tmp/repo", [], ["main.py"])]
        
        with patch("builtins.open", new_callable=MagicMock) as mock_open:
            # Mock file content read
            mock_file = MagicMock()
            mock_file.__enter__.return_value.read.return_value = "print('Hello') " * 10  # Make it long enough
            mock_open.return_value = mock_file
            
            with patch("shutil.rmtree") as mock_rmtree:
                with patch("tempfile.mkdtemp", return_value="/tmp/repo"):
                    with patch("app.core.db.engine", engine):
                        from app.services.github_service import github_service
                        from app.services.embedding_service import embedding_service
                        
                        # Inject mocked client
                        github_service._client = mock_openai
                        embedding_service._client = mock_openai
                        
                        github_service.process_repository(kb_id, "https://github.com/test/repo", placeholder_id)

    # Verify document created
    docs = db_session.query(Document).filter(Document.knowledgeBaseId == kb_id).all()
    # Expect 2 docs: placeholder and main.py
    assert len(docs) == 2
    
    # Verify main.py doc
    main_doc = next(d for d in docs if d.name == "main.py")
    assert main_doc.content == "Generated Documentation"
    assert main_doc.source == "github"
    
    # Verify placeholder updated
    updated_placeholder = db_session.get(Document, placeholder_id)
    db_session.refresh(updated_placeholder)
    assert "Import Summary" in updated_placeholder.name
    assert updated_placeholder.status == "indexed"

def test_add_github_source_endpoint(mock_git):
    # Setup KB
    with Session(engine) as session:
        kb = KnowledgeBase(name="Endpoint KB", status="ready")
        session.add(kb)
        session.commit()
        kb_id = kb.id

    # Test with repoUrl
    with patch("app.services.github_service.GithubService.process_repository") as mock_process:
        response = client.post(
            f"/api/knowledge-bases/{kb_id}/github",
            json={"repoUrl": "https://github.com/test/repo"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "github"
        assert data["status"] == "processing"
        
        # Verify background task triggered
        # Note: In TestClient, background tasks run synchronously? No, TestClient usually executes them?
        # FastAPI TestClient uses Starlette's TestClient which executes background tasks.
        # So mock_process should have been called.
        # Wait, if we mock the method on the class instance, we need to make sure dependency injection uses that instance.
        # github_service is a singleton instance in the module.
        mock_process.assert_called_once()
        
def test_add_github_source_missing_param():
    with Session(engine) as session:
        kb = KnowledgeBase(name="Validation KB", status="ready")
        session.add(kb)
        session.commit()
        kb_id = kb.id
        
    response = client.post(
        f"/api/knowledge-bases/{kb_id}/github",
        json={}
    )
    assert response.status_code == 400
