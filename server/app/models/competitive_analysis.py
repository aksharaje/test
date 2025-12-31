"""
Competitive Analysis Models

Database and Pydantic models for competitive analysis workflow.
"""
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, JSON, Column
from pydantic import field_validator
from pydantic.alias_generators import to_camel


# Problem area options for customer-facing mobile/web apps
PROBLEM_AREAS = [
    {"value": "login_auth", "label": "Login & Authentication"},
    {"value": "onboarding", "label": "User Onboarding"},
    {"value": "checkout_payments", "label": "Checkout & Payments"},
    {"value": "search_discovery", "label": "Search & Discovery"},
    {"value": "navigation_ia", "label": "Navigation & Information Architecture"},
    {"value": "notifications", "label": "Notifications & Alerts"},
    {"value": "profile_settings", "label": "User Profile & Settings"},
    {"value": "content_feed", "label": "Content Feed & Personalization"},
    {"value": "forms_data_entry", "label": "Forms & Data Entry"},
    {"value": "error_handling", "label": "Error Handling & Recovery"},
    {"value": "performance_loading", "label": "Performance & Loading States"},
    {"value": "accessibility", "label": "Accessibility & Inclusive Design"},
    {"value": "social_sharing", "label": "Social Features & Sharing"},
    {"value": "customer_support", "label": "Customer Support & Help"},
    {"value": "mobile_responsive", "label": "Mobile-First & Responsive Design"},
    {"value": "other", "label": "Other"},
]


class Opportunity(SQLModel):
    """Opportunity item with text, tag, and priority"""
    text: str
    tag: str
    priority: str  # high, medium, low
    icon: Optional[str] = None


class CompetitiveAnalysisSession(SQLModel, table=True):
    """Database model for competitive analysis sessions"""
    __tablename__ = "competitive_analysis_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Input fields
    problem_area: str = Field(description="Selected problem area category")
    custom_problem_area: Optional[str] = Field(default=None, description="Custom problem area if 'other' selected")
    reference_competitors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    include_direct_competitors: bool = Field(default=True)
    include_best_in_class: bool = Field(default=True)
    include_adjacent_industries: bool = Field(default=False)

    # Status
    status: str = Field(default="pending")  # pending, analyzing, completed, failed
    error_message: Optional[str] = None

    # Generated results
    executive_summary: Optional[str] = None
    industry_standards: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    best_practices: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    common_pitfalls: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    product_gaps: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    opportunities: List[dict] = Field(default_factory=list, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CompetitiveAnalysisSessionCreate(SQLModel):
    """Request model for creating a new session"""
    problem_area: str = Field(min_length=1)
    custom_problem_area: Optional[str] = None
    reference_competitors: List[str] = Field(default_factory=list)
    include_direct_competitors: bool = True
    include_best_in_class: bool = True
    include_adjacent_industries: bool = False

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    @field_validator('problem_area')
    @classmethod
    def validate_problem_area(cls, v: str) -> str:
        valid_values = [area["value"] for area in PROBLEM_AREAS]
        if v not in valid_values:
            raise ValueError(f"Invalid problem area. Must be one of: {valid_values}")
        return v


class CompetitiveAnalysisSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    problem_area: str
    custom_problem_area: Optional[str] = None
    reference_competitors: List[str] = []
    include_direct_competitors: bool = True
    include_best_in_class: bool = True
    include_adjacent_industries: bool = False
    status: str
    error_message: Optional[str] = None
    executive_summary: Optional[str] = None
    industry_standards: List[str] = []
    best_practices: List[str] = []
    common_pitfalls: List[str] = []
    product_gaps: List[str] = []
    opportunities: List[dict] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class ProblemAreaOption(SQLModel):
    """Response model for problem area options"""
    value: str
    label: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True
