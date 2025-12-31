"""
OKR & KPI Generator Models

Database models for generating OKRs and KPIs from goals.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class OkrSession(SQLModel, table=True):
    """Main session for OKR generation workflow"""
    __tablename__ = "okr_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Input fields
    goal_description: str = Field(min_length=50)  # Goal(s) to generate OKRs for
    goal_session_id: Optional[int] = Field(default=None, foreign_key="goal_setting_sessions.id")  # Link to goal setting session
    timeframe: str  # e.g., "Q1 2025", "Annual 2025"
    team_context: Optional[str] = None  # Team or department context
    measurement_preferences: Optional[str] = None  # Preferred measurement approaches

    # Processing state
    status: str = Field(default="pending")  # pending, generating, completed, failed
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Output summary
    executive_summary: Optional[str] = None

    # Metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class Objective(SQLModel, table=True):
    """Objective in the OKR framework"""
    __tablename__ = "okr_objectives"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="okr_sessions.id")

    # Objective details
    title: str
    description: str
    category: str  # company, team, individual
    timeframe: str

    # Alignment
    strategic_alignment: Optional[str] = None  # How this aligns with strategy
    owner: Optional[str] = None  # Suggested owner

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class KeyResult(SQLModel, table=True):
    """Key Result linked to an Objective"""
    __tablename__ = "okr_key_results"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    objective_id: int = Field(foreign_key="okr_objectives.id")
    session_id: int = Field(foreign_key="okr_sessions.id")

    # Key Result details
    title: str
    description: str
    metric_type: str  # percentage, number, boolean, currency

    # Targets
    baseline_value: Optional[str] = None
    target_value: str
    stretch_target: Optional[str] = None

    # Ownership and tracking
    owner: Optional[str] = None  # e.g., "PM • Growth", "Eng • Auth"
    kpi_name: Optional[str] = None  # e.g., "Login Success Rate"
    measurement_method: str  # How to measure this
    data_source: Optional[str] = None  # Where data comes from
    tracking_frequency: str = Field(default="weekly")  # daily, weekly, monthly

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Kpi(SQLModel, table=True):
    """KPI that supports measuring Key Results"""
    __tablename__ = "okr_kpis"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    key_result_id: Optional[int] = Field(default=None, foreign_key="okr_key_results.id")
    session_id: int = Field(foreign_key="okr_sessions.id")

    # KPI details
    name: str
    description: str
    category: str  # leading, lagging
    metric_type: str  # percentage, number, ratio, currency

    # Values
    formula: Optional[str] = None  # How to calculate
    baseline: Optional[str] = None
    target: str
    unit: Optional[str] = None  # e.g., "%", "users", "$"

    # Data collection
    data_source: Optional[str] = None
    collection_frequency: str = Field(default="weekly")
    owner: Optional[str] = None

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Pydantic models for API
class OkrSessionCreate(SQLModel):
    """Request model for creating a new OKR session"""
    goal_description: str = Field(min_length=50)
    goal_session_id: Optional[int] = None
    timeframe: str
    team_context: Optional[str] = None
    measurement_preferences: Optional[str] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class OkrSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    goal_description: str
    goal_session_id: Optional[int]
    timeframe: str
    team_context: Optional[str]
    measurement_preferences: Optional[str]
    status: str
    progress_message: Optional[str]
    error_message: Optional[str]
    executive_summary: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class ObjectiveResponse(SQLModel):
    """Response model for objective"""
    id: int
    session_id: int
    title: str
    description: str
    category: str
    timeframe: str
    strategic_alignment: Optional[str]
    owner: Optional[str]
    display_order: int

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class KeyResultResponse(SQLModel):
    """Response model for key result"""
    id: int
    objective_id: int
    session_id: int
    title: str
    description: str
    metric_type: str
    baseline_value: Optional[str]
    target_value: str
    stretch_target: Optional[str]
    owner: Optional[str]
    kpi_name: Optional[str]
    measurement_method: str
    data_source: Optional[str]
    tracking_frequency: str
    display_order: int

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class KpiResponse(SQLModel):
    """Response model for KPI"""
    id: int
    key_result_id: Optional[int]
    session_id: int
    name: str
    description: str
    category: str
    metric_type: str
    formula: Optional[str]
    baseline: Optional[str]
    target: str
    unit: Optional[str]
    data_source: Optional[str]
    collection_frequency: str
    owner: Optional[str]
    display_order: int

    class Config:
        alias_generator = to_camel
        populate_by_name = True
