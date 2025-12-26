"""
Comprehensive tests for LLM JSON utilities.

Tests cover:
- JSON parsing with various edge cases
- Markdown fence removal
- JSON boundary extraction
- Common error fixing
- Retry logic
- Prompt creation helpers
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from app.services.llm_json_utils import (
    StrictJSONLLM,
    LLMJSONError,
    create_json_prompt,
    STRICT_JSON_SYSTEM_MESSAGE,
    STRICT_JSON_ARRAY_SYSTEM_MESSAGE
)


class TestStrictJSONLLMParsing:
    """Test JSON parsing with various input formats."""

    @pytest.fixture
    def llm(self):
        """Create StrictJSONLLM instance with mock client."""
        with patch('app.services.llm_json_utils.OpenAI'):
            return StrictJSONLLM(api_key="test-key", model="test-model")

    # --- Direct JSON parsing ---

    def test_parse_clean_json_object(self, llm):
        """Should parse clean JSON object directly."""
        content = '{"name": "test", "value": 123}'
        result = llm._parse_json(content, "object")
        assert result == {"name": "test", "value": 123}

    def test_parse_clean_json_array(self, llm):
        """Should parse clean JSON array directly."""
        content = '[{"id": 1}, {"id": 2}]'
        result = llm._parse_json(content, "array")
        assert result == [{"id": 1}, {"id": 2}]

    def test_parse_json_with_whitespace(self, llm):
        """Should handle leading/trailing whitespace."""
        content = '  \n  {"key": "value"}  \n  '
        result = llm._parse_json(content, "object")
        assert result == {"key": "value"}

    def test_parse_nested_json(self, llm):
        """Should parse deeply nested JSON."""
        content = '{"level1": {"level2": {"level3": {"deep": true}}}}'
        result = llm._parse_json(content, "object")
        assert result["level1"]["level2"]["level3"]["deep"] is True

    def test_parse_json_with_special_characters(self, llm):
        """Should handle special characters in strings."""
        content = '{"text": "Hello\\nWorld\\t\\"quoted\\"", "emoji": "🎉"}'
        result = llm._parse_json(content, "object")
        assert result["text"] == 'Hello\nWorld\t"quoted"'
        assert result["emoji"] == "🎉"

    # --- Markdown fence removal ---

    def test_remove_json_code_fence(self, llm):
        """Should remove ```json``` code fences."""
        content = '```json\n{"key": "value"}\n```'
        result = llm._parse_json(content, "object")
        assert result == {"key": "value"}

    def test_remove_plain_code_fence(self, llm):
        """Should remove plain ``` code fences."""
        content = '```\n{"key": "value"}\n```'
        result = llm._parse_json(content, "object")
        assert result == {"key": "value"}

    def test_remove_code_fence_uppercase(self, llm):
        """Should handle uppercase JSON in code fence."""
        content = '```JSON\n{"key": "value"}\n```'
        result = llm._parse_json(content, "object")
        assert result == {"key": "value"}

    def test_json_with_text_before_fence(self, llm):
        """Should extract JSON from text with preceding explanation."""
        content = 'Here is the result:\n```json\n{"result": "success"}\n```'
        result = llm._parse_json(content, "object")
        assert result == {"result": "success"}

    def test_json_with_text_after_fence(self, llm):
        """Should extract JSON ignoring text after code fence."""
        content = '```json\n{"data": [1, 2, 3]}\n```\nHope this helps!'
        result = llm._parse_json(content, "object")
        assert result == {"data": [1, 2, 3]}

    # --- JSON boundary extraction ---

    def test_extract_json_from_mixed_content(self, llm):
        """Should find JSON object in mixed content."""
        content = 'The answer is: {"found": true} as you can see.'
        result = llm._parse_json(content, "object")
        assert result == {"found": True}

    def test_extract_array_from_mixed_content(self, llm):
        """Should find JSON array in mixed content."""
        content = 'Results: [1, 2, 3] are the values.'
        result = llm._parse_json(content, "array")
        assert result == [1, 2, 3]

    def test_extract_json_with_nested_braces(self, llm):
        """Should correctly match nested braces."""
        content = 'Data: {"outer": {"inner": {"deep": 1}}} done.'
        result = llm._parse_json(content, "object")
        assert result == {"outer": {"inner": {"deep": 1}}}

    def test_extract_json_with_strings_containing_braces(self, llm):
        """Should handle braces inside strings correctly."""
        content = '{"text": "use {brackets} and [arrays]", "valid": true}'
        result = llm._parse_json(content, "object")
        assert result["text"] == "use {brackets} and [arrays]"
        assert result["valid"] is True

    def test_extract_json_with_escaped_quotes(self, llm):
        """Should handle escaped quotes in strings."""
        content = '{"quote": "He said \\"hello\\" to me"}'
        result = llm._parse_json(content, "object")
        assert result["quote"] == 'He said "hello" to me'

    # --- Common error fixing ---

    def test_fix_trailing_comma_in_object(self, llm):
        """Should fix trailing comma in object."""
        content = '{"a": 1, "b": 2,}'
        result = llm._parse_json(content, "object")
        assert result == {"a": 1, "b": 2}

    def test_fix_trailing_comma_in_array(self, llm):
        """Should fix trailing comma in array."""
        content = '[1, 2, 3,]'
        result = llm._parse_json(content, "array")
        assert result == [1, 2, 3]

    def test_fix_multiple_trailing_commas(self, llm):
        """Should fix nested trailing commas."""
        content = '{"items": [1, 2,], "nested": {"a": 1,},}'
        result = llm._parse_json(content, "object")
        assert result == {"items": [1, 2], "nested": {"a": 1}}

    # --- Type validation ---

    def test_validate_object_type(self, llm):
        """Should raise error when expecting object but got array."""
        content = '[1, 2, 3]'
        with pytest.raises(ValueError, match="Expected object"):
            llm._parse_json(content, "object")

    def test_validate_array_type(self, llm):
        """Should raise error when expecting array but got object."""
        content = '{"key": "value"}'
        with pytest.raises(ValueError, match="Expected array"):
            llm._parse_json(content, "array")

    # --- Edge cases ---

    def test_empty_object(self, llm):
        """Should parse empty object."""
        content = '{}'
        result = llm._parse_json(content, "object")
        assert result == {}

    def test_empty_array(self, llm):
        """Should parse empty array."""
        content = '[]'
        result = llm._parse_json(content, "array")
        assert result == []

    def test_json_with_null_values(self, llm):
        """Should handle null values."""
        content = '{"name": null, "items": [null, 1, null]}'
        result = llm._parse_json(content, "object")
        assert result["name"] is None
        assert result["items"] == [None, 1, None]

    def test_json_with_boolean_values(self, llm):
        """Should handle boolean values."""
        content = '{"active": true, "deleted": false}'
        result = llm._parse_json(content, "object")
        assert result["active"] is True
        assert result["deleted"] is False

    def test_json_with_numeric_values(self, llm):
        """Should handle various numeric formats."""
        content = '{"int": 42, "float": 3.14, "negative": -10, "exp": 1e5}'
        result = llm._parse_json(content, "object")
        assert result["int"] == 42
        assert result["float"] == 3.14
        assert result["negative"] == -10
        assert result["exp"] == 1e5

    def test_unparseable_content_raises_error(self, llm):
        """Should raise ValueError for completely invalid content."""
        content = 'This is not JSON at all'
        with pytest.raises(ValueError, match="Failed to parse JSON"):
            llm._parse_json(content, "object")


class TestStrictJSONLLMCall:
    """Test the full LLM call flow with mocks."""

    @pytest.fixture
    def mock_openai(self):
        """Create mock OpenAI client."""
        with patch('app.services.llm_json_utils.OpenAI') as mock:
            yield mock

    def test_successful_call_returns_parsed_json(self, mock_openai):
        """Should return parsed JSON on successful call."""
        # Setup mock
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"result": "success"}'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        result = llm.call("Test prompt", context="Test")

        assert result == {"result": "success"}

    def test_uses_json_mode_on_first_attempts(self, mock_openai):
        """Should use response_format json_object on initial attempts."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"ok": true}'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        llm.call("Test", context="Test")

        call_kwargs = mock_openai.return_value.chat.completions.create.call_args[1]
        assert call_kwargs.get("response_format") == {"type": "json_object"}

    def test_validates_required_keys(self, mock_openai):
        """Should validate required keys are present."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"a": 1}'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")

        with pytest.raises(LLMJSONError, match="Missing required keys"):
            llm.call("Test", required_keys=["a", "b", "c"], max_retries=1)

    def test_required_keys_pass_when_present(self, mock_openai):
        """Should pass validation when all required keys present."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"a": 1, "b": 2}'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        result = llm.call("Test", required_keys=["a", "b"])

        assert result == {"a": 1, "b": 2}

    def test_retries_on_invalid_json(self, mock_openai):
        """Should retry when receiving invalid JSON."""
        mock_client = mock_openai.return_value

        # First call returns invalid, second returns valid
        invalid_response = Mock()
        invalid_response.choices = [Mock()]
        invalid_response.choices[0].message.content = 'Not JSON'

        valid_response = Mock()
        valid_response.choices = [Mock()]
        valid_response.choices[0].message.content = '{"valid": true}'

        mock_client.chat.completions.create.side_effect = [invalid_response, valid_response]

        llm = StrictJSONLLM(api_key="test", model="test")
        with patch('time.sleep'):  # Skip actual sleep
            result = llm.call("Test", context="Test", max_retries=2)

        assert result == {"valid": True}
        assert mock_client.chat.completions.create.call_count == 2

    def test_returns_fallback_after_all_retries_fail(self, mock_openai):
        """Should return fallback value when all retries fail."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Invalid'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        with patch('time.sleep'):
            result = llm.call(
                "Test",
                max_retries=2,
                fallback_value={"default": True}
            )

        assert result == {"default": True}

    def test_raises_error_without_fallback(self, mock_openai):
        """Should raise LLMJSONError when no fallback provided."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'Invalid JSON'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        with patch('time.sleep'):
            with pytest.raises(LLMJSONError):
                llm.call("Test", max_retries=2)

    def test_empty_response_triggers_retry(self, mock_openai):
        """Should retry on empty response."""
        mock_client = mock_openai.return_value

        empty_response = Mock()
        empty_response.choices = [Mock()]
        empty_response.choices[0].message.content = ''

        valid_response = Mock()
        valid_response.choices = [Mock()]
        valid_response.choices[0].message.content = '{"data": 1}'

        mock_client.chat.completions.create.side_effect = [empty_response, valid_response]

        llm = StrictJSONLLM(api_key="test", model="test")
        with patch('time.sleep'):
            result = llm.call("Test", max_retries=2)

        assert result == {"data": 1}

    def test_array_expected_type(self, mock_openai):
        """Should handle array expected type."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '[1, 2, 3]'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        result = llm.call("Test", expected_type="array")

        assert result == [1, 2, 3]

    def test_uses_correct_system_message_for_object(self, mock_openai):
        """Should use object system message for object type."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{}'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        llm.call("Test", expected_type="object")

        call_kwargs = mock_openai.return_value.chat.completions.create.call_args[1]
        messages = call_kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert "JSON object" in messages[0]["content"]

    def test_uses_correct_system_message_for_array(self, mock_openai):
        """Should use array system message for array type."""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '[]'
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        llm = StrictJSONLLM(api_key="test", model="test")
        llm.call("Test", expected_type="array")

        call_kwargs = mock_openai.return_value.chat.completions.create.call_args[1]
        messages = call_kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert "JSON array" in messages[0]["content"]


class TestCreateJSONPrompt:
    """Test prompt creation helper."""

    def test_creates_basic_prompt(self):
        """Should create prompt with task and schema."""
        prompt = create_json_prompt(
            task_description="Analyze the data",
            json_schema={"result": "string", "score": "number"}
        )

        assert "Analyze the data" in prompt
        assert '"result": "string"' in prompt
        assert "REQUIRED JSON OUTPUT FORMAT" in prompt

    def test_includes_examples(self):
        """Should include examples when provided."""
        prompt = create_json_prompt(
            task_description="Test task",
            json_schema={"key": "value"},
            examples=[{"key": "example1"}, {"key": "example2"}]
        )

        assert "EXAMPLES" in prompt
        assert "Example 1" in prompt
        assert "example1" in prompt
        assert "Example 2" in prompt

    def test_includes_additional_rules(self):
        """Should include additional rules."""
        prompt = create_json_prompt(
            task_description="Test",
            json_schema={},
            additional_rules=["Custom rule 1", "Custom rule 2"]
        )

        assert "Custom rule 1" in prompt
        assert "Custom rule 2" in prompt

    def test_always_includes_base_rules(self):
        """Should always include base JSON rules."""
        prompt = create_json_prompt(
            task_description="Test",
            json_schema={}
        )

        assert "Return ONLY the JSON object" in prompt
        assert "Do NOT use markdown code fences" in prompt


class TestEdgeCasesIntegration:
    """Integration-style tests for edge cases."""

    @pytest.fixture
    def llm(self):
        """Create StrictJSONLLM with mock."""
        with patch('app.services.llm_json_utils.OpenAI'):
            return StrictJSONLLM(api_key="test", model="test")

    def test_complex_nested_structure(self, llm):
        """Should handle complex real-world JSON structures."""
        content = '''
        {
            "clusters": [
                {
                    "id": "cluster_1",
                    "name": "SSO Experience",
                    "pain_point_ids": [1, 2, 3],
                    "gap_ids": [4, 5],
                    "metadata": {
                        "severity": 7.5,
                        "tags": ["auth", "enterprise"]
                    }
                },
                {
                    "id": "cluster_2",
                    "name": "Onboarding Flow",
                    "pain_point_ids": [6],
                    "gap_ids": [],
                    "metadata": null
                }
            ],
            "summary": {
                "total_clusters": 2,
                "coverage": 0.85
            }
        }
        '''
        result = llm._parse_json(content, "object")

        assert len(result["clusters"]) == 2
        assert result["clusters"][0]["name"] == "SSO Experience"
        assert result["clusters"][1]["metadata"] is None
        assert result["summary"]["coverage"] == 0.85

    def test_llm_response_with_preamble_and_postamble(self, llm):
        """Should extract JSON from response with surrounding text."""
        content = '''
        I've analyzed the data and here are the results:

        ```json
        {
            "recommendations": [
                {"id": 1, "title": "Improve SSO"},
                {"id": 2, "title": "Better onboarding"}
            ]
        }
        ```

        Let me know if you need more details!
        '''
        result = llm._parse_json(content, "object")

        assert len(result["recommendations"]) == 2
        assert result["recommendations"][0]["title"] == "Improve SSO"

    def test_unicode_and_special_chars(self, llm):
        """Should handle unicode and special characters."""
        content = '''
        {
            "title": "Améliorer l'expérience utilisateur",
            "emoji": "🚀💡✨",
            "special": "Line1\\nLine2\\tTabbed",
            "quote": "He said \\"hello\\""
        }
        '''
        result = llm._parse_json(content, "object")

        assert "Améliorer" in result["title"]
        assert "🚀" in result["emoji"]
        assert "\n" in result["special"]
        assert '"hello"' in result["quote"]


class TestSystemMessages:
    """Test system message content."""

    def test_object_system_message_content(self):
        """Object system message should have all required instructions."""
        msg = STRICT_JSON_SYSTEM_MESSAGE

        assert "JSON object" in msg
        assert "NO MARKDOWN" in msg
        assert "NO EXPLANATIONS" in msg
        assert "NO COMMENTS" in msg
        assert "JSON.parse()" in msg

    def test_array_system_message_content(self):
        """Array system message should have all required instructions."""
        msg = STRICT_JSON_ARRAY_SYSTEM_MESSAGE

        assert "JSON array" in msg
        assert "NO MARKDOWN" in msg
        assert "NO EXPLANATIONS" in msg
        assert "NO COMMENTS" in msg
        assert "JSON.parse()" in msg
