"""
Dependency injection functions for FastAPI endpoints.
"""
from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from jose import jwt
from pydantic import ValidationError
import os

from app.core.db import get_session
from app.core import security
from app.models.user import User, UserRole

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/api/v1/auth/login"
)

def get_db() -> Generator[Session, None, None]:
    """
    Get database session dependency.
    Alias for get_session from core.db.
    """
    yield from get_session()


def get_current_user(
    session: Session = Depends(get_session),
    token: str = Depends(reusable_oauth2)
) -> User:
    """
    Get current authenticated user.
    Checks AUTH_ENABLED env var for dev bypass.
    Validates JWT token for real auth.
    """
    auth_enabled = os.getenv("AUTH_ENABLED", "true").lower() == "true"
    
    if not auth_enabled:
        # Development Bypass - use existing user or create dev user
        dev_email = os.getenv("DEV_USER_EMAIL", "ryanachin@gmail.com")
        dev_user = session.exec(select(User).where(User.email == dev_email)).first()
        if not dev_user:
            dev_user = User(
                email=dev_email,
                name="Development User",
                role=UserRole.ADMIN,
                is_active=True,
                full_name="Dev Admin"
            )
            session.add(dev_user)
            session.commit()
            session.refresh(dev_user)
        return dev_user

    try:
        payload = security.decode_token(token)
        if not payload:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Validate that the current user is an active superuser/admin.
    """
    if current_user.role != "admin" and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
