"""
Tests for Experience Gap Analyzer Service
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from app.models.experience_gap_analyzer import (
    GapAnalysisSession,
    GapItem,
    CapabilityMatrixItem,
    StageAlignment
)
from app.models.journey_mapper import JourneyMapSession, JourneyPainPoint
from app.services.experience_gap_analyzer_service import ExperienceGapAnalyzerService


class TestExperienceGapAnalyzerService:
    """Test cases for ExperienceGapAnalyzerService"""

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return ExperienceGapAnalyzerService()

    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return Mock()

    @pytest.fixture
    def sample_journey(self):
        """Create sample journey map session"""
        journey = JourneyMapSession(
            id=1,
            user_id=1,
            mode="standard",
            journey_description="Customer onboarding journey",
            status="completed",
            stages=[
                {"id": "stage_1", "name": "Discovery", "description": "Customer discovers product", "emotion_score": 7},
                {"id": "stage_2", "name": "Signup", "description": "Customer creates account", "emotion_score": 6},
                {"id": "stage_3", "name": "Onboarding", "description": "First time use", "emotion_score": 5}
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        return journey

    @pytest.fixture
    def sample_comparison_journey(self):
        """Create sample comparison journey"""
        journey = JourneyMapSession(
            id=2,
            user_id=1,
            mode="standard",
            journey_description="Competitor onboarding journey",
            status="completed",
            stages=[
                {"id": "comp_1", "name": "Awareness", "description": "User finds product", "emotion_score": 8},
                {"id": "comp_2", "name": "Registration", "description": "Quick signup", "emotion_score": 7},
                {"id": "comp_3", "name": "Getting Started", "description": "Guided tour", "emotion_score": 8}
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        return journey

    def test_calculate_opportunity_score(self, service):
        """Test opportunity score calculation"""
        # (Impact × Urgency) / Effort
        score = service._calculate_opportunity_score(8, 7, 4)
        assert score == 14.0

        # Edge case: effort = 0 should default to 1
        score = service._calculate_opportunity_score(8, 7, 0)
        assert score == 56.0

    def test_calculate_priority_tier(self, service):
        """Test priority tier calculation based on opportunity score"""
        # Tier 1: score > 15
        assert service._calculate_priority_tier(20) == 1
        assert service._calculate_priority_tier(16) == 1

        # Tier 2: score 8-15
        assert service._calculate_priority_tier(15) == 2
        assert service._calculate_priority_tier(8) == 2

        # Tier 3: score < 8
        assert service._calculate_priority_tier(7.9) == 3
        assert service._calculate_priority_tier(3) == 3

    def test_create_session_validates_journey_exists(self, service, mock_db, sample_journey):
        """Test that session creation validates journey exists"""
        mock_db.get.return_value = None

        with pytest.raises(ValueError, match="Your journey map not found"):
            service.create_session(
                db=mock_db,
                analysis_type="competitive",
                your_journey_id=999
            )

    def test_create_session_validates_journey_completed(self, service, mock_db):
        """Test that session creation requires completed journey"""
        incomplete_journey = JourneyMapSession(
            id=1,
            status="processing",
            journey_description="Test"
        )
        mock_db.get.return_value = incomplete_journey

        with pytest.raises(ValueError, match="must be completed"):
            service.create_session(
                db=mock_db,
                analysis_type="competitive",
                your_journey_id=1
            )

    def test_create_session_validates_analysis_type(self, service, mock_db, sample_journey):
        """Test that session creation validates analysis type"""
        mock_db.get.return_value = sample_journey

        with pytest.raises(ValueError, match="Analysis type must be"):
            service.create_session(
                db=mock_db,
                analysis_type="invalid_type",
                your_journey_id=1
            )

    def test_create_session_success(self, service, mock_db, sample_journey):
        """Test successful session creation"""
        mock_db.get.return_value = sample_journey

        def refresh_side_effect(obj):
            obj.id = 1

        mock_db.refresh.side_effect = refresh_side_effect

        session = service.create_session(
            db=mock_db,
            analysis_type="competitive",
            your_journey_id=1,
            analysis_name="Test Analysis",
            user_id=1
        )

        assert session.analysis_type == "competitive"
        assert session.analysis_name == "Test Analysis"
        assert session.your_journey_id == 1
        assert session.status == "pending"
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    def test_get_session(self, service, mock_db):
        """Test get session by ID"""
        expected = GapAnalysisSession(id=1)
        mock_db.get.return_value = expected

        result = service.get_session(mock_db, 1)
        assert result == expected
        mock_db.get.assert_called_with(GapAnalysisSession, 1)

    def test_list_sessions(self, service, mock_db):
        """Test listing sessions"""
        sessions = [
            GapAnalysisSession(id=1, analysis_name="Analysis 1"),
            GapAnalysisSession(id=2, analysis_name="Analysis 2")
        ]

        mock_statement = Mock()
        mock_db.exec.return_value.all.return_value = sessions

        with patch('app.services.experience_gap_analyzer_service.select') as mock_select:
            mock_select.return_value = mock_statement
            mock_statement.order_by.return_value = mock_statement
            mock_statement.offset.return_value = mock_statement
            mock_statement.limit.return_value = mock_statement

            result = service.list_sessions(mock_db, skip=0, limit=20)

            assert len(result) == 2

    def test_delete_session(self, service, mock_db):
        """Test session deletion"""
        session = GapAnalysisSession(id=1)
        mock_db.get.return_value = session

        # Mock the exec results for related data queries
        mock_db.exec.return_value = []

        result = service.delete_session(mock_db, 1)

        assert result is True
        mock_db.delete.assert_called_with(session)
        mock_db.commit.assert_called()

    def test_delete_session_not_found(self, service, mock_db):
        """Test deleting non-existent session"""
        mock_db.get.return_value = None

        result = service.delete_session(mock_db, 999)

        assert result is False

    def test_update_gap(self, service, mock_db):
        """Test updating a gap item"""
        gap = GapItem(
            id=1,
            session_id=1,
            title="Original Title",
            description="Original description",
            impact_score=5,
            urgency_score=5,
            effort_score=5,
            opportunity_score=5,
            priority_tier=2
        )
        mock_db.get.return_value = gap

        updates = {
            "title": "Updated Title",
            "impact_score": 8,
            "urgency_score": 7
        }

        result = service.update_gap(mock_db, 1, updates)

        assert result.title == "Updated Title"
        assert result.impact_score == 8
        assert result.urgency_score == 7
        assert result.is_user_edited is True
        # Recalculated: (8 × 7) / 5 = 11.2
        assert result.opportunity_score == 11.2
        assert result.priority_tier == 2  # 8-15 = Tier 2

    def test_add_gap(self, service, mock_db):
        """Test adding a new gap"""
        def refresh_side_effect(obj):
            obj.id = 1

        mock_db.refresh.side_effect = refresh_side_effect

        gap = service.add_gap(
            db=mock_db,
            session_id=1,
            title="New Gap",
            description="Gap description",
            category="experience",
            impact_score=9,
            urgency_score=8,
            effort_score=3
        )

        assert gap.title == "New Gap"
        assert gap.is_user_edited is True
        # (9 × 8) / 3 = 24
        assert gap.opportunity_score == 24.0
        assert gap.priority_tier == 1  # > 15 = Tier 1
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    def test_delete_gap(self, service, mock_db):
        """Test deleting a gap"""
        gap = GapItem(id=1, session_id=1, title="Test Gap", description="Test")
        mock_db.get.return_value = gap

        result = service.delete_gap(mock_db, 1)

        assert result is True
        mock_db.delete.assert_called_with(gap)

    def test_parse_llm_json_with_markdown(self, service):
        """Test JSON parsing strips markdown fences"""
        content = '```json\n{"key": "value"}\n```'
        result = service._parse_llm_json(content, "Test")
        assert result == {"key": "value"}

    def test_parse_llm_json_with_extra_text(self, service):
        """Test JSON parsing handles extra text around JSON"""
        content = 'Here is the JSON:\n{"key": "value"}\nEnd of response.'
        result = service._parse_llm_json(content, "Test")
        assert result == {"key": "value"}

    def test_parse_llm_json_empty_content(self, service):
        """Test JSON parsing raises on empty content"""
        with pytest.raises(ValueError, match="Empty response"):
            service._parse_llm_json("", "Test")

    def test_parse_llm_json_no_json(self, service):
        """Test JSON parsing raises when no JSON found"""
        with pytest.raises(ValueError, match="No JSON object found"):
            service._parse_llm_json("This is just text", "Test")

    def test_reorder_roadmap(self, service, mock_db):
        """Test reordering gaps in the roadmap"""
        gap = GapItem(
            id=1,
            session_id=1,
            title="Test Gap",
            description="Test",
            priority_tier=3,
            opportunity_score=5,
            impact_score=5,
            urgency_score=5,
            effort_score=5
        )
        mock_db.get.return_value = gap

        # Mock the select for regenerate_roadmap
        mock_db.exec.return_value.all.return_value = [gap]

        session = GapAnalysisSession(id=1, roadmap={})
        with patch.object(service, 'get_session', return_value=session):
            result = service.reorder_roadmap(mock_db, 1, 1, 1)

            assert result.priority_tier == 1
            assert result.user_priority_override == 1
            assert result.is_user_edited is True

    def test_reorder_roadmap_wrong_session(self, service, mock_db):
        """Test reordering fails if gap doesn't belong to session"""
        gap = GapItem(id=1, session_id=2, title="Test", description="Test")  # Different session
        mock_db.get.return_value = gap

        result = service.reorder_roadmap(mock_db, 1, 1, 1)  # Trying for session 1

        assert result is None


