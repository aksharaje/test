"""
Journey & Pain Point Mapper API Endpoints

REST API for AI-powered customer journey mapping.
Supports Standard, Multi-Persona, and Competitive journey modes.
"""
import json
from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Form, UploadFile, File
from sqlmodel import Session, select, desc
from pydantic import BaseModel, Field

from app.core.db import get_session
from app.models.journey_mapper import (
    JourneyMapSession,
    JourneyPainPoint,
    JourneyPersona,
    JourneyDivergencePoint,
    CompetitorJourneyObservation
)
from app.models.knowledge_base import KnowledgeBase
from app.services.journey_mapper_service import journey_mapper_service

router = APIRouter()


# --- Request/Response Models ---

class PersonaInput(BaseModel):
    model_config = {"populate_by_name": True}

    name: str
    description: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


class CreateJourneyRequest(BaseModel):
    model_config = {"populate_by_name": True}

    mode: str = Field(default="standard")  # standard, multi_persona, competitive
    journey_description: str = Field(min_length=5, alias="journeyDescription")
    competitor_name: Optional[str] = Field(default=None, alias="competitorName")
    user_id: Optional[int] = Field(default=None, alias="userId")
    knowledge_base_ids: Optional[List[int]] = Field(default=None, alias="knowledgeBaseIds")
    personas: Optional[List[PersonaInput]] = None


class UpdatePainPointRequest(BaseModel):
    model_config = {"populate_by_name": True}

    description: Optional[str] = None
    severity: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    stage_id: Optional[str] = Field(default=None, alias="stageId")


class AddPainPointRequest(BaseModel):
    model_config = {"populate_by_name": True}

    stage_id: str = Field(alias="stageId")
    description: str
    severity: float = Field(default=5.0, ge=0.0, le=10.0)
    persona_id: Optional[int] = Field(default=None, alias="personaId")


class UpdateStageRequest(BaseModel):
    model_config = {"populate_by_name": True}

    name: Optional[str] = None
    description: Optional[str] = None
    duration_estimate: Optional[str] = Field(default=None, alias="durationEstimate")


class AddStageRequest(BaseModel):
    model_config = {"populate_by_name": True}

    name: str
    description: str = ""
    insert_after_stage_id: Optional[str] = Field(default=None, alias="insertAfterStageId")


class AddCompetitorObservationRequest(BaseModel):
    model_config = {"populate_by_name": True}

    stage_order: int = Field(alias="stageOrder")
    stage_name: str = Field(alias="stageName")
    touchpoints_observed: Optional[List[str]] = Field(default=None, alias="touchpointsObserved")
    time_taken: Optional[str] = Field(default=None, alias="timeTaken")
    friction_points: Optional[List[str]] = Field(default=None, alias="frictionPoints")
    strengths_observed: Optional[List[str]] = Field(default=None, alias="strengthsObserved")
    notes: Optional[str] = None
    screenshot_url: Optional[str] = Field(default=None, alias="screenshotUrl")


class CreateVersionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    update_type: str = Field(default="refresh", alias="updateType")  # refresh, expand, correct
    knowledge_base_ids: Optional[List[int]] = Field(default=None, alias="knowledgeBaseIds")


# --- Helper Functions ---

async def read_file_content(file: UploadFile, max_chars: int = 50000) -> str:
    """Read file content and extract text (simplified for MVP)."""
    try:
        content = await file.read()
        # For MVP, just decode as text. In production, use proper PDF/DOCX parsers
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            text = content.decode('latin-1', errors='ignore')

        # Truncate if too long
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Content truncated...]"

        return text
    except Exception as e:
        print(f"Error reading file {file.filename}: {e}")
        return ""


# --- Endpoints ---

