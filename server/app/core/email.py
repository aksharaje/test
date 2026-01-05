import os
from typing import Optional

# Try to import resend, fall back to None if not installed
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    resend = None


def _get_resend_client():
    """Initialize Resend client if API key is available."""
    api_key = os.getenv("RESEND_API_KEY")
    if api_key and RESEND_AVAILABLE:
        resend.api_key = api_key
        return True
    return False


async def send_magic_link(email: str, token: str):
    """Send magic link email for passwordless authentication."""
    # Debug: Show what env vars are set
    print(f"[EMAIL DEBUG] send_magic_link called for {email}")
    print(f"[EMAIL DEBUG] RESEND_API_KEY set: {bool(os.getenv('RESEND_API_KEY'))}")
    print(f"[EMAIL DEBUG] SMTP_HOST: {os.getenv('SMTP_HOST')}")
    print(f"[EMAIL DEBUG] SMTP_USER: {os.getenv('SMTP_USER')}")

    base_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
    link = f"{base_url}/auth/verify?token={token}"

    # Dev mode: print to console if no email provider configured
    if not os.getenv("RESEND_API_KEY") and not os.getenv("SMTP_HOST"):
        print(f"==================================================")
        print(f"[DEV] Magic Link for {email}: {link}")
        print(f"==================================================")
        return

    # Try Resend first
    if os.getenv("RESEND_API_KEY") and _get_resend_client():
        from_email = os.getenv("EMAIL_FROM", "onboarding@resend.dev")
        try:
            resend.Emails.send({
                "from": from_email,
                "to": [email],
                "subject": "Your Login Link",
                "html": f"""
                    <p>Click the link below to log in:</p>
                    <p><a href="{link}">{link}</a></p>
                    <p>This link expires in 15 minutes.</p>
                """
            })
            return
        except Exception as e:
            print(f"[ERROR] Resend failed: {e}")
            # Fall through to SMTP if Resend fails

    # Fallback to SMTP (fastapi-mail)
    if os.getenv("SMTP_HOST"):
        print(f"[EMAIL] Using SMTP: {os.getenv('SMTP_HOST')}:{os.getenv('SMTP_PORT')}")
        print(f"[EMAIL] From: {os.getenv('SMTP_FROM')}, To: {email}")
        try:
            from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

            conf = ConnectionConfig(
                MAIL_USERNAME=os.getenv("SMTP_USER", ""),
                MAIL_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
                MAIL_FROM=os.getenv("SMTP_FROM", "noreply@ps-prototype.com"),
                MAIL_PORT=int(os.getenv("SMTP_PORT", 587)),
                MAIL_SERVER=os.getenv("SMTP_HOST", "localhost"),
                MAIL_STARTTLS=True,
                MAIL_SSL_TLS=False,
                USE_CREDENTIALS=bool(os.getenv("SMTP_USER")),
                VALIDATE_CERTS=False
            )

            message = MessageSchema(
                subject="Your Login Link",
                recipients=[email],
                body=f"""
                    <p>Click the link below to log in:</p>
                    <p><a href="{link}">{link}</a></p>
                    <p>This link expires in 15 minutes.</p>
                """,
                subtype=MessageType.html
            )

            fm = FastMail(conf)
            await fm.send_message(message)
            print(f"[EMAIL] SMTP send successful to {email}")
            return
        except Exception as e:
            print(f"[EMAIL ERROR] SMTP failed: {e}")
            import traceback
            traceback.print_exc()

    # No email provider configured
    print(f"[WARN] No email provider configured. Magic link: {link}")


async def send_invite_email(email: str, token: str, sender_name: str = "Admin"):
    """Send team invitation email."""
    base_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
    link = f"{base_url}/auth/join?token={token}"

    html = f"""
        <p>{sender_name} has invited you to join the team.</p>
        <p><a href="{link}">Click here to accept the invitation</a></p>
    """

    # Dev mode
    if not os.getenv("RESEND_API_KEY") and not os.getenv("SMTP_HOST"):
        print(f"==================================================")
        print(f"[DEV] Invite Link for {email}: {link}")
        print(f"==================================================")
        return

    # Try Resend first
    if os.getenv("RESEND_API_KEY") and _get_resend_client():
        from_email = os.getenv("EMAIL_FROM", "onboarding@resend.dev")
        try:
            resend.Emails.send({
                "from": from_email,
                "to": [email],
                "subject": "Team Invitation",
                "html": html
            })
            return
        except Exception as e:
            print(f"[ERROR] Resend failed: {e}")

    # Fallback to SMTP
    if os.getenv("SMTP_HOST"):
        print(f"[EMAIL] Using SMTP for invite: {os.getenv('SMTP_HOST')}:{os.getenv('SMTP_PORT')}")
        try:
            from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

            conf = ConnectionConfig(
                MAIL_USERNAME=os.getenv("SMTP_USER", ""),
                MAIL_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
                MAIL_FROM=os.getenv("SMTP_FROM", "noreply@ps-prototype.com"),
                MAIL_PORT=int(os.getenv("SMTP_PORT", 587)),
                MAIL_SERVER=os.getenv("SMTP_HOST", "localhost"),
                MAIL_STARTTLS=True,
                MAIL_SSL_TLS=False,
                USE_CREDENTIALS=bool(os.getenv("SMTP_USER")),
                VALIDATE_CERTS=False
            )

            message = MessageSchema(
                subject="Team Invitation",
                recipients=[email],
                body=html,
                subtype=MessageType.html
            )

            fm = FastMail(conf)
            await fm.send_message(message)
            print(f"[EMAIL] SMTP invite send successful to {email}")
            return
        except Exception as e:
            print(f"[EMAIL ERROR] SMTP invite failed: {e}")
            import traceback
            traceback.print_exc()
