"""
Roadmap Planner API Endpoints

REST API for the Roadmap Planner feature that transforms prioritized
backlog items into a sequenced, capacity-matched roadmap.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from sqlmodel import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.db import get_session
from app.services.roadmap_planner_service import RoadmapPlannerService
from app.models.roadmap_planner import (
    RoadmapSession,
    RoadmapItem,
    RoadmapItemSegment,
    RoadmapDependency,
    RoadmapTheme,
    RoadmapMilestone,
    RoadmapSessionCreate,
    RoadmapItemUpdate,
    RoadmapDependencyCreate,
    RoadmapMilestoneCreate,
    RoadmapMilestoneUpdate,
    RoadmapSegmentCreate,
    RoadmapSegmentUpdate,
    RoadmapSegmentBulkUpdate,
    RoadmapSessionResponse,
    AvailableArtifactForRoadmap,
    AvailableFeasibilityForRoadmap,
    AvailableIdeaForRoadmap,
    AllAvailableSourcesResponse,
    SprintSummary,
    DependencyGraph,
)

router = APIRouter()


def get_service(db: Session = Depends(get_session)) -> RoadmapPlannerService:
    return RoadmapPlannerService(db)


# ============================================================================
# Sessions
# ============================================================================

@router.post("/sessions", response_model=RoadmapSession)
def create_session(
    data: RoadmapSessionCreate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Create a new roadmap planning session"""
    return service.create_session(data, user_id=current_user.id)


