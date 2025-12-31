"""
Measurement Framework Builder API Endpoints

REST API for measurement framework workflow.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db
from app.models.measurement_framework import (
    MeasurementFrameworkSession,
    FrameworkMetric,
    FrameworkDataSource,
    FrameworkDashboard,
    MeasurementFrameworkSessionCreate,
    MeasurementFrameworkSessionResponse,
    FrameworkMetricResponse,
)
from app.services.measurement_framework_service import MeasurementFrameworkService

router = APIRouter()
service = MeasurementFrameworkService()


@router.post("/sessions", response_model=MeasurementFrameworkSessionResponse)
async def create_session(
    data: MeasurementFrameworkSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new measurement framework session and start generation."""
    session = service.create_session(db, data)
    background_tasks.add_task(service.generate_framework, db, session.id)
    return session


@router.get("/sessions", response_model=List[MeasurementFrameworkSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List measurement framework sessions with pagination."""
    return service.list_sessions(db, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=MeasurementFrameworkSessionResponse)
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


@router.post("/sessions/{session_id}/retry", response_model=MeasurementFrameworkSessionResponse)
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

    background_tasks.add_task(service.generate_framework, db, session_id)
    return session


@router.get("/sessions/{session_id}/metrics", response_model=List[FrameworkMetricResponse])
async def get_metrics(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all metrics for a session."""
    return service.get_metrics(db, session_id)


@router.get("/sessions/{session_id}/data-sources")
async def get_data_sources(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all data sources for a session."""
    return service.get_data_sources(db, session_id)


@router.get("/sessions/{session_id}/dashboards")
async def get_dashboards(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all dashboards for a session."""
    return service.get_dashboards(db, session_id)


@router.get("/sessions/{session_id}/full")
async def get_session_full(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a session with all framework components."""
    session = service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session": session,
        "metrics": service.get_metrics(db, session_id),
        "data_sources": service.get_data_sources(db, session_id),
        "dashboards": service.get_dashboards(db, session_id),
    }
