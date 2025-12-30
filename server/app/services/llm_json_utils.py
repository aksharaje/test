"""
Centralized LLM JSON Utilities

Provides strict JSON output handling for all LLM calls across the application.
Ensures consistent, reliable JSON responses from language models.
"""
import json
import re
import time
from typing import Any, Dict, List, Optional, Union
from openai import OpenAI


# Strict system messages for JSON output
STRICT_JSON_SYSTEM_MESSAGE = """You are a JSON-only API. You MUST follow these rules EXACTLY:

1. OUTPUT FORMAT: Return ONLY a valid JSON object. Nothing else.
2. NO MARKDOWN: Do NOT wrap your response in ```json``` or any markdown.
3. NO EXPLANATIONS: Do NOT include any text before or after the JSON.
4. NO COMMENTS: JSON does not support comments. Do not include any.
5. VALID JSON: Ensure all strings are properly quoted, no trailing commas.
6. COMPLETE RESPONSE: Return the complete JSON object, do not truncate.

Your entire response must be parseable by JSON.parse() with no modifications."""

STRICT_JSON_ARRAY_SYSTEM_MESSAGE = """You are a JSON-only API. You MUST follow these rules EXACTLY:

1. OUTPUT FORMAT: Return ONLY a valid JSON array. Nothing else.
2. NO MARKDOWN: Do NOT wrap your response in ```json``` or any markdown.
3. NO EXPLANATIONS: Do NOT include any text before or after the JSON.
4. NO COMMENTS: JSON does not support comments. Do not include any.
5. VALID JSON: Ensure all strings are properly quoted, no trailing commas.
6. COMPLETE RESPONSE: Return the complete JSON array, do not truncate.

Your entire response must be parseable by JSON.parse() with no modifications."""


class LLMJSONError(Exception):
    """Raised when LLM fails to return valid JSON after all retries."""
    pass


