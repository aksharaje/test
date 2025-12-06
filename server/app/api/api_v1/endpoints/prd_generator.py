from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from app.core.db import get_session
from app.models.prd import GeneratedPrd, PrdTemplate
from app.services.prd_generator_service import prd_generator_service

router = APIRouter()

# ... (omitted lines)

@router.delete("/{id}")
def delete_prd(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not prd_generator_service.delete_prd(session, id):
        raise HTTPException(status_code=404, detail="PRD not found")
    return Response(status_code=204)

@router.get("/templates", response_model=List[PrdTemplate])
def list_templates(session: Session = Depends(get_session)) -> Any:
    templates = session.exec(select(PrdTemplate)).all()
    return templates
