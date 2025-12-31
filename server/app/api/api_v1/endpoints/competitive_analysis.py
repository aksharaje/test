"""
Competitive Analysis API Endpoints

REST API for competitive analysis workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select

from app.api.deps import get_db
from app.models.competitive_analysis import (
    CompetitiveAnalysisSessionCreate,
    CompetitiveAnalysisSessionResponse,
    FocusAreaOption,
    IndustryOption,
    InputSourceOption,
    FOCUS_AREAS,
    INDUSTRIES,
    INPUT_SOURCE_TYPES,
)
from app.models.knowledge_base import KnowledgeBase, Document
from app.services.competitive_analysis_service import competitive_analysis_service as service

router = APIRouter()


@router.get("/focus-areas", response_model=List[FocusAreaOption])
async def get_focus_areas():
    """Get available focus area options (sorted alphabetically)"""
    return [FocusAreaOption(**area) for area in FOCUS_AREAS]


@router.get("/industries", response_model=List[IndustryOption])
async def get_industries():
    """Get available industry options (sorted alphabetically)"""
    return [IndustryOption(**ind) for ind in INDUSTRIES]


@router.get("/input-source-types", response_model=List[InputSourceOption])
async def get_input_source_types():
    """Get available input source type options"""
    return [InputSourceOption(**src) for src in INPUT_SOURCE_TYPES]


@router.get("/code-knowledge-bases")
async def get_code_knowledge_bases(
    db: Session = Depends(get_db),
):
    """Get knowledge bases that contain code (from GitHub)"""
    # Find KB IDs that have github documents
    kb_ids_result = db.exec(
        select(Document.knowledgeBaseId).where(Document.source == "github").distinct()
    ).all()
    kb_ids = [r for r in kb_ids_result if r is not None]

    if not kb_ids:
        return []

    # Get KBs by IDs
    query = select(KnowledgeBase).where(
        KnowledgeBase.id.in_(kb_ids),
        KnowledgeBase.documentCount > 0
    ).order_by(KnowledgeBase.createdAt.desc())
    kbs = list(db.exec(query).all())

    return [
        {
            "id": kb.id,
            "name": kb.name,
            "description": kb.description,
            "documentCount": kb.documentCount,
            "repoUrl": kb.sourceMetadata.get("repoUrl") if kb.sourceMetadata else None,
        }
        for kb in kbs
    ]


@router.post("/sessions", response_model=CompetitiveAnalysisSessionResponse)
async def create_session(
    data: CompetitiveAnalysisSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new competitive analysis session and start analysis."""
    session = service.create_session(db, data)
    background_tasks.add_task(service.run_analysis, db, session.id)
    return session


@router.get("/sessions", response_model=List[CompetitiveAnalysisSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List competitive analysis sessions with pagination."""
    return service.list_sessions(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=CompetitiveAnalysisSessionResponse)
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific session by ID."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/{session_id}/status")
async def get_session_status(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get session status for polling."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session.id,
        "status": session.status,
        "errorMessage": session.error_message,
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Delete a session."""
    success = service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=CompetitiveAnalysisSessionResponse)
async def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Retry a failed session."""
    session = service.retry_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    background_tasks.add_task(service.run_analysis, db, session.id)
    return session