class StrictJSONLLM:
    """
    Wrapper for LLM calls that enforces strict JSON output.

    Features:
    - Strict system messages that enforce JSON-only output
    - Robust JSON parsing with multiple fallback strategies
    - Automatic retry with escalating strictness
    - Schema validation (optional)
    - Detailed error reporting
    """

    def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1", model: str = "openai/gpt-oss-120b"):
        self.client = OpenAI(api_key=api_key, base_url=base_url, timeout=120.0)  # 2 minute timeout
        self.model = model

    def call(
        self,
        prompt: str,
        context: str = "LLM",
        temperature: float = 0.3,
        max_tokens: int = 4000,
        max_retries: int = 3,
        expected_type: str = "object",  # "object" or "array"
        required_keys: Optional[List[str]] = None,
        fallback_value: Optional[Any] = None
    ) -> Union[Dict[str, Any], List[Any]]:
        """
        Call LLM with strict JSON output enforcement.

        Args:
            prompt: The user prompt (should describe expected JSON structure)
            context: Description for error messages (e.g., "Clustering", "Scoring")
            temperature: LLM temperature (lower = more deterministic)
            max_tokens: Maximum tokens in response
            max_retries: Number of retry attempts
            expected_type: "object" for dict, "array" for list
            required_keys: Keys that must exist in response (for objects)
            fallback_value: Value to return if all retries fail (None = raise error)

        Returns:
            Parsed JSON as dict or list

        Raises:
            LLMJSONError: If all retries fail and no fallback provided
        """
        system_msg = STRICT_JSON_SYSTEM_MESSAGE if expected_type == "object" else STRICT_JSON_ARRAY_SYSTEM_MESSAGE

        last_error = None
        last_raw_response = None

        for attempt in range(max_retries):
            try:
                # Build messages with increasing strictness on retry
                messages = self._build_messages(prompt, system_msg, attempt)

                # Use JSON mode on first attempts, disable on last attempt as fallback
                use_json_mode = attempt < (max_retries - 1)

                kwargs = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": max(0.1, temperature - (attempt * 0.1)),  # Lower temp on retry
                    "max_tokens": max_tokens,
                }
                if use_json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                response = self.client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                last_raw_response = content

                if not content or not content.strip():
                    raise ValueError("Empty response from LLM")

                # Parse JSON with robust fallbacks
                result = self._parse_json(content, expected_type)

                # Validate required keys
                if required_keys and expected_type == "object":
                    missing = [k for k in required_keys if k not in result]
                    if missing:
                        raise ValueError(f"Missing required keys: {missing}")

                return result

            except Exception as e:
                last_error = e
                print(f"[{context}] Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1.5 * (attempt + 1))  # Exponential backoff

        # All retries failed
        error_msg = f"[{context}] Failed to get valid JSON after {max_retries} attempts. Last error: {last_error}"
        if last_raw_response:
            error_msg += f"\nLast raw response (truncated): {last_raw_response[:500]}"

        print(f"ERROR: {error_msg}")

        if fallback_value is not None:
            print(f"[{context}] Using fallback value")
            return fallback_value

        raise LLMJSONError(error_msg)

    def _build_messages(self, prompt: str, system_msg: str, attempt: int) -> List[Dict[str, str]]:
        """Build messages with increasing strictness on retry."""
        messages = [{"role": "system", "content": system_msg}]

        # Add extra strictness reminder on retries
        if attempt > 0:
            prompt = f"""IMPORTANT: Previous response was not valid JSON. You MUST return ONLY valid JSON.

{prompt}

REMINDER: Return ONLY the JSON object/array. No markdown, no explanations, no code fences."""

        messages.append({"role": "user", "content": prompt})
        return messages

    def _parse_json(self, content: str, expected_type: str) -> Union[Dict[str, Any], List[Any]]:
        """
        Parse JSON with multiple fallback strategies.

        Strategies:
        1. Direct parse
        2. Strip markdown code fences
        3. Find JSON boundaries manually
        4. Fix common JSON errors
        """
        content = content.strip()

        # Strategy 1: Direct parse
        try:
            result = json.loads(content)
            self._validate_type(result, expected_type)
            return result
        except json.JSONDecodeError:
            pass

        # Strategy 2: Remove markdown code fences
        cleaned = self._remove_markdown_fences(content)
        if cleaned != content:
            try:
                result = json.loads(cleaned)
                self._validate_type(result, expected_type)
                return result
            except json.JSONDecodeError:
                pass
            content = cleaned

        # Strategy 3: Find JSON boundaries
        extracted = self._extract_json(content, expected_type)
        if extracted:
            try:
                result = json.loads(extracted)
                self._validate_type(result, expected_type)
                return result
            except json.JSONDecodeError:
                pass

        # Strategy 4: Fix common errors and retry
        fixed = self._fix_common_errors(content)
        try:
            result = json.loads(fixed)
            self._validate_type(result, expected_type)
            return result
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {e}. Content: {content[:200]}...")

    def _validate_type(self, result: Any, expected_type: str):
        """Validate the parsed result matches expected type."""
        if expected_type == "object" and not isinstance(result, dict):
            raise ValueError(f"Expected object, got {type(result).__name__}")
        if expected_type == "array" and not isinstance(result, list):
            raise ValueError(f"Expected array, got {type(result).__name__}")

    def _remove_markdown_fences(self, content: str) -> str:
        """Remove markdown code fences from content."""
        # Match ```json ... ``` or ``` ... ```
        pattern = r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```'
        match = re.search(pattern, content)
        if match:
            return match.group(1).strip()

        # Simple removal
        content = re.sub(r'^```(?:json|JSON)?\s*', '', content)
        content = re.sub(r'\s*```$', '', content)
        return content.strip()

    def _extract_json(self, content: str, expected_type: str) -> Optional[str]:
        """Extract JSON object/array from content by finding boundaries."""
        start_char = '{' if expected_type == "object" else '['
        end_char = '}' if expected_type == "object" else ']'

        start_idx = content.find(start_char)
        if start_idx == -1:
            return None

        # Find matching closing bracket
        depth = 0
        in_string = False
        escape_next = False

        for i, char in enumerate(content[start_idx:], start_idx):
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
                if char == start_char:
                    depth += 1
                elif char == end_char:
                    depth -= 1
                    if depth == 0:
                        return content[start_idx:i + 1]

        return None

    def _fix_common_errors(self, content: str) -> str:
        """Fix common JSON formatting errors."""
        # Remove trailing commas before ] or }
        content = re.sub(r',\s*([}\]])', r'\1', content)

        # Fix unquoted keys (simple cases)
        content = re.sub(r'([{,]\s*)(\w+)(\s*:)', r'\1"\2"\3', content)

        # Fix single quotes to double quotes (be careful with apostrophes)
        # Only do this if there are no double quotes in the content
        if '"' not in content and "'" in content:
            content = content.replace("'", '"')

        return content


def create_json_prompt(
    task_description: str,
    json_schema: Dict[str, Any],
    examples: Optional[List[Dict[str, Any]]] = None,
    additional_rules: Optional[List[str]] = None
) -> str:
    """
    Create a well-structured prompt for JSON output.

    Args:
        task_description: What the LLM should do
        json_schema: Expected JSON structure with descriptions
        examples: Optional example outputs
        additional_rules: Optional additional rules/constraints

    Returns:
        Formatted prompt string
    """
    prompt_parts = [task_description, ""]

    # Add schema
    prompt_parts.append("REQUIRED JSON OUTPUT FORMAT:")
    prompt_parts.append(json.dumps(json_schema, indent=2))
    prompt_parts.append("")

    # Add examples if provided
    if examples:
        prompt_parts.append("EXAMPLES:")
        for i, example in enumerate(examples, 1):
            prompt_parts.append(f"Example {i}:")
            prompt_parts.append(json.dumps(example, indent=2))
            prompt_parts.append("")

    # Add rules
    prompt_parts.append("RULES:")
    base_rules = [
        "Return ONLY the JSON object, no other text",
        "Do NOT use markdown code fences",
        "Ensure all required fields are present",
        "Use the exact field names shown in the schema"
    ]
    if additional_rules:
        base_rules.extend(additional_rules)

    for i, rule in enumerate(base_rules, 1):
        prompt_parts.append(f"{i}. {rule}")

    return "\n".join(prompt_parts)


# Singleton instance factory
_llm_instance: Optional[StrictJSONLLM] = None

def get_strict_json_llm() -> StrictJSONLLM:
    """Get or create the singleton StrictJSONLLM instance."""
    global _llm_instance
    if _llm_instance is None:
        from app.core.config import settings
        if not settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY is required")
        _llm_instance = StrictJSONLLM(
            api_key=settings.OPENROUTER_API_KEY,
            model=settings.OPENROUTER_MODEL
        )
    return _llm_instance
