"""
Tests for Journey Mapper Service

Unit tests for the journey mapper service business logic.
"""
import pytest
from unittest.mock import patch, Mock, MagicMock
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from datetime import datetime

from app.models.journey_mapper import (
    JourneyMapSession,
    JourneyPainPoint,
    JourneyPersona,
    JourneyDivergencePoint,
    CompetitorJourneyObservation
)
from app.services.journey_mapper_service import JourneyMapperService, journey_mapper_service


# Set up test database
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@pytest.fixture
def db_session():
    """Create fresh database session for each test"""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


class TestJourneyMapperServiceSessionManagement:
    """Test suite for session management methods"""

    def test_create_session_standard(self, db_session):
        """Test basic standard session creation"""
        service = JourneyMapperService()

        session = service.create_session(
            db=db_session,
            mode="standard",
            journey_description="Customer onboarding flow for enterprise users"
        )

        assert session.id is not None
        assert session.journey_description == "Customer onboarding flow for enterprise users"
        assert session.status == "pending"
        assert session.mode == "standard"

    def test_create_session_with_knowledge_base_ids(self, db_session):
        """Test session creation with knowledge base IDs"""
        service = JourneyMapperService()

        session = service.create_session(
            db=db_session,
            mode="standard",
            journey_description="Journey with context from knowledge bases",
            knowledge_base_ids=[1, 2, 3]
        )

        assert session.knowledge_base_ids == [1, 2, 3]

    def test_create_session_multi_persona(self, db_session):
        """Test multi-persona session creation with personas"""
        service = JourneyMapperService()

        personas = [
            {"name": "IT Admin", "description": "Technical decision maker"},
            {"name": "End User", "description": "Daily user of the system"}
        ]

        session = service.create_session(
            db=db_session,
            mode="multi_persona",
            journey_description="Product evaluation journey for B2B software",
            personas=personas
        )

        assert session.mode == "multi_persona"

        # Check personas were created
        db_personas = list(db_session.exec(
            select(JourneyPersona).where(JourneyPersona.journey_map_id == session.id)
        ))
        assert len(db_personas) == 2

    def test_create_session_competitive(self, db_session):
        """Test competitive session creation"""
        service = JourneyMapperService()

        session = service.create_session(
            db=db_session,
            mode="competitive",
            journey_description="Checkout flow comparison with Stripe",
            competitor_name="Stripe"
        )

        assert session.mode == "competitive"
        assert session.competitor_name == "Stripe"

    def test_create_session_with_file_metadata(self, db_session):
        """Test session creation with file uploads"""
        service = JourneyMapperService()

        file_metadata = [
            {"filename": "interview.txt", "content_preview": "User said..."},
            {"filename": "tickets.csv", "content_preview": "Issue,Status..."}
        ]

        session = service.create_session(
            db=db_session,
            mode="standard",
            journey_description="Journey analysis from uploaded files",
            file_metadata=file_metadata
        )

        assert session.file_metadata is not None
        assert len(session.file_metadata) == 2

    def test_get_session(self, db_session):
        """Test retrieving a session by ID"""
        service = JourneyMapperService()

        # Create session
        created = service.create_session(
            db=db_session,
            mode="standard",
            journey_description="Test session retrieval"
        )

        # Retrieve session
        retrieved = service.get_session(db_session, created.id)

        assert retrieved is not None
        assert retrieved.id == created.id

    def test_get_session_not_found(self, db_session):
        """Test retrieving non-existent session"""
        service = JourneyMapperService()
        result = service.get_session(db_session, 99999)
        assert result is None

    def test_list_sessions(self, db_session):
        """Test listing sessions"""
        service = JourneyMapperService()

        # Create multiple sessions
        for i in range(5):
            service.create_session(
                db=db_session,
                mode="standard",
                journey_description=f"Test session number {i}"
            )

        sessions = service.list_sessions(db_session)
        assert len(sessions) == 5

    def test_list_sessions_with_pagination(self, db_session):
        """Test session listing with pagination"""
        service = JourneyMapperService()

        # Create 10 sessions
        for i in range(10):
            service.create_session(
                db=db_session,
                mode="standard",
                journey_description=f"Paginated session {i}"
            )

        # Get first page
        page1 = service.list_sessions(db_session, skip=0, limit=5)
        assert len(page1) == 5

        # Get second page
        page2 = service.list_sessions(db_session, skip=5, limit=5)
        assert len(page2) == 5

    def test_list_sessions_by_user(self, db_session):
        """Test listing sessions filtered by user"""
        service = JourneyMapperService()

        # Create sessions for different users
        service.create_session(db=db_session, mode="standard", journey_description="User 1 journey", user_id=1)
        service.create_session(db=db_session, mode="standard", journey_description="User 2 journey", user_id=2)
        service.create_session(db=db_session, mode="standard", journey_description="User 1 second", user_id=1)

        sessions = service.list_sessions(db_session, user_id=1)
        assert len(sessions) == 2

    def test_delete_session(self, db_session):
        """Test deleting a session"""
        service = JourneyMapperService()

        # Create session
        session = service.create_session(
            db=db_session,
            mode="standard",
            journey_description="Session to be deleted"
        )

        # Delete
        result = service.delete_session(db_session, session.id)

        assert result is True
        assert service.get_session(db_session, session.id) is None

    def test_delete_session_not_found(self, db_session):
        """Test deleting non-existent session"""
        service = JourneyMapperService()
        result = service.delete_session(db_session, 99999)
        assert result is False


