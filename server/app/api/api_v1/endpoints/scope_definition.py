"""
Scope Definition Agent API Endpoints

REST API for scope definition workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db
from app.models.scope_definition import (
    ScopeDefinitionSession,
    ScopeItem,
    ScopeAssumption,
    ScopeConstraint,
    ScopeDeliverable,
    ScopeDefinitionSessionCreate,
    ScopeDefinitionSessionResponse,
    ScopeItemResponse,
)
from app.services.scope_definition_service import ScopeDefinitionService

router = APIRouter()
service = ScopeDefinitionService()


@router.post("/sessions", response_model=ScopeDefinitionSessionResponse)
async def create_session(
    data: ScopeDefinitionSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new scope definition session and start generation."""
    session = service.create_session(db, data)
    background_tasks.add_task(service.generate_scope, db, session.id)
    return session


@router.get("/sessions", response_model=List[ScopeDefinitionSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List scope definition sessions with pagination."""
    return service.list_sessions(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=ScopeDefinitionSessionResponse)
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


@router.post("/sessions/{session_id}/retry", response_model=ScopeDefinitionSessionResponse)
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

    background_tasks.add_task(service.generate_scope, db, session_id)
    return session


@router.get("/sessions/{session_id}/items", response_model=List[ScopeItemResponse])
async def get_scope_items(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all scope items for a session."""
    return service.get_scope_items(db, session_id)


@router.get("/sessions/{session_id}/assumptions")
async def get_assumptions(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all assumptions for a session."""
    return service.get_assumptions(db, session_id)


@router.get("/sessions/{session_id}/constraints")
async def get_constraints(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all constraints for a session."""
    return service.get_constraints(db, session_id)


@router.get("/sessions/{session_id}/deliverables")
async def get_deliverables(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all deliverables for a session."""
    return service.get_deliverables(db, session_id)


@router.get("/sessions/{session_id}/full")
async def get_session_full(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a session with all scope components."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    items = service.get_scope_items(db, session_id)

    # Organize items by scope type
    in_scope = [i for i in items if i.scope_type == "in_scope"]
    out_of_scope = [i for i in items if i.scope_type == "out_of_scope"]
    deferred = [i for i in items if i.scope_type == "deferred"]

    return {
        "session": session,
        "in_scope_items": in_scope,
        "out_of_scope_items": out_of_scope,
        "deferred_items": deferred,
        "assumptions": service.get_assumptions(db, session_id),
        "constraints": service.get_constraints(db, session_id),
        "deliverables": service.get_deliverables(db, session_id),
    }
