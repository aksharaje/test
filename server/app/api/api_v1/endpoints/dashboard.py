from typing import Any, Dict, Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func, col, or_, desc
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
# New Models
from app.models.competitive_analysis import CompetitiveAnalysisSession
from app.models.scope_definition import ScopeDefinitionSession
from app.models.scope_monitor import ScopeMonitorSession
from app.models.measurement_framework import MeasurementFrameworkSession
from app.models.kpi_assignment import KpiAssignmentSession
from app.models.okr_generator import OkrSession
from app.models.goal_setting import GoalSettingSession
from app.models.scenario_modeler import ScenarioSession
from app.models.experience_gap_analyzer import GapAnalysisSession
from app.models.cx_recommender import RecommenderSession
from app.models.roadmap_communicator import CommunicatorSession

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
    
    def count_query(model):
        query = select(func.count())
        if hasattr(model, "user_id"):
            query = query.where(or_(model.user_id == user_id, model.user_id == None))

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
    
    # New Counts
    competitive_count = count_query(CompetitiveAnalysisSession)
    scope_def_count = count_query(ScopeDefinitionSession)
    scope_monitor_count = count_query(ScopeMonitorSession)
    measurement_count = count_query(MeasurementFrameworkSession)
    kpi_count = count_query(KpiAssignmentSession)
    okr_count = count_query(OkrSession)
    goal_count = count_query(GoalSettingSession)
    scenario_count = count_query(ScenarioSession)
    gap_count = count_query(GapAnalysisSession)
    recommender_count = count_query(RecommenderSession)
    communicator_count = count_query(CommunicatorSession)
    
    total_artifacts = (
        prd_count + feasibility_count + ideation_count +
        business_case_count + journey_count + research_count +
        release_count + roadmap_count + code_count +
        competitive_count + scope_def_count + scope_monitor_count +
        measurement_count + kpi_count + okr_count + goal_count +
        scenario_count + gap_count + recommender_count + communicator_count
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
        (code_count * 2.0) +
        (competitive_count * 3.0) +
        (scope_def_count * 3.0) +
        (scope_monitor_count * 1.0) +
        (measurement_count * 3.0) + 
        (kpi_count * 1.0) +
        (okr_count * 3.0) +
        (goal_count * 2.0) + 
        (scenario_count * 2.0) +
        (gap_count * 3.0) +
        (recommender_count * 1.0) +
        (communicator_count * 1.0)
    )
    
    # Velocity Multiplier
    # Baseline: 2 artifacts per sprint (2 weeks).
    # If timeframe is 30d (~4.3 weeks), baseline is ~4.3 artifacts.
    standard_monthly_output = 40.0
    
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

    # --- Gamification Calculations (All Time) ---
    
    # We need all-time counts for XP and Mastery
    def count_all_time(model):
        query = select(func.count())
        if hasattr(model, "user_id"):
            query = query.where(or_(model.user_id == user_id, model.user_id == None))
        return db.exec(query).one()

    # 1. Product Level (XP)
    xp_weights = {
        "high": 100,  # Roadmap, Business Case
        "medium": 50, # PRD, Feasibility, Journey Map, Research Plan, Release Prep
        "low": 10     # Ideation, Story to Code
    }
    
    at_prd = count_all_time(GeneratedPrd)
    at_feasibility = count_all_time(FeasibilitySession)
    at_ideation = count_all_time(IdeationSession)
    at_business = count_all_time(BusinessCaseSession)
    at_journey = count_all_time(JourneyMapSession)
    at_research = count_all_time(ResearchPlanSession)
    at_release = count_all_time(ReleasePrepSession)
    at_roadmap = count_all_time(RoadmapSession)
    at_code = count_all_time(StoryToCodeSession)

    # All time counts for new models
    at_competitive = count_all_time(CompetitiveAnalysisSession)
    at_scope_def = count_all_time(ScopeDefinitionSession)
    at_scope_mon = count_all_time(ScopeMonitorSession)
    at_measurement = count_all_time(MeasurementFrameworkSession)
    at_kpi = count_all_time(KpiAssignmentSession)
    at_okr = count_all_time(OkrSession)
    at_goal = count_all_time(GoalSettingSession)
    at_scenario = count_all_time(ScenarioSession)
    at_gap = count_all_time(GapAnalysisSession)
    at_recommender = count_all_time(RecommenderSession)
    at_communicator = count_all_time(CommunicatorSession)
    
    total_xp = (
        (at_business + at_roadmap + at_scenario + at_okr + at_gap) * xp_weights["high"] +
        (at_prd + at_feasibility + at_journey + at_research + at_release + at_competitive + at_scope_def + at_measurement) * xp_weights["medium"] +
        (at_ideation + at_code + at_scope_mon + at_kpi + at_goal + at_recommender + at_communicator) * xp_weights["low"]
    )
    
    # Level: 1000 XP per level
    current_level = int(total_xp / 1000) + 1
    xp_for_next_level = (current_level) * 1000
    progress_to_next = total_xp % 1000
    
    # 2. Studio Mastery Score
    modules_used = 0
    modules = [
        at_prd, at_feasibility, at_ideation, at_business, at_journey, at_research, 
        at_release, at_roadmap, at_code,
        at_competitive, at_scope_def, at_scope_mon, at_measurement, at_kpi, at_okr,
        at_goal, at_scenario, at_gap, at_recommender, at_communicator
    ]
    for m in modules:
        if m > 0:
            modules_used += 1
    
    total_modules = 20 # Expanded modules list
    mastery_score = round((modules_used / total_modules) * 100)
    
    # 3. Momentum Streak (Simplified: just check recent dates)
    def get_dates(model):
        if hasattr(model, "created_at"):
            query = select(model.created_at)
            if hasattr(model, "user_id"):
                query = query.where(or_(model.user_id == user_id, model.user_id == None))
            return db.exec(query).all()
        return []

    all_dates = []
    all_dates.extend(get_dates(GeneratedPrd))
    all_dates.extend(get_dates(FeasibilitySession))
    all_dates.extend(get_dates(IdeationSession))
    all_dates.extend(get_dates(BusinessCaseSession))
    all_dates.extend(get_dates(JourneyMapSession))
    all_dates.extend(get_dates(ResearchPlanSession))
    all_dates.extend(get_dates(ReleasePrepSession))
    all_dates.extend(get_dates(RoadmapSession))
    all_dates.extend(get_dates(StoryToCodeSession))
    # Add new models
    all_dates.extend(get_dates(CompetitiveAnalysisSession))
    all_dates.extend(get_dates(ScopeDefinitionSession))
    all_dates.extend(get_dates(ScopeMonitorSession))
    all_dates.extend(get_dates(MeasurementFrameworkSession))
    all_dates.extend(get_dates(KpiAssignmentSession))
    all_dates.extend(get_dates(OkrSession))
    all_dates.extend(get_dates(GoalSettingSession))
    all_dates.extend(get_dates(ScenarioSession))
    all_dates.extend(get_dates(GapAnalysisSession))
    all_dates.extend(get_dates(RecommenderSession))
    all_dates.extend(get_dates(CommunicatorSession))
    
    current_streak = 0
    if all_dates:
        # Check unique weeks
        activity_weeks = set()
        for d in all_dates:
            activity_weeks.add((d.year, d.isocalendar()[1]))
            
        now = datetime.utcnow()
        current_year, current_week, _ = now.isocalendar()
        
        # If active this week, count it
        if (current_year, current_week) in activity_weeks:
            current_streak += 1
            # Check backwards
            check_date = now - timedelta(days=7)
            while True:
                y, w, _ = check_date.isocalendar()
                if (y, w) in activity_weeks:
                    current_streak += 1
                    check_date -= timedelta(days=7)
                else:
                    break
        else:
             # Check if active last week to keep streak alive?
             # For this prototype, straightforward approach:
             # If not active this week, check last week. 
             # If active last week, streak starts there.
             pass

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
            "competitive_analysis": competitive_count,
            "scope_definition": scope_def_count,
            "scope_monitor": scope_monitor_count,
            "measurement_framework": measurement_count,
            "kpi_assignment": kpi_count,
            "okr_generator": okr_count,
            "goal_setting": goal_count,
            "scenario_modeler": scenario_count,
            "gap_analyzer": gap_count,
            "cx_recommender": recommender_count,
            "roadmap_communicator": communicator_count,
            "total": total_artifacts
        },
        "roi": {
            "hoursReclaimed": round(hours_reclaimed, 1),
            "velocityMultiplier": velocity_multiplier,
            "strategicFocus": strategic_focus_pct
        },
        "gamification": {
            "level": current_level,
            "totalXp": total_xp,
            "nextLevelXp": xp_for_next_level,
            "progressXp": progress_to_next,
            "masteryScore": mastery_score,
            "streakWeeks": current_streak,
            "badges": {
                "strategy": (at_roadmap > 0) or (at_business > 0) or (at_okr > 0) or (at_scenario > 0),
                "research": (at_journey > 0) or (at_research > 0) or (at_competitive > 0) or (at_gap > 0),
                "execution": (at_prd > 0) or (at_feasibility > 0) or (at_code > 0) or (at_scope_def > 0)
            }
        },
        "timeframe": timeframe
    }


