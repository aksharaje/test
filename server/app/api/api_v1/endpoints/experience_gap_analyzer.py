"""
Experience Gap Analyzer API Endpoints

REST API for AI-powered experience gap analysis.
Compares customer journeys to identify gaps and generate prioritized improvement roadmaps.
"""
import json
from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Form
from sqlmodel import Session, select, desc
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.db import get_session
from app.models.experience_gap_analyzer import (
    GapAnalysisSession,
    GapItem,
    CapabilityMatrixItem,
    StageAlignment
)
from app.models.journey_mapper import JourneyMapSession
from app.services.experience_gap_analyzer_service import experience_gap_analyzer_service

router = APIRouter()


# --- Request/Response Models ---

class CreateGapAnalysisRequest(BaseModel):
    model_config = {"populate_by_name": True}

    analysis_type: str = Field(default="competitive", alias="analysisType")  # competitive, best_practice, temporal
    analysis_name: Optional[str] = Field(default=None, alias="analysisName")
    your_journey_id: int = Field(alias="yourJourneyId")
    comparison_journey_id: Optional[int] = Field(default=None, alias="comparisonJourneyId")
    user_id: Optional[int] = Field(default=None, alias="userId")
    knowledge_base_ids: Optional[List[int]] = Field(default=None, alias="knowledgeBaseIds")
    analysis_parameters: Optional[Dict[str, Any]] = Field(default=None, alias="analysisParameters")


class UpdateGapRequest(BaseModel):
    model_config = {"populate_by_name": True}

    title: Optional[str] = None
    description: Optional[str] = None
    impact_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, alias="impactScore")
    urgency_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, alias="urgencyScore")
    effort_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, alias="effortScore")
    user_priority_override: Optional[int] = Field(default=None, ge=1, le=3, alias="userPriorityOverride")


class AddGapRequest(BaseModel):
    model_config = {"populate_by_name": True}

    title: str
    description: str
    category: str = Field(default="experience")
    impact_score: float = Field(default=5.0, ge=1.0, le=10.0, alias="impactScore")
    urgency_score: float = Field(default=5.0, ge=1.0, le=10.0, alias="urgencyScore")
    effort_score: float = Field(default=5.0, ge=1.0, le=10.0, alias="effortScore")
    stage_id: Optional[str] = Field(default=None, alias="stageId")
    stage_name: Optional[str] = Field(default=None, alias="stageName")


class ReorderRoadmapRequest(BaseModel):
    model_config = {"populate_by_name": True}

    gap_id: int = Field(alias="gapId")
    new_tier: int = Field(ge=1, le=3, alias="newTier")


# --- Endpoints ---

@router.get("/context-sources")
def get_available_context_sources(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get available context sources for gap analysis (completed journey maps)"""
    # Get completed journey maps
    journey_query = select(JourneyMapSession).where(JourneyMapSession.status == "completed")
    journey_query = journey_query.where(JourneyMapSession.user_id == current_user.id)
    journey_query = journey_query.order_by(desc(JourneyMapSession.created_at)).limit(50)
    journey_maps = list(db_session.exec(journey_query).all())

    return {
        "journeyMaps": [
            {
                "id": jm.id,
                "description": jm.journey_description[:100] + "..." if len(jm.journey_description) > 100 else jm.journey_description,
                "mode": jm.mode,
                "stageCount": len(jm.stages) if jm.stages else 0,
                "createdAt": jm.created_at.isoformat() if jm.created_at else None,
                "competitorName": jm.competitor_name
            }
            for jm in journey_maps
        ]
    }


@router.post("/sessions")
def create_session(
    request: CreateGapAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Create a new gap analysis session and start analysis"""
    try:
        session_obj = experience_gap_analyzer_service.create_session(
            db=db_session,
            analysis_type=request.analysis_type,
            your_journey_id=request.your_journey_id,
            comparison_journey_id=request.comparison_journey_id,
            analysis_name=request.analysis_name,
            user_id=current_user.id,
            knowledge_base_ids=request.knowledge_base_ids,
            analysis_parameters=request.analysis_parameters
        )

        # Trigger background analysis
        background_tasks.add_task(
            experience_gap_analyzer_service.run_gap_analysis_pipeline,
            db_session,
            session_obj.id
        )

        return session_obj

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get gap analysis session with all related data"""
    result = experience_gap_analyzer_service.get_session_detail(db_session, session_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling during analysis"""
    session_obj = experience_gap_analyzer_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "progressStep": session_obj.progress_step,
        "progressMessage": session_obj.progress_message,
        "errorMessage": session_obj.error_message
    }


