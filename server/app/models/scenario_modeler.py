"""
Scenario Modeler Models

Database models for the Scenario Modeler feature that enables "what-if"
analysis by generating and comparing roadmap scenario variations.
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

class ScenarioSession(SQLModel, table=True):
    """Main session for scenario modeling"""
    __tablename__ = "scenario_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Link to source roadmap
    roadmap_session_id: int = Field(foreign_key="roadmap_sessions.id")

    # Session details
    name: str = Field(default="Untitled Scenario Analysis")
    description: Optional[str] = None

    # Baseline snapshot (frozen copy of roadmap at creation time)
    baseline_snapshot: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

    # Processing state
    status: str = Field(default="draft")
    # statuses: draft, generating, comparing, completed, failed
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=4)  # generate variants, impact, risk, visualize
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Summary counts
    total_variants: int = Field(default=0)
    viable_variants: int = Field(default=0)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class ScenarioVariant(SQLModel, table=True):
    """A scenario variant with modified variables"""
    __tablename__ = "scenario_variants"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scenario_sessions.id")

    # Variant identification
    name: str = Field(default="Scenario")
    description: Optional[str] = None
    is_baseline: bool = Field(default=False)  # True for the original baseline

    # Variable changes applied to this variant
    variable_changes: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    # Each change: {type: "capacity|priority|timeline|scope", target: ..., value: ...}

    # Generated roadmap (reoptimized based on changes)
    generated_roadmap: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Contains: items, sprints, themes, milestones with modified assignments

    # Impact analysis vs baseline
    impact_summary: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    # Contains: items_accelerated, items_deferred, timeline_delta, capacity_delta, etc.

    # Risk assessment
    risk_score: int = Field(default=0)  # 0-100, higher = riskier
    risk_factors: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    # Each factor: {type: "dependency|capacity|timeline|theme", severity: ..., description: ...}

    # Trade-off analysis
    trade_offs: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    # Each trade-off: {gain: ..., cost: ..., description: ...}

    # Viability
    is_viable: bool = Field(default=True)  # False if constraints cannot be satisfied
    non_viable_reason: Optional[str] = None

    # Processing state
    status: str = Field(default="pending")
    # statuses: pending, generating, analyzing, completed, failed

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Request/Response Models (Pydantic)
# ============================================================================

class VariableChange(SQLModel):
    """A single variable change for scenario generation"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    change_type: str  # capacity, priority, timeline, scope
    target: str  # What to change (e.g., "team_capacity", "item_123", "theme_security")
    target_id: Optional[int] = None  # Optional ID if targeting specific entity
    value: Any  # The new value or delta (e.g., "+25%", 90, "-2 sprints")
    description: Optional[str] = None  # Human-readable description


class ScenarioSessionCreate(SQLModel):
    """Create a new scenario modeling session"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    roadmap_session_id: int
    name: str = "Untitled Scenario Analysis"
    description: Optional[str] = None


class ScenarioVariantCreate(SQLModel):
    """Create a new scenario variant"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    name: str = "Scenario"
    description: Optional[str] = None
    variable_changes: List[VariableChange] = []


class ScenarioVariantUpdate(SQLModel):
    """Update a scenario variant"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    name: Optional[str] = None
    description: Optional[str] = None
    variable_changes: Optional[List[VariableChange]] = None


class ScenarioComparisonReport(SQLModel):
    """Comparison report across all variants"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    session_id: int
    baseline_variant_id: int
    variants: List["ScenarioVariant"] = []

    # Comparison metrics
    timeline_comparison: Dict[str, Any] = {}  # {variant_id: {total_sprints, delta_from_baseline}}
    capacity_comparison: Dict[str, Any] = {}  # {variant_id: {avg_utilization, over_capacity_sprints}}
    risk_comparison: Dict[str, Any] = {}  # {variant_id: {risk_score, top_risks}}
    theme_comparison: Dict[str, Any] = {}  # {variant_id: {theme_distribution}}

    # Trade-off matrix
    trade_off_matrix: List[Dict[str, Any]] = []
    # [{variant_id, gains: [...], costs: [...]}]

    # Recommendations
    recommendations: List[str] = []


class ScenarioSessionResponse(SQLModel):
    """Full session response with all variants"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    session: "ScenarioSession"
    variants: List["ScenarioVariant"] = []
    comparison: Optional["ScenarioComparisonReport"] = None


# Scenario template definitions
SCENARIO_TEMPLATES = {
    "add_team_member": {
        "name": "Add Team Member",
        "description": "Increase team capacity by adding a new engineer",
        "variable_changes": [
            {"change_type": "capacity", "target": "team_capacity", "value": "+20%"}
        ]
    },
    "remove_team_member": {
        "name": "Remove Team Member",
        "description": "Decrease team capacity by losing an engineer",
        "variable_changes": [
            {"change_type": "capacity", "target": "team_capacity", "value": "-20%"}
        ]
    },
    "accelerate_theme": {
        "name": "Accelerate Theme",
        "description": "Re-prioritize a theme to be delivered earlier",
        "variable_changes": [
            {"change_type": "priority", "target": "theme", "value": 90}
        ]
    },
    "defer_non_critical": {
        "name": "Defer Non-Critical",
        "description": "Push low-priority items beyond planning horizon",
        "variable_changes": [
            {"change_type": "scope", "target": "low_priority_items", "value": "defer"}
        ]
    },
    "compress_timeline": {
        "name": "Compress Timeline",
        "description": "Reduce the roadmap timeline by 20%",
        "variable_changes": [
            {"change_type": "timeline", "target": "total_sprints", "value": "-20%"}
        ]
    }
}
