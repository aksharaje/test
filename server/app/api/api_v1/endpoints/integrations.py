from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
import httpx
from app.core.db import get_session
from app.core.config import settings
from app.services.jira_service import jira_service
from app.models.jira import Integration, FieldMapping
from app.services.llm_service import llm_service

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

    # Load mappings from database
    statement = select(FieldMapping).where(FieldMapping.integration_id == integration_id)
    mappings = session.exec(statement).all()

    return [
        {
            "ourField": m.our_field,
            "providerFieldId": m.provider_field_id,
            "providerFieldName": m.provider_field_name,
            "providerFieldType": m.provider_field_type,
            "confidence": m.confidence,
            "adminConfirmed": m.admin_confirmed
        }
        for m in mappings
    ]

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

    # Find existing mapping or create new one
    statement = select(FieldMapping).where(
        FieldMapping.integration_id == integration_id,
        FieldMapping.our_field == our_field
    )
    existing = session.exec(statement).first()

    if existing:
        existing.provider_field_id = payload.get("providerFieldId")
        existing.provider_field_name = payload.get("providerFieldName")
        existing.provider_field_type = payload.get("providerFieldType")
        existing.confidence = 100
        existing.admin_confirmed = True
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        mapping = existing
    else:
        mapping = FieldMapping(
            integration_id=integration_id,
            our_field=our_field,
            provider_field_id=payload.get("providerFieldId"),
            provider_field_name=payload.get("providerFieldName"),
            provider_field_type=payload.get("providerFieldType"),
            confidence=100,
            admin_confirmed=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(mapping)
        session.commit()
        session.refresh(mapping)

    return {
        "ourField": mapping.our_field,
        "providerFieldId": mapping.provider_field_id,
        "providerFieldName": mapping.provider_field_name,
        "providerFieldType": mapping.provider_field_type,
        "confidence": mapping.confidence,
        "adminConfirmed": mapping.admin_confirmed
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

    # Find and delete the mapping
    statement = select(FieldMapping).where(
        FieldMapping.integration_id == integration_id,
        FieldMapping.our_field == our_field
    )
    existing = session.exec(statement).first()

    if existing:
        session.delete(existing)
        session.commit()

    return {"success": True}

@router.post("/{integration_id}/mappings/auto-detect")
async def auto_detect_mappings(
    integration_id: int,
    session: Session = Depends(get_session)
) -> Any:
    """Use LLM to automatically detect field mappings based on field names."""
    integration = session.get(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Get provider fields
    provider_fields = []
    async with httpx.AsyncClient() as client:
        if integration.provider == "ado":
            provider_fields = [
                {"id": "System.Title", "name": "Title"},
                {"id": "System.Description", "name": "Description"},
                {"id": "Microsoft.VSTS.Scheduling.StoryPoints", "name": "Story Points"},
                {"id": "System.IterationPath", "name": "Iteration Path (Sprint)"},
                {"id": "System.AreaPath", "name": "Area Path (Team)"},
                {"id": "Microsoft.VSTS.Common.Priority", "name": "Priority"},
                {"id": "System.Tags", "name": "Tags"},
                {"id": "System.Parent", "name": "Parent"},
            ]
        elif integration.provider == "jira":
            headers = {
                "Authorization": f"Bearer {integration.access_token}",
                "Accept": "application/json"
            }
            response = await client.get(
                f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/field",
                headers=headers
            )
            if response.status_code == 200:
                provider_fields = [{"id": f["id"], "name": f["name"]} for f in response.json()]

    if not provider_fields:
        return {"mappings": [], "message": "No provider fields found"}

    # Our standard fields
    our_fields = [
        {"id": "story_points", "name": "Story Points", "description": "Numeric estimate of effort"},
        {"id": "sprint", "name": "Sprint/Iteration", "description": "The sprint or iteration the work belongs to"},
        {"id": "parent", "name": "Parent", "description": "Parent epic or feature"},
        {"id": "team", "name": "Team", "description": "The team responsible for the work"},
        {"id": "priority", "name": "Priority", "description": "Priority level of the work"},
        {"id": "labels", "name": "Labels/Tags", "description": "Tags or labels for categorization"},
        {"id": "components", "name": "Components", "description": "System components"},
    ]

    # Use LLM to match fields
    prompt = f"""Match the following source fields to target fields based on their names and purposes.

Source fields (our standard fields):
{[{"id": f["id"], "name": f["name"]} for f in our_fields]}

Target fields (provider fields):
{[{"id": f["id"], "name": f["name"]} for f in provider_fields[:50]]}

For each source field, find the best matching target field. Return a JSON array with objects containing:
- "ourField": the source field id
- "providerFieldId": the matched target field id (or null if no good match)
- "providerFieldName": the matched target field name (or null if no good match)
- "confidence": 0-100 score of how confident the match is

Only include matches with confidence >= 70. Return valid JSON array only, no explanation."""

    try:
        result = await llm_service.generate_json(
            prompt=prompt,
            system_message="You are a field mapping assistant. Match fields based on semantic similarity of names and purposes. Return only valid JSON."
        )

        suggested_mappings = result if isinstance(result, list) else []

        # Save high-confidence mappings (but don't overwrite admin-confirmed ones)
        for mapping in suggested_mappings:
            if mapping.get("confidence", 0) >= 80 and mapping.get("providerFieldId"):
                statement = select(FieldMapping).where(
                    FieldMapping.integration_id == integration_id,
                    FieldMapping.our_field == mapping["ourField"]
                )
                existing = session.exec(statement).first()

                if existing and existing.admin_confirmed:
                    continue  # Don't overwrite user-confirmed mappings

                if existing:
                    existing.provider_field_id = mapping["providerFieldId"]
                    existing.provider_field_name = mapping.get("providerFieldName", "")
                    existing.confidence = mapping["confidence"]
                    existing.updated_at = datetime.utcnow()
                    session.add(existing)
                else:
                    new_mapping = FieldMapping(
                        integration_id=integration_id,
                        our_field=mapping["ourField"],
                        provider_field_id=mapping["providerFieldId"],
                        provider_field_name=mapping.get("providerFieldName", ""),
                        confidence=mapping["confidence"],
                        admin_confirmed=False,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(new_mapping)

        session.commit()

        return {"mappings": suggested_mappings, "message": "Auto-detection complete"}

    except Exception as e:
        return {"mappings": [], "message": f"Auto-detection failed: {str(e)}"}

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
