"""
Competitive Analysis Models

Database and Pydantic models for competitive analysis workflow.
"""
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, JSON, Column
from pydantic import field_validator
from pydantic.alias_generators import to_camel


# Focus area options for customer-facing mobile/web apps (sorted alphabetically)
FOCUS_AREAS = sorted([
    {"value": "accessibility", "label": "Accessibility & Inclusive Design"},
    {"value": "account_management", "label": "Account Management"},
    {"value": "booking_reservations", "label": "Booking & Reservations"},
    {"value": "checkout_payments", "label": "Checkout & Payments"},
    {"value": "content_feed", "label": "Content Feed & Personalization"},
    {"value": "customer_support", "label": "Customer Support & Help"},
    {"value": "dashboard_analytics", "label": "Dashboard & Analytics"},
    {"value": "data_visualization", "label": "Data Visualization"},
    {"value": "error_handling", "label": "Error Handling & Recovery"},
    {"value": "file_management", "label": "File Management & Uploads"},
    {"value": "forms_data_entry", "label": "Forms & Data Entry"},
    {"value": "gamification", "label": "Gamification & Rewards"},
    {"value": "login_auth", "label": "Login & Authentication"},
    {"value": "messaging_chat", "label": "Messaging & Chat"},
    {"value": "mobile_responsive", "label": "Mobile-First & Responsive Design"},
    {"value": "navigation_ia", "label": "Navigation & Information Architecture"},
    {"value": "notifications", "label": "Notifications & Alerts"},
    {"value": "offline_sync", "label": "Offline Mode & Data Sync"},
    {"value": "onboarding", "label": "User Onboarding"},
    {"value": "performance_loading", "label": "Performance & Loading States"},
    {"value": "profile_settings", "label": "User Profile & Settings"},
    {"value": "reviews_ratings", "label": "Reviews & Ratings"},
    {"value": "search_discovery", "label": "Search & Discovery"},
    {"value": "social_sharing", "label": "Social Features & Sharing"},
    {"value": "subscription_billing", "label": "Subscription & Billing"},
    {"value": "other", "label": "Other (Custom)"},
], key=lambda x: x["label"] if x["value"] != "other" else "zzz")  # Keep "Other" at end

# Top 30 US industries (sorted alphabetically)
INDUSTRIES = sorted([
    {"value": "aerospace_defense", "label": "Aerospace & Defense"},
    {"value": "agriculture", "label": "Agriculture"},
    {"value": "automotive", "label": "Automotive"},
    {"value": "banking", "label": "Banking & Financial Services"},
    {"value": "construction", "label": "Construction"},
    {"value": "consumer_goods", "label": "Consumer Goods & Retail"},
    {"value": "education", "label": "Education"},
    {"value": "energy", "label": "Energy & Utilities"},
    {"value": "entertainment", "label": "Entertainment & Media"},
    {"value": "food_beverage", "label": "Food & Beverage"},
    {"value": "government", "label": "Government & Public Sector"},
    {"value": "healthcare", "label": "Healthcare & Life Sciences"},
    {"value": "hospitality", "label": "Hospitality & Travel"},
    {"value": "insurance", "label": "Insurance"},
    {"value": "legal", "label": "Legal Services"},
    {"value": "logistics", "label": "Logistics & Supply Chain"},
    {"value": "manufacturing", "label": "Manufacturing"},
    {"value": "mining", "label": "Mining & Metals"},
    {"value": "nonprofit", "label": "Nonprofit & NGO"},
    {"value": "pharmaceuticals", "label": "Pharmaceuticals"},
    {"value": "professional_services", "label": "Professional Services"},
    {"value": "real_estate", "label": "Real Estate"},
    {"value": "sports_fitness", "label": "Sports & Fitness"},
    {"value": "technology", "label": "Technology & Software"},
    {"value": "telecommunications", "label": "Telecommunications"},
    {"value": "transportation", "label": "Transportation"},
    {"value": "venture_capital", "label": "Venture Capital & Private Equity"},
    {"value": "waste_management", "label": "Waste Management"},
    {"value": "wholesale", "label": "Wholesale & Distribution"},
    {"value": "other", "label": "Other"},
], key=lambda x: x["label"] if x["value"] != "other" else "zzz")  # Keep "Other" at end

# Input source types for context
INPUT_SOURCE_TYPES = [
    {"value": "none", "label": "None - Analyze General Best Practices"},
    {"value": "epic_feature", "label": "Epic or Feature"},
    {"value": "scope_definition", "label": "Scope Definition"},
    {"value": "ideation", "label": "Ideation Session"},
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
    focus_area: str = Field(default="", description="Selected focus area category")
    custom_focus_area: Optional[str] = Field(default=None, description="Custom focus area if 'other' selected")
    reference_competitors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    include_best_in_class: bool = Field(default=True)
    include_adjacent_industries: bool = Field(default=False)
    target_industry: Optional[str] = Field(default=None, description="Target industry for industry-specific solutions")

    # Input source (existing work to analyze)
    input_source_type: Optional[str] = Field(default=None, description="Type: epic_feature, scope_definition, ideation")
    input_source_id: Optional[int] = Field(default=None, description="ID of the source session/artifact")
    input_source_description: Optional[str] = Field(default=None, description="Description extracted from source")

    # Knowledge base for code comparison (optional)
    knowledge_base_id: Optional[int] = Field(default=None, description="Code knowledge base ID for comparison")

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

    # Code comparison results (if knowledge base provided)
    code_comparison: Optional[str] = Field(default=None, description="Analysis of how user's code compares to competitors")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Legacy field mapping for backward compatibility
    @property
    def problem_area(self) -> str:
        return self.focus_area

    @property
    def custom_problem_area(self) -> Optional[str]:
        return self.custom_focus_area


class CompetitiveAnalysisSessionCreate(SQLModel):
    """Request model for creating a new session"""
    focus_area: str = Field(min_length=1)
    custom_focus_area: Optional[str] = None
    reference_competitors: List[str] = Field(default_factory=list)
    include_best_in_class: bool = True
    include_adjacent_industries: bool = False
    target_industry: Optional[str] = None
    input_source_type: Optional[str] = None
    input_source_id: Optional[int] = None
    input_source_description: Optional[str] = None
    knowledge_base_id: Optional[int] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    @field_validator('focus_area')
    @classmethod
    def validate_focus_area(cls, v: str) -> str:
        valid_values = [area["value"] for area in FOCUS_AREAS]
        if v not in valid_values:
            raise ValueError(f"Invalid focus area. Must be one of: {valid_values}")
        return v

    @field_validator('target_industry')
    @classmethod
    def validate_target_industry(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        valid_values = [ind["value"] for ind in INDUSTRIES]
        if v not in valid_values:
            raise ValueError(f"Invalid industry. Must be one of: {valid_values}")
        return v


class CompetitiveAnalysisSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    focus_area: str
    custom_focus_area: Optional[str] = None
    reference_competitors: List[str] = []
    include_best_in_class: bool = True
    include_adjacent_industries: bool = False
    target_industry: Optional[str] = None
    input_source_type: Optional[str] = None
    input_source_id: Optional[int] = None
    input_source_description: Optional[str] = None
    knowledge_base_id: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    executive_summary: Optional[str] = None
    industry_standards: List[str] = []
    best_practices: List[str] = []
    common_pitfalls: List[str] = []
    product_gaps: List[str] = []
    opportunities: List[dict] = []
    code_comparison: Optional[str] = None
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


class InputSourceOption(SQLModel):
    """Response model for input source type options"""
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
