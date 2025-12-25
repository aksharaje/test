"""
Business Case Builder Models

Database models for business case analysis including:
- Sessions (main workflow)
- Cost items (labor, infrastructure, licensing)
- Benefit items (revenue, savings, intangible)
- Financial metrics (NPV, IRR, Payback)
- Scenario comparisons
- User overrides/learning
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class BusinessCaseSession(SQLModel, table=True):
    """Main session for a business case analysis"""
    __tablename__ = "business_case_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Link to feasibility analysis (optional - can be standalone)
    feasibility_session_id: Optional[int] = Field(default=None, foreign_key="feasibility_sessions.id")

    # Input context
    feature_name: str = Field(min_length=3, max_length=200)
    feature_description: str = Field(min_length=50)
    business_context: Optional[str] = None  # Industry, company size, goals
    target_market: Optional[str] = None

    # Status tracking
    status: str = Field(default="pending")  # pending, analyzing, completed, failed
    progress_step: int = Field(default=0)
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Executive outputs
    executive_summary: Optional[str] = None
    recommendation: Optional[str] = None  # invest, defer, reject
    confidence_level: str = Field(default="medium")  # low, medium, high

    # Financial summary
    total_investment: Optional[float] = None
    net_present_value: Optional[float] = None
    internal_rate_of_return: Optional[float] = None  # Percentage
    payback_months: Optional[int] = None
    roi_percentage: Optional[float] = None

    # Metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class CostItem(SQLModel, table=True):
    """Individual cost item for the business case"""
    __tablename__ = "business_case_cost_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="business_case_sessions.id")

    # Categorization
    cost_category: str  # development, infrastructure, licensing, maintenance, training, support
    cost_type: str  # one_time, recurring_monthly, recurring_annual

    # Description
    item_name: str
    item_description: str

    # Estimates (three-point)
    optimistic_amount: float
    realistic_amount: float
    pessimistic_amount: float

    # Data source tracking
    data_source: str  # user_input, feasibility_import, web_research, benchmark, ai_estimate
    confidence_level: str = Field(default="medium")  # low, medium, high
    source_reference: Optional[str] = None  # URL or description of source

    # User overrides
    is_user_override: bool = Field(default=False)
    original_estimate: Optional[float] = None  # Before user override

    display_order: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BenefitItem(SQLModel, table=True):
    """Individual benefit item for the business case"""
    __tablename__ = "business_case_benefit_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="business_case_sessions.id")

    # Categorization
    benefit_category: str  # revenue_increase, cost_reduction, efficiency_gain, risk_reduction, strategic
    benefit_type: str  # quantifiable, semi_quantifiable, qualitative

    # Description
    item_name: str
    item_description: str

    # Estimates (three-point) - for quantifiable benefits
    optimistic_amount: Optional[float] = None
    realistic_amount: Optional[float] = None
    pessimistic_amount: Optional[float] = None

    # For recurring benefits
    recurrence: Optional[str] = None  # monthly, annual, one_time
    time_to_realize_months: int = Field(default=0)  # Months until benefit starts

    # Data source tracking
    data_source: str  # user_input, web_research, benchmark, ai_estimate
    confidence_level: str = Field(default="medium")
    source_reference: Optional[str] = None

    # User overrides
    is_user_override: bool = Field(default=False)
    original_estimate: Optional[float] = None

    display_order: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FinancialScenario(SQLModel, table=True):
    """Financial projection scenario (conservative, base, optimistic)"""
    __tablename__ = "business_case_financial_scenarios"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="business_case_sessions.id")

    scenario_type: str  # conservative, base, optimistic

    # Investment summary
    total_one_time_costs: float
    total_recurring_annual_costs: float
    total_investment_year_1: float
    total_investment_5_year: float

    # Benefits summary
    total_annual_benefits_year_1: float
    total_annual_benefits_year_3: float
    total_benefits_5_year: float

    # Financial metrics
    net_present_value: float  # Using standard discount rate
    internal_rate_of_return: Optional[float] = None  # Percentage, null if negative
    payback_period_months: Optional[int] = None  # Null if never pays back
    roi_percentage: float

    # Assumptions
    discount_rate: float = Field(default=0.10)  # 10% default
    projection_years: int = Field(default=5)
    benefit_growth_rate: float = Field(default=0.0)  # Annual growth in benefits

    rationale: str
    confidence_level: str = Field(default="medium")

    # Cash flow projections (stored as JSON array)
    yearly_cash_flows: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)


class Assumption(SQLModel, table=True):
    """Key assumptions underlying the business case"""
    __tablename__ = "business_case_assumptions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="business_case_sessions.id")

    assumption_category: str  # market, technical, resource, timeline, financial
    assumption_text: str
    impact_if_wrong: str  # low, medium, high
    validation_status: str = Field(default="unvalidated")  # unvalidated, validated, invalidated
    validation_notes: Optional[str] = None

    data_source: str  # user_input, web_research, benchmark, ai_inference
    source_reference: Optional[str] = None

    display_order: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SensitivityAnalysis(SQLModel, table=True):
    """Sensitivity analysis for key variables"""
    __tablename__ = "business_case_sensitivity"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="business_case_sessions.id")

    variable_name: str  # e.g., "Development Cost", "Annual Revenue Increase"
    variable_type: str  # cost, benefit, timeline
    base_value: float

    # Impact analysis
    low_value: float  # -20% scenario
    high_value: float  # +20% scenario
    npv_at_low: float
    npv_at_high: float
    npv_sensitivity: float  # Change in NPV per 1% change in variable

    is_critical: bool = Field(default=False)  # High sensitivity = critical variable

    display_order: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RateAssumption(SQLModel, table=True):
    """Stores rate assumptions used in calculations"""
    __tablename__ = "business_case_rate_assumptions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="business_case_sessions.id")

    # Rate category
    rate_type: str  # hourly_rate, discount_rate, benefit_growth_rate, overhead_multiplier

    # Rate details
    rate_name: str  # e.g., "Junior Developer", "Senior Developer", "Discount Rate"
    rate_value: float  # The actual rate value
    rate_unit: str  # per_hour, percentage, multiplier

    # Context
    company_size: Optional[str] = None  # startup, small, medium, large, enterprise
    rate_description: Optional[str] = None  # Explanation of how this rate is used

    # Source
    data_source: str = Field(default="benchmark")  # user_input, benchmark, feasibility_import
    is_user_override: bool = Field(default=False)

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserLearning(SQLModel, table=True):
    """Captures user corrections for future learning"""
    __tablename__ = "business_case_user_learnings"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # What was learned
    learning_type: str  # cost_correction, benefit_correction, assumption_update, rate_adjustment
    category: str  # The specific category this applies to

    # The correction
    original_value: Optional[float] = None
    corrected_value: Optional[float] = None
    correction_factor: Optional[float] = None  # Multiplier for future estimates

    # Context
    context: str  # Description of when this applies
    industry: Optional[str] = None
    company_size: Optional[str] = None  # small, medium, large, enterprise

    # Applicability
    times_applied: int = Field(default=0)
    last_applied_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
