"""
KPI Assignment API Endpoints

REST API for AI-powered KPI assignment from Goals.
"""
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.kpi_assignment import (
    KpiAssignmentSession,
    KpiAssignment,
    KpiAssignmentSessionCreate,
    KpiAssignmentCreate,
    KpiAssignmentSessionResponse,
    KpiAssignmentResponse,
)
from app.services.kpi_assignment_service import KpiAssignmentService

router = APIRouter()
service = KpiAssignmentService()


# ==================== SESSION ENDPOINTS ====================

@router.post("/sessions", response_model=KpiAssignmentSessionResponse)
def create_session(
    data: KpiAssignmentSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KpiAssignmentSession:
    """Create a new KPI assignment session and start generation."""
    try:
        session = service.create_session(db, data, user_id=current_user.id)
        # Start background generation
        background_tasks.add_task(service.generate_kpis, db, session.id)
        return session
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions", response_model=List[KpiAssignmentSessionResponse])
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[KpiAssignmentSession]:
    """List all KPI assignment sessions."""
    return service.list_sessions(db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=KpiAssignmentSessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KpiAssignmentSession:
    """Get a specific KPI assignment session."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/by-goal/{goal_session_id}", response_model=KpiAssignmentSessionResponse)
def get_session_by_goal(
    goal_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KpiAssignmentSession:
    """Get KPI assignment session for a Goal Setting session."""
    session = service.get_session_by_goal(db, goal_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="No KPI assignment found for this goal session")
    # Verify ownership
    if session.user_id and session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="No KPI assignment found for this goal session")
    return session


@router.get("/sessions/by-goal/{goal_session_id}/full")
def get_session_by_goal_full(
    goal_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get full KPI assignment session for a Goal Setting session with all assignments."""
    session = service.get_session_by_goal(db, goal_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="No KPI assignment found for this goal session")
    # Verify ownership
    if session.user_id and session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="No KPI assignment found for this goal session")
    result = service.get_session_full(db, session.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/by-okr/{okr_session_id}", response_model=KpiAssignmentSessionResponse)
def get_session_by_okr(
    okr_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KpiAssignmentSession:
    """Get KPI assignment session for an OKR session (legacy)."""
    session = service.get_session_by_okr(db, okr_session_id)
    if not session:
        raise HTTPException(status_code=404, detail="No KPI assignment found for this OKR session")
    # Verify ownership
    if session.user_id and session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="No KPI assignment found for this OKR session")
    return session


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a KPI assignment session."""
    # Verify ownership first
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not service.delete_session(db, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/retry", response_model=KpiAssignmentSessionResponse)
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KpiAssignmentSession:
    """Retry a failed KPI assignment session."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reset session status
    session.status = "pending"
    session.error_message = None
    db.commit()

    # Start background generation
    background_tasks.add_task(service.generate_kpis, db, session.id)
    return session


# ==================== ASSIGNMENT ENDPOINTS ====================

@router.get("/sessions/{session_id}/assignments", response_model=List[KpiAssignmentResponse])
def get_assignments(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[KpiAssignment]:
    """Get all KPI assignments for a session."""
    # Verify ownership
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_assignments(db, session_id)


@router.patch("/assignments/{assignment_id}", response_model=KpiAssignmentResponse)
def update_assignment(
    assignment_id: int,
    data: KpiAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KpiAssignment:
    """Update a KPI assignment."""
    assignment = service.update_assignment(db, assignment_id, data)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.delete("/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a KPI assignment."""
    if not service.delete_assignment(db, assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Assignment deleted"}


# ==================== DATA RETRIEVAL ENDPOINTS ====================

@router.get("/sessions/{session_id}/full")
def get_session_full(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get full session data with all assignments."""
    # Verify ownership
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = service.get_session_full(db, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result
