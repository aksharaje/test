from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session
from app.core.db import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.code_chat import CodeChatSession, CodeChatMessage
from app.models.knowledge_base import KnowledgeBase
from app.services.code_chat_service import code_chat_service

router = APIRouter()

@router.get("/knowledge-bases", response_model=List[KnowledgeBase])
def list_knowledge_bases(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    return code_chat_service.get_code_knowledge_bases(session)

@router.get("/sessions", response_model=List[CodeChatSession])
def list_sessions(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    return code_chat_service.list_sessions(session, user_id=current_user.id)

@router.post("/sessions", response_model=CodeChatSession)
def create_session(
    data: Dict[str, Any],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    try:
        return code_chat_service.create_session(session, data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ... (omitted lines)

@router.delete("/sessions/{id}")
def delete_session(
    id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    if not code_chat_service.delete_session(session, id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Session not found")
    return Response(status_code=204)

@router.post("/sessions/{id}/messages", response_model=Dict[str, CodeChatMessage])
def send_message(
    id: int,
    data: Dict[str, str],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    message = data.get("content") or data.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message content is required")

    try:
        return code_chat_service.send_message(session, id, message, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/sessions/{id}/knowledge-bases", response_model=CodeChatSession)
def update_session_knowledge_bases(
    id: int,
    data: Dict[str, List[int]],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    kb_ids = data.get("knowledgeBaseIds")
    if not kb_ids:
        raise HTTPException(status_code=400, detail="knowledgeBaseIds is required")

    updated = code_chat_service.update_session_knowledge_bases(session, id, kb_ids, user_id=current_user.id)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated

@router.get("/sessions/{id}")
def get_session_details(
    id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = code_chat_service.get_session(session, id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result