@router.get("/context-sources")
def get_available_context_sources(
    user_id: Optional[int] = None,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get available context sources for journey mapping (KBs, ideation, feasibility, business case sessions)"""
    from app.models.ideation import IdeationSession
    from app.models.feasibility import FeasibilitySession
    from app.models.business_case import BusinessCaseSession

    # Get ready knowledge bases
    kb_query = select(KnowledgeBase).where(KnowledgeBase.status == "ready")
    if user_id:
        kb_query = kb_query.where(KnowledgeBase.userId == user_id)
    kb_query = kb_query.order_by(desc(KnowledgeBase.updatedAt)).limit(20)
    knowledge_bases = list(db_session.exec(kb_query).all())

    # Get completed ideation sessions
    ideation_query = select(IdeationSession).where(IdeationSession.status == "completed")
    if user_id:
        ideation_query = ideation_query.where(IdeationSession.user_id == user_id)
    ideation_query = ideation_query.order_by(desc(IdeationSession.created_at)).limit(20)
    ideation_sessions = list(db_session.exec(ideation_query).all())

    # Get completed feasibility sessions
    feasibility_query = select(FeasibilitySession).where(FeasibilitySession.status == "completed")
    if user_id:
        feasibility_query = feasibility_query.where(FeasibilitySession.user_id == user_id)
    feasibility_query = feasibility_query.order_by(desc(FeasibilitySession.created_at)).limit(20)
    feasibility_sessions = list(db_session.exec(feasibility_query).all())

    # Get completed business case sessions
    business_case_query = select(BusinessCaseSession).where(BusinessCaseSession.status == "completed")
    if user_id:
        business_case_query = business_case_query.where(BusinessCaseSession.user_id == user_id)
    business_case_query = business_case_query.order_by(desc(BusinessCaseSession.created_at)).limit(20)
    business_case_sessions = list(db_session.exec(business_case_query).all())

    return {
        "knowledgeBases": [
            {"id": kb.id, "name": kb.name, "documentCount": kb.documentCount}
            for kb in knowledge_bases
        ],
        "ideationSessions": [
            {
                "id": s.id,
                "problemStatement": s.problem_statement[:100] + "..." if s.problem_statement and len(s.problem_statement) > 100 else s.problem_statement,
                "createdAt": s.created_at.isoformat() if s.created_at else None
            }
            for s in ideation_sessions
        ],
        "feasibilitySessions": [
            {
                "id": s.id,
                "featureName": s.feature_description[:100] + "..." if s.feature_description and len(s.feature_description) > 100 else s.feature_description,
                "createdAt": s.created_at.isoformat() if s.created_at else None
            }
            for s in feasibility_sessions
        ],
        "businessCaseSessions": [
            {
                "id": s.id,
                "featureName": s.feature_name[:100] + "..." if s.feature_name and len(s.feature_name) > 100 else s.feature_name,
                "createdAt": s.created_at.isoformat() if s.created_at else None
            }
            for s in business_case_sessions
        ]
    }


@router.post("/sessions")
async def create_session(
    background_tasks: BackgroundTasks,
    mode: str = Form(default="standard"),
    journeyDescription: str = Form(...),
    competitorName: Optional[str] = Form(default=None),
    userId: Optional[int] = Form(default=None),
    knowledgeBaseIds: str = Form(default="[]"),
    ideationSessionId: Optional[int] = Form(default=None),
    feasibilitySessionId: Optional[int] = Form(default=None),
    businessCaseSessionId: Optional[int] = Form(default=None),
    personas: str = Form(default="[]"),
    files: List[UploadFile] = File(default=[]),
    db_session: Session = Depends(get_session)
) -> Any:
    """Create a new journey mapping session and start generation"""
    try:
        # Parse JSON fields
        kb_ids = json.loads(knowledgeBaseIds) if knowledgeBaseIds else []
        persona_list = json.loads(personas) if personas else []

        # Process uploaded files
        file_metadata = []
        for file in files:
            content_preview = await read_file_content(file)
            file_metadata.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "size": file.size,
                "content_preview": content_preview
            })

        # Create session
        session_obj = journey_mapper_service.create_session(
            db=db_session,
            mode=mode,
            journey_description=journeyDescription,
            user_id=userId,
            file_metadata=file_metadata if file_metadata else None,
            knowledge_base_ids=kb_ids if kb_ids else None,
            ideation_session_id=ideationSessionId,
            feasibility_session_id=feasibilitySessionId,
            business_case_session_id=businessCaseSessionId,
            competitor_name=competitorName,
            personas=persona_list if persona_list else None
        )

        # Trigger background generation for all modes
        background_tasks.add_task(
            journey_mapper_service.run_journey_generation_pipeline,
            db_session,
            session_obj.id
        )

        return session_obj

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in request: {str(e)}")


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get journey map session with all related data"""
    result = journey_mapper_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling during generation"""
    session_obj = journey_mapper_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "progressStep": session_obj.progress_step,
        "progressMessage": session_obj.progress_message,
        "errorMessage": session_obj.error_message,
        "dataQualityWarning": session_obj.data_quality_warning
    }


@router.get("/sessions")
def list_sessions(
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
    db_session: Session = Depends(get_session)
) -> Any:
    """List all journey map sessions"""
    sessions = journey_mapper_service.list_sessions(db_session, user_id=user_id, skip=skip, limit=limit)
    return sessions


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a journey map session and all related data"""
    success = journey_mapper_service.delete_session(db_session, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


@router.post("/sessions/{session_id}/retry")
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Retry a failed journey generation"""
    session_obj = journey_mapper_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reset status
    session_obj.status = "pending"
    session_obj.error_message = None
    session_obj.progress_step = 0
    session_obj.progress_message = "Retrying generation..."
    db_session.add(session_obj)
    db_session.commit()

    # Trigger background generation
    background_tasks.add_task(
        journey_mapper_service.run_journey_generation_pipeline,
        db_session,
        session_id
    )

    return session_obj


# --- Pain Point Management ---

@router.patch("/pain-points/{pain_point_id}")
def update_pain_point(
    pain_point_id: int,
    request: UpdatePainPointRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Update a pain point (user edits)"""
    updates = {}
    if request.description is not None:
        updates["description"] = request.description
    if request.severity is not None:
        updates["severity"] = request.severity
    if request.stage_id is not None:
        updates["stage_id"] = request.stage_id

    pain_point = journey_mapper_service.update_pain_point(db_session, pain_point_id, updates)
    if not pain_point:
        raise HTTPException(status_code=404, detail="Pain point not found")
    return pain_point


@router.post("/sessions/{session_id}/pain-points")
def add_pain_point(
    session_id: int,
    request: AddPainPointRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Manually add a pain point to a journey"""
    try:
        pain_point = journey_mapper_service.add_pain_point(
            db=db_session,
            journey_map_id=session_id,
            stage_id=request.stage_id,
            description=request.description,
            severity=request.severity,
            persona_id=request.persona_id
        )
        return pain_point
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/pain-points/{pain_point_id}")
def delete_pain_point(
    pain_point_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a pain point"""
    success = journey_mapper_service.delete_pain_point(db_session, pain_point_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pain point not found")
    return {"success": True}


# --- Stage Management ---

@router.patch("/sessions/{session_id}/stages/{stage_id}")
def update_stage(
    session_id: int,
    stage_id: str,
    request: UpdateStageRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Update a stage in the journey map"""
    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.description is not None:
        updates["description"] = request.description
    if request.duration_estimate is not None:
        updates["duration_estimate"] = request.duration_estimate

    session_obj = journey_mapper_service.update_stage(db_session, session_id, stage_id, updates)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session or stage not found")
    return session_obj


@router.post("/sessions/{session_id}/stages")
def add_stage(
    session_id: int,
    request: AddStageRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Add a new stage to the journey map"""
    session_obj = journey_mapper_service.add_stage(
        db=db_session,
        session_id=session_id,
        name=request.name,
        description=request.description,
        insert_after_stage_id=request.insert_after_stage_id
    )
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_obj


@router.delete("/sessions/{session_id}/stages/{stage_id}")
def delete_stage(
    session_id: int,
    stage_id: str,
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a stage from the journey map"""
    session_obj = journey_mapper_service.delete_stage(db_session, session_id, stage_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session or stage not found")
    return session_obj


# --- Competitive Journey Walkthrough ---

@router.post("/sessions/{session_id}/observations")
def add_competitor_observation(
    session_id: int,
    request: AddCompetitorObservationRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Add an observation during competitive journey walkthrough"""
    session_obj = journey_mapper_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_obj.mode != "competitive":
        raise HTTPException(status_code=400, detail="Session is not in competitive mode")

    observation = journey_mapper_service.add_competitor_observation(
        db=db_session,
        journey_map_id=session_id,
        stage_order=request.stage_order,
        stage_name=request.stage_name,
        touchpoints_observed=request.touchpoints_observed,
        time_taken=request.time_taken,
        friction_points=request.friction_points,
        strengths_observed=request.strengths_observed,
        notes=request.notes,
        screenshot_url=request.screenshot_url
    )
    return observation


@router.post("/sessions/{session_id}/generate-from-observations")
def generate_from_observations(
    session_id: int,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Generate competitive journey map from user observations"""
    session_obj = journey_mapper_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_obj.mode != "competitive":
        raise HTTPException(status_code=400, detail="Session is not in competitive mode")

    # Trigger background generation
    background_tasks.add_task(
        journey_mapper_service.run_journey_generation_pipeline,
        db_session,
        session_id
    )

    return {"success": True, "message": "Generation started from observations"}


# --- Version Control ---

@router.post("/sessions/{session_id}/new-version")
async def create_new_version(
    session_id: int,
    background_tasks: BackgroundTasks,
    updateType: str = Form(default="refresh"),
    knowledgeBaseIds: str = Form(default="[]"),
    files: List[UploadFile] = File(default=[]),
    db_session: Session = Depends(get_session)
) -> Any:
    """Create a new version of a journey map with updated data"""
    try:
        kb_ids = json.loads(knowledgeBaseIds) if knowledgeBaseIds else []

        # Process new files
        file_metadata = []
        for file in files:
            content_preview = await read_file_content(file)
            file_metadata.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "size": file.size,
                "content_preview": content_preview
            })

        # Create new version
        new_session = journey_mapper_service.create_new_version(
            db=db_session,
            parent_session_id=session_id,
            new_file_metadata=file_metadata if file_metadata else None,
            new_knowledge_base_ids=kb_ids if kb_ids else None,
            update_type=updateType
        )

        # Trigger background generation with delta analysis
        background_tasks.add_task(
            journey_mapper_service.run_version_update_pipeline,
            db_session,
            new_session.id
        )

        return new_session

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in request: {str(e)}")


@router.get("/sessions/{session_id}/compare/{compare_id}")
def compare_versions(
    session_id: int,
    compare_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Compare two journey map versions"""
    try:
        result = journey_mapper_service.compare_versions(db_session, session_id, compare_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- Export (placeholder for future implementation) ---

@router.get("/sessions/{session_id}/export")
def export_journey(
    session_id: int,
    format: str = "json",  # json, pdf, png
    db_session: Session = Depends(get_session)
) -> Any:
    """Export journey map (currently JSON only, PDF/PNG in future)"""
    result = journey_mapper_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    if format == "json":
        return result
    elif format in ["pdf", "png"]:
        # Placeholder - would integrate with PDF generation library
        raise HTTPException(status_code=501, detail=f"Export to {format} not yet implemented")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}")
