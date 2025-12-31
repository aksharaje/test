"""
KPI Assignment API Endpoints

REST API for manual KPI assignment to Key Results.
"""
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db
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
    db: Session = Depends(get_db),
) -> KpiAssignmentSession:
    """Create a new KPI assignment session for an OKR session."""
    try:
        return service.create_session(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions", response_model=List[KpiAssignmentSessionResponse])
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> List[KpiAssignmentSession]:
    """List all KPI assignment sessions."""
    return service.list_sessions(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=KpiAssignmentSessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
) -> KpiAssignmentSession:
    """Get a specific KPI assignment session."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/by-okr/{okr_session_id}", response_model=KpiAssignmentSessionResponse)
def get_session_by_okr(
    okr_session_id: int,
    db: Session = Depends(get_db),
) -> KpiAssignmentSession:
    """Get or create KPI assignment session for an OKR session."""
    session = service.get_session_by_okr(db, okr_session_id)
    if not session:
        # Auto-create session
        session = service.create_session(db, KpiAssignmentSessionCreate(okr_session_id=okr_session_id))
    return session


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Delete a KPI assignment session."""
    if not service.delete_session(db, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/complete", response_model=KpiAssignmentSessionResponse)
def complete_session(
    session_id: int,
    db: Session = Depends(get_db),
) -> KpiAssignmentSession:
    """Mark a KPI assignment session as completed."""
    try:
        return service.complete_session(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== ASSIGNMENT ENDPOINTS ====================

@router.get("/sessions/{session_id}/assignments", response_model=List[KpiAssignmentResponse])
def get_assignments(
    session_id: int,
    db: Session = Depends(get_db),
) -> List[KpiAssignment]:
    """Get all KPI assignments for a session."""
    return service.get_assignments(db, session_id)


@router.post("/sessions/{session_id}/assignments", response_model=KpiAssignmentResponse)
def create_or_update_assignment(
    session_id: int,
    data: KpiAssignmentCreate,
    db: Session = Depends(get_db),
) -> KpiAssignment:
    """Create or update a KPI assignment."""
    # Verify session exists
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.create_or_update_assignment(db, session_id, data)


@router.delete("/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
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
) -> Dict[str, Any]:
    """Get full session data with key results and assignments."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    key_results_with_assignments = service.get_key_results_with_assignments(db, session_id)

    return {
        "session": session,
        "items": key_results_with_assignments,
    }


@router.get("/key-results/{key_result_id}/suggestions")
def get_kpi_suggestions(
    key_result_id: int,
    db: Session = Depends(get_db),
) -> List[str]:
    """Get AI-generated KPI suggestions for a key result."""
    return service.get_kpi_suggestions(db, key_result_id)
