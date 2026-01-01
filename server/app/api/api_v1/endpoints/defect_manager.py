"""
Defect Manager API Endpoints

Provides endpoints for defect triage, analysis, and prevention recommendations.
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.db import get_session as get_db_session
from app.models.defect_manager import (
    CreateDefectSessionRequest,
    DefectSessionResponse,
    TriageResult,
    PatternAnalysis,
    PreventionRecommendation,
    AnalysisStatusResponse,
)
from app.models.release_readiness import ProjectOption
from app.services.defect_manager_service import get_defect_manager_service

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
    service = get_defect_manager_service(session)
    return service.check_integrations()


@router.get("/integrations/{integration_id}/projects", response_model=List[ProjectOption])
async def get_projects(
    integration_id: int,
    session: Session = Depends(get_db_session),
) -> List[ProjectOption]:
    """
    Get available projects from an integration.
    """
    service = get_defect_manager_service(session)
    try:
        return await service.get_projects(integration_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# SESSION CRUD
# =============================================================================


@router.post("/sessions", response_model=DefectSessionResponse)
async def create_session(
    data: CreateDefectSessionRequest,
    session: Session = Depends(get_db_session),
) -> DefectSessionResponse:
    """
    Create a new defect analysis session.
    """
    service = get_defect_manager_service(session)
    try:
        defect_session = service.create_session(data)
        return service.get_session_response(defect_session.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions", response_model=List[DefectSessionResponse])
async def list_sessions(
    session: Session = Depends(get_db_session),
) -> List[DefectSessionResponse]:
    """
    List all defect analysis sessions.
    """
    service = get_defect_manager_service(session)
    return service.list_sessions()


@router.get("/sessions/{session_id}", response_model=DefectSessionResponse)
async def get_session(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> DefectSessionResponse:
    """
    Get a specific defect analysis session.
    """
    service = get_defect_manager_service(session)
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
    Delete a defect analysis session.
    """
    service = get_defect_manager_service(session)
    if not service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


# =============================================================================
# ANALYSIS
# =============================================================================


@router.post("/sessions/{session_id}/analyze", response_model=AnalysisStatusResponse)
async def analyze_defects(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> AnalysisStatusResponse:
    """
    Run defect analysis for a session.

    Fetches defects from integration, normalizes data, detects duplicates,
    and analyzes patterns.
    """
    service = get_defect_manager_service(session)
    try:
        return await service.analyze_defects(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/sessions/{session_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> AnalysisStatusResponse:
    """
    Get the current status of defect analysis.
    """
    service = get_defect_manager_service(session)
    defect_session = service.get_session(session_id)
    if not defect_session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service._get_analysis_status(defect_session)


# =============================================================================
# RESULTS
# =============================================================================


@router.get("/sessions/{session_id}/triage", response_model=TriageResult)
async def get_triage_result(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> TriageResult:
    """
    Get triage results for a session.

    Returns defects with normalized severity, duplicates identified,
    and priority recommendations.
    """
    service = get_defect_manager_service(session)
    result = service.get_triage_result(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found or analysis not complete")
    return result


@router.get("/sessions/{session_id}/patterns", response_model=PatternAnalysis)
async def get_pattern_analysis(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> PatternAnalysis:
    """
    Get pattern analysis for a session.

    Returns grouped patterns, trends, and hot spots.
    """
    service = get_defect_manager_service(session)
    defect_session = service.get_session(session_id)
    if not defect_session or defect_session.status != "ready":
        raise HTTPException(status_code=404, detail="Session not found or analysis not complete")

    return service._analyze_patterns(defect_session)


@router.get("/sessions/{session_id}/recommendations", response_model=List[PreventionRecommendation])
async def get_prevention_recommendations(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> List[PreventionRecommendation]:
    """
    Get prevention recommendations based on defect analysis.

    Returns process improvements, testing focus areas, and high-risk components.
    """
    service = get_defect_manager_service(session)
    return service.get_prevention_recommendations(session_id)
