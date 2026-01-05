"""
KPI Assignment Service

Business logic for AI-powered KPI assignment workflow.
Takes Goals from Goal Setting and generates appropriate KPIs.
"""
import json
import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.kpi_assignment import (
    KpiAssignmentSession,
    KpiAssignment,
    KpiAssignmentSessionCreate,
    KpiAssignmentCreate,
)
from app.models.goal_setting import GoalSettingSession, Goal
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

    def _parse_llm_json(self, content: str, context: str = "LLM") -> Dict[str, Any]:
        """Robust JSON parsing for LLM responses."""
        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        content = content.strip()

        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        brace_idx = content.find('{')
        bracket_idx = content.find('[')

        if brace_idx == -1 and bracket_idx == -1:
            raise ValueError(f"{context}: No JSON object found in response")

        json_start = min(
            brace_idx if brace_idx != -1 else len(content),
            bracket_idx if bracket_idx != -1 else len(content)
        )
        content = content[json_start:]

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            if content.startswith('{'):
                depth = 0
                for i, char in enumerate(content):
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(content[:i+1])
                            except json.JSONDecodeError:
                                break
            raise ValueError(f"{context}: Failed to parse JSON: {str(e)}")

    # ==================== SESSION MANAGEMENT ====================

    def create_session(self, db: Session, data: KpiAssignmentSessionCreate, user_id: Optional[int] = None) -> KpiAssignmentSession:
        """Create a new KPI assignment session."""
        session = KpiAssignmentSession(
            goal_session_id=data.goal_session_id,
            okr_session_id=data.okr_session_id,
            status="pending",
            user_id=user_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[KpiAssignmentSession]:
        """Get a session by ID, optionally filtered by user."""
        session = db.get(KpiAssignmentSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None  # User doesn't own this session
        return session

    def get_session_by_goal(self, db: Session, goal_session_id: int) -> Optional[KpiAssignmentSession]:
        """Get KPI assignment session for a Goal Setting session."""
        statement = (
            select(KpiAssignmentSession)
            .where(KpiAssignmentSession.goal_session_id == goal_session_id)
            .order_by(desc(KpiAssignmentSession.created_at))
        )
        return db.exec(statement).first()

    def get_session_by_okr(self, db: Session, okr_session_id: int) -> Optional[KpiAssignmentSession]:
        """Get KPI assignment session for an OKR session (legacy)."""
        statement = (
            select(KpiAssignmentSession)
            .where(KpiAssignmentSession.okr_session_id == okr_session_id)
            .order_by(desc(KpiAssignmentSession.created_at))
        )
        return db.exec(statement).first()

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[KpiAssignmentSession]:
        """List sessions with pagination, filtered by user."""
        statement = select(KpiAssignmentSession)
        if user_id:
            statement = statement.where(KpiAssignmentSession.user_id == user_id)
        statement = statement.order_by(desc(KpiAssignmentSession.created_at)).offset(skip).limit(limit)
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

    # ==================== AI GENERATION ====================

    def generate_kpis(self, db: Session, session_id: int) -> KpiAssignmentSession:
        """Generate KPIs for all goals in the session using AI."""
        session = db.get(KpiAssignmentSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "generating"
            session.progress_message = "Analyzing goals and generating KPIs..."
            session.updated_at = datetime.utcnow()
            db.commit()

            # Get goals from the linked Goal Setting session
            goals = []
            if session.goal_session_id:
                goals = db.exec(
                    select(Goal)
                    .where(Goal.session_id == session.goal_session_id)
                    .order_by(Goal.display_order)
                ).all()

            if not goals:
                raise ValueError("No goals found for this session")

            # Build prompt
            prompt = self._build_kpi_prompt(goals)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert in performance measurement and KPI definition.
You help teams define clear, measurable KPIs for their goals.
Always respond with valid JSON only, no additional text or markdown."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
            )

            content = response.choices[0].message.content
            result = self._parse_llm_json(content, "KPI Generation")

            # Save generated KPIs
            self._save_kpis(db, session_id, goals, result)

            session.status = "completed"
            session.executive_summary = result.get("executive_summary", "")
            session.completed_at = datetime.utcnow()
            session.updated_at = datetime.utcnow()
            session.progress_message = None
            db.commit()
            db.refresh(session)

            return session

        except Exception as e:
            session.status = "failed"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            db.commit()
            raise

    def _build_kpi_prompt(self, goals: List[Goal]) -> str:
        """Build the prompt for KPI generation."""
        goals_text = ""
        for i, goal in enumerate(goals):
            goals_text += f"""
Goal {i + 1}:
- Title: {goal.title}
- Description: {goal.description}
- Category: {goal.category}
- Priority: {goal.priority}
- Timeframe: {goal.timeframe or 'Not specified'}
- Success Criteria: {goal.specific}
- Measurable: {goal.measurable}
"""

        prompt = f"""Based on the following goals, generate appropriate KPIs (Key Performance Indicators) for each goal.

## Goals
{goals_text}

## Instructions
For each goal, provide:
1. A primary KPI that directly measures progress toward the goal
2. The appropriate measurement unit
3. A secondary KPI (health metric) that helps ensure quality
4. Recommended check frequency
5. 2-3 alternative KPIs the user might consider
6. Brief rationale for why this KPI was chosen

Respond with JSON in this exact format:
{{
    "executive_summary": "Brief summary of the KPI assignment strategy",
    "kpi_assignments": [
        {{
            "goal_index": 0,
            "primary_kpi": "Login Success Rate",
            "measurement_unit": "Percentage (%)",
            "secondary_kpi": "Auth Error Rate",
            "check_frequency": "weekly",
            "alternative_kpis": ["Time to Login", "Failed Attempts"],
            "rationale": "Login success rate directly measures user authentication experience..."
        }}
    ]
}}"""
        return prompt

    def _save_kpis(self, db: Session, session_id: int, goals: List[Goal], result: Dict[str, Any]) -> None:
        """Save generated KPIs to database."""
        for i, kpi_data in enumerate(result.get("kpi_assignments", [])):
            goal_index = kpi_data.get("goal_index", i)
            if goal_index < len(goals):
                goal = goals[goal_index]

                assignment = KpiAssignment(
                    session_id=session_id,
                    goal_id=goal.id,
                    goal_title=goal.title,
                    goal_category=goal.category,
                    primary_kpi=kpi_data.get("primary_kpi", ""),
                    measurement_unit=kpi_data.get("measurement_unit", ""),
                    secondary_kpi=kpi_data.get("secondary_kpi"),
                    check_frequency=kpi_data.get("check_frequency", "weekly"),
                    alternative_kpis=kpi_data.get("alternative_kpis"),
                    rationale=kpi_data.get("rationale"),
                    display_order=i,
                )
                db.add(assignment)

        db.commit()

    # ==================== DATA RETRIEVAL ====================

    def get_assignments(self, db: Session, session_id: int) -> List[KpiAssignment]:
        """Get all KPI assignments for a session."""
        statement = (
            select(KpiAssignment)
            .where(KpiAssignment.session_id == session_id)
            .order_by(KpiAssignment.display_order)
        )
        return list(db.exec(statement).all())

    def update_assignment(
        self, db: Session, assignment_id: int, data: KpiAssignmentCreate
    ) -> Optional[KpiAssignment]:
        """Update a KPI assignment."""
        assignment = db.get(KpiAssignment, assignment_id)
        if not assignment:
            return None

        assignment.primary_kpi = data.primary_kpi
        assignment.measurement_unit = data.measurement_unit
        assignment.secondary_kpi = data.secondary_kpi
        assignment.check_frequency = data.check_frequency
        assignment.notes = data.notes
        assignment.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(assignment)
        return assignment

    def delete_assignment(self, db: Session, assignment_id: int) -> bool:
        """Delete a KPI assignment."""
        assignment = db.get(KpiAssignment, assignment_id)
        if not assignment:
            return False
        db.delete(assignment)
        db.commit()
        return True

    # ==================== SESSION COMPLETION ====================

    def retry_session(self, db: Session, session_id: int) -> KpiAssignmentSession:
        """Retry a failed session."""
        session = db.get(KpiAssignmentSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Clear existing assignments
        for assignment in db.exec(select(KpiAssignment).where(KpiAssignment.session_id == session_id)).all():
            db.delete(assignment)

        session.status = "pending"
        session.error_message = None
        session.executive_summary = None
        session.completed_at = None
        session.updated_at = datetime.utcnow()
        db.commit()

        return self.generate_kpis(db, session_id)

    # ==================== FULL DATA RETRIEVAL ====================

    def get_session_full(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get full session data with all assignments."""
        session = db.get(KpiAssignmentSession, session_id)
        if not session:
            return None

        assignments = self.get_assignments(db, session_id)

        return {
            "session": session,
            "assignments": [
                {
                    "id": a.id,
                    "goalId": a.goal_id,
                    "goalTitle": a.goal_title,
                    "goalCategory": a.goal_category,
                    "primaryKpi": a.primary_kpi,
                    "measurementUnit": a.measurement_unit,
                    "secondaryKpi": a.secondary_kpi,
                    "checkFrequency": a.check_frequency,
                    "alternativeKpis": a.alternative_kpis,
                    "rationale": a.rationale,
                    "displayOrder": a.display_order,
                }
                for a in assignments
            ],
        }
