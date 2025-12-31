"""
Test Script Writer API Endpoints

REST API for generating comprehensive test scripts from user stories.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select

from app.api.deps import get_db
from app.models.test_script_writer import (
    TestScriptWriterSession,
    TestScriptWriterSessionCreate,
    TestScriptWriterSessionResponse,
    SourceTypeOption,
    NfrOption,
    SessionStatus,
    SOURCE_TYPES,
    NFR_OPTIONS,
)
from app.models.story_generator import GeneratedArtifact
from app.services.test_script_writer_service import test_script_writer_service

router = APIRouter()


@router.get("/source-types", response_model=List[SourceTypeOption])
def get_source_types():
    """Get available source type options"""
    return [SourceTypeOption(**st) for st in SOURCE_TYPES]


@router.get("/nfr-options", response_model=List[NfrOption])
def get_nfr_options():
    """Get available NFR options"""
    return [NfrOption(**nfr) for nfr in NFR_OPTIONS]


@router.get("/artifacts/epics")
def get_epics(db: Session = Depends(get_db)):
    """Get available epics from story generator"""
    statement = (
        select(GeneratedArtifact)
        .where(GeneratedArtifact.type == "epic")
        .order_by(GeneratedArtifact.created_at.desc())
    )
    artifacts = db.exec(statement).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.input_description,
            "type": a.type,
        }
        for a in artifacts
    ]


@router.get("/artifacts/features")
def get_features(db: Session = Depends(get_db)):
    """Get available features from story generator"""
    statement = (
        select(GeneratedArtifact)
        .where(GeneratedArtifact.type == "feature")
        .order_by(GeneratedArtifact.created_at.desc())
    )
    artifacts = db.exec(statement).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.input_description,
            "type": a.type,
        }
        for a in artifacts
    ]


@router.get("/artifacts/user-stories")
def get_user_stories(db: Session = Depends(get_db)):
    """Get available user stories from story generator"""
    statement = (
        select(GeneratedArtifact)
        .where(GeneratedArtifact.type == "user_story")
        .order_by(GeneratedArtifact.created_at.desc())
    )
    artifacts = db.exec(statement).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.input_description,
            "type": a.type,
        }
        for a in artifacts
    ]


@router.get("/artifacts/{artifact_id}")
def get_artifact_details(artifact_id: int, db: Session = Depends(get_db)):
    """Get detailed artifact content for extracting stories"""
    artifact = db.get(GeneratedArtifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Parse content to extract user stories
    import json
    stories = []

    try:
        content = json.loads(artifact.content)

        if artifact.type == "epic":
            # Extract features and their stories from epic
            epic = content.get("epic", {})
            for feature in epic.get("features", []):
                for story in feature.get("userStories", []):
                    stories.append({
                        "id": story.get("id", ""),
                        "title": story.get("title", ""),
                        "description": story.get("description", ""),
                        "acceptance_criteria": story.get("acceptanceCriteria", []),
                    })

        elif artifact.type == "feature":
            # Extract stories from feature
            feature = content.get("feature", {})
            for story in feature.get("userStories", []):
                stories.append({
                    "id": story.get("id", ""),
                    "title": story.get("title", ""),
                    "description": story.get("description", ""),
                    "acceptance_criteria": story.get("acceptanceCriteria", []),
                })

        elif artifact.type == "user_story":
            # Single user story
            story = content.get("userStory", content.get("story", {}))
            stories.append({
                "id": story.get("id", str(artifact.id)),
                "title": story.get("title", artifact.title),
                "description": story.get("description", artifact.input_description),
                "acceptance_criteria": story.get("acceptanceCriteria", []),
            })

    except (json.JSONDecodeError, TypeError):
        # Fallback: use artifact directly as a story
        stories.append({
            "id": str(artifact.id),
            "title": artifact.title,
            "description": artifact.input_description,
            "acceptance_criteria": [],
        })

    return {
        "id": artifact.id,
        "title": artifact.title,
        "type": artifact.type,
        "stories": stories,
    }


@router.get("/sessions", response_model=List[TestScriptWriterSessionResponse])
def list_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List all test script writer sessions"""
    sessions = test_script_writer_service.list_sessions(db, skip=skip, limit=limit)
    return sessions


@router.post("/sessions", response_model=TestScriptWriterSessionResponse)
def create_session(
    data: TestScriptWriterSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new test script writer session and start generation"""
    session = test_script_writer_service.create_session(db, data)

    # Start generation in background
    background_tasks.add_task(
        test_script_writer_service.run_generation,
        db,
        session.id,
    )

    return session


@router.get("/sessions/{session_id}", response_model=TestScriptWriterSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get a specific session by ID"""
    session = test_script_writer_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/{session_id}/status", response_model=SessionStatus)
def get_session_status(session_id: int, db: Session = Depends(get_db)):
    """Get the status of a session"""
    session = test_script_writer_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionStatus(status=session.status, error_message=session.error_message)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a session"""
    success = test_script_writer_service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=TestScriptWriterSessionResponse)
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Retry a failed session"""
    session = test_script_writer_service.retry_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Start generation in background
    background_tasks.add_task(
        test_script_writer_service.run_generation,
        db,
        session.id,
    )

    return session
