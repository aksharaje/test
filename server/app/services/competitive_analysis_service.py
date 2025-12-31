"""
Competitive Analysis Service

Business logic for competitive analysis workflow.
"""
import json
import re
import logging
import time
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select

from app.models.competitive_analysis import (
    CompetitiveAnalysisSession,
    CompetitiveAnalysisSessionCreate,
    FOCUS_AREAS,
    INDUSTRIES,
)
from app.services.openrouter_service import OpenRouterService
from app.services.knowledge_base_service import knowledge_base_service

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
            focus_area=data.focus_area,
            custom_focus_area=data.custom_focus_area,
            reference_competitors=data.reference_competitors,
            include_best_in_class=data.include_best_in_class,
            include_adjacent_industries=data.include_adjacent_industries,
            target_industry=data.target_industry,
            input_source_type=data.input_source_type,
            input_source_id=data.input_source_id,
            input_source_description=data.input_source_description,
            knowledge_base_id=data.knowledge_base_id,
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

    def _get_knowledge_base_context(self, db: Session, kb_id: int, focus_area: str) -> str:
        """Fetch relevant code context from knowledge base"""
        try:
            # Search for code related to the focus area
            results = knowledge_base_service.search(db, kb_id, focus_area, limit=10)
            if not results:
                return ""

            context_parts = []
            for r in results:
                doc_name = r.get('documentName', 'Unknown')
                content = r.get('content', '')
                if content:
                    context_parts.append(f"[File: {doc_name}]\n```\n{content}\n```")

            if not context_parts:
                return ""

            return "\n\n".join(context_parts[:5])  # Limit to top 5 results
        except Exception as e:
            logger.warning(f"Failed to fetch KB context: {e}")
            return ""

    def _parse_llm_json(self, content: str, context: str = "LLM") -> Dict[str, Any]:
        """
        Robust JSON parsing for LLM responses.
        Handles markdown code fences, extra whitespace, and trailing content.
        """
        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        original_content = content
        content = content.strip()

        # Remove markdown code fences if present (handles ```json, ```JSON, ``` etc.)
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

        # Retry: strip outer wrapper braces
        if content.startswith('{'):
            inner = content[1:].strip()
            if inner.startswith('{') and inner.endswith('}'):
                try:
                    return try_parse(inner)
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
        context: str = "CompetitiveAnalysis"
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

    def _validate_analysis(self, data: Dict[str, Any], expect_product_gaps: bool = True) -> None:
        """Validate the parsed analysis has required fields"""
        required_fields = [
            "executive_summary",
            "industry_standards",
            "best_practices",
            "common_pitfalls",
            "opportunities",
        ]

        if expect_product_gaps:
            required_fields.append("product_gaps")
        else:
            # Ensure empty array if not expected
            if "product_gaps" not in data:
                data["product_gaps"] = []

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

    def _build_analysis_prompt(
        self, session: CompetitiveAnalysisSession, code_context: str = ""
    ) -> str:
        """Build the LLM prompt for competitive analysis"""
        focus_label = (
            session.custom_focus_area
            if session.focus_area == "other" and session.custom_focus_area
            else self._get_focus_area_label(session.focus_area)
        )

        competitors_text = ""
        if session.reference_competitors:
            competitors_text = f"\nDirect Competitors to analyze: {', '.join(session.reference_competitors)}"

        scope_parts = []
        if session.include_best_in_class:
            scope_parts.append("best-in-class digital products")
        if session.include_adjacent_industries and session.target_industry:
            industry_label = self._get_industry_label(session.target_industry)
            scope_parts.append(f"industry-specific solutions in {industry_label}")
        elif session.include_adjacent_industries:
            scope_parts.append("adjacent industries")
        scope_text = ", ".join(scope_parts) if scope_parts else "industry leaders"

        # Include input source context if provided
        input_context = ""
        if session.input_source_description:
            input_context = f"""

## Product/Feature Context

The user is analyzing competitive landscape for the following product or feature idea:

{session.input_source_description}

Use this context to provide more relevant and targeted competitive analysis."""

        code_section = ""
        if code_context:
            code_section = f"""

## User's Current Implementation

The user has shared code from their codebase related to this focus area. Analyze how their implementation compares to industry standards and competitors:

{code_context}

When generating your analysis, include a "code_comparison" field that specifically addresses:
- How their current implementation aligns with or differs from best practices
- Specific strengths in their implementation
- Areas where their code could be improved based on competitive analysis
- Recommendations for code-level improvements"""

        # Determine if we have product context
        has_product_context = bool(session.input_source_description or code_context)

        # Build the JSON structure for optional fields (avoid backslashes in f-string)
        code_comparison_json = ',\n  "code_comparison": "string"' if code_context else ""
        product_gaps_json = '\n  "product_gaps": ["string", "string", ...],' if has_product_context else ""

        # Build product gaps section if context provided
        product_gaps_section = ""
        if has_product_context:
            product_gaps_section = """
5. **Product Gaps**: Based on the product context provided, list 4-6 areas where this product may be MISSING features or capabilities that competitors commonly offer. These are gaps between what this product does and what the market expects. Be specific to the product described."""

        # Adjust opportunity numbering based on whether product gaps is included
        opp_number = "6" if has_product_context else "5"
        code_number = "7" if has_product_context else "6"

        return f"""You are a competitive analysis expert who helps product managers understand industry standards and opportunities. Your audience is NON-TECHNICAL product managers, so focus on USER EXPERIENCE and BUSINESS IMPACT, not technical implementation details.

Analyze the competitive landscape for the following focus area in customer-facing mobile/web applications:

Focus Area: {focus_label}
Analysis Scope: {scope_text}{competitors_text}{input_context}{code_section}

IMPORTANT WRITING GUIDELINES:
- Lead with the USER BENEFIT or BUSINESS OUTCOME, not technical implementation
- Describe WHAT users experience, not HOW it's built
- If mentioning technical details, put them in parentheses at the end as optional context
- Use plain language a non-technical stakeholder would understand

Example transformations:
- BAD: "Viewport meta tag with width=device-width and initial-scale=1"
- GOOD: "Pages automatically adapt to any screen size for comfortable reading (via responsive viewport settings)"

- BAD: "CSS Flexbox/Grid that collapses gracefully at breakpoints"
- GOOD: "Content reflows smoothly when rotating device or resizing browser (using flexible layout systems)"

- BAD: "Server-side rendering (SSR) with hydration for fast first paint"
- GOOD: "Pages appear instantly without loading spinners, reducing bounce rates (via server-side rendering)"

Provide a comprehensive competitive analysis with the following sections:

1. **Executive Summary**: A brief 2-3 sentence overview of the competitive landscape for this focus area, focused on user expectations and business implications.

2. **Industry Standards**: List 4-6 features or experiences that users EXPECT as baseline (adopted by 70%+ of products). Focus on what users experience, not how it's built.

3. **Best Practices**: List 4-6 approaches that delight users and differentiate top performers. Explain the user/business benefit first.

4. **Common Pitfalls**: List 4-6 common mistakes that frustrate users or hurt business metrics. Describe the negative user impact.
{product_gaps_section}

{opp_number}. **Opportunities**: List 4-6 specific, actionable opportunities with:
   - A clear description of the opportunity (user/business focused)
   - An impact tag (e.g., "Increases conversion", "Reduces churn", "Improves engagement")
   - Priority level (high, medium, low)

{f"{code_number}. **Code Comparison**: Analysis of the user's implementation vs competitors (only if code was provided)." if code_context else ""}

CRITICAL JSON REQUIREMENTS:
- Return ONLY a valid JSON object, nothing else
- No markdown formatting (no ```json blocks)
- No text before or after the JSON
- All strings must be properly escaped (use \\" for quotes within strings, \\n for newlines)
- Priority must be exactly one of: "high", "medium", "low"
{"- product_gaps field is REQUIRED since product context was provided" if has_product_context else "- product_gaps field should be an EMPTY ARRAY since no product context was provided"}

Return your analysis as a JSON object with this EXACT structure:
{{
  "executive_summary": "string",
  "industry_standards": ["string", "string", ...],
  "best_practices": ["string", "string", ...],
  "common_pitfalls": ["string", "string", ...],{product_gaps_json}
  "opportunities": [
    {{"text": "string", "tag": "string", "priority": "high|medium|low"}},
    ...
  ]{code_comparison_json}
}}"""

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

            # Fetch code context if knowledge base provided
            code_context = ""
            if session.knowledge_base_id:
                code_context = self._get_knowledge_base_context(
                    db, session.knowledge_base_id, session.focus_area
                )

            # Determine if we have product context
            has_product_context = bool(session.input_source_description or code_context)

            # Build prompt and call LLM with retry logic
            prompt = self._build_analysis_prompt(session, code_context)
            messages = [
                {
                    "role": "system",
                    "content": "You are a competitive analysis expert who writes for non-technical product managers. Focus on user experience and business impact, not technical implementation. CRITICAL: You must respond with ONLY valid JSON - no markdown, no code blocks, no explanatory text. Just the raw JSON object.",
                },
                {"role": "user", "content": prompt},
            ]

            # Call LLM with retry logic and robust parsing
            analysis = await self._call_llm_with_retry(
                messages=messages,
                max_tokens=4000,
                context="CompetitiveAnalysis"
            )

            # Validate required fields
            self._validate_analysis(analysis, expect_product_gaps=has_product_context)

            # Update session with results
            session.executive_summary = analysis["executive_summary"]
            session.industry_standards = analysis["industry_standards"]
            session.best_practices = analysis["best_practices"]
            session.common_pitfalls = analysis["common_pitfalls"]
            session.product_gaps = analysis["product_gaps"]
            session.opportunities = analysis["opportunities"]
            session.code_comparison = analysis.get("code_comparison")
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
