from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models.prd import GeneratedPrd, PrdStatus

def test_list_prds_empty(client: TestClient, session: Session):
    response = client.get("/api/prd-generator/")
    assert response.status_code == 200
    assert response.json() == []

def test_list_prds_pagination(client: TestClient, session: Session):
    # Create dummy PRDs directly in DB
    for i in range(15):
        prd = GeneratedPrd(
            title=f"PRD {i}",
            concept=f"Concept {i}",
            content="Draft content",
            status=PrdStatus.PENDING,
            user_id=1
        )
        session.add(prd)
    session.commit()

    # Test default
    response = client.get("/api/prd-generator/?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    assert data[0]["title"] == "PRD 14" # Ordered by created_at desc

    # Test pagination
    response = client.get("/api/prd-generator/?skip=10&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    assert data[0]["title"] == "PRD 4"

def test_create_prd(client: TestClient, session: Session):
    payload = {
        "concept": "Test concept",
        "targetProject": "Test Project",
        "templateId": "1"
    }
    # Use data=payload for Form data
    response = client.post("/api/prd-generator/generate", data=payload)
    if response.status_code == 422:
         # Debug if payload is wrong
         print(response.json())
    
    assert response.status_code == 200
    data = response.json()
    assert data["concept"] == "Test concept"
    assert data["status"] == "pending"
    assert data["id"] is not None

def test_get_prd_status(client: TestClient, session: Session):
    # Create PRD
    prd = GeneratedPrd(
        title="Test PRD",
        concept="Test Concept",
        content="Test Content",
        status=PrdStatus.PROCESSING,
        progress_step=2,
        progress_message="Generating...",
        user_id=1
    )
    session.add(prd)
    session.commit()
    session.refresh(prd)

    response = client.get(f"/api/prd-generator/{prd.id}/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"
    # Endpoints return camelCase for these fields
    assert data["progressStep"] == 2
    assert data["progressMessage"] == "Generating..."

from unittest.mock import patch

def test_retry_prd(client: TestClient, session: Session):
    # Create failed PRD
    prd = GeneratedPrd(
        title="Failed PRD",
        concept="Test Concept",
        content="Test Content",
        status=PrdStatus.FAILED,
        error_message="Something went wrong",
        user_id=1,
        # Ensure it has a template so if checking happens it passes
        template_id=1 
    )
    session.add(prd)
    session.commit()
    session.refresh(prd)

    with patch("app.services.prd_generator_service.prd_generator_service.run_prd_pipeline") as mock_pipeline:
        response = client.post(f"/api/prd-generator/{prd.id}/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["error_message"] is None
        
        # Verify background task was called
        mock_pipeline.assert_called_once()
    
    # Verify DB update (status should be pending as pipeline didn't run to change it)
    session.refresh(prd)
    assert prd.status == PrdStatus.PENDING

def test_delete_prd(client: TestClient, session: Session):
    # Create PRD
    prd = GeneratedPrd(
        title="To Delete",
        concept="Test Concept",
        content="Test Content",
        status=PrdStatus.DRAFT,
        user_id=1
    )
    session.add(prd)
    session.commit()
    session.refresh(prd)

    response = client.delete(f"/api/prd-generator/{prd.id}")
    assert response.status_code == 204
    
    # Verify deletion
    response = client.get(f"/api/prd-generator/{prd.id}")
    assert response.status_code == 404
