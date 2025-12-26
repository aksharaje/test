"""
Story-to-Code Generator API Endpoints

Converts user stories into production-ready code using AI.
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.core.db import get_session
from app.services.story_to_code_service import story_to_code_service

router = APIRouter()


# --- Request/Response Models ---

class GenerateCodeRequest(BaseModel):
    """Request model for code generation."""
    model_config = {"populate_by_name": True}

    title: Optional[str] = None
    stories: str = Field(..., description="User stories and requirements to convert to code")
    tech_stack: Optional[str] = Field(default=None, alias="techStack")
    knowledge_base_ids: List[int] = Field(default=[], alias="knowledgeBaseIds")
    user_id: Optional[int] = Field(default=None, alias="userId")


# --- Endpoints ---

@router.post("/generate", response_model=Any)
def generate_code(
    request: GenerateCodeRequest,
    db: Session = Depends(get_session)
):
    """
    Generate code from user stories.

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
    """
    List previous code generations for a user.
    """
    if user_id is None:
        return []
    return story_to_code_service.list_requests(db, user_id)


@router.get("/{id}", response_model=Any)
def get_generation(
    id: int,
    db: Session = Depends(get_session)
):
    """
    Get details of a specific generation.
    """
    artifact = story_to_code_service.get_artifact(db, id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Generation not found")
    return artifact


@router.get("/{id}/download")
def download_zip(
    id: int,
    db: Session = Depends(get_session)
):
    """
    Download the generated code as a ZIP file.
    """
    artifact = story_to_code_service.get_artifact(db, id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Generation not found")

    zip_bytes = story_to_code_service.create_zip(artifact)

    # Sanitize filename
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
    db: Session = Depends(get_session)
):
    """
    Reprocess a failed or incomplete generation.

    Retrieves the original request parameters and submits them again.
    """
    artifact = story_to_code_service.get_artifact(db, id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Generation not found")

    # Re-submit with original parameters
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
