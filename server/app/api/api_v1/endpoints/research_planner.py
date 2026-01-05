"""
Research Planner API Endpoints

REST API for AI-powered research planning workflow.
"""
from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.db import get_session
from app.models.research_planner import (
    ResearchPlanSession,
    RecommendedMethod,
    InterviewGuide,
    Survey,
    RecruitingPlan
)
from app.services.research_planner_service import research_planner_service

router = APIRouter()


# --- Request/Response Models ---

class ConstraintsModel(BaseModel):
    model_config = {"populate_by_name": True}

    budget: Optional[str] = None  # limited, moderate, flexible
    timeline: Optional[str] = None  # urgent, normal, flexible
    user_access: Optional[bool] = Field(default=None, alias="userAccess")
    remote_only: Optional[bool] = Field(default=None, alias="remoteOnly")


class CreateSessionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    objective: str = Field(min_length=10)
    research_context: Optional[str] = Field(default="b2b", alias="researchContext")  # "b2b" or "b2c"
    constraints: Optional[ConstraintsModel] = None
    user_id: Optional[int] = Field(default=None, alias="userId")

    # Optional context sources
    knowledge_base_ids: Optional[List[int]] = Field(default=None, alias="knowledgeBaseIds")
    ideation_session_id: Optional[int] = Field(default=None, alias="ideationSessionId")
    feasibility_session_id: Optional[int] = Field(default=None, alias="feasibilitySessionId")
    business_case_session_id: Optional[int] = Field(default=None, alias="businessCaseSessionId")


class SelectMethodsRequest(BaseModel):
    model_config = {"populate_by_name": True}

    method_names: List[str] = Field(alias="methodNames")


class InterviewGuideConfigRequest(BaseModel):
    model_config = {"populate_by_name": True}

    participant_type: str = Field(alias="participantType")
    duration_minutes: int = Field(default=45, alias="durationMinutes")
    focus_areas: Optional[List[str]] = Field(default=None, alias="focusAreas")


class SurveyConfigRequest(BaseModel):
    model_config = {"populate_by_name": True}

    target_audience: str = Field(alias="targetAudience")
    survey_length: str = Field(default="medium", alias="surveyLength")  # short, medium, long
    question_types: Optional[List[str]] = Field(default=None, alias="questionTypes")


class ParticipantCriteriaModel(BaseModel):
    model_config = {"populate_by_name": True}

    role: Optional[str] = None
    company_size: Optional[str] = Field(default=None, alias="companySize")
    experience: Optional[str] = None
    other: Optional[Dict[str, Any]] = None


class RecruitingConfigRequest(BaseModel):
    model_config = {"populate_by_name": True}

    participant_criteria: Optional[ParticipantCriteriaModel] = Field(default=None, alias="participantCriteria")
    participant_count: int = Field(default=12, alias="participantCount")
    segmentation: Optional[Dict[str, Any]] = None


class GenerateInstrumentsRequest(BaseModel):
    model_config = {"populate_by_name": True}

    interview_guide_config: Optional[InterviewGuideConfigRequest] = Field(default=None, alias="interviewGuideConfig")
    survey_config: Optional[SurveyConfigRequest] = Field(default=None, alias="surveyConfig")
    recruiting_config: Optional[RecruitingConfigRequest] = Field(default=None, alias="recruitingConfig")


class UpdateInterviewGuideRequest(BaseModel):
    model_config = {"populate_by_name": True}

    content_markdown: str = Field(alias="contentMarkdown")


class UpdateSurveyRequest(BaseModel):
    model_config = {"populate_by_name": True}

    questions: List[Dict[str, Any]]


# --- Endpoints ---

