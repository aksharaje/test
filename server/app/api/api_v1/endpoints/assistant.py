from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.core.db import get_session
from app.services.assistant_service import assistant_service
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []

@router.post("/chat", response_model=Dict[str, Any])
def chat(
    request: ChatRequest,
    db: Session = Depends(get_session),
):
    """
    Chat with the dashboard assistant.
    """
    try:
        response = assistant_service.chat(db, None, request.message, request.history)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