# ==================== REPORT ENDPOINT ====================

class ReportItem(BaseModel):
    id: int
    title: str
    date: datetime
    type: str

class ReportGroup(BaseModel):
    id: str
    label: str
    hours_per_unit: float
    total_hours: float
    count: int
    items: List[ReportItem]

class DashboardReport(BaseModel):
    groups: List[ReportGroup]
    total_hours: float
    total_count: int
    velocity_multiplier: float = 0.0
    baseline: float = 40.0

@router.get("/report", response_model=DashboardReport)
def get_dashboard_report(
    timeframe: str = Query("30d", enum=["30d", "all"]),
    report_type: str = Query("productivity", enum=["productivity", "velocity"]),
    user_id: int = Query(1),
    db: Session = Depends(deps.get_session),
) -> Any:
    """
    Get detailed itemized report for dashboard drill-down.
    """
    start_date = None
    if timeframe == "30d":
        start_date = datetime.utcnow() - timedelta(days=30)

    # Configuration: Model -> (Label, Hours, Key)
    config = [
        (GeneratedPrd, "PRD", 4.0, "prd"),
        (FeasibilitySession, "Feasibility Analysis", 2.0, "feasibility"),
        (IdeationSession, "Ideation", 0.5, "ideation"),
        (BusinessCaseSession, "Business Case", 6.0, "business_case"),
        (JourneyMapSession, "Journey Map", 3.0, "journey_mapper"),
        (ResearchPlanSession, "Research Plan", 3.0, "research_planner"),
        (ReleasePrepSession, "Release Prep", 2.0, "release_prep"),
        (RoadmapSession, "Roadmap", 4.0, "roadmap_planner"),
        (StoryToCodeSession, "Story to Code", 2.0, "story_to_code"),
        (CompetitiveAnalysisSession, "Competitive Analysis", 3.0, "competitive_analysis"),
        (ScopeDefinitionSession, "Scope Definition", 3.0, "scope_definition"),
        (ScopeMonitorSession, "Scope Monitor", 1.0, "scope_monitor"),
        (MeasurementFrameworkSession, "Measurement Framework", 3.0, "measurement_framework"),
        (KpiAssignmentSession, "KPI Assignment", 1.0, "kpi_assignment"),
        (OkrSession, "OKR Generator", 3.0, "okr_generator"),
        (GoalSettingSession, "Goal Setting", 2.0, "goal_setting"),
        (ScenarioSession, "Scenario Modeler", 2.0, "scenario_modeler"),
        (GapAnalysisSession, "Gap Analysis", 3.0, "gap_analyzer"),
        (RecommenderSession, "CX Recommender", 1.0, "cx_recommender"),
        (CommunicatorSession, "Roadmap Communicator", 1.0, "roadmap_communicator"),
    ]

    groups = []
    grand_total_hours = 0.0
    grand_total_count = 0

    for model, label, hours, key in config:
        # Build query
        query = select(model)
        
        # Filter by User (OR NULL)
        if hasattr(model, "user_id"):
             query = query.where(or_(model.user_id == user_id, model.user_id == None))
        
        # Filter by Date
        if start_date:
            if hasattr(model, "created_at"):
                query = query.where(model.created_at >= start_date)
            elif hasattr(model, "updated_at"):
                query = query.where(model.updated_at >= start_date)
        
        # Order By Date Desc
        order_col = model.updated_at if hasattr(model, "updated_at") else (model.created_at if hasattr(model, "created_at") else None)
        if order_col is not None:
            query = query.order_by(desc(order_col))

        # Execute
        results = db.exec(query).all()
        
        items = []
        for r in results:
            # Determine Title
            title = _get_artifact_title(r)
            
            # Determine Date
            date = datetime.utcnow()
            if hasattr(r, "updated_at") and r.updated_at: date = r.updated_at
            elif hasattr(r, "created_at") and r.created_at: date = r.created_at

            items.append(ReportItem(
                id=r.id,
                title=title,
                date=date,
                type=key
            ))
        
        count = len(items)
        if count > 0:
            total = count * hours
            grand_total_hours += total
            grand_total_count += count
            
            groups.append(ReportGroup(
                id=key,
                label=label,
                hours_per_unit=hours,
                total_hours=total,
                count=count,
                items=items
            ))
            
    # Sort groups by total hours desc (for productivity) or count (for velocity) - defaulting to hours for now
    groups.sort(key=lambda x: x.total_hours, reverse=True)

    # Calculate Velocity Multiplier for Report
    months_diff = 1.0 # Default
    if start_date:
        delta = datetime.utcnow() - start_date
        months_diff = max(delta.days / 30.0, 1.0)
    
    standard_monthly_output = 40.0
    velocity_multiplier = 0.0
    if months_diff > 0:
        monthly_run_rate = grand_total_count / months_diff
        if standard_monthly_output > 0:
            velocity_multiplier = round(monthly_run_rate / standard_monthly_output, 1)

    return DashboardReport(
        groups=groups,
        total_hours=grand_total_hours,
        total_count=grand_total_count,
        velocity_multiplier=velocity_multiplier,
        baseline=standard_monthly_output
    )

