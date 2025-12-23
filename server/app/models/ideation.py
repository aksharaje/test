"""
Ideation Engine Models

Database models for AI-powered ideation workflow.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON
from humps import camelize


class IdeationSessionBase(SQLModel):
    """Base model for ideation sessions"""
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }

    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    problem_statement: str  # Original user input
    constraints: Optional[str] = None  # Optional constraints
    goals: Optional[str] = None  # Optional goals
    research_insights: Optional[str] = None  # Optional research snippets
    knowledge_base_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))  # Optional KB IDs for RAG

    # Structured problem (from Agent 1)
    structured_problem: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Status tracking
    status: str = "pending"  # pending, parsing, generating, clustering, enriching, scoring, deduplicating, completed, failed
    progress_step: int = 0  # Current step (0-7)
    progress_message: Optional[str] = None  # Human-readable progress
    error_message: Optional[str] = None  # If failed

    # Confidence assessment
    confidence: str = "medium"  # low, medium, high

    # Prioritization (Opportunity Linker) session ID
    prioritization_session_id: Optional[int] = Field(default=None, index=True)

    # Metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class IdeationSession(IdeationSessionBase, table=True):
    """Ideation session - represents one problem statement and its generated ideas"""
    __tablename__ = "ideation_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class GeneratedIdeaBase(SQLModel):
    """Base model for generated ideas"""
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }

    session_id: int = Field(foreign_key="ideation_sessions.id", index=True)

    # Core idea fields
    title: str
    description: str
    category: str  # quick_wins, strategic_bets, incremental, moonshots

    # Effort & impact estimates
    effort_estimate: str = "medium"  # low, medium, high
    impact_estimate: str = "medium"  # low, medium, high

    # Embedding for clustering
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(JSON))

    # Cluster assignment
    cluster_id: Optional[int] = Field(default=None, foreign_key="idea_clusters.id")

    # Enrichment (from Agent 4)
    use_cases: List[str] = Field(default=[], sa_column=Column(JSON))
    edge_cases: List[str] = Field(default=[], sa_column=Column(JSON))
    implementation_notes: List[str] = Field(default=[], sa_column=Column(JSON))

    # Scores (from Agent 5)
    impact_score: Optional[float] = None  # 1-10
    impact_rationale: Optional[str] = None
    feasibility_score: Optional[float] = None  # 1-10
    feasibility_rationale: Optional[str] = None
    effort_score: Optional[float] = None  # 1-10 (higher = less effort)
    effort_rationale: Optional[str] = None
    strategic_fit_score: Optional[float] = None  # 1-10
    strategic_fit_rationale: Optional[str] = None
    risk_score: Optional[float] = None  # 1-10 (higher = less risk)
    risk_rationale: Optional[str] = None
    composite_score: Optional[float] = None  # Weighted average

    # Flags
    is_duplicate: bool = False
    duplicate_of_id: Optional[int] = None
    is_final: bool = True

    # Ordering
    display_order: int = 0


class GeneratedIdea(GeneratedIdeaBase, table=True):
    """Individual generated idea with enrichment and scoring"""
    __tablename__ = "generated_ideas"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IdeaClusterBase(SQLModel):
    """Base model for idea clusters/themes"""
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }

    session_id: int = Field(foreign_key="ideation_sessions.id", index=True)
    cluster_number: int  # 1, 2, 3, etc.
    theme_name: str  # Generated theme label
    theme_description: Optional[str] = None
    idea_count: int = 0
    centroid_embedding: Optional[List[float]] = Field(default=None, sa_column=Column(JSON))


class IdeaCluster(IdeaClusterBase, table=True):
    """Cluster of related ideas grouped by theme"""
    __tablename__ = "idea_clusters"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
