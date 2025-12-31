"""
Goal Setting Service

Business logic for AI-powered goal setting workflow.
"""
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.goal_setting import (
    GoalSettingSession,
    Goal,
    GoalSettingSessionCreate,
)
from openai import OpenAI


class GoalSettingService:
    """Service for managing goal setting sessions"""

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

        # Remove markdown code fences
        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        # Find JSON start
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
            # Try to find matching brace
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

    def create_session(self, db: Session, data: GoalSettingSessionCreate) -> GoalSettingSession:
        """Create a new goal setting session."""
        session = GoalSettingSession(
            domain=data.domain,
            strategy=data.strategy,
            team_charter=data.team_charter,
            problem_statements=data.problem_statements,
            baselines=data.baselines,
            status="pending",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int) -> Optional[GoalSettingSession]:
        """Get a session by ID."""
        return db.get(GoalSettingSession, session_id)

    def list_sessions(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
    ) -> List[GoalSettingSession]:
        """List sessions with pagination."""
        statement = (
            select(GoalSettingSession)
            .order_by(desc(GoalSettingSession.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and its goals."""
        session = db.get(GoalSettingSession, session_id)
        if not session:
            return False

        # Delete related goals
        goals = db.exec(
            select(Goal).where(Goal.session_id == session_id)
        ).all()
        for goal in goals:
            db.delete(goal)

        db.delete(session)
        db.commit()
        return True

    # ==================== AI GENERATION ====================

    def generate_goals(self, db: Session, session_id: int) -> GoalSettingSession:
        """Generate goals using AI."""
        session = db.get(GoalSettingSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "generating"
            session.progress_message = "Analyzing context and generating goals..."
            session.updated_at = datetime.utcnow()
            db.commit()

            # Build prompt
            prompt = self._build_goal_prompt(session)

            # Call LLM
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert product management coach specializing in goal setting.
You help teams define clear, actionable SMART goals that drive business outcomes.
Always respond with valid JSON only, no additional text or markdown."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
            )

            content = response.choices[0].message.content
            result = self._parse_llm_json(content, "Goal Generation")

            # Save goals
            self._save_goals(db, session_id, result)

            # Update session
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

    def _build_goal_prompt(self, session: GoalSettingSession) -> str:
        """Build the prompt for goal generation."""
        prompt = f"""Based on the following context, generate 3-5 strategic goals using the SMART framework.

## PM Role / Domain
{session.domain}

## Company Strategy
{session.strategy}

## Team Charter
{session.team_charter or "Not specified"}

## Customer Problem Statements
{session.problem_statements or "Not specified"}

## Current Baselines / Metrics
{session.baselines or "Not specified"}

## Instructions
Generate goals that are:
1. Strategic and aligned with the company strategy and team charter
2. Address the customer problem statements
3. Include measurable improvements from current baselines
4. Follow SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)
5. Include clear success criteria
6. Consider dependencies and risks

Respond with JSON in this exact format:
{{
    "executive_summary": "Brief 2-3 sentence summary of the goal strategy",
    "goals": [
        {{
            "title": "Goal title",
            "description": "Detailed goal description",
            "category": "strategic|operational|tactical",
            "timeframe": "When to achieve this",
            "specific": "What exactly will be accomplished",
            "measurable": "How success will be measured",
            "achievable": "Why this is realistic",
            "relevant": "Why this matters to the business",
            "time_bound": "Specific deadline or timeframe",
            "success_criteria": ["Criterion 1", "Criterion 2"],
            "dependencies": ["Dependency 1", "Dependency 2"],
            "risks": ["Risk 1", "Risk 2"],
            "priority": "high|medium|low",
            "estimated_effort": "Effort estimate (e.g., '2 sprints')"
        }}
    ]
}}"""
        return prompt

    def _save_goals(self, db: Session, session_id: int, result: Dict[str, Any]) -> None:
        """Save generated goals to database."""
        goals_data = result.get("goals", [])

        for i, goal_data in enumerate(goals_data):
            goal = Goal(
                session_id=session_id,
                title=goal_data.get("title", ""),
                description=goal_data.get("description", ""),
                category=goal_data.get("category", "strategic"),
                timeframe=goal_data.get("timeframe"),
                specific=goal_data.get("specific", ""),
                measurable=goal_data.get("measurable", ""),
                achievable=goal_data.get("achievable", ""),
                relevant=goal_data.get("relevant", ""),
                time_bound=goal_data.get("time_bound", ""),
                success_criteria=goal_data.get("success_criteria", []),
                dependencies=goal_data.get("dependencies", []),
                risks=goal_data.get("risks", []),
                priority=goal_data.get("priority", "medium"),
                estimated_effort=goal_data.get("estimated_effort"),
                display_order=i,
            )
            db.add(goal)

        db.commit()

    # ==================== GOAL RETRIEVAL ====================

    def get_goals(self, db: Session, session_id: int) -> List[Goal]:
        """Get all goals for a session."""
        statement = (
            select(Goal)
            .where(Goal.session_id == session_id)
            .order_by(Goal.display_order)
        )
        return list(db.exec(statement).all())

    def retry_session(self, db: Session, session_id: int) -> GoalSettingSession:
        """Retry a failed session."""
        session = db.get(GoalSettingSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Clear existing goals
        goals = db.exec(
            select(Goal).where(Goal.session_id == session_id)
        ).all()
        for goal in goals:
            db.delete(goal)

        # Reset session state
        session.status = "pending"
        session.error_message = None
        session.executive_summary = None
        session.completed_at = None
        session.updated_at = datetime.utcnow()
        db.commit()

        # Re-generate
        return self.generate_goals(db, session_id)
