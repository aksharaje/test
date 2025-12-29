"""
Release Prep API Endpoints

REST API for the Release Prep Agent that generates release artifacts
from user stories.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.core.db import get_session, engine
from app.models.release_prep import (
    ReleasePrepSession,
    ReleasePrepSessionCreate,
    ReleaseNote,
    ReleaseNoteUpdate,
    Decision,
    DecisionUpdate,
    TechnicalDebtItem,
    TechnicalDebtItemUpdate,
    TechnicalDebtItemCreate,
    AvailableStory,
)
from app.services.release_prep_service import ReleasePrepService

router = APIRouter()


def get_service(db: Session = Depends(get_session)) -> ReleasePrepService:
    return ReleasePrepService(db)


# =============================================================================
# Session Endpoints
# =============================================================================

@router.post("/sessions", response_model=ReleasePrepSession)
def create_session(
    data: ReleasePrepSessionCreate,
    service: ReleasePrepService = Depends(get_service)
):
    """Create a new release prep session"""
    return service.create_session(data)


@router.get("/sessions", response_model=List[ReleasePrepSession])
def list_sessions(
    service: ReleasePrepService = Depends(get_service)
):
    """List all release prep sessions"""
    return service.get_sessions()


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Get a session with all its artifacts"""
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session": session,
        "stories": service.get_session_stories(session_id),
        "releaseNotes": service.get_release_notes(session_id),
        "decisions": service.get_decisions(session_id),
        "debtItems": service.get_debt_items(session_id),
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Delete a session and all its artifacts"""
    if not service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


# =============================================================================
# Available Stories (from Story Generator)
# =============================================================================

@router.get("/stories/available", response_model=List[AvailableStory])
def get_available_stories(
    service: ReleasePrepService = Depends(get_service)
):
    """Get stories from Story Generator available for selection"""
    return service.get_available_stories()


# =============================================================================
# Pipeline Execution
# =============================================================================

import asyncio

def run_pipeline_task(session_id: int):
    """Background task to run the pipeline"""
    # Create a new database session for the background task
    with Session(engine) as db:
        service = ReleasePrepService(db)
        # Run the async pipeline in a new event loop
        asyncio.run(service.run_pipeline(session_id))


@router.post("/sessions/{session_id}/run")
async def run_pipeline(
    session_id: int,
    background_tasks: BackgroundTasks,
    service: ReleasePrepService = Depends(get_service)
):
    """Run the release prep pipeline for a session"""
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "processing":
        raise HTTPException(status_code=400, detail="Pipeline already running")

    # Run pipeline in background
    background_tasks.add_task(run_pipeline_task, session_id)

    return {"status": "started", "sessionId": session_id}


@router.get("/sessions/{session_id}/status")
def get_pipeline_status(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Get the current pipeline status for a session"""
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "status": session.status,
        "progressStep": session.progress_step,
        "progressTotal": session.progress_total,
        "progressMessage": session.progress_message,
        "errorMessage": session.error_message,
    }


# =============================================================================
# Release Notes Endpoints
# =============================================================================

@router.get("/sessions/{session_id}/release-notes", response_model=List[ReleaseNote])
def get_release_notes(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Get all release notes for a session"""
    return service.get_release_notes(session_id)


@router.patch("/release-notes/{note_id}", response_model=ReleaseNote)
def update_release_note(
    note_id: int,
    data: ReleaseNoteUpdate,
    service: ReleasePrepService = Depends(get_service)
):
    """Update a release note"""
    note = service.update_release_note(note_id, data)
    if not note:
        raise HTTPException(status_code=404, detail="Release note not found")
    return note


# =============================================================================
# Decision Log Endpoints
# =============================================================================

@router.get("/sessions/{session_id}/decisions", response_model=List[Decision])
def get_decisions(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Get all decisions for a session"""
    return service.get_decisions(session_id)


@router.patch("/decisions/{decision_id}", response_model=Decision)
def update_decision(
    decision_id: int,
    data: DecisionUpdate,
    service: ReleasePrepService = Depends(get_service)
):
    """Update a decision"""
    decision = service.update_decision(decision_id, data)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


# =============================================================================
# Technical Debt Endpoints
# =============================================================================

@router.get("/sessions/{session_id}/debt-items", response_model=List[TechnicalDebtItem])
def get_debt_items(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Get all technical debt items for a session"""
    return service.get_debt_items(session_id)


@router.post("/sessions/{session_id}/debt-items", response_model=TechnicalDebtItem)
def create_debt_item(
    session_id: int,
    data: TechnicalDebtItemCreate,
    service: ReleasePrepService = Depends(get_service)
):
    """Create a new technical debt item manually"""
    try:
        return service.create_debt_item(session_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/debt-items/{item_id}", response_model=TechnicalDebtItem)
def update_debt_item(
    item_id: int,
    data: TechnicalDebtItemUpdate,
    service: ReleasePrepService = Depends(get_service)
):
    """Update a technical debt item"""
    item = service.update_debt_item(item_id, data)
    if not item:
        raise HTTPException(status_code=404, detail="Debt item not found")
    return item


# =============================================================================
# Export Endpoints
# =============================================================================

@router.get("/sessions/{session_id}/export/release-notes")
def export_release_notes(
    session_id: int,
    format: str = "markdown",
    service: ReleasePrepService = Depends(get_service)
):
    """Export release notes as markdown or HTML"""
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    markdown = service.export_release_notes_markdown(session_id)

    if format == "html":
        # Simple markdown to HTML conversion for basic formatting
        import re
        html = markdown
        html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
        html = re.sub(r'\n\n', r'</p><p>', html)
        html = f'<div class="release-notes"><p>{html}</p></div>'
        return {"format": "html", "content": html}

    return {"format": "markdown", "content": markdown}


@router.get("/sessions/{session_id}/export/decision-log")
def export_decision_log(
    session_id: int,
    format: str = "markdown",
    service: ReleasePrepService = Depends(get_service)
):
    """Export decision log as markdown"""
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    markdown = service.export_decision_log_markdown(session_id)
    return {"format": "markdown", "content": markdown}


@router.get("/sessions/{session_id}/export/debt-inventory")
def export_debt_inventory(
    session_id: int,
    format: str = "markdown",
    service: ReleasePrepService = Depends(get_service)
):
    """Export technical debt inventory as markdown"""
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    markdown = service.export_debt_inventory_markdown(session_id)
    return {"format": "markdown", "content": markdown}


# =============================================================================
# Release Tracking Endpoints
# =============================================================================

@router.post("/artifacts/{artifact_id}/unrelease")
def unrelease_artifact(
    artifact_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Remove released status from an artifact so it can be included in future releases"""
    success = service.unrelease_artifact(artifact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return {"success": True, "message": "Artifact unreleased"}


@router.post("/sessions/{session_id}/unrelease-all")
def unrelease_session_artifacts(
    session_id: int,
    service: ReleasePrepService = Depends(get_service)
):
    """Remove released status from all artifacts in a session"""
    count = service.unrelease_session_artifacts(session_id)
    return {"success": True, "count": count, "message": f"{count} artifacts unreleased"}
