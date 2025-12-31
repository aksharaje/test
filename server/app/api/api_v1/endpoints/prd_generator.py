from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response, Form, UploadFile, File, BackgroundTasks
from sqlmodel import Session, select
from app.core.db import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.prd import GeneratedPrd, PrdTemplate
from app.services.prd_generator_service import prd_generator_service
import json

router = APIRouter()

# ... (omitted lines)

@router.post("/generate", response_model=GeneratedPrd)
def generate_prd(
    concept: str = Form(...),
    targetProject: Optional[str] = Form(None),
    targetPersona: Optional[str] = Form(None),
    industryContext: Optional[str] = Form(None),
    primaryMetric: Optional[str] = Form(None),
    userStoryRole: Optional[str] = Form(None),
    userStoryGoal: Optional[str] = Form(None),
    userStoryBenefit: Optional[str] = Form(None),
    knowledgeBaseIds: str = Form("[]"),
    templateId: Optional[str] = Form(None),
    files: List[UploadFile] = Form(default=[]),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> Any:
    try:
        kb_ids = json.loads(knowledgeBaseIds)
    except json.JSONDecodeError:
        kb_ids = []

    file_data = []
    for file in files:
        file_data.append({
            "filename": file.filename,
            "content_type": file.content_type,
            "size": file.size
        })

    request = {
        "userId": current_user.id,
        "concept": concept,
        "targetProject": targetProject,
        "targetPersona": targetPersona,
        "industryContext": industryContext,
        "primaryMetric": primaryMetric,
        "userStoryRole": userStoryRole,
        "userStoryGoal": userStoryGoal,
        "userStoryBenefit": userStoryBenefit,
        "knowledgeBaseIds": kb_ids,
        "templateId": int(templateId) if templateId else None,
        "files": file_data
    }
    
    try:
        # Create PRD in pending state
        prd = prd_generator_service.create_prd(session, request)
        
        # Schedule background generation
        background_tasks.add_task(
            prd_generator_service.run_prd_pipeline,
            session,
            prd.id
        )
        
        return prd
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[GeneratedPrd])
def list_prds(
    skip: int = 0,
    limit: int = 20,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    return prd_generator_service.list_prds(session, skip=skip, limit=limit, user_id=current_user.id)

@router.get("/{id}/status")
def get_prd_status(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    prd = prd_generator_service.get_prd(session, id)
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")
        
    return {
        "id": prd.id,
        "status": prd.status,
        "progressStep": prd.progress_step,
        "progressMessage": prd.progress_message,
        "errorMessage": prd.error_message,
        "updatedAt": prd.updated_at.isoformat()
    }

@router.post("/{id}/retry", response_model=GeneratedPrd)
def retry_prd(
    id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
) -> Any:
    prd = prd_generator_service.retry_prd(session, id)
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")
        
    # Schedule background generation
    background_tasks.add_task(
        prd_generator_service.run_prd_pipeline,
        session,
        prd.id
    )
    
    return prd

@router.get("/templates", response_model=List[PrdTemplate])
def list_templates(session: Session = Depends(get_session)) -> Any:
    templates = session.exec(select(PrdTemplate)).all()
    return templates

@router.delete("/{id}")
def delete_prd(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not prd_generator_service.delete_prd(session, id):
        raise HTTPException(status_code=404, detail="PRD not found")
    return Response(status_code=204)

@router.get("/{id}", response_model=GeneratedPrd)
def get_prd(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    prd = prd_generator_service.get_prd(session, id)
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")
    return prd
