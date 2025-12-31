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


# ==================== ITEM CRUD ENDPOINTS ====================

@router.post("/sessions/{session_id}/items", response_model=ScopeItemResponse)
async def create_scope_item(
    session_id: int,
    data: dict,
    db: Session = Depends(get_db),
):
    """Create a new scope item."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    item = service.create_scope_item(db, session_id, data)
    return item


@router.post("/sessions/{session_id}/assumptions")
async def create_assumption(
    session_id: int,
    data: dict,
    db: Session = Depends(get_db),
):
    """Create a new assumption."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.create_assumption(db, session_id, data)


@router.post("/sessions/{session_id}/constraints")
async def create_constraint(
    session_id: int,
    data: dict,
    db: Session = Depends(get_db),
):
    """Create a new constraint."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.create_constraint(db, session_id, data)


@router.post("/sessions/{session_id}/deliverables")
async def create_deliverable(
    session_id: int,
    data: dict,
    db: Session = Depends(get_db),
):
    """Create a new deliverable."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.create_deliverable(db, session_id, data)


@router.patch("/items/{item_id}", response_model=ScopeItemResponse)
async def update_scope_item(
    item_id: int,
    updates: dict,
    db: Session = Depends(get_db),
):
    """Update a scope item (title, description, scope_type, priority, etc.)."""
    item = service.update_scope_item(db, item_id, updates)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.delete("/items/{item_id}")
async def delete_scope_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Delete a scope item."""
    success = service.delete_scope_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "deleted"}


@router.patch("/assumptions/{assumption_id}")
async def update_assumption(
    assumption_id: int,
    updates: dict,
    db: Session = Depends(get_db),
):
    """Update an assumption."""
    item = service.update_assumption(db, assumption_id, updates)
    if not item:
        raise HTTPException(status_code=404, detail="Assumption not found")
    return item


@router.delete("/assumptions/{assumption_id}")
async def delete_assumption(
    assumption_id: int,
    db: Session = Depends(get_db),
):
    """Delete an assumption."""
    success = service.delete_assumption(db, assumption_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assumption not found")
    return {"status": "deleted"}


@router.patch("/constraints/{constraint_id}")
async def update_constraint(
    constraint_id: int,
    updates: dict,
    db: Session = Depends(get_db),
):
    """Update a constraint."""
    item = service.update_constraint(db, constraint_id, updates)
    if not item:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return item


@router.delete("/constraints/{constraint_id}")
async def delete_constraint(
    constraint_id: int,
    db: Session = Depends(get_db),
):
    """Delete a constraint."""
    success = service.delete_constraint(db, constraint_id)
    if not success:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return {"status": "deleted"}


@router.patch("/deliverables/{deliverable_id}")
async def update_deliverable(
    deliverable_id: int,
    updates: dict,
    db: Session = Depends(get_db),
):
    """Update a deliverable."""
    item = service.update_deliverable(db, deliverable_id, updates)
    if not item:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return item


@router.delete("/deliverables/{deliverable_id}")
async def delete_deliverable(
    deliverable_id: int,
    db: Session = Depends(get_db),
):
    """Delete a deliverable."""
    success = service.delete_deliverable(db, deliverable_id)
    if not success:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return {"status": "deleted"}
