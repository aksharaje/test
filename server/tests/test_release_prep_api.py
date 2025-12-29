"""
API tests for Release Prep endpoints

Tests the REST API endpoints for Release Prep Agent.
"""
import pytest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
from datetime import datetime
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.db import get_session
from app.models.release_prep import (
    ReleasePrepSession,
    ReleaseStory,
    ReleaseNote,
    Decision,
    TechnicalDebtItem,
)
from app.models.story_generator import GeneratedArtifact


# Set up test database at module level
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SQLModel.metadata.create_all(engine)


def get_test_session():
    """Override session dependency"""
    with Session(engine) as session:
        yield session


# Override dependency and create client
app.dependency_overrides[get_session] = get_test_session
client = TestClient(app)


@pytest.fixture
def clean_db():
    """Clean database before each test"""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


class TestSessionEndpoints:
    """Tests for session management endpoints"""

    def test_create_session(self, clean_db):
        """Test creating a new session"""
        response = client.post(
            "/api/release-prep/sessions",
            json={
                "releaseName": "Test Release",
                "storyArtifactIds": [1, 2],
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["releaseName"] == "Test Release"
        assert data["storyArtifactIds"] == [1, 2]
        assert data["status"] == "draft"

    def test_create_session_minimal(self, clean_db):
        """Test creating a session with minimal data"""
        response = client.post(
            "/api/release-prep/sessions",
            json={}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["releaseName"] == "Untitled Release"

    def test_list_sessions(self, clean_db):
        """Test listing all sessions"""
        # Create a few sessions first
        client.post("/api/release-prep/sessions", json={"releaseName": "Release 1"})
        client.post("/api/release-prep/sessions", json={"releaseName": "Release 2"})

        response = client.get("/api/release-prep/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_session_with_artifacts(self, clean_db):
        """Test getting a session with all its artifacts"""
        # Create a session
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Test"}
        )
        session_id = create_response.json()["id"]

        response = client.get(f"/api/release-prep/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "releaseNotes" in data
        assert "decisions" in data
        assert "debtItems" in data
        assert data["session"]["releaseName"] == "Test"

    def test_get_session_not_found(self, clean_db):
        """Test getting a non-existent session"""
        response = client.get("/api/release-prep/sessions/999")
        assert response.status_code == 404

    def test_delete_session(self, clean_db):
        """Test deleting a session"""
        # Create a session first
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "To Delete"}
        )
        session_id = create_response.json()["id"]

        response = client.delete(f"/api/release-prep/sessions/{session_id}")

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

        # Verify it's gone
        get_response = client.get(f"/api/release-prep/sessions/{session_id}")
        assert get_response.status_code == 404

    def test_delete_session_not_found(self, clean_db):
        """Test deleting a non-existent session"""
        response = client.delete("/api/release-prep/sessions/999")
        assert response.status_code == 404


class TestAvailableStoriesEndpoint:
    """Tests for available stories endpoint"""

    def test_get_available_stories(self, clean_db):
        """Test getting available stories from Story Generator"""
        # Create a sample artifact
        with Session(engine) as db:
            artifact = GeneratedArtifact(
                title="Feature Story",
                type="feature",
                content='{"feature": {"summary": "A new feature"}}',
                status="final",
                input_description="Test",
            )
            db.add(artifact)
            db.commit()

        response = client.get("/api/release-prep/stories/available")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Feature Story"
        assert "preview" in data[0]


class TestPipelineEndpoints:
    """Tests for pipeline execution endpoints"""

    @patch('app.api.api_v1.endpoints.release_prep.run_pipeline_task')
    def test_run_pipeline_starts(self, mock_run_task, clean_db):
        """Test starting the pipeline"""
        # Create a session first
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Pipeline Test"}
        )
        session_id = create_response.json()["id"]

        response = client.post(f"/api/release-prep/sessions/{session_id}/run")

        assert response.status_code == 200
        assert response.json()["status"] == "started"

    def test_run_pipeline_session_not_found(self, clean_db):
        """Test running pipeline for non-existent session"""
        response = client.post("/api/release-prep/sessions/999/run")
        assert response.status_code == 404

    def test_get_pipeline_status(self, clean_db):
        """Test getting pipeline status"""
        # Create a session
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Status Test"}
        )
        session_id = create_response.json()["id"]

        response = client.get(f"/api/release-prep/sessions/{session_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "progressStep" in data
        assert "progressTotal" in data


class TestReleaseNotesEndpoints:
    """Tests for release notes endpoints"""

    def test_get_release_notes(self, clean_db):
        """Test getting release notes for a session"""
        # Create a session and add a release note
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Notes Test"}
        )
        session_id = create_response.json()["id"]

        # Add a release note directly
        with Session(engine) as db:
            note = ReleaseNote(
                session_id=session_id,
                title="Test Note",
                description="Test description",
                category="feature",
            )
            db.add(note)
            db.commit()

        response = client.get(f"/api/release-prep/sessions/{session_id}/release-notes")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Note"

    def test_update_release_note(self, clean_db):
        """Test updating a release note"""
        # Create session and note
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Update Test"}
        )
        session_id = create_response.json()["id"]

        with Session(engine) as db:
            note = ReleaseNote(
                session_id=session_id,
                title="Original",
                description="Original desc",
                category="feature",
            )
            db.add(note)
            db.commit()
            db.refresh(note)
            note_id = note.id

        response = client.patch(
            f"/api/release-prep/release-notes/{note_id}",
            json={"title": "Updated Title", "description": "Updated desc"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["isUserEdited"] is True

    def test_update_release_note_not_found(self, clean_db):
        """Test updating a non-existent release note"""
        response = client.patch(
            "/api/release-prep/release-notes/999",
            json={"title": "New Title"}
        )
        assert response.status_code == 404


class TestDecisionEndpoints:
    """Tests for decision log endpoints"""

    def test_get_decisions(self, clean_db):
        """Test getting decisions for a session"""
        # Create session and decision
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Decisions Test"}
        )
        session_id = create_response.json()["id"]

        with Session(engine) as db:
            decision = Decision(
                session_id=session_id,
                title="Test Decision",
                description="Test desc",
                decision_type="technical",
            )
            db.add(decision)
            db.commit()

        response = client.get(f"/api/release-prep/sessions/{session_id}/decisions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Decision"

    def test_update_decision(self, clean_db):
        """Test updating a decision"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Update Decision Test"}
        )
        session_id = create_response.json()["id"]

        with Session(engine) as db:
            decision = Decision(
                session_id=session_id,
                title="Original",
                description="Original desc",
                decision_type="technical",
            )
            db.add(decision)
            db.commit()
            db.refresh(decision)
            decision_id = decision.id

        response = client.patch(
            f"/api/release-prep/decisions/{decision_id}",
            json={"title": "Updated Decision", "rationale": "New rationale"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Decision"


class TestDebtItemEndpoints:
    """Tests for technical debt endpoints"""

    def test_get_debt_items(self, clean_db):
        """Test getting debt items for a session"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Debt Test"}
        )
        session_id = create_response.json()["id"]

        with Session(engine) as db:
            item = TechnicalDebtItem(
                session_id=session_id,
                title="Test Debt",
                description="Test desc",
                debt_type="code",
            )
            db.add(item)
            db.commit()

        response = client.get(f"/api/release-prep/sessions/{session_id}/debt-items")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Debt"

    def test_create_debt_item(self, clean_db):
        """Test creating a debt item manually"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Create Debt Test"}
        )
        session_id = create_response.json()["id"]

        response = client.post(
            f"/api/release-prep/sessions/{session_id}/debt-items",
            json={
                "title": "New Debt Item",
                "description": "Manually added",
                "debtType": "architecture",
                "impactLevel": "high",
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Debt Item"
        assert data["isUserAdded"] is True
        assert data["introducedInRelease"] == "Create Debt Test"

    def test_update_debt_item(self, clean_db):
        """Test updating a debt item"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Update Debt Test"}
        )
        session_id = create_response.json()["id"]

        with Session(engine) as db:
            item = TechnicalDebtItem(
                session_id=session_id,
                title="Original",
                description="Original desc",
                debt_type="code",
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            item_id = item.id

        response = client.patch(
            f"/api/release-prep/debt-items/{item_id}",
            json={"title": "Updated Debt", "status": "acknowledged"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Debt"


class TestExportEndpoints:
    """Tests for export endpoints"""

    def test_export_release_notes_markdown(self, clean_db):
        """Test exporting release notes as markdown"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Export Test"}
        )
        session_id = create_response.json()["id"]

        with Session(engine) as db:
            note = ReleaseNote(
                session_id=session_id,
                title="Feature",
                description="New feature",
                category="feature",
            )
            db.add(note)
            db.commit()

        response = client.get(f"/api/release-prep/sessions/{session_id}/export/release-notes")

        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "markdown"
        assert "# Release Notes" in data["content"]

    def test_export_release_notes_html(self, clean_db):
        """Test exporting release notes as HTML"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Export HTML Test"}
        )
        session_id = create_response.json()["id"]

        response = client.get(f"/api/release-prep/sessions/{session_id}/export/release-notes?format=html")

        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "html"
        assert "<h1>" in data["content"]

    def test_export_decision_log(self, clean_db):
        """Test exporting decision log"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Export Decisions Test"}
        )
        session_id = create_response.json()["id"]

        response = client.get(f"/api/release-prep/sessions/{session_id}/export/decision-log")

        assert response.status_code == 200
        data = response.json()
        assert "# Decision Log" in data["content"]

    def test_export_debt_inventory(self, clean_db):
        """Test exporting debt inventory"""
        create_response = client.post(
            "/api/release-prep/sessions",
            json={"releaseName": "Export Debt Test"}
        )
        session_id = create_response.json()["id"]

        response = client.get(f"/api/release-prep/sessions/{session_id}/export/debt-inventory")

        assert response.status_code == 200
        data = response.json()
        assert "# Technical Debt Inventory" in data["content"]

    def test_export_session_not_found(self, clean_db):
        """Test exporting from non-existent session"""
        response = client.get("/api/release-prep/sessions/999/export/release-notes")
        assert response.status_code == 404
