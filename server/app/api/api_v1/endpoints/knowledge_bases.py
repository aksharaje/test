from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Response
from sqlmodel import Session, select
from app.core.db import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase, Document
from app.services.knowledge_base_service import knowledge_base_service

router = APIRouter()

@router.get("", response_model=List[KnowledgeBase], response_model_by_alias=True)
def list_knowledge_bases(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """List all knowledge bases (all statuses) for the list page."""
    return knowledge_base_service.list_knowledge_bases(session, user_id=current_user.id)


@router.get("/selectable")
def list_selectable_knowledge_bases(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """List knowledge bases for select dropdowns (ready only, user's own + shared)."""
    kbs = knowledge_base_service.list_selectable_knowledge_bases(session, user_id=current_user.id)
    return [
        {
            "id": kb.id,
            "name": kb.name,
            "documentCount": kb.documentCount,
            "isShared": kb.isShared,
            "isOwned": kb.userId == current_user.id
        }
        for kb in kbs
    ]


@router.post("", response_model=KnowledgeBase, response_model_by_alias=True)
def create_knowledge_base(
    kb: KnowledgeBase,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    kb.userId = current_user.id
    return knowledge_base_service.create_knowledge_base(session, kb)

@router.get("/{id}", response_model=KnowledgeBase, response_model_by_alias=True)
def get_knowledge_base(
    id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    kb = knowledge_base_service.get_knowledge_base(session, id, user_id=current_user.id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return kb

@router.patch("/{id}", response_model=KnowledgeBase, response_model_by_alias=True)
def update_knowledge_base(
    id: int,
    kb_update: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    kb = knowledge_base_service.update_knowledge_base(session, id, kb_update, user_id=current_user.id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return kb

@router.delete("/{id}")
def delete_knowledge_base(
    id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    if not knowledge_base_service.delete_knowledge_base(session, id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return Response(status_code=204)

@router.post("/{id}/github", response_model=Document, response_model_by_alias=True)
def add_github_source(
    id: int,
    body: dict,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify user owns this knowledge base
    kb = knowledge_base_service.get_knowledge_base(session, id, user_id=current_user.id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    url = body.get("repoUrl") or body.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="repoUrl is required")
        
    # Check if this is a repository URL (heuristic)
    # File URLs usually contain /blob/ or /raw/
    # Repo URLs: https://github.com/user/repo or https://github.com/user/repo.git
    is_repo = "github.com" in url and "/blob/" not in url and "raw.githubusercontent.com" not in url
    
    if is_repo:
        from app.services.github_service import github_service
        # Check if we already have this repo imported (any status)
        existing_stmt = select(Document).where(
            Document.knowledgeBaseId == id,
            Document.source == "github"
        )
        existing_docs = session.exec(existing_stmt).all()
        
        for d in existing_docs:
            if d.sourceMetadata and d.sourceMetadata.get("repoUrl") == url:
                # Return existing document to prevent duplicates
                return d
        
        # Create a placeholder document
        doc = Document(
            knowledgeBaseId=id,
            name=f"Repository Import: {url.split('/')[-1]}",
            source="github",
            sourceMetadata={"repoUrl": url},
            content="Repository import in progress...",
            status="processing"
        )
        session.add(doc)
        
        # Update KB status
        kb = session.get(KnowledgeBase, id)
        if kb:
            kb.status = "processing"
            session.add(kb)
            
        session.commit()
        session.refresh(doc)
        
        # Trigger background processing
        access_token = body.get("accessToken")
        background_tasks.add_task(github_service.process_repository, id, url, access_token, doc.id)
        
        return doc

    try:
        return knowledge_base_service.add_github_source(session, id, url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}/documents", response_model=List[Document], response_model_by_alias=True)
def list_documents(
    id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify user owns this knowledge base
    kb = knowledge_base_service.get_knowledge_base(session, id, user_id=current_user.id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return knowledge_base_service.list_documents(session, id)

@router.post("/{id}/documents/{doc_id}/reprocess")
def reprocess_document(
    id: int,
    doc_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify user owns this knowledge base
    kb = knowledge_base_service.get_knowledge_base(session, id, user_id=current_user.id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    # Verify document exists and belongs to KB
    doc = session.get(Document, doc_id)
    if not doc or doc.knowledgeBaseId != id:
        raise HTTPException(status_code=404, detail="Document not found")

    background_tasks.add_task(knowledge_base_service.index_document, session, doc_id)
    return {"message": "Document reprocessing started"}

# ... (omitted lines)

@router.delete("/{id}/documents/{doc_id}")
def delete_document(
    id: int,
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify user owns this knowledge base
    kb = knowledge_base_service.get_knowledge_base(session, id, user_id=current_user.id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    if not knowledge_base_service.delete_document(session, doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(status_code=204)
