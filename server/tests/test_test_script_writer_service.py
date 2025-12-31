"""
Tests for Test Script Writer Service
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from app.models.test_script_writer import (
    TestScriptWriterSession,
    TestScriptWriterSessionCreate,
    SOURCE_TYPES,
    NFR_OPTIONS,
)
from app.services.test_script_writer_service import TestScriptWriterService


class TestSessionCRUD:
    """Tests for session CRUD operations"""

    @pytest.fixture
    def db(self):
        """Mock database session"""
        db = MagicMock()
        db.add = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()
        db.delete = MagicMock()
        db.exec = MagicMock()
        return db

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return TestScriptWriterService()

    def test_create_session(self, service, db):
        """Test creating a new test script writer session"""
        data = TestScriptWriterSessionCreate(
            source_type="manual",
            stories=[
                {"id": "1", "title": "Login Story", "description": "As a user, I want to login"}
            ],
            selected_nfrs=["accessibility", "security"],
        )

        session = service.create_session(db, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

        added_session = db.add.call_args[0][0]
        assert added_session.source_type == "manual"
        assert added_session.selected_nfrs == ["accessibility", "security"]
        assert added_session.status == "pending"

    def test_list_sessions(self, service, db):
        """Test listing sessions"""
        mock_sessions = [
            MagicMock(id=1, source_type="manual"),
            MagicMock(id=2, source_type="epic"),
        ]
        db.exec.return_value.all.return_value = mock_sessions

        sessions = service.list_sessions(db)

        assert len(sessions) == 2
        db.exec.assert_called_once()

    def test_get_session(self, service, db):
        """Test getting a specific session"""
        mock_session = MagicMock(id=1, source_type="manual")
        db.get.return_value = mock_session

        session = service.get_session(db, 1)

        assert session.id == 1
        db.get.assert_called_once_with(TestScriptWriterSession, 1)

    def test_get_session_not_found(self, service, db):
        """Test getting a session that doesn't exist"""
        db.get.return_value = None

        session = service.get_session(db, 999)

        assert session is None

    def test_delete_session(self, service, db):
        """Test deleting a session"""
        mock_session = MagicMock(id=1)
        db.get.return_value = mock_session

        result = service.delete_session(db, 1)

        assert result is True
        db.delete.assert_called_once_with(mock_session)
        db.commit.assert_called_once()

    def test_delete_session_not_found(self, service, db):
        """Test deleting a session that doesn't exist"""
        db.get.return_value = None

        result = service.delete_session(db, 999)

        assert result is False
        db.delete.assert_not_called()

    def test_retry_session(self, service, db):
        """Test retrying a failed session"""
        mock_session = MagicMock(
            id=1,
            status="failed",
            error_message="Previous error",
        )
        db.get.return_value = mock_session

        result = service.retry_session(db, 1)

        assert result.status == "pending"
        assert result.error_message is None
        db.commit.assert_called_once()


class TestHelperMethods:
    """Tests for helper methods"""

    @pytest.fixture
    def service(self):
        return TestScriptWriterService()

    def test_get_nfr_label(self, service):
        """Test getting NFR label"""
        label = service._get_nfr_label("accessibility")
        assert label == "Accessibility"

    def test_get_nfr_label_unknown(self, service):
        """Test getting unknown NFR returns value"""
        label = service._get_nfr_label("unknown_nfr")
        assert label == "unknown_nfr"

    def test_get_nfr_description(self, service):
        """Test getting NFR description"""
        desc = service._get_nfr_description("security")
        assert "authentication" in desc.lower() or "authorization" in desc.lower()

    def test_source_types_list(self, service):
        """Test all source types are accessible"""
        assert len(SOURCE_TYPES) == 4
        values = [st["value"] for st in SOURCE_TYPES]
        assert "epic" in values
        assert "feature" in values
        assert "user_story" in values
        assert "manual" in values

    def test_nfr_options_list(self, service):
        """Test NFR options list is populated"""
        assert len(NFR_OPTIONS) >= 9
        values = [nfr["value"] for nfr in NFR_OPTIONS]
        assert "accessibility" in values
        assert "security" in values
        assert "performance" in values


