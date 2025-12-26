"""
Journey & Pain Point Mapper Models

Database models for the Journey Mapper feature in the Customer Experience section.
Stores journey maps, stages, pain points, personas, and version history.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class JourneyMapSession(SQLModel, table=True):
    """Main journey map entity with versioning support"""
    __tablename__ = "journey_map_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Mode: standard, multi_persona, competitive
    mode: str = Field(default="standard")

    # Journey description/context
    journey_description: str = Field(min_length=5)
    competitor_name: Optional[str] = None  # For competitive mode

    # Version control
    version: str = Field(default="1.0")  # e.g., "1.0", "2.1", "3.0"
    parent_version_id: Optional[int] = Field(default=None, foreign_key="journey_map_sessions.id")

    # Data sources
    file_metadata: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{filename: str, content_type: str, size: int, content_preview: str}]
    knowledge_base_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))

    # Processing state
    status: str = Field(default="pending")
    # statuses: pending, processing, completed, failed
    progress_step: int = Field(default=0)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Generated journey structure (embedded for performance)
    stages: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # stages schema: [{id: str, name: str, description: str, order: int, duration_estimate: str, touchpoints: [{id, name, description, channel}], emotion_score: float}]

    emotion_curve: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{stage_id: str, score: float, label: str}]

    # Confidence and quality indicators
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    data_quality_warning: Optional[str] = None  # e.g., "Limited data detected"

    # Raw LLM response for debugging
    raw_llm_response: Optional[str] = None

    # Delta analysis (for version updates)
    delta_summary: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {improved: int, worsened: int, new: int, resolved: int, stage_changes: [...]}

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class JourneyPainPoint(SQLModel, table=True):
    """Pain points identified in journey maps - separate table for querying and evidence linking"""
    __tablename__ = "journey_pain_points"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    journey_map_id: int = Field(foreign_key="journey_map_sessions.id")
    stage_id: str  # References stage.id in the JSON structure

    # Pain point details
    description: str
    severity: float = Field(default=5.0, ge=0.0, le=10.0)
    frequency: int = Field(default=1)  # Number of mentions in source data

    # Evidence linking
    data_sources: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{source_type: "transcript"|"ticket"|"analytics", source_id: str, excerpt: str, location: str}]

    # Multi-persona support
    persona_id: Optional[int] = Field(default=None, foreign_key="journey_personas.id")

    # Version tracking for delta analysis
    delta_status: Optional[str] = None  # improved, worsened, new, resolved, unchanged
    previous_severity: Optional[float] = None  # For comparison

    # User edits
    is_user_edited: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JourneyPersona(SQLModel, table=True):
    """Personas for multi-persona journey mapping"""
    __tablename__ = "journey_personas"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    journey_map_id: int = Field(foreign_key="journey_map_sessions.id")

    name: str
    description: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {role: str, company_size: str, experience_level: str, goals: [str], pain_points: [str]}

    # Color coding for UI
    color: Optional[str] = None  # e.g., "#3B82F6"

    # Source from prior research
    source_persona_id: Optional[int] = None  # Reference to existing persona if imported

    created_at: datetime = Field(default_factory=datetime.utcnow)


class JourneyDivergencePoint(SQLModel, table=True):
    """Divergence points where personas differ significantly (multi-persona mode)"""
    __tablename__ = "journey_divergence_points"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    journey_map_id: int = Field(foreign_key="journey_map_sessions.id")
    stage_id: str

    # Divergence details
    description: str
    divergence_score: float = Field(default=5.0, ge=0.0, le=10.0)

    # Which personas diverge
    persona_differences: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{persona_id: int, experience: str, pain_severity: float}]

    # Dependencies between personas
    dependency_description: Optional[str] = None  # e.g., "End User blocked by Admin actions"
    blocking_persona_id: Optional[int] = Field(default=None, foreign_key="journey_personas.id")
    blocked_persona_id: Optional[int] = Field(default=None, foreign_key="journey_personas.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class CompetitorJourneyObservation(SQLModel, table=True):
    """User observations during competitive journey walkthrough"""
    __tablename__ = "competitor_journey_observations"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    journey_map_id: int = Field(foreign_key="journey_map_sessions.id")
    stage_order: int  # Which step in the walkthrough

    # Observation data
    stage_name: str
    touchpoints_observed: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    time_taken: Optional[str] = None  # e.g., "5 minutes"
    friction_points: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    strengths_observed: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = None

    # Screenshot reference (stored as metadata, actual file in S3/local)
    screenshot_url: Optional[str] = None

    # Comparison to own journey (if exists)
    comparison_status: Optional[str] = None  # better, worse, similar
    comparison_notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
