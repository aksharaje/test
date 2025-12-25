"""
Tests for Business Case Builder Service

Tests the service layer business logic including financial calculations.
"""
import pytest
from unittest.mock import patch, Mock, MagicMock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.models.business_case import (
    BusinessCaseSession,
    CostItem,
    BenefitItem,
    FinancialScenario,
    Assumption,
    SensitivityAnalysis,
    UserLearning
)
from app.models.feasibility import FeasibilitySession, TechnicalComponent, TimelineScenario
from app.services.business_case_service import BusinessCaseService


# Set up test database
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SQLModel.metadata.create_all(engine)


@pytest.fixture
def db():
    """Create a fresh database session for each test"""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service():
    """Create service instance"""
    return BusinessCaseService()


class TestSessionManagement:
    """Tests for session CRUD operations"""

    def test_create_session(self, db, service):
        """Test creating a new session"""
        session = service.create_session(
            db=db,
            feature_name="Test Feature",
            feature_description="A comprehensive test feature description that meets the minimum length requirement.",
            business_context="Enterprise SaaS company",
            target_market="SMB customers"
        )

        assert session.id is not None
        assert session.status == "pending"
        assert session.feature_name == "Test Feature"
        assert session.confidence_level == "medium"

    def test_create_session_name_too_short(self, db, service):
        """Test validation for short feature name"""
        with pytest.raises(ValueError, match="at least 3 characters"):
            service.create_session(
                db=db,
                feature_name="AB",
                feature_description="A" * 60
            )

    def test_create_session_description_too_short(self, db, service):
        """Test validation for short description"""
        with pytest.raises(ValueError, match="at least 50 characters"):
            service.create_session(
                db=db,
                feature_name="Valid Name",
                feature_description="Too short"
            )

    def test_create_session_with_feasibility_link(self, db, service):
        """Test creating session linked to completed feasibility"""
        # Create completed feasibility session
        feasibility = FeasibilitySession(
            feature_description="A" * 120,
            status="completed"
        )
        db.add(feasibility)
        db.commit()
        db.refresh(feasibility)

        # Create business case linked to it
        session = service.create_session(
            db=db,
            feature_name="Linked Feature",
            feature_description="A feature linked to feasibility for testing purposes and validation.",
            feasibility_session_id=feasibility.id
        )

        assert session.feasibility_session_id == feasibility.id

    def test_create_session_invalid_feasibility_link(self, db, service):
        """Test validation for invalid feasibility link"""
        with pytest.raises(ValueError, match="Feasibility session not found"):
            service.create_session(
                db=db,
                feature_name="Invalid Link",
                feature_description="A" * 60,
                feasibility_session_id=9999
            )

    def test_create_session_incomplete_feasibility(self, db, service):
        """Test validation for incomplete feasibility link"""
        # Create incomplete feasibility session
        feasibility = FeasibilitySession(
            feature_description="A" * 120,
            status="pending"  # Not completed
        )
        db.add(feasibility)
        db.commit()
        db.refresh(feasibility)

        with pytest.raises(ValueError, match="must be completed first"):
            service.create_session(
                db=db,
                feature_name="Incomplete Link",
                feature_description="B" * 60,
                feasibility_session_id=feasibility.id
            )

    def test_get_session(self, db, service):
        """Test getting session by ID"""
        created = service.create_session(
            db=db,
            feature_name="Get Test",
            feature_description="C" * 60
        )

        retrieved = service.get_session(db, created.id)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.feature_name == "Get Test"

    def test_get_session_not_found(self, db, service):
        """Test getting non-existent session"""
        result = service.get_session(db, 9999)
        assert result is None

    def test_list_sessions(self, db, service):
        """Test listing all sessions"""
        service.create_session(db=db, feature_name="Session 1", feature_description="D" * 60)
        service.create_session(db=db, feature_name="Session 2", feature_description="E" * 60)

        sessions = service.list_sessions(db)

        assert len(sessions) == 2

    def test_list_sessions_by_user(self, db, service):
        """Test filtering sessions by user"""
        service.create_session(db=db, feature_name="User 1", feature_description="F" * 60, user_id=1)
        service.create_session(db=db, feature_name="User 2", feature_description="G" * 60, user_id=2)

        sessions = service.list_sessions(db, user_id=1)

        assert len(sessions) == 1
        assert sessions[0].user_id == 1

    def test_delete_session(self, db, service):
        """Test deleting session and related data"""
        session = service.create_session(
            db=db,
            feature_name="Delete Test",
            feature_description="H" * 60
        )

        # Add some related data
        cost = CostItem(
            session_id=session.id,
            cost_category="development",
            cost_type="one_time",
            item_name="Test Cost",
            item_description="Test",
            optimistic_amount=1000,
            realistic_amount=2000,
            pessimistic_amount=3000,
            data_source="test",
            display_order=0
        )
        db.add(cost)
        db.commit()

        # Delete
        result = service.delete_session(db, session.id)

        assert result is True
        assert service.get_session(db, session.id) is None

    def test_delete_session_not_found(self, db, service):
        """Test deleting non-existent session"""
        result = service.delete_session(db, 9999)
        assert result is False


