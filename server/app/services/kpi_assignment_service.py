"""
KPI Assignment Service

Business logic for manual KPI assignment workflow.
Users assign KPIs to Key Results from their OKR sessions.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.kpi_assignment import (
    KpiAssignmentSession,
    KpiAssignment,
    KpiAssignmentSessionCreate,
    KpiAssignmentCreate,
)
from app.models.okr_generator import OkrSession, KeyResult, Objective
from openai import OpenAI


class KpiAssignmentService:
    """Service for managing KPI assignment sessions"""

    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            from app.core.config import settings
            api_key = settings.OPENROUTER_API_KEY
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY required")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    @property
    def model(self) -> str:
        from app.core.config import settings
        return settings.OPENROUTER_MODEL

    # ==================== SESSION MANAGEMENT ====================

    def create_session(self, db: Session, data: KpiAssignmentSessionCreate) -> KpiAssignmentSession:
        """Create a new KPI assignment session linked to an OKR session."""
        # Verify OKR session exists
        okr_session = db.get(OkrSession, data.okr_session_id)
        if not okr_session:
            raise ValueError(f"OKR session {data.okr_session_id} not found")

        session = KpiAssignmentSession(
            okr_session_id=data.okr_session_id,
            status="draft",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int) -> Optional[KpiAssignmentSession]:
        """Get a session by ID."""
        return db.get(KpiAssignmentSession, session_id)

    def get_session_by_okr(self, db: Session, okr_session_id: int) -> Optional[KpiAssignmentSession]:
        """Get KPI assignment session for an OKR session."""
        statement = (
            select(KpiAssignmentSession)
            .where(KpiAssignmentSession.okr_session_id == okr_session_id)
            .order_by(desc(KpiAssignmentSession.created_at))
        )
        return db.exec(statement).first()

    def list_sessions(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
    ) -> List[KpiAssignmentSession]:
        """List sessions with pagination."""
        statement = (
            select(KpiAssignmentSession)
            .order_by(desc(KpiAssignmentSession.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all assignments."""
        session = db.get(KpiAssignmentSession, session_id)
        if not session:
            return False

        # Delete related assignments
        assignments = db.exec(
            select(KpiAssignment).where(KpiAssignment.session_id == session_id)
        ).all()
        for assignment in assignments:
            db.delete(assignment)

        db.delete(session)
        db.commit()
        return True

    # ==================== KPI ASSIGNMENT ====================

    def create_or_update_assignment(
        self, db: Session, session_id: int, data: KpiAssignmentCreate
    ) -> KpiAssignment:
        """Create or update a KPI assignment for a key result."""
        # Check if assignment exists
        existing = db.exec(
            select(KpiAssignment)
            .where(KpiAssignment.session_id == session_id)
            .where(KpiAssignment.key_result_id == data.key_result_id)
        ).first()

        if existing:
            # Update existing
            existing.primary_kpi = data.primary_kpi
            existing.measurement_unit = data.measurement_unit
            existing.secondary_kpi = data.secondary_kpi
            existing.check_frequency = data.check_frequency
            existing.notes = data.notes
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # Create new
            assignment = KpiAssignment(
                session_id=session_id,
                key_result_id=data.key_result_id,
                primary_kpi=data.primary_kpi,
                measurement_unit=data.measurement_unit,
                secondary_kpi=data.secondary_kpi,
                check_frequency=data.check_frequency,
                notes=data.notes,
            )
            db.add(assignment)
            db.commit()
            db.refresh(assignment)
            return assignment

    def get_assignments(self, db: Session, session_id: int) -> List[KpiAssignment]:
        """Get all KPI assignments for a session."""
        statement = select(KpiAssignment).where(KpiAssignment.session_id == session_id)
        return list(db.exec(statement).all())

    def get_assignment_for_key_result(
        self, db: Session, session_id: int, key_result_id: int
    ) -> Optional[KpiAssignment]:
        """Get KPI assignment for a specific key result."""
        return db.exec(
            select(KpiAssignment)
            .where(KpiAssignment.session_id == session_id)
            .where(KpiAssignment.key_result_id == key_result_id)
        ).first()

    def delete_assignment(self, db: Session, assignment_id: int) -> bool:
        """Delete a KPI assignment."""
        assignment = db.get(KpiAssignment, assignment_id)
        if not assignment:
            return False
        db.delete(assignment)
        db.commit()
        return True

    # ==================== SUGGESTIONS ====================

    def get_kpi_suggestions(
        self, db: Session, key_result_id: int
    ) -> List[str]:
        """Get AI-generated KPI suggestions for a key result."""
        key_result = db.get(KeyResult, key_result_id)
        if not key_result:
            return []

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a product metrics expert. Generate 3-5 relevant KPI suggestions."
                    },
                    {
                        "role": "user",
                        "content": f"""Suggest 3-5 relevant KPIs to measure this Key Result:

Title: {key_result.title}
Description: {key_result.description}
Target: {key_result.target_value}

Return a JSON array of KPI names only, e.g.: ["KPI 1", "KPI 2", "KPI 3"]"""
                    }
                ],
                temperature=0.5,
                max_tokens=200,
            )

            import json
            content = response.choices[0].message.content.strip()
            # Parse JSON array
            if content.startswith('['):
                return json.loads(content)
            return []
        except Exception:
            return []

    # ==================== SESSION COMPLETION ====================

    def complete_session(self, db: Session, session_id: int) -> KpiAssignmentSession:
        """Mark session as completed."""
        session = db.get(KpiAssignmentSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        session.status = "completed"
        session.completed_at = datetime.utcnow()
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

    # ==================== FULL DATA RETRIEVAL ====================

    def get_key_results_with_assignments(
        self, db: Session, session_id: int
    ) -> List[Dict[str, Any]]:
        """Get all key results from the linked OKR session with their KPI assignments."""
        session = db.get(KpiAssignmentSession, session_id)
        if not session:
            return []

        # Get objectives from OKR session
        objectives = db.exec(
            select(Objective)
            .where(Objective.session_id == session.okr_session_id)
            .order_by(Objective.display_order)
        ).all()

        result = []
        for objective in objectives:
            # Get key results for this objective
            key_results = db.exec(
                select(KeyResult)
                .where(KeyResult.objective_id == objective.id)
                .order_by(KeyResult.display_order)
            ).all()

            for kr in key_results:
                # Get assignment if exists
                assignment = self.get_assignment_for_key_result(db, session_id, kr.id)

                result.append({
                    "objective": {
                        "id": objective.id,
                        "title": objective.title,
                        "category": objective.category,
                    },
                    "key_result": {
                        "id": kr.id,
                        "title": kr.title,
                        "description": kr.description,
                        "baseline_value": kr.baseline_value,
                        "target_value": kr.target_value,
                    },
                    "assignment": {
                        "id": assignment.id,
                        "primary_kpi": assignment.primary_kpi,
                        "measurement_unit": assignment.measurement_unit,
                        "secondary_kpi": assignment.secondary_kpi,
                        "check_frequency": assignment.check_frequency,
                    } if assignment else None
                })

        return result
