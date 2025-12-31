"""
Test Script Writer Models

Database and Pydantic models for test script generation workflow.
"""
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, JSON, Column
from pydantic.alias_generators import to_camel


# Source type options - where to get stories from
SOURCE_TYPES = [
    {"value": "epic", "label": "Epic"},
    {"value": "feature", "label": "Feature"},
    {"value": "user_story", "label": "User Story"},
    {"value": "manual", "label": "Manual Entry"},
]

# Non-Functional Requirement options (all unchecked by default)
NFR_OPTIONS = [
    {"value": "accessibility", "label": "Accessibility", "description": "Screen readers, keyboard navigation, WCAG compliance"},
    {"value": "security", "label": "Security", "description": "Authentication, authorization, data protection, XSS/CSRF"},
    {"value": "analytics", "label": "Analytics", "description": "Event tracking, user behavior, conversion metrics"},
    {"value": "performance", "label": "Performance", "description": "Load times, response times, resource usage"},
    {"value": "localization", "label": "Localization", "description": "Multi-language, date/time formats, currency"},
    {"value": "error_handling", "label": "Error Handling", "description": "Error messages, recovery flows, graceful degradation"},
    {"value": "usability", "label": "Usability", "description": "User experience, intuitive design, help/tooltips"},
    {"value": "data_integrity", "label": "Data Integrity", "description": "Validation, consistency, backup/recovery"},
    {"value": "compatibility", "label": "Compatibility", "description": "Cross-browser, mobile, different devices/OS"},
]


class TestCase(SQLModel):
    """Individual test case"""
    id: str  # Unique identifier for copy functionality
    title: str
    description: str
    preconditions: List[str] = []
    steps: List[str] = []
    expected_result: str
    test_type: str  # functional, edge_case, negative, nfr
    nfr_category: Optional[str] = None  # If NFR test, which category
    priority: str = "medium"  # high, medium, low


class StoryTestScript(SQLModel):
    """Test scripts for a single story"""
    story_id: str
    story_title: str
    story_description: str
    acceptance_criteria: List[str] = []
    test_cases: List[TestCase] = []


class StoryInput(SQLModel):
    """Story input for test generation"""
    id: str
    title: str
    description: str
    acceptance_criteria: List[str] = []


class TestScriptWriterSession(SQLModel, table=True):
    """Database model for test script writer sessions"""
    __tablename__ = "test_script_writer_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Input fields
    source_type: str = Field(default="manual", description="Source: epic, feature, user_story, manual")
    source_id: Optional[int] = Field(default=None, description="ID from story generator if applicable")
    source_title: Optional[str] = Field(default=None, description="Title of the selected source")
    stories: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    selected_nfrs: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Status
    status: str = Field(default="pending")  # pending, generating, completed, failed
    error_message: Optional[str] = None

    # Generated results
    story_test_scripts: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    summary: Optional[str] = Field(default=None, description="Executive summary of test coverage")
    total_test_cases: int = Field(default=0)
    test_breakdown: dict = Field(default_factory=dict, sa_column=Column(JSON))  # By type counts

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TestScriptWriterSessionCreate(SQLModel):
    """Request model for creating a new session"""
    source_type: str = Field(min_length=1)
    source_id: Optional[int] = None
    source_title: Optional[str] = None
    stories: List[dict] = Field(default_factory=list)
    selected_nfrs: List[str] = Field(default_factory=list)

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class TestScriptWriterSessionResponse(SQLModel):
    """Response model for session data"""
    id: int
    source_type: str
    source_id: Optional[int] = None
    source_title: Optional[str] = None
    stories: List[dict] = []
    selected_nfrs: List[str] = []
    status: str
    error_message: Optional[str] = None
    story_test_scripts: List[dict] = []
    summary: Optional[str] = None
    total_test_cases: int = 0
    test_breakdown: dict = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class SourceTypeOption(SQLModel):
    """Response model for source type options"""
    value: str
    label: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class NfrOption(SQLModel):
    """Response model for NFR options"""
    value: str
    label: str
    description: str

    class Config:
        alias_generator = to_camel
        populate_by_name = True


class SessionStatus(SQLModel):
    """Response model for session status"""
    status: str
    error_message: Optional[str] = None

    class Config:
        alias_generator = to_camel
        populate_by_name = True
