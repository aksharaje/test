from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response, Form, UploadFile, File
from sqlmodel import Session, select
from app.core.db import get_session
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
    session: Session = Depends(get_session)
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
        return prd_generator_service.generate(session, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
