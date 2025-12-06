from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.feedback import Feedback

class FeedbackService:
    def create_feedback(self, session: Session, data: Dict[str, Any]) -> Feedback:
        feedback = Feedback(**data)
        session.add(feedback)
        session.commit()
        session.refresh(feedback)
        return feedback

    def list_feedback(self, session: Session) -> List[Feedback]:
        return session.exec(select(Feedback).order_by(desc(Feedback.created_at))).all()

feedback_service = FeedbackService()
