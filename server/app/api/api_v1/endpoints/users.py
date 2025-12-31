from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select
from app.api import deps
from app.models.user import User, UserRole, UserUpdate
from app.models.account import Account, AccountInvite, InviteStatus
from app.core import security, email
import secrets
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/invite")
async def invite_user(
    email: str = Body(..., embed=True),
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Invite a user to the current user's account.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")
        
    if not current_user.account_id:
        # If admin has no account, create one on the fly? Or Error?
        # Let's assume Admin MUST have an account. If not, maybe create 'Default Account'
        # For now, create one if missing
        account = Account(name=f"{current_user.email}'s Team", owner_id=current_user.id)
        session.add(account)
        session.commit()
        session.refresh(account)
        current_user.account_id = account.id
        session.add(current_user)
    
    # Check if user already exists
    existing_user = session.exec(select(User).where(User.email == email)).first()
    if existing_user and existing_user.account_id == current_user.account_id:
        raise HTTPException(status_code=400, detail="User already in team")

    # Create Invite
    token = secrets.token_urlsafe(32)
    invite = AccountInvite(
        email=email,
        account_id=current_user.account_id,
        token=token,
        role="member",
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    session.add(invite)
    session.commit()
    
    # Send Email
    await email.send_invite_email(email, token, sender_name=current_user.name or "Admin")
    
    return {"message": "Invite sent"}

@router.post("/join")
async def join_team(
    token: str = Body(...),
    name: str = Body(...),
    accept_terms: bool = Body(...),
    session: Session = Depends(deps.get_session)
):
    """
    Accept an invitation and set up user profile.
    """
    if not accept_terms:
        raise HTTPException(status_code=400, detail="Must accept terms")
        
    # Verify Invite
    invite = session.exec(select(AccountInvite).where(AccountInvite.token == token)).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
        
    if invite.status != InviteStatus.PENDING:
         raise HTTPException(status_code=400, detail="Invite already accepted or invalid")
         
    if invite.expires_at < datetime.utcnow():
        invite.status = InviteStatus.EXPIRED
        session.add(invite)
        session.commit()
        raise HTTPException(status_code=400, detail="Invite expired")
        
    # Get or Create User
    user = session.exec(select(User).where(User.email == invite.email)).first()
    if not user:
        user = User(
            email=invite.email,
            role=UserRole.MEMBER, # From invite
            has_accepted_terms=True,
            full_name=name,
            account_id=invite.account_id
        )
    else:
        user.account_id = invite.account_id
        user.has_accepted_terms = True
        user.full_name = name
    
    invite.status = InviteStatus.ACCEPTED
    session.add(invite)
    session.add(user)
    session.commit()
    
    # Login user (return token)
    access_token = security.create_access_token(user.id)
    return {"access_token": access_token, "user": user}

@router.put("/me")
async def update_user_me(
    *,
    session: Session = Depends(deps.get_session),
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_user)
):
    """
    Update own user.
    """
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    
    current_user.updated_at = datetime.utcnow()
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user
