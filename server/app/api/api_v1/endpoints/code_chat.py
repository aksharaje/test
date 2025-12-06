from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session
from app.core.db import get_session
from app.models.code_chat import CodeChatSession, CodeChatMessage
from app.models.knowledge_base import KnowledgeBase
from app.services.code_chat_service import code_chat_service

router = APIRouter()

@router.get("/knowledge-bases", response_model=List[KnowledgeBase])
def list_knowledge_bases(
    session: Session = Depends(get_session)
) -> Any:
    return code_chat_service.get_code_knowledge_bases(session)

@router.get("/sessions", response_model=List[CodeChatSession])
def list_sessions(
    session: Session = Depends(get_session),
    userId: Optional[int] = None
) -> Any:
    return code_chat_service.list_sessions(session, userId)

@router.post("/sessions", response_model=CodeChatSession)
def create_session(
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    try:
        return code_chat_service.create_session(session, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ... (omitted lines)

@router.delete("/sessions/{id}")
def delete_session(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not code_chat_service.delete_session(session, id):
        raise HTTPException(status_code=404, detail="Session not found")
    return Response(status_code=204)

@router.post("/sessions/{id}/messages", response_model=Dict[str, CodeChatMessage])
def send_message(
    id: int,
    data: Dict[str, str],
    session: Session = Depends(get_session)
) -> Any:
    message = data.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
        
    try:
        return code_chat_service.send_message(session, id, message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/sessions/{id}/knowledge-bases", response_model=CodeChatSession)
def update_session_knowledge_bases(
    id: int,
    data: Dict[str, List[int]],
    session: Session = Depends(get_session)
) -> Any:
    kb_ids = data.get("knowledgeBaseIds")
    if not kb_ids:
        raise HTTPException(status_code=400, detail="knowledgeBaseIds is required")
        
    updated = code_chat_service.update_session_knowledge_bases(session, id, kb_ids)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated

@router.get("/sessions/{id}")
def get_session_details(id: int, session: Session = Depends(get_session)) -> Any:
    result = code_chat_service.get_session(session, id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result
