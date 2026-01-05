from datetime import datetime
from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field

class UserRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"

class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    name: Optional[str] = None
    account_id: Optional[int] = Field(default=None, foreign_key="accounts.id")
    role: UserRole = Field(default=UserRole.ADMIN) # Default to admin for first user usually, logic to handle this later
    is_active: bool = Field(default=True)
    full_name: Optional[str] = None
    has_accepted_terms: bool = Field(default=False)
    hashed_password: Optional[str] = Field(default=None)  # None for dev mode users

class User(UserBase, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserUpdate(SQLModel):
    full_name: Optional[str] = None
    email: Optional[str] = None # Optional: allow email change? Maybe later.


class UserCreate(SQLModel):
    """Admin creates a user with these fields."""
    email: str
    full_name: str
    password: str
    role: UserRole = UserRole.MEMBER


class UserLogin(SQLModel):
    """Login request."""
    email: str
    password: Optional[str] = None  # Optional for dev mode


class DevUserRegister(SQLModel):
    """Dev mode self-registration."""
    email: str
    full_name: str
