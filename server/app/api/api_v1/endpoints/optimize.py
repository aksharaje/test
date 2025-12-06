from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.core.db import get_session
from app.services.optimize_service import optimize_service

router = APIRouter()

@router.get("/flows")
def list_optimization_flows(session: Session = Depends(get_session)) -> Any:
    return optimize_service.get_all_flows_with_stats(session)

@router.get("/flows/{id}")
def get_flow_details(id: str, session: Session = Depends(get_session)) -> Any:
    details = optimize_service.get_flow_details(session, id)
    if not details:
        raise HTTPException(status_code=404, detail="Flow not found")
    return details

@router.get("/flows/{id}/feedback")
def get_flow_feedback(id: str, session: Session = Depends(get_session)) -> Any:
    return optimize_service.get_flow_feedback(session, id)

@router.post("/flows/{id}/feedback-summary")
async def get_feedback_summary(id: str, session: Session = Depends(get_session)) -> Any:
    summary = await optimize_service.generate_feedback_summary(session, id)
    return {"summary": summary}

@router.post("/flows/{id}/generate")
async def generate_optimization(id: str, session: Session = Depends(get_session)) -> Any:
    try:
        return await optimize_service.generate_optimized_prompt(session, id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/flows/{id}/save")
def save_optimization(id: str, payload: Dict[str, str], session: Session = Depends(get_session)) -> Any:
    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    return optimize_service.save_optimized_prompt(session, id, prompt)

@router.post("/flows/{id}/activate/{version_id}")
def activate_version(id: str, version_id: int, session: Session = Depends(get_session)) -> Any:
    try:
        return optimize_service.activate_version(session, id, version_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/flows/{id}/split-test")
def create_split_test(id: str, payload: Dict[str, Any], session: Session = Depends(get_session)) -> Any:
    name = payload.get("name")
    version_ids = payload.get("versionIds")
    
    if not name or not version_ids or len(version_ids) < 2:
        raise HTTPException(status_code=400, detail="Name and at least 2 version IDs are required")
        
    try:
        return optimize_service.create_split_test(session, id, name, version_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
