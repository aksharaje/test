import uuid
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from app.core.config import settings
from app.models.jira import Integration

# In-memory state store for OAuth
# Key: state, Value: {created_at: timestamp, return_url: string}
oauth_states: Dict[str, Dict[str, Any]] = {}

JIRA_SCOPES = [
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    "read:sprint:jira-software",
    "read:board-scope:jira-software",
    "read:project:jira",
    "offline_access",
]

class JiraService:
    def cleanup_expired_states(self):
        now = datetime.utcnow().timestamp()
        expired = [
            state for state, data in oauth_states.items()
            if now - data["created_at"] > 600  # 10 minutes
        ]
        for state in expired:
            del oauth_states[state]

    def get_oauth_url(self, return_url: Optional[str] = None) -> str:
        self.cleanup_expired_states()
        state = str(uuid.uuid4())
        
        oauth_states[state] = {
            "created_at": datetime.utcnow().timestamp(),
            "return_url": return_url
        }

        params = {
            "audience": "api.atlassian.com",
            "client_id": settings.JIRA_CLIENT_ID,
            "scope": " ".join(JIRA_SCOPES),
            "redirect_uri": settings.JIRA_REDIRECT_URI,
            "state": state,
            "response_type": "code",
            "prompt": "consent",
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"https://auth.atlassian.com/authorize?{query_string}"

    async def handle_oauth_callback(self, session: Session, code: str, state: str) -> Dict[str, Any]:
        # Validate state
        state_data = oauth_states.get(state)
        if not state_data:
            raise ValueError("Invalid or expired state")
        
        del oauth_states[state]
        return_url = state_data.get("return_url")

        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://auth.atlassian.com/oauth/token",
                json={
                    "grant_type": "authorization_code",
                    "client_id": settings.JIRA_CLIENT_ID,
                    "client_secret": settings.JIRA_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.JIRA_REDIRECT_URI,
                }
            )
            
            if token_response.status_code != 200:
                raise ValueError(f"Failed to exchange code for tokens: {token_response.text}")
            
            tokens = token_response.json()
            access_token = tokens["access_token"]
            refresh_token = tokens.get("refresh_token")
            expires_in = tokens.get("expires_in", 3600)

            # Get accessible resources
            resources_response = await client.get(
                "https://api.atlassian.com/oauth/token/accessible-resources",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }
            )

            if resources_response.status_code != 200:
                raise ValueError("Failed to get accessible resources")
            
            resources = resources_response.json()
            if not resources:
                raise ValueError("No accessible Jira sites found")
            
            # Use the first resource
            resource = resources[0]
            
            # Create or update integration
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            # Check if integration exists for this cloud_id
            statement = select(Integration).where(Integration.cloud_id == resource["id"])
            existing_integration = session.exec(statement).first()
            
            if existing_integration:
                existing_integration.name = resource["name"]
                existing_integration.base_url = resource["url"]
                existing_integration.access_token = access_token
                existing_integration.refresh_token = refresh_token
                existing_integration.token_expires_at = token_expires_at
                existing_integration.scopes = JIRA_SCOPES
                existing_integration.status = "connected"
                existing_integration.updated_at = datetime.utcnow()
                session.add(existing_integration)
                session.commit()
                session.refresh(existing_integration)
                integration = existing_integration
            else:
                integration = Integration(
                    provider="jira",
                    name=resource["name"],
                    base_url=resource["url"],
                    cloud_id=resource["id"],
                    auth_type="oauth",
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    scopes=JIRA_SCOPES,
                    status="connected"
                )
                session.add(integration)
                session.commit()
                session.refresh(integration)
            
            return {
                "integration": integration,
                "return_url": return_url
            }

    def list_integrations(self, session: Session) -> List[Integration]:
        statement = select(Integration).order_by(Integration.created_at.desc())
        return session.exec(statement).all()

    async def ensure_valid_token(self, session: Session, integration: Integration) -> Integration:
        """
        Ensures the integration has a valid access token.
        If token is expired, attempts to refresh it using the refresh token.
        Updates the database with new tokens if refreshed.
        
        Returns the updated integration or raises ValueError if refresh fails.
        """
        # Check if token is still valid (with 5 minute buffer)
        if integration.token_expires_at:
            buffer = timedelta(minutes=5)
            if datetime.utcnow() + buffer < integration.token_expires_at:
                # Token is still valid
                return integration
        
        # Token is expired or expiry unknown, try to refresh
        if not integration.refresh_token:
            integration.status = "expired"
            integration.error_message = "Token expired and no refresh token available. Please reconnect."
            session.add(integration)
            session.commit()
            session.refresh(integration)
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
                    session.add(integration)
                    session.commit()
                    session.refresh(integration)
                    raise ValueError(f"Token refresh failed: {refresh_response.text}")
                
                tokens = refresh_response.json()
                integration.access_token = tokens["access_token"]
                if "refresh_token" in tokens:
                    integration.refresh_token = tokens["refresh_token"]
                integration.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
                integration.status = "connected"
                integration.error_message = None
                session.add(integration)
                session.commit()
                session.refresh(integration)
                
                return integration
                
        except httpx.RequestError as e:
            raise ValueError(f"Network error during token refresh: {str(e)}")

    async def sync_integration(self, session: Session, integration_id: int) -> Optional[Integration]:
        integration = session.get(Integration, integration_id)
        if not integration:
            return None

        # Verify connection by calling Jira API
        try:
            async with httpx.AsyncClient() as client:
                # First try with current access token
                headers = {
                    "Authorization": f"Bearer {integration.access_token}",
                    "Accept": "application/json"
                }
                # Use accessible-resources endpoint (works with OAuth) instead of /me (requires read:me scope)
                response = await client.get(
                    "https://api.atlassian.com/oauth/token/accessible-resources",
                    headers=headers
                )

                if response.status_code == 401:
                    # Token expired, try to refresh
                    if integration.refresh_token:
                        refresh_response = await client.post(
                            "https://auth.atlassian.com/oauth/token",
                            json={
                                "grant_type": "refresh_token",
                                "client_id": settings.JIRA_CLIENT_ID,
                                "client_secret": settings.JIRA_CLIENT_SECRET,
                                "refresh_token": integration.refresh_token,
                            }
                        )

                        if refresh_response.status_code == 200:
                            tokens = refresh_response.json()
                            integration.access_token = tokens["access_token"]
                            if "refresh_token" in tokens:
                                integration.refresh_token = tokens["refresh_token"]
                            integration.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))

                            # Retry the API call with new token
                            headers["Authorization"] = f"Bearer {integration.access_token}"
                            response = await client.get(
                                "https://api.atlassian.com/oauth/token/accessible-resources",
                                headers=headers
                            )
                        else:
                            raise ValueError("Failed to refresh token")
                    else:
                        raise ValueError("No refresh token available")

                if response.status_code != 200:
                    raise ValueError(f"Jira API returned {response.status_code}")

                # If we get here, connection is good
                integration.status = "connected"
                integration.error_message = None
                integration.last_sync_at = datetime.utcnow()
                session.add(integration)
                session.commit()
                session.refresh(integration)
                return integration

        except Exception as e:
            integration.status = "error"
            integration.error_message = str(e)
            session.add(integration)
            session.commit()
            session.refresh(integration)
            return integration

jira_service = JiraService()
