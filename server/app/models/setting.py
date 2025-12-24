from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel

class SystemSettingBase(SQLModel):
    key: str = Field(index=True, unique=True)
    value: str # Encrypted value
    is_encrypted: bool = True
    description: Optional[str] = None

class SystemSetting(SystemSettingBase, table=True):
    __tablename__ = "system_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
