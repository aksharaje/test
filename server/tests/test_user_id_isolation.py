"""
Tests for User ID Isolation

These tests ensure that users can only access their own data across all features.
Each test creates data for multiple users and verifies that user A cannot access user B's data.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.jira import Integration
from app.models.ideation import IdeationSession
from app.models.feasibility import FeasibilitySession


@pytest.fixture(name="multi_user_session")
def multi_user_session_fixture():
    """Create a session with multiple users and test data."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Create two users
        user1 = User(id=1, email="user1@example.com", is_active=True)
        user2 = User(id=2, email="user2@example.com", is_active=True)
        session.add(user1)
        session.add(user2)

        # Create integrations for each user
        integration1 = Integration(
            id=1,
            user_id=1,
            name="User1 Jira",
            provider="jira",
            status="connected",
            cloud_id="cloud1",
            access_token="token1",
            base_url="https://user1.atlassian.net",
            auth_type="oauth"
        )
        integration2 = Integration(
            id=2,
            user_id=2,
            name="User2 Jira",
            provider="jira",
            status="connected",
            cloud_id="cloud2",
            access_token="token2",
            base_url="https://user2.atlassian.net",
            auth_type="oauth"
        )
        session.add(integration1)
        session.add(integration2)

        # Create ideation sessions for each user
        ideation1 = IdeationSession(
            id=1,
            user_id=1,
            problem_statement="User 1's idea",
            status="completed"
        )
        ideation2 = IdeationSession(
            id=2,
            user_id=2,
            problem_statement="User 2's idea",
            status="completed"
        )
        session.add(ideation1)
        session.add(ideation2)

        # Create feasibility sessions for each user
        feasibility1 = FeasibilitySession(
            id=1,
            user_id=1,
            feature_description="User 1's feature",
            status="completed"
        )
        feasibility2 = FeasibilitySession(
            id=2,
            user_id=2,
            feature_description="User 2's feature",
            status="completed"
        )
        session.add(feasibility1)
        session.add(feasibility2)

        session.commit()
        yield session


def get_client_for_user(session: Session, user_id: int) -> TestClient:
    """Create a test client that's authenticated as a specific user."""
    user = session.get(User, user_id)

    def get_session_override():
        return session

    def get_current_user_override():
        return user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    return TestClient(app)


class TestIntegrationIsolation:
    """Test that integrations are isolated by user."""

    def test_user_can_only_see_own_integrations(self, multi_user_session: Session):
        """User 1 should only see their own integrations."""
        client = get_client_for_user(multi_user_session, user_id=1)

        response = client.get("/api/v1/integrations")
        assert response.status_code == 200
        integrations = response.json()

        # Should only see user 1's integration
        assert len(integrations) == 1
        assert integrations[0]["name"] == "User1 Jira"

    def test_user_cannot_access_other_user_integration(self, multi_user_session: Session):
        """User 1 should not be able to access User 2's integration."""
        client = get_client_for_user(multi_user_session, user_id=1)

        # Try to get user 2's integration (id=2)
        response = client.get("/api/v1/integrations/2")
        assert response.status_code == 404

    def test_user_cannot_delete_other_user_integration(self, multi_user_session: Session):
        """User 1 should not be able to delete User 2's integration."""
        client = get_client_for_user(multi_user_session, user_id=1)

        # Try to delete user 2's integration (id=2)
        response = client.delete("/api/v1/integrations/2")
        assert response.status_code == 404


class TestIdeationIsolation:
    """Test that ideation sessions are isolated by user."""

    def test_user_can_only_see_own_ideation_sessions(self, multi_user_session: Session):
        """User 1 should only see their own ideation sessions."""
        client = get_client_for_user(multi_user_session, user_id=1)

        response = client.get("/api/v1/ideation/sessions")
        assert response.status_code == 200
        sessions = response.json()

        # Should only see user 1's session
        assert len(sessions) == 1
        assert sessions[0]["problemStatement"] == "User 1's idea"

    def test_user_cannot_access_other_user_ideation_session(self, multi_user_session: Session):
        """User 1 should not be able to access User 2's ideation session."""
        client = get_client_for_user(multi_user_session, user_id=1)

        # Try to get user 2's session (id=2)
        response = client.get("/api/v1/ideation/sessions/2")
        assert response.status_code == 404


class TestFeasibilityIsolation:
    """Test that feasibility sessions are isolated by user."""

    def test_user_can_only_see_own_feasibility_sessions(self, multi_user_session: Session):
        """User 1 should only see their own feasibility sessions."""
        client = get_client_for_user(multi_user_session, user_id=1)

        response = client.get("/api/v1/feasibility/sessions")
        assert response.status_code == 200
        sessions = response.json()

        # Should only see user 1's session
        assert len(sessions) == 1
        assert sessions[0]["featureDescription"] == "User 1's feature"

    def test_user_cannot_access_other_user_feasibility_session(self, multi_user_session: Session):
        """User 1 should not be able to access User 2's feasibility session."""
        client = get_client_for_user(multi_user_session, user_id=1)

        # Try to get user 2's session (id=2)
        response = client.get("/api/v1/feasibility/sessions/2")
        assert response.status_code == 404


class TestProgressTrackerIsolation:
    """Test that progress tracker check_integrations is isolated by user."""

    def test_progress_tracker_check_only_shows_user_integrations(self, multi_user_session: Session):
        """Progress tracker should only show current user's integrations."""
        client = get_client_for_user(multi_user_session, user_id=1)

        response = client.get("/api/v1/progress-tracker/integrations/check")
        assert response.status_code == 200
        result = response.json()

        # If there are integrations, verify none belong to user 2
        if result.get("hasValidIntegration"):
            integrations = result.get("integrations", [])
            for integration in integrations:
                # Integration should not be user 2's
                assert integration.get("id") != 2


class TestRoadmapPlannerAvailableSourcesIsolation:
    """Test that roadmap planner available sources are isolated by user."""

    def test_user_can_only_see_own_feasibility_for_roadmap(self, multi_user_session: Session):
        """User 1 should only see their own feasibility analyses for roadmap planning."""
        client = get_client_for_user(multi_user_session, user_id=1)

        response = client.get("/api/v1/roadmap-planner/available-feasibility")
        assert response.status_code == 200
        analyses = response.json()

        # Should only see user 1's feasibility analysis
        assert len(analyses) == 1
        assert "User 1's feature" in analyses[0]["featureDescription"]


# Clean up after all tests
def teardown_module():
    app.dependency_overrides.clear()
