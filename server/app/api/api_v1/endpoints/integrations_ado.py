from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.ado_service import ado_service
from app.models.ado import AdoProject

router = APIRouter()

@router.post("/oauth/start")
def start_oauth(
    return_url: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """
    Start the ADO OAuth flow.
    """
    url = ado_service.get_oauth_url(return_url)
    return {"url": url}

@router.get("/oauth/callback")
async def oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """
    Handle the OAuth callback from ADO.
    """
    try:
        result = await ado_service.handle_oauth_callback(db, code, state)
        integration = result["integration"]
        return_url = result["return_url"] or "/settings/integrations"
        
        # Ensure return_url starts with / if it's relative
        if not return_url.startswith("http"):
            if not return_url.startswith("/"):
                return_url = f"/{return_url}"
            return_url = f"http://localhost:4200{return_url}"
            
        return RedirectResponse(f"{return_url}?integration_id={integration.id}&success=true")
    except ValueError as e:
        return RedirectResponse(f"http://localhost:4200/settings/integrations?error={str(e)}")
    except Exception as e:
        print(f"ADO OAuth Error: {e}")
        return RedirectResponse(f"http://localhost:4200/settings/integrations?error=Failed to complete ADO authentication")

@router.get("/{integration_id}/projects", response_model=List[AdoProject])
async def list_projects(
    integration_id: int,
    sync: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List cached projects or sync new ones.
    """
    try:
        if sync:
            return await ado_service.sync_projects(db, integration_id, user_id=current_user.id)
        else:
            return await ado_service.get_projects(db, integration_id, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
