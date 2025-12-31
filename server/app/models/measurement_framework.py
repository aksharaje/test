"""
Measurement Framework Builder Models

Database models for building comprehensive measurement frameworks.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class MeasurementFrameworkSession(SQLModel, table=True):
    """Main session for measurement framework building"""
    __tablename__ = "measurement_framework_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Input fields
    name: str  # Framework name
    objectives_description: str = Field(min_length=50)  # What we're trying to measure
    okr_session_id: Optional[int] = Field(default=None, foreign_key="okr_sessions.id")  # Link to OKR session
    existing_data_sources: Optional[str] = None  # Known data sources
    reporting_requirements: Optional[str] = None  # Reporting needs
    stakeholder_audience: Optional[str] = None  # Who will consume the reports
    knowledge_base_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))  # KBs for context

    # Processing state
    status: str = Field(default="pending")  # pending, generating, completed, failed
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Output summary
    executive_summary: Optional[str] = None
    framework_overview: Optional[str] = None

    # Metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class FrameworkMetric(SQLModel, table=True):
    """Metric definition within the framework"""
    __tablename__ = "framework_metrics"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="measurement_framework_sessions.id")

    # Metric details
    name: str
    description: str
    category: str  # outcome, output, activity, input
    metric_type: str  # quantitative, qualitative
    data_type: str  # percentage, count, ratio, score, currency

    # Definition
    formula: Optional[str] = None
    unit: Optional[str] = None
    baseline: Optional[str] = None
    target: Optional[str] = None
    threshold_good: Optional[str] = None
    threshold_warning: Optional[str] = None
    threshold_critical: Optional[str] = None

    # Collection
    collection_method: str  # automated, manual, survey, api
    collection_frequency: str  # real-time, daily, weekly, monthly, quarterly
    data_owner: Optional[str] = None
    data_source: Optional[str] = None

    # Reporting
    visualization_type: Optional[str] = None  # line, bar, gauge, table
    dashboard_placement: Optional[str] = None  # executive, operational, tactical

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FrameworkDataSource(SQLModel, table=True):
    """Data source configuration for the framework"""
    __tablename__ = "framework_data_sources"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="measurement_framework_sessions.id")

    # Source details
    name: str
    source_type: str  # database, api, spreadsheet, survey, manual
    description: str

    # Connection info (non-sensitive)
    connection_details: Optional[str] = None  # General description of how to connect
    refresh_frequency: str  # real-time, hourly, daily, weekly

    # Data quality
    reliability_score: Optional[str] = None  # high, medium, low
    data_quality_notes: Optional[str] = None

    # Linked metrics
    linked_metric_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FrameworkDashboard(SQLModel, table=True):
    """Dashboard recommendation for the framework"""
    __tablename__ = "framework_dashboards"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="measurement_framework_sessions.id")

    # Dashboard details
    name: str
    description: str
    audience: str  # executive, manager, team, individual
    purpose: str  # strategic, operational, tactical

    # Content
    key_metrics: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    layout_description: Optional[str] = None
    refresh_frequency: str  # real-time, daily, weekly

    # Implementation
    recommended_tool: Optional[str] = None  # e.g., "PowerBI", "Tableau", "Custom"
    implementation_notes: Optional[str] = None

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Pydantic models for API
class MeasurementFrameworkSessionCreate(SQLModel):
    """Request model for creating a new session"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    name: str
    objectives_description: str = Field(min_length=50)
    okr_session_id: Optional[int] = None
    existing_data_sources: Optional[str] = None
    reporting_requirements: Optional[str] = None
    stakeholder_audience: Optional[str] = None
    knowledge_base_ids: Optional[List[int]] = None


class MeasurementFrameworkSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    name: str
    objectives_description: str
    okr_session_id: Optional[int]
    existing_data_sources: Optional[str]
    reporting_requirements: Optional[str]
    stakeholder_audience: Optional[str]
    status: str
    progress_message: Optional[str]
    error_message: Optional[str]
    executive_summary: Optional[str]
    framework_overview: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class FrameworkMetricResponse(SQLModel):
    """Response model for metric"""
    id: int
    session_id: int
    name: str
    description: str
    category: str
    metric_type: str
    data_type: str
    formula: Optional[str]
    unit: Optional[str]
    baseline: Optional[str]
    target: Optional[str]
    threshold_good: Optional[str]
    threshold_warning: Optional[str]
    threshold_critical: Optional[str]
    collection_method: str
    collection_frequency: str
    data_owner: Optional[str]
    data_source: Optional[str]
    visualization_type: Optional[str]
    dashboard_placement: Optional[str]
    display_order: int

    class Config:
        alias_generator = to_camel
        populate_by_name = True
