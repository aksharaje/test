"""
Token Refresh Utilities

Centralized token refresh logic for Jira and ADO integrations.
Used by all services that make API calls to these providers.
"""

from datetime import datetime, timedelta
from typing import Optional
import httpx
from sqlmodel import Session

from app.models.jira import Integration
from app.core.config import settings


async def ensure_jira_token(db: Session, integration: Integration) -> Integration:
    """
    Ensures a Jira integration has a valid access token.
    If token is expired, attempts to refresh it using the refresh token.
    Updates the database with new tokens if refreshed.
    
    Args:
        db: Database session
        integration: The Jira integration to check/refresh
        
    Returns:
        The integration with valid token (may be refreshed)
        
    Raises:
        ValueError: If token refresh fails
    """
    if integration.provider != "jira":
        return integration
        
    # Check if token is still valid (with 5 minute buffer)
    if integration.token_expires_at:
        buffer = timedelta(minutes=5)
        if datetime.utcnow() + buffer < integration.token_expires_at:
            return integration
    
    # Token is expired or expiry unknown, try to refresh
    if not integration.refresh_token:
        integration.status = "expired"
        integration.error_message = "Token expired and no refresh token available. Please reconnect."
        db.add(integration)
        db.commit()
        db.refresh(integration)
        raise ValueError("Token expired and no refresh token available")
    
    try:
        async with httpx.AsyncClient() as client:
            refresh_response = await client.post(
                "https://auth.atlassian.com/oauth/token",
                json={
                    "grant_type": "refresh_token",
                    "client_id": settings.JIRA_CLIENT_ID,
                    "client_secret": settings.JIRA_CLIENT_SECRET,
                    "refresh_token": integration.refresh_token,
                }
            )
            
            if refresh_response.status_code != 200:
                integration.status = "expired"
                integration.error_message = "Failed to refresh token. Please reconnect."
                db.add(integration)
                db.commit()
                db.refresh(integration)
                raise ValueError(f"Token refresh failed: {refresh_response.text}")
            
            tokens = refresh_response.json()
            integration.access_token = tokens["access_token"]
            if "refresh_token" in tokens:
                integration.refresh_token = tokens["refresh_token"]
            integration.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            integration.status = "connected"
            integration.error_message = None
            db.add(integration)
            db.commit()
            db.refresh(integration)
            
            print(f"[TokenRefresh] Jira token refreshed for integration {integration.id}")
            return integration
            
    except httpx.RequestError as e:
        raise ValueError(f"Network error during token refresh: {str(e)}")


async def ensure_ado_token(db: Session, integration: Integration) -> Integration:
    """
    Ensures an ADO integration has a valid access token.
    If token is expired, attempts to refresh it using the refresh token.
    
    Args:
        db: Database session
        integration: The ADO integration to check/refresh
        
    Returns:
        The integration with valid token (may be refreshed)
        
    Raises:
        ValueError: If token refresh fails
    """
    if integration.provider != "ado":
        return integration
        
    # Check if token is still valid (with 5 minute buffer)
    if integration.token_expires_at:
        buffer = timedelta(minutes=5)
        if datetime.utcnow() + buffer < integration.token_expires_at:
            return integration
    
    # Token is expired or expiry unknown, try to refresh
    if not integration.refresh_token:
        integration.status = "expired"
        integration.error_message = "Token expired and no refresh token available. Please reconnect."
        db.add(integration)
        db.commit()
        db.refresh(integration)
        raise ValueError("Token expired and no refresh token available")
    
    try:
        async with httpx.AsyncClient() as client:
            refresh_response = await client.post(
                "https://app.vssps.visualstudio.com/oauth2/token",
                data={
                    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    "client_assertion": settings.ADO_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "assertion": integration.refresh_token,
                    "redirect_uri": settings.ADO_REDIRECT_URI,
                }
            )
            
            if refresh_response.status_code != 200:
                integration.status = "expired"
                integration.error_message = "Failed to refresh token. Please reconnect."
                db.add(integration)
                db.commit()
                db.refresh(integration)
                raise ValueError(f"Token refresh failed: {refresh_response.text}")
            
            tokens = refresh_response.json()
            integration.access_token = tokens["access_token"]
            if "refresh_token" in tokens:
                integration.refresh_token = tokens["refresh_token"]
            integration.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            integration.status = "connected"
            integration.error_message = None
            db.add(integration)
            db.commit()
            db.refresh(integration)
            
            print(f"[TokenRefresh] ADO token refreshed for integration {integration.id}")
            return integration
            
    except httpx.RequestError as e:
        raise ValueError(f"Network error during token refresh: {str(e)}")


async def ensure_valid_token(db: Session, integration: Integration) -> Integration:
    """
    Ensures an integration has a valid access token.
    Automatically detects provider and calls the appropriate refresh function.
    
    Args:
        db: Database session
        integration: The integration to check/refresh
        
    Returns:
        The integration with valid token (may be refreshed)
    """
    if integration.provider == "jira":
        return await ensure_jira_token(db, integration)
    elif integration.provider == "ado":
        return await ensure_ado_token(db, integration)
    return integration
