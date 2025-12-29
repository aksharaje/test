"""
Dependency injection functions for FastAPI endpoints.
"""
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from sqlmodel import Session

from app.core.db import get_session
from app.models.user import User


def get_db() -> Generator[Session, None, None]:
    """
    Get database session dependency.
    Alias for get_session from core.db.
    """
    yield from get_session()


def get_current_user() -> User:
    """
    Get current authenticated user.

    Note: This is a placeholder implementation.
    In a real app, this would validate JWT tokens, session cookies, etc.
    For now, returns a mock user for development.
    """
    # TODO: Implement proper authentication
    # This should decode JWT, validate session, etc.
    return User(
        id=1,
        email="dev@example.com",
        name="Development User",
    )
