from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.flow import Flow, FlowExecution

class FlowService:
    def list_flows(self, session: Session) -> List[Flow]:
        return session.exec(select(Flow).order_by(desc(Flow.updated_at))).all()

    def get_flow(self, session: Session, id: int) -> Optional[Flow]:
        return session.get(Flow, id)

    def create_flow(self, session: Session, data: Dict[str, Any]) -> Flow:
        flow = Flow(**data)
        session.add(flow)
        session.commit()
        session.refresh(flow)
        return flow

    def update_flow(self, session: Session, id: int, data: Dict[str, Any]) -> Optional[Flow]:
        flow = session.get(Flow, id)
        if not flow:
            return None
        for key, value in data.items():
            setattr(flow, key, value)
        flow.updated_at = datetime.utcnow()
        session.add(flow)
        session.commit()
        session.refresh(flow)
        return flow

    def delete_flow(self, session: Session, id: int) -> bool:
        flow = session.get(Flow, id)
        if not flow:
            return False
        session.delete(flow)
        session.commit()
        return True

    # Execution logic would go here, but for now we just support CRUD to satisfy frontend
    def start_execution(self, session: Session, flow_id: int, context: Dict[str, Any]) -> FlowExecution:
        execution = FlowExecution(
            flow_id=flow_id,
            status="running",
            context=context,
            current_state="start",
            history=[]
        )
        session.add(execution)
        session.commit()
        session.refresh(execution)
        return execution

    def get_execution(self, session: Session, id: int) -> Optional[FlowExecution]:
        return session.get(FlowExecution, id)

flow_service = FlowService()
