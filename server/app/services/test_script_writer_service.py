"""
Test Script Writer Service

Business logic for generating comprehensive test scripts from user stories.
"""
import json
import re
import logging
import asyncio
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select

from app.models.test_script_writer import (
    TestScriptWriterSession,
    TestScriptWriterSessionCreate,
    NFR_OPTIONS,
)
from app.services.openrouter_service import OpenRouterService

logger = logging.getLogger(__name__)


class TestScriptWriterService:
    """Service for test script generation operations"""

    def __init__(self):
        self.llm = OpenRouterService()

    def create_session(
        self, db: Session, data: TestScriptWriterSessionCreate
    ) -> TestScriptWriterSession:
        """Create a new test script writer session"""
        session = TestScriptWriterSession(
            source_type=data.source_type,
            source_id=data.source_id,
            source_title=data.source_title,
            stories=data.stories,
            selected_nfrs=data.selected_nfrs,
            status="pending",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def list_sessions(
        self, db: Session, skip: int = 0, limit: int = 20
    ) -> List[TestScriptWriterSession]:
        """List all test script writer sessions"""
        statement = (
            select(TestScriptWriterSession)
            .order_by(TestScriptWriterSession.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def get_session(
        self, db: Session, session_id: int
    ) -> Optional[TestScriptWriterSession]:
        """Get a specific session by ID"""
        return db.get(TestScriptWriterSession, session_id)

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session"""
        session = db.get(TestScriptWriterSession, session_id)
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    def retry_session(
        self, db: Session, session_id: int
    ) -> Optional[TestScriptWriterSession]:
        """Reset a failed session for retry"""
        session = db.get(TestScriptWriterSession, session_id)
        if not session:
            return None
        session.status = "pending"
        session.error_message = None
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

    def _get_nfr_label(self, value: str) -> str:
        """Get human-readable label for NFR"""
        for nfr in NFR_OPTIONS:
            if nfr["value"] == value:
                return nfr["label"]
        return value

    def _get_nfr_description(self, value: str) -> str:
        """Get description for NFR"""
        for nfr in NFR_OPTIONS:
            if nfr["value"] == value:
                return nfr.get("description", "")
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
        max_tokens: int = 8000,
        context: str = "TestScriptWriter"
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

    def _validate_test_scripts(self, data: Dict[str, Any]) -> None:
        """Validate the parsed test scripts have required fields"""
        # Handle alternate field names
        field_aliases = {
            "story_test_scripts": ["story_test_scripts", "test_scripts", "stories", "scripts"],
            "summary": ["summary", "executive_summary", "overview"],
        }

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

            if not found:
                if canonical_name == "summary":
                    data[canonical_name] = "Test scripts generated successfully."
                else:
                    data[canonical_name] = []
                logger.warning(f"Missing field '{canonical_name}', using default value")

        # Validate story test script structures
        scripts = data.get("story_test_scripts", [])
        if not isinstance(scripts, list):
            data["story_test_scripts"] = []
            return

        for script in scripts:
            if not isinstance(script, dict):
                continue
            # Ensure required fields
            if "story_id" not in script:
                script["story_id"] = str(uuid.uuid4())[:8]
            if "story_title" not in script:
                script["story_title"] = "Untitled Story"
            if "story_description" not in script:
                script["story_description"] = ""
            if "test_cases" not in script:
                script["test_cases"] = []
            if "acceptance_criteria" not in script:
                script["acceptance_criteria"] = []

            # Validate each test case
            for tc in script.get("test_cases", []):
                if not isinstance(tc, dict):
                    continue
                if "id" not in tc:
                    tc["id"] = str(uuid.uuid4())[:8]
                if "title" not in tc:
                    tc["title"] = "Untitled Test"
                if "description" not in tc:
                    tc["description"] = ""
                if "preconditions" not in tc:
                    tc["preconditions"] = []
                if "steps" not in tc:
                    tc["steps"] = []
                if "expected_result" not in tc:
                    tc["expected_result"] = ""
                if "test_type" not in tc:
                    tc["test_type"] = "functional"
                if "priority" not in tc:
                    tc["priority"] = "medium"

    def _build_generation_prompt(self, session: TestScriptWriterSession) -> str:
        """Build the LLM prompt for test script generation"""
        stories_text = ""
        for i, story in enumerate(session.stories, 1):
            title = story.get("title", f"Story {i}")
            description = story.get("description", "")
            acceptance = story.get("acceptance_criteria", [])
            ac_text = "\n".join([f"  - {ac}" for ac in acceptance]) if acceptance else "  (none specified)"
            stories_text += f"""
Story {i}: {title}
Description: {description}
Acceptance Criteria:
{ac_text}
"""

        nfr_text = ""
        if session.selected_nfrs:
            nfr_items = []
            for nfr in session.selected_nfrs:
                label = self._get_nfr_label(nfr)
                desc = self._get_nfr_description(nfr)
                nfr_items.append(f"- {label}: {desc}")
            nfr_text = "\n".join(nfr_items)
        else:
            nfr_text = "(No NFRs selected - focus on functional testing only)"

        return f"""You are a QA engineer creating comprehensive test scripts. Generate detailed test cases for the following user stories.

USER STORIES:
{stories_text}

NON-FUNCTIONAL REQUIREMENTS TO TEST:
{nfr_text}

For EACH story, generate test cases in these categories:
1. **Functional Tests**: Happy path scenarios that verify the acceptance criteria
2. **Edge Cases**: Boundary conditions, empty states, maximum values, unusual inputs
3. **Negative Tests**: Invalid inputs, error scenarios, unauthorized access attempts
4. **NFR Tests**: Tests for each selected non-functional requirement (if any)

Each test case must include:
- Unique ID (short string like "TC001")
- Clear title
- Description of what is being tested
- Preconditions (what must be true before testing)
- Step-by-step instructions (numbered)
- Expected result
- Test type: "functional", "edge_case", "negative", or "nfr"
- NFR category if applicable (e.g., "accessibility", "security")
- Priority: "high", "medium", or "low"

CRITICAL JSON REQUIREMENTS:
- Return ONLY a valid JSON object, nothing else
- No markdown formatting (no ```json blocks)
- No text before or after the JSON

Return your test scripts as a JSON object with this EXACT structure:
{{
  "summary": "Brief overview of test coverage",
  "story_test_scripts": [
    {{
      "story_id": "string",
      "story_title": "string",
      "story_description": "string",
      "acceptance_criteria": ["string", ...],
      "test_cases": [
        {{
          "id": "TC001",
          "title": "string",
          "description": "string",
          "preconditions": ["string", ...],
          "steps": ["Step 1: Do X", "Step 2: Do Y", ...],
          "expected_result": "string",
          "test_type": "functional|edge_case|negative|nfr",
          "nfr_category": "accessibility|security|etc (only if test_type is nfr)",
          "priority": "high|medium|low"
        }}
      ]
    }}
  ]
}}"""

    async def run_generation(self, db: Session, session_id: int) -> None:
        """Run the test script generation using LLM"""
        session = db.get(TestScriptWriterSession, session_id)
        if not session:
            logger.error(f"Session {session_id} not found")
            return

        try:
            # Update status to generating
            session.status = "generating"
            session.updated_at = datetime.utcnow()
            db.commit()

            # Build prompt and call LLM with retry logic
            prompt = self._build_generation_prompt(session)
            messages = [
                {
                    "role": "system",
                    "content": "You are a senior QA engineer who creates thorough, well-structured test scripts. Focus on comprehensive coverage including edge cases and negative scenarios. CRITICAL: You must respond with ONLY valid JSON - no markdown, no code blocks, no explanatory text. Just the raw JSON object.",
                },
                {"role": "user", "content": prompt},
            ]

            # Call LLM with retry logic and robust parsing
            result = await self._call_llm_with_retry(
                messages=messages,
                max_tokens=8000,
                context="TestScriptWriter"
            )

            # Validate required fields
            self._validate_test_scripts(result)

            # Calculate test breakdown
            test_breakdown = {
                "functional": 0,
                "edge_case": 0,
                "negative": 0,
                "nfr": 0,
            }
            total_cases = 0

            for script in result.get("story_test_scripts", []):
                for tc in script.get("test_cases", []):
                    test_type = tc.get("test_type", "functional")
                    if test_type in test_breakdown:
                        test_breakdown[test_type] += 1
                    total_cases += 1

            # Update session with results
            session.story_test_scripts = result["story_test_scripts"]
            session.summary = result.get("summary", "Test scripts generated successfully.")
            session.total_test_cases = total_cases
            session.test_breakdown = test_breakdown
            session.status = "completed"
            session.updated_at = datetime.utcnow()
            db.commit()

            logger.info(f"Test script generation completed for session {session_id}: {total_cases} test cases")

        except Exception as e:
            logger.error(f"Test script generation failed for session {session_id}: {e}")
            session.status = "failed"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            db.commit()


# Singleton instance
test_script_writer_service = TestScriptWriterService()
