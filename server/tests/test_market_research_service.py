"""
Tests for Market Research Service
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from app.models.market_research import (
    MarketResearchSession,
    MarketResearchSessionCreate,
    FOCUS_AREAS,
    INDUSTRIES,
)
from app.services.market_research_service import MarketResearchService


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
        return MarketResearchService()

    def test_create_session(self, service, db):
        """Test creating a new market research session"""
        data = MarketResearchSessionCreate(
            problem_area="Login & Onboarding",
            industry_context="technology",
            focus_areas=["user_expectations", "adoption_trends"],
        )

        session = service.create_session(db, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

        added_session = db.add.call_args[0][0]
        assert added_session.problem_area == "Login & Onboarding"
        assert added_session.industry_context == "technology"
        assert added_session.focus_areas == ["user_expectations", "adoption_trends"]
        assert added_session.status == "pending"

    def test_list_sessions(self, service, db):
        """Test listing sessions"""
        mock_sessions = [
            MagicMock(id=1, problem_area="Test 1"),
            MagicMock(id=2, problem_area="Test 2"),
        ]
        db.exec.return_value.all.return_value = mock_sessions

        sessions = service.list_sessions(db)

        assert len(sessions) == 2
        db.exec.assert_called_once()

    def test_get_session(self, service, db):
        """Test getting a specific session"""
        mock_session = MagicMock(id=1, problem_area="Test")
        db.get.return_value = mock_session

        session = service.get_session(db, 1)

        assert session.id == 1
        db.get.assert_called_once_with(MarketResearchSession, 1)

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
        return MarketResearchService()

    def test_get_focus_area_label(self, service):
        """Test getting focus area label"""
        label = service._get_focus_area_label("user_expectations")
        assert label == "User Expectations"

    def test_get_focus_area_label_unknown(self, service):
        """Test getting unknown focus area returns value"""
        label = service._get_focus_area_label("unknown_area")
        assert label == "unknown_area"

    def test_get_industry_label(self, service):
        """Test getting industry label"""
        label = service._get_industry_label("banking")
        assert label == "Banking & Financial Services"

    def test_get_industry_label_unknown(self, service):
        """Test getting unknown industry returns value"""
        label = service._get_industry_label("unknown_industry")
        assert label == "unknown_industry"

    def test_focus_areas_list(self, service):
        """Test all focus areas are accessible"""
        assert len(FOCUS_AREAS) == 5
        values = [a["value"] for a in FOCUS_AREAS]
        assert "user_expectations" in values
        assert "adoption_trends" in values
        assert "market_risks" in values
        assert "regulation" in values
        assert "technology_shifts" in values

    def test_industries_list(self, service):
        """Test industries list is populated"""
        assert len(INDUSTRIES) >= 10
        values = [ind["value"] for ind in INDUSTRIES]
        assert "banking" in values
        assert "consumer_goods" in values


class TestPromptBuilding:
    """Tests for prompt building"""

    @pytest.fixture
    def service(self):
        return MarketResearchService()

    def test_build_analysis_prompt_basic(self, service):
        """Test basic prompt building"""
        session = MagicMock(
            problem_area="Login & Onboarding",
            problem_area_context=None,
            industry_context="technology",
            focus_areas=["user_expectations", "adoption_trends"],
        )

        prompt = service._build_analysis_prompt(session)

        assert "Login & Onboarding" in prompt
        assert "Technology & Software" in prompt
        assert "User Expectations" in prompt
        assert "Adoption Trends" in prompt
        assert "market_trends" in prompt
        assert "expectation_shifts" in prompt
        assert "market_risks" in prompt
        assert "implications" in prompt

    def test_build_analysis_prompt_all_focus_areas(self, service):
        """Test prompt with all focus areas"""
        session = MagicMock(
            problem_area="Checkout Flow",
            problem_area_context=None,
            industry_context="consumer_goods",
            focus_areas=["user_expectations", "adoption_trends", "market_risks", "regulation", "technology_shifts"],
        )

        prompt = service._build_analysis_prompt(session)

        assert "User Expectations" in prompt
        assert "Adoption Trends" in prompt
        assert "Market Risks" in prompt
        assert "Regulation & Compliance" in prompt
        assert "Technology Shifts" in prompt

    def test_build_analysis_prompt_no_focus_areas(self, service):
        """Test prompt with no focus areas defaults to all"""
        session = MagicMock(
            problem_area="Test Area",
            problem_area_context=None,
            industry_context="banking",
            focus_areas=[],
        )

        prompt = service._build_analysis_prompt(session)

        assert "all areas" in prompt


class TestResponseParsing:
    """Tests for LLM response parsing"""

    @pytest.fixture
    def service(self):
        return MarketResearchService()

    def test_parse_valid_response(self, service):
        """Test parsing valid JSON response"""
        response = """
        {
            "executive_summary": "Test summary",
            "market_trends": [
                {"text": "Trend 1", "confidence": "HIGH", "source_count": 3, "sources": ["Source A"]}
            ],
            "expectation_shifts": [
                {"text": "Shift 1", "confidence": "MEDIUM", "source_count": 2, "sources": []}
            ],
            "market_risks": [
                {"text": "Risk 1", "confidence": "LOW", "source_count": 1, "sources": []}
            ],
            "implications": ["Implication 1", "Implication 2"]
        }
        """

        result = service._parse_llm_json(response)
        service._validate_analysis(result)

        assert result["executive_summary"] == "Test summary"
        assert len(result["market_trends"]) == 1
        assert result["market_trends"][0]["confidence"] == "HIGH"

    def test_parse_response_with_markdown(self, service):
        """Test parsing response wrapped in markdown code block"""
        response = """
        ```json
        {
            "executive_summary": "Test summary",
            "market_trends": [{"text": "Trend 1", "confidence": "HIGH", "source_count": 1}],
            "expectation_shifts": [{"text": "Shift 1", "confidence": "MEDIUM", "source_count": 1}],
            "market_risks": [{"text": "Risk 1", "confidence": "LOW", "source_count": 1}],
            "implications": ["Test"]
        }
        ```
        """

        result = service._parse_llm_json(response)

        assert result["executive_summary"] == "Test summary"

    def test_parse_response_adds_default_confidence(self, service):
        """Test that missing confidence defaults to MEDIUM"""
        response = """
        {
            "executive_summary": "Test",
            "market_trends": [{"text": "Trend 1"}],
            "expectation_shifts": [],
            "market_risks": [],
            "implications": []
        }
        """

        result = service._parse_llm_json(response)
        service._validate_analysis(result)

        assert result["market_trends"][0]["confidence"] == "MEDIUM"

    def test_parse_response_missing_field_uses_defaults(self, service):
        """Test that missing fields get default values"""
        response = """
        {
            "executive_summary": "Test",
            "market_trends": []
        }
        """

        result = service._parse_llm_json(response)
        service._validate_analysis(result)

        # Missing fields should get default empty values
        assert result["expectation_shifts"] == []
        assert result["market_risks"] == []
        assert result["implications"] == []

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

    def test_parse_response_with_trailing_comma(self, service):
        """Test parsing response with trailing commas"""
        response = """
        {
            "executive_summary": "Test",
            "market_trends": [{"text": "Test", "confidence": "HIGH", "source_count": 1},],
            "expectation_shifts": [],
            "market_risks": [],
            "implications": ["Test",]
        }
        """

        result = service._parse_llm_json(response)

        assert result["executive_summary"] == "Test"


class TestLLMRetryLogic:
    """Tests for LLM call retry logic"""

    @pytest.fixture
    def service(self):
        svc = MarketResearchService()
        svc.llm = MagicMock()
        svc.llm.chat = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_call_llm_with_retry_success_first_attempt(self, service):
        """Test successful LLM call on first attempt"""
        service.llm.chat.return_value = {
            "content": '{"executive_summary": "Test", "market_trends": [], "expectation_shifts": [], "market_risks": [], "implications": []}',
            "model": "test",
            "usage": {}
        }

        result = await service._call_llm_with_retry(
            messages=[{"role": "user", "content": "test"}],
            context="Test"
        )

        assert result["executive_summary"] == "Test"
        assert service.llm.chat.call_count == 1

    @pytest.mark.asyncio
    async def test_call_llm_with_retry_success_after_failure(self, service):
        """Test LLM call succeeds after initial failure"""
        service.llm.chat.side_effect = [
            Exception("API Error"),
            {
                "content": '{"executive_summary": "Test", "market_trends": [], "expectation_shifts": [], "market_risks": [], "implications": []}',
                "model": "test",
                "usage": {}
            }
        ]

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await service._call_llm_with_retry(
                messages=[{"role": "user", "content": "test"}],
                context="Test"
            )

        assert result["executive_summary"] == "Test"
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


class TestRunAnalysis:
    """Tests for running analysis"""

    @pytest.fixture
    def db(self):
        db = MagicMock()
        db.commit = MagicMock()
        return db

    @pytest.fixture
    def service(self):
        svc = MarketResearchService()
        svc.llm = MagicMock()
        svc.llm.chat = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_run_analysis_success(self, service, db):
        """Test successful analysis run"""
        mock_session = MagicMock(
            id=1,
            problem_area="Login & Onboarding",
            industry_context="technology",
            focus_areas=["user_expectations"],
            status="pending",
        )
        db.get.return_value = mock_session

        service.llm.chat.return_value = {
            "content": """{
                "executive_summary": "Test summary",
                "market_trends": [{"text": "Trend", "confidence": "HIGH", "source_count": 2}],
                "expectation_shifts": [{"text": "Shift", "confidence": "MEDIUM", "source_count": 1}],
                "market_risks": [{"text": "Risk", "confidence": "LOW", "source_count": 1}],
                "implications": ["Implication 1"]
            }""",
            "model": "test",
            "usage": {}
        }

        await service.run_analysis(db, 1)

        assert mock_session.status == "completed"
        assert mock_session.executive_summary == "Test summary"
        assert len(mock_session.market_trends) == 1
        assert len(mock_session.implications) == 1

    @pytest.mark.asyncio
    async def test_run_analysis_not_found(self, service, db):
        """Test analysis when session not found"""
        db.get.return_value = None

        await service.run_analysis(db, 999)

        service.llm.chat.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_analysis_llm_error(self, service, db):
        """Test analysis handles LLM errors"""
        mock_session = MagicMock(
            id=1,
            problem_area="Test",
            industry_context="banking",
            focus_areas=[],
            status="pending",
        )
        db.get.return_value = mock_session

        service.llm.chat.side_effect = Exception("LLM Error")

        with patch("asyncio.sleep", new_callable=AsyncMock):
            await service.run_analysis(db, 1)

        assert mock_session.status == "failed"
        assert "LLM Error" in mock_session.error_message or "Failed after" in mock_session.error_message
