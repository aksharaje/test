"""
Competitive Analysis Service

Business logic for competitive analysis workflow.
"""
import json
import re
import logging
from typing import List, Optional
from datetime import datetime
from sqlmodel import Session, select

from app.models.competitive_analysis import (
    CompetitiveAnalysisSession,
    CompetitiveAnalysisSessionCreate,
    PROBLEM_AREAS,
)
from app.services.openrouter_service import OpenRouterService

logger = logging.getLogger(__name__)


class CompetitiveAnalysisService:
    """Service for competitive analysis operations"""

    def __init__(self):
        self.llm = OpenRouterService()

    def create_session(
        self, db: Session, data: CompetitiveAnalysisSessionCreate
    ) -> CompetitiveAnalysisSession:
        """Create a new competitive analysis session"""
        session = CompetitiveAnalysisSession(
            problem_area=data.problem_area,
            custom_problem_area=data.custom_problem_area,
            reference_competitors=data.reference_competitors,
            include_direct_competitors=data.include_direct_competitors,
            include_best_in_class=data.include_best_in_class,
            include_adjacent_industries=data.include_adjacent_industries,
            status="pending",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def list_sessions(
        self, db: Session, skip: int = 0, limit: int = 20
    ) -> List[CompetitiveAnalysisSession]:
        """List all competitive analysis sessions"""
        statement = (
            select(CompetitiveAnalysisSession)
            .order_by(CompetitiveAnalysisSession.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def get_session(
        self, db: Session, session_id: int
    ) -> Optional[CompetitiveAnalysisSession]:
        """Get a specific session by ID"""
        return db.get(CompetitiveAnalysisSession, session_id)

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session"""
        session = db.get(CompetitiveAnalysisSession, session_id)
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    def retry_session(
        self, db: Session, session_id: int
    ) -> Optional[CompetitiveAnalysisSession]:
        """Reset a failed session for retry"""
        session = db.get(CompetitiveAnalysisSession, session_id)
        if not session:
            return None
        session.status = "pending"
        session.error_message = None
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

    def _get_problem_area_label(self, value: str) -> str:
        """Get human-readable label for problem area"""
        for area in PROBLEM_AREAS:
            if area["value"] == value:
                return area["label"]
        return value

    def _build_analysis_prompt(self, session: CompetitiveAnalysisSession) -> str:
        """Build the LLM prompt for competitive analysis"""
        problem_label = (
            session.custom_problem_area
            if session.problem_area == "other" and session.custom_problem_area
            else self._get_problem_area_label(session.problem_area)
        )

        competitors_text = ""
        if session.reference_competitors:
            competitors_text = f"\nSpecific companies to analyze: {', '.join(session.reference_competitors)}"

        scope_parts = []
        if session.include_direct_competitors:
            scope_parts.append("direct competitors")
        if session.include_best_in_class:
            scope_parts.append("best-in-class digital products")
        if session.include_adjacent_industries:
            scope_parts.append("adjacent industries")
        scope_text = ", ".join(scope_parts) if scope_parts else "industry leaders"

        return f"""You are a competitive analysis expert specializing in digital product design and UX patterns.

Analyze the competitive landscape for the following problem area in customer-facing mobile/web applications:

Problem Area: {problem_label}
Analysis Scope: {scope_text}{competitors_text}

Provide a comprehensive competitive analysis with the following sections:

1. **Executive Summary**: A brief 2-3 sentence overview of the competitive landscape for this problem area.

2. **Industry Standards**: List 4-6 patterns or features that are considered standard practice (adopted by 70%+ of products).

3. **Best Practices**: List 4-6 innovative approaches or best-in-class patterns that differentiate top performers.

4. **Common Pitfalls**: List 4-6 common mistakes or anti-patterns that hurt user experience.

5. **Product Gaps**: List 4-6 typical gaps or weaknesses found in most products that represent improvement opportunities.

6. **Opportunities**: List 4-6 specific, actionable opportunities with:
   - A clear description of the opportunity
   - An impact tag (e.g., "Increases conversion", "Reduces churn", "Improves engagement")
   - Priority level (high, medium, low)

Return your analysis as a JSON object with this exact structure:
{{
  "executive_summary": "string",
  "industry_standards": ["string", "string", ...],
  "best_practices": ["string", "string", ...],
  "common_pitfalls": ["string", "string", ...],
  "product_gaps": ["string", "string", ...],
  "opportunities": [
    {{"text": "string", "tag": "string", "priority": "high|medium|low"}},
    ...
  ]
}}

Return ONLY the JSON object, no additional text or markdown formatting."""

    def _parse_analysis_response(self, response: str) -> dict:
        """Parse and validate the LLM response"""
        # Try to extract JSON from the response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if not json_match:
            raise ValueError("No JSON object found in response")

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
            raise ValueError(f"Invalid JSON in response: {e}")

        # Validate required fields
        required_fields = [
            "executive_summary",
            "industry_standards",
            "best_practices",
            "common_pitfalls",
            "product_gaps",
            "opportunities",
        ]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        # Validate opportunities structure
        for opp in data.get("opportunities", []):
            if not isinstance(opp, dict):
                raise ValueError("Opportunity must be an object")
            if "text" not in opp or "tag" not in opp:
                raise ValueError("Opportunity must have 'text' and 'tag' fields")
            if "priority" not in opp:
                opp["priority"] = "medium"

        return data

    async def run_analysis(self, db: Session, session_id: int) -> None:
        """Run the competitive analysis using LLM"""
        session = db.get(CompetitiveAnalysisSession, session_id)
        if not session:
            logger.error(f"Session {session_id} not found")
            return

        try:
            # Update status to analyzing
            session.status = "analyzing"
            session.updated_at = datetime.utcnow()
            db.commit()

            # Build prompt and call LLM
            prompt = self._build_analysis_prompt(session)
            response = await self.llm.chat_completion_async(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a competitive analysis expert. Always respond with valid JSON only, no markdown or additional text.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=4000,
            )

            # Parse response
            analysis = self._parse_analysis_response(response)

            # Update session with results
            session.executive_summary = analysis["executive_summary"]
            session.industry_standards = analysis["industry_standards"]
            session.best_practices = analysis["best_practices"]
            session.common_pitfalls = analysis["common_pitfalls"]
            session.product_gaps = analysis["product_gaps"]
            session.opportunities = analysis["opportunities"]
            session.status = "completed"
            session.updated_at = datetime.utcnow()
            db.commit()

            logger.info(f"Competitive analysis completed for session {session_id}")

        except Exception as e:
            logger.error(f"Competitive analysis failed for session {session_id}: {e}")
            session.status = "failed"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            db.commit()


# Singleton instance
competitive_analysis_service = CompetitiveAnalysisService()