@router.get("/context-sources")
def get_available_context_sources(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get available context sources for research planning (KBs, ideation, feasibility, business case sessions)"""
    from sqlmodel import select, desc
    from app.models.knowledge_base import KnowledgeBase
    from app.models.ideation import IdeationSession
    from app.models.feasibility import FeasibilitySession
    from app.models.business_case import BusinessCaseSession

    # Get ready knowledge bases
    kb_query = select(KnowledgeBase).where(KnowledgeBase.status == "ready")
    kb_query = kb_query.where(KnowledgeBase.userId == current_user.id)
    kb_query = kb_query.order_by(desc(KnowledgeBase.updatedAt)).limit(20)
    knowledge_bases = list(db_session.exec(kb_query).all())

    # Get completed ideation sessions
    ideation_query = select(IdeationSession).where(IdeationSession.status == "completed")
    ideation_query = ideation_query.where(IdeationSession.user_id == current_user.id)
    ideation_query = ideation_query.order_by(desc(IdeationSession.created_at)).limit(20)
    ideation_sessions = list(db_session.exec(ideation_query).all())

    # Get completed feasibility sessions
    feasibility_query = select(FeasibilitySession).where(FeasibilitySession.status == "completed")
    feasibility_query = feasibility_query.where(FeasibilitySession.user_id == current_user.id)
    feasibility_query = feasibility_query.order_by(desc(FeasibilitySession.created_at)).limit(20)
    feasibility_sessions = list(db_session.exec(feasibility_query).all())

    # Get completed business case sessions
    business_case_query = select(BusinessCaseSession).where(BusinessCaseSession.status == "completed")
    business_case_query = business_case_query.where(BusinessCaseSession.user_id == current_user.id)
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
                "featureDescription": s.feature_description[:100] + "..." if s.feature_description and len(s.feature_description) > 100 else s.feature_description,
                "goDecision": s.go_no_go_recommendation,
                "createdAt": s.created_at.isoformat() if s.created_at else None
            }
            for s in feasibility_sessions
        ],
        "businessCaseSessions": [
            {
                "id": s.id,
                "featureName": s.feature_name,
                "recommendation": s.recommendation,
                "createdAt": s.created_at.isoformat() if s.created_at else None
            }
            for s in business_case_sessions
        ]
    }


@router.post("/sessions", response_model=ResearchPlanSession)
def create_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Create research planning session and start method recommendation"""
    try:
        constraints_dict = None
        if request.constraints:
            constraints_dict = {
                "budget": request.constraints.budget,
                "timeline": request.constraints.timeline,
                "user_access": request.constraints.user_access,
                "remote_only": request.constraints.remote_only
            }

        session_obj = research_planner_service.create_session(
            db=db_session,
            objective=request.objective,
            research_context=request.research_context or "b2b",
            constraints=constraints_dict,
            user_id=current_user.id,
            knowledge_base_ids=request.knowledge_base_ids,
            ideation_session_id=request.ideation_session_id,
            feasibility_session_id=request.feasibility_session_id,
            business_case_session_id=request.business_case_session_id
        )

        # Trigger background method recommendation
        background_tasks.add_task(
            research_planner_service.run_method_recommendation_pipeline,
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
    """Get session with all methods, guides, surveys, recruiting plans"""
    result = research_planner_service.get_session_detail(db_session, session_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling"""
    session_obj = research_planner_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "progressStep": session_obj.progress_step,
        "progressMessage": session_obj.progress_message,
        "errorMessage": session_obj.error_message
    }


@router.get("/sessions", response_model=List[ResearchPlanSession])
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """List all sessions, optionally filtered by user"""
    return research_planner_service.list_sessions(db_session, user_id=current_user.id, skip=skip, limit=limit)


@router.post("/sessions/{session_id}/select-methods", response_model=ResearchPlanSession)
def select_methods(
    session_id: int,
    request: SelectMethodsRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Select which methods to proceed with"""
    try:
        session_obj = research_planner_service.select_methods(
            db=db_session,
            session_id=session_id,
            method_names=request.method_names,
            user_id=current_user.id
        )
        return session_obj
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sessions/{session_id}/generate-instruments")
def generate_instruments(
    session_id: int,
    request: GenerateInstrumentsRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Generate research instruments for selected methods"""
    session_obj = research_planner_service.get_session(db_session, session_id, user_id=current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build config dicts
    interview_config = None
    if request.interview_guide_config:
        interview_config = {
            "participant_type": request.interview_guide_config.participant_type,
            "duration_minutes": request.interview_guide_config.duration_minutes,
            "focus_areas": request.interview_guide_config.focus_areas or []
        }

    survey_config = None
    if request.survey_config:
        survey_config = {
            "target_audience": request.survey_config.target_audience,
            "survey_length": request.survey_config.survey_length,
            "question_types": request.survey_config.question_types or ["multiple_choice", "rating", "open_ended"]
        }

    recruiting_config = None
    if request.recruiting_config:
        criteria = {}
        if request.recruiting_config.participant_criteria:
            criteria = {
                "role": request.recruiting_config.participant_criteria.role,
                "company_size": request.recruiting_config.participant_criteria.company_size,
                "experience": request.recruiting_config.participant_criteria.experience,
                "other": request.recruiting_config.participant_criteria.other
            }
        recruiting_config = {
            "participant_criteria": criteria,
            "participant_count": request.recruiting_config.participant_count,
            "segmentation": request.recruiting_config.segmentation
        }

    # Trigger background instrument generation
    background_tasks.add_task(
        research_planner_service.run_instrument_generation_pipeline,
        db_session,
        session_id,
        interview_config,
        survey_config,
        recruiting_config
    )

    return {"success": True, "message": "Instrument generation started"}


@router.post("/sessions/{session_id}/retry", response_model=ResearchPlanSession)
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Retry a failed session"""
    try:
        session_obj = research_planner_service.retry_session(db_session, session_id, user_id=current_user.id)

        # Trigger background processing
        background_tasks.add_task(
            research_planner_service.run_method_recommendation_pipeline,
            db_session,
            session_obj.id
        )

        return session_obj
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/interview-guides/{guide_id}", response_model=InterviewGuide)
def update_interview_guide(
    guide_id: int,
    request: UpdateInterviewGuideRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Update interview guide content (user edits)"""
    guide = research_planner_service.update_interview_guide(
        db=db_session,
        guide_id=guide_id,
        content_markdown=request.content_markdown
    )
    if not guide:
        raise HTTPException(status_code=404, detail="Interview guide not found")
    return guide


@router.patch("/surveys/{survey_id}", response_model=Survey)
def update_survey(
    survey_id: int,
    request: UpdateSurveyRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Update survey questions (user edits)"""
    survey = research_planner_service.update_survey(
        db=db_session,
        survey_id=survey_id,
        questions=request.questions
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return survey


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a session and all related data"""
    success = research_planner_service.delete_session(db_session, session_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}
