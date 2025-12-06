from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

class AgentBase(SQLModel):
    name: str
    description: Optional[str] = None
    system_prompt: str
    model: str = "openai/gpt-oss-120b"
    tools: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))

class Agent(AgentBase, table=True):
    __tablename__ = "agents"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
