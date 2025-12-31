"""
Market Research Models

Database and Pydantic models for market research synthesis workflow.
"""
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, JSON, Column
from pydantic import field_validator
from pydantic.alias_generators import to_camel

from app.models.shared_constants import INDUSTRIES


# Focus area options for market research
FOCUS_AREAS = [
    {"value": "user_expectations", "label": "User Expectations"},
    {"value": "adoption_trends", "label": "Adoption Trends"},
    {"value": "market_risks", "label": "Market Risks"},
    {"value": "regulation", "label": "Regulation & Compliance"},
    {"value": "technology_shifts", "label": "Technology Shifts"},
]


class MarketInsight(SQLModel):
    """Individual market insight with confidence and sources"""
    text: str
    confidence: str  # HIGH, MEDIUM, LOW
    source_count: int = 0
    sources: List[str] = []  # Source names/titles


class MarketResearchSession(SQLModel, table=True):
    """Database model for market research sessions"""
    __tablename__ = "market_research_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Input fields
    problem_area: str = Field(default="", description="Problem area to research")
    problem_area_source_type: Optional[str] = Field(default=None, description="Source type: ideation, okr, scope_definition")
    problem_area_source_id: Optional[int] = Field(default=None, description="ID of the source session")
    problem_area_context: Optional[str] = Field(default=None, description="Context extracted from source")
    industry_context: str = Field(default="", description="Industry context")
    focus_areas: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Status
    status: str = Field(default="pending")  # pending, analyzing, completed, failed
    error_message: Optional[str] = None

    # Generated results
    executive_summary: Optional[str] = None
    market_trends: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    expectation_shifts: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    market_risks: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    implications: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MarketResearchSessionCreate(SQLModel):
    """Request model for creating a new session"""
    problem_area: str = Field(min_length=1)
    problem_area_source_type: Optional[str] = None
    problem_area_source_id: Optional[int] = None
    problem_area_context: Optional[str] = None
    industry_context: str = Field(min_length=1)
    focus_areas: List[str] = Field(default_factory=list)

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    @field_validator('industry_context')
    @classmethod
    def validate_industry(cls, v: str) -> str:
        valid_values = [ind["value"] for ind in INDUSTRIES]
        if v not in valid_values:
            raise ValueError(f"Invalid industry. Must be one of: {valid_values}")
        return v

    @field_validator('focus_areas')
    @classmethod
    def validate_focus_areas(cls, v: List[str]) -> List[str]:
        valid_values = [area["value"] for area in FOCUS_AREAS]
        for area in v:
            if area not in valid_values:
                raise ValueError(f"Invalid focus area: {area}. Must be one of: {valid_values}")
        return v


class MarketResearchSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    problem_area: str
    problem_area_source_type: Optional[str] = None
    problem_area_source_id: Optional[int] = None
    problem_area_context: Optional[str] = None
    industry_context: str
    focus_areas: List[str] = []
    status: str
    error_message: Optional[str] = None
    executive_summary: Optional[str] = None
    market_trends: List[dict] = []
    expectation_shifts: List[dict] = []
    market_risks: List[dict] = []
    implications: List[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class IndustryOption(SQLModel):
    """Response model for industry options"""
    value: str
    label: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class FocusAreaOption(SQLModel):
    """Response model for focus area options"""
    value: str
    label: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True
