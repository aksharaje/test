from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.models.jira import Integration

class QualtricsService:
    def get_oauth_url(self, return_url: Optional[str] = None) -> str:
        base_url = "http://localhost:8000/api/integrations/qualtrics/oauth/callback"
        return f"{base_url}?code=mock_qualtrics_code&state=mock_state&return_url={return_url}"

    async def handle_oauth_callback(self, session: Session, code: str, state: str) -> Dict[str, Any]:
        instance_url = "https://co1.qualtrics.com"
        instance_name = "Qualtrics XM"
        
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
                provider="qualtrics",
                name=instance_name,
                base_url=instance_url,
                cloud_id="qt_556677",
                auth_type="oauth",
                access_token="mock_qt_token",
                token_expires_at=datetime.utcnow() + timedelta(days=30),
                scopes=["read:surveys"],
                status="connected"
            )
            session.add(integration)
            session.commit()
            session.refresh(integration)
            
        return {
            "integration": integration,
            "return_url": "/settings/integrations"
        }

qualtrics_service = QualtricsService()
