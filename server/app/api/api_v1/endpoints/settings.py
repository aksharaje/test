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
