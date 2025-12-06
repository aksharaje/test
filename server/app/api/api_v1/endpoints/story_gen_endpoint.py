from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session
from app.core.db import get_session
from app.models.story_generator import GeneratedArtifact
from app.services.story_generator_service import story_generator_service

router = APIRouter()

@router.get("/", response_model=List[GeneratedArtifact])
@router.get("", response_model=List[GeneratedArtifact], include_in_schema=False)
def list_artifacts(
    session: Session = Depends(get_session),
    userId: Optional[int] = None
) -> Any:
    return story_generator_service.list_artifacts(session, userId)

@router.post("/generate", response_model=GeneratedArtifact)
def generate_artifact(
    request: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    return story_generator_service.generate(session, request)

@router.get("/{id}", response_model=GeneratedArtifact)
def get_artifact(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    artifact = story_generator_service.get_artifact(session, id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact

@router.patch("/{id}", response_model=GeneratedArtifact)
def update_artifact(
    id: int,
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    artifact = story_generator_service.update_artifact(session, id, data)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact

@router.delete("/{id}")
def delete_artifact(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not story_generator_service.delete_artifact(session, id):
        raise HTTPException(status_code=404, detail="Artifact not found")
    return Response(status_code=204)

# Config endpoints
@router.get("/config/feature")
def get_feature_config():
    # Return default config for now
    return {
        "models": ["google/gemini-2.0-flash-001", "openai/gpt-4o"],
        "templates": []
    }
