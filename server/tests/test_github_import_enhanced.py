
import pytest
import os
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from app.main import app
from app.core.db import get_session
from sqlalchemy.pool import StaticPool
from app.models.knowledge_base import KnowledgeBase, Document
from app.services.github_service import GithubService

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
def session():
    with Session(engine) as session:
        yield session

def test_add_github_source_saves_metadata(session: Session):
    # Create a KB
    kb = KnowledgeBase(name="Test Repo metadata", userId=1)
    session.add(kb)
    session.commit()
    session.refresh(kb)

    # Use TestClient to hit the endpoint
    # We patch the process_repository so it doesn't actually run, but we verify parameters passed
    with patch("app.services.github_service.GithubService.process_repository") as mock_process:
        response = client.post(
            f"/api/knowledge-bases/{kb.id}/github",
            json={"repoUrl": "https://github.com/test/repo", "accessToken": "sk-test-token"}
        )
        
        assert response.status_code == 200
        
        # Verify mock called with access_token
        args, kwargs = mock_process.call_args
        # Expected args: id, url, access_token, doc_id
        assert args[0] == kb.id
        assert args[1] == "https://github.com/test/repo"
        assert args[2] == "sk-test-token"

def test_process_repository_persists_metadata(session: Session):
    # Setup
    kb = KnowledgeBase(name="Test Service Metadata", userId=1)
    session.add(kb)
    session.commit()
    
    service = GithubService()
    
    # Mock git clone and os walk
    with patch("git.Repo.clone_from") as mock_clone, \
         patch("app.services.github_service.os.walk") as mock_walk, \
         patch("app.services.github_service.shutil.rmtree"), \
         patch("app.core.db.engine", engine): # Patch DB engine
             
        mock_walk.return_value = [] # No files to process
        
        service.process_repository(kb.id, "https://github.com/foo/bar", access_token="secret-token")
        
        # Verify
        session.refresh(kb)
        assert kb.sourceMetadata is not None
        assert kb.sourceMetadata.get("repoUrl") == "https://github.com/foo/bar"
        assert kb.sourceMetadata.get("accessToken") == "secret-token"
        
        # Verify git clone used auth url
        # mock_clone is called with (url, path, depth=1)
        args, _ = mock_clone.call_args
        assert "oauth2:secret-token@" in args[0]

def test_process_repository_resumability(session: Session):
    # Setup
    kb = KnowledgeBase(name="Test Resumability", userId=1)
    session.add(kb)
    session.commit()
    
    # Create an existing document that is already indexed
    existing_doc = Document(
        knowledgeBaseId=kb.id,
        name="README.md",
        source="github",
        status="indexed",
        content="Old content",
        sourceMetadata={"path": "README.md"}
    )
    session.add(existing_doc)
    session.commit()
    
    service = GithubService()
    
    # Mock git clone and os walk
    with patch("git.Repo.clone_from"), \
         patch("app.services.github_service.os.walk") as mock_walk, \
         patch("app.services.github_service.open", create=True) as mock_open, \
         patch("app.services.github_service.shutil.rmtree"), \
         patch("app.services.github_service.tempfile.mkdtemp", return_value="/tmp/repo"), \
         patch("app.core.db.engine", engine): # Patch DB engine
        
        # Simulate finding README.md and new_file.py
        mock_walk.return_value = [("/tmp/repo", [], ["README.md", "new_file.py"])]
        
        # Configure file content to pass length check
        mock_file = MagicMock()
        mock_file.__enter__.return_value.read.return_value = "Content " * 50
        mock_open.return_value = mock_file
        
        # Mock _generate_documentation to avoid LLM calls
        with patch.object(service, '_generate_documentation', return_value="Generated Docs"):
            
            # Run
            service.process_repository(kb.id, "https://github.com/foo/bar")
            
            # Verify
            # README.md should be skipped (no new doc created, existing one remains)
            docs = session.query(Document).filter(Document.knowledgeBaseId == kb.id).all()
            
            readme_docs = [d for d in docs if d.name == "README.md"]
            assert len(readme_docs) == 1
            assert readme_docs[0].content == "Old content" # Should NOT be updated
            
            new_file_docs = [d for d in docs if d.name == "new_file.py"]
            assert len(new_file_docs) == 1
            assert new_file_docs[0].content == "Generated Docs" # Should be created
