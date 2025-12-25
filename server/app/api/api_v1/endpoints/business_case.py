"""
Business Case Builder API Endpoints

REST API for business case analysis workflow.
"""
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.core.db import get_session
from app.models.business_case import (
    BusinessCaseSession,
    CostItem,
    BenefitItem,
    RateAssumption
)
from app.services.business_case_service import business_case_service

router = APIRouter()


# --- Request/Response Models ---

class CreateSessionRequest(BaseModel):
    """
    Request to create a business case session.

    If feasibilitySessionId is provided, featureName and featureDescription are optional
    and will be derived from the feasibility session.

    If no feasibilitySessionId, featureName and featureDescription are required.
    """
    model_config = {"populate_by_name": True}

    # Optional when feasibility session is linked
    feature_name: Optional[str] = Field(default=None, alias="featureName", max_length=200)
    feature_description: Optional[str] = Field(default=None, alias="featureDescription")

    # Business context
    business_context: Optional[str] = Field(default=None, alias="businessContext")
    target_market: Optional[str] = Field(default=None, alias="targetMarket")

    # Link to existing feasibility analysis
    feasibility_session_id: Optional[int] = Field(default=None, alias="feasibilitySessionId")
    user_id: Optional[int] = Field(default=None, alias="userId")


class UpdateCostRequest(BaseModel):
    model_config = {"populate_by_name": True}

    optimistic_amount: Optional[float] = Field(default=None, alias="optimisticAmount")
    realistic_amount: Optional[float] = Field(default=None, alias="realisticAmount")
    pessimistic_amount: Optional[float] = Field(default=None, alias="pessimisticAmount")


class UpdateBenefitRequest(BaseModel):
    model_config = {"populate_by_name": True}

    optimistic_amount: Optional[float] = Field(default=None, alias="optimisticAmount")
    realistic_amount: Optional[float] = Field(default=None, alias="realisticAmount")
    pessimistic_amount: Optional[float] = Field(default=None, alias="pessimisticAmount")


class SaveLearningRequest(BaseModel):
    model_config = {"populate_by_name": True}

    learning_type: str = Field(alias="learningType")
    category: str
    original_value: float = Field(alias="originalValue")
    corrected_value: float = Field(alias="correctedValue")
    context: str
    user_id: Optional[int] = Field(default=None, alias="userId")


class UpdateRateRequest(BaseModel):
    model_config = {"populate_by_name": True}

    rate_value: float = Field(alias="rateValue")


# --- Endpoints ---

@router.post("/sessions", response_model=BusinessCaseSession)
def create_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Create business case session and start async processing"""
    try:
        session_obj = business_case_service.create_session(
            db=db_session,
            feature_name=request.feature_name,
            feature_description=request.feature_description,
            business_context=request.business_context,
            target_market=request.target_market,
            feasibility_session_id=request.feasibility_session_id,
            user_id=request.user_id
        )

        # Trigger background processing
        background_tasks.add_task(
            business_case_service.run_business_case_pipeline,
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
    """Get session with all costs, benefits, scenarios, assumptions, sensitivity"""
    result = business_case_service.get_session_detail(db_session, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Get session status for polling"""
    session_obj = business_case_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "progressStep": session_obj.progress_step,
        "progressMessage": session_obj.progress_message,
        "errorMessage": session_obj.error_message
    }


@router.get("/sessions", response_model=List[BusinessCaseSession])
def list_sessions(
    user_id: Optional[int] = None,
    db_session: Session = Depends(get_session)
) -> Any:
    """List all sessions, optionally filtered by user"""
    return business_case_service.list_sessions(db_session, user_id=user_id)


@router.patch("/costs/{cost_id}", response_model=CostItem)
def update_cost(
    cost_id: int,
    request: UpdateCostRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Update cost item with user override"""
    cost = business_case_service.update_cost_item(
        db=db_session,
        cost_id=cost_id,
        optimistic_amount=request.optimistic_amount,
        realistic_amount=request.realistic_amount,
        pessimistic_amount=request.pessimistic_amount
    )
    if not cost:
        raise HTTPException(status_code=404, detail="Cost item not found")
    return cost


@router.patch("/benefits/{benefit_id}", response_model=BenefitItem)
def update_benefit(
    benefit_id: int,
    request: UpdateBenefitRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Update benefit item with user override"""
    benefit = business_case_service.update_benefit_item(
        db=db_session,
        benefit_id=benefit_id,
        optimistic_amount=request.optimistic_amount,
        realistic_amount=request.realistic_amount,
        pessimistic_amount=request.pessimistic_amount
    )
    if not benefit:
        raise HTTPException(status_code=404, detail="Benefit item not found")
    return benefit


@router.patch("/rates/{rate_id}", response_model=RateAssumption)
def update_rate(
    rate_id: int,
    request: UpdateRateRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Update a rate assumption with user override"""
    rate = business_case_service.update_rate_assumption(
        db=db_session,
        rate_id=rate_id,
        rate_value=request.rate_value
    )
    if not rate:
        raise HTTPException(status_code=404, detail="Rate assumption not found")
    return rate


@router.post("/sessions/{session_id}/learning")
def save_learning(
    session_id: int,
    request: SaveLearningRequest,
    db_session: Session = Depends(get_session)
) -> Any:
    """Save user correction for future learning"""
    session_obj = business_case_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    learning = business_case_service.save_user_learning(
        db=db_session,
        session_id=session_id,
        learning_type=request.learning_type,
        category=request.category,
        original_value=request.original_value,
        corrected_value=request.corrected_value,
        context=request.context,
        user_id=request.user_id
    )

    return {"success": True, "learningId": learning.id}


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db_session: Session = Depends(get_session)
) -> Any:
    """Delete a session and all related data"""
    success = business_case_service.delete_session(db_session, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


@router.post("/sessions/{session_id}/recalculate")
def recalculate_financials(
    session_id: int,
    background_tasks: BackgroundTasks,
    db_session: Session = Depends(get_session)
) -> Any:
    """Recalculate financials after user overrides"""
    session_obj = business_case_service.get_session(db_session, session_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update status
    session_obj.status = "analyzing"
    session_obj.progress_step = 5
    session_obj.progress_message = "Recalculating financial metrics..."
    db_session.add(session_obj)
    db_session.commit()

    # Recalculate in background
    def recalculate():
        business_case_service._calculate_financials(db_session, session_id)
        business_case_service._generate_executive_summary(db_session, session_id)
        session = business_case_service.get_session(db_session, session_id)
        session.status = "completed"
        session.progress_message = "Recalculation complete!"
        db_session.add(session)
        db_session.commit()

    background_tasks.add_task(recalculate)

    return {"success": True, "message": "Recalculation started"}
