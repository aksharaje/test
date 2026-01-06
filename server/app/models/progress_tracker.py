"""
Progress & Blocker Tracker Models

Tracks sprint/iteration progress and detects blockers using multi-signal approach.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlmodel import SQLModel, Field, Column, JSON
from pydantic.alias_generators import to_camel


# =============================================================================
# CONFIGURATION TEMPLATES
# =============================================================================

TRACKER_TEMPLATES = {
    "jira_scrum": {
        "id": "jira_scrum",
        "name": "Jira Cloud - Standard Scrum",
        "description": "Standard Scrum workflow with sprints and story points",
        "provider": "jira",
        "status_categories": {
            "todo": ["To Do", "Open", "Backlog"],
            "in_progress": ["In Progress", "In Review", "In Development"],
            "done": ["Done", "Closed", "Resolved"]
        },
        "estimation_field": "story_points",
        "blocker_signals": {
            "explicit_flag": {"enabled": True, "weight": 1.0, "fields": ["flagged"]},
            "status_based": {"enabled": True, "weight": 0.95, "statuses": ["Blocked", "Impediment", "On Hold"]},
            "label_based": {"enabled": True, "weight": 0.9, "patterns": ["blocked", "impediment", "waiting"]},
            "link_analysis": {"enabled": True, "weight": 0.85, "link_types": ["is blocked by"]},
            "keyword_analysis": {"enabled": True, "weight": 0.7, "patterns": ["blocked by", "waiting on", "can't proceed"]},
            "velocity_anomaly": {"enabled": True, "weight": 0.6, "stale_days": 5}
        }
    },
    "jira_safe": {
        "id": "jira_safe",
        "name": "Jira Cloud - SAFe with PI Planning",
        "description": "SAFe framework with Program Increments and features",
        "provider": "jira",
        "status_categories": {
            "todo": ["To Do", "Funnel", "Analyzing"],
            "in_progress": ["In Progress", "Implementing", "In Review"],
            "done": ["Done", "Accepted", "Deployed"]
        },
        "estimation_field": "story_points",
        "blocker_signals": {
            "explicit_flag": {"enabled": True, "weight": 1.0, "fields": ["flagged"]},
            "status_based": {"enabled": True, "weight": 0.95, "statuses": ["Blocked", "Impediment", "Risk"]},
            "label_based": {"enabled": True, "weight": 0.9, "patterns": ["blocked", "risk", "dependency"]},
            "link_analysis": {"enabled": True, "weight": 0.85, "link_types": ["is blocked by", "depends on"]},
            "keyword_analysis": {"enabled": True, "weight": 0.7, "patterns": ["blocked by", "dependency", "waiting on"]},
            "velocity_anomaly": {"enabled": True, "weight": 0.6, "stale_days": 5}
        }
    },
    "ado_agile": {
        "id": "ado_agile",
        "name": "Azure DevOps - Agile Process",
        "description": "Agile process template with iterations and effort",
        "provider": "ado",
        "status_categories": {
            "todo": ["New", "Approved"],
            "in_progress": ["Active", "In Progress", "Committed"],
            "done": ["Done", "Closed", "Resolved", "Removed"]
        },
        "estimation_field": "story_points",
        "blocker_signals": {
            "explicit_flag": {"enabled": True, "weight": 1.0, "fields": ["System.Tags"]},
            "status_based": {"enabled": True, "weight": 0.95, "statuses": ["Blocked", "On Hold"]},
            "label_based": {"enabled": True, "weight": 0.9, "patterns": ["blocked", "impediment", "waiting"]},
            "link_analysis": {"enabled": True, "weight": 0.85, "link_types": ["System.LinkTypes.Dependency-Reverse"]},
            "keyword_analysis": {"enabled": True, "weight": 0.7, "patterns": ["blocked by", "waiting on", "dependency"]},
            "velocity_anomaly": {"enabled": True, "weight": 0.6, "stale_days": 5}
        }
    },
    "ado_cmmi": {
        "id": "ado_cmmi",
        "name": "Azure DevOps - CMMI Process",
        "description": "CMMI process template with size estimation",
        "provider": "ado",
        "status_categories": {
            "todo": ["Proposed", "Active"],
            "in_progress": ["In Progress", "In Review"],
            "done": ["Resolved", "Closed"]
        },
        "estimation_field": "story_points",
        "blocker_signals": {
            "explicit_flag": {"enabled": True, "weight": 1.0, "fields": ["System.Tags"]},
            "status_based": {"enabled": True, "weight": 0.95, "statuses": ["Blocked", "On Hold"]},
            "label_based": {"enabled": True, "weight": 0.9, "patterns": ["blocked", "impediment"]},
            "link_analysis": {"enabled": True, "weight": 0.85, "link_types": ["System.LinkTypes.Dependency-Reverse"]},
            "keyword_analysis": {"enabled": True, "weight": 0.7, "patterns": ["blocked", "waiting", "issue"]},
            "velocity_anomaly": {"enabled": True, "weight": 0.6, "stale_days": 7}
        }
    },
    "basic": {
        "id": "basic",
        "name": "Basic Item Tracking",
        "description": "Simple tracking when full data isn't available - uses item counts",
        "provider": "any",
        "status_categories": {
            "todo": ["To Do", "New", "Open", "Backlog", "Proposed"],
            "in_progress": ["In Progress", "Active", "In Review", "Committed"],
            "done": ["Done", "Closed", "Resolved", "Removed"]
        },
        "estimation_field": None,  # Falls back to item count
        "blocker_signals": {
            "status_based": {"enabled": True, "weight": 0.95, "statuses": ["Blocked", "On Hold", "Impediment"]},
            "label_based": {"enabled": True, "weight": 0.9, "patterns": ["blocked", "impediment", "waiting"]},
            "keyword_analysis": {"enabled": True, "weight": 0.7, "patterns": ["blocked", "waiting", "can't proceed"]},
            "velocity_anomaly": {"enabled": True, "weight": 0.6, "stale_days": 5}
        }
    }
}


# =============================================================================
# DATABASE MODELS
# =============================================================================

class ProgressTrackerSessionBase(SQLModel):
    """Base model for progress tracker sessions."""
    name: str = Field(default="Sprint Tracker")
    integration_id: int = Field(foreign_key="integrations.id", index=True)
    template_id: str = Field(default="basic")

    # Sprint/iteration filter
    sprint_filter: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Example: {"sprint_ids": ["Sprint 1", "Sprint 2"], "include_backlog": false}

    # Custom blocker detection config (overrides template)
    blocker_config: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    # Sync configuration
    sync_config: Dict[str, Any] = Field(
        default={"auto_sync": False, "sync_interval_hours": 24},
        sa_column=Column(JSON)
    )

    # Session state
    status: str = Field(default="draft")  # draft, syncing, ready, error
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=3)  # sync, analyze, compute
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Cached metrics (computed during sync)
    metrics_snapshot: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    # Sync tracking
    last_sync_at: Optional[datetime] = None
    items_synced: int = Field(default=0)
    blockers_detected: int = Field(default=0)


class ProgressTrackerSession(ProgressTrackerSessionBase, table=True):
    """Progress tracker session - tracks a specific sprint/iteration."""
    __tablename__ = "progress_tracker_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TrackedWorkItemBase(SQLModel):
    """Base model for tracked work items."""
    session_id: int = Field(foreign_key="progress_tracker_sessions.id", index=True)

    # External reference
    external_id: str = Field(index=True)  # e.g., "PROJ-123" or "12345"
    external_url: Optional[str] = None

    # Item metadata
    item_type: str  # story, bug, task, epic, feature, etc.
    title: str
    description: Optional[str] = None

    # Status tracking
    status: str
    status_category: str  # todo, in_progress, done

    # Assignment
    assignee: Optional[str] = None
    assignee_email: Optional[str] = None

    # Sprint/iteration
    sprint_name: Optional[str] = None
    sprint_id: Optional[str] = None

    # Estimation
    story_points: Optional[float] = None
    original_estimate: Optional[float] = None  # hours
    time_spent: Optional[float] = None  # hours

    # Priority
    priority: Optional[str] = None
    priority_order: Optional[int] = None  # numeric for sorting

    # Labels and components
    labels: List[str] = Field(default=[], sa_column=Column(JSON))
    components: List[str] = Field(default=[], sa_column=Column(JSON))

    # Parent/epic reference
    parent_id: Optional[str] = None
    parent_title: Optional[str] = None

    # Blocker detection results
    blocker_signals: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Example: {"status_based": 0.95, "label_based": 0.9}
    blocker_confidence: float = Field(default=0.0)  # 0-100
    is_blocked: bool = Field(default=False)
    blocker_reason: Optional[str] = None

    # Links to other items
    links: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    # Example: [{"type": "is blocked by", "target_id": "PROJ-456", "target_status": "In Progress"}]

    # Activity tracking
    last_updated_external: Optional[datetime] = None
    days_in_status: Optional[int] = None

    # Raw data for debugging
    raw_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))


class TrackedWorkItem(TrackedWorkItemBase, table=True):
    """Tracked work item - snapshot of an item from the integration."""
    __tablename__ = "tracked_work_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    synced_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class CreateSessionRequest(SQLModel):
    """Request to create a new tracker session."""
    name: str = Field(default="Sprint Tracker")
    integration_id: int
    template_id: str = Field(default="basic")
    sprint_filter: Dict[str, Any] = Field(default={})
    blocker_config: Optional[Dict[str, Any]] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class UpdateSessionRequest(SQLModel):
    """Request to update a tracker session."""
    name: Optional[str] = None
    template_id: Optional[str] = None
    sprint_filter: Optional[Dict[str, Any]] = None
    blocker_config: Optional[Dict[str, Any]] = None
    sync_config: Optional[Dict[str, Any]] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class SessionResponse(SQLModel):
    """Response containing session details."""
    id: int
    name: str
    integration_id: int
    integration_name: Optional[str] = None
    integration_provider: Optional[str] = None
    template_id: str
    sprint_filter: Dict[str, Any]
    blocker_config: Dict[str, Any]
    sync_config: Dict[str, Any]
    status: str
    progress_step: int
    progress_total: int
    progress_message: Optional[str]
    error_message: Optional[str]
    metrics_snapshot: Dict[str, Any]
    last_sync_at: Optional[datetime]
    items_synced: int
    blockers_detected: int
    created_at: datetime
    updated_at: datetime

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class MetricsResponse(SQLModel):
    """Response containing computed metrics."""
    session_id: int
    sprint_name: Optional[str] = None

    # Item counts
    total_items: int = 0
    items_todo: int = 0
    items_in_progress: int = 0
    items_done: int = 0

    # Points (if available)
    total_points: Optional[float] = None
    points_todo: Optional[float] = None
    points_in_progress: Optional[float] = None
    points_done: Optional[float] = None

    # Completion percentages
    completion_percentage_items: float = 0.0
    completion_percentage_points: Optional[float] = None

    # Blockers
    blocked_items: int = 0
    blocked_points: Optional[float] = None

    # By type breakdown
    by_type: Dict[str, Dict[str, int]] = {}
    # Example: {"story": {"todo": 5, "in_progress": 3, "done": 10}}

    # By assignee breakdown
    by_assignee: Dict[str, Dict[str, int]] = {}

    # Stale items (no updates in X days)
    stale_items: int = 0

    # Last sync info
    last_sync_at: Optional[datetime] = None
    data_freshness: str = "unknown"  # fresh, stale, very_stale

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class BlockerSummary(SQLModel):
    """Summary of a blocked item."""
    item_id: int
    external_id: str
    external_url: Optional[str]
    title: str
    item_type: str
    status: str
    assignee: Optional[str]
    story_points: Optional[float]
    blocker_confidence: float
    blocker_reason: Optional[str]
    blocker_signals: Dict[str, float]
    days_in_status: Optional[int]
    sprint_name: Optional[str]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class BlockersResponse(SQLModel):
    """Response containing blocker analysis."""
    session_id: int
    total_blockers: int
    high_confidence_blockers: int  # confidence >= 80
    medium_confidence_blockers: int  # confidence 50-79
    low_confidence_blockers: int  # confidence < 50
    blocked_points: Optional[float]
    blockers: List[BlockerSummary]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class SyncStatusResponse(SQLModel):
    """Response for sync status."""
    session_id: int
    status: str
    progress_step: int
    progress_total: int
    progress_message: Optional[str]
    error_message: Optional[str]
    items_synced: int
    last_sync_at: Optional[datetime]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class IntegrationCheckResponse(SQLModel):
    """Response for integration availability check."""
    has_valid_integration: bool
    integrations: List[Dict[str, Any]] = []
    message: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class SprintOption(SQLModel):
    """Available sprint/iteration for selection."""
    id: str
    name: str
    state: str  # active, closed, future
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class TemplateInfo(SQLModel):
    """Template information for selection."""
    id: str
    name: str
    description: str
    provider: str
    estimation_field: Optional[str]
    blocker_signals: List[str]

    class Config:
        alias_generator = to_camel
        populate_by_name = True
