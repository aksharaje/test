"""
Scope Definition Agent Models

Database models for defining and documenting project scope.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON, Column
from humps import camelize


def to_camel(string):
    return camelize(string)


class ScopeDefinitionSession(SQLModel, table=True):
    """Main session for scope definition workflow"""
    __tablename__ = "scope_definition_sessions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Input fields
    project_name: str
    product_vision: str = Field(min_length=50)  # High-level vision
    initial_requirements: Optional[str] = None  # Initial requirements or features
    known_constraints: Optional[str] = None  # Budget, time, resource constraints
    stakeholder_needs: Optional[str] = None  # Key stakeholder requirements
    target_users: Optional[str] = None  # Primary user segments

    # Source session references (mutually exclusive)
    ideation_session_id: Optional[int] = Field(default=None, foreign_key="ideation_sessions.id")
    okr_session_id: Optional[int] = Field(default=None, foreign_key="okr_sessions.id")

    # Knowledge base IDs for context
    knowledge_base_ids: Optional[List[int]] = Field(default=None, sa_column=Column(JSON))

    # Processing state
    status: str = Field(default="pending")  # pending, generating, completed, failed
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Output summary
    scope_statement: Optional[str] = None  # Executive scope statement
    executive_summary: Optional[str] = None

    # Metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class ScopeItem(SQLModel, table=True):
    """Individual scope item (in-scope or out-of-scope)"""
    __tablename__ = "scope_items"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scope_definition_sessions.id")

    # Item details
    title: str
    description: str
    category: str  # feature, integration, infrastructure, process
    scope_type: str  # in_scope, out_of_scope, deferred

    # Priority (for in-scope items)
    priority: Optional[str] = None  # must_have, should_have, could_have, wont_have
    rationale: Optional[str] = None  # Why included/excluded

    # Effort indication
    estimated_complexity: Optional[str] = None  # low, medium, high
    dependencies: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScopeAssumption(SQLModel, table=True):
    """Assumption made during scope definition"""
    __tablename__ = "scope_assumptions"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scope_definition_sessions.id")

    # Assumption details
    assumption: str
    category: str  # technical, business, resource, timeline
    risk_if_wrong: str  # What happens if this assumption is incorrect
    validation_method: Optional[str] = None  # How to validate this assumption

    # Status tracking
    status: str = Field(default="assumed")  # assumed, validated, invalidated
    confidence: str = Field(default="medium")  # low, medium, high

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScopeConstraint(SQLModel, table=True):
    """Constraint affecting scope"""
    __tablename__ = "scope_constraints"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scope_definition_sessions.id")

    # Constraint details
    constraint: str
    category: str  # budget, timeline, resource, technical, regulatory
    impact: str  # How this constraint affects the project
    flexibility: str  # fixed, negotiable, flexible

    # Mitigation
    mitigation_strategy: Optional[str] = None

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScopeDeliverable(SQLModel, table=True):
    """Key deliverable defined in scope"""
    __tablename__ = "scope_deliverables"

    class Config:
        alias_generator = to_camel
        populate_by_name = True

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scope_definition_sessions.id")

    # Deliverable details
    name: str
    description: str
    type: str  # document, software, service, integration
    acceptance_criteria: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Timeline
    target_milestone: Optional[str] = None
    estimated_completion: Optional[str] = None

    # Dependencies
    dependencies: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Pydantic models for API
class ScopeDefinitionSessionCreate(SQLModel):
    """Request model for creating a new session"""
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    project_name: str
    product_vision: str = Field(min_length=50)
    initial_requirements: Optional[str] = None
    known_constraints: Optional[str] = None
    stakeholder_needs: Optional[str] = None
    target_users: Optional[str] = None
    ideation_session_id: Optional[int] = None
    okr_session_id: Optional[int] = None
    knowledge_base_ids: Optional[List[int]] = None


class ScopeDefinitionSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    project_name: str
    product_vision: str
    initial_requirements: Optional[str]
    known_constraints: Optional[str]
    stakeholder_needs: Optional[str]
    target_users: Optional[str]
    status: str
    progress_message: Optional[str]
    error_message: Optional[str]
    scope_statement: Optional[str]
    executive_summary: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class ScopeItemResponse(SQLModel):
    """Response model for scope item"""
    id: int
    session_id: int
    title: str
    description: str
    category: str
    scope_type: str
    priority: Optional[str]
    rationale: Optional[str]
    estimated_complexity: Optional[str]
    dependencies: Optional[List[str]]
    display_order: int

    class Config:
        alias_generator = to_camel
        populate_by_name = True
