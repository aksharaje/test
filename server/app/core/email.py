import os
from typing import List
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr, BaseModel
from pathlib import Path

# Config
class EmailSchema(BaseModel):
    email: List[EmailStr]

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USER", ""),
    MAIL_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    MAIL_FROM=os.getenv("SMTP_FROM", "noreply@ps-prototype.com"),
    MAIL_PORT=int(os.getenv("SMTP_PORT", 587)),
    MAIL_SERVER=os.getenv("SMTP_HOST", "localhost"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=bool(os.getenv("SMTP_USER")),
    VALIDATE_CERTS=False # For development mostly
)

async def send_magic_link(email: str, token: str):
    # In production, this link would point to the frontend verify route
    # e.g. https://app.example.com/auth/verify?token=...
    base_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
    link = f"{base_url}/auth/verify?token={token}"
    
    html = f"""
    <p>Click the link below to log in:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 15 minutes.</p>
    """

    message = MessageSchema(
        subject="Your Login Link",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    
    if not os.getenv("SMTP_HOST"):
        print(f"==================================================")
        print(f"[DEV] Magic Link for {email}: {link}")
        print(f"==================================================")
        return

    await fm.send_message(message)

async def send_invite_email(email: str, token: str, sender_name: str = "Admin"):
    base_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
    link = f"{base_url}/auth/join?token={token}"
    
    html = f"""
    <p>{sender_name} has invited you to join the team.</p>
    <p><a href="{link}">Click here to accept the invitation</a></p>
    """

    message = MessageSchema(
        subject="Team Invitation",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    
    if not os.getenv("SMTP_HOST"):
        print(f"==================================================")
        print(f"[DEV] Invite Link for {email}: {link}")
        print(f"==================================================")
        return

    await fm.send_message(message)
