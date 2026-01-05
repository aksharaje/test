"""
Market Research API Endpoints

REST API for market research synthesis workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.market_research import (
    MarketResearchSessionCreate,
    MarketResearchSessionResponse,
    FocusAreaOption,
    IndustryOption,
    FOCUS_AREAS,
    INDUSTRIES,
)
from app.services.market_research_service import market_research_service as service

router = APIRouter()


@router.get("/focus-areas", response_model=List[FocusAreaOption])
async def get_focus_areas():
    """Get available focus area options for market research"""
    return [FocusAreaOption(**area) for area in FOCUS_AREAS]


@router.get("/industries", response_model=List[IndustryOption])
async def get_industries():
    """Get available industry options (sorted alphabetically)"""
    return [IndustryOption(**ind) for ind in INDUSTRIES]


@router.post("/sessions", response_model=MarketResearchSessionResponse)
async def create_session(
    data: MarketResearchSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new market research session and start analysis."""
    session = service.create_session(db, data, user_id=current_user.id)
    background_tasks.add_task(service.run_analysis, db, session.id)
    return session


@router.get("/sessions", response_model=List[MarketResearchSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List market research sessions with pagination."""
    return service.list_sessions(db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=MarketResearchSessionResponse)
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific session by ID."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/{session_id}/status")
async def get_session_status(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session status for polling."""
    session = service.get_session(db, session_id, user_id=current_user.id)
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
    current_user: User = Depends(get_current_user),
):
    """Delete a session."""
    # Verify ownership first
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    success = service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=MarketResearchSessionResponse)
async def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retry a failed session."""
    # Verify ownership
    existing = service.get_session(db, session_id, user_id=current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    session = service.retry_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    background_tasks.add_task(service.run_analysis, db, session.id)
    return session
