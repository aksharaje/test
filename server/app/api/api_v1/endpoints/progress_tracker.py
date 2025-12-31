"""
Progress & Blocker Tracker API Endpoints

Provides endpoints for sprint progress tracking and blocker detection.
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.db import get_session as get_db_session
from app.models.progress_tracker import (
    CreateSessionRequest,
    UpdateSessionRequest,
    SessionResponse,
    MetricsResponse,
    BlockersResponse,
    SyncStatusResponse,
    IntegrationCheckResponse,
    SprintOption,
    TemplateInfo,
    TrackedWorkItem,
    TRACKER_TEMPLATES,
)
from app.services.progress_tracker_service import get_progress_tracker_service

router = APIRouter()


# =============================================================================
# INTEGRATION & TEMPLATE ENDPOINTS
# =============================================================================


@router.get("/integrations/check", response_model=IntegrationCheckResponse)
async def check_integrations(
    session: Session = Depends(get_db_session),
) -> IntegrationCheckResponse:
    """
    Check if user has valid Jira or ADO integrations.

    Returns whether the user can use the Progress Tracker and lists
    available integrations. If no valid integration exists, provides
    a message directing user to the integrations page.
    """
    service = get_progress_tracker_service(session)
    return service.check_integrations()


@router.get("/templates", response_model=List[TemplateInfo])
async def list_templates(
    provider: Optional[str] = Query(None, description="Filter by provider (jira, ado)"),
    session: Session = Depends(get_db_session),
) -> List[TemplateInfo]:
    """
    List available configuration templates.

    Templates provide pre-configured blocker detection rules and
    status mappings for common PM tool configurations.
    """
    service = get_progress_tracker_service(session)
    return service.get_templates(provider)


@router.get("/integrations/{integration_id}/sprints", response_model=List[SprintOption])
async def get_available_sprints(
    integration_id: int,
    session: Session = Depends(get_db_session),
) -> List[SprintOption]:
    """
    Get available sprints/iterations from an integration.

    Fetches the list of sprints (Jira) or iterations (ADO) that
    can be tracked.
    """
    service = get_progress_tracker_service(session)
    try:
        return await service.get_available_sprints(integration_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sprints: {str(e)}")


# =============================================================================
# SESSION CRUD ENDPOINTS
# =============================================================================


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    data: CreateSessionRequest,
    session: Session = Depends(get_db_session),
) -> SessionResponse:
    """
    Create a new progress tracker session.

    Requires a connected Jira or ADO integration. The session will
    track items based on the specified sprint filter and template.
    """
    service = get_progress_tracker_service(session)
    try:
        tracker_session = service.create_session(data)
        return service.get_session_response(tracker_session.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    session: Session = Depends(get_db_session),
) -> List[SessionResponse]:
    """
    List all progress tracker sessions.

    Returns sessions ordered by last updated, with integration details.
    """
    service = get_progress_tracker_service(session)
    return service.list_sessions()


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> SessionResponse:
    """
    Get a specific progress tracker session.

    Returns full session details including cached metrics.
    """
    service = get_progress_tracker_service(session)
    result = service.get_session_response(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    data: UpdateSessionRequest,
    session: Session = Depends(get_db_session),
) -> SessionResponse:
    """
    Update a progress tracker session.

    Can update name, template, sprint filter, or blocker configuration.
    """
    service = get_progress_tracker_service(session)
    try:
        updated = service.update_session(session_id, data)
        if not updated:
            raise HTTPException(status_code=404, detail="Session not found")
        return service.get_session_response(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Delete a progress tracker session.

    Also deletes all tracked items associated with the session.
    """
    service = get_progress_tracker_service(session)
    if not service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


# =============================================================================
# SYNC & DATA ENDPOINTS
# =============================================================================


@router.post("/sessions/{session_id}/sync", response_model=SyncStatusResponse)
async def sync_session(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> SyncStatusResponse:
    """
    Trigger data sync for a session.

    Fetches latest data from the integration, detects blockers,
    and computes metrics. This may take several seconds.
    """
    service = get_progress_tracker_service(session)
    try:
        return await service.sync_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/sessions/{session_id}/status", response_model=SyncStatusResponse)
async def get_sync_status(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> SyncStatusResponse:
    """
    Get current sync status for a session.

    Use this to poll for sync completion after triggering a sync.
    """
    service = get_progress_tracker_service(session)
    tracker_session = service.get_session(session_id)
    if not tracker_session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SyncStatusResponse(
        session_id=session_id,
        status=tracker_session.status,
        progress_step=tracker_session.progress_step,
        progress_total=tracker_session.progress_total,
        progress_message=tracker_session.progress_message,
        error_message=tracker_session.error_message,
        items_synced=tracker_session.items_synced,
        last_sync_at=tracker_session.last_sync_at,
    )


@router.get("/sessions/{session_id}/metrics", response_model=MetricsResponse)
async def get_metrics(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> MetricsResponse:
    """
    Get computed metrics for a session.

    Returns item counts, point totals, completion percentages,
    and breakdowns by type and assignee.
    """
    service = get_progress_tracker_service(session)
    result = service.get_metrics(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/blockers", response_model=BlockersResponse)
async def get_blockers(
    session_id: int,
    session: Session = Depends(get_db_session),
) -> BlockersResponse:
    """
    Get blocked items for a session.

    Returns items detected as blocked, sorted by confidence score.
    Includes blocker reasons and contributing signals.
    """
    service = get_progress_tracker_service(session)
    result = service.get_blockers(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions/{session_id}/items", response_model=List[TrackedWorkItem])
async def get_items(
    session_id: int,
    status_category: Optional[str] = Query(None, description="Filter by status category (todo, in_progress, done)"),
    is_blocked: Optional[bool] = Query(None, description="Filter by blocker status"),
    session: Session = Depends(get_db_session),
) -> List[TrackedWorkItem]:
    """
    Get tracked work items for a session.

    Can filter by status category or blocker status.
    """
    service = get_progress_tracker_service(session)

    # Verify session exists
    tracker_session = service.get_session(session_id)
    if not tracker_session:
        raise HTTPException(status_code=404, detail="Session not found")

    return service.get_items(session_id, status_category, is_blocked)


# =============================================================================
# BLOCKER CONFIGURATION
# =============================================================================


@router.put("/sessions/{session_id}/blocker-config")
async def update_blocker_config(
    session_id: int,
    config: dict,
    session: Session = Depends(get_db_session),
) -> dict:
    """
    Update blocker detection configuration for a session.

    Allows customizing which signals are used and their weights.
    """
    service = get_progress_tracker_service(session)
    try:
        updated = service.update_session(
            session_id,
            UpdateSessionRequest(blocker_config=config),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"success": True, "blocker_config": config}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
