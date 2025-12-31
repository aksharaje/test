"""
Goal Setting API Endpoints

REST API for goal setting workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db
from app.models.goal_setting import (
    GoalSettingSession,
    Goal,
    GoalSettingSessionCreate,
    GoalSettingSessionResponse,
    GoalResponse,
)
from app.services.goal_setting_service import GoalSettingService

router = APIRouter()
service = GoalSettingService()


@router.post("/sessions", response_model=GoalSettingSessionResponse)
async def create_session(
    data: GoalSettingSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new goal setting session and start generation."""
    session = service.create_session(db, data)

    # Start generation in background
    background_tasks.add_task(service.generate_goals, db, session.id)

    return session


@router.get("/sessions", response_model=List[GoalSettingSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List goal setting sessions with pagination."""
    return service.list_sessions(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=GoalSettingSessionResponse)
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific session by ID."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Delete a session and its goals."""
    success = service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=GoalSettingSessionResponse)
async def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Retry a failed session."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reset and retry in background
    session.status = "pending"
    session.error_message = None
    db.commit()

    background_tasks.add_task(service.generate_goals, db, session_id)

    return session


@router.get("/sessions/{session_id}/goals", response_model=List[GoalResponse])
async def get_goals(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all goals for a session."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return service.get_goals(db, session_id)


@router.get("/sessions/{session_id}/full")
async def get_session_full(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a session with all its goals."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    goals = service.get_goals(db, session_id)

    return {
        "session": session,
        "goals": goals,
    }
