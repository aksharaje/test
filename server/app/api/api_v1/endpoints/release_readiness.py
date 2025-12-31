"""
Release Readiness Checker API Endpoints

Provides endpoints for release assessment with adaptive scoring.
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.db import get_session as get_db_session
from app.models.release_readiness import (
    CreateReadinessSessionRequest,
    ReadinessSessionResponse,
    ReadinessAssessment,
    DefectStatusReport,
    WorkCompletionReport,
    AssessmentStatusResponse,
)
from app.services.release_readiness_service import get_release_readiness_service

router = APIRouter()


# =============================================================================
# INTEGRATION CHECK
# =============================================================================


@router.get("/integrations/check")
async def check_integrations(
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Check if user has valid Jira or ADO integrations.
    """
    service = get_release_readiness_service(session)
    return service.check_integrations()


# =============================================================================
# SESSION CRUD
# =============================================================================


@router.post("/sessions", response_model=ReadinessSessionResponse)
async def create_session(
    data: CreateReadinessSessionRequest,
    session: Session = Depends(get_db_session),
) -> ReadinessSessionResponse:
    """
    Create a new release readiness session.
    """
    service = get_release_readiness_service(session)
    try:
        readiness_session = service.create_session(data)
        return service.get_session_response(readiness_session.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions", response_model=List[ReadinessSessionResponse])
async def list_sessions(
    session: Session = Depends(get_db_session),
) -> List[ReadinessSessionResponse]:
    """
    List all release readiness sessions.
    """
    service = get_release_readiness_service(session)
    return service.list_sessions()


@router.get("/sessions/{session_id}", response_model=ReadinessSessionResponse)
async def get_session(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> ReadinessSessionResponse:
    """
    Get a specific release readiness session.
    """
    service = get_release_readiness_service(session)
    result = service.get_session_response(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Delete a release readiness session.
    """
    service = get_release_readiness_service(session)
    if not service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


# =============================================================================
# ASSESSMENT
# =============================================================================


@router.post("/sessions/{session_id}/assess", response_model=AssessmentStatusResponse)
async def assess_release(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> AssessmentStatusResponse:
    """
    Run release readiness assessment.

    Fetches release items, calculates component scores, and generates
    a Go/No-Go recommendation.
    """
    service = get_release_readiness_service(session)
    try:
        return await service.assess_release(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assessment failed: {str(e)}")


@router.get("/sessions/{session_id}/status", response_model=AssessmentStatusResponse)
async def get_assessment_status(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> AssessmentStatusResponse:
    """
    Get the current status of release assessment.
    """
    service = get_release_readiness_service(session)
    readiness_session = service.get_session(session_id)
    if not readiness_session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service._get_assessment_status(readiness_session)


# =============================================================================
# REPORTS
# =============================================================================


@router.get("/sessions/{session_id}/defects", response_model=DefectStatusReport)
async def get_defect_status(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> DefectStatusReport:
    """
    Get defect status report for the release.
    """
    service = get_release_readiness_service(session)
    result = service.get_defect_status_report(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/completion", response_model=WorkCompletionReport)
async def get_work_completion(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> WorkCompletionReport:
    """
    Get work completion report for the release.
    """
    service = get_release_readiness_service(session)
    result = service.get_work_completion_report(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/assessment")
async def get_full_assessment(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Get the full assessment result including all component scores.
    """
    service = get_release_readiness_service(session)
    readiness_session = service.get_session(session_id)
    if not readiness_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if readiness_session.status != "ready":
        raise HTTPException(status_code=400, detail="Assessment not complete")

    return {
        "session_id": session_id,
        "readiness_score": readiness_session.readiness_score,
        "max_possible_score": readiness_session.max_possible_score,
        "confidence_level": readiness_session.confidence_level,
        "recommendation": readiness_session.recommendation,
        "recommendation_details": readiness_session.recommendation_details,
        "component_scores": readiness_session.component_scores,
        "last_assessment_at": readiness_session.last_assessment_at,
    }
