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


class FieldMappingBase(SQLModel):
    """Maps our standard fields to provider-specific fields."""
    integration_id: int = Field(foreign_key="integrations.id", index=True)
    our_field: str = Field(index=True)  # e.g., 'story_points', 'sprint', 'priority'
    provider_field_id: str  # e.g., 'Microsoft.VSTS.Scheduling.StoryPoints'
    provider_field_name: str  # e.g., 'Story Points'
    provider_field_type: Optional[str] = None  # e.g., 'number', 'string'
    confidence: int = Field(default=0)  # 0-100, how confident we are in this mapping
    admin_confirmed: bool = Field(default=False)  # True if user confirmed this mapping


class FieldMapping(FieldMappingBase, table=True):
    __tablename__ = "field_mappings"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
