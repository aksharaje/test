"""
CX Improvement Recommender API Endpoints

REST API for AI-powered improvement recommendations.
Synthesizes pain points from journey maps and gaps from competitive analysis
into prioritized, actionable improvement recommendations.
"""
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.db import get_session
from app.services.cx_recommender_service import cx_recommender_service

router = APIRouter()


# --- Request/Response Models ---

class CreateSessionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    session_name: Optional[str] = Field(default=None, alias="sessionName")
    journey_map_ids: List[int] = Field(default_factory=list, alias="journeyMapIds")
    gap_analysis_ids: Optional[List[int]] = Field(default=None, alias="gapAnalysisIds")
    idea_backlog_ids: Optional[List[int]] = Field(default=None, alias="ideaBacklogIds")
    timeline: str = Field(default="flexible")  # Q1 2025, Q2 2025, H1 2025, H2 2025, flexible
    budget: str = Field(default="flexible")  # limited, moderate, flexible
    team_capacity: Optional[str] = Field(default=None, alias="teamCapacity")
    recommendation_type: str = Field(default="comprehensive", alias="recommendationType")
    # Types: comprehensive, quick_wins, strategic, parity
    user_id: Optional[int] = Field(default=None, alias="userId")


class UpdateRecommendationRequest(BaseModel):
    model_config = {"populate_by_name": True}

    title: Optional[str] = None
    description: Optional[str] = None
    impact_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, alias="impactScore")
    effort_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, alias="effortScore")
    urgency_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, alias="urgencyScore")
    implementation_approach: Optional[str] = Field(default=None, alias="implementationApproach")
    success_metrics: Optional[List[str]] = Field(default=None, alias="successMetrics")
    status: Optional[str] = None  # proposed, approved, in_progress, completed, dismissed


class AddCustomRecommendationRequest(BaseModel):
    model_config = {"populate_by_name": True}

    title: str
    description: str
    impact_score: float = Field(default=5.0, ge=1.0, le=10.0, alias="impactScore")
    effort_score: float = Field(default=5.0, ge=1.0, le=10.0, alias="effortScore")
    urgency_score: float = Field(default=5.0, ge=1.0, le=10.0, alias="urgencyScore")
    implementation_approach: Optional[str] = Field(default=None, alias="implementationApproach")
    success_metrics: Optional[List[str]] = Field(default=None, alias="successMetrics")


# --- Context Sources Endpoints ---

@router.get("/context-sources")
def get_available_context_sources(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get available context sources for recommendation generation."""
    journey_maps = cx_recommender_service.list_available_journey_maps(db_session, current_user.id)
    gap_analyses = cx_recommender_service.list_available_gap_analyses(db_session, current_user.id)

    return {
        "journeyMaps": journey_maps,
        "gapAnalyses": gap_analyses
    }


# --- Session Endpoints ---

@router.post("/sessions")
def create_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Create a new recommendation session and start the pipeline."""
    try:
        session_obj = cx_recommender_service.create_session(
            db=db_session,
            journey_map_ids=request.journey_map_ids,
            gap_analysis_ids=request.gap_analysis_ids,
            idea_backlog_ids=request.idea_backlog_ids,
            timeline=request.timeline,
            budget=request.budget,
            team_capacity=request.team_capacity,
            recommendation_type=request.recommendation_type,
            session_name=request.session_name,
            user_id=current_user.id
        )

        # Run pipeline in background
        background_tasks.add_task(
            cx_recommender_service.run_recommendation_pipeline,
            db_session,
            session_obj.id
        )

        return session_obj

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/sessions")
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """List all recommendation sessions."""
    sessions = cx_recommender_service.list_sessions(
        db=db_session,
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    return sessions


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get complete session detail with all recommendations."""
    # Verify user has access
    session_obj = cx_recommender_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    result = cx_recommender_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling during processing."""
    session_obj = cx_recommender_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "progressStep": session_obj.progress_step,
        "progressMessage": session_obj.progress_message,
        "errorMessage": session_obj.error_message
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a session and all related data."""
    # Verify user has access
    session_obj = cx_recommender_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    success = cx_recommender_service.delete_session(db_session, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


@router.post("/sessions/{session_id}/retry")
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Retry a failed recommendation session."""
    from datetime import datetime

    session_obj = cx_recommender_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reset status
    session_obj.status = "pending"
    session_obj.error_message = None
    session_obj.progress_step = 0
    session_obj.progress_message = "Retrying recommendation generation..."
    session_obj.updated_at = datetime.utcnow()
    db_session.add(session_obj)
    db_session.commit()

    # Run pipeline in background
    background_tasks.add_task(
        cx_recommender_service.run_recommendation_pipeline,
        db_session,
        session_obj.id
    )

    return session_obj


# --- Recommendation Management Endpoints ---

@router.patch("/recommendations/{rec_id}")
def update_recommendation(
    rec_id: int,
    request: UpdateRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Update a recommendation (user edits)."""
    updates = {}
    if request.title is not None:
        updates["title"] = request.title
    if request.description is not None:
        updates["description"] = request.description
    if request.impact_score is not None:
        updates["impact_score"] = request.impact_score
    if request.effort_score is not None:
        updates["effort_score"] = request.effort_score
    if request.urgency_score is not None:
        updates["urgency_score"] = request.urgency_score
    if request.implementation_approach is not None:
        updates["implementation_approach"] = request.implementation_approach
    if request.success_metrics is not None:
        updates["success_metrics"] = request.success_metrics
    if request.status is not None:
        updates["status"] = request.status

    rec = cx_recommender_service.update_recommendation(db_session, rec_id, updates)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec


@router.post("/sessions/{session_id}/recommendations")
def add_custom_recommendation(
    session_id: int,
    request: AddCustomRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Add a custom recommendation to a session."""
    # Verify session exists and user has access
    session_obj = cx_recommender_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    rec = cx_recommender_service.add_custom_recommendation(
        db=db_session,
        session_id=session_id,
        title=request.title,
        description=request.description,
        impact_score=request.impact_score,
        effort_score=request.effort_score,
        urgency_score=request.urgency_score,
        implementation_approach=request.implementation_approach,
        success_metrics=request.success_metrics
    )
    return rec


@router.delete("/recommendations/{rec_id}")
def dismiss_recommendation(
    rec_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Dismiss (soft delete) a recommendation."""
    success = cx_recommender_service.dismiss_recommendation(db_session, rec_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"success": True}


@router.post("/recommendations/{rec_id}/restore")
def restore_recommendation(
    rec_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Restore a dismissed recommendation."""
    rec = cx_recommender_service.restore_recommendation(db_session, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec


# --- Export Endpoint ---

@router.get("/sessions/{session_id}/export")
def export_session(
    session_id: int,
    format: str = "json",  # json, csv
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Export recommendation session (JSON only for now)."""
    # Verify user has access
    session_obj = cx_recommender_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    result = cx_recommender_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    if format == "json":
        return result
    elif format == "csv":
        raise HTTPException(status_code=501, detail="CSV export not yet implemented")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}")
