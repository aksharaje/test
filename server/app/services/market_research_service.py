"""
Market Research Service

Business logic for market research synthesis workflow.
"""
import json
import re
import logging
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select

from app.models.market_research import (
    MarketResearchSession,
    MarketResearchSessionCreate,
    FOCUS_AREAS,
    INDUSTRIES,
)
from app.services.openrouter_service import OpenRouterService

logger = logging.getLogger(__name__)


class MarketResearchService:
    """Service for market research operations"""

    def __init__(self):
        self.llm = OpenRouterService()

    def create_session(
        self, db: Session, data: MarketResearchSessionCreate, user_id: Optional[int] = None
    ) -> MarketResearchSession:
        """Create a new market research session"""
        session = MarketResearchSession(
            problem_area=data.problem_area,
            problem_area_source_type=data.problem_area_source_type,
            problem_area_source_id=data.problem_area_source_id,
            problem_area_context=data.problem_area_context,
            industry_context=data.industry_context,
            focus_areas=data.focus_areas,
            status="pending",
            user_id=user_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def list_sessions(
        self, db: Session, user_id: Optional[int] = None, skip: int = 0, limit: int = 20
    ) -> List[MarketResearchSession]:
        """List all market research sessions, filtered by user"""
        statement = select(MarketResearchSession)
        if user_id:
            statement = statement.where(MarketResearchSession.user_id == user_id)
        statement = statement.order_by(MarketResearchSession.created_at.desc()).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def get_session(
        self, db: Session, session_id: int, user_id: Optional[int] = None
    ) -> Optional[MarketResearchSession]:
        """Get a specific session by ID, optionally filtered by user"""
        session = db.get(MarketResearchSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None  # User doesn't own this session
        return session

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session"""
        session = db.get(MarketResearchSession, session_id)
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    def retry_session(
        self, db: Session, session_id: int
    ) -> Optional[MarketResearchSession]:
        """Reset a failed session for retry"""
        session = db.get(MarketResearchSession, session_id)
        if not session:
            return None
        session.status = "pending"
        session.error_message = None
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

    def _get_focus_area_label(self, value: str) -> str:
        """Get human-readable label for focus area"""
        for area in FOCUS_AREAS:
            if area["value"] == value:
                return area["label"]
        return value

    def _get_industry_label(self, value: str) -> str:
        """Get human-readable label for industry"""
        for ind in INDUSTRIES:
            if ind["value"] == value:
                return ind["label"]
        return value

    def _parse_llm_json(self, content: str, context: str = "LLM") -> Dict[str, Any]:
        """
        Robust JSON parsing for LLM responses.
        Handles markdown code fences, extra whitespace, and trailing content.
        """
        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        original_content = content
        content = content.strip()

        # Remove markdown code fences if present
        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        # Find the first { or [ to locate the start of JSON
        brace_idx = content.find('{')
        bracket_idx = content.find('[')

        if brace_idx == -1 and bracket_idx == -1:
            logger.error(f"{context} - No JSON found. Content preview: {original_content[:500]}")
            raise ValueError(f"{context}: No JSON object found in response")

        json_start = min(
            brace_idx if brace_idx != -1 else len(content),
            bracket_idx if bracket_idx != -1 else len(content)
        )
        content = content[json_start:]

        # Handle malformed JSON with extra wrapper braces
        if content.startswith('{'):
            rest = content[1:].lstrip()
            if rest.startswith('{'):
                content = rest
                logger.debug("Stripped outer brace wrapper")

        # Find matching closing brace/bracket
        if content.startswith('{'):
            depth = 0
            in_string = False
            escape_next = False
            for i, char in enumerate(content):
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\':
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            content = content[:i+1]
                            break

        # Use JSONDecoder to parse
        from json import JSONDecoder
        decoder = JSONDecoder()

        def try_parse(s: str) -> Dict[str, Any]:
            obj, _ = decoder.raw_decode(s)
            if not isinstance(obj, (dict, list)):
                raise ValueError(f"Parsed content is not a dict or list, got {type(obj)}")
            return obj

        # Try parsing as-is first
        try:
            return try_parse(content)
        except json.JSONDecodeError:
            pass

        # Retry: fix trailing commas
        try:
            fixed = re.sub(r',(\s*[}\]])', r'\1', content)
            return try_parse(fixed)
        except json.JSONDecodeError:
            pass

        # Final attempt with standard json.loads after all cleanups
        try:
            fixed = re.sub(r',(\s*[}\]])', r'\1', content)
            return json.loads(fixed)
        except json.JSONDecodeError as e:
            logger.error(f"{context}: Failed to parse JSON after all attempts. Error: {e}")
            logger.error(f"{context}: Content was: {content[:1000]}")
            raise ValueError(f"{context}: Invalid JSON in response: {e}")

    async def _call_llm_with_retry(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 4000,
        context: str = "MarketResearch"
    ) -> Dict[str, Any]:
        """
        Call LLM with retry logic for empty responses or API errors.
        """
        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            try:
                # On first attempt, try with JSON mode. If it fails, try without.
                use_json_mode = attempt == 0

                kwargs = {
                    "messages": messages,
                    "max_tokens": max_tokens,
                }
                if use_json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                result = await self.llm.chat(**kwargs)
                content = result.get("content", "")

                if not content or content.strip() == "":
                    raise ValueError("Empty response from LLM")

                return self._parse_llm_json(content, context)

            except Exception as e:
                logger.warning(f"{context} LLM call failed (attempt {attempt + 1}/{max_retries}): {e}")
                last_error = e

            await asyncio.sleep(2 * (attempt + 1))  # Backoff: 2s, 4s, 6s

        raise ValueError(f"{context}: Failed after {max_retries} attempts. Last error: {last_error}")

    def _validate_analysis(self, data: Dict[str, Any]) -> None:
        """Validate the parsed analysis has required fields"""
        # Handle alternate field names the LLM might use
        field_aliases = {
            "expectation_shifts": ["expectation_shifts", "user_expectation_shifts", "user_expectations", "expectations"],
            "market_trends": ["market_trends", "trends"],
            "market_risks": ["market_risks", "risks"],
            "implications": ["implications", "strategic_implications", "recommendations"],
            "executive_summary": ["executive_summary", "summary", "overview"],
        }

        # Normalize field names and provide defaults
        for canonical_name, aliases in field_aliases.items():
            found = False
            for alias in aliases:
                if alias in data and alias != canonical_name:
                    data[canonical_name] = data.pop(alias)
                    found = True
                    break
                elif alias in data:
                    found = True
                    break

            # Provide default empty values for missing fields
            if not found:
                if canonical_name == "executive_summary":
                    data[canonical_name] = "Analysis completed. See detailed sections below."
                else:
                    data[canonical_name] = []
                logger.warning(f"Missing field '{canonical_name}', using default value")

        # Validate insight structures
        for field in ["market_trends", "expectation_shifts", "market_risks"]:
            insights = data.get(field, [])
            if not isinstance(insights, list):
                data[field] = []
                continue
            for insight in insights:
                if not isinstance(insight, dict):
                    continue
                if "text" not in insight:
                    continue
                if "confidence" not in insight:
                    insight["confidence"] = "MEDIUM"
                if "source_count" not in insight:
                    insight["source_count"] = 0
                if "sources" not in insight:
                    insight["sources"] = []

    def _build_analysis_prompt(self, session: MarketResearchSession) -> str:
        """Build the LLM prompt for market research synthesis"""
        industry_label = self._get_industry_label(session.industry_context)

        focus_labels = [self._get_focus_area_label(f) for f in session.focus_areas]
        focus_text = ", ".join(focus_labels) if focus_labels else "all areas"

        # Use problem area context if available (from source selection)
        problem_description = session.problem_area
        if session.problem_area_context:
            problem_description = session.problem_area_context

        return f"""You are a market research analyst who synthesizes trends, risks, and signals from industry sources. Your audience is product managers making strategic decisions.

Analyze the market landscape for the following:

Problem Area: {problem_description}
Industry Context: {industry_label}
Focus Areas: {focus_text}

Provide a comprehensive market research synthesis with the following sections:

1. **Executive Summary**: A brief 2-3 sentence overview of the current market landscape for this problem area, highlighting the most important signals.

2. **Market Trends**: List 4-6 significant trends affecting this problem area. For each trend:
   - Describe the trend and its direction
   - Assign a confidence level (HIGH, MEDIUM, or LOW) based on source agreement
   - Estimate how many credible sources support this (1-5)
   - Reference general source types (e.g., "Industry analysts", "UX research firms", "Platform guidelines")

3. **User Expectation Shifts**: List 3-5 ways user expectations are changing. For each:
   - Describe what users increasingly expect or reject
   - Assign a confidence level
   - Estimate source count

4. **Market Risks & Constraints**: List 3-5 risks or constraints to consider. For each:
   - Describe the risk and potential impact
   - Assign a confidence level
   - Estimate source count

5. **Implications**: List 4-6 actionable implications - what this means for product decisions. These should be concise, strategic recommendations.

CRITICAL JSON REQUIREMENTS:
- Return ONLY a valid JSON object, nothing else
- No markdown formatting (no ```json blocks)
- No text before or after the JSON
- All strings must be properly escaped
- Confidence must be exactly one of: "HIGH", "MEDIUM", "LOW"

Return your analysis as a JSON object with this EXACT structure:
{{
  "executive_summary": "string",
  "market_trends": [
    {{"text": "string", "confidence": "HIGH|MEDIUM|LOW", "source_count": number, "sources": ["string", ...]}}
  ],
  "expectation_shifts": [
    {{"text": "string", "confidence": "HIGH|MEDIUM|LOW", "source_count": number, "sources": ["string", ...]}}
  ],
  "market_risks": [
    {{"text": "string", "confidence": "HIGH|MEDIUM|LOW", "source_count": number, "sources": ["string", ...]}}
  ],
  "implications": ["string", "string", ...]
}}"""

    async def run_analysis(self, db: Session, session_id: int) -> None:
        """Run the market research analysis using LLM"""
        session = db.get(MarketResearchSession, session_id)
        if not session:
            logger.error(f"Session {session_id} not found")
            return

        try:
            # Update status to analyzing
            session.status = "analyzing"
            session.updated_at = datetime.utcnow()
            db.commit()

            # Build prompt and call LLM with retry logic
            prompt = self._build_analysis_prompt(session)
            messages = [
                {
                    "role": "system",
                    "content": "You are a market research analyst who synthesizes insights from industry sources like Nielsen Norman Group, Forrester, Gartner, and Baymard Institute. Focus on actionable trends and signals. CRITICAL: You must respond with ONLY valid JSON - no markdown, no code blocks, no explanatory text. Just the raw JSON object.",
                },
                {"role": "user", "content": prompt},
            ]

            # Call LLM with retry logic and robust parsing
            analysis = await self._call_llm_with_retry(
                messages=messages,
                max_tokens=4000,
                context="MarketResearch"
            )

            # Validate required fields
            self._validate_analysis(analysis)

            # Update session with results
            session.executive_summary = analysis["executive_summary"]
            session.market_trends = analysis["market_trends"]
            session.expectation_shifts = analysis["expectation_shifts"]
            session.market_risks = analysis["market_risks"]
            session.implications = analysis["implications"]
            session.status = "completed"
            session.updated_at = datetime.utcnow()
            db.commit()

            logger.info(f"Market research completed for session {session_id}")

        except Exception as e:
            logger.error(f"Market research failed for session {session_id}: {e}")
            session.status = "failed"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            db.commit()


# Singleton instance
market_research_service = MarketResearchService()
