from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func, col
from datetime import datetime, timedelta

from app.core import db as deps
from app.models.user import User

# Artifact Models
from app.models.prd import GeneratedPrd
from app.models.ideation import IdeationSession
from app.models.feasibility import FeasibilitySession
from app.models.business_case import BusinessCaseSession
from app.models.journey_mapper import JourneyMapSession
from app.models.research_planner import ResearchPlanSession
from app.models.release_prep import ReleasePrepSession
from app.models.roadmap_planner import RoadmapSession
from app.models.story_to_code import StoryToCodeSession

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
            # Handle standard created_at or updated_at
            if hasattr(model, "created_at"):
                query = query.where(model.created_at >= start_date)
            elif hasattr(model, "updated_at"):
                query = query.where(model.updated_at >= start_date)
        return db.exec(query).one()

    # Queries
    prd_count = count_query(GeneratedPrd)
    feasibility_count = count_query(FeasibilitySession)
    ideation_count = count_query(IdeationSession)
    business_case_count = count_query(BusinessCaseSession)
    journey_count = count_query(JourneyMapSession)
    research_count = count_query(ResearchPlanSession)
    release_count = count_query(ReleasePrepSession)
    roadmap_count = count_query(RoadmapSession)
    code_count = count_query(StoryToCodeSession)
    
    total_artifacts = (
        prd_count + feasibility_count + ideation_count +
        business_case_count + journey_count + research_count +
        release_count + roadmap_count + code_count
    )

    # 2. ROI Calculations
    
    # Hours Reclaimed Estimates
    # PRD=4h, Feasibility=2h, Ideation=0.5h
    # Business Case=6h, Journey Map=3h, Research Plan=3h
    # Release Prep=2h, Roadmap=4h, StoryToCode=2h
    hours_reclaimed = (
        (prd_count * 4.0) + 
        (feasibility_count * 2.0) + 
        (ideation_count * 0.5) +
        (business_case_count * 6.0) +
        (journey_count * 3.0) +
        (research_count * 3.0) +
        (release_count * 2.0) +
        (roadmap_count * 4.0) +
        (code_count * 2.0)
    )
    
    # Velocity Multiplier
    # Baseline: 2 artifacts per sprint (2 weeks).
    # If timeframe is 30d (~4.3 weeks), baseline is ~4.3 artifacts.
    standard_monthly_output = 4.0
    
    if timeframe == "30d":
        baseline = standard_monthly_output
    else:
        baseline = max(1.0, total_artifacts / 2.0) # Fallback

    velocity_multiplier = round(total_artifacts / baseline, 1) if baseline > 0 else 0.0
    if velocity_multiplier < 1.0 and total_artifacts > 0:
        velocity_multiplier = 1.0 

    # 3. Strategic Focus
    # Constant 90% for MVP as decided
    strategic_focus_pct = 90

    return {
        "counts": {
            "prd": prd_count,
            "feasibility": feasibility_count,
            "ideation": ideation_count,
            "business_case": business_case_count,
            "journey_mapper": journey_count,
            "research_planner": research_count,
            "release_prep": release_count,
            "roadmap_planner": roadmap_count,
            "story_to_code": code_count,
            "total": total_artifacts
        },
        "roi": {
            "hoursReclaimed": round(hours_reclaimed, 1),
            "velocityMultiplier": velocity_multiplier,
            "strategicFocus": strategic_focus_pct
        },
        "timeframe": timeframe
    }