class TestCostBenefitUpdates:
    """Tests for cost and benefit update operations"""

    def test_update_cost_item(self, db, service):
        """Test updating cost item"""
        session = service.create_session(
            db=db,
            feature_name="Update Test",
            feature_description="I" * 60
        )

        cost = CostItem(
            session_id=session.id,
            cost_category="development",
            cost_type="one_time",
            item_name="Dev Cost",
            item_description="Development",
            optimistic_amount=10000,
            realistic_amount=15000,
            pessimistic_amount=20000,
            data_source="ai_estimate",
            display_order=0
        )
        db.add(cost)
        db.commit()
        db.refresh(cost)

        updated = service.update_cost_item(
            db=db,
            cost_id=cost.id,
            realistic_amount=18000
        )

        assert updated.realistic_amount == 18000
        assert updated.is_user_override is True
        assert updated.data_source == "user_input"
        assert updated.original_estimate == 15000

    def test_update_cost_item_not_found(self, db, service):
        """Test updating non-existent cost"""
        result = service.update_cost_item(db, 9999, realistic_amount=1000)
        assert result is None

    def test_update_benefit_item(self, db, service):
        """Test updating benefit item"""
        session = service.create_session(
            db=db,
            feature_name="Benefit Update",
            feature_description="J" * 60
        )

        benefit = BenefitItem(
            session_id=session.id,
            benefit_category="revenue_increase",
            benefit_type="quantifiable",
            item_name="Revenue",
            item_description="Additional revenue",
            optimistic_amount=100000,
            realistic_amount=75000,
            pessimistic_amount=50000,
            recurrence="annual",
            data_source="ai_estimate",
            display_order=0
        )
        db.add(benefit)
        db.commit()
        db.refresh(benefit)

        updated = service.update_benefit_item(
            db=db,
            benefit_id=benefit.id,
            optimistic_amount=120000,
            realistic_amount=90000
        )

        assert updated.optimistic_amount == 120000
        assert updated.realistic_amount == 90000
        assert updated.is_user_override is True


class TestFinancialCalculations:
    """Tests for financial calculation logic"""

    def test_calculate_scenario_base(self, db, service):
        """Test base scenario calculation"""
        session = service.create_session(
            db=db,
            feature_name="Financial Test",
            feature_description="K" * 60
        )

        # Add costs
        cost1 = CostItem(
            session_id=session.id,
            cost_category="development",
            cost_type="one_time",
            item_name="Development",
            item_description="Development cost",
            optimistic_amount=80000,
            realistic_amount=100000,
            pessimistic_amount=150000,
            data_source="test",
            display_order=0
        )

        cost2 = CostItem(
            session_id=session.id,
            cost_category="infrastructure",
            cost_type="recurring_monthly",
            item_name="Hosting",
            item_description="Monthly hosting",
            optimistic_amount=500,
            realistic_amount=1000,
            pessimistic_amount=2000,
            data_source="test",
            display_order=1
        )

        # Add benefit
        benefit = BenefitItem(
            session_id=session.id,
            benefit_category="revenue_increase",
            benefit_type="quantifiable",
            item_name="Revenue",
            item_description="Additional revenue",
            optimistic_amount=10000,
            realistic_amount=7500,
            pessimistic_amount=5000,
            recurrence="monthly",
            time_to_realize_months=3,
            data_source="test",
            display_order=0
        )

        db.add_all([cost1, cost2, benefit])
        db.commit()

        costs = [cost1, cost2]
        benefits = [benefit]

        scenario = service._calculate_scenario(session.id, costs, benefits, "base")

        assert scenario.scenario_type == "base"
        assert scenario.total_one_time_costs == 100000  # Realistic
        assert scenario.total_recurring_annual_costs == 12000  # 1000 * 12
        assert scenario.total_investment_year_1 == 112000  # 100000 + 12000
        assert len(scenario.yearly_cash_flows) == 5

    def test_calculate_irr_positive(self, service):
        """Test IRR calculation with positive returns"""
        # Initial investment of -100000, annual returns of 30000 for 5 years
        irr = service._calculate_irr(-100000, [30000, 30000, 30000, 30000, 30000])

        assert irr is not None
        assert 0.15 < irr < 0.20  # Should be around 15-20%

    def test_calculate_irr_negative(self, service):
        """Test IRR calculation with no positive returns"""
        # All negative cash flows
        irr = service._calculate_irr(-100000, [-10000, -10000, -10000, -10000, -10000])

        # Should return None or negative
        assert irr is None or irr < 0

    def test_calculate_irr_break_even(self, service):
        """Test IRR at break-even"""
        # Returns exactly equal initial investment over 5 years
        irr = service._calculate_irr(-100000, [20000, 20000, 20000, 20000, 20000])

        assert irr is not None
        assert -0.01 < irr < 0.01  # Should be close to 0%


