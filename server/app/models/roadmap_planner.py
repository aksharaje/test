"""
Roadmap Planner Models

Database models for the Roadmap Planner feature that transforms prioritized
backlog items into a sequenced, capacity-matched roadmap with Jira sync.
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

class RoadmapSession(SQLModel, table=True):
    """Main session for roadmap planning"""
    __tablename__ = "roadmap_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    project_id: Optional[int] = Field(default=None)  # Optional project grouping

    # Session configuration
    name: str = Field(default="Untitled Roadmap")
    description: Optional[str] = None

    # Input artifact IDs from multiple sources
    artifact_ids: List[int] = Field(default=[], sa_column=Column(JSON))  # Story Generator epics/features
    feasibility_ids: List[int] = Field(default=[], sa_column=Column(JSON))  # Feasibility Analysis sessions
    ideation_ids: List[int] = Field(default=[], sa_column=Column(JSON))  # Ideation ideas
    custom_items: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))  # Custom entries

    # Capacity configuration
    sprint_length_weeks: int = Field(default=2)
    team_velocity: int = Field(default=40)  # Story points per sprint per team
    team_count: int = Field(default=1)  # Number of teams working in parallel
    buffer_percentage: int = Field(default=20)  # Buffer for unplanned work
    start_date: Optional[datetime] = None  # Roadmap start date (defaults to now)

    # Processing state
    status: str = Field(default="draft")
    # statuses: draft, processing, sequencing, analyzing_dependencies, clustering_themes,
    #           matching_capacity, generating_milestones, completed, failed
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=5)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Summary counts
    total_items: int = Field(default=0)
    total_sprints: int = Field(default=0)
    total_themes: int = Field(default=0)
    total_milestones: int = Field(default=0)
    total_dependencies: int = Field(default=0)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class RoadmapItem(SQLModel, table=True):
    """Individual items in the roadmap (derived from stories)"""
    __tablename__ = "roadmap_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="roadmap_sessions.id")

    # Link to source - supports multiple source types
    source_artifact_id: Optional[int] = Field(default=None, foreign_key="generated_artifacts.id")
    source_type: str = Field(default="artifact")  # artifact, feasibility, ideation, custom

    # Item details
    title: str
    description: Optional[str] = None
    item_type: str = Field(default="story")  # epic, feature, story, task

    # Priority and effort
    priority: int = Field(default=3)  # 1 (highest) to 5 (lowest)
    effort_points: int = Field(default=3)  # Story points
    risk_level: str = Field(default="medium")  # low, medium, high
    value_score: Optional[int] = None  # Business value 1-10

    # Sequencing results
    sequence_order: int = Field(default=0)
    assigned_sprint: Optional[int] = None  # Sprint number (1-based)
    sprint_span: int = Field(default=1)  # Number of sprints this item spans (for oversized items)
    assigned_team: Optional[int] = None  # Team number (1-based), None if single team
    sprint_position: int = Field(default=0)  # Position within sprint

    # Theme assignment
    theme_id: Optional[int] = Field(default=None)

    # Status tracking
    status: str = Field(default="planned")  # planned, in_progress, completed, deferred

    # Jira sync
    jira_issue_key: Optional[str] = None
    jira_synced_at: Optional[datetime] = None

    # User adjustments
    is_manually_positioned: bool = Field(default=False)
    is_excluded: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RoadmapItemSegment(SQLModel, table=True):
    """
    Work segment representing a portion of a roadmap item.

    Allows splitting work across teams and sprints:
    - An item can have multiple segments
    - Each segment is assigned to a specific team for specific sprints
    - Enables team handoffs and parallel work on the same item
    """
    __tablename__ = "roadmap_item_segments"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="roadmap_items.id")

    # Team assignment
    assigned_team: int = Field(default=1)  # Team number (1-based)

    # Sprint range
    start_sprint: int = Field(default=1)  # Starting sprint number
    sprint_count: int = Field(default=1)  # Number of sprints this segment spans

    # Effort allocation
    effort_points: int = Field(default=0)  # Points allocated to this segment

    # Positioning
    sequence_order: int = Field(default=0)  # Order within the team's row (for stacking)
    row_index: int = Field(default=0)  # Row within the team lane (for overlapping segments)

    # Status
    status: str = Field(default="planned")  # planned, in_progress, completed
    is_manually_positioned: bool = Field(default=False)  # User adjusted this segment

    # Metadata
    label: Optional[str] = None  # Optional label for the segment (e.g., "Phase 1", "Backend")
    color_override: Optional[str] = None  # Override theme color for this segment

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RoadmapDependency(SQLModel, table=True):
    """Dependencies between roadmap items"""
    __tablename__ = "roadmap_dependencies"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="roadmap_sessions.id")

    # Dependency relationship
    from_item_id: int = Field(foreign_key="roadmap_items.id")
    to_item_id: Optional[int] = Field(default=None, foreign_key="roadmap_items.id")  # None = external prerequisite

    # Dependency type
    dependency_type: str = Field(default="blocks")
    # types: blocks, depends_on, related_to, enables

    # AI confidence and rationale
    confidence: float = Field(default=0.8)  # 0-1 AI confidence score
    rationale: Optional[str] = None  # Why this dependency was identified

    # Status
    is_manual: bool = Field(default=False)  # User-added vs AI-detected
    is_validated: bool = Field(default=False)  # User confirmed

    # Jira sync
    jira_link_id: Optional[str] = None
    jira_synced_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class RoadmapTheme(SQLModel, table=True):
    """Strategic themes grouping related items"""
    __tablename__ = "roadmap_themes"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="roadmap_sessions.id")

    # Theme details
    name: str
    description: Optional[str] = None
    color: str = Field(default="#3b82f6")  # Hex color for UI

    # Strategic context
    business_objective: Optional[str] = None
    success_metrics: List[str] = Field(default=[], sa_column=Column(JSON))

    # Effort summary
    total_effort_points: int = Field(default=0)
    total_items: int = Field(default=0)

    # Jira sync - themes become Epics
    jira_epic_key: Optional[str] = None
    jira_synced_at: Optional[datetime] = None

    # Display order
    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RoadmapMilestone(SQLModel, table=True):
    """Delivery milestones on the roadmap"""
    __tablename__ = "roadmap_milestones"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="roadmap_sessions.id")

    # Milestone details
    name: str
    description: Optional[str] = None

    # Timing
    target_sprint: Optional[int] = None  # Sprint number
    target_date: Optional[datetime] = None

    # Associated theme (optional)
    theme_id: Optional[int] = Field(default=None, foreign_key="roadmap_themes.id")

    # Status
    status: str = Field(default="planned")  # planned, on_track, at_risk, completed, missed

    # Completion criteria
    criteria: List[str] = Field(default=[], sa_column=Column(JSON))
    completion_percentage: int = Field(default=0)

    # Display
    color: str = Field(default="#10b981")  # Hex color
    icon: str = Field(default="flag")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JiraFieldMapping(SQLModel, table=True):
    """User-defined mappings between roadmap fields and Jira fields"""
    __tablename__ = "jira_field_mappings"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Mapping configuration
    roadmap_field: str  # e.g., "priority", "effort_points", "theme"
    jira_field_key: str  # e.g., "priority", "customfield_10001"
    jira_field_name: str  # Human-readable name
    is_custom_field: bool = Field(default=False)

    # Value mapping (for enums)
    value_mappings: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # e.g., {"1": "Highest", "2": "High", "3": "Medium"}

    # Status
    is_active: bool = Field(default=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JiraSyncLog(SQLModel, table=True):
    """Log of Jira sync operations"""
    __tablename__ = "jira_sync_logs"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="roadmap_sessions.id")

    # What was synced
    item_id: Optional[int] = Field(default=None, foreign_key="roadmap_items.id")
    theme_id: Optional[int] = Field(default=None, foreign_key="roadmap_themes.id")
    dependency_id: Optional[int] = Field(default=None, foreign_key="roadmap_dependencies.id")

    # Sync details
    sync_type: str  # create_issue, update_issue, create_link, create_epic
    jira_issue_key: Optional[str] = None
    jira_link_id: Optional[str] = None

    # Result
    sync_status: str = Field(default="pending")  # pending, success, failed
    error_message: Optional[str] = None
    response_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    synced_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Request/Response Models (Pydantic)
# ============================================================================

class CustomRoadmapItemInput(SQLModel):
    """Custom item to add to the roadmap"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: str
    description: Optional[str] = None
    effort_estimate: Optional[int] = None  # Story points


