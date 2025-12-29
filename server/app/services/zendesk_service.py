from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.models.jira import Integration

class ZendeskService:
    def get_oauth_url(self, return_url: Optional[str] = None) -> str:
        base_url = "http://localhost:8000/api/integrations/zendesk/oauth/callback"
        return f"{base_url}?code=mock_zendesk_code&state=mock_state&return_url={return_url}"

    async def handle_oauth_callback(self, session: Session, code: str, state: str) -> Dict[str, Any]:
        instance_url = "https://d3v-support.zendesk.com"
        instance_name = "Zendesk Support"
        
        statement = select(Integration).where(Integration.base_url == instance_url)
        existing_integration = session.exec(statement).first()
        
        if existing_integration:
            existing_integration.status = "connected"
            session.add(existing_integration)
            session.commit()
            session.refresh(existing_integration)
            integration = existing_integration
        else:
            integration = Integration(
                provider="zendesk",
                name=instance_name,
                base_url=instance_url,
                cloud_id="zd_998877",
                auth_type="oauth",
                access_token="mock_zd_token",
                token_expires_at=datetime.utcnow() + timedelta(days=30),
                scopes=["read", "write"],
                status="connected"
            )
            session.add(integration)
            session.commit()
            session.refresh(integration)
            
        return {
            "integration": integration,
            "return_url": "/settings/integrations"
        }

zendesk_service = ZendeskService()
