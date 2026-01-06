from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel
from app.core.db import get_session
from app.services.settings_service import settings_service

router = APIRouter()

class GithubSettingSchema(BaseModel):
    webhook_secret: str

@router.put("/github")
def update_github_setting(
    setting: GithubSettingSchema,
    session: Session = Depends(get_session)
) -> Any:
    """
    Securely store the GitHub Webhook Secret.
    """
    settings_service.set_setting(
        session, 
        "GITHUB_WEBHOOK_SECRET", 
        setting.webhook_secret, 
        description="Secret for verifying GitHub Webhooks"
    )
    return {"message": "GitHub settings updated"}

@router.get("/github")
def get_github_setting(
    session: Session = Depends(get_session)
) -> Any:
    """
    Check if the GitHub secret is configured. 
    Does NOT return the actual secret for security.
    """
    val = settings_service.get_setting(session, "GITHUB_WEBHOOK_SECRET")
    return {
        "is_configured": val is not None
    }

from app.models.user import User
from app.api.deps import get_current_active_superuser
from pydantic import Field

class AiModelSchema(BaseModel):
    model: str = Field(..., description="The AI model identifier to use (e.g. 'openai/gpt-4o')")

@router.get("/ai-model", response_model=AiModelSchema)
def get_ai_model(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser),
):
    """Get the currently active AI model setting."""
    from app.services.ai_config_service import ai_config_service
    model = ai_config_service.get_active_model(session)
    return {"model": model}

@router.put("/ai-model", response_model=AiModelSchema)
def update_ai_model(
    model_data: AiModelSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser),
):
    """Update the AI model setting."""
    from app.services.settings_service import settings_service
    settings_service.set_setting(session, "OPENROUTER_MODEL", model_data.model, "Active AI Model for generation")
    return model_data
