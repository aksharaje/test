"""
Test Script Writer API Endpoints

REST API for generating comprehensive test scripts from user stories.
"""
import json
import base64
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
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

    def extract_story(story_obj, index: int = 0):
        """Extract story data from story object"""
        return {
            "id": story_obj.get("id", str(index)),
            "title": story_obj.get("title", ""),
            # userStory field contains the "As a... I want... So that..." description
            "description": story_obj.get("userStory", story_obj.get("description", "")),
            "acceptance_criteria": story_obj.get("acceptanceCriteria", []),
        }

    try:
        content = json.loads(artifact.content)

        if artifact.type == "epic":
            # Extract features and their stories from epic
            # Structure: content.epic.features[].stories[]
            epic = content.get("epic", {})
            story_index = 0
            for feature in epic.get("features", []):
                for story in feature.get("stories", []):
                    stories.append(extract_story(story, story_index))
                    story_index += 1

        elif artifact.type == "feature":
            # Extract stories from feature
            # Structure: content.feature.stories[]
            feature = content.get("feature", {})
            for i, story in enumerate(feature.get("stories", [])):
                stories.append(extract_story(story, i))

        elif artifact.type == "user_story":
            # User story artifacts have an array of stories
            # Structure: content.stories[]
            for i, story in enumerate(content.get("stories", [])):
                stories.append(extract_story(story, i))

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
    return [TestScriptWriterSessionResponse.from_session(s) for s in sessions]


@router.post("/sessions", response_model=TestScriptWriterSessionResponse)
async def create_session(
    background_tasks: BackgroundTasks,
    data: str = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """Create a new test script writer session and start generation"""
    # Parse the JSON data
    if not data:
        raise HTTPException(status_code=400, detail="Missing request data")

    try:
        parsed_data = json.loads(data)
        session_data = TestScriptWriterSessionCreate(**parsed_data)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")

    # Process uploaded images
    image_data = []
    for file in files:
        if file.filename and file.content_type and file.content_type.startswith('image/'):
            content = await file.read()
            # Encode as base64 for LLM consumption
            b64_content = base64.b64encode(content).decode('utf-8')
            image_data.append({
                'filename': file.filename,
                'content_type': file.content_type,
                'data': b64_content,
            })

    session = test_script_writer_service.create_session(db, session_data, image_data)

    # Start generation in background
    background_tasks.add_task(
        test_script_writer_service.run_generation,
        db,
        session.id,
    )

    return TestScriptWriterSessionResponse.from_session(session)


@router.get("/sessions/{session_id}", response_model=TestScriptWriterSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get a specific session by ID"""
    session = test_script_writer_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return TestScriptWriterSessionResponse.from_session(session)


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

    return TestScriptWriterSessionResponse.from_session(session)
