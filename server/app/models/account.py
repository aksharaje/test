from datetime import datetime
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field

class AccountBase(SQLModel):
    name: str

class Account(AccountBase, table=True):
    __tablename__ = "accounts"
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InviteStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"

class AccountInvite(SQLModel, table=True):
    __tablename__ = "account_invites"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str
    account_id: int = Field(foreign_key="accounts.id")
    token: str = Field(unique=True, index=True)
    role: str = Field(default="member")
    status: InviteStatus = Field(default=InviteStatus.PENDING)
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
