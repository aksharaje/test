from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

from humps import camelize

class CodeChatSessionBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    title: Optional[str] = None
    knowledge_base_ids: List[int] = Field(default=[], sa_column=Column(JSON))

class CodeChatSession(CodeChatSessionBase, table=True):
    __tablename__ = "code_chat_sessions"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CodeChatMessageBase(SQLModel):
    model_config = {
        "alias_generator": camelize,
        "populate_by_name": True
    }
    session_id: int = Field(foreign_key="code_chat_sessions.id")
    role: str # 'user', 'assistant'
    content: str
    citations: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    metadata_: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON, name="metadata"))

class CodeChatMessage(CodeChatMessageBase, table=True):
    __tablename__ = "code_chat_messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
