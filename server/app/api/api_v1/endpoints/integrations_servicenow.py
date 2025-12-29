from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.servicenow_service import servicenow_service

router = APIRouter()

@router.post("/oauth/start")
def start_oauth(
    return_url: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    url = servicenow_service.get_oauth_url(return_url)
    return {"url": url}

@router.get("/oauth/callback")
async def oauth_callback(
    code: str,
    state: str = "mock_state",
    return_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        result = await servicenow_service.handle_oauth_callback(db, code, state)
        integration = result["integration"]
        final_return_url = return_url or "/settings/integrations"
        
        # Ensure return_url starts with / if it's relative
        if not final_return_url.startswith("http"):
            if not final_return_url.startswith("/"):
                final_return_url = f"/{final_return_url}"
            final_return_url = f"http://localhost:4200{final_return_url}"
            
        return RedirectResponse(f"{final_return_url}?integration_id={integration.id}&success=true")
    except Exception as e:
        print(f"ServiceNow OAuth Error: {e}")
        return RedirectResponse(f"http://localhost:4200/settings/integrations?error=Failed to connect ServiceNow")
