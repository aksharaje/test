"""
Release Prep Agent Models

Database models for the Release Prep feature that generates release artifacts
from user stories: Release Notes, Decision Log, and Technical Debt Inventory.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class ReleasePrepSession(SQLModel, table=True):
    """Main session for release preparation artifact generation"""
    __tablename__ = "release_prep_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Session configuration
    release_name: str = Field(default="Untitled Release")

    # Input story IDs (from Story Generator)
    story_artifact_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    # Manual stories added by user
    manual_stories: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    # schema: [{title: str, content: str, type: 'epic'|'feature'|'user_story'}]

    # Knowledge bases for context (optional)
    knowledge_base_ids: List[int] = Field(default=[], sa_column=Column(JSON))

    # Processing state
    status: str = Field(default="draft")
    # statuses: draft, processing, extracting, generating_notes, generating_decisions,
    #           generating_debt, validating, completed, failed
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=6)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Quality validation scores
    release_notes_completeness: Optional[float] = None  # 0-100
    release_notes_clarity: Optional[float] = None  # 0-100
    decision_log_completeness: Optional[float] = None  # 0-100
    debt_inventory_completeness: Optional[float] = None  # 0-100

    # Summary counts
    total_stories_processed: int = Field(default=0)
    total_release_notes: int = Field(default=0)
    total_decisions: int = Field(default=0)
    total_debt_items: int = Field(default=0)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class ReleaseStory(SQLModel, table=True):
    """Stories included in a release prep session"""
    __tablename__ = "release_stories"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="release_prep_sessions.id")

    # Link to Story Generator artifact (null if manually entered)
    artifact_id: Optional[int] = Field(default=None, foreign_key="generated_artifacts.id")

    # Story details (cached from artifact or manually entered)
    title: str
    story_type: str = Field(default="user_story")  # epic, feature, user_story
    content: str  # Full story content/structured JSON
    is_manual: bool = Field(default=False)

    # Extracted metadata for processing
    acceptance_criteria: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    # schema: [{scenario: str, given: str, when: str, then: str}]

    # Processing status
    processed: bool = Field(default=False)
    extraction_notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReleaseNote(SQLModel, table=True):
    """Generated release note items"""
    __tablename__ = "release_notes"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="release_prep_sessions.id")

    # Note details
    title: str
    description: str
    category: str = Field(default="feature")
    # categories: feature, improvement, fix, security, performance, breaking_change

    # User-facing impact
    user_impact: Optional[str] = None  # Brief description of user benefit
    audience: str = Field(default="all")  # all, admin, developer, enterprise

    # Source tracking
    source_story_ids: List[int] = Field(default=[], sa_column=Column(JSON))

    # Display order and formatting
    display_order: int = Field(default=0)
    is_highlighted: bool = Field(default=False)  # For major features

    # User edits
    is_user_edited: bool = Field(default=False)
    is_excluded: bool = Field(default=False)  # User removed from output

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Decision(SQLModel, table=True):
    """Extracted technical/product decisions from stories"""
    __tablename__ = "release_decisions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="release_prep_sessions.id")

    # Decision details
    title: str
    description: str
    decision_type: str = Field(default="technical")
    # types: technical, architectural, product, process, security

    # Context and rationale
    context: Optional[str] = None  # What situation led to this decision
    rationale: Optional[str] = None  # Why this choice was made
    alternatives_considered: List[str] = Field(default=[], sa_column=Column(JSON))

    # Impact assessment
    impact_level: str = Field(default="medium")  # low, medium, high, critical
    impact_areas: List[str] = Field(default=[], sa_column=Column(JSON))
    # areas: performance, scalability, security, maintainability, user_experience, cost

    consequences: Optional[str] = None  # What follows from this decision
    reversibility: str = Field(default="reversible")  # reversible, partially, irreversible

    # Source tracking
    source_story_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    related_decision_ids: List[int] = Field(default=[], sa_column=Column(JSON))

    # Status
    status: str = Field(default="documented")  # documented, needs_review, approved
    reviewer_notes: Optional[str] = None

    # User edits
    is_user_edited: bool = Field(default=False)
    is_excluded: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TechnicalDebtItem(SQLModel, table=True):
    """Technical debt inventory items extracted from stories"""
    __tablename__ = "technical_debt_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="release_prep_sessions.id")

    # Debt details
    title: str
    description: str
    debt_type: str = Field(default="code")
    # types: code, design, architecture, testing, documentation, infrastructure

    # Location and scope
    affected_area: Optional[str] = None  # e.g., "Authentication module"
    affected_files: List[str] = Field(default=[], sa_column=Column(JSON))

    # Impact assessment
    impact_level: str = Field(default="medium")  # low, medium, high, critical
    risk_if_unaddressed: Optional[str] = None

    # Effort estimation
    effort_estimate: Optional[str] = None  # e.g., "2-3 days", "1 sprint"
    effort_days: Optional[int] = None  # Numeric estimate

    # Tracking
    status: str = Field(default="identified")
    # statuses: identified, acknowledged, planned, in_progress, resolved, wont_fix

    introduced_in_release: Optional[str] = None  # e.g., "v2.4.0"
    resolved_in_release: Optional[str] = None
    target_resolution: Optional[str] = None  # e.g., "Q2 2025"

    # Source tracking
    source_story_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    related_debt_ids: List[int] = Field(default=[], sa_column=Column(JSON))

    # User edits
    is_user_edited: bool = Field(default=False)
    is_user_added: bool = Field(default=False)  # Manually added by user
    is_excluded: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Request/Response Models (Pydantic)
# ============================================================================

class ReleasePrepSessionCreate(SQLModel):
    """Create a new release prep session"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    release_name: str = "Untitled Release"
    story_artifact_ids: List[int] = []
    manual_stories: List[Dict[str, Any]] = []
    knowledge_base_ids: List[int] = []


