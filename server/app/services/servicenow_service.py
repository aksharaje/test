from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import httpx
from sqlmodel import Session, select
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.models.jira import Integration

class ServiceNowService:
    def get_oauth_url(self, return_url: Optional[str] = None) -> str:
        # Placeholder for ServiceNow OAuth logic
        # In a real app, this would redirect to ServiceNow's auth page
        # For prototype, we'll simulate a callback
        base_url = "http://localhost:8000/api/integrations/servicenow/oauth/callback"
        return f"{base_url}?code=mock_servicenow_code&state=mock_state&return_url={return_url}"

    async def handle_oauth_callback(self, session: Session, code: str, state: str) -> Dict[str, Any]:
        # Simulate token exchange and user info fetch
        
        # Mock Data
        instance_url = "https://dev12345.service-now.com"
        instance_name = "ServiceNow Dev"
        
        # Create or update integration
        token_expires_at = datetime.utcnow() + timedelta(hours=1)
        
        # Check if integration exists
        statement = select(Integration).where(Integration.base_url == instance_url)
        existing_integration = session.exec(statement).first()
        
        if existing_integration:
            existing_integration.name = instance_name
            existing_integration.status = "connected"
            existing_integration.updated_at = datetime.utcnow()
            session.add(existing_integration)
            session.commit()
            session.refresh(existing_integration)
            integration = existing_integration
        else:
            integration = Integration(
                provider="servicenow",
                name=instance_name,
                base_url=instance_url,
                cloud_id="sn_12345",
                auth_type="oauth",
                access_token="mock_sn_token",
                token_expires_at=token_expires_at,
                scopes=["rest_api_explorer", "table_api"],
                status="connected"
            )
            session.add(integration)
            session.commit()
            session.refresh(integration)
            
        return {
            "integration": integration,
            "return_url": "/settings/integrations" # Simplified for mock
        }

servicenow_service = ServiceNowService()
