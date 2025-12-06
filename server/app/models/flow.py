from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON

class FlowState(SQLModel):
    name: str
    type: str # 'agent', 'condition', 'action', 'end'
    agentId: Optional[int] = None
    prompt: Optional[str] = None
    condition: Optional[str] = None
    transitions: List[Dict[str, Any]]

class FlowBase(SQLModel):
    name: str
    description: Optional[str] = None
    initial_state: str
    states: List[FlowState] = Field(default=[], sa_column=Column(JSON))

class Flow(FlowBase, table=True):
    __tablename__ = "flows"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FlowExecutionBase(SQLModel):
    flow_id: int = Field(foreign_key="flows.id")
    current_state: str
    status: str = "running" # 'running', 'completed', 'failed', 'paused'
    context: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    history: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    error: Optional[str] = None

class FlowExecution(FlowExecutionBase, table=True):
    __tablename__ = "flow_executions"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
