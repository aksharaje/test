"""
Scope Monitor API Endpoints

REST API for scope monitoring workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db
from app.models.scope_monitor import (
    ScopeMonitorSession,
    ScopeChange,
    ImpactAssessment,
    ScopeAlert,
    ScopeMonitorSessionCreate,
    ScopeMonitorSessionResponse,
    ScopeChangeResponse,
    ScopeAlertResponse,
)
from app.services.scope_monitor_service import ScopeMonitorService

router = APIRouter()
service = ScopeMonitorService()


@router.post("/sessions", response_model=ScopeMonitorSessionResponse)
async def create_session(
    data: ScopeMonitorSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new scope monitor session and start analysis."""
    session = service.create_session(db, data)
    background_tasks.add_task(service.analyze_scope, db, session.id)
    return session


@router.get("/sessions", response_model=List[ScopeMonitorSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List scope monitor sessions with pagination."""
    return service.list_sessions(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=ScopeMonitorSessionResponse)
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
    """Delete a session and all related data."""
    success = service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=ScopeMonitorSessionResponse)
async def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Retry a failed session."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "pending"
    session.error_message = None
    db.commit()

    background_tasks.add_task(service.analyze_scope, db, session_id)
    return session


@router.get("/sessions/{session_id}/changes", response_model=List[ScopeChangeResponse])
async def get_changes(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all scope changes for a session."""
    return service.get_changes(db, session_id)


@router.get("/sessions/{session_id}/impact-assessments")
async def get_impact_assessments(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all impact assessments for a session."""
    return service.get_impact_assessments(db, session_id)


@router.get("/sessions/{session_id}/alerts", response_model=List[ScopeAlertResponse])
async def get_alerts(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all alerts for a session."""
    return service.get_alerts(db, session_id)


@router.get("/sessions/{session_id}/full")
async def get_session_full(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a session with all analysis results."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    changes = service.get_changes(db, session_id)

    # Categorize changes
    scope_creep_changes = [c for c in changes if c.is_scope_creep]
    non_creep_changes = [c for c in changes if not c.is_scope_creep]

    return {
        "session": session,
        "scope_creep_changes": scope_creep_changes,
        "other_changes": non_creep_changes,
        "impact_assessments": service.get_impact_assessments(db, session_id),
        "alerts": service.get_alerts(db, session_id),
    }
