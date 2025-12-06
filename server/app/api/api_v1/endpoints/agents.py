from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.db import get_session
from app.models.agent import Agent

router = APIRouter()

@router.post("", response_model=Agent)
def create_agent(agent: Agent, session: Session = Depends(get_session)) -> Any:
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent

@router.get("", response_model=List[Agent])
def list_agents(session: Session = Depends(get_session)) -> Any:
    agents = session.exec(select(Agent)).all()
    return agents

@router.get("/{id}", response_model=Agent)
def get_agent(id: int, session: Session = Depends(get_session)) -> Any:
    agent = session.get(Agent, id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

# TODO: Implement start_conversation, execute_agent, etc.