def _get_artifact_title(r: Any) -> str:
    """Helper to resolve a display title for any artifact model"""
    # 1. Explicit Name/Title fields
    if hasattr(r, "title") and r.title: return r.title
    if hasattr(r, "name") and r.name: return r.name
    if hasattr(r, "project_name") and r.project_name: return r.project_name
    if hasattr(r, "session_name") and r.session_name: return r.session_name
    if hasattr(r, "analysis_name") and r.analysis_name: return r.analysis_name

    # 2. Semantic fields (Feature, Problem, Domain)
    if hasattr(r, "feature_title") and r.feature_title: return r.feature_title
    if hasattr(r, "problem_statement") and r.problem_statement: return r.problem_statement[:60] + "..." if len(r.problem_statement) > 60 else r.problem_statement
    if hasattr(r, "focus_area") and r.focus_area: return r.focus_area
    if hasattr(r, "domain") and r.domain: return r.domain
    
    # 3. Long-form fields (truncating)
    if hasattr(r, "goal_description") and r.goal_description: 
        return r.goal_description[:60] + "..." if len(r.goal_description) > 60 else r.goal_description
    if hasattr(r, "objectives_description") and r.objectives_description:
        return r.objectives_description[:60] + "..." if len(r.objectives_description) > 60 else r.objectives_description
    
    # 4. Fallback for specific types based on class name or ID
    model_name = type(r).__name__
    return f"{model_name} #{r.id}"
