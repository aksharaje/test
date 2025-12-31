from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class MagicLink(SQLModel, table=True):
    __tablename__ = "magic_links"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    token: str = Field(unique=True, index=True)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