class TestPromptBuilding:
    """Tests for prompt building"""

    @pytest.fixture
    def service(self):
        return TestScriptWriterService()

    def test_build_generation_prompt_basic(self, service):
        """Test basic prompt building"""
        session = MagicMock(
            stories=[
                {"id": "1", "title": "Login", "description": "Login story", "acceptance_criteria": ["AC1", "AC2"]}
            ],
            selected_nfrs=[],
        )

        prompt = service._build_generation_prompt(session)

        assert "Login" in prompt
        assert "AC1" in prompt
        assert "AC2" in prompt
        assert "No NFRs selected" in prompt

    def test_build_generation_prompt_with_nfrs(self, service):
        """Test prompt with NFRs selected"""
        session = MagicMock(
            stories=[
                {"id": "1", "title": "Checkout", "description": "Checkout flow", "acceptance_criteria": []}
            ],
            selected_nfrs=["accessibility", "security", "performance"],
        )

        prompt = service._build_generation_prompt(session)

        assert "Accessibility" in prompt
        assert "Security" in prompt
        assert "Performance" in prompt

    def test_build_generation_prompt_multiple_stories(self, service):
        """Test prompt with multiple stories"""
        session = MagicMock(
            stories=[
                {"id": "1", "title": "Story A", "description": "Desc A", "acceptance_criteria": []},
                {"id": "2", "title": "Story B", "description": "Desc B", "acceptance_criteria": []},
                {"id": "3", "title": "Story C", "description": "Desc C", "acceptance_criteria": []},
            ],
            selected_nfrs=[],
        )

        prompt = service._build_generation_prompt(session)

        assert "Story 1:" in prompt
        assert "Story 2:" in prompt
        assert "Story 3:" in prompt
        assert "Story A" in prompt
        assert "Story B" in prompt
        assert "Story C" in prompt


class TestResponseParsing:
    """Tests for LLM response parsing"""

    @pytest.fixture
    def service(self):
        return TestScriptWriterService()

    def test_parse_valid_response(self, service):
        """Test parsing valid JSON response"""
        response = """
        {
            "summary": "Test summary",
            "story_test_scripts": [
                {
                    "story_id": "1",
                    "story_title": "Login Story",
                    "story_description": "Login desc",
                    "test_cases": [
                        {"id": "TC001", "title": "Test 1", "description": "Desc", "steps": ["Step 1"], "expected_result": "Pass", "test_type": "functional"}
                    ]
                }
            ]
        }
        """

        result = service._parse_llm_json(response)
        service._validate_test_scripts(result)

        assert result["summary"] == "Test summary"
        assert len(result["story_test_scripts"]) == 1
        assert result["story_test_scripts"][0]["story_id"] == "1"

    def test_parse_response_with_markdown(self, service):
        """Test parsing response wrapped in markdown code block"""
        response = """
        ```json
        {
            "summary": "Test summary",
            "story_test_scripts": []
        }
        ```
        """

        result = service._parse_llm_json(response)

        assert result["summary"] == "Test summary"

    def test_parse_response_adds_defaults(self, service):
        """Test that missing fields get default values"""
        response = """
        {
            "summary": "Test"
        }
        """

        result = service._parse_llm_json(response)
        service._validate_test_scripts(result)

        assert result["story_test_scripts"] == []

    def test_parse_response_invalid_json(self, service):
        """Test that invalid JSON raises error"""
        response = "This is not valid JSON at all"

        with pytest.raises(ValueError) as exc_info:
            service._parse_llm_json(response)

        assert "No JSON object found" in str(exc_info.value)

    def test_parse_empty_response_raises_error(self, service):
        """Test that empty response raises error"""
        with pytest.raises(ValueError) as exc_info:
            service._parse_llm_json("")

        assert "Empty response" in str(exc_info.value)


class TestValidation:
    """Tests for test script validation"""

    @pytest.fixture
    def service(self):
        return TestScriptWriterService()

    def test_validate_adds_missing_test_case_fields(self, service):
        """Test that validation adds missing test case fields"""
        data = {
            "summary": "Test",
            "story_test_scripts": [
                {
                    "story_id": "1",
                    "story_title": "Test",
                    "test_cases": [
                        {"title": "TC1"}  # Missing many fields
                    ]
                }
            ]
        }

        service._validate_test_scripts(data)

        tc = data["story_test_scripts"][0]["test_cases"][0]
        assert "id" in tc
        assert "description" in tc
        assert "preconditions" in tc
        assert "steps" in tc
        assert "expected_result" in tc
        assert "test_type" in tc
        assert tc["test_type"] == "functional"

    def test_validate_handles_field_aliases(self, service):
        """Test that validation handles alternate field names"""
        data = {
            "executive_summary": "Overview",  # Alias for summary
            "test_scripts": []  # Alias for story_test_scripts
        }

        service._validate_test_scripts(data)

        assert data["summary"] == "Overview"
        assert data["story_test_scripts"] == []


