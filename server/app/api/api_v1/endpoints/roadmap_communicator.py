"""
Roadmap Communicator API Endpoints

REST API for the Roadmap Communicator feature that generates
audience-tailored roadmap presentations with narratives and talking points.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session

from app.core.db import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.services.roadmap_communicator_service import RoadmapCommunicatorService
from app.models.roadmap_communicator import (
    CommunicatorSession,
    GeneratedPresentation,
    CommunicatorSessionCreate,
    CommunicatorSessionResponse,
    PresentationConfig,
    AUDIENCE_CONFIGS,
)

router = APIRouter()


def get_service(db: Session = Depends(get_session)) -> RoadmapCommunicatorService:
    return RoadmapCommunicatorService(db)


# ============================================================================
# Sessions
# ============================================================================

@router.post("/sessions")
def create_session(
    data: CommunicatorSessionCreate,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Create a new communicator session from a roadmap or scenario"""
    try:
        session = service.create_session(data, user_id=current_user.id)
        # Return as dict to avoid serialization issues
        return {
            "id": session.id,
            "userId": session.user_id,
            "roadmapSessionId": session.roadmap_session_id,
            "scenarioVariantId": session.scenario_variant_id,
            "name": session.name,
            "description": session.description,
            "status": session.status,
            "progressStep": session.progress_step,
            "progressTotal": session.progress_total,
            "progressMessage": session.progress_message,
            "errorMessage": session.error_message,
            "totalPresentations": session.total_presentations,
            "createdAt": session.created_at.isoformat() if session.created_at else None,
            "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
            "completedAt": session.completed_at.isoformat() if session.completed_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sessions", response_model=List[CommunicatorSession])
def list_sessions(
    roadmap_session_id: int = None,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """List all communicator sessions, optionally filtered by roadmap"""
    if roadmap_session_id:
        return service.get_sessions_for_roadmap(roadmap_session_id)
    return service.get_sessions(user_id=current_user.id)


def _presentation_to_camel(pres: GeneratedPresentation) -> Dict[str, Any]:
    """Convert presentation to camelCase dict including nested JSON fields"""
    from humps import camelize
    return {
        "id": pres.id,
        "sessionId": pres.session_id,
        "audienceType": pres.audience_type,
        "audienceName": pres.audience_name,
        "audienceProfile": camelize(pres.audience_profile) if pres.audience_profile else {},
        "presentationStrategy": camelize(pres.presentation_strategy) if pres.presentation_strategy else {},
        "visualizationData": camelize(pres.visualization_data) if pres.visualization_data else {},
        "narrative": camelize(pres.narrative) if pres.narrative else {},
        "talkingPoints": camelize(pres.talking_points) if pres.talking_points else {},
        "format": pres.format,
        "formattedContent": pres.formatted_content,
        "status": pres.status,
        "errorMessage": pres.error_message,
        "createdAt": pres.created_at.isoformat() if pres.created_at else None,
        "updatedAt": pres.updated_at.isoformat() if pres.updated_at else None,
    }


@router.get("/sessions/{session_id}")
def get_session_by_id(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Get a session with all presentations"""
    from humps import camelize
    # First check access via user_id scoped get_session
    session_check = service.get_session(session_id, user_id=current_user.id)
    if not session_check:
        raise HTTPException(status_code=404, detail="Session not found")
    result = service.get_full_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    # Convert to dict with camelCase nested JSON
    session = result.session
    return {
        "session": {
            "id": session.id,
            "userId": session.user_id,
            "roadmapSessionId": session.roadmap_session_id,
            "scenarioVariantId": session.scenario_variant_id,
            "name": session.name,
            "description": session.description,
            "sourceSnapshot": camelize(session.source_snapshot) if session.source_snapshot else {},
            "status": session.status,
            "progressStep": session.progress_step,
            "progressTotal": session.progress_total,
            "progressMessage": session.progress_message,
            "errorMessage": session.error_message,
            "totalPresentations": session.total_presentations,
            "createdAt": session.created_at.isoformat() if session.created_at else None,
            "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
            "completedAt": session.completed_at.isoformat() if session.completed_at else None,
        },
        "presentations": [_presentation_to_camel(p) for p in result.presentations]
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Delete a session and all its presentations"""
    # First check access via user_id scoped get_session
    session_check = service.get_session(session_id, user_id=current_user.id)
    if not session_check:
        raise HTTPException(status_code=404, detail="Session not found")
    if not service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Get session processing status (for polling)"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "status": session.status,
        "progressStep": session.progress_step,
        "progressTotal": session.progress_total,
        "progressMessage": session.progress_message,
        "errorMessage": session.error_message,
    }


# ============================================================================
# Presentations
# ============================================================================

@router.get("/sessions/{session_id}/presentations", response_model=List[GeneratedPresentation])
def get_presentations(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Get all presentations for a session"""
    # First check access via user_id scoped get_session
    session_check = service.get_session(session_id, user_id=current_user.id)
    if not session_check:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_presentations(session_id)


@router.post("/sessions/{session_id}/generate", response_model=GeneratedPresentation)
async def generate_presentation(
    session_id: int,
    config: PresentationConfig,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Generate a presentation for a specific audience"""
    try:
        # First check access via user_id scoped get_session
        session_check = service.get_session(session_id, user_id=current_user.id)
        if not session_check:
            raise HTTPException(status_code=404, detail="Session not found")
        return await service.generate_presentation(session_id, config)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/presentations/{presentation_id}", response_model=GeneratedPresentation)
def get_presentation(
    presentation_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Get a specific presentation"""
    presentation = service.get_presentation(presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    # Check access via user_id scoped get_session
    session_check = service.get_session(presentation.session_id, user_id=current_user.id)
    if not session_check:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return presentation


@router.delete("/presentations/{presentation_id}")
def delete_presentation(
    presentation_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Delete a presentation"""
    presentation = service.get_presentation(presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    # Check access via user_id scoped get_session
    session_check = service.get_session(presentation.session_id, user_id=current_user.id)
    if not session_check:
        raise HTTPException(status_code=404, detail="Presentation not found")
    if not service.delete_presentation(presentation_id):
        raise HTTPException(status_code=404, detail="Presentation not found")
    return {"status": "deleted"}


# ============================================================================
# Export
# ============================================================================

@router.get("/presentations/{presentation_id}/export/{format}")
def export_presentation(
    presentation_id: int,
    format: str,
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Export a presentation in various formats"""
    presentation = service.get_presentation(presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    # Check access via user_id scoped get_session
    session_check = service.get_session(presentation.session_id, user_id=current_user.id)
    if not session_check:
        raise HTTPException(status_code=404, detail="Presentation not found")

    if format not in ["markdown", "html", "json"]:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

    # Re-format if different from stored format
    if format != presentation.format:
        service_instance = service
        content = service_instance._format_presentation(presentation, format)
    else:
        content = presentation.formatted_content

    # Set appropriate content type
    content_types = {
        "markdown": "text/markdown",
        "html": "text/html",
        "json": "application/json",
    }

    filename = f"roadmap-{presentation.audience_type}-{presentation_id}.{format if format != 'markdown' else 'md'}"

    return Response(
        content=content,
        media_type=content_types.get(format, "text/plain"),
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# Audience Types
# ============================================================================

@router.get("/audience-types", response_model=List[Dict[str, Any]])
def get_audience_types(
    current_user: User = Depends(get_current_user),
    service: RoadmapCommunicatorService = Depends(get_service),
):
    """Get available audience types with their configurations"""
    return service.get_audience_types()