class TestGapAnalysisPipeline:
    """Integration-style tests for the gap analysis pipeline"""

    @pytest.fixture
    def service(self):
        return ExperienceGapAnalyzerService()

    @pytest.fixture
    def mock_db(self):
        return Mock()

    def test_update_progress(self, service, mock_db):
        """Test progress update helper"""
        session = GapAnalysisSession(id=1, status="pending", progress_step=0)
        mock_db.get.return_value = session
        service.get_session = Mock(return_value=session)

        service._update_progress(mock_db, 1, "analyzing", 2, "Analyzing gaps...")

        assert session.status == "analyzing"
        assert session.progress_step == 2
        assert session.progress_message == "Analyzing gaps..."
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    @patch.object(ExperienceGapAnalyzerService, '_call_llm')
    def test_generate_stage_alignments_no_comparison(self, mock_llm, service, mock_db):
        """Test stage alignment generation without comparison journey"""
        your_journey = JourneyMapSession(
            id=1,
            stages=[
                {"id": "s1", "name": "Stage 1"},
                {"id": "s2", "name": "Stage 2"}
            ]
        )

        service._generate_stage_alignments(mock_db, 1, your_journey, None)

        # Should add alignment for each stage without calling LLM
        assert mock_db.add.call_count == 2
        mock_db.commit.assert_called()
        mock_llm.assert_not_called()

    @patch.object(ExperienceGapAnalyzerService, '_call_llm')
    def test_generate_stage_alignments_with_comparison(self, mock_llm, service, mock_db):
        """Test stage alignment generation with comparison journey"""
        your_journey = JourneyMapSession(
            id=1,
            stages=[{"id": "s1", "name": "Discovery"}]
        )
        comparison_journey = JourneyMapSession(
            id=2,
            stages=[{"id": "c1", "name": "Awareness"}]
        )

        mock_llm.return_value = {
            "alignments": [
                {
                    "your_stage_id": "s1",
                    "your_stage_name": "Discovery",
                    "comparison_stage_id": "c1",
                    "comparison_stage_name": "Awareness",
                    "alignment_type": "aligned"
                }
            ]
        }

        service._generate_stage_alignments(mock_db, 1, your_journey, comparison_journey)

        mock_llm.assert_called_once()
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    @patch.object(ExperienceGapAnalyzerService, '_call_llm')
    def test_generate_gaps(self, mock_llm, service, mock_db):
        """Test gap generation"""
        your_journey = JourneyMapSession(
            id=1,
            stages=[{"id": "s1", "name": "Signup", "description": "User signup", "emotion_score": 5}]
        )
        your_pain_points = [
            JourneyPainPoint(stage_id="s1", description="Complex form", severity=7)
        ]

        mock_llm.return_value = {
            "gaps": [
                {
                    "title": "Signup Friction",
                    "description": "The signup process has too many steps",
                    "category": "experience",
                    "stage_id": "s1",
                    "stage_name": "Signup",
                    "impact_score": 8,
                    "urgency_score": 7,
                    "effort_score": 4,
                    "evidence": "Users report frustration",
                    "comparison_notes": "Competitor has 1-click signup"
                }
            ],
            "competitive_advantages": [
                {"stage_id": "s1", "title": "Price transparency", "description": "Clear pricing"}
            ]
        }

        session = GapAnalysisSession(id=1, competitive_advantages=None)
        service.get_session = Mock(return_value=session)

        service._generate_gaps(
            mock_db, 1, your_journey, None,
            your_pain_points, [],
            "competitive"
        )

        mock_llm.assert_called_once()
        # Should add the gap
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    @patch.object(ExperienceGapAnalyzerService, '_call_llm')
    def test_generate_capability_matrix(self, mock_llm, service, mock_db):
        """Test capability matrix generation"""
        your_journey = JourneyMapSession(
            id=1,
            stages=[{"name": "Onboarding", "description": "User onboarding", "touchpoints": []}]
        )
        comparison_journey = JourneyMapSession(
            id=2,
            stages=[{"name": "Getting Started", "description": "Initial setup", "touchpoints": []}]
        )

        mock_llm.return_value = {
            "capabilities": [
                {
                    "capability_name": "Onboarding Flow",
                    "category": "Onboarding & First Use",
                    "your_score": 6,
                    "comparison_score": 8,
                    "your_evidence": "Manual setup required",
                    "comparison_evidence": "Guided wizard",
                    "improvement_suggestion": "Add step-by-step wizard"
                }
            ]
        }

        session = GapAnalysisSession(id=1, capability_matrix_summary=None)
        service.get_session = Mock(return_value=session)

        service._generate_capability_matrix(mock_db, 1, your_journey, comparison_journey)

        mock_llm.assert_called_once()
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    @patch.object(ExperienceGapAnalyzerService, '_call_llm')
    def test_generate_roadmap_and_assessment(self, mock_llm, service, mock_db):
        """Test roadmap and assessment generation"""
        gaps = [
            GapItem(id=1, priority_tier=1, opportunity_score=20, title="Critical Gap", description="Important", impact_score=9),
            GapItem(id=2, priority_tier=2, opportunity_score=12, title="Important Gap", description="Moderate", impact_score=7),
            GapItem(id=3, priority_tier=3, opportunity_score=5, title="Minor Gap", description="Low priority", impact_score=4)
        ]

        mock_result = Mock()
        mock_result.all.return_value = gaps
        mock_db.exec.return_value = mock_result

        mock_llm.return_value = {
            "summary": "Analysis identified 3 gaps with 1 critical priority.",
            "recommendedFocusAreas": ["Onboarding", "Self-service"]
        }

        session = GapAnalysisSession(id=1, competitive_advantages=[])
        service.get_session = Mock(return_value=session)

        service._generate_roadmap_and_assessment(mock_db, 1)

        # Verify roadmap structure
        assert session.roadmap is not None
        assert len(session.roadmap["tier1"]) == 1
        assert len(session.roadmap["tier2"]) == 1
        assert len(session.roadmap["tier3"]) == 1

        # Verify overall assessment
        assert session.overall_assessment is not None
        assert session.overall_assessment["totalGapsIdentified"] == 3
        assert session.overall_assessment["criticalGapsCount"] == 1

        mock_db.add.assert_called()
        mock_db.commit.assert_called()
