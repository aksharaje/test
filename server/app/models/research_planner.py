"""
Research Planner Models

Database models for the CX Research Planner feature.
Stores research plan sessions and generated instruments (interview guides, surveys, recruiting plans).
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class ResearchPlanSession(SQLModel, table=True):
    """Main session for research planning workflow"""
    __tablename__ = "research_plan_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Input data
    objective: str = Field(min_length=10)
    constraints: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # constraints schema: {budget: "limited"|"moderate"|"flexible", timeline: "urgent"|"normal"|"flexible", user_access: bool, remote_only: bool}

    # Processing state
    status: str = Field(default="pending")
    # statuses: pending, recommending, selecting, generating_instruments, completed, failed
    progress_step: int = Field(default=0)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # User selections after method recommendation
    selected_methods: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    # e.g., ["user_interviews", "surveys", "usability_testing"]

    # Suggested research sequence
    suggested_sequence: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Generation metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class RecommendedMethod(SQLModel, table=True):
    """LLM-generated method recommendations for a research plan"""
    __tablename__ = "recommended_methods"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="research_plan_sessions.id")

    method_name: str  # e.g., "user_interviews", "surveys", "usability_testing"
    method_label: str  # e.g., "User Interviews", "Surveys", "Usability Testing"
    rationale: str
    effort: str  # low, medium, high
    cost_estimate: str  # e.g., "$1,200-2,000", "Free"
    timeline: str  # e.g., "2-3 weeks"
    participant_count: str  # e.g., "8-12 participants"
    confidence_score: float = Field(ge=0.0, le=1.0)

    is_selected: bool = Field(default=False)
    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class InterviewGuide(SQLModel, table=True):
    """Generated interview guide instrument"""
    __tablename__ = "interview_guides"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="research_plan_sessions.id")

    # Generation inputs
    participant_type: str
    duration_minutes: int = Field(default=45)
    focus_areas: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Generated content
    content_markdown: str  # Full guide in markdown
    sections: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # sections schema: {introduction: str, warmup: [str], behavioral: [{question: str, probes: [str]}], attitudinal: [str], closing: str}

    # User edits (if any)
    user_edited_content: Optional[str] = None
    is_edited: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Survey(SQLModel, table=True):
    """Generated survey instrument"""
    __tablename__ = "surveys"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="research_plan_sessions.id")

    # Generation inputs
    target_audience: str
    survey_length: str = Field(default="medium")  # short, medium, long
    question_types: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    # e.g., ["multiple_choice", "rating", "open_ended"]

    # Generated content
    questions: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # questions schema: [{question_id: str, text: str, type: str, options: [str], required: bool, conditional_logic: {...}}]
    analysis_plan: Optional[str] = None
    estimated_completion_time: Optional[str] = None  # e.g., "5-7 minutes"

    # User edits
    is_edited: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecruitingPlan(SQLModel, table=True):
    """Generated recruiting strategy"""
    __tablename__ = "recruiting_plans"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="research_plan_sessions.id")

    # Generation inputs
    participant_criteria: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # e.g., {role: "Enterprise Admin", company_size: "200+", experience: "..."}
    participant_count: int = Field(default=12)
    segmentation: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Generated content
    detailed_criteria: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    screener_questions: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # screener schema: [{question: str, type: str, qualifying_answer: str}]
    recruiting_sources: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    # e.g., ["CRM", "support_tickets", "user_base", "third_party_panels"]
    email_templates: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # e.g., [{type: "initial_outreach", subject: str, body: str}]
    incentive_recommendation: Optional[str] = None
    expected_response_rate: float = Field(default=0.15, ge=0.0, le=1.0)
    contacts_needed: int = Field(default=100)
    timeline_estimate: Optional[str] = None

    # User edits
    is_edited: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
