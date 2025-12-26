"""
CX Improvement Recommender Models

Database models for the CX Improvement Recommender feature.
Synthesizes pain points from journey maps and gaps from competitive analysis
into prioritized, actionable improvement recommendations.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class RecommenderSession(SQLModel, table=True):
    """Main session for CX improvement recommendation generation"""
    __tablename__ = "recommender_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Session name
    session_name: Optional[str] = None

    # Input sources
    journey_map_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))
    gap_analysis_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))
    idea_backlog_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))

    # Constraints
    timeline: str = Field(default="flexible")  # Q1 2025, Q2 2025, H1 2025, H2 2025, Flexible
    budget: str = Field(default="flexible")  # limited (<$50k), moderate ($50-200k), flexible (>$200k)
    team_capacity: Optional[str] = None  # e.g., "2 designers, 3 engineers"

    # Recommendation type
    recommendation_type: str = Field(default="comprehensive")
    # comprehensive, quick_wins, strategic, parity

    # Processing state
    status: str = Field(default="pending")
    # statuses: pending, extracting, clustering, generating, scoring, completed, failed
    progress_step: int = Field(default=0)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Generated results summary
    total_recommendations: int = Field(default=0)
    quick_wins_count: int = Field(default=0)
    high_impact_count: int = Field(default=0)
    strategic_count: int = Field(default=0)

    # Clusters identified during processing
    clusters: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{id: str, name: str, pain_point_ids: [int], gap_ids: [int], theme: str}]

    # Sprint plan suggestion
    sprint_plan: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {
    #   sprint1_2: [{rec_id, title, effort_days}],
    #   sprint3_4: [{rec_id, title, effort_days}],
    #   q2_plus: [{rec_id, title, effort_days}],
    #   total_effort_days: int,
    #   capacity_warning: str or None
    # }

    # Raw LLM responses for debugging
    raw_llm_responses: Optional[Dict[str, str]] = Field(default=None, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class Recommendation(SQLModel, table=True):
    """Individual improvement recommendations"""
    __tablename__ = "recommendations"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recommender_sessions.id")

    # Core info
    title: str
    description: str
    cluster_id: Optional[str] = None  # Reference to cluster that generated this

    # Solution approaches (2-3 per recommendation)
    solution_approaches: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{title: str, description: str, pros: [str], cons: [str]}]

    # Linkages to source data
    addresses_pain_points: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{pain_point_id: int, description: str, severity: float, stage_name: str}]
    addresses_gaps: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{gap_id: int, title: str, opportunity_score: float}]

    # Impact estimation
    impact_score: float = Field(default=5.0, ge=0.0, le=10.0)
    pain_reduction_percent: Optional[float] = None  # e.g., 35.0 means 35%
    users_affected_percent: Optional[float] = None  # % of users impacted
    business_metrics: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {time_savings: str, conversion_lift: str, nps_impact: str, retention_impact: str}

    # Effort estimation
    effort_score: float = Field(default=5.0, ge=0.0, le=10.0)
    design_days: Optional[int] = None
    engineering_days: Optional[int] = None
    testing_days: Optional[int] = None
    risk_level: str = Field(default="medium")  # low, medium, high
    total_effort_days: Optional[int] = None

    # Urgency (from competitive pressure, pain severity)
    urgency_score: float = Field(default=5.0, ge=0.0, le=10.0)
    competitive_context: Optional[str] = None  # If from gap analysis

    # Calculated scores
    opportunity_score: float = Field(default=5.0, ge=0.0)  # (Impact × Urgency) / Effort
    confidence_score: float = Field(default=0.7, ge=0.0, le=1.0)

    # Classification
    quick_win: bool = Field(default=False)  # Impact > 7 AND Effort < 4
    priority_tier: int = Field(default=2, ge=1, le=3)
    # Tier 1 (Critical): opportunity_score > 15
    # Tier 2 (Important/High Impact): opportunity_score 8-15
    # Tier 3 (Strategic): opportunity_score < 8

    # Category for display column
    display_category: str = Field(default="high_impact")
    # quick_wins, high_impact, strategic

    # Implementation guidance
    implementation_approach: Optional[str] = None  # 2-3 sentences on how to build
    success_metrics: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Status tracking
    status: str = Field(default="proposed")  # proposed, approved, in_progress, completed, dismissed
    epic_id: Optional[int] = Field(default=None, foreign_key="generated_artifacts.id")

    # User edits
    is_user_edited: bool = Field(default=False)
    is_custom: bool = Field(default=False)  # User manually added
    is_dismissed: bool = Field(default=False)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecommenderInputCache(SQLModel, table=True):
    """Cache extracted pain points and gaps for recommendation generation"""
    __tablename__ = "recommender_input_cache"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="recommender_sessions.id")

    # Extracted data
    extracted_pain_points: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{id: int, journey_map_id: int, description: str, severity: float,
    #           frequency: int, stage_id: str, stage_name: str, data_sources: [...]}]

    extracted_gaps: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{id: int, session_id: int, title: str, description: str,
    #           opportunity_score: float, impact_score: float, stage_name: str}]

    extracted_ideas: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{id: int, title: str, description: str, source: str}]

    # Summary stats
    total_pain_points: int = Field(default=0)
    total_gaps: int = Field(default=0)
    total_ideas: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
