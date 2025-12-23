
import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session, select
from fastapi.testclient import TestClient
from app.main import app
from app.models.knowledge_base import KnowledgeBase, Document

@pytest.fixture
def session():
    from app.core.db import engine
    from sqlmodel import Session
    with Session(engine) as session:
        yield session

@pytest.fixture
def client(session):
    root_app = app
    # Override dependency if needed, but TestClient with app often works directly if db is real
    # Ideally we override get_session
    from app.core.db import get_session
    root_app.dependency_overrides[get_session] = lambda: session
    return TestClient(root_app)

def test_prevent_duplicate_github_imports(client: TestClient, session: Session):
    # 1. Create a Knowledge Base
    kb = KnowledgeBase(name="Duplication Test KB", description="Testing dedupe")
    session.add(kb)
    session.commit()
    session.refresh(kb)
    
    repo_url = "https://github.com/fake/repo"
    
    # Mock the github service to avoid actual cloning
    with patch("app.services.github_service.github_service.process_repository") as mock_process:
        # 2. First Import Call
        payload = {"repoUrl": repo_url}
        response1 = client.post(f"/api/knowledge-bases/{kb.id}/github", json=payload)
        assert response1.status_code == 200
        doc1 = response1.json()
        assert doc1["sourceMetadata"]["repoUrl"] == repo_url
        assert doc1["status"] == "processing"
        
        # Verify DB count is 1
        docs = session.exec(select(Document).where(Document.knowledgeBaseId == kb.id)).all()
        assert len(docs) == 1
        
        # 3. Second Import Call (Duplicate Request)
        response2 = client.post(f"/api/knowledge-bases/{kb.id}/github", json=payload)
        assert response2.status_code == 200
        doc2 = response2.json()
        
        # 4. Assertions
        # Should return the SAME document ID
        assert doc1["id"] == doc2["id"]
        
        # DB count should STILL be 1
        docs_after = session.exec(select(Document).where(Document.knowledgeBaseId == kb.id)).all()
        assert len(docs_after) == 1
        
        # 5. Verify Background Task
        # Logic: The second call should NOT trigger the background task if it returns the existing doc.
        # But wait, does my implementation skip the background task?
        # Let's check api/api_v1/endpoints/knowledge_bases.py again.
        # Yes: "if d.sourceMetadata... return d" is BEFORE "background_tasks.add_task".
        # So mock_process should be called exactly ONCE.
        assert mock_process.call_count == 1

def test_prevent_duplicate_during_indexing_phase(client: TestClient, session: Session):
    """Verify it blocks even if status is 'indexed' or 'error'"""
    kb = KnowledgeBase(name="Duplication Test KB 2", description="Testing dedupe")
    session.add(kb)
    session.commit()
    session.refresh(kb)
    
    repo_url = "https://github.com/fake/repo2"
    
    # Manually insert an 'indexed' document
    existing_doc = Document(
        knowledgeBaseId=kb.id,
        name="Existing Repo",
        source="github",
        sourceMetadata={"repoUrl": repo_url},
        content="stuff",
        status="indexed"
    )
    session.add(existing_doc)
    session.commit()
    
    with patch("app.services.github_service.github_service.process_repository") as mock_process:
        # Attempt Import
        response = client.post(f"/api/knowledge-bases/{kb.id}/github", json={"repoUrl": repo_url})
        assert response.status_code == 200
        doc = response.json()
        
        # Should match existing
        assert doc["id"] == existing_doc.id
        
        # Should NOT trigger processing
        assert mock_process.call_count == 0
