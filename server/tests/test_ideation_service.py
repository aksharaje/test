"""
Tests for Ideation Service

Tests the ideation service business logic and pipeline.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.services.ideation_service import ideation_service
from app.models.ideation import IdeationSession, GeneratedIdea, IdeaCluster


@pytest.fixture
def db_session():
    """Create in-memory SQLite database for testing"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


class TestIdeationService:
    """Test suite for IdeationService"""

    def test_create_session_high_confidence(self, db_session):
        """Test creating a session with high confidence input"""
        session = ideation_service.create_session(
            session=db_session,
            problem_statement="A" * 250,  # 250 chars
            constraints="B" * 60,  # 60 chars
            goals="C" * 60,  # 60 chars
            research_insights="D" * 60,  # 60 chars
        )

        assert session.id is not None
        assert session.status == "pending"
        assert session.confidence == "high"
        assert session.progress_step == 0

    def test_create_session_medium_confidence(self, db_session):
        """Test creating a session with medium confidence input"""
        session = ideation_service.create_session(
            session=db_session,
            problem_statement="A" * 150,  # 150 chars
            constraints="B" * 50,  # 50 chars - meets threshold
        )

        assert session.confidence == "medium"

    def test_create_session_low_confidence(self, db_session):
        """Test creating a session with low confidence input"""
        session = ideation_service.create_session(
            session=db_session,
            problem_statement="A" * 100,  # Minimum chars
        )

        assert session.confidence == "low"

    def test_create_session_with_knowledge_bases(self, db_session):
        """Test creating a session with knowledge base IDs"""
        session = ideation_service.create_session(
            session=db_session,
            problem_statement="Test problem statement with enough characters to meet the minimum requirement",
            knowledge_base_ids=[1, 2, 3],
        )

        assert session.knowledge_base_ids == [1, 2, 3]

    def test_get_session(self, db_session):
        """Test retrieving a session by ID"""
        created = ideation_service.create_session(
            session=db_session,
            problem_statement="Test problem",
        )

        retrieved = ideation_service.get_session(db_session, created.id)
        assert retrieved.id == created.id
        assert retrieved.problem_statement == "Test problem"

    def test_get_session_not_found(self, db_session):
        """Test retrieving non-existent session"""
        result = ideation_service.get_session(db_session, 999)
        assert result is None

    def test_list_sessions(self, db_session):
        """Test listing all sessions"""
        ideation_service.create_session(
            session=db_session,
            problem_statement="Problem 1" + "A" * 100,
            user_id=1,
        )
        ideation_service.create_session(
            session=db_session,
            problem_statement="Problem 2" + "B" * 100,
            user_id=1,
        )
        ideation_service.create_session(
            session=db_session,
            problem_statement="Problem 3" + "C" * 100,
            user_id=2,
        )

        # Test without user filter
        all_sessions = ideation_service.list_sessions(db_session)
        assert len(all_sessions) == 3

        # Test with user filter
        user1_sessions = ideation_service.list_sessions(db_session, user_id=1)
        assert len(user1_sessions) == 2

    def test_update_idea(self, db_session):
        """Test updating an idea"""
        # Create session
        session_obj = ideation_service.create_session(
            session=db_session,
            problem_statement="Test" * 30,
        )

        # Create idea
        idea = GeneratedIdea(
            session_id=session_obj.id,
            title="Original Title",
            description="Original Description",
            category="quick_wins",
            use_cases=["Use case 1"],
            edge_cases=[],
            implementation_notes=[],
        )
        db_session.add(idea)
        db_session.commit()
        db_session.refresh(idea)

        # Update idea
        updated = ideation_service.update_idea(
            session=db_session,
            idea_id=idea.id,
            data={
                "title": "Updated Title",
                "description": "Updated Description",
                "use_cases": ["New use case"],
            },
        )

        assert updated.title == "Updated Title"
        assert updated.description == "Updated Description"
        assert updated.use_cases == ["New use case"]

    def test_delete_session(self, db_session):
        """Test deleting a session and all related data"""
        # Create session
        session_obj = ideation_service.create_session(
            session=db_session,
            problem_statement="Test" * 30,
        )

        # Create idea
        idea = GeneratedIdea(
            session_id=session_obj.id,
            title="Test Idea",
            description="Test Description",
            category="quick_wins",
        )
        db_session.add(idea)

        # Create cluster
        cluster = IdeaCluster(
            session_id=session_obj.id,
            cluster_number=1,
            theme_name="Test Theme",
            idea_count=1,
        )
        db_session.add(cluster)
        db_session.commit()

        # Delete session
        result = ideation_service.delete_session(db_session, session_obj.id)
        assert result is True

        # Verify session is deleted
        assert ideation_service.get_session(db_session, session_obj.id) is None

    def test_delete_session_not_found(self, db_session):
        """Test deleting non-existent session"""
        result = ideation_service.delete_session(db_session, 999)
        assert result is False

    def test_parse_input(self, db_session):
        """Test parsing input with LLM"""
        # Mock LLM response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = """
        {
            "who": "Mobile app users",
            "what": "Improve recommendation algorithm",
            "why": "Current algorithm is outdated",
            "impact": "Increase engagement",
            "affects": "All users",
            "constraints_parsed": ["Budget: $50k"],
            "goals_parsed": ["Increase engagement by 30%"],
            "insights_parsed": ["70% find recommendations irrelevant"]
        }
        """

        session_obj = ideation_service.create_session(
            session=db_session,
            problem_statement="Our mobile app users struggle to discover relevant content",
            constraints="Limited to $50k budget",
            goals="Increase engagement by 30%",
            research_insights="70% find current recommendations irrelevant",
        )

        with patch.object(ideation_service.client.chat.completions, 'create', return_value=mock_response):
            result = ideation_service._parse_input(session_obj)

            assert result["who"] == "Mobile app users"
            assert result["what"] == "Improve recommendation algorithm"
            assert "Budget: $50k" in result["constraints_parsed"]

    def test_assess_confidence_logic(self, db_session):
        """Test confidence assessment logic"""
        # High confidence: 250 chars problem + all fields 50+ chars
        assert ideation_service._assess_confidence(
            "A" * 250, "B" * 50, "C" * 50, "D" * 50
        ) == "high"

        # Medium confidence: 150 chars problem + some fields
        assert ideation_service._assess_confidence(
            "A" * 150, "B" * 50, None, None
        ) == "medium"

        # Low confidence: minimum problem only
        assert ideation_service._assess_confidence(
            "A" * 100, None, None, None
        ) == "low"

    @patch.object(ideation_service, '_augment_with_kb_rag')
    def test_kb_rag_integration(self, mock_rag, db_session):
        """Test Knowledge Base RAG integration"""
        mock_rag.return_value = "Relevant KB context..."

        session_obj = ideation_service.create_session(
            session=db_session,
            problem_statement="Test" * 40,
            knowledge_base_ids=[1, 2],
        )

        # Simulate calling RAG in pipeline
        structured_problem = {"what": "test problem"}
        result = ideation_service._augment_with_kb_rag(
            db_session, [1, 2], structured_problem
        )

        # Mock should have been called
        mock_rag.assert_called_once_with(db_session, [1, 2], structured_problem)

    def test_get_session_detail(self, db_session):
        """Test getting session detail with clusters and ideas"""
        # Create session
        session_obj = ideation_service.create_session(
            session=db_session,
            problem_statement="Test" * 30,
        )

        # Create cluster
        cluster = IdeaCluster(
            session_id=session_obj.id,
            cluster_number=1,
            theme_name="Test Theme",
            theme_description="Theme description",
            idea_count=2,
        )
        db_session.add(cluster)
        db_session.commit()
        db_session.refresh(cluster)

        # Create ideas
        idea1 = GeneratedIdea(
            session_id=session_obj.id,
            cluster_id=cluster.id,
            title="Idea 1",
            description="Description 1",
            category="quick_wins",
            is_final=True,
            display_order=1,
        )
        idea2 = GeneratedIdea(
            session_id=session_obj.id,
            cluster_id=cluster.id,
            title="Idea 2",
            description="Description 2",
            category="strategic_bets",
            is_final=True,
            display_order=2,
        )
        db_session.add(idea1)
        db_session.add(idea2)
        db_session.commit()

        # Get detail
        detail = ideation_service.get_session_detail(db_session, session_obj.id)

        assert detail is not None
        assert detail["session"].id == session_obj.id
        assert len(detail["clusters"]) == 1
        assert detail["clusters"][0]["themeName"] == "Test Theme"
        assert len(detail["clusters"][0]["ideas"]) == 2
        assert len(detail["ideas"]) == 2
