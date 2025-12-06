from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

from humps import camelize

class PromptTemplateBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    name: str
    type: str # 'epic', 'feature', 'user_story'
    version: int
    system_prompt: str
    model: str = "google/gemini-2.0-flash-001"
    status: str = "draft" # 'draft', 'active', 'archived'

class PromptTemplate(PromptTemplateBase, table=True):
    __tablename__ = "prompt_templates"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class StoryGeneratorSplitTestBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    name: str
    description: Optional[str] = None
    artifact_type: str # 'epic', 'feature', 'user_story'
    prompt_template_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    status: str = "active"

class StoryGeneratorSplitTest(StoryGeneratorSplitTestBase, table=True):
    __tablename__ = "story_generator_split_tests"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GeneratedArtifactBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    type: str
    title: str
    content: str
    parent_id: Optional[int] = None
    input_description: str
    input_files: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    knowledge_base_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    prompt_template_id: Optional[int] = Field(default=None, foreign_key="prompt_templates.id")
    split_test_id: Optional[int] = Field(default=None, foreign_key="story_generator_split_tests.id")
    status: str = "draft"
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

class GeneratedArtifact(GeneratedArtifactBase, table=True):
    __tablename__ = "generated_artifacts"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GenerationFeedbackBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    artifact_id: int = Field(foreign_key="generated_artifacts.id")
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    sentiment: str
    text: Optional[str] = None

class GenerationFeedback(GenerationFeedbackBase, table=True):
    __tablename__ = "generation_feedback"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