# Need to add the select import for persona query
from sqlmodel import select


class TestJourneyMapperServiceSessionDetail:
    """Test suite for session detail retrieval"""

    def test_get_session_detail_complete(self, db_session):
        """Test getting complete session detail with all related data"""
        service = JourneyMapperService()

        # Create session with stages
        session = JourneyMapSession(
            journey_description="Complete session detail test",
            mode="standard",
            status="completed",
            stages=[
                {"id": "s1", "name": "Stage 1", "order": 0},
                {"id": "s2", "name": "Stage 2", "order": 1}
            ]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Add pain points
        for i in range(3):
            pp = JourneyPainPoint(
                journey_map_id=session.id,
                stage_id="s1",
                description=f"Pain point {i}",
                severity=5.0 + i
            )
            db_session.add(pp)

        # Add persona
        persona = JourneyPersona(
            journey_map_id=session.id,
            name="Test User",
            description="Test persona"
        )
        db_session.add(persona)
        db_session.commit()

        # Get detail
        detail = service.get_session_detail(db_session, session.id)

        assert detail is not None
        assert detail["session"].id == session.id
        assert len(detail["painPoints"]) == 3
        assert len(detail["personas"]) == 1

    def test_get_session_detail_not_found(self, db_session):
        """Test getting detail for non-existent session"""
        service = JourneyMapperService()
        detail = service.get_session_detail(db_session, 99999)
        assert detail is None


class TestJourneyMapperServicePainPoints:
    """Test suite for pain point management"""

    def test_add_pain_point(self, db_session):
        """Test adding a pain point"""
        service = JourneyMapperService()

        session = JourneyMapSession(
            journey_description="Journey for pain point test",
            mode="standard",
            status="completed",
            stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
        )
        db_session.add(session)
        db_session.commit()

        pain_point = service.add_pain_point(
            db=db_session,
            journey_map_id=session.id,
            stage_id="s1",
            description="Users can't find the button",
            severity=7.0
        )

        assert pain_point.id is not None
        assert pain_point.description == "Users can't find the button"
        assert pain_point.severity == 7.0
        assert pain_point.is_user_edited is True  # Manually added

    def test_update_pain_point(self, db_session):
        """Test updating a pain point"""
        service = JourneyMapperService()

        # Create pain point
        session = JourneyMapSession(
            journey_description="Journey for update test",
            mode="standard",
            status="completed"
        )
        db_session.add(session)
        db_session.commit()

        pain_point = JourneyPainPoint(
            journey_map_id=session.id,
            stage_id="s1",
            description="Original",
            severity=5.0,
            is_user_edited=False
        )
        db_session.add(pain_point)
        db_session.commit()
        db_session.refresh(pain_point)

        # Update
        updated = service.update_pain_point(
            db=db_session,
            pain_point_id=pain_point.id,
            updates={"description": "Updated", "severity": 8.0}
        )

        assert updated.description == "Updated"
        assert updated.severity == 8.0
        assert updated.is_user_edited is True

    def test_update_pain_point_not_found(self, db_session):
        """Test updating non-existent pain point"""
        service = JourneyMapperService()
        result = service.update_pain_point(db_session, 99999, {"description": "Updated"})
        assert result is None

    def test_delete_pain_point(self, db_session):
        """Test deleting a pain point"""
        service = JourneyMapperService()

        session = JourneyMapSession(
            journey_description="Journey for delete test",
            mode="standard",
            status="completed"
        )
        db_session.add(session)
        db_session.commit()

        pain_point = JourneyPainPoint(
            journey_map_id=session.id,
            stage_id="s1",
            description="To delete",
            severity=5.0
        )
        db_session.add(pain_point)
        db_session.commit()
        db_session.refresh(pain_point)

        result = service.delete_pain_point(db_session, pain_point.id)
        assert result is True

    def test_delete_pain_point_not_found(self, db_session):
        """Test deleting non-existent pain point"""
        service = JourneyMapperService()
        result = service.delete_pain_point(db_session, 99999)
        assert result is False


class TestJourneyMapperServiceStages:
    """Test suite for stage management"""

    def test_delete_stage(self, db_session):
        """Test deleting a stage"""
        service = JourneyMapperService()

        session = JourneyMapSession(
            journey_description="Journey for stage delete test",
            mode="standard",
            status="completed",
            stages=[
                {"id": "s1", "name": "First", "order": 0},
                {"id": "s2", "name": "Second", "order": 1}
            ]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        updated = service.delete_stage(db_session, session.id, "s1")

        assert updated is not None
        assert len(updated.stages) == 1
        assert updated.stages[0]["id"] == "s2"

    def test_delete_stage_session_not_found(self, db_session):
        """Test deleting stage from non-existent session"""
        service = JourneyMapperService()
        result = service.delete_stage(db_session, 99999, "s1")
        assert result is None


class TestJourneyMapperServiceCompetitiveJourney:
    """Test suite for competitive journey functionality"""

    def test_add_competitor_observation(self, db_session):
        """Test adding competitor observation"""
        service = JourneyMapperService()

        session = JourneyMapSession(
            journey_description="Competitive analysis",
            mode="competitive",
            competitor_name="Stripe",
            status="pending"
        )
        db_session.add(session)
        db_session.commit()

        observation = service.add_competitor_observation(
            db=db_session,
            journey_map_id=session.id,
            stage_order=1,
            stage_name="Payment Form",
            touchpoints_observed=["Card input", "CVV"],
            time_taken="2 minutes",
            friction_points=["Too many fields"],
            strengths_observed=["Auto-complete"]
        )

        assert observation.id is not None
        assert observation.stage_name == "Payment Form"
        assert "Too many fields" in observation.friction_points


class TestJourneyMapperServiceVersioning:
    """Test suite for version control"""

    def test_create_new_version_refresh(self, db_session):
        """Test creating a new version with refresh type (increments minor version)"""
        service = JourneyMapperService()

        parent = JourneyMapSession(
            journey_description="Parent version",
            mode="standard",
            status="completed",
            version="1.0",
            stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
        )
        db_session.add(parent)
        db_session.commit()
        db_session.refresh(parent)

        new_version = service.create_new_version(
            db=db_session,
            parent_session_id=parent.id,
            new_knowledge_base_ids=[1, 2],
            update_type="refresh"  # Refresh increments minor version
        )

        assert new_version.parent_version_id == parent.id
        assert new_version.version == "1.1"  # 1.0 + refresh = 1.1
        assert new_version.status == "pending"

    def test_create_new_version_expand(self, db_session):
        """Test creating a new version with expand type (increments major version)"""
        service = JourneyMapperService()

        parent = JourneyMapSession(
            journey_description="Parent version",
            mode="standard",
            status="completed",
            version="1.0",
            stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
        )
        db_session.add(parent)
        db_session.commit()
        db_session.refresh(parent)

        new_version = service.create_new_version(
            db=db_session,
            parent_session_id=parent.id,
            update_type="expand"  # Expand increments major version
        )

        assert new_version.version == "2.0"  # 1.0 + expand = 2.0

    def test_create_new_version_not_found(self, db_session):
        """Test creating version from non-existent parent"""
        service = JourneyMapperService()

        with pytest.raises(ValueError, match="not found"):
            service.create_new_version(db_session, parent_session_id=99999)

    def test_compare_versions(self, db_session):
        """Test comparing two versions"""
        service = JourneyMapperService()

        # Create parent
        parent = JourneyMapSession(
            journey_description="Parent",
            mode="standard",
            status="completed",
            version="1.0",
            stages=[{"id": "s1", "name": "Stage 1", "order": 0}]
        )
        db_session.add(parent)
        db_session.commit()
        db_session.refresh(parent)

        # Create child with changes
        child = JourneyMapSession(
            journey_description="Child",
            mode="standard",
            status="completed",
            version="2.0",
            parent_version_id=parent.id,
            stages=[
                {"id": "s1", "name": "Stage 1 Updated", "order": 0},
                {"id": "s2", "name": "Stage 2", "order": 1}
            ]
        )
        db_session.add(child)
        db_session.commit()
        db_session.refresh(child)

        result = service.compare_versions(db_session, parent.id, child.id)

        # Check structure
        assert "version1" in result
        assert "version2" in result
        assert "deltaSummary" in result

    def test_compare_versions_not_found(self, db_session):
        """Test comparing when one version doesn't exist"""
        service = JourneyMapperService()

        with pytest.raises(ValueError, match="not found"):
            service.compare_versions(db_session, 99999, 88888)


class TestJourneyMapperServiceHelpers:
    """Test suite for helper methods"""

    def test_mask_pii(self, db_session):
        """Test PII masking"""
        service = JourneyMapperService()

        text = """
        User email: john@example.com
        Phone: 555-123-4567
        Card: 4111111111111111
        """

        masked = service._mask_pii(text)

        assert "john@example.com" not in masked
        assert "555-123-4567" not in masked
        assert "4111111111111111" not in masked
        assert "[EMAIL]" in masked
        assert "[PHONE]" in masked

    def test_mask_pii_empty(self, db_session):
        """Test PII masking with empty input"""
        service = JourneyMapperService()
        assert service._mask_pii("") == ""
        assert service._mask_pii(None) is None

    def test_parse_llm_json_valid(self, db_session):
        """Test parsing valid JSON"""
        service = JourneyMapperService()

        content = '{"stages": [{"id": "s1", "name": "Test"}]}'
        result = service._parse_llm_json(content, "test")

        assert result["stages"][0]["name"] == "Test"

    def test_parse_llm_json_with_markdown(self, db_session):
        """Test parsing JSON wrapped in markdown code blocks"""
        service = JourneyMapperService()

        content = '```json\n{"result": "success"}\n```'
        result = service._parse_llm_json(content, "test")

        assert result["result"] == "success"

    def test_parse_llm_json_with_prefix(self, db_session):
        """Test parsing JSON with text before it"""
        service = JourneyMapperService()

        content = 'Here is the analysis:\n{"data": "value"}'
        result = service._parse_llm_json(content, "test")

        assert result["data"] == "value"

    def test_parse_llm_json_array(self, db_session):
        """Test parsing JSON array"""
        service = JourneyMapperService()

        content = '[{"item": 1}, {"item": 2}]'
        result = service._parse_llm_json(content, "test")

        assert isinstance(result, list)
        assert len(result) == 2

    def test_parse_llm_json_empty_raises(self, db_session):
        """Test parsing empty content raises error"""
        service = JourneyMapperService()

        with pytest.raises(ValueError, match="Empty response"):
            service._parse_llm_json("", "test")

    def test_parse_llm_json_invalid_raises(self, db_session):
        """Test parsing invalid JSON raises error"""
        service = JourneyMapperService()

        with pytest.raises(ValueError):
            service._parse_llm_json("just some text without json", "test")
