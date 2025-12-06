from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON
from humps import camelize

class PromptVersionBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    agent_id: int = Field(foreign_key="agents.id")
    version: int
    system_prompt: str
    model: str
    status: str = "draft" # 'draft', 'active', 'archived'

class PromptVersion(PromptVersionBase, table=True):
    __tablename__ = "prompt_versions"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class SplitTestBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    agent_id: int = Field(foreign_key="agents.id")
    name: str
    description: Optional[str] = None
    prompt_version_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    status: str = "active" # 'active', 'completed', 'paused'

class SplitTest(SplitTestBase, table=True):
    __tablename__ = "split_tests"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AgentExecutionBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    agent_id: int = Field(foreign_key="agents.id")
    split_test_id: Optional[int] = Field(default=None, foreign_key="split_tests.id")
    prompt_version_id: Optional[int] = Field(default=None, foreign_key="prompt_versions.id")
    conversation_id: Optional[int] = Field(default=None) # Link to conversation if exists
    input_prompt: str
    response: str
    execution_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

class AgentExecution(AgentExecutionBase, table=True):
    __tablename__ = "agent_executions"
    id: Optional[int] = Field(default=None, primary_key=True)
    executed_at: datetime = Field(default_factory=datetime.utcnow)
