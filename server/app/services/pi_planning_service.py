from typing import List, Optional, Dict, Any
from sqlmodel import Session, select
from app.models.pi_planning import PiSession, PiSessionBoard, PiSprint, PiFeature, PiFeatureAssignment, HolidayConfig

class PiPlanningService:
    def list_sessions(self, session: Session, integration_id: int) -> List[PiSession]:
        statement = select(PiSession).where(PiSession.integration_id == integration_id).order_by(PiSession.created_at.desc())
        return session.exec(statement).all()

    def get_session(self, session: Session, integration_id: int, session_id: int) -> Optional[PiSession]:
        statement = select(PiSession).where(
            PiSession.integration_id == integration_id,
            PiSession.id == session_id
        )
        return session.exec(statement).first()

    def create_session(self, session: Session, integration_id: int, data: Dict[str, Any]) -> PiSession:
        # Extract nested data if any, though for creation usually it's just base fields
        # For now assuming data matches PiSessionBase
        db_session = PiSession(integration_id=integration_id, **data)
        session.add(db_session)
        session.commit()
        session.refresh(db_session)
        return db_session

    def list_holiday_configs(self, session: Session) -> List[HolidayConfig]:
        return session.exec(select(HolidayConfig)).all()

pi_planning_service = PiPlanningService()
