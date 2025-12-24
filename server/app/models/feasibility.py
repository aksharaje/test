from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class FeasibilitySession(SQLModel, table=True):
    __tablename__ = "feasibility_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    feature_description: str = Field(min_length=100)  # No max length - epics can be long
    technical_constraints: Optional[str] = None
    target_users: Optional[str] = None
    auto_detected_stack: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    status: str = Field(default="pending")
    progress_step: int = Field(default=0)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    go_no_go_recommendation: Optional[str] = None  # go, no_go, conditional
    executive_summary: Optional[str] = None
    confidence_level: str = Field(default="medium")  # low, medium, high

    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class TechnicalComponent(SQLModel, table=True):
    __tablename__ = "technical_components"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="feasibility_sessions.id")

    component_name: str
    component_description: str
    technical_category: str  # backend, frontend, infrastructure, data, integration

    optimistic_hours: float
    realistic_hours: float
    pessimistic_hours: float

    confidence_level: str  # low, medium, high
    estimated_by_agent: bool = Field(default=True)
    is_editable: bool = Field(default=True)

    dependencies: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))
    can_parallelize: bool = Field(default=False)

    display_order: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TimelineScenario(SQLModel, table=True):
    __tablename__ = "timeline_scenarios"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="feasibility_sessions.id")

    scenario_type: str  # optimistic, realistic, pessimistic
    total_weeks: float
    sprint_count: int

    parallelization_factor: float  # 1.0 = no parallelization, 0.5 = 50% parallel
    overhead_percentage: float  # meetings, reviews, rework
    team_size_assumed: int

    confidence_level: str  # low, medium, high
    rationale: str

    created_at: datetime = Field(default_factory=datetime.utcnow)


class RiskAssessment(SQLModel, table=True):
    __tablename__ = "risk_assessments"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="feasibility_sessions.id")

    risk_category: str  # technical, resource, schedule, dependency, integration
    risk_description: str

    probability: float  # 0.0-1.0
    impact: float  # 0.0-1.0
    risk_score: float  # probability * impact

    mitigation_strategy: str
    display_order: int

    created_at: datetime = Field(default_factory=datetime.utcnow)


class SkillRequirement(SQLModel, table=True):
    __tablename__ = "skill_requirements"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="feasibility_sessions.id")

    skill_name: str
    proficiency_level: str  # beginner, intermediate, advanced, expert
    estimated_person_weeks: float

    is_gap: bool = Field(default=False)
    gap_mitigation: Optional[str] = None

    display_order: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ActualResult(SQLModel, table=True):
    __tablename__ = "actual_results"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="feasibility_sessions.id")
    component_id: Optional[int] = Field(default=None, foreign_key="technical_components.id")

    actual_hours_spent: float
    actual_completion_date: datetime = Field(default_factory=datetime.utcnow)
    variance_percentage: float  # (actual - estimated) / estimated

    lessons_learned: Optional[str] = None
    recorded_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
