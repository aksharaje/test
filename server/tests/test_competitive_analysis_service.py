"""
Tests for Competitive Analysis Service

Unit tests for the CompetitiveAnalysisService business logic including:
- Session CRUD operations
- Focus area helpers
- Knowledge base context fetching
- Prompt building
- Response parsing
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from app.services.competitive_analysis_service import CompetitiveAnalysisService
from app.models.competitive_analysis import (
    CompetitiveAnalysisSession,
    CompetitiveAnalysisSessionCreate,
    FOCUS_AREAS,
)


class TestCompetitiveAnalysisService:
    """Tests for CompetitiveAnalysisService"""

    @pytest.fixture
    def service(self):
        """Create service instance with mocked LLM"""
        svc = CompetitiveAnalysisService()
        svc.llm = MagicMock()
        return svc

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock()

    def test_get_focus_area_label(self, service):
        """Test getting human-readable focus area label"""
        assert service._get_focus_area_label("login_auth") == "Login & Authentication"
        assert service._get_focus_area_label("onboarding") == "User Onboarding"
        assert service._get_focus_area_label("checkout_payments") == "Checkout & Payments"
        # Unknown value returns as-is
        assert service._get_focus_area_label("unknown_area") == "unknown_area"

    def test_get_focus_area_label_all_areas(self, service):
        """Test that all focus areas have valid labels"""
        for area in FOCUS_AREAS:
            label = service._get_focus_area_label(area["value"])
            assert label == area["label"]

    def test_create_session(self, service, mock_db):
        """Test creating a new session"""
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = CompetitiveAnalysisSessionCreate(
            focus_area="login_auth",
            reference_competitors=["Google", "Amazon"],
            include_best_in_class=True,
            include_adjacent_industries=False,
        )

        session = service.create_session(mock_db, data)

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
        assert session.focus_area == "login_auth"
        assert session.status == "pending"

    def test_create_session_with_knowledge_base(self, service, mock_db):
        """Test creating session with knowledge base ID"""
        mock_db.add = MagicMock()
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        data = CompetitiveAnalysisSessionCreate(
            focus_area="checkout_payments",
            knowledge_base_id=5,
        )

        session = service.create_session(mock_db, data)

        assert session.focus_area == "checkout_payments"
        assert session.knowledge_base_id == 5

    def test_list_sessions(self, service, mock_db):
        """Test listing sessions"""
        mock_sessions = [
            CompetitiveAnalysisSession(id=1, focus_area="login_auth", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            CompetitiveAnalysisSession(id=2, focus_area="onboarding", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_db.exec = MagicMock()
        mock_db.exec.return_value.all.return_value = mock_sessions

        result = service.list_sessions(mock_db)

        assert len(result) == 2
        mock_db.exec.assert_called_once()

    def test_get_session(self, service, mock_db):
        """Test getting a session by ID"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_db.get = MagicMock(return_value=mock_session)

        result = service.get_session(mock_db, 1)

        assert result.id == 1
        mock_db.get.assert_called_once_with(CompetitiveAnalysisSession, 1)

    def test_get_session_not_found(self, service, mock_db):
        """Test getting non-existent session"""
        mock_db.get = MagicMock(return_value=None)

        result = service.get_session(mock_db, 999)

        assert result is None

    def test_delete_session(self, service, mock_db):
        """Test deleting a session"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.delete = MagicMock()
        mock_db.commit = MagicMock()

        result = service.delete_session(mock_db, 1)

        assert result is True
        mock_db.delete.assert_called_once_with(mock_session)
        mock_db.commit.assert_called_once()

    def test_delete_session_not_found(self, service, mock_db):
        """Test deleting non-existent session"""
        mock_db.get = MagicMock(return_value=None)

        result = service.delete_session(mock_db, 999)

        assert result is False

    def test_retry_session(self, service, mock_db):
        """Test retrying a failed session"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            status="failed",
            error_message="Previous error",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.commit = MagicMock()
        mock_db.refresh = MagicMock()

        result = service.retry_session(mock_db, 1)

        assert result.status == "pending"
        assert result.error_message is None

    def test_retry_session_not_found(self, service, mock_db):
        """Test retrying non-existent session"""
        mock_db.get = MagicMock(return_value=None)

        result = service.retry_session(mock_db, 999)

        assert result is None


