"""
Feasibility API Endpoints

REST API for AI-powered feasibility analysis workflow.
"""
from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.core.db import get_session
from app.models.feasibility import FeasibilitySession, TechnicalComponent
from app.services.feasibility_service import feasibility_service

router = APIRouter()


# --- Request/Response Models ---

class CreateSessionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    feature_description: str = Field(alias="featureDescription", min_length=100)
    technical_constraints: Optional[str] = Field(default=None, alias="technicalConstraints")
    target_users: Optional[str] = Field(default=None, alias="targetUsers")
    user_id: Optional[int] = Field(default=None, alias="userId")


class UpdateComponentRequest(BaseModel):
    model_config = {"populate_by_name": True}

    optimistic_hours: Optional[float] = Field(default=None, alias="optimisticHours")
    realistic_hours: Optional[float] = Field(default=None, alias="realisticHours")
    pessimistic_hours: Optional[float] = Field(default=None, alias="pessimisticHours")


class ActualResultRequest(BaseModel):
    model_config = {"populate_by_name": True}

    component_id: int = Field(alias="componentId")
    actual_hours_spent: float = Field(alias="actualHoursSpent")
    lessons_learned: Optional[str] = Field(default=None, alias="lessonsLearned")


class CaptureActualsRequest(BaseModel):
    model_config = {"populate_by_name": True}

    actuals: List[ActualResultRequest]
    recorded_by_user_id: Optional[int] = Field(default=None, alias="recordedByUserId")


# --- Endpoints ---

@router.post("/sessions", response_model=FeasibilitySession)
def create_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Create feasibility session and start async processing"""
    try:
        session_obj = feasibility_service.create_session(
            db=db_session,
            feature_description=request.feature_description,
            technical_constraints=request.technical_constraints,
            target_users=request.target_users,
            user_id=request.user_id
        )

        # Trigger background processing
        background_tasks.add_task(
            feasibility_service.run_feasibility_pipeline,
            db_session,
            session_obj.id
        )

        return session_obj
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/sessions/{session_id}")
def get_session_detail_endpoint(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session with all components, scenarios, risks, skills"""
    result = feasibility_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling"""
    session_obj = feasibility_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "progressStep": session_obj.progress_step,
        "progressMessage": session_obj.progress_message,
        "errorMessage": session_obj.error_message
    }


@router.get("/sessions", response_model=List[FeasibilitySession])
def list_sessions(
    user_id: Optional[int] = None,
    db_session: Session = Depends(get_session)
) -> Any:
    """List all sessions, optionally filtered by user"""
    return feasibility_service.list_sessions(db_session, user_id=user_id)


@router.patch("/components/{component_id}", response_model=TechnicalComponent)
def update_component(
    component_id: int,
    request: UpdateComponentRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Update component effort estimates (if editable)"""
    try:
        component = feasibility_service.update_component(
            db=db_session,
            component_id=component_id,
            optimistic_hours=request.optimistic_hours,
            realistic_hours=request.realistic_hours,
            pessimistic_hours=request.pessimistic_hours
        )
        if not component:
            raise HTTPException(status_code=404, detail="Component not found")
        return component
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/sessions/{session_id}/actuals")
def capture_actuals(
    session_id: int,
    request: CaptureActualsRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Capture actual results for learning"""
    try:
        actuals_data = [
            {
                "component_id": actual.component_id,
                "actual_hours_spent": actual.actual_hours_spent,
                "lessons_learned": actual.lessons_learned
            }
            for actual in request.actuals
        ]

        results = feasibility_service.capture_actuals(
            db=db_session,
            session_id=session_id,
            actuals_data=actuals_data,
            recorded_by_user_id=request.recorded_by_user_id
        )

        return {"success": True, "actualsCount": len(results)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a session and all related data"""
    success = feasibility_service.delete_session(db_session, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}