class RoadmapSessionCreate(SQLModel):
    """Create a new roadmap planning session"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    name: str = "Untitled Roadmap"
    description: Optional[str] = None

    # Multiple source inputs
    artifact_ids: List[int] = []  # IDs of epics/features from Story Generator
    feasibility_ids: List[int] = []  # IDs from completed Feasibility Analysis sessions
    ideation_ids: List[int] = []  # IDs of ideation ideas
    custom_items: List[CustomRoadmapItemInput] = []  # Custom items

    sprint_length_weeks: int = 2
    team_velocity: int = 40  # Story points per sprint per team
    team_count: int = 1  # Number of teams
    buffer_percentage: int = 20
    start_date: Optional[datetime] = None


class RoadmapItemUpdate(SQLModel):
    """Update a roadmap item"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    effort_points: Optional[int] = None
    risk_level: Optional[str] = None
    assigned_sprint: Optional[int] = None
    sprint_span: Optional[int] = None
    assigned_team: Optional[int] = None
    sprint_position: Optional[int] = None
    theme_id: Optional[int] = None
    status: Optional[str] = None
    is_excluded: Optional[bool] = None


class RoadmapDependencyCreate(SQLModel):
    """Create a manual dependency"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    from_item_id: int
    to_item_id: int
    dependency_type: str = "blocks"
    rationale: Optional[str] = None


class RoadmapMilestoneCreate(SQLModel):
    """Create a milestone"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    name: str
    description: Optional[str] = None
    target_sprint: Optional[int] = None
    target_date: Optional[datetime] = None
    theme_id: Optional[int] = None
    criteria: List[str] = []
    color: str = "#10b981"


