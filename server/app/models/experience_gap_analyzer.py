"""
Experience Gap Analyzer Models

Database models for the Experience Gap Analyzer feature in the Customer Experience section.
Compares customer journeys to identify gaps and generate prioritized improvement roadmaps.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class GapAnalysisSession(SQLModel, table=True):
    """Main session for experience gap analysis workflow"""
    __tablename__ = "gap_analysis_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Analysis configuration
    analysis_type: str = Field(default="competitive")  # competitive, best_practice, temporal
    analysis_name: Optional[str] = None  # User-provided name for this analysis

    # Input journey references
    your_journey_id: Optional[int] = Field(default=None, foreign_key="journey_map_sessions.id")
    comparison_journey_id: Optional[int] = Field(default=None, foreign_key="journey_map_sessions.id")
    # For temporal analysis - compare different versions of same journey

    # Optional context from other features
    knowledge_base_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))

    # Analysis parameters (user can adjust weights)
    analysis_parameters: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {impactWeight: float, urgencyWeight: float, effortWeight: float}

    # Processing state
    status: str = Field(default="pending")
    # statuses: pending, analyzing, generating_roadmap, completed, failed
    progress_step: int = Field(default=0)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Generated analysis results
    overall_assessment: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {
    #   summary: str,
    #   totalGapsIdentified: int,
    #   criticalGapsCount: int,
    #   competitiveAdvantagesCount: int,
    #   overallHealthScore: float (0-100),
    #   recommendedFocusAreas: [str]
    # }

    # Competitive advantages (things you do better)
    competitive_advantages: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    # schema: [{stageId: str, title: str, description: str, evidence: str}]

    # Capability matrix summary
    capability_matrix_summary: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {
    #   categories: [str],
    #   yourScores: {category: float},
    #   comparisonScores: {category: float},
    #   gapScores: {category: float}
    # }

    # Generated roadmap
    roadmap: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {
    #   tier1: [{gapId: int, title: str, rationale: str, estimatedImpact: str}],
    #   tier2: [...],
    #   tier3: [...]
    # }

    # Export
    report_pdf_url: Optional[str] = None

    # Raw LLM response for debugging
    raw_llm_response: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class GapItem(SQLModel, table=True):
    """Individual gaps identified in the analysis"""
    __tablename__ = "gap_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="gap_analysis_sessions.id")

    # Gap identification
    title: str
    description: str
    category: str = Field(default="experience")  # capability, experience, quality, process

    # Stage alignment
    stage_id: Optional[str] = None  # References stage.id in journey map
    stage_name: Optional[str] = None  # Denormalized for display

    # Scoring (1-10 scale for each, calculated opportunity score)
    impact_score: float = Field(default=5.0, ge=1.0, le=10.0)
    urgency_score: float = Field(default=5.0, ge=1.0, le=10.0)
    effort_score: float = Field(default=5.0, ge=1.0, le=10.0)
    # Opportunity Score = (Impact × Urgency) / Effort
    opportunity_score: float = Field(default=5.0, ge=0.0)

    # Priority tier based on opportunity score
    # Tier 1 (Critical): score > 15
    # Tier 2 (Important): score 8-15
    # Tier 3 (Nice-to-have): score < 8
    priority_tier: int = Field(default=2, ge=1, le=3)

    # Evidence and rationale
    evidence: Optional[str] = None  # Supporting data for this gap
    comparison_notes: Optional[str] = None  # How competitor/benchmark handles this better

    # ROI projection
    roi_projection: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # schema: {estimatedValue: str, timeToValue: str, confidenceLevel: str}

    # User edits
    is_user_edited: bool = Field(default=False)
    user_priority_override: Optional[int] = None  # User can manually set tier

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CapabilityMatrixItem(SQLModel, table=True):
    """Capability comparison matrix entries"""
    __tablename__ = "capability_matrix_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="gap_analysis_sessions.id")

    # Capability identification
    capability_name: str
    category: str  # e.g., "Onboarding", "Support", "Self-Service", "Performance"

    # Scores (1-10 scale)
    your_score: float = Field(default=5.0, ge=1.0, le=10.0)
    comparison_score: float = Field(default=5.0, ge=1.0, le=10.0)
    gap_score: float = Field(default=0.0)  # comparison_score - your_score (positive = you're behind)

    # Details
    your_evidence: Optional[str] = None
    comparison_evidence: Optional[str] = None
    improvement_suggestion: Optional[str] = None

    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class StageAlignment(SQLModel, table=True):
    """Maps stages between your journey and comparison journey"""
    __tablename__ = "stage_alignments"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="gap_analysis_sessions.id")

    # Your journey stage
    your_stage_id: str
    your_stage_name: str

    # Comparison journey stage (if aligned)
    comparison_stage_id: Optional[str] = None
    comparison_stage_name: Optional[str] = None

    # Alignment status
    alignment_type: str = Field(default="aligned")  # aligned, missing_in_comparison, missing_in_yours, different

    # Gap summary for this stage
    gaps_count: int = Field(default=0)
    critical_gaps_count: int = Field(default=0)
    advantages_count: int = Field(default=0)

    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
