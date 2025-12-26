import pytest

from app.models.prd import GeneratedPrd
from app.models.feasibility import FeasibilitySession
from app.models.ideation import IdeationSession
from sqlmodel import Session

def test_get_dashboard_stats(client, session: Session):
    # Setup: Create some artifacts
    prd = GeneratedPrd(title="Test PRD", content="Content", concept="Concept", user_id=1)
    feasibility = FeasibilitySession(feature_description="Test Feasibility", user_id=1, technical_components=[])
    ideation = IdeationSession(problem_statement="Test Problem", user_id=1)
    
    session.add(prd)
    session.add(feasibility)
    session.add(ideation)
    session.commit()
    
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    
    # Verify Counts
    assert data["counts"]["prd"] >= 1
    assert data["counts"]["feasibility"] >= 1
    assert data["counts"]["ideation"] >= 1
    assert data["counts"]["total"] >= 3
    
    # Verify ROI Calculations
    # Hours = (PRD*4) + (Feas*2) + (Idea*0.5) = 4 + 2 + 0.5 = 6.5
    # Note: >= because other tests might have created data
    assert data["roi"]["hoursReclaimed"] >= 6.5
    assert data["roi"]["strategicFocus"] == 90
    assert "velocityMultiplier" in data["roi"]
