from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select
from app.api import deps
from app.models.user import User, UserRole, UserCreate, UserLogin, DevUserRegister
from app.models.account import Account
from app.core import security
from app.core.config import settings
from datetime import datetime
import os

router = APIRouter()

# Allowed email domains for authentication
ALLOWED_DOMAINS = ["@ascendion.com", "@moodysnwc.com", "@nitorinfotech.com"]


def is_dev_mode() -> bool:
    """Check if running in dev mode (AUTH_ENABLED=false). Defaults to production (true) if not set."""
    return settings.AUTH_ENABLED.lower() != "true"


def is_allowed_domain(email_address: str) -> bool:
    """Check if email domain is in the allowed list."""
    email_lower = email_address.lower()
    return any(email_lower.endswith(domain) for domain in ALLOWED_DOMAINS)


@router.post("/login")
async def login(
    credentials: UserLogin,
    session: Session = Depends(deps.get_session)
):
    """
    Login with email and password.
    - Production: Requires password
    - Dev mode: Email only, auto-creates user if needed
    """
    email = credentials.email.lower().strip()

    if is_dev_mode():
        # Dev mode: email-only login
        user = session.exec(select(User).where(User.email == email)).first()

        if not user:
            # In dev mode, return special response indicating user needs to register
            return {
                "needs_registration": True,
                "email": email,
                "message": "User not found. Please register first."
            }

        if not user.is_active:
            raise HTTPException(status_code=400, detail="User account is disabled")

        # Create access token
        access_token = security.create_access_token(user.id)
        needs_onboarding = not user.full_name or not user.has_accepted_terms

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "is_new": False,
            "needs_onboarding": needs_onboarding
        }

    # Production mode: require password
    if not credentials.password:
        raise HTTPException(status_code=400, detail="Password is required")

    # Find user by email
    user = session.exec(select(User).where(User.email == email)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is disabled")

    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Verify password
    if not security.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create access token
    access_token = security.create_access_token(user.id)
    needs_onboarding = not user.full_name or not user.has_accepted_terms

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "is_new": False,
        "needs_onboarding": needs_onboarding
    }


@router.post("/dev-register")
async def dev_register(
    data: DevUserRegister,
    session: Session = Depends(deps.get_session)
):
    """
    Dev mode only: Self-registration with email and full name.
    Creates a new user without password.
    """
    if not is_dev_mode():
        raise HTTPException(
            status_code=403,
            detail="Self-registration is only available in development mode"
        )

    email = data.email.lower().strip()
    full_name = data.full_name.strip()

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    # Check if user already exists
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Create new user
    user = User(
        email=email,
        full_name=full_name,
        role=UserRole.ADMIN,  # Dev users get admin by default
        is_active=True,
        has_accepted_terms=True  # Skip terms in dev mode
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # Create access token
    access_token = security.create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "is_new": True,
        "needs_onboarding": False
    }


@router.post("/complete-profile")
async def complete_profile(
    full_name: str = Body(...),
    accept_terms: bool = Body(...),
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Complete user profile after first login (onboarding).
    """
    if not accept_terms:
        raise HTTPException(status_code=400, detail="Must accept terms of service")

    if not full_name or not full_name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    current_user.full_name = full_name.strip()
    current_user.has_accepted_terms = True
    current_user.updated_at = datetime.utcnow()

    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    return current_user


@router.get("/me")
async def read_users_me(current_user: User = Depends(deps.get_current_user)):
    return current_user


@router.get("/mode")
async def get_auth_mode():
    """
    Returns the current authentication mode.
    Frontend uses this to determine which login form to show.
    """
    return {
        "dev_mode": is_dev_mode(),
        "allowed_domains": ALLOWED_DOMAINS if not is_dev_mode() else []
    }


# ==================== Admin User Management ====================

@router.get("/users")
async def list_users(
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    List all users. Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    users = session.exec(select(User)).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "fullName": u.full_name,
            "role": u.role.value,
            "isActive": u.is_active,
            "createdAt": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]


@router.post("/users")
async def create_user(
    data: UserCreate,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Create a new user. Admin only.
    Returns the created user with the plain password (for admin to share).
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    email = data.email.lower().strip()

    # Validate email domain in production
    if not is_dev_mode() and not is_allowed_domain(email):
        raise HTTPException(
            status_code=400,
            detail="Email domain not allowed. Please use an email from an approved organization."
        )

    # Check if user already exists
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Create user with hashed password
    user = User(
        email=email,
        full_name=data.full_name.strip(),
        hashed_password=security.get_password_hash(data.password),
        role=data.role,
        is_active=True,
        has_accepted_terms=False  # User should accept on first login
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "role": user.role.value,
        "password": data.password,  # Return plain password for admin to share
        "message": "User created successfully. Share the password with the user."
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Delete a user. Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session.delete(user)
    session.commit()

    return {"message": "User deleted successfully"}


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Toggle user active status. Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "isActive": user.is_active,
        "message": f"User {'activated' if user.is_active else 'deactivated'} successfully"
    }


@router.patch("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    new_password: str = Body(..., embed=True),
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Reset a user's password. Admin only.
    Returns the new password for admin to share.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.hashed_password = security.get_password_hash(new_password)
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()

    return {
        "id": user.id,
        "email": user.email,
        "password": new_password,  # Return plain password for admin to share
        "message": "Password reset successfully. Share the new password with the user."
    }
