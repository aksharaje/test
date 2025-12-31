from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
import httpx
from app.core.db import get_session
from app.core.config import settings
from app.services.jira_service import jira_service
from app.models.jira import Integration

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

@router.get("/{integration_id}")
def get_integration(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    """Get a single integration by ID."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration

@router.delete("/{integration_id}")
def delete_integration(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    """Delete an integration."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    session.delete(integration)
    session.commit()
    return {"success": True}

@router.post("/{integration_id}/sync")
async def sync_integration(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    """Sync an integration - verifies connection and refreshes token if needed."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    try:
        async with httpx.AsyncClient() as client:
            if integration.provider == "ado":
                # ADO: Test connection by getting profile
                headers = {
                    "Authorization": f"Bearer {integration.access_token}",
                    "Accept": "application/json"
                }
                response = await client.get(
                    "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0",
                    headers=headers
                )

                if response.status_code == 401 and integration.refresh_token:
                    # Try to refresh token
                    refresh_response = await client.post(
                        "https://app.vssps.visualstudio.com/oauth2/token",
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                        data={
                            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                            "client_assertion": settings.ADO_CLIENT_SECRET,
                            "grant_type": "refresh_token",
                            "refresh_token": integration.refresh_token,
                            "redirect_uri": settings.ADO_REDIRECT_URI,
                        }
                    )

                    if refresh_response.status_code == 200:
                        tokens = refresh_response.json()
                        integration.access_token = tokens["access_token"]
                        if "refresh_token" in tokens:
                            integration.refresh_token = tokens["refresh_token"]
                        integration.token_expires_at = datetime.utcnow() + timedelta(seconds=int(tokens.get("expires_in", 3600)))

                        # Retry
                        headers["Authorization"] = f"Bearer {integration.access_token}"
                        response = await client.get(
                            "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0",
                            headers=headers
                        )
                    else:
                        raise ValueError("Failed to refresh ADO token")

                if response.status_code != 200:
                    raise ValueError(f"ADO API returned {response.status_code}")

            elif integration.provider == "jira":
                # Jira: Use existing sync logic
                return await jira_service.sync_integration(session, integration_id)
            else:
                # Other providers - just mark as connected for now
                pass

        # Success
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

@router.get("/{integration_id}/fields")
async def get_integration_fields(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    """Get available fields from the integration provider."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    try:
        async with httpx.AsyncClient() as client:
            if integration.provider == "ado":
                # ADO: Get work item fields
                # First we need to get the org from cloud_id or a project
                # For now, return standard ADO work item fields
                return [
                    {"id": "System.Title", "name": "Title", "key": "title", "custom": False, "schema": {"type": "string"}},
                    {"id": "System.Description", "name": "Description", "key": "description", "custom": False, "schema": {"type": "string"}},
                    {"id": "System.State", "name": "State", "key": "state", "custom": False, "schema": {"type": "string"}},
                    {"id": "System.AssignedTo", "name": "Assigned To", "key": "assignedTo", "custom": False, "schema": {"type": "user"}},
                    {"id": "Microsoft.VSTS.Scheduling.StoryPoints", "name": "Story Points", "key": "storyPoints", "custom": False, "schema": {"type": "number"}},
                    {"id": "System.IterationPath", "name": "Iteration Path (Sprint)", "key": "sprint", "custom": False, "schema": {"type": "string", "custom": "sprint"}},
                    {"id": "System.AreaPath", "name": "Area Path (Team)", "key": "team", "custom": False, "schema": {"type": "string"}},
                    {"id": "Microsoft.VSTS.Common.Priority", "name": "Priority", "key": "priority", "custom": False, "schema": {"type": "number"}},
                    {"id": "System.Tags", "name": "Tags", "key": "labels", "custom": False, "schema": {"type": "array"}},
                    {"id": "System.Parent", "name": "Parent", "key": "parent", "custom": False, "schema": {"type": "string", "custom": "parent"}},
                ]
            elif integration.provider == "jira":
                # Jira: Get fields from API
                headers = {
                    "Authorization": f"Bearer {integration.access_token}",
                    "Accept": "application/json"
                }
                response = await client.get(
                    f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/field",
                    headers=headers
                )

                if response.status_code != 200:
                    raise HTTPException(status_code=500, detail="Failed to fetch Jira fields")

                fields = response.json()
                return [
                    {
                        "id": f["id"],
                        "name": f["name"],
                        "key": f.get("key", f["id"]),
                        "custom": f.get("custom", False),
                        "schema": f.get("schema", {})
                    }
                    for f in fields
                ]
            else:
                return []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch fields: {str(e)}")

@router.get("/{integration_id}/mappings")
def get_field_mappings(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    """Get field mappings for an integration."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # For now, return empty mappings - can be extended with a FieldMapping model
    return []

@router.put("/{integration_id}/mappings/{our_field}")
def update_field_mapping(
    integration_id: int,
    our_field: str,
    payload: Dict[str, Any] = Body(...),
    session: Session = Depends(get_session)
) -> Any:
    """Update a field mapping."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # For now, return a mock response - can be extended with a FieldMapping model
    return {
        "ourField": our_field,
        "providerFieldId": payload.get("providerFieldId"),
        "providerFieldName": payload.get("providerFieldName"),
        "providerFieldType": payload.get("providerFieldType"),
        "confidence": 100,
        "adminConfirmed": True
    }

@router.delete("/{integration_id}/mappings/{our_field}")
def delete_field_mapping(
    integration_id: int,
    our_field: str,
    session: Session = Depends(get_session)
) -> Any:
    """Delete a field mapping."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    return {"success": True}

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
