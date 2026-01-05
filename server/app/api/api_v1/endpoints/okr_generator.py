"""
OKR & KPI Generator API Endpoints

REST API for OKR generation workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.okr_generator import (
    OkrSession,
    Objective,
    KeyResult,
    Kpi,
    OkrSessionCreate,
    OkrSessionResponse,
    ObjectiveResponse,
    KeyResultResponse,
    KpiResponse,
)
from app.services.okr_generator_service import OkrGeneratorService

router = APIRouter()
service = OkrGeneratorService()


@router.post("/sessions", response_model=OkrSessionResponse)
async def create_session(
    data: OkrSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new OKR session and start generation."""
    session = service.create_session(db, data, user_id=current_user.id)
    background_tasks.add_task(service.generate_okrs, db, session.id)
    return session


@router.get("/sessions", response_model=List[OkrSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List OKR sessions with pagination."""
    return service.list_sessions(db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=OkrSessionResponse)
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


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a session and all related data."""
    # Verify user owns this session
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    success = service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=OkrSessionResponse)
async def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retry a failed session."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "pending"
    session.error_message = None
    db.commit()

    background_tasks.add_task(service.generate_okrs, db, session_id)
    return session


@router.get("/sessions/{session_id}/objectives", response_model=List[ObjectiveResponse])
async def get_objectives(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all objectives for a session."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_objectives(db, session_id)


@router.get("/sessions/{session_id}/key-results", response_model=List[KeyResultResponse])
async def get_key_results(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all key results for a session."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_key_results_for_session(db, session_id)


@router.get("/sessions/{session_id}/kpis", response_model=List[KpiResponse])
async def get_kpis(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all KPIs for a session."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_kpis(db, session_id)


@router.get("/sessions/{session_id}/full")
async def get_session_full(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a session with all OKRs and KPIs."""
    session = service.get_session(db, session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    objectives = service.get_objectives(db, session_id)
    key_results = service.get_key_results_for_session(db, session_id)
    kpis = service.get_kpis(db, session_id)

    # Organize key results by objective (use camelCase for frontend compatibility)
    objectives_with_kr = []
    for obj in objectives:
        obj_dict = {
            "id": obj.id,
            "sessionId": obj.session_id,
            "title": obj.title,
            "description": obj.description,
            "category": obj.category,
            "timeframe": obj.timeframe,
            "strategicAlignment": obj.strategic_alignment,
            "owner": obj.owner,
            "displayOrder": obj.display_order,
            "keyResults": [
                {
                    "id": kr.id,
                    "objectiveId": kr.objective_id,
                    "sessionId": kr.session_id,
                    "title": kr.title,
                    "description": kr.description,
                    "metricType": kr.metric_type,
                    "baselineValue": kr.baseline_value,
                    "targetValue": kr.target_value,
                    "stretchTarget": kr.stretch_target,
                    "owner": kr.owner,
                    "kpiName": kr.kpi_name,
                    "measurementMethod": kr.measurement_method,
                    "dataSource": kr.data_source,
                    "trackingFrequency": kr.tracking_frequency,
                    "displayOrder": kr.display_order,
                }
                for kr in key_results if kr.objective_id == obj.id
            ]
        }
        objectives_with_kr.append(obj_dict)

    return {
        "session": session,
        "objectives": objectives_with_kr,
        "kpis": kpis,
    }
