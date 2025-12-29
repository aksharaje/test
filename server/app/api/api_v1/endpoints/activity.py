from typing import Any, List
from fastapi import APIRouter, Depends, Body
from sqlmodel import Session
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.activity_service import activity_service
from pydantic import BaseModel

class ActivityLogRequest(BaseModel):
    feature_key: str
    metadata: str = None

router = APIRouter()

@router.post("/log")
def log_activity(
    request: ActivityLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Log a user activity."""
    return activity_service.log_activity(db, current_user.id, request.feature_key, request.metadata)

@router.get("/shortcuts")
def get_shortcuts(
    limit: int = 4,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get frequent shortcuts for the current user."""
    return activity_service.get_frequent_shortcuts(db, current_user.id, limit)

@router.get("/outputs")
def get_recent_outputs(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get recent outputs (PRDs, Ideations, etc.) for the current user."""
    return activity_service.get_recent_outputs(db, current_user.id, limit)