class TestPromptBuilding:
    """Tests for prompt building"""

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return CompetitiveAnalysisService()

    def test_build_prompt_basic(self, service):
        """Test building basic analysis prompt"""
        session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            include_best_in_class=True,
            include_adjacent_industries=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        prompt = service._build_analysis_prompt(session)

        assert "Login & Authentication" in prompt
        assert "best-in-class digital products" in prompt
        assert "industry_standards" in prompt
        assert "best_practices" in prompt

    def test_build_prompt_with_competitors(self, service):
        """Test prompt includes reference competitors"""
        session = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            reference_competitors=["Stripe", "Square", "PayPal"],
            include_best_in_class=True,
            include_adjacent_industries=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        prompt = service._build_analysis_prompt(session)

        assert "Direct Competitors to analyze: Stripe, Square, PayPal" in prompt

    def test_build_prompt_with_adjacent_industries(self, service):
        """Test prompt includes adjacent industries scope"""
        session = CompetitiveAnalysisSession(
            id=1,
            focus_area="onboarding",
            include_best_in_class=True,
            include_adjacent_industries=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        prompt = service._build_analysis_prompt(session)

        assert "adjacent industries" in prompt

    def test_build_prompt_with_custom_focus_area(self, service):
        """Test prompt uses custom focus area when 'other' selected"""
        session = CompetitiveAnalysisSession(
            id=1,
            focus_area="other",
            custom_focus_area="AI-Powered Chat Support",
            include_best_in_class=True,
            include_adjacent_industries=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        prompt = service._build_analysis_prompt(session)

        assert "AI-Powered Chat Support" in prompt
        assert "Other (Custom)" not in prompt

    def test_build_prompt_with_code_context(self, service):
        """Test prompt includes code comparison section when context provided"""
        session = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            knowledge_base_id=5,
            include_best_in_class=True,
            include_adjacent_industries=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        code_context = "[File: checkout.py]\n```\ndef process_payment():\n    pass\n```"
        prompt = service._build_analysis_prompt(session, code_context)

        assert "User's Current Implementation" in prompt
        assert "checkout.py" in prompt
        assert "code_comparison" in prompt


class TestResponseParsing:
    """Tests for LLM response parsing"""

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return CompetitiveAnalysisService()

    def test_parse_valid_response(self, service):
        """Test parsing valid JSON response"""
        response = """
        {
            "executive_summary": "Test summary",
            "industry_standards": ["Standard 1", "Standard 2"],
            "best_practices": ["Practice 1"],
            "common_pitfalls": ["Pitfall 1"],
            "product_gaps": ["Gap 1"],
            "opportunities": [
                {"text": "Opportunity 1", "tag": "High Impact", "priority": "high"}
            ]
        }
        """

        result = service._parse_llm_json(response)
        service._validate_analysis(result)

        assert result["executive_summary"] == "Test summary"
        assert len(result["industry_standards"]) == 2
        assert result["opportunities"][0]["priority"] == "high"

    def test_parse_response_with_markdown(self, service):
        """Test parsing response wrapped in markdown code block"""
        response = """
        Here is the analysis:
        ```json
        {
            "executive_summary": "Test summary",
            "industry_standards": ["Standard 1"],
            "best_practices": ["Practice 1"],
            "common_pitfalls": ["Pitfall 1"],
            "product_gaps": ["Gap 1"],
            "opportunities": [{"text": "Test", "tag": "Tag", "priority": "medium"}]
        }
        ```
        """

        result = service._parse_llm_json(response)

        assert result["executive_summary"] == "Test summary"

    def test_parse_response_adds_default_priority(self, service):
        """Test that missing priority defaults to medium"""
        response = """
        {
            "executive_summary": "Test",
            "industry_standards": [],
            "best_practices": [],
            "common_pitfalls": [],
            "product_gaps": [],
            "opportunities": [{"text": "Test", "tag": "Tag"}]
        }
        """

        result = service._parse_llm_json(response)
        service._validate_analysis(result)

        assert result["opportunities"][0]["priority"] == "medium"

    def test_parse_response_missing_field(self, service):
        """Test that missing required field raises error"""
        response = """
        {
            "executive_summary": "Test",
            "industry_standards": []
        }
        """

        result = service._parse_llm_json(response)
        with pytest.raises(ValueError) as exc_info:
            service._validate_analysis(result)

        assert "Missing required field" in str(exc_info.value)

    def test_parse_response_invalid_json(self, service):
        """Test that invalid JSON raises error"""
        response = "This is not valid JSON at all"

        with pytest.raises(ValueError) as exc_info:
            service._parse_llm_json(response)

        assert "No JSON object found" in str(exc_info.value)

    def test_parse_response_with_code_comparison(self, service):
        """Test parsing response with code comparison"""
        response = """
        {
            "executive_summary": "Test summary",
            "industry_standards": ["Standard 1"],
            "best_practices": ["Practice 1"],
            "common_pitfalls": ["Pitfall 1"],
            "product_gaps": ["Gap 1"],
            "opportunities": [{"text": "Test", "tag": "Tag", "priority": "high"}],
            "code_comparison": "Your implementation differs from competitors in these ways..."
        }
        """

        result = service._parse_llm_json(response)
        service._validate_analysis(result)

        assert result["code_comparison"] is not None
        assert "differs" in result["code_comparison"]

    def test_parse_response_with_markdown_code_block(self, service):
        """Test parsing response wrapped in markdown code block"""
        response = """```json
        {
            "executive_summary": "Test summary",
            "industry_standards": ["Standard 1"],
            "best_practices": ["Practice 1"],
            "common_pitfalls": ["Pitfall 1"],
            "product_gaps": ["Gap 1"],
            "opportunities": [{"text": "Test", "tag": "Tag", "priority": "high"}]
        }
        ```"""

        result = service._parse_llm_json(response)

        assert result["executive_summary"] == "Test summary"

    def test_parse_response_with_trailing_comma(self, service):
        """Test parsing response with trailing commas (common LLM error)"""
        response = """
        {
            "executive_summary": "Test summary",
            "industry_standards": ["Standard 1",],
            "best_practices": ["Practice 1"],
            "common_pitfalls": ["Pitfall 1"],
            "product_gaps": ["Gap 1"],
            "opportunities": [{"text": "Test", "tag": "Tag", "priority": "high"},]
        }
        """

        result = service._parse_llm_json(response)

        assert result["executive_summary"] == "Test summary"

    def test_parse_response_with_double_wrapped_braces(self, service):
        """Test parsing response with double-wrapped braces (common LLM error)"""
        response = """
        {
        {
            "executive_summary": "Test summary",
            "industry_standards": ["Standard 1"],
            "best_practices": ["Practice 1"],
            "common_pitfalls": ["Pitfall 1"],
            "product_gaps": ["Gap 1"],
            "opportunities": [{"text": "Test", "tag": "Tag", "priority": "high"}]
        }
        }
        """

        result = service._parse_llm_json(response)

        assert result["executive_summary"] == "Test summary"

    def test_parse_empty_response_raises_error(self, service):
        """Test that empty response raises error"""
        with pytest.raises(ValueError) as exc_info:
            service._parse_llm_json("")

        assert "Empty response" in str(exc_info.value)

    def test_parse_whitespace_only_response_raises_error(self, service):
        """Test that whitespace-only response raises error"""
        with pytest.raises(ValueError) as exc_info:
            service._parse_llm_json("   \n\t  ")

        assert "Empty response" in str(exc_info.value)

    def test_validate_without_product_gaps(self, service):
        """Test validation when product gaps not expected"""
        data = {
            "executive_summary": "Test",
            "industry_standards": [],
            "best_practices": [],
            "common_pitfalls": [],
            "opportunities": [{"text": "Test", "tag": "Tag", "priority": "high"}]
        }

        # Should not raise - product_gaps will be added as empty array
        service._validate_analysis(data, expect_product_gaps=False)

        assert data["product_gaps"] == []

    def test_validate_opportunity_missing_text(self, service):
        """Test validation fails when opportunity missing text"""
        data = {
            "executive_summary": "Test",
            "industry_standards": [],
            "best_practices": [],
            "common_pitfalls": [],
            "product_gaps": [],
            "opportunities": [{"tag": "Tag", "priority": "high"}]
        }

        with pytest.raises(ValueError) as exc_info:
            service._validate_analysis(data)

        assert "text" in str(exc_info.value) and "tag" in str(exc_info.value)


class TestLLMRetryLogic:
    """Tests for LLM call retry logic"""

    @pytest.fixture
    def service(self):
        """Create service instance with mocked LLM"""
        svc = CompetitiveAnalysisService()
        svc.llm = MagicMock()
        svc.llm.chat = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_call_llm_with_retry_success_first_attempt(self, service):
        """Test successful LLM call on first attempt"""
        service.llm.chat.return_value = {
            "content": '{"executive_summary": "Test", "industry_standards": [], "best_practices": [], "common_pitfalls": [], "product_gaps": [], "opportunities": []}',
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
        # First call fails, second succeeds
        service.llm.chat.side_effect = [
            Exception("API Error"),
            {
                "content": '{"executive_summary": "Test", "industry_standards": [], "best_practices": [], "common_pitfalls": [], "product_gaps": [], "opportunities": []}',
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
    async def test_call_llm_with_retry_empty_response_retries(self, service):
        """Test that empty response triggers retry"""
        service.llm.chat.side_effect = [
            {"content": "", "model": "test", "usage": {}},
            {
                "content": '{"executive_summary": "Test", "industry_standards": [], "best_practices": [], "common_pitfalls": [], "product_gaps": [], "opportunities": []}',
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


class TestKnowledgeBaseContext:
    """Tests for knowledge base context fetching"""

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return CompetitiveAnalysisService()

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock()

    def test_get_kb_context_success(self, service, mock_db):
        """Test fetching KB context successfully"""
        mock_results = [
            {"documentName": "auth.py", "content": "def login(): pass"},
            {"documentName": "users.py", "content": "class User: pass"},
        ]

        with patch("app.services.competitive_analysis_service.knowledge_base_service") as mock_kb:
            mock_kb.search.return_value = mock_results

            result = service._get_knowledge_base_context(mock_db, 5, "login_auth")

            assert "auth.py" in result
            assert "users.py" in result
            mock_kb.search.assert_called_once_with(mock_db, 5, "login_auth", limit=10)

    def test_get_kb_context_empty_results(self, service, mock_db):
        """Test empty KB context when no results"""
        with patch("app.services.competitive_analysis_service.knowledge_base_service") as mock_kb:
            mock_kb.search.return_value = []

            result = service._get_knowledge_base_context(mock_db, 5, "login_auth")

            assert result == ""

    def test_get_kb_context_error_handling(self, service, mock_db):
        """Test KB context returns empty on error"""
        with patch("app.services.competitive_analysis_service.knowledge_base_service") as mock_kb:
            mock_kb.search.side_effect = Exception("DB error")

            result = service._get_knowledge_base_context(mock_db, 5, "login_auth")

            assert result == ""


class TestRunAnalysis:
    """Tests for the run_analysis async method"""

    @pytest.fixture
    def service(self):
        """Create service instance with mocked LLM"""
        svc = CompetitiveAnalysisService()
        svc.llm = MagicMock()
        svc.llm.chat = AsyncMock()
        return svc

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock()

    @pytest.mark.asyncio
    async def test_run_analysis_success(self, service, mock_db):
        """Test successful analysis run"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            include_best_in_class=True,
            include_adjacent_industries=False,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.commit = MagicMock()

        llm_response = {
            "content": """
            {
                "executive_summary": "Login is critical.",
                "industry_standards": ["OAuth 2.0", "MFA"],
                "best_practices": ["Social login"],
                "common_pitfalls": ["Weak passwords"],
                "product_gaps": ["No biometric"],
                "opportunities": [{"text": "Add biometric", "tag": "Security", "priority": "high"}]
            }
            """,
            "model": "test-model",
            "usage": {}
        }
        service.llm.chat.return_value = llm_response

        await service.run_analysis(mock_db, 1)

        assert mock_session.status == "completed"
        assert mock_session.executive_summary == "Login is critical."
        assert len(mock_session.industry_standards) == 2

    @pytest.mark.asyncio
    async def test_run_analysis_with_kb(self, service, mock_db):
        """Test analysis with knowledge base context"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="checkout_payments",
            knowledge_base_id=5,
            include_best_in_class=True,
            include_adjacent_industries=False,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.commit = MagicMock()

        llm_response = {
            "content": """
            {
                "executive_summary": "Payments are critical.",
                "industry_standards": ["PCI compliance"],
                "best_practices": ["One-page checkout"],
                "common_pitfalls": ["Too many fields"],
                "product_gaps": ["No Apple Pay"],
                "opportunities": [{"text": "Add Apple Pay", "tag": "Conversion", "priority": "high"}],
                "code_comparison": "Your implementation lacks express checkout."
            }
            """,
            "model": "test-model",
            "usage": {}
        }
        service.llm.chat.return_value = llm_response

        with patch.object(service, "_get_knowledge_base_context", return_value="[File: checkout.py]\n```\ncode\n```"):
            await service.run_analysis(mock_db, 1)

        assert mock_session.status == "completed"
        assert mock_session.code_comparison is not None

    @pytest.mark.asyncio
    async def test_run_analysis_session_not_found(self, service, mock_db):
        """Test analysis when session not found"""
        mock_db.get = MagicMock(return_value=None)

        await service.run_analysis(mock_db, 999)

        # Should return early without error
        service.llm.chat.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_analysis_llm_error(self, service, mock_db):
        """Test analysis handles LLM errors"""
        mock_session = CompetitiveAnalysisSession(
            id=1,
            focus_area="login_auth",
            include_best_in_class=True,
            include_adjacent_industries=False,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_db.get = MagicMock(return_value=mock_session)
        mock_db.commit = MagicMock()

        service.llm.chat.side_effect = Exception("LLM API error")

        await service.run_analysis(mock_db, 1)

        assert mock_session.status == "failed"
        assert "LLM API error" in mock_session.error_message
