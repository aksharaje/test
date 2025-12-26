"""
Story-to-Code Models

Session-based models for converting user stories to production code.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON
from humps import camelize


class StoryToCodeSessionBase(SQLModel):
    """Base model for Story-to-Code sessions."""
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }

    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    title: Optional[str] = None

    # Input data
    input_source: str = "manual"  # 'manual', 'artifact', 'story_generator'
    input_description: str  # The user stories/requirements
    source_artifact_id: Optional[int] = Field(default=None, foreign_key="generated_artifacts.id")

    # Configuration
    tech_stack: Optional[str] = None  # Only used if no KB selected
    knowledge_base_ids: List[int] = Field(default=[], sa_column=Column(JSON))

    # Output
    generated_files: Optional[Dict[str, str]] = Field(default=None, sa_column=Column(JSON))  # filename -> content

    # Processing status
    status: str = "pending"  # 'pending', 'generating', 'completed', 'failed'
    progress_step: int = 0
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

    # Metadata
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class StoryToCodeSession(StoryToCodeSessionBase, table=True):
    """Story-to-Code session database model."""
    __tablename__ = "story_to_code_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
