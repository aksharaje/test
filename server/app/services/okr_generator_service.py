"""
OKR & KPI Generator Service

Business logic for AI-powered OKR and KPI generation workflow.
"""
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.okr_generator import (
    OkrSession,
    Objective,
    KeyResult,
    Kpi,
    OkrSessionCreate,
)
from openai import OpenAI


class OkrGeneratorService:
    """Service for managing OKR generation sessions"""

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
        import re

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

    def create_session(self, db: Session, data: OkrSessionCreate) -> OkrSession:
        """Create a new OKR session."""
        session = OkrSession(
            goal_description=data.goal_description,
            goal_session_id=data.goal_session_id,
            timeframe=data.timeframe,
            team_context=data.team_context,
            measurement_preferences=data.measurement_preferences,
            status="pending",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int) -> Optional[OkrSession]:
        """Get a session by ID."""
        return db.get(OkrSession, session_id)

    def list_sessions(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
    ) -> List[OkrSession]:
        """List sessions with pagination."""
        statement = (
            select(OkrSession)
            .order_by(desc(OkrSession.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data."""
        session = db.get(OkrSession, session_id)
        if not session:
            return False

        # Delete KPIs
        kpis = db.exec(select(Kpi).where(Kpi.session_id == session_id)).all()
        for kpi in kpis:
            db.delete(kpi)

        # Delete Key Results
        key_results = db.exec(select(KeyResult).where(KeyResult.session_id == session_id)).all()
        for kr in key_results:
            db.delete(kr)

        # Delete Objectives
        objectives = db.exec(select(Objective).where(Objective.session_id == session_id)).all()
        for obj in objectives:
            db.delete(obj)

        db.delete(session)
        db.commit()
        return True

    # ==================== AI GENERATION ====================

    def generate_okrs(self, db: Session, session_id: int) -> OkrSession:
        """Generate OKRs and KPIs using AI."""
        session = db.get(OkrSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "generating"
            session.progress_message = "Analyzing goals and generating OKRs..."
            session.updated_at = datetime.utcnow()
            db.commit()

            prompt = self._build_okr_prompt(session)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert in OKR methodology and performance measurement.
You help teams create clear, measurable objectives with actionable key results and KPIs.
Always respond with valid JSON only, no additional text or markdown."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=5000,
            )

            content = response.choices[0].message.content
            result = self._parse_llm_json(content, "OKR Generation")

            self._save_okrs(db, session_id, result)

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

    def _build_okr_prompt(self, session: OkrSession) -> str:
        """Build the prompt for OKR generation."""
        prompt = f"""Based on the following goals, generate OKRs (Objectives and Key Results) with supporting KPIs.

## Goals
{session.goal_description}

## Timeframe
{session.timeframe}

## Team Context
{session.team_context or "Not specified"}

## Measurement Preferences
{session.measurement_preferences or "No specific preferences"}

## Instructions
Generate 2-4 Objectives, each with 3-5 Key Results. Include supporting KPIs for tracking.

For each Key Result:
- Make it measurable with a clear target
- Include baseline if applicable
- Specify how to measure it

For KPIs:
- Include both leading and lagging indicators
- Specify data sources and collection frequency

Respond with JSON in this exact format:
{{
    "executive_summary": "Brief summary of the OKR strategy",
    "objectives": [
        {{
            "title": "Objective title (qualitative, inspirational)",
            "description": "What we want to achieve",
            "category": "company|team|individual",
            "timeframe": "{session.timeframe}",
            "strategic_alignment": "How this aligns with strategy",
            "owner": "Suggested owner role",
            "key_results": [
                {{
                    "title": "Key Result title (quantitative, e.g., 'Increase login success rate from 87% → 95% by Q2')",
                    "description": "How we measure success",
                    "metric_type": "percentage|number|boolean|currency",
                    "baseline_value": "Current state (e.g., '87%', '22 sec')",
                    "target_value": "Target to achieve",
                    "stretch_target": "Ambitious target",
                    "owner": "Who owns this (e.g., 'PM • Growth', 'Eng • Auth', 'Frontend + UX')",
                    "kpi_name": "Name of the KPI to track (e.g., 'Login Success Rate', 'Reset Error Rate')",
                    "measurement_method": "How to measure this",
                    "data_source": "Where data comes from",
                    "tracking_frequency": "weekly|monthly|quarterly"
                }}
            ]
        }}
    ],
    "kpis": [
        {{
            "name": "KPI name",
            "description": "What this measures",
            "category": "leading|lagging",
            "metric_type": "percentage|number|ratio|currency",
            "formula": "How to calculate (if applicable)",
            "baseline": "Current value",
            "target": "Target value",
            "unit": "Unit of measurement",
            "data_source": "Where data comes from",
            "collection_frequency": "daily|weekly|monthly",
            "owner": "Who owns this KPI"
        }}
    ]
}}"""
        return prompt

    def _save_okrs(self, db: Session, session_id: int, result: Dict[str, Any]) -> None:
        """Save generated OKRs to database."""
        # Save Objectives and Key Results
        for i, obj_data in enumerate(result.get("objectives", [])):
            objective = Objective(
                session_id=session_id,
                title=obj_data.get("title", ""),
                description=obj_data.get("description", ""),
                category=obj_data.get("category", "team"),
                timeframe=obj_data.get("timeframe", ""),
                strategic_alignment=obj_data.get("strategic_alignment"),
                owner=obj_data.get("owner"),
                display_order=i,
            )
            db.add(objective)
            db.flush()  # Get the ID

            # Save Key Results
            for j, kr_data in enumerate(obj_data.get("key_results", [])):
                key_result = KeyResult(
                    objective_id=objective.id,
                    session_id=session_id,
                    title=kr_data.get("title", ""),
                    description=kr_data.get("description", ""),
                    metric_type=kr_data.get("metric_type", "number"),
                    baseline_value=kr_data.get("baseline_value"),
                    target_value=kr_data.get("target_value", ""),
                    stretch_target=kr_data.get("stretch_target"),
                    owner=kr_data.get("owner"),
                    kpi_name=kr_data.get("kpi_name"),
                    measurement_method=kr_data.get("measurement_method", ""),
                    data_source=kr_data.get("data_source"),
                    tracking_frequency=kr_data.get("tracking_frequency", "weekly"),
                    display_order=j,
                )
                db.add(key_result)

        # Save KPIs
        for k, kpi_data in enumerate(result.get("kpis", [])):
            kpi = Kpi(
                session_id=session_id,
                name=kpi_data.get("name", ""),
                description=kpi_data.get("description", ""),
                category=kpi_data.get("category", "lagging"),
                metric_type=kpi_data.get("metric_type", "number"),
                formula=kpi_data.get("formula"),
                baseline=kpi_data.get("baseline"),
                target=kpi_data.get("target", ""),
                unit=kpi_data.get("unit"),
                data_source=kpi_data.get("data_source"),
                collection_frequency=kpi_data.get("collection_frequency", "weekly"),
                owner=kpi_data.get("owner"),
                display_order=k,
            )
            db.add(kpi)

        db.commit()

    # ==================== DATA RETRIEVAL ====================

    def get_objectives(self, db: Session, session_id: int) -> List[Objective]:
        """Get all objectives for a session."""
        statement = (
            select(Objective)
            .where(Objective.session_id == session_id)
            .order_by(Objective.display_order)
        )
        return list(db.exec(statement).all())

    def get_key_results(self, db: Session, objective_id: int) -> List[KeyResult]:
        """Get key results for an objective."""
        statement = (
            select(KeyResult)
            .where(KeyResult.objective_id == objective_id)
            .order_by(KeyResult.display_order)
        )
        return list(db.exec(statement).all())

    def get_key_results_for_session(self, db: Session, session_id: int) -> List[KeyResult]:
        """Get all key results for a session."""
        statement = (
            select(KeyResult)
            .where(KeyResult.session_id == session_id)
            .order_by(KeyResult.display_order)
        )
        return list(db.exec(statement).all())

    def get_kpis(self, db: Session, session_id: int) -> List[Kpi]:
        """Get all KPIs for a session."""
        statement = (
            select(Kpi)
            .where(Kpi.session_id == session_id)
            .order_by(Kpi.display_order)
        )
        return list(db.exec(statement).all())

    def retry_session(self, db: Session, session_id: int) -> OkrSession:
        """Retry a failed session."""
        session = db.get(OkrSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Clear existing data
        for kpi in db.exec(select(Kpi).where(Kpi.session_id == session_id)).all():
            db.delete(kpi)
        for kr in db.exec(select(KeyResult).where(KeyResult.session_id == session_id)).all():
            db.delete(kr)
        for obj in db.exec(select(Objective).where(Objective.session_id == session_id)).all():
            db.delete(obj)

        session.status = "pending"
        session.error_message = None
        session.executive_summary = None
        session.completed_at = None
        session.updated_at = datetime.utcnow()
        db.commit()

        return self.generate_okrs(db, session_id)
