"""
Release Readiness Checker Models

Adaptive release assessment with weighted scoring based on available data.
Works with varying levels of integration depth.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlmodel import SQLModel, Field, Column, JSON
from enum import Enum


# =============================================================================
# SCORING CONFIGURATION
# =============================================================================

# Default scoring weights (adjusted based on data availability)
DEFAULT_SCORING_WEIGHTS = {
    "defect_status": {
        "weight": 0.35,
        "required": True,
        "scoring": {
            "no_critical_bugs": 30,
            "no_high_bugs": 20,
            "total_bugs_under_5": 15,
            "defect_trend_decreasing": 10
        }
    },
    "work_completion": {
        "weight": 0.25,
        "required": True,
        "scoring": {
            "all_stories_done": 25,
            "no_in_progress": 15,
            "scope_stable": 10  # No changes in 3 days
        }
    },
    "test_coverage": {
        "weight": 0.20,
        "required": False,
        "fallback": "Use AC coverage at 50% weight",
        "scoring": {
            "all_tests_passed": 20,
            "coverage_above_80": 15,
            "no_blocked_tests": 5
        }
    },
    "acceptance_criteria": {
        "weight": 0.15,
        "required": False,
        "fallback": "Reduce total score, note limitation",
        "scoring": {
            "all_stories_have_ac": 15,
            "ac_reviewed": 10,
            "ac_met": 20
        }
    },
    "beta_feedback": {
        "weight": 0.05,
        "required": False,
        "fallback": "Skip component",
        "scoring": {
            "no_open_critical": 5,
            "positive_sentiment": 3
        }
    }
}

# Release identification methods by provider
RELEASE_IDENTIFICATION = {
    "jira": {
        "methods": ["fixVersion", "label", "custom_field"],
        "defect_query_template": "project = {project} AND type = Bug AND fixVersion = '{version}'",
        "work_query_template": "project = {project} AND fixVersion = '{version}'"
    },
    "ado": {
        "methods": ["iteration", "tag", "custom_field"],
        "defect_query_template": "[System.WorkItemType] = 'Bug' AND [System.IterationPath] = '{iteration}'",
        "work_query_template": "[System.IterationPath] = '{iteration}'"
    }
}

# Acceptance criteria locations
AC_LOCATIONS = {
    "jira": {
        "dedicated_field": ["customfield_10XXX", "Acceptance Criteria"],
        "description_parse": ["### Acceptance Criteria", "**Acceptance Criteria**", "AC:"],
        "linked_tests": True
    },
    "ado": {
        "dedicated_field": ["Microsoft.VSTS.Common.AcceptanceCriteria"],
        "description_parse": ["## Acceptance Criteria", "**AC:**"],
        "linked_tests": True
    }
}


# =============================================================================
# DATABASE MODELS
# =============================================================================


class ReleaseReadinessSession(SQLModel, table=True):
    """Tracks a release readiness assessment session."""
    __tablename__ = "release_readiness_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    name: str = Field(default="Release Assessment")
    integration_id: int = Field(index=True)

    # Release scope
    release_identifier: str  # Version name, iteration path, etc.
    release_type: str = Field(default="fixVersion")  # fixVersion, iteration, label, custom
    project_key: Optional[str] = Field(default=None)

    # Configuration discovered/set
    data_sources: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    scoring_weights: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    ac_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Processing status
    status: str = Field(default="draft")  # draft, analyzing, ready, error
    progress_step: int = Field(default=0)
    progress_total: int = Field(default=6)
    progress_message: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)

    # Assessment results (cached)
    readiness_score: Optional[int] = Field(default=None)  # 0-100
    max_possible_score: int = Field(default=100)  # Adjusted based on available data
    confidence_level: str = Field(default="unknown")  # high, moderate, low, unknown
    recommendation: str = Field(default="pending")  # go, no_go, conditional_go, pending
    recommendation_details: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Component scores
    component_scores: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    target_release_date: Optional[datetime] = Field(default=None)
    last_assessment_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReleaseWorkItem(SQLModel, table=True):
    """Work item included in a release."""
    __tablename__ = "release_work_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(index=True)

    # External reference
    external_id: str = Field(index=True)
    external_url: Optional[str] = Field(default=None)

    # Basic info
    title: str
    item_type: str  # Story, Bug, Task, Feature
    status: str
    status_category: str  # todo, in_progress, done

    # Defect-specific (if Bug)
    severity: Optional[str] = Field(default=None)
    is_blocking: bool = Field(default=False)

    # Acceptance criteria
    has_ac: bool = Field(default=False)
    ac_source: Optional[str] = Field(default=None)  # field, description, linked_tests
    ac_count: int = Field(default=0)
    ac_verified: bool = Field(default=False)

    # Test coverage (if available)
    linked_tests: int = Field(default=0)
    tests_passed: int = Field(default=0)
    tests_failed: int = Field(default=0)
    test_coverage_percent: Optional[float] = Field(default=None)

    # Context
    assignee: Optional[str] = Field(default=None)
    story_points: Optional[float] = Field(default=None)
    component: Optional[str] = Field(default=None)

    # Timestamps
    created_at: Optional[datetime] = Field(default=None)
    updated_at: Optional[datetime] = Field(default=None)

    synced_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================


class CreateReadinessSessionRequest(SQLModel):
    """Request to create a release readiness session."""
    name: Optional[str] = "Release Assessment"
    integration_id: int
    release_identifier: str
    release_type: str = "fixVersion"  # fixVersion, iteration, label
    project_key: Optional[str] = None
    target_release_date: Optional[datetime] = None
    scoring_weights: Optional[Dict[str, Any]] = None


class ReadinessSessionResponse(SQLModel):
    """Response containing session details."""
    id: int
    name: str
    integration_id: int
    integration_name: Optional[str] = None
    integration_provider: Optional[str] = None
    release_identifier: str
    release_type: str
    status: str
    progress_step: int
    progress_total: int
    progress_message: Optional[str]
    error_message: Optional[str]
    readiness_score: Optional[int]
    max_possible_score: int
    confidence_level: str
    recommendation: str
    recommendation_details: Dict[str, Any]
    component_scores: Dict[str, Any]
    last_assessment_at: Optional[datetime]
    target_release_date: Optional[datetime]
    created_at: datetime


class ComponentScore(SQLModel):
    """Score for a single readiness component."""
    name: str
    weight: float
    score: int
    max_score: int
    status: str  # pass, warn, fail, not_assessed
    details: Dict[str, Any]
    data_available: bool


class ReadinessAssessment(SQLModel):
    """Full readiness assessment result."""
    session_id: int
    overall_score: int
    max_possible_score: int
    confidence_level: str
    recommendation: str
    recommendation_summary: str
    components: List[ComponentScore]
    risks: List[Dict[str, Any]]
    mitigations: List[str]
    release_notes_draft: Optional[str]


class DefectStatusReport(SQLModel):
    """Defect status for release."""
    total_defects: int
    open_critical: int
    open_high: int
    open_medium: int
    open_low: int
    resolved_this_release: int
    defect_trend: str  # increasing, stable, decreasing
    blocking_defects: List[Dict[str, Any]]


class WorkCompletionReport(SQLModel):
    """Work completion status."""
    total_items: int
    completed: int
    in_progress: int
    todo: int
    completion_percent: float
    scope_changes: int  # Items added/removed recently
    scope_stable: bool


class TestCoverageReport(SQLModel):
    """Test coverage summary."""
    data_available: bool
    total_tests: int
    passed: int
    failed: int
    blocked: int
    not_run: int
    pass_rate: float
    coverage_by_story: Dict[str, float]


class AcceptanceCriteriaReport(SQLModel):
    """Acceptance criteria coverage."""
    data_available: bool
    total_stories: int
    stories_with_ac: int
    ac_coverage_percent: float
    ac_verified_count: int
    gaps: List[Dict[str, Any]]  # Stories missing AC


class BetaFeedbackReport(SQLModel):
    """Beta/user feedback summary."""
    data_available: bool
    total_feedback: int
    open_critical: int
    addressed: int
    deferred: int
    sentiment: str  # positive, neutral, negative


# =============================================================================
# ASSESSMENT STATUS RESPONSE
# =============================================================================


class AssessmentStatusResponse(SQLModel):
    """Status of release assessment."""
    session_id: int
    status: str
    progress_step: int
    progress_total: int
    progress_message: Optional[str]
    error_message: Optional[str]
    items_analyzed: int
    last_assessment_at: Optional[datetime]


# =============================================================================
# CONFIGURATION DISCOVERY MODELS
# =============================================================================


class DataSourceConfig(SQLModel):
    """Configuration for available data sources."""
    defect_tracking: bool = True
    work_completion: bool = True
    test_management: bool = False
    test_management_type: Optional[str] = None  # zephyr, xray, ado_test_plans
    acceptance_criteria: bool = False
    ac_location: Optional[str] = None
    beta_feedback: bool = False
    beta_feedback_source: Optional[str] = None


class ConfigDiscoveryResult(SQLModel):
    """Result of auto-detecting available data sources."""
    discovered_sources: DataSourceConfig
    adjusted_weights: Dict[str, float]
    max_possible_score: int
    confidence_level: str
    limitations: List[str]
    suggestions: List[str]