@router.get("/sessions")
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """List all gap analysis sessions"""
    sessions = experience_gap_analyzer_service.list_sessions(db_session, user_id=current_user.id, skip=skip, limit=limit)
    return sessions


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a gap analysis session and all related data"""
    success = experience_gap_analyzer_service.delete_session(db_session, session_id, user_id=current_user.id)
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
    """Retry a failed gap analysis"""
    session_obj = experience_gap_analyzer_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reset status
    session_obj.status = "pending"
    session_obj.error_message = None
    session_obj.progress_step = 0
    session_obj.progress_message = "Retrying analysis..."
    db_session.add(session_obj)
    db_session.commit()

    # Trigger background analysis
    background_tasks.add_task(
        experience_gap_analyzer_service.run_gap_analysis_pipeline,
        db_session,
        session_obj.id
    )

    return session_obj


# --- Gap Management ---

@router.patch("/gaps/{gap_id}")
def update_gap(
    gap_id: int,
    request: UpdateGapRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Update a gap item (user edits)"""
    updates = {}
    if request.title is not None:
        updates["title"] = request.title
    if request.description is not None:
        updates["description"] = request.description
    if request.impact_score is not None:
        updates["impact_score"] = request.impact_score
    if request.urgency_score is not None:
        updates["urgency_score"] = request.urgency_score
    if request.effort_score is not None:
        updates["effort_score"] = request.effort_score
    if request.user_priority_override is not None:
        updates["user_priority_override"] = request.user_priority_override

    gap = experience_gap_analyzer_service.update_gap(db_session, gap_id, updates)
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found")
    return gap


@router.post("/sessions/{session_id}/gaps")
def add_gap(
    session_id: int,
    request: AddGapRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Manually add a gap to an analysis"""
    try:
        gap = experience_gap_analyzer_service.add_gap(
            db=db_session,
            session_id=session_id,
            title=request.title,
            description=request.description,
            category=request.category,
            impact_score=request.impact_score,
            urgency_score=request.urgency_score,
            effort_score=request.effort_score,
            stage_id=request.stage_id,
            stage_name=request.stage_name
        )
        return gap
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/gaps/{gap_id}")
def delete_gap(
    gap_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a gap"""
    success = experience_gap_analyzer_service.delete_gap(db_session, gap_id)
    if not success:
        raise HTTPException(status_code=404, detail="Gap not found")
    return {"success": True}


# --- Roadmap Management ---

@router.post("/sessions/{session_id}/reorder-roadmap")
def reorder_roadmap(
    session_id: int,
    request: ReorderRoadmapRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Reorder a gap in the roadmap (drag-drop between tiers)"""
    gap = experience_gap_analyzer_service.reorder_roadmap(
        db=db_session,
        session_id=session_id,
        gap_id=request.gap_id,
        new_tier=request.new_tier
    )
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found or doesn't belong to this session")

    # Return updated session with new roadmap
    return experience_gap_analyzer_service.get_session_detail(db_session, session_id, user_id=current_user.id)


# --- Export ---

@router.get("/sessions/{session_id}/export")
def export_analysis(
    session_id: int,
    format: str = "json",  # json, pdf
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Export gap analysis (currently JSON only, PDF in future)"""
    result = experience_gap_analyzer_service.get_session_detail(db_session, session_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    if format == "json":
        return result
    elif format == "pdf":
        # Placeholder - would integrate with PDF generation library
        raise HTTPException(status_code=501, detail="Export to PDF not yet implemented")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}")
