from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class UserActivity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    feature_key: str = Field(index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata_json: Optional[str] = Field(default=None) # JSON string for any extra info
