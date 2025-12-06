from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

from humps import camelize

class FeedbackBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    execution_id: int = Field(foreign_key="agent_executions.id")
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    sentiment: str # 'positive', 'negative'
    text: Optional[str] = None

class Feedback(FeedbackBase, table=True):
    __tablename__ = "feedback"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

