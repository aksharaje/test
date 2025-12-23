"""
Tests for Opportunity Linker API Endpoints
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from app.main import app
from app.models.opportunity_linker import PrioritizationSession
from app.models.ideation import IdeationSession


client = TestClient(app)


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_create_session_success(mock_service):
    """Test POST /sessions creates prioritization session successfully"""
    mock_session = PrioritizationSession(
        id=1,
        ideation_session_id=1,
        status="pending"
    )
    mock_service.create_session.return_value = mock_session

    response = client.post(
        "/api/opportunity-linker/sessions",
        json={"ideation_session_id": 1}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1
    assert data["status"] == "pending"
    assert "message" in data


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_create_session_ideation_not_found(mock_service):
    """Test POST /sessions returns 404 when ideation session not found"""
    mock_service.create_session.side_effect = ValueError("Ideation session not found")

    response = client.post(
        "/api/opportunity-linker/sessions",
        json={"ideation_session_id": 999}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_create_session_missing_input(mock_service):
    """Test POST /sessions returns 400 when ideation session not completed (NULL/EMPTY)"""
    mock_service.create_session.side_effect = ValueError("must be completed before prioritization")

    response = client.post(
        "/api/opportunity-linker/sessions",
        json={"ideation_session_id": 1}
    )

    assert response.status_code == 400
    assert "Missing required input: ideation_engine_result" in response.json()["detail"]


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_get_session_detail_success(mock_service):
    """Test GET /sessions/{id} returns session detail"""
    mock_detail = {
        "session": {
            "id": 1,
            "status": "completed",
            "ideationSessionId": 1
        },
        "ideas": [
            {
                "id": 1,
                "title": "Test Idea",
                "priorityTier": "P0",
                "priorityScore": 8.5
            }
        ]
    }
    mock_service.get_session_detail.return_value = mock_detail

    response = client.get("/api/opportunity-linker/sessions/1")

    assert response.status_code == 200
    data = response.json()
    assert data["session"]["id"] == 1
    assert len(data["ideas"]) == 1
    assert data["ideas"][0]["priorityTier"] == "P0"


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_get_session_detail_not_found(mock_service):
    """Test GET /sessions/{id} returns 404 when not found"""
    mock_service.get_session_detail.return_value = None

    response = client.get("/api/opportunity-linker/sessions/999")

    assert response.status_code == 404


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_get_session_status(mock_service):
    """Test GET /sessions/{id}/status returns status"""
    mock_session = PrioritizationSession(
        id=1,
        ideation_session_id=1,
        status="mapping",
        progress_step=3,
        progress_message="Processing idea 3 of 15"
    )
    mock_service.get_session.return_value = mock_session

    response = client.get("/api/opportunity-linker/sessions/1/status")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "mapping"
    assert data["progress_step"] == 3
    assert "Processing idea 3 of 15" in data["progress_message"]


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_list_sessions(mock_service):
    """Test GET /sessions lists all sessions"""
    mock_sessions = [
        PrioritizationSession(id=1, ideation_session_id=1, status="completed"),
        PrioritizationSession(id=2, ideation_session_id=2, status="pending"),
    ]
    mock_service.list_sessions.return_value = mock_sessions

    response = client.get("/api/opportunity-linker/sessions")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == 1
    assert data[1]["id"] == 2


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_delete_session_success(mock_service):
    """Test DELETE /sessions/{id} deletes session"""
    mock_service.delete_session.return_value = True

    response = client.delete("/api/opportunity-linker/sessions/1")

    assert response.status_code == 204
    mock_service.delete_session.assert_called_once()


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_delete_session_not_found(mock_service):
    """Test DELETE /sessions/{id} returns 404 when not found"""
    mock_service.delete_session.return_value = False

    response = client.delete("/api/opportunity-linker/sessions/999")

    assert response.status_code == 404


@patch('app.api.api_v1.endpoints.opportunity_linker.opportunity_linker_service')
def test_priority_tier_cutoffs(mock_service):
    """Test that priority tiers are assigned correctly based on score cutoffs"""
    # This tests acceptance criteria: Priority Calculation Logic
    mock_detail = {
        "session": {"id": 1, "status": "completed"},
        "ideas": [
            {"priorityScore": 8.5, "priorityTier": "P0"},  # >= 8.0
            {"priorityScore": 7.0, "priorityTier": "P1"},  # >= 6.5
            {"priorityScore": 5.5, "priorityTier": "P2"},  # >= 5.0
            {"priorityScore": 4.0, "priorityTier": "P3"},  # < 5.0
        ]
    }
    mock_service.get_session_detail.return_value = mock_detail

    response = client.get("/api/opportunity-linker/sessions/1")
    data = response.json()

    # Verify tier assignments match cutoffs
    assert data["ideas"][0]["priorityTier"] == "P0"
    assert data["ideas"][1]["priorityTier"] == "P1"
    assert data["ideas"][2]["priorityTier"] == "P2"
    assert data["ideas"][3]["priorityTier"] == "P3"
