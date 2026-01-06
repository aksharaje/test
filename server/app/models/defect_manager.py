"""
Defect Manager Models

Adaptive defect triage, pattern analysis, and prevention recommendations.
Uses multi-level configuration discovery to work with varying data availability.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlmodel import SQLModel, Field, Column, JSON
from enum import Enum
from pydantic.alias_generators import to_camel


# =============================================================================
# CONFIGURATION TEMPLATES
# =============================================================================

# Defect identification strategies by confidence level
DEFECT_IDENTIFICATION_STRATEGIES = {
    "work_item_type": {
        "method": "workItemType",
        "values": ["Bug", "Defect", "Issue", "Incident"],
        "confidence": 0.95
    },
    "issue_type": {
        "method": "issueType",
        "values": ["Bug"],
        "confidence": 0.9
    },
    "label_based": {
        "method": "label",
        "values": ["bug", "defect", "production-issue"],
        "confidence": 0.7
    },
    "keyword_based": {
        "method": "keyword",
        "search_in": ["title"],
        "patterns": ["^BUG:", "^DEFECT:", "[BUG]"],
        "confidence": 0.6
    }
}

# Severity normalization mapping
SEVERITY_NORMALIZATION = {
    "critical": ["Critical", "P0", "Sev 1", "Blocker", "1", "Highest", "Urgent"],
    "high": ["High", "P1", "Sev 2", "Major", "2"],
    "medium": ["Medium", "P2", "Sev 3", "Normal", "3"],
    "low": ["Low", "P3", "Sev 4", "Minor", "4", "Lowest", "Trivial"]
}

# Candidate fields for auto-detection
SEVERITY_CANDIDATE_FIELDS = ["severity", "priority", "impact", "customfield_10XXX"]
ROOT_CAUSE_CANDIDATE_FIELDS = ["Root Cause", "RCA", "customfield_cause", "rootCause"]
COMPONENT_CANDIDATE_FIELDS = ["Component", "Area", "Module", "components"]


# =============================================================================
# DATABASE MODELS
# =============================================================================


class DefectManagerSession(SQLModel, table=True):
    """Tracks a defect analysis session."""
    __tablename__ = "defect_manager_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    name: str = Field(default="Defect Analysis")
    integration_id: int = Field(index=True)

    # Configuration discovered/set
    detection_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    severity_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    category_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Scope filters
    project_filter: Optional[str] = Field(default=None)
    date_range_start: Optional[datetime] = Field(default=None)
    date_range_end: Optional[datetime] = Field(default=None)

    # Data availability level (1=basic, 2=severity, 3=root cause)
    data_level: int = Field(default=1)

    # Processing status
    status: str = Field(default="draft")  # draft, analyzing, ready, error
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=5)
    progress_message: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)

    # Analysis results (cached)
    analysis_snapshot: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    last_analysis_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AnalyzedDefect(SQLModel, table=True):
    """Individual defect with normalized data and analysis."""
    __tablename__ = "analyzed_defects"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(index=True)

    # External reference
    external_id: str = Field(index=True)
    external_url: Optional[str] = Field(default=None)

    # Basic info
    title: str
    description: Optional[str] = Field(default=None)
    item_type: str  # Bug, Defect, Issue, etc.
    status: str
    status_category: str  # open, in_progress, resolved

    # Normalized severity (critical, high, medium, low)
    severity: str = Field(default="medium")
    severity_source: str = Field(default="inferred")  # explicit, inferred
    severity_confidence: float = Field(default=0.5)

    # Priority (separate from severity)
    priority: Optional[str] = Field(default=None)
    priority_order: Optional[int] = Field(default=None)

    # Context
    component: Optional[str] = Field(default=None)
    assignee: Optional[str] = Field(default=None)
    reporter: Optional[str] = Field(default=None)
    labels: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    affected_version: Optional[str] = Field(default=None)
    fix_version: Optional[str] = Field(default=None)
    environment: Optional[str] = Field(default=None)

    # Root cause (if available)
    root_cause: Optional[str] = Field(default=None)
    root_cause_category: Optional[str] = Field(default=None)  # code-quality, data-issue, integration, etc.

    # Analysis results
    duplicate_of: Optional[str] = Field(default=None)  # External ID of potential duplicate
    duplicate_confidence: float = Field(default=0.0)
    pattern_group: Optional[str] = Field(default=None)  # Assigned pattern group

    # Recommendations
    suggested_priority: Optional[int] = Field(default=None)
    priority_reasoning: Optional[str] = Field(default=None)

    # Timestamps
    created_external: Optional[datetime] = Field(default=None)
    updated_external: Optional[datetime] = Field(default=None)
    resolved_at: Optional[datetime] = Field(default=None)
    days_open: Optional[int] = Field(default=None)

    synced_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================


class CreateDefectSessionRequest(SQLModel):
    """Request to create a defect analysis session."""
    name: Optional[str] = "Defect Analysis"
    integration_id: int
    project_filter: Optional[str] = None
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None
    detection_config: Optional[Dict[str, Any]] = None
    severity_config: Optional[Dict[str, Any]] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class DefectSessionResponse(SQLModel):
    """Response containing session details."""
    id: int
    name: str
    integration_id: int
    integration_name: Optional[str] = None
    integration_provider: Optional[str] = None
    data_level: int
    data_level_description: str
    status: str
    progress_step: int
    progress_total: int
    progress_message: Optional[str]
    error_message: Optional[str]
    analysis_snapshot: Dict[str, Any]
    last_analysis_at: Optional[datetime]
    created_at: datetime

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class DefectSummary(SQLModel):
    """Summary of a single defect."""
    id: int
    external_id: str
    external_url: Optional[str]
    title: str
    item_type: str
    status: str
    severity: str
    severity_confidence: float
    component: Optional[str]
    assignee: Optional[str]
    days_open: Optional[int]
    duplicate_of: Optional[str]
    duplicate_confidence: float
    pattern_group: Optional[str]
    suggested_priority: Optional[int]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class TriageResult(SQLModel):
    """Result of defect triage analysis."""
    session_id: int
    total_defects: int
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    by_component: Dict[str, int]
    potential_duplicates: int
    aging_defects: int  # Open > 30 days
    critical_open: int
    defects: List[DefectSummary]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class PatternAnalysis(SQLModel):
    """Pattern analysis results."""
    session_id: int
    patterns: List[Dict[str, Any]]  # Grouped patterns with counts
    trends: Dict[str, Any]  # Volume trends over time
    hot_spots: List[Dict[str, Any]]  # High-defect areas
    recommendations: List[str]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class DuplicateGroup(SQLModel):
    """Group of potential duplicate defects."""
    primary_id: str
    primary_title: str
    duplicates: List[Dict[str, Any]]
    confidence: float
    reason: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class PreventionRecommendation(SQLModel):
    """Prevention recommendation based on analysis."""
    category: str  # process, testing, code-quality, etc.
    recommendation: str
    supporting_data: Dict[str, Any]
    priority: str  # high, medium, low
    affected_area: Optional[str]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


# =============================================================================
# ANALYSIS STATUS RESPONSE
# =============================================================================


class AnalysisStatusResponse(SQLModel):
    """Status of defect analysis."""
    session_id: int
    status: str
    progress_step: int
    progress_total: int
    progress_message: Optional[str]
    error_message: Optional[str]
    defects_analyzed: int
    last_analysis_at: Optional[datetime]

    class Config:
        alias_generator = to_camel
        populate_by_name = True
