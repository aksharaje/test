from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Response
from sqlmodel import Session
from app.core.db import get_session
from app.models.knowledge_base import KnowledgeBase, Document
from app.services.knowledge_base_service import knowledge_base_service

router = APIRouter()

@router.get("", response_model=List[KnowledgeBase], response_model_by_alias=True)
def list_knowledge_bases(
    session: Session = Depends(get_session),
    userId: Optional[int] = None
) -> Any:
    return knowledge_base_service.list_knowledge_bases(session, userId)

@router.post("", response_model=KnowledgeBase, response_model_by_alias=True)
def create_knowledge_base(
    kb: KnowledgeBase,
    session: Session = Depends(get_session)
) -> Any:
    return knowledge_base_service.create_knowledge_base(session, kb)

@router.get("/{id}", response_model=KnowledgeBase, response_model_by_alias=True)
def get_knowledge_base(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    kb = knowledge_base_service.get_knowledge_base(session, id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return kb

@router.patch("/{id}", response_model=KnowledgeBase, response_model_by_alias=True)
def update_knowledge_base(
    id: int,
    kb_update: dict,
    session: Session = Depends(get_session)
) -> Any:
    kb = knowledge_base_service.update_knowledge_base(session, id, kb_update)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return kb

@router.delete("/{id}")
def delete_knowledge_base(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not knowledge_base_service.delete_knowledge_base(session, id):
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return Response(status_code=204)

# ... (omitted lines)

@router.delete("/{id}/documents/{doc_id}")
def delete_document(
    id: int,
    doc_id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not knowledge_base_service.delete_document(session, doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(status_code=204)
