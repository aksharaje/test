"""
Story-to-Code Generator API Endpoints

Converts user stories into production-ready code using AI.
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.core.db import get_session
from app.services.story_to_code_service import story_to_code_service

router = APIRouter()


# --- Request/Response Models ---

class CreateSessionRequest(BaseModel):
    """Request model for creating a new session."""
    model_config = {"populate_by_name": True}

    title: Optional[str] = None
    input_description: str = Field(..., alias="inputDescription", description="User stories and requirements")
    input_source: str = Field(default="manual", alias="inputSource")  # 'manual', 'artifact'
    source_artifact_id: Optional[int] = Field(default=None, alias="sourceArtifactId")
    tech_stack: Optional[str] = Field(default=None, alias="techStack")
    knowledge_base_ids: List[int] = Field(default=[], alias="knowledgeBaseIds")
    user_id: Optional[int] = Field(default=None, alias="userId")


class LegacyGenerateRequest(BaseModel):
    """Legacy request model for backwards compatibility."""
    model_config = {"populate_by_name": True}

    title: Optional[str] = None
    stories: str = Field(..., description="User stories and requirements to convert to code")
    tech_stack: Optional[str] = Field(default=None, alias="techStack")
    knowledge_base_ids: List[int] = Field(default=[], alias="knowledgeBaseIds")
    user_id: Optional[int] = Field(default=None, alias="userId")


# --- Source Data Endpoints (must be before /{id} routes) ---

@router.get("/artifacts", response_model=List[Any])
def list_story_artifacts(
    user_id: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """List user story artifacts (epics, features, user stories) for selection."""
    artifacts = story_to_code_service.list_story_artifacts(db, user_id=user_id)
    return [
        {
            "id": a.id,
            "type": a.type,
            "title": a.title,
            "description": a.content[:500] if a.content else "",
            "createdAt": a.created_at.isoformat() if a.created_at else None
        }
        for a in artifacts
    ]


@router.get("/knowledge-bases", response_model=List[Any])
def list_code_knowledge_bases(
    user_id: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """List knowledge bases with code/GitHub content."""
    kbs = story_to_code_service.list_code_knowledge_bases(db, user_id=user_id)
    return [
        {
            "id": kb.id,
            "name": kb.name,
            "description": kb.description,
            "documentCount": kb.documentCount,
            "totalChunks": kb.totalChunks,
            "createdAt": kb.createdAt.isoformat() if kb.createdAt else None
        }
        for kb in kbs
    ]


# --- Session-Based Endpoints ---

@router.post("/sessions", response_model=Any)
def create_session(
    request: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session)
):
    """
    Create a new story-to-code session.

    Creates the session and starts async processing in the background.
    Returns the session immediately so client can poll for status.
    """
    try:
        session = story_to_code_service.create_session(
            db=db,
            input_description=request.input_description,
            title=request.title,
            input_source=request.input_source,
            source_artifact_id=request.source_artifact_id,
            tech_stack=request.tech_stack,
            knowledge_base_ids=request.knowledge_base_ids,
            user_id=request.user_id
        )

        # Process in background
        background_tasks.add_task(
            story_to_code_service.process_session,
            db,
            session.id
        )

        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions", response_model=List[Any])
def list_sessions(
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_session)
):
    """List story-to-code sessions with pagination."""
    return story_to_code_service.list_sessions(db, user_id=user_id, skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=Any)
def get_session(
    session_id: int,
    db: Session = Depends(get_session)
):
    """Get a specific session by ID."""
    session = story_to_code_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_session)
):
    """Delete a session."""
    success = story_to_code_service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/retry", response_model=Any)
def retry_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session)
):
    """Retry a failed session."""
    session = story_to_code_service.retry_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reprocess in background
    background_tasks.add_task(
        story_to_code_service.process_session,
        db,
        session.id
    )

    return session


@router.get("/sessions/{session_id}/download")
def download_session_zip(
    session_id: int,
    db: Session = Depends(get_session)
):
    """Download generated code as a ZIP file."""
    session = story_to_code_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session not yet completed")

    zip_bytes = story_to_code_service.create_zip(session)
    if not zip_bytes:
        raise HTTPException(status_code=500, detail="Failed to create ZIP file")

    # Sanitize filename
    title = session.title or "generated_code"
    filename = f"{title.replace(' ', '_').replace('/', '_')}.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# --- Legacy Endpoints (Backwards Compatibility) ---
# These must come AFTER all static routes

@router.post("/generate", response_model=Any)
def generate_code(
    request: LegacyGenerateRequest,
    db: Session = Depends(get_session)
):
    """
    [LEGACY] Generate code from user stories.

    Takes user stories/requirements and optional technical context,
    then generates a complete code structure using AI.
    """
    try:
        req_dict = {
            "title": request.title,
            "stories": request.stories,
            "techStack": request.tech_stack,
            "knowledgeBaseIds": request.knowledge_base_ids,
            "userId": request.user_id
        }
        artifact = story_to_code_service.generate(db, req_dict)
        return artifact
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=List[Any])
def list_history(
    user_id: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """[LEGACY] List previous code generations for a user."""
    if user_id is None:
        return []
    return story_to_code_service.list_requests(db, user_id)


# Dynamic ID routes MUST be last
@router.get("/{id}", response_model=Any)
def get_generation(
    id: int,
    db: Session = Depends(get_session)
):
    """[LEGACY] Get details of a specific generation."""
    artifact = story_to_code_service.get_artifact(db, id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Generation not found")
    return artifact


@router.get("/{id}/download")
def download_zip(
    id: int,
    db: Session = Depends(get_session)
):
    """[LEGACY] Download the generated code as a ZIP file."""
    # Use session-based approach internally
    session = story_to_code_service.get_session(db, id)
    if session:
        # New session-based record
        if session.status != "completed":
            raise HTTPException(status_code=400, detail="Generation not yet completed")
        zip_bytes = story_to_code_service.create_zip(session)
        title = session.title or "generated_code"
    else:
        # Try legacy artifact
        artifact = story_to_code_service.get_artifact(db, id)
        if not artifact:
            raise HTTPException(status_code=404, detail="Generation not found")

        import json
        import io
        import zipfile

        try:
            files_map = json.loads(artifact.content)
        except:
            files_map = {}

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for filename, content in files_map.items():
                zf.writestr(filename, content)
        zip_bytes = zip_buffer.getvalue()
        title = artifact.title or "generated_code"

    filename = f"{title.replace(' ', '_').replace('/', '_')}.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{id}/reprocess", response_model=Any)
def reprocess_generation(
    id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session)
):
    """[LEGACY] Reprocess a failed or incomplete generation."""
    # Try new session-based approach first
    session = story_to_code_service.get_session(db, id)
    if session:
        result = story_to_code_service.retry_session(db, id)
        if result:
            background_tasks.add_task(
                story_to_code_service.process_session,
                db,
                id
            )
            return result

    # Fallback to legacy artifact
    artifact = story_to_code_service.get_artifact(db, id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Generation not found")

    req_dict = {
        "title": artifact.title,
        "stories": artifact.input_description,
        "techStack": artifact.generation_metadata.get("techStack") if artifact.generation_metadata else None,
        "knowledgeBaseIds": artifact.knowledge_base_ids or [],
        "userId": artifact.user_id
    }

    try:
        new_artifact = story_to_code_service.generate(db, req_dict)
        return new_artifact
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
