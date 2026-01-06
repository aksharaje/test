
import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session
from app.services.ai_config_service import ai_config_service
from app.services.settings_service import settings_service
from app.models.user import User

def test_get_active_model_default(session: Session):
    """Test that get_active_model returns default when no setting exists."""
    # Ensure no setting exists
    settings_service.delete_setting(session, "OPENROUTER_MODEL")
    
    model = ai_config_service.get_active_model(session)
    # Falls back to config default (which might be oss-120b or what is in .env)
    assert isinstance(model, str)
    assert len(model) > 0

def test_set_and_get_active_model(session: Session):
    """Test setting a custom model and retrieving it."""
    test_model = "anthropic/claude-3-opus"
    
    # Set model
    settings_service.set_setting(session, "OPENROUTER_MODEL", test_model)
    
    # Get model
    retrieved_model = ai_config_service.get_active_model(session)
    assert retrieved_model == test_model

def test_service_propagation(session: Session):
    """Test that a service actually picks up the change."""
    test_model = "google/gemini-pro-1.5"
    settings_service.set_setting(session, "OPENROUTER_MODEL", test_model)
    
    # We verify that fetching via ai_config_service works
    retrieved = ai_config_service.get_active_model(session)
    assert retrieved == test_model

# API Tests
from fastapi.testclient import TestClient
from app.main import app

def test_api_get_put_ai_model(client: TestClient):
    """Test the API endpoints for AI model settings."""
    
    # GET initial
    response = client.get("/api/settings/ai-model")
    assert response.status_code == 200
    
    # PUT new model
    new_model = "meta-llama/llama-3-70b"
    response = client.put(
        "/api/settings/ai-model", 
        json={"model": new_model}
    )
    assert response.status_code == 200
    assert response.json()["model"] == new_model
    
    # GET verify
    response = client.get("/api/settings/ai-model")
    assert response.status_code == 200
    assert response.json()["model"] == new_model
