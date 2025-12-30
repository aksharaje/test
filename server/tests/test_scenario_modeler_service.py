"""
Tests for Scenario Modeler Service

Tests the service layer for the Scenario Modeler feature,
including session/variant management and delete operations.
"""
import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session, select

from app.models.scenario_modeler import (
    ScenarioSession,
    ScenarioVariant,
    ScenarioSessionCreate,
    ScenarioVariantCreate,
)
from app.services.scenario_modeler_service import ScenarioModelerService


class TestScenarioModelerServiceDelete:
    """Tests for delete operations with FK constraints"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create service with mock db"""
        return ScenarioModelerService(mock_db)

    def test_delete_session_with_variants(self, service, mock_db):
        """Test deleting session properly deletes variants first"""
        # Setup mock session
        mock_session = ScenarioSession(
            id=1,
            roadmap_session_id=10,
            name="Test Session",
            status="completed",
        )
        mock_db.get.return_value = mock_session

        # Setup mock variants
        mock_variants = [
            ScenarioVariant(id=1, session_id=1, name="Baseline", is_baseline=True),
            ScenarioVariant(id=2, session_id=1, name="Variant A", is_baseline=False),
        ]
        mock_db.exec.return_value.all.return_value = mock_variants

        # Execute delete
        result = service.delete_session(1)

        # Verify variants deleted first, then session
        assert result is True
        assert mock_db.delete.call_count == 3  # 2 variants + 1 session
        assert mock_db.commit.call_count == 2  # One for variants, one for session

        # Verify order: variants deleted first
        delete_calls = mock_db.delete.call_args_list
        assert delete_calls[0][0][0] == mock_variants[0]
        assert delete_calls[1][0][0] == mock_variants[1]
        assert delete_calls[2][0][0] == mock_session

    def test_delete_session_not_found(self, service, mock_db):
        """Test deleting non-existent session returns False"""
        mock_db.get.return_value = None

        result = service.delete_session(999)

        assert result is False
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()

    def test_delete_session_no_variants(self, service, mock_db):
        """Test deleting session with no variants"""
        mock_session = ScenarioSession(
            id=1,
            roadmap_session_id=10,
            name="Empty Session",
            status="draft",
        )
        mock_db.get.return_value = mock_session
        mock_db.exec.return_value.all.return_value = []  # No variants

        result = service.delete_session(1)

        assert result is True
        assert mock_db.delete.call_count == 1  # Only session
        assert mock_db.commit.call_count == 2  # Still two commits (one empty for variants)


class TestScenarioModelerServiceVariants:
    """Tests for variant management"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create service with mock db"""
        return ScenarioModelerService(mock_db)

    def test_delete_variant_not_baseline(self, service, mock_db):
        """Test deleting non-baseline variant"""
        mock_session = ScenarioSession(
            id=1,
            roadmap_session_id=10,
            name="Test Session",
            total_variants=2,
        )
        mock_variant = ScenarioVariant(
            id=2,
            session_id=1,
            name="Variant A",
            is_baseline=False,
        )

        # Mock db.get to return variant first, then session
        mock_db.get.side_effect = [mock_variant, mock_session]

        result = service.delete_variant(2)

        assert result is True
        mock_db.delete.assert_called_once_with(mock_variant)
        mock_db.commit.assert_called_once()
        assert mock_session.total_variants == 1

    def test_delete_variant_baseline_error(self, service, mock_db):
        """Test deleting baseline variant raises error"""
        mock_variant = ScenarioVariant(
            id=1,
            session_id=1,
            name="Baseline",
            is_baseline=True,
        )
        mock_db.get.return_value = mock_variant

        with pytest.raises(ValueError, match="Cannot delete baseline"):
            service.delete_variant(1)

        mock_db.delete.assert_not_called()

    def test_delete_variant_not_found(self, service, mock_db):
        """Test deleting non-existent variant"""
        mock_db.get.return_value = None

        result = service.delete_variant(999)

        assert result is False
        mock_db.delete.assert_not_called()


class TestScenarioModelerServiceComparison:
    """Tests for comparison report generation"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def service(self, mock_db):
        """Create service with mock db"""
        return ScenarioModelerService(mock_db)

    def test_generate_comparison_uses_string_keys(self, service, mock_db):
        """Test that comparison dicts use string keys for variant IDs"""
        # Setup mock session
        mock_session = ScenarioSession(
            id=1,
            roadmap_session_id=10,
            name="Test",
            status="completed",
        )
        mock_db.get.return_value = mock_session

        # Setup mock variants with integer IDs
        mock_variants = [
            ScenarioVariant(
                id=6,  # Integer ID
                session_id=1,
                name="Baseline",
                is_baseline=True,
                status="completed",
                generated_roadmap={"session": {"total_sprints": 10, "team_velocity": 40}},
                risk_score=30,
                risk_factors=[],
                trade_offs=[],
            ),
            ScenarioVariant(
                id=7,  # Integer ID
                session_id=1,
                name="Variant A",
                is_baseline=False,
                status="completed",
                generated_roadmap={"session": {"total_sprints": 8, "team_velocity": 50}},
                risk_score=45,
                risk_factors=[{"name": "Risk 1"}],
                trade_offs=[{"gain": "Faster", "cost": "Higher risk"}],
            ),
        ]
        mock_db.exec.return_value.all.return_value = mock_variants

        # Generate comparison
        comparison = service._generate_comparison_report(mock_session, mock_variants)

        # Verify keys are strings, not integers
        assert "6" in comparison.timeline_comparison
        assert "7" in comparison.timeline_comparison
        assert "6" in comparison.capacity_comparison
        assert "7" in comparison.capacity_comparison
        assert "6" in comparison.risk_comparison
        assert "7" in comparison.risk_comparison

        # Verify integer keys are NOT present
        assert 6 not in comparison.timeline_comparison
        assert 7 not in comparison.timeline_comparison