class ManualStoryInput(SQLModel):
    """Manual story input from user"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: str
    content: str
    story_type: str = "user_story"


class ReleaseNoteUpdate(SQLModel):
    """Update a release note"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    user_impact: Optional[str] = None
    audience: Optional[str] = None
    is_highlighted: Optional[bool] = None
    is_excluded: Optional[bool] = None


class DecisionUpdate(SQLModel):
    """Update a decision"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: Optional[str] = None
    description: Optional[str] = None
    decision_type: Optional[str] = None
    context: Optional[str] = None
    rationale: Optional[str] = None
    alternatives_considered: Optional[List[str]] = None
    impact_level: Optional[str] = None
    impact_areas: Optional[List[str]] = None
    consequences: Optional[str] = None
    status: Optional[str] = None
    is_excluded: Optional[bool] = None


class TechnicalDebtItemUpdate(SQLModel):
    """Update a technical debt item"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: Optional[str] = None
    description: Optional[str] = None
    debt_type: Optional[str] = None
    affected_area: Optional[str] = None
    impact_level: Optional[str] = None
    risk_if_unaddressed: Optional[str] = None
    effort_estimate: Optional[str] = None
    effort_days: Optional[int] = None
    status: Optional[str] = None
    target_resolution: Optional[str] = None
    is_excluded: Optional[bool] = None


class TechnicalDebtItemCreate(SQLModel):
    """Create a new technical debt item manually"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: str
    description: str
    debt_type: str = "code"
    affected_area: Optional[str] = None
    impact_level: str = "medium"
    risk_if_unaddressed: Optional[str] = None
    effort_estimate: Optional[str] = None
    effort_days: Optional[int] = None
    target_resolution: Optional[str] = None


class ReleasePrepSessionResponse(SQLModel):
    """Full session response with all artifacts"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    session: "ReleasePrepSession"
    stories: List["ReleaseStory"] = []
    release_notes: List["ReleaseNote"] = []
    decisions: List["Decision"] = []
    debt_items: List["TechnicalDebtItem"] = []


class AvailableStory(SQLModel):
    """Story available for selection from Story Generator, Epic Creator, or Feature Creator"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: int
    title: str
    type: str  # epic, feature, or user_story
    status: str
    created_at: datetime
    preview: str  # First 200 chars of content
    story_count: int = 0  # Number of user stories contained
    feature_count: int = 0  # Number of features (for epics)
