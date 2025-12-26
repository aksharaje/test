import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session
from app.models.prd import GeneratedPrd, PrdTemplate, PrdStatus
from app.services.prd_generator_service import prd_generator_service

def test_list_prds_service(session: Session):
    # Create PRDs
    for i in range(15):
        prd = GeneratedPrd(
            title=f"PRD {i}",
            concept=f"Concept {i}",
            content="Content",
            status=PrdStatus.PENDING,
            user_id=1
        )
        session.add(prd)
    session.commit()

    # Test limit
    results = prd_generator_service.list_prds(session, limit=5)
    assert len(results) == 5
    
    # Test sort order (descending by default)
    assert results[0].title == "PRD 14"

    # Test pagination
    results = prd_generator_service.list_prds(session, skip=5, limit=5)
    assert len(results) == 5
    assert results[0].title == "PRD 9"
    
    # Test user filter
    results = prd_generator_service.list_prds(session, user_id=999)
    assert len(results) == 0

def test_create_prd_service(session: Session):
    request = {
        "userId": 1,
        "concept": "Test Concept",
        "targetProject": "Test Project",
        "templateId": 1
    }
    
    # Ensure template exists (from conftest)
    template = session.get(PrdTemplate, 1)
    assert template is not None
    
    prd = prd_generator_service.create_prd(session, request)
    assert prd.id is not None
    assert prd.concept == "Test Concept"
    assert prd.target_project == "Test Project"
    assert prd.template_id == 1
    assert prd.status == "pending"

def test_retry_prd_service(session: Session):
    prd = GeneratedPrd(
        title="Failed",
        concept="Concept",
        content="Content",
        status=PrdStatus.FAILED,
        error_message="Error",
        user_id=1,
        template_id=1
    )
    session.add(prd)
    session.commit()
    
    retried_prd = prd_generator_service.retry_prd(session, prd.id)
    assert retried_prd.status == "pending"
    assert retried_prd.error_message is None
    assert retried_prd.progress_step == 0

def test_run_prd_pipeline_success(session: Session):
    prd = GeneratedPrd(
        title="Pending",
        concept="Concept",
        content="Content",
        status=PrdStatus.PENDING,
        user_id=1,
        template_id=1
    )
    session.add(prd)
    session.commit()
    session.refresh(prd)

    # Mock OpenAI client
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"title": "Gen Title", "sections": []}'
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 20
    mock_client.chat.completions.create.return_value = mock_response

    # Inject mock client directly
    prd_generator_service._client = mock_client

    # Mock settings to avoid attribute error if they are accessed
    with patch('app.core.config.settings') as mock_settings:
        mock_settings.OPENROUTER_MODEL = "test-model"
        
        # Mock get_knowledge_base_context to avoid calling vector DB service
        with patch.object(prd_generator_service, 'get_knowledge_base_context') as mock_kb:
                mock_kb.return_value = {"context": "", "citations": []}
                
                prd_generator_service.run_prd_pipeline(session, prd.id)

    # Reset client
    prd_generator_service._client = None
    
    session.refresh(prd)
    assert prd.status == "draft" # or whatever the service sets on success (line 367 says "draft")
    assert prd.title == "Gen Title"
    assert prd.progress_step == 4

def test_run_prd_pipeline_failure(session: Session):
    prd = GeneratedPrd(
        title="Pending",
        concept="Concept",
        content="Content",
        status=PrdStatus.PENDING,
        user_id=1,
        template_id=1
    )
    session.add(prd)
    session.commit()
    session.refresh(prd)

    # Mock client to raise exception
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("API Error")

    # Inject mock client directly
    prd_generator_service._client = mock_client

    with patch('app.core.config.settings'):
            with patch.object(prd_generator_service, 'get_knowledge_base_context') as mock_kb:
                mock_kb.return_value = {"context": "", "citations": []}
                prd_generator_service.run_prd_pipeline(session, prd.id)
    
    # Reset client
    prd_generator_service._client = None

    session.refresh(prd)
    assert prd.status == "failed"
    assert "API Error" in prd.error_message
