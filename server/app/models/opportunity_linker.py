"""
Opportunity Linker Models

Database models for AI-powered opportunity mapping and prioritization.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON
from humps import camelize


class PrioritizationSessionBase(SQLModel):
    """Base model for prioritization sessions"""
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }

    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    ideation_session_id: int = Field(foreign_key="ideation_sessions.id", index=True)

    # Status tracking
    status: str = "pending"  # pending, mapping, scoring, sizing, prioritizing, completed, failed
    progress_step: int = 0  # Current step (0-5)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Portfolio summary (from Agent 10)
    portfolio_summary: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # Contains:
    # {
    #   "by_tier": {"p0": 3, "p1": 5, "p2": 4, "p3": 3},
    #   "by_category": {"quick_wins": 4, "strategic_bets": 6, ...},
    #   "by_effort": {"S": 2, "M": 8, "L": 4, "XL": 1},
    #   "top_p0_recommendations": [idea_id_1, idea_id_2, idea_id_3]
    # }

    # Metadata
    processing_time_ms: Optional[int] = None


class PrioritizationSession(PrioritizationSessionBase, table=True):
    """Prioritization session - represents opportunity mapping for one ideation session"""
    __tablename__ = "prioritization_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class PrioritizedIdeaBase(SQLModel):
    """Base model for prioritized ideas with opportunity mapping"""
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }

    prioritization_session_id: int = Field(foreign_key="prioritization_sessions.id", index=True)
    generated_idea_id: int = Field(foreign_key="generated_ideas.id", index=True)

    # Synthetic Opportunities (Agent 7)
    market_opportunity: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # {
    #   "estimated_market_size": "$200K annually",
    #   "confidence_level": "Medium",
    #   "rationale": "Based on problem affecting 15% of 1000 users..."
    # }

    strategic_opportunity: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # {
    #   "connection_strength": "High",
    #   "alignment_rationale": "Directly addresses user retention goal..."
    # }

    customer_opportunity: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    # {
    #   "value_delivered": "Reduces onboarding time by 40%",
    #   "customer_segment": "New users",
    #   "pain_point_addressed": "Complexity in initial setup"
    # }

    # Strategic Fit Score (Agent 8)
    strategic_fit_score: Optional[float] = None  # 0-10
    strategic_fit_rationale: Optional[str] = None

    # Size Estimation (Agent 9)
    tshirt_size: Optional[str] = None  # S, M, L, XL
    size_rationale: Optional[str] = None
    size_confidence: Optional[str] = None  # Very Low, Low, Medium, High
    potential_revenue: Optional[str] = None  # Estimated from impact value

    # Prioritization (Agent 10)
    priority_score: Optional[float] = None  # Weighted average
    # Formula: impact * 0.30 + strategic_fit * 0.25 + effort * 0.20 + feasibility * 0.15 + risk * 0.10

    priority_tier: Optional[str] = None  # P0, P1, P2, P3
    # P0: >= 8.0 (Do now)
    # P1: >= 6.5 (Next quarter)
    # P2: >= 5.0 (Backlog)
    # P3: < 5.0 (Deprioritize)

    # Display order within tier
    display_order: int = 0


class PrioritizedIdea(PrioritizedIdeaBase, table=True):
    """Prioritized idea with full opportunity mapping and scores"""
    __tablename__ = "prioritized_ideas"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
