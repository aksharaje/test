from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

class IntegrationBase(SQLModel):
    provider: str
    name: str
    base_url: str
    cloud_id: Optional[str] = None
    auth_type: str # 'oauth', 'pat'
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: List[str] = Field(default=[], sa_column=Column(JSON))
    status: str = "connected"
    last_sync_at: Optional[datetime] = None
    error_message: Optional[str] = None

class Integration(IntegrationBase, table=True):
    __tablename__ = "integrations"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Simplified Jira models for now
class JiraProjectBase(SQLModel):
    integration_id: int = Field(foreign_key="integrations.id")
    jira_id: str
    key: str
    name: str
    project_type: Optional[str] = None
    avatar_url: Optional[str] = None
    synced_at: datetime = Field(default_factory=datetime.utcnow)

class JiraProject(JiraProjectBase, table=True):
    __tablename__ = "jira_projects"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
