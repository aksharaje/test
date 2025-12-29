from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class AdoProjectBase(SQLModel):
    integration_id: int = Field(foreign_key="integrations.id")
    ado_id: str
    name: str
    url: Optional[str] = None
    description: Optional[str] = None
    state: Optional[str] = None
    synced_at: datetime = Field(default_factory=datetime.utcnow)

class AdoProject(AdoProjectBase, table=True):
    __tablename__ = "ado_projects"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