class TestUserLearning:
    """Tests for user learning and corrections"""

    def test_save_user_learning(self, db, service):
        """Test saving a user learning"""
        session = service.create_session(
            db=db,
            feature_name="Learning Test",
            feature_description="L" * 60
        )

        learning = service.save_user_learning(
            db=db,
            session_id=session.id,
            learning_type="cost_correction",
            category="development",
            original_value=20000,
            corrected_value=25000,
            context="Development typically costs 25% more for our team",
            user_id=1
        )

        assert learning.id is not None
        assert learning.correction_factor == 1.25
        assert learning.learning_type == "cost_correction"

    def test_apply_learning_factor(self, service):
        """Test applying learning factor to estimates"""
        # Create mock learnings
        learning1 = Mock(correction_factor=1.2)
        learning2 = Mock(correction_factor=1.3)

        adjusted, source = service._apply_learning_factor(10000, [learning1, learning2])

        assert source == "user_learning"
        assert adjusted == 10000 * 1.25  # Average of 1.2 and 1.3

    def test_apply_learning_factor_empty(self, service):
        """Test applying learning with no learnings"""
        adjusted, source = service._apply_learning_factor(10000, [])

        assert source == "benchmark"
        assert adjusted == 10000


class TestJSONParsing:
    """Tests for LLM JSON response parsing"""

    def test_parse_valid_json(self, service):
        """Test parsing valid JSON"""
        content = '{"key": "value", "number": 42}'
        result = service._parse_llm_json(content, "Test")

        assert result == {"key": "value", "number": 42}

    def test_parse_json_with_code_fences(self, service):
        """Test parsing JSON wrapped in markdown code fences"""
        content = '```json\n{"key": "value"}\n```'
        result = service._parse_llm_json(content, "Test")

        assert result == {"key": "value"}

    def test_parse_json_with_preamble(self, service):
        """Test parsing JSON with text before it"""
        content = 'Here is the result:\n{"key": "value"}'
        result = service._parse_llm_json(content, "Test")

        assert result == {"key": "value"}

    def test_parse_json_double_brace(self, service):
        """Test parsing JSON with double opening brace"""
        content = '{\n{"key": "value"}}'
        result = service._parse_llm_json(content, "Test")

        assert result == {"key": "value"}

    def test_parse_empty_content(self, service):
        """Test parsing empty content raises error"""
        with pytest.raises(ValueError, match="Empty response"):
            service._parse_llm_json("", "Test")

    def test_parse_no_json(self, service):
        """Test parsing content with no JSON raises error"""
        with pytest.raises(ValueError, match="No JSON object found"):
            service._parse_llm_json("Just plain text", "Test")


class TestPIIMasking:
    """Tests for PII masking functionality"""

    def test_mask_email(self, service):
        """Test masking email addresses"""
        text = "Contact john.doe@example.com for info"
        masked = service._mask_pii(text)

        assert "[EMAIL]" in masked
        assert "john.doe@example.com" not in masked

    def test_mask_phone(self, service):
        """Test masking phone numbers"""
        text = "Call 555-123-4567 or (555) 987-6543"
        masked = service._mask_pii(text)

        assert "[PHONE]" in masked
        assert "555-123-4567" not in masked
        assert "(555) 987-6543" not in masked

    def test_mask_ssn(self, service):
        """Test masking SSN"""
        text = "SSN: 123-45-6789"
        masked = service._mask_pii(text)

        assert "[SSN]" in masked
        assert "123-45-6789" not in masked

    def test_mask_credit_card(self, service):
        """Test masking credit card numbers"""
        text = "Card: 1234567890123456"
        masked = service._mask_pii(text)

        assert "[CARD]" in masked
        assert "1234567890123456" not in masked


class TestPipelineIntegration:
    """Integration tests for the full pipeline"""

    @patch.object(BusinessCaseService, 'client')
    def test_pipeline_runs_all_agents(self, mock_client, db, service):
        """Test that pipeline runs all 5 agents"""
        session = service.create_session(
            db=db,
            feature_name="Pipeline Test",
            feature_description="M" * 60
        )

        # Mock the OpenAI client responses
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"key": "value", "costs": [], "benefits": [], "development_costs": [], "operational_costs": [], "key_assumptions": [], "industry_context": {"primary_industry": "Tech", "company_size_indicator": "medium", "market_maturity": "growing"}, "executive_summary": "Test summary"}'
        mock_client.chat.completions.create.return_value = mock_response

        # Run pipeline
        service.run_business_case_pipeline(db, session.id)

        # Verify session was updated
        updated = service.get_session(db, session.id)
        assert updated.status == "completed"
        assert updated.completed_at is not None
