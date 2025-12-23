"""
Opportunity Linker API Endpoints

REST API for opportunity mapping and prioritization workflow.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel

from app.core.db import get_session
from app.services.opportunity_linker_service import opportunity_linker_service
from app.models.opportunity_linker import PrioritizationSession


router = APIRouter()


class CreateSessionRequest(BaseModel):
    """Request to create a new prioritization session"""
    ideation_session_id: int


class SessionStatusResponse(BaseModel):
    """Session status response"""
    id: int
    status: str
    progress_step: int
    progress_message: Optional[str]
    error_message: Optional[str]


@router.post("/sessions", response_model=dict, status_code=201)
def create_prioritization_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session)
):
    """
    Create a new prioritization session and start processing in background.

    Args:
        request: Create session request with ideation_session_id

    Returns:
        Created session with status "pending"

    Raises:
        400: If ideation_engine_result is NULL or EMPTY
        400: If ideation session not completed
        404: If ideation session not found
    """
    try:
        # Create session
        session = opportunity_linker_service.create_session(
            db=db,
            ideation_session_id=request.ideation_session_id
        )

        # Start background processing
        background_tasks.add_task(
            _process_session_background,
            session.id
        )

        return {
            "id": session.id,
            "status": session.status,
            "message": "Prioritization session created. Processing started."
        }

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        elif "must be completed" in error_msg or "NULL" in error_msg or "EMPTY" in error_msg:
            raise HTTPException(
                status_code=400,
                detail="Missing required input: ideation_engine_result"
            )
        else:
            raise HTTPException(status_code=400, detail=error_msg)


def _process_session_background(session_id: int):
    """Background task to process prioritization session"""
    from app.core.db import engine
    with Session(engine) as db:
        try:
            opportunity_linker_service.process_session(db, session_id)
        except Exception as e:
            print(f"Error processing prioritization session {session_id}: {e}")


@router.get("/sessions/{session_id}", response_model=dict)
def get_session_detail(
    session_id: int,
    db: Session = Depends(get_session)
):
    """
    Get full session detail with all prioritized ideas.

    Returns:
        Session object with nested ideas array

    Raises:
        404: If session not found
    """
    detail = opportunity_linker_service.get_session_detail(db, session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Prioritization session not found")

    return detail


@router.get("/sessions/{session_id}/status", response_model=SessionStatusResponse)
def get_session_status(
    session_id: int,
    db: Session = Depends(get_session)
):
    """
    Get session status for polling.

    Returns:
        Status object with progress information

    Raises:
        404: If session not found
    """
    session = opportunity_linker_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Prioritization session not found")

    return SessionStatusResponse(
        id=session.id,
        status=session.status,
        progress_step=session.progress_step,
        progress_message=session.progress_message,
        error_message=session.error_message
    )


@router.get("/sessions", response_model=List[dict])
def list_sessions(
    user_id: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """
    List all prioritization sessions.

    Args:
        user_id: Optional filter by user ID

    Returns:
        List of prioritization sessions
    """
    sessions = opportunity_linker_service.list_sessions(db, user_id)
    return [s.model_dump() for s in sessions]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_session)
):
    """
    Delete a prioritization session and all its prioritized ideas.

    Returns:
        204 No Content on success

    Raises:
        404: If session not found
    """
    success = opportunity_linker_service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Prioritization session not found")

    return None