class RoadmapMilestoneUpdate(SQLModel):
    """Update a milestone"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    name: Optional[str] = None
    description: Optional[str] = None
    target_sprint: Optional[int] = None
    target_date: Optional[datetime] = None
    theme_id: Optional[int] = None
    status: Optional[str] = None
    criteria: Optional[List[str]] = None
    color: Optional[str] = None


class RoadmapSegmentCreate(SQLModel):
    """Create a new segment for a roadmap item"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    item_id: int
    assigned_team: int = 1
    start_sprint: int = 1
    sprint_count: int = 1
    effort_points: int = 0
    row_index: int = 0
    label: Optional[str] = None
    color_override: Optional[str] = None


class RoadmapSegmentUpdate(SQLModel):
    """Update an existing segment"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    assigned_team: Optional[int] = None
    start_sprint: Optional[int] = None
    sprint_count: Optional[int] = None
    effort_points: Optional[int] = None
    row_index: Optional[int] = None
    sequence_order: Optional[int] = None
    status: Optional[str] = None
    is_manually_positioned: Optional[bool] = None
    label: Optional[str] = None
    color_override: Optional[str] = None


class RoadmapSegmentBulkUpdate(SQLModel):
    """Bulk update segments (for drag-and-drop operations)"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    segments: List[Dict[str, Any]]  # List of {id, ...updates}


class JiraFieldMappingCreate(SQLModel):
    """Create/update a field mapping"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    roadmap_field: str
    jira_field_key: str
    jira_field_name: str
    is_custom_field: bool = False
    value_mappings: Dict[str, Any] = {}


class JiraSyncRequest(SQLModel):
    """Request to sync roadmap to Jira"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    project_key: str
    create_epics_from_themes: bool = True
    link_dependencies: bool = True
    update_existing: bool = False  # Update if issue already exists


class RoadmapSessionResponse(SQLModel):
    """Full session response with all data"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    session: "RoadmapSession"
    items: List["RoadmapItem"] = []
    segments: List["RoadmapItemSegment"] = []  # Work segments for flexible team/sprint allocation
    dependencies: List["RoadmapDependency"] = []
    themes: List["RoadmapTheme"] = []
    milestones: List["RoadmapMilestone"] = []


class SprintSummary(SQLModel):
    """Summary of a sprint's contents"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    sprint_number: int
    total_points: int
    capacity: int
    utilization_percentage: float
    item_count: int
    items: List["RoadmapItem"] = []
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class DependencyGraphNode(SQLModel):
    """Node in the dependency graph"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: int
    title: str
    sprint: Optional[int]
    theme_id: Optional[int]
    theme_color: Optional[str]


class DependencyGraphEdge(SQLModel):
    """Edge in the dependency graph"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    from_id: int
    to_id: int
    dependency_type: str
    is_blocking: bool = False  # True if creates a sequencing constraint


class DependencyGraph(SQLModel):
    """Full dependency graph for visualization"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    nodes: List[DependencyGraphNode] = []
    edges: List[DependencyGraphEdge] = []
    has_cycles: bool = False
    cycle_items: List[int] = []  # Item IDs involved in cycles


class AvailableArtifactForRoadmap(SQLModel):
    """Epic or Feature available for selection from Story Generator"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: int
    title: str
    type: str  # epic, feature
    status: str
    created_at: datetime
    preview: str  # First 200 chars of content
    effort_estimate: Optional[int] = None  # Aggregated effort if available
    priority: Optional[int] = None
    child_count: int = 0  # Number of child stories/features


class AvailableFeasibilityForRoadmap(SQLModel):
    """Completed Feasibility Analysis available for selection"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: int
    feature_description: str
    title: str  # Derived from first 100 chars of feature_description
    go_no_go: Optional[str] = None  # go, no_go, conditional
    confidence: str = "medium"
    status: str
    created_at: datetime
    total_hours: Optional[float] = None  # Aggregated effort estimate from components
    total_weeks: Optional[float] = None  # From realistic timeline scenario


class AvailableIdeaForRoadmap(SQLModel):
    """Ideation idea available for selection"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: int
    title: str
    description: str
    category: str  # quick_wins, strategic_bets, incremental, moonshots
    effort_estimate: str  # low, medium, high
    impact_estimate: str  # low, medium, high
    composite_score: Optional[float] = None
    session_id: int
    created_at: datetime


class AllAvailableSourcesResponse(SQLModel):
    """Combined response with all available sources for roadmap planning"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    artifacts: List[AvailableArtifactForRoadmap] = []  # Epics/Features from Story Generator
    feasibility_analyses: List[AvailableFeasibilityForRoadmap] = []  # Completed feasibility analyses
    ideation_ideas: List[AvailableIdeaForRoadmap] = []  # Ideas from ideation sessions
