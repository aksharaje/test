"""
Scope Monitor Service

Business logic for AI-powered scope monitoring and creep detection.
"""
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.scope_monitor import (
    ScopeMonitorSession,
    ScopeChange,
    ImpactAssessment,
    ScopeAlert,
    ScopeMonitorSessionCreate,
)
from app.models.scope_definition import ScopeDefinitionSession, ScopeItem
from openai import OpenAI


class ScopeMonitorService:
    """Service for managing scope monitoring sessions"""

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
        if brace_idx == -1:
            raise ValueError(f"{context}: No JSON object found in response")
        content = content[brace_idx:]

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

    def create_session(self, db: Session, data: ScopeMonitorSessionCreate, user_id: Optional[int] = None) -> ScopeMonitorSession:
        """Create a new scope monitor session."""
        # Build baseline description from linked session if available
        baseline_desc = data.baseline_description
        if data.baseline_scope_id and not baseline_desc:
            baseline_session = db.get(ScopeDefinitionSession, data.baseline_scope_id)
            if baseline_session:
                # Get scope items from baseline
                items = db.exec(
                    select(ScopeItem)
                    .where(ScopeItem.session_id == data.baseline_scope_id)
                    .where(ScopeItem.scope_type == "in_scope")
                ).all()
                baseline_desc = f"Project: {baseline_session.project_name}\n"
                baseline_desc += f"Vision: {baseline_session.product_vision}\n"
                baseline_desc += "In-scope items:\n"
                for item in items:
                    baseline_desc += f"- {item.title}: {item.description}\n"

        session = ScopeMonitorSession(
            project_name=data.project_name,
            baseline_scope_id=data.baseline_scope_id,
            baseline_description=baseline_desc or data.baseline_description,
            current_requirements=data.current_requirements,
            change_context=data.change_context,
            status="pending",
            user_id=user_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[ScopeMonitorSession]:
        """Get a session by ID."""
        session = db.get(ScopeMonitorSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[ScopeMonitorSession]:
        """List sessions with pagination."""
        statement = select(ScopeMonitorSession)
        if user_id:
            statement = statement.where(ScopeMonitorSession.user_id == user_id)
        statement = (
            statement
            .order_by(desc(ScopeMonitorSession.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def delete_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> bool:
        """Delete a session and all related data."""
        session = db.get(ScopeMonitorSession, session_id)
        if not session:
            return False
        if user_id and session.user_id and session.user_id != user_id:
            return False

        # Delete related data
        for change in db.exec(select(ScopeChange).where(ScopeChange.session_id == session_id)).all():
            db.delete(change)
        for assessment in db.exec(select(ImpactAssessment).where(ImpactAssessment.session_id == session_id)).all():
            db.delete(assessment)
        for alert in db.exec(select(ScopeAlert).where(ScopeAlert.session_id == session_id)).all():
            db.delete(alert)

        db.delete(session)
        db.commit()
        return True

    # ==================== AI ANALYSIS ====================

    def analyze_scope(self, db: Session, session_id: int) -> ScopeMonitorSession:
        """Analyze scope changes using AI."""
        session = db.get(ScopeMonitorSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "analyzing"
            session.progress_message = "Comparing baseline to current requirements..."
            session.updated_at = datetime.utcnow()
            db.commit()

            prompt = self._build_analysis_prompt(session)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert project manager specializing in scope management and change control.
You analyze requirements changes to detect scope creep, assess impact, and provide recommendations.
Be thorough but balanced - not all changes are scope creep.
Always respond with valid JSON only, no additional text or markdown."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=6000,
            )

            content = response.choices[0].message.content
            result = self._parse_llm_json(content, "Scope Analysis")

            self._save_analysis(db, session_id, result)

            session.status = "completed"
            session.scope_health_score = result.get("scope_health_score", 75)
            session.creep_risk_level = result.get("creep_risk_level", "medium")
            session.executive_summary = result.get("executive_summary", "")
            session.recommendations = result.get("recommendations", [])
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

    def _build_analysis_prompt(self, session: ScopeMonitorSession) -> str:
        """Build the prompt for scope analysis."""
        prompt = f"""Analyze the following scope changes for the project.

## Project Name
{session.project_name}

## Baseline Scope
{session.baseline_description or "No baseline provided - analyze current requirements for potential issues"}

## Current Requirements
{session.current_requirements}

## Change Context
{session.change_context or "No additional context provided"}

## Instructions
Analyze the differences between baseline and current requirements to:
1. Identify all changes (additions, removals, modifications)
2. Determine which changes constitute scope creep
3. Assess impact on timeline, budget, and resources
4. Generate alerts for significant issues
5. Provide actionable recommendations

Types of scope creep to watch for:
- Gold plating: Adding features beyond requirements
- Feature creep: Continuous addition of new features
- Requirement creep: Gradually expanding requirements

Respond with JSON in this exact format:
{{
    "scope_health_score": 75,  // 0-100, where 100 is perfectly healthy
    "creep_risk_level": "low|medium|high|critical",
    "executive_summary": "Brief summary of scope status and key concerns",
    "recommendations": ["Recommendation 1", "Recommendation 2"],
    "changes": [
        {{
            "title": "Change title",
            "description": "What changed",
            "change_type": "addition|removal|modification|clarification",
            "category": "feature|requirement|constraint|timeline",
            "impact_level": "low|medium|high|critical",
            "effort_impact": "Estimated effort change (e.g., +2 weeks)",
            "timeline_impact": "Estimated timeline change",
            "budget_impact": "Estimated budget change",
            "is_scope_creep": true|false,
            "creep_type": "gold_plating|feature_creep|requirement_creep|null",
            "justification": "Why this is or isn't scope creep",
            "recommendation": "accept|reject|defer|negotiate",
            "recommendation_rationale": "Why this recommendation"
        }}
    ],
    "impact_assessments": [
        {{
            "area": "timeline|budget|resources|quality|risk",
            "baseline_value": "Original estimate/value",
            "current_value": "Current estimate/value",
            "projected_value": "Projected if changes accepted",
            "impact_description": "Description of impact",
            "impact_severity": "positive|neutral|minor_negative|major_negative|critical",
            "mitigation_options": ["Option 1", "Option 2"],
            "recommended_action": "What to do"
        }}
    ],
    "alerts": [
        {{
            "alert_type": "scope_creep|timeline_risk|budget_risk|resource_risk",
            "severity": "info|warning|critical",
            "title": "Alert title",
            "description": "What's the issue",
            "action_required": true|false,
            "suggested_action": "What to do",
            "escalation_needed": true|false
        }}
    ]
}}"""
        return prompt

    def _save_analysis(self, db: Session, session_id: int, result: Dict[str, Any]) -> None:
        """Save analysis results to database."""
        # Save changes
        for i, c_data in enumerate(result.get("changes", [])):
            change = ScopeChange(
                session_id=session_id,
                title=c_data.get("title", ""),
                description=c_data.get("description", ""),
                change_type=c_data.get("change_type", "modification"),
                category=c_data.get("category", "feature"),
                impact_level=c_data.get("impact_level", "medium"),
                effort_impact=c_data.get("effort_impact"),
                timeline_impact=c_data.get("timeline_impact"),
                budget_impact=c_data.get("budget_impact"),
                is_scope_creep=c_data.get("is_scope_creep", False),
                creep_type=c_data.get("creep_type"),
                justification=c_data.get("justification"),
                recommendation=c_data.get("recommendation", "accept"),
                recommendation_rationale=c_data.get("recommendation_rationale"),
                display_order=i,
            )
            db.add(change)

        # Save impact assessments
        for j, ia_data in enumerate(result.get("impact_assessments", [])):
            assessment = ImpactAssessment(
                session_id=session_id,
                area=ia_data.get("area", "timeline"),
                baseline_value=ia_data.get("baseline_value"),
                current_value=ia_data.get("current_value"),
                projected_value=ia_data.get("projected_value"),
                impact_description=ia_data.get("impact_description", ""),
                impact_severity=ia_data.get("impact_severity", "neutral"),
                mitigation_options=ia_data.get("mitigation_options", []),
                recommended_action=ia_data.get("recommended_action"),
                display_order=j,
            )
            db.add(assessment)

        # Save alerts
        for k, a_data in enumerate(result.get("alerts", [])):
            alert = ScopeAlert(
                session_id=session_id,
                alert_type=a_data.get("alert_type", "scope_creep"),
                severity=a_data.get("severity", "warning"),
                title=a_data.get("title", ""),
                description=a_data.get("description", ""),
                action_required=a_data.get("action_required", False),
                suggested_action=a_data.get("suggested_action"),
                escalation_needed=a_data.get("escalation_needed", False),
                display_order=k,
            )
            db.add(alert)

        db.commit()

    # ==================== DATA RETRIEVAL ====================

    def get_changes(self, db: Session, session_id: int) -> List[ScopeChange]:
        """Get all changes for a session."""
        statement = (
            select(ScopeChange)
            .where(ScopeChange.session_id == session_id)
            .order_by(ScopeChange.display_order)
        )
        return list(db.exec(statement).all())

    def get_impact_assessments(self, db: Session, session_id: int) -> List[ImpactAssessment]:
        """Get all impact assessments for a session."""
        statement = (
            select(ImpactAssessment)
            .where(ImpactAssessment.session_id == session_id)
            .order_by(ImpactAssessment.display_order)
        )
        return list(db.exec(statement).all())

    def get_alerts(self, db: Session, session_id: int) -> List[ScopeAlert]:
        """Get all alerts for a session."""
        statement = (
            select(ScopeAlert)
            .where(ScopeAlert.session_id == session_id)
            .order_by(ScopeAlert.display_order)
        )
        return list(db.exec(statement).all())

    def retry_session(self, db: Session, session_id: int) -> ScopeMonitorSession:
        """Retry a failed session."""
        session = db.get(ScopeMonitorSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Clear existing data
        for change in db.exec(select(ScopeChange).where(ScopeChange.session_id == session_id)).all():
            db.delete(change)
        for assessment in db.exec(select(ImpactAssessment).where(ImpactAssessment.session_id == session_id)).all():
            db.delete(assessment)
        for alert in db.exec(select(ScopeAlert).where(ScopeAlert.session_id == session_id)).all():
            db.delete(alert)

        session.status = "pending"
        session.error_message = None
        session.scope_health_score = None
        session.creep_risk_level = None
        session.executive_summary = None
        session.recommendations = None
        session.completed_at = None
        session.updated_at = datetime.utcnow()
        db.commit()

        return self.analyze_scope(db, session_id)
