from typing import List, Any, Dict
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.core.db import get_session
from app.models.feedback import Feedback
from app.services.feedback_service import feedback_service

router = APIRouter()

@router.post("", response_model=Feedback)
def create_feedback(
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    return feedback_service.create_feedback(session, data)

@router.get("", response_model=List[Feedback])
def list_feedback(
    session: Session = Depends(get_session)
) -> Any:
    return feedback_service.list_feedback(session)
