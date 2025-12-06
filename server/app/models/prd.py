from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

class PrdTemplateBase(SQLModel):
    name: str
    description: Optional[str] = None
    is_default: int = 0
    is_custom: int = 0
    system_prompt: str
    json_schema: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")

class PrdTemplate(PrdTemplateBase, table=True):
    __tablename__ = "prd_templates"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GeneratedPrdBase(SQLModel):
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    title: str
    content: str
    concept: str
    target_project: Optional[str] = None
    target_persona: Optional[str] = None
    industry_context: Optional[str] = None
    primary_metric: Optional[str] = None
    user_story_role: Optional[str] = None
    user_story_goal: Optional[str] = None
    user_story_benefit: Optional[str] = None
    knowledge_base_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    input_files: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    template_id: Optional[int] = Field(default=None, foreign_key="prd_templates.id")
    status: str = "draft"
    generation_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    citations: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))

class GeneratedPrd(GeneratedPrdBase, table=True):
    __tablename__ = "generated_prds"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
