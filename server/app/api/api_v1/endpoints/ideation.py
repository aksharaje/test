"""
Ideation API Endpoints

REST API for AI-powered ideation workflow.
"""
from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.core.db import get_session
from app.models.ideation import IdeationSession, GeneratedIdea
from app.services.ideation_service import ideation_service

router = APIRouter()


# --- Request/Response Models ---

class CreateSessionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    problem_statement: str = Field(alias="problemStatement")
    constraints: Optional[str] = Field(default=None, alias="constraints")
    goals: Optional[str] = Field(default=None, alias="goals")
    research_insights: Optional[str] = Field(default=None, alias="researchInsights")
    knowledge_base_ids: Optional[List[int]] = Field(default=None, alias="knowledgeBaseIds")
    user_id: Optional[int] = Field(default=None, alias="userId")


# --- Endpoints ---

@router.post("/sessions", response_model=IdeationSession)
def create_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Create ideation session and start async processing"""
    ideation_session = ideation_service.create_session(
        session=db_session,
        problem_statement=request.problem_statement,
        constraints=request.constraints,
        goals=request.goals,
        research_insights=request.research_insights,
        knowledge_base_ids=request.knowledge_base_ids,
        user_id=request.user_id
    )

    # Trigger background processing
    background_tasks.add_task(
        ideation_service.run_ideation_pipeline,
        db_session,
        ideation_session.id
    )

    return ideation_session


@router.get("/sessions/{session_id}")
def get_session_detail_endpoint(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session with all ideas and clusters"""
    result = ideation_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling"""
    ideation_session = ideation_service.get_session(db_session, session_id)
    if not ideation_session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": ideation_session.id,
        "status": ideation_session.status,
        "progressStep": ideation_session.progress_step,
        "progressMessage": ideation_session.progress_message,
        "confidence": ideation_session.confidence,
        "errorMessage": ideation_session.error_message,
        "createdAt": ideation_session.created_at.isoformat(),
        "updatedAt": ideation_session.updated_at.isoformat(),
        "completedAt": ideation_session.completed_at.isoformat() if ideation_session.completed_at else None
    }


@router.get("/sessions", response_model=List[IdeationSession])
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db_session: Session = Depends(get_session),
    user_id: Optional[int] = None
) -> Any:
    """List user's ideation sessions"""
    return ideation_service.list_sessions(db_session, user_id, skip=skip, limit=limit)


@router.post("/sessions/{session_id}/retry", response_model=IdeationSession)
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Retry a failed session"""
    session = ideation_service.retry_session(db_session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Trigger background processing
    background_tasks.add_task(
        ideation_service.run_ideation_pipeline,
        db_session,
        session.id
    )
    return session


@router.patch("/ideas/{idea_id}", response_model=GeneratedIdea)
def update_idea(
    idea_id: int,
    data: Dict[str, Any],
    db_session: Session = Depends(get_session)
) -> Any:
    """Update idea fields"""
    idea = ideation_service.update_idea(db_session, idea_id, data)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete session and all associated ideas/clusters"""
    if not ideation_service.delete_session(db_session, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted successfully"}
