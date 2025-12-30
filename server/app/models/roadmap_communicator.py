"""
Roadmap Communicator Models

Database models for the Roadmap Communicator feature that generates
audience-tailored roadmap presentations with narratives and talking points.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


# ============================================================================
# Database Models
# ============================================================================

class CommunicatorSession(SQLModel, table=True):
    """Main session for roadmap communication"""
    __tablename__ = "communicator_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Source (roadmap or scenario variant)
    roadmap_session_id: int = Field(foreign_key="roadmap_sessions.id")
    scenario_variant_id: Optional[int] = Field(default=None)  # Optional, if from scenario modeler

    # Session details
    name: str = Field(default="Untitled Presentation")
    description: Optional[str] = None

    # Source snapshot (frozen copy of roadmap at creation time)
    source_snapshot: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    # Processing state
    status: str = Field(default="draft")
    # statuses: draft, generating, completed, failed
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=5)  # analyze, generate view, narrative, talking points, format
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Summary counts
    total_presentations: int = Field(default=0)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class GeneratedPresentation(SQLModel, table=True):
    """A generated presentation for a specific audience"""
    __tablename__ = "generated_presentations"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="communicator_sessions.id")

    # Audience configuration
    audience_type: str  # executive, product_team, engineering, customer, board
    audience_name: str = Field(default="")  # Custom name if provided
    audience_profile: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Profile: {interests: [...], detail_level: "high|moderate|detailed", concerns: [...]}

    # Presentation strategy (from Audience Analyzer agent)
    presentation_strategy: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Strategy: {focus_areas, visualization_style, narrative_structure, key_messages}

    # Generated content (from View Generator agent)
    visualization_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Contains filtered/formatted roadmap data optimized for audience

    # Narrative (from Narrative Creator agent)
    narrative: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Contains: {opening, sections: [...], closing, trade_off_explanations}

    # Talking points (from Talking Points Generator agent)
    talking_points: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Contains: {key_messages: [...], supporting_points, anticipated_qa, metrics}

    # Formatting/export
    format: str = Field(default="markdown")  # markdown, html, json
    formatted_content: str = Field(default="")  # Final formatted content

    # Processing state
    status: str = Field(default="pending")
    # statuses: pending, generating, completed, failed
    error_message: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Request/Response Models (Pydantic)
# ============================================================================

class AudienceProfile(SQLModel):
    """Profile describing the target audience"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    interests: List[str] = []  # e.g., ["strategic alignment", "ROI", "delivery dates"]
    detail_level: str = "moderate"  # high_level, moderate, detailed
    concerns: List[str] = []  # e.g., ["risk", "cost", "timeline"]
    prior_context: str = "familiar"  # familiar, first_time_viewer
    custom_notes: Optional[str] = None


class PresentationConfig(SQLModel):
    """Configuration for generating a presentation"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    audience_type: str  # executive, product_team, engineering, customer, board
    audience_name: Optional[str] = None  # Custom name
    audience_profile: AudienceProfile = AudienceProfile()
    tone: str = "professional"  # professional, collaborative, inspirational
    emphasis_areas: List[str] = []  # Themes or milestones to highlight
    format: str = "markdown"  # markdown, html, json


class CommunicatorSessionCreate(SQLModel):
    """Create a new communicator session"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    roadmap_session_id: int
    scenario_variant_id: Optional[int] = None
    name: str = "Untitled Presentation"
    description: Optional[str] = None


class CommunicatorSessionResponse(SQLModel):
    """Full session response with all presentations"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    session: "CommunicatorSession"
    presentations: List["GeneratedPresentation"] = []


# Audience type configurations
AUDIENCE_CONFIGS = {
    "executive": {
        "name": "Executive",
        "description": "C-suite and VP-level stakeholders",
        "default_profile": {
            "interests": ["strategic alignment", "ROI", "milestones", "resource allocation"],
            "detail_level": "high_level",
            "concerns": ["risk", "cost", "competitive positioning"],
        },
        "visualization_style": "timeline_with_themes",
        "focus": "strategic themes, business value, major milestones"
    },
    "product_team": {
        "name": "Product Team",
        "description": "Product managers and designers",
        "default_profile": {
            "interests": ["feature priorities", "user value", "dependencies"],
            "detail_level": "moderate",
            "concerns": ["scope", "timeline", "quality"],
        },
        "visualization_style": "now_next_later",
        "focus": "feature breakdown, priorities, dependencies"
    },
    "engineering": {
        "name": "Engineering Team",
        "description": "Development leads and engineers",
        "default_profile": {
            "interests": ["technical dependencies", "capacity", "sprint planning"],
            "detail_level": "detailed",
            "concerns": ["technical debt", "velocity", "blocking dependencies"],
        },
        "visualization_style": "swimlane_by_team",
        "focus": "technical details, dependencies, capacity utilization"
    },
    "customer": {
        "name": "Customer",
        "description": "External customers and partners",
        "default_profile": {
            "interests": ["new features", "delivery dates", "benefits"],
            "detail_level": "moderate",
            "concerns": ["value delivery", "timeline commitments"],
        },
        "visualization_style": "feature_timeline",
        "focus": "customer-facing features, delivery dates, benefits"
    },
    "board": {
        "name": "Board/Investors",
        "description": "Board members and investors",
        "default_profile": {
            "interests": ["strategic alignment", "business metrics", "growth"],
            "detail_level": "high_level",
            "concerns": ["ROI", "market opportunity", "resource efficiency"],
        },
        "visualization_style": "milestone_focused",
        "focus": "strategic milestones, business impact, investment return"
    }
}
