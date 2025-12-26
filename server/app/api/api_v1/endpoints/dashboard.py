from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func, col
from datetime import datetime, timedelta

from app.core import db as deps
from app.models.user import User
from app.models.prd import GeneratedPrd
from app.models.feasibility import FeasibilitySession
from app.models.ideation import IdeationSession

router = APIRouter()

@router.get("/stats", response_model=Dict[str, Any])
def get_dashboard_stats(
    timeframe: str = Query("30d", enum=["30d", "all"]),
    user_id: int = Query(1), # Default to user 1 for prototype
    db: Session = Depends(deps.get_session),
) -> Any:
    """
    Get aggregated dashboard statistics for the current user.
    """
    
    # Calculate start date based on timeframe
    start_date = None
    if timeframe == "30d":
        start_date = datetime.utcnow() - timedelta(days=30)
    
    # 1. Count Artifacts
    # Helper to build query with optional date filter
    def count_query(model):
        query = select(func.count()).where(model.user_id == user_id)
        if start_date:
            query = query.where(model.created_at >= start_date)
        return db.exec(query).one()

    prd_count = count_query(GeneratedPrd)
    feasibility_count = count_query(FeasibilitySession)
    ideation_count = count_query(IdeationSession)
    
    total_artifacts = prd_count + feasibility_count + ideation_count

    # 2. ROI Calculations
    
    # Hours Reclaimed
    # Constants: PRD=4h, Feasibility=2h, Ideation=0.5h
    hours_reclaimed = (prd_count * 4.0) + (feasibility_count * 2.0) + (ideation_count * 0.5)
    
    # Velocity Multiplier
    # Baseline: 2 artifacts per sprint (2 weeks).
    # If timeframe is 30d (~4.3 weeks), baseline is ~4.3 artifacts.
    # If all time, we might need a dynamic baseline or just stick to a fixed "per sprint" rate 
    # derived from the total count?
    # Let's keep it simple: Compare "Your Rate" vs "Baseline Rate".
    # Rate = Artifacts / Time. 
    # For MVP, let's look at the pure count multiplier against a "Standard Monthly Output" of 4 artifacts.
    
    baseline_artifacts = 4.0 if timeframe == "30d" else (4.0 * 12) # Approximation for all time?
    # Actually, "Velocity Multiplier" implies speed relative to manual.
    # If manual takes X hours and AI takes Y hours, the multiplier is X/Y.
    # BUT the previous mock was "3.5x faster" based on volume.
    # Let's use Volume Multiplier: (Your Volume) / (Standard Volume)
    
    # Adjust baseline for "All Time" to be reasonable, or just cap it?
    # Better approach: If "30d", baseline is 4. If "all", baseline is max(4, total_artifacts / 3.5).
    # Let's stick to the plan: "Total Artifacts Created in Timeframe / Baseline Manual Rate"
    standard_monthly_output = 4.0
    
    if timeframe == "30d":
        baseline = standard_monthly_output
    else:
        # For all time, estimating start date of user? 
        # Fallback: just use total count vs what a manual user would do in the same usage period.
        # Let's simplify: if count is 0, multiplier is 0.
        # Otherwise, assume user has been active for X months?
        # Let's just use the 30d logic for the "Multiplier" visual regardless of filter, 
        # or defaults to 1.0 if low data.
        baseline = max(1.0, total_artifacts / 2.0) # Fallback to show *some* improvement

    velocity_multiplier = round(total_artifacts / baseline, 1) if baseline > 0 else 0.0
    if velocity_multiplier < 1.0 and total_artifacts > 0:
        velocity_multiplier = 1.0 # Don't show < 1x unless 0

    # 3. Strategic Focus
    # Constant 90% for MVP as decided
    strategic_focus_pct = 90

    return {
        "counts": {
            "prd": prd_count,
            "feasibility": feasibility_count,
            "ideation": ideation_count,
            "total": total_artifacts
        },
        "roi": {
            "hoursReclaimed": round(hours_reclaimed, 1),
            "velocityMultiplier": velocity_multiplier,
            "strategicFocus": strategic_focus_pct
        },
        "timeframe": timeframe
    }
