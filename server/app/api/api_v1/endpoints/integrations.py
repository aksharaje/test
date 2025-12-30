from typing import Any, Dict
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlmodel import Session
from app.core.db import get_session
from app.services.jira_service import jira_service

router = APIRouter()

@router.post("/jira/oauth/start")
def start_jira_oauth(payload: Dict[str, Any] = Body(...)) -> Any:
    return_url = payload.get("returnUrl")
    auth_url = jira_service.get_oauth_url(return_url)
    return {"authUrl": auth_url}

@router.get("/jira/oauth/callback")
async def jira_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: str = Query(None),
    session: Session = Depends(get_session)
) -> Any:
    if error:
        # Redirect to frontend with error
        return RedirectResponse(f"http://localhost:4200/settings/integrations?error={error}")
    
    try:
        result = await jira_service.handle_oauth_callback(session, code, state)
        integration = result["integration"]
        return_url = result["return_url"] or "/settings/integrations"
        
        # Ensure return_url starts with / if it's relative
        if not return_url.startswith("http"):
            if not return_url.startswith("/"):
                return_url = f"/{return_url}"
            return_url = f"http://localhost:4200{return_url}"
            
        return RedirectResponse(f"{return_url}?integration_id={integration.id}&success=true")
    except Exception as e:
        return RedirectResponse(f"http://localhost:4200/settings/integrations?error={str(e)}")

@router.get("")
def list_integrations(session: Session = Depends(get_session)) -> Any:
    return jira_service.list_integrations(session)

@router.post("/{integration_id}/sync")
async def sync_integration(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    integration = await jira_service.sync_integration(session, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration

@router.get("/jira/{integration_id}/projects")
def list_jira_projects(integration_id: int) -> Any:
    # return jira_service.list_projects(session, integration_id)
    return [
        {"key": "PROJ1", "name": "Project 1"},
        {"key": "PROJ2", "name": "Project 2"}
    ]

@router.get("/jira/{integration_id}/boards")
def list_jira_boards(integration_id: int) -> Any:
    return [
        {"id": 1, "name": "Board 1", "type": "scrum"},
        {"id": 2, "name": "Board 2", "type": "kanban"}
    ]

@router.get("/pi-planning/boards")
def list_pi_boards() -> Any:
    return []

@router.get("/split-tests")
def list_split_tests() -> Any:
    return []