class TestLLMRetryLogic:
    """Tests for LLM call retry logic"""

    @pytest.fixture
    def service(self):
        svc = TestScriptWriterService()
        svc.llm = MagicMock()
        svc.llm.chat = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_call_llm_with_retry_success_first_attempt(self, service):
        """Test successful LLM call on first attempt"""
        service.llm.chat.return_value = {
            "content": '{"summary": "Test", "story_test_scripts": []}',
            "model": "test",
            "usage": {}
        }

        result = await service._call_llm_with_retry(
            messages=[{"role": "user", "content": "test"}],
            context="Test"
        )

        assert result["summary"] == "Test"
        assert service.llm.chat.call_count == 1

    @pytest.mark.asyncio
    async def test_call_llm_with_retry_success_after_failure(self, service):
        """Test LLM call succeeds after initial failure"""
        service.llm.chat.side_effect = [
            Exception("API Error"),
            {
                "content": '{"summary": "Test", "story_test_scripts": []}',
                "model": "test",
                "usage": {}
            }
        ]

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await service._call_llm_with_retry(
                messages=[{"role": "user", "content": "test"}],
                context="Test"
            )

        assert result["summary"] == "Test"
        assert service.llm.chat.call_count == 2

    @pytest.mark.asyncio
    async def test_call_llm_with_retry_all_attempts_fail(self, service):
        """Test that all retries exhausted raises error"""
        service.llm.chat.side_effect = Exception("Persistent API Error")

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(ValueError) as exc_info:
                await service._call_llm_with_retry(
                    messages=[{"role": "user", "content": "test"}],
                    context="Test"
                )

        assert "Failed after 3 attempts" in str(exc_info.value)
        assert service.llm.chat.call_count == 3


class TestRunGeneration:
    """Tests for running test script generation"""

    @pytest.fixture
    def db(self):
        db = MagicMock()
        db.commit = MagicMock()
        return db

    @pytest.fixture
    def service(self):
        svc = TestScriptWriterService()
        svc.llm = MagicMock()
        svc.llm.chat = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_run_generation_success(self, service, db):
        """Test successful generation run"""
        mock_session = MagicMock(
            id=1,
            stories=[{"id": "1", "title": "Test Story", "description": "Desc", "acceptance_criteria": []}],
            selected_nfrs=["accessibility"],
            status="pending",
        )
        db.get.return_value = mock_session

        service.llm.chat.return_value = {
            "content": """{
                "summary": "Test summary",
                "story_test_scripts": [
                    {
                        "story_id": "1",
                        "story_title": "Test Story",
                        "story_description": "Desc",
                        "test_cases": [
                            {"id": "TC001", "title": "Test 1", "description": "Desc", "steps": ["Step 1"], "expected_result": "Pass", "test_type": "functional"},
                            {"id": "TC002", "title": "Edge Case", "description": "Edge", "steps": ["Step 1"], "expected_result": "Pass", "test_type": "edge_case"}
                        ]
                    }
                ]
            }""",
            "model": "test",
            "usage": {}
        }

        await service.run_generation(db, 1)

        assert mock_session.status == "completed"
        assert mock_session.summary == "Test summary"
        assert mock_session.total_test_cases == 2
        assert mock_session.test_breakdown["functional"] == 1
        assert mock_session.test_breakdown["edge_case"] == 1

    @pytest.mark.asyncio
    async def test_run_generation_not_found(self, service, db):
        """Test generation when session not found"""
        db.get.return_value = None

        await service.run_generation(db, 999)

        service.llm.chat.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_generation_llm_error(self, service, db):
        """Test generation handles LLM errors"""
        mock_session = MagicMock(
            id=1,
            stories=[{"id": "1", "title": "Test", "description": "Desc", "acceptance_criteria": []}],
            selected_nfrs=[],
            status="pending",
        )
        db.get.return_value = mock_session

        service.llm.chat.side_effect = Exception("LLM Error")

        with patch("asyncio.sleep", new_callable=AsyncMock):
            await service.run_generation(db, 1)

        assert mock_session.status == "failed"
        assert "LLM Error" in mock_session.error_message or "Failed after" in mock_session.error_message
