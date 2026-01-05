"""
Scenario Modeler API Endpoints

REST API for the Scenario Modeler feature that enables "what-if"
analysis by generating and comparing roadmap scenario variations.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.db import get_session
from app.services.scenario_modeler_service import ScenarioModelerService
from app.models.scenario_modeler import (
    ScenarioSession,
    ScenarioVariant,
    ScenarioSessionCreate,
    ScenarioVariantCreate,
    ScenarioVariantUpdate,
    ScenarioSessionResponse,
    ScenarioComparisonReport,
    SCENARIO_TEMPLATES,
)

router = APIRouter()


def get_service(db: Session = Depends(get_session)) -> ScenarioModelerService:
    return ScenarioModelerService(db)


# ============================================================================
# Sessions
# ============================================================================

@router.post("/sessions")
def create_session(
    data: ScenarioSessionCreate,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Create a new scenario modeling session from an existing roadmap"""
    try:
        session = service.create_session(data, user_id=current_user.id)
        # Return as dict to avoid serialization issues
        return {
            "id": session.id,
            "userId": session.user_id,
            "roadmapSessionId": session.roadmap_session_id,
            "name": session.name,
            "description": session.description,
            "status": session.status,
            "progressStep": session.progress_step,
            "progressTotal": session.progress_total,
            "progressMessage": session.progress_message,
            "errorMessage": session.error_message,
            "totalVariants": session.total_variants,
            "viableVariants": session.viable_variants,
            "createdAt": session.created_at.isoformat() if session.created_at else None,
            "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
            "completedAt": session.completed_at.isoformat() if session.completed_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sessions", response_model=List[ScenarioSession])
def list_sessions(
    roadmap_session_id: int = None,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """List all scenario sessions, optionally filtered by roadmap"""
    if roadmap_session_id:
        return service.get_sessions_for_roadmap(roadmap_session_id)
    return service.get_sessions(user_id=current_user.id)


def _variant_to_camel(variant: ScenarioVariant) -> Dict[str, Any]:
    """Convert variant to camelCase dict including nested JSON fields"""
    from humps import camelize
    return {
        "id": variant.id,
        "sessionId": variant.session_id,
        "name": variant.name,
        "description": variant.description,
        "isBaseline": variant.is_baseline,
        "variableChanges": camelize(variant.variable_changes) if variant.variable_changes else [],
        "generatedRoadmap": camelize(variant.generated_roadmap) if variant.generated_roadmap else {},
        "impactSummary": camelize(variant.impact_summary) if variant.impact_summary else {},
        "riskScore": variant.risk_score,
        "riskFactors": camelize(variant.risk_factors) if variant.risk_factors else [],
        "tradeOffs": camelize(variant.trade_offs) if variant.trade_offs else [],
        "isViable": variant.is_viable,
        "nonViableReason": variant.non_viable_reason,
        "status": variant.status,
        "createdAt": variant.created_at.isoformat() if variant.created_at else None,
        "updatedAt": variant.updated_at.isoformat() if variant.updated_at else None,
    }


@router.get("/sessions/{session_id}")
def get_session_by_id(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Get a session with all variants and comparison"""
    from humps import camelize
    result = service.get_full_session(session_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    session = result.session
    variants_camel = [_variant_to_camel(v) for v in result.variants]

    comparison_camel = None
    if result.comparison:
        comparison_camel = camelize(result.comparison.model_dump() if hasattr(result.comparison, 'model_dump') else result.comparison.__dict__)

    return {
        "session": {
            "id": session.id,
            "userId": session.user_id,
            "roadmapSessionId": session.roadmap_session_id,
            "name": session.name,
            "description": session.description,
            "baselineSnapshot": camelize(session.baseline_snapshot) if session.baseline_snapshot else {},
            "status": session.status,
            "progressStep": session.progress_step,
            "progressTotal": session.progress_total,
            "progressMessage": session.progress_message,
            "errorMessage": session.error_message,
            "totalVariants": session.total_variants,
            "viableVariants": session.viable_variants,
            "createdAt": session.created_at.isoformat() if session.created_at else None,
            "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
            "completedAt": session.completed_at.isoformat() if session.completed_at else None,
        },
        "variants": variants_camel,
        "comparison": comparison_camel
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Delete a session and all its variants"""
    if not service.delete_session(session_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Get session processing status (for polling)"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "status": session.status,
        "progressStep": session.progress_step,
        "progressTotal": session.progress_total,
        "progressMessage": session.progress_message,
        "errorMessage": session.error_message,
    }


# ============================================================================
# Pipeline
# ============================================================================

async def run_pipeline_task(session_id: int, db: Session):
    """Background task to run the scenario generation pipeline"""
    service = ScenarioModelerService(db)
    await service.run_pipeline(session_id)


@router.post("/sessions/{session_id}/generate")
async def generate_scenarios(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Start the scenario generation pipeline"""
    service = ScenarioModelerService(db)
    session = service.get_session(session_id, user_id=current_user.id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status in ["generating", "comparing"]:
        raise HTTPException(status_code=400, detail="Pipeline already running")

    # Run pipeline in background
    background_tasks.add_task(run_pipeline_task, session_id, db)

    return {"status": "started", "message": "Scenario generation started in background"}


# ============================================================================
# Variants
# ============================================================================

@router.get("/sessions/{session_id}/variants", response_model=List[ScenarioVariant])
def get_variants(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Get all variants for a session"""
    return service.get_variants(session_id)


@router.get("/sessions/{session_id}/variants/{variant_id}", response_model=ScenarioVariant)
def get_variant(
    session_id: int,
    variant_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Get a specific variant"""
    variant = service.get_variant(variant_id)
    if not variant or variant.session_id != session_id:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant


@router.post("/sessions/{session_id}/variants", response_model=ScenarioVariant)
def create_variant(
    session_id: int,
    data: ScenarioVariantCreate,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Create a new scenario variant"""
    try:
        return service.create_variant(session_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sessions/{session_id}/variants/from-template", response_model=ScenarioVariant)
def create_variant_from_template(
    session_id: int,
    template_name: str,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Create a variant from a predefined template"""
    try:
        return service.create_variant_from_template(session_id, template_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/sessions/{session_id}/variants/{variant_id}", response_model=ScenarioVariant)
def update_variant(
    session_id: int,
    variant_id: int,
    data: ScenarioVariantUpdate,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Update a scenario variant"""
    try:
        variant = service.update_variant(variant_id, data)
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found")
        return variant
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/sessions/{session_id}/variants/{variant_id}")
def delete_variant(
    session_id: int,
    variant_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Delete a variant"""
    try:
        if not service.delete_variant(variant_id):
            raise HTTPException(status_code=404, detail="Variant not found")
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/variants/{variant_id}/promote")
async def promote_variant(
    session_id: int,
    variant_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Promote a variant to become the new baseline roadmap"""
    try:
        success = await service.promote_variant(variant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Variant not found")
        return {"status": "promoted", "message": "Variant promoted to baseline"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Comparison
# ============================================================================

@router.get("/sessions/{session_id}/comparison", response_model=ScenarioComparisonReport)
def get_comparison(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Get comparison report for all completed variants"""
    result = service.get_full_session(session_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    if not result.comparison:
        raise HTTPException(status_code=400, detail="Not enough completed variants to compare")

    return result.comparison


# ============================================================================
# Templates
# ============================================================================

@router.get("/templates", response_model=List[Dict[str, Any]])
def get_templates(
    current_user: User = Depends(get_current_user),
    service: ScenarioModelerService = Depends(get_service),
):
    """Get available scenario templates"""
    return service.get_scenario_templates()