@router.get("/sessions", response_model=List[RoadmapSession])
def list_sessions(
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """List all roadmap sessions"""
    return service.get_sessions(user_id=current_user.id)


@router.get("/sessions/{session_id}", response_model=RoadmapSessionResponse)
def get_session_by_id(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get a session with all its data"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return RoadmapSessionResponse(
        session=session,
        items=service.get_items(session_id),
        segments=service.get_segments(session_id),
        dependencies=service.get_dependencies(session_id),
        themes=service.get_themes(session_id),
        milestones=service.get_milestones(session_id),
    )


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Delete a session and all related data"""
    # Verify user has access to this session
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
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
# Pipeline
# ============================================================================

async def run_pipeline_task(session_id: int, db: Session):
    """Background task to run the pipeline"""
    service = RoadmapPlannerService(db)
    await service.run_pipeline(session_id)


@router.post("/sessions/{session_id}/generate")
async def generate_roadmap(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Start the roadmap generation pipeline"""
    service = RoadmapPlannerService(db)
    session = service.get_session(session_id, user_id=current_user.id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "processing":
        raise HTTPException(status_code=400, detail="Pipeline already running")

    # Run pipeline in background
    background_tasks.add_task(run_pipeline_task, session_id, db)

    return {"status": "started", "message": "Pipeline started in background"}


# ============================================================================
# Available Sources (Artifacts, Feasibility, Ideation)
# ============================================================================

@router.get("/available-sources", response_model=AllAvailableSourcesResponse)
def get_all_available_sources(
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all available sources for roadmap planning (epics, feasibility, ideation)"""
    return service.get_all_available_sources(user_id=current_user.id)


@router.get("/available-artifacts", response_model=List[AvailableArtifactForRoadmap])
def get_available_artifacts(
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get epics and features available for roadmap planning"""
    return service.get_available_artifacts(user_id=current_user.id)


@router.get("/available-feasibility", response_model=List[AvailableFeasibilityForRoadmap])
def get_available_feasibility(
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get completed feasibility analyses available for roadmap planning"""
    return service.get_available_feasibility_analyses(user_id=current_user.id)


@router.get("/available-ideation", response_model=List[AvailableIdeaForRoadmap])
def get_available_ideation(
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get ideation ideas available for roadmap planning"""
    return service.get_available_ideation_ideas(user_id=current_user.id)


# ============================================================================
# Items
# ============================================================================

@router.get("/sessions/{session_id}/items", response_model=List[RoadmapItem])
def get_items(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all items for a session"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_items(session_id)


@router.patch("/sessions/{session_id}/items/{item_id}", response_model=RoadmapItem)
def update_item(
    session_id: int,
    item_id: int,
    data: RoadmapItemUpdate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Update a roadmap item"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    item = service.update_item(item_id, data)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# ============================================================================
# Dependencies
# ============================================================================

@router.get("/sessions/{session_id}/dependencies", response_model=List[RoadmapDependency])
def get_dependencies(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all dependencies for a session"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_dependencies(session_id)


@router.post("/sessions/{session_id}/dependencies", response_model=RoadmapDependency)
def create_dependency(
    session_id: int,
    data: RoadmapDependencyCreate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Create a manual dependency"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.create_dependency(session_id, data)


@router.delete("/sessions/{session_id}/dependencies/{dep_id}")
def delete_dependency(
    session_id: int,
    dep_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Delete a dependency"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not service.delete_dependency(dep_id):
        raise HTTPException(status_code=404, detail="Dependency not found")
    return {"status": "deleted"}


@router.get("/sessions/{session_id}/dependency-graph", response_model=DependencyGraph)
def get_dependency_graph(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get dependency graph for visualization"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_dependency_graph(session_id)


# ============================================================================
# Themes
# ============================================================================

@router.get("/sessions/{session_id}/themes", response_model=List[RoadmapTheme])
def get_themes(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all themes for a session"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_themes(session_id)


# ============================================================================
# Milestones
# ============================================================================

@router.get("/sessions/{session_id}/milestones", response_model=List[RoadmapMilestone])
def get_milestones(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all milestones for a session"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_milestones(session_id)


@router.post("/sessions/{session_id}/milestones", response_model=RoadmapMilestone)
def create_milestone(
    session_id: int,
    data: RoadmapMilestoneCreate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Create a milestone"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.create_milestone(session_id, data)


@router.patch("/sessions/{session_id}/milestones/{milestone_id}", response_model=RoadmapMilestone)
def update_milestone(
    session_id: int,
    milestone_id: int,
    data: RoadmapMilestoneUpdate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Update a milestone"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    milestone = service.update_milestone(milestone_id, data)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return milestone


@router.delete("/sessions/{session_id}/milestones/{milestone_id}")
def delete_milestone(
    session_id: int,
    milestone_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Delete a milestone"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not service.delete_milestone(milestone_id):
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"status": "deleted"}


# ============================================================================
# Segments
# ============================================================================

@router.get("/sessions/{session_id}/segments", response_model=List[RoadmapItemSegment])
def get_segments(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all segments for a session"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_segments(session_id)


@router.get("/sessions/{session_id}/items/{item_id}/segments", response_model=List[RoadmapItemSegment])
def get_item_segments(
    session_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get all segments for a specific item"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_segments_for_item(item_id)


@router.post("/sessions/{session_id}/segments", response_model=RoadmapItemSegment)
def create_segment(
    session_id: int,
    data: RoadmapSegmentCreate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Create a new segment for an item"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        return service.create_segment(data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/sessions/{session_id}/segments/{segment_id}", response_model=RoadmapItemSegment)
def update_segment(
    session_id: int,
    segment_id: int,
    data: RoadmapSegmentUpdate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Update a segment"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    segment = service.update_segment(segment_id, data)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment


@router.put("/sessions/{session_id}/segments/bulk", response_model=List[RoadmapItemSegment])
def update_segments_bulk(
    session_id: int,
    data: RoadmapSegmentBulkUpdate,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Bulk update segments (for drag-and-drop operations)"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.update_segments_bulk(session_id, data)


@router.delete("/sessions/{session_id}/segments/{segment_id}")
def delete_segment(
    session_id: int,
    segment_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Delete a segment"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not service.delete_segment(segment_id):
        raise HTTPException(status_code=404, detail="Segment not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/items/{item_id}/regenerate-segments", response_model=List[RoadmapItemSegment])
def regenerate_item_segments(
    session_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Regenerate default segments for an item based on its current assignment"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    segments = service.regenerate_segments_for_item(item_id)
    if not segments:
        raise HTTPException(status_code=404, detail="Item not found")
    return segments


# ============================================================================
# Sprints
# ============================================================================

@router.get("/sessions/{session_id}/sprints", response_model=List[SprintSummary])
def get_sprint_summaries(
    session_id: int,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Get sprint-by-sprint breakdown"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return service.get_sprint_summaries(session_id)


# ============================================================================
# Export
# ============================================================================

@router.get("/sessions/{session_id}/export/{format}")
def export_roadmap(
    session_id: int,
    format: str,
    current_user: User = Depends(get_current_user),
    service: RoadmapPlannerService = Depends(get_service),
):
    """Export roadmap in various formats"""
    session = service.get_session(session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if format == "json":
        return service.export_roadmap_json(session_id)

    elif format == "csv":
        csv_content = service.export_roadmap_csv(session_id)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=roadmap-{session_id}.csv"}
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
