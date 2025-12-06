from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.core.db import get_session
from app.models.pi_planning import PiSession, HolidayConfig
from app.services.pi_planning_service import pi_planning_service

router = APIRouter()

@router.get("/holiday-configs", response_model=List[HolidayConfig])
def list_holiday_configs(session: Session = Depends(get_session)) -> Any:
    return pi_planning_service.list_holiday_configs(session)

@router.get("/{integration_id}/sessions", response_model=List[PiSession])
def list_sessions(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    return pi_planning_service.list_sessions(session, integration_id)

@router.post("/{integration_id}/sessions", response_model=Dict[str, int])
def create_session(
    integration_id: int,
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    new_session = pi_planning_service.create_session(session, integration_id, data)
    return {"id": new_session.id}

@router.get("/{integration_id}/sessions/{session_id}", response_model=PiSession)
def get_session(
    integration_id: int,
    session_id: int,
    session: Session = Depends(get_session)
) -> Any:
    pi_session = pi_planning_service.get_session(session, integration_id, session_id)
    if not pi_session:
        raise HTTPException(status_code=404, detail="Session not found")
    return pi_session
