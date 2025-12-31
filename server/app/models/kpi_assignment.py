"""
KPI Assignment Models

Database models for AI-generated KPI assignment to Goals.
This flow takes Goals from Goal Setting and generates appropriate KPIs.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class KpiAssignmentSession(SQLModel, table=True):
    """Session for KPI assignment workflow"""
    __tablename__ = "kpi_assignment_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Link to Goal Setting session (primary source)
    goal_session_id: Optional[int] = Field(default=None, foreign_key="goal_setting_sessions.id")

    # Legacy: Link to OKR session (for backwards compatibility)
    okr_session_id: Optional[int] = Field(default=None, foreign_key="okr_sessions.id")

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


class KpiAssignment(SQLModel, table=True):
    """Individual KPI assignment for a Goal"""
    __tablename__ = "kpi_assignments"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="kpi_assignment_sessions.id")

    # Link to Goal (primary)
    goal_id: Optional[int] = Field(default=None, foreign_key="goals.id")

    # Legacy: Link to Key Result (for backwards compatibility)
    key_result_id: Optional[int] = Field(default=None, foreign_key="okr_key_results.id")

    # Goal info (denormalized for display)
    goal_title: Optional[str] = None
    goal_category: Optional[str] = None

    # KPI Assignment fields (AI-generated)
    primary_kpi: str  # e.g., "Login Success Rate"
    measurement_unit: str  # e.g., "Percentage (%)"
    secondary_kpi: Optional[str] = None  # Health metric, e.g., "Support Ticket Volume"
    check_frequency: str = Field(default="weekly")  # daily, weekly, monthly, quarterly

    # Additional AI-generated suggestions
    alternative_kpis: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    rationale: Optional[str] = None  # Why this KPI was suggested

    # Additional metadata
    metric_suggestions: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = None
    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Pydantic models for API
class KpiAssignmentCreate(SQLModel):
    """Request model for creating/updating a KPI assignment"""
    goal_id: Optional[int] = None
    key_result_id: Optional[int] = None  # Legacy
    primary_kpi: str
    measurement_unit: str
    secondary_kpi: Optional[str] = None
    check_frequency: str = "weekly"
    notes: Optional[str] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class KpiAssignmentSessionCreate(SQLModel):
    """Request model for creating a KPI assignment session"""
    goal_session_id: Optional[int] = None  # From Goal Setting
    okr_session_id: Optional[int] = None  # Legacy: From OKR Generator

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class KpiAssignmentResponse(SQLModel):
    """Response model for KPI assignment"""
    id: int
    session_id: int
    goal_id: Optional[int]
    key_result_id: Optional[int]
    goal_title: Optional[str]
    goal_category: Optional[str]
    primary_kpi: str
    measurement_unit: str
    secondary_kpi: Optional[str]
    check_frequency: str
    alternative_kpis: Optional[List[str]]
    rationale: Optional[str]
    metric_suggestions: Optional[List[str]]
    notes: Optional[str]
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class KpiAssignmentSessionResponse(SQLModel):
    """Response model for KPI assignment session"""
    id: int
    goal_session_id: Optional[int]
    okr_session_id: Optional[int]
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
