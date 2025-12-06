from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session
from app.core.db import get_session
from app.models.flow import Flow, FlowExecution
from app.services.flow_service import flow_service

router = APIRouter()

@router.get("", response_model=List[Flow])
def list_flows(
    session: Session = Depends(get_session)
) -> Any:
    return flow_service.list_flows(session)

@router.post("", response_model=Flow)
def create_flow(
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    return flow_service.create_flow(session, data)

@router.get("/{id}", response_model=Flow)
def get_flow(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    flow = flow_service.get_flow(session, id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow

@router.patch("/{id}", response_model=Flow)
def update_flow(
    id: int,
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    flow = flow_service.update_flow(session, id, data)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow

@router.delete("/{id}")
def delete_flow(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not flow_service.delete_flow(session, id):
        raise HTTPException(status_code=404, detail="Flow not found")
    return Response(status_code=204)

@router.post("/{id}/execute", response_model=FlowExecution)
def execute_flow(
    id: int,
    data: Dict[str, Any],
    session: Session = Depends(get_session)
) -> Any:
    return flow_service.start_execution(session, id, data.get("context", {}))

@router.get("/executions/{id}", response_model=FlowExecution)
def get_execution(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    execution = flow_service.get_execution(session, id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution
