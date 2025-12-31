from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select
from app.api import deps
from app.models.user import User, UserRole
from app.models.account import Account, AccountInvite, InviteStatus
from app.models.magic_link import MagicLink
from app.core import security, email
from app.core.email import send_magic_link
from datetime import datetime
import os

router = APIRouter()

@router.post("/login")
async def login(
    email: str = Body(..., embed=True),
    session: Session = Depends(deps.get_session)
):
    """
    Request a magic link implementation.
    """
    # Create magic token
    token = security.create_magic_link_token(email)
    
    # Store hash of token or token itself in DB to prevent reuse/validate
    # For simplicity storing the token directly (hashed in prod ideally)
    magic_link = MagicLink(
        email=email,
        token=token,
        expires_at=datetime.utcnow() + security.timedelta(minutes=15)
    )
    session.add(magic_link)
    session.commit()
    
    # Send email
    await send_magic_link(email, token)
    
    response = {"message": "Magic link sent"}
    
    # DEV MODE: Return link in response if no SMTP
    if not os.getenv("SMTP_HOST"):
        import urllib.parse
        base_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
        # Ensure token is URL safe mostly, but let's be safe
        encoded_token = urllib.parse.quote(token)
        response["dev_magic_link"] = f"{base_url}/auth/verify?token={encoded_token}"
        
    return response

@router.post("/verify")
async def verify_token(
    token: str = Body(..., embed=True),
    session: Session = Depends(deps.get_session)
):
    """
    Verify magic link token and return access token.
    """
    print(f"DEBUG: Verifying token: {token}")
    # 1. Verify JWT signature/expiry of the magic token
    payload = security.decode_token(token)
    if not payload or payload.get("type") != "magic":
        print(f"DEBUG: Payload invalid or not magic: {payload}")
        raise HTTPException(status_code=400, detail="Invalid token signature or expired")
    
    email = payload.get("sub")
    
    # 2. Check DB to see if used
    statement = select(MagicLink).where(MagicLink.token == token)
    link_record = session.exec(statement).first()
    
    if not link_record:
        print(f"DEBUG: Token not found in DB: {token}")
        # It might be deleted or never existed
        raise HTTPException(status_code=400, detail="Token not found or invalid")
        
    if link_record.used:
        print(f"DEBUG: Token already used: {token}")
        raise HTTPException(status_code=400, detail="Token already used")
        
    # Mark used
    link_record.used = True
    session.add(link_record)
    
    # 3. Get or Create User
    user_stmt = select(User).where(User.email == email)
    user = session.exec(user_stmt).first()
    
    is_new_user = False
    if not user:
        # Check if they have an invite waiting? 
        # For now, we allow sign up if they don't have an invite only if it's the specific flow
        # But let's say "Login" finds existing users, "Join" handles new ones via invite.
        # Actually, for magic link, typically it handles both.
        # Let's create a partial user if not exists, but maybe restrict access until they join an account?
        # For simplicity: Create basic user.
        user = User(email=email, role=UserRole.MEMBER) # Default Member, promoted if owner later
        session.add(user)
        session.commit() # Commit to get ID
        session.refresh(user)
        is_new_user = True
    
    session.commit()
    
    # 4. Create Access Token (Long lived session)
    access_token = security.create_access_token(user.id)
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user,
        "is_new": is_new_user
    }

@router.get("/me")
async def read_users_me(current_user: User = Depends(deps.get_current_user)):
    return current_user
