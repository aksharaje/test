from fastapi.testclient import TestClient
from sqlmodel import Session
from app.api.api_v1.endpoints.activity import router

# Assuming you have a conftest.py or similar setup for client/db fixtures
# Since I'm creating this from scratch in this context:

def test_log_activity_endpoint(client: TestClient, session: Session):
    # Mock authentication or use a client that bypasses it if possible, 
    # but for integration tests we usually need a valid user or override_dependency.
    # For now, simplistic structure.
    
    response = client.post(
        "/api/activity/log",
        json={"feature_key": "dashboard", "metadata": "api_test"}
    )
    # Note: Depending on auth setup this might fail 401. 
    # If using the same standard setup as other tests:
    assert response.status_code in [200, 201]
    data = response.json()
    assert data["feature_key"] == "dashboard"

def test_get_shortcuts_endpoint(client: TestClient, session: Session):
    response = client.get("/api/activity/shortcuts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
