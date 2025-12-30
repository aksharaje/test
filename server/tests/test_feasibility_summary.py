
import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.services.feasibility_service import FeasibilityService
from app.models.feasibility import (
    FeasibilitySession, 
    TechnicalComponent, 
    TimelineScenario, 
    RiskAssessment
)

# Setup in-memory DB
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)
SQLModel.metadata.create_all(engine)

@pytest.fixture
def db():
    with Session(engine) as session:
        yield session

@pytest.fixture
def service():
    svc = FeasibilityService()
    # Mock client to avoid actual API calls
    svc._client = MagicMock()
    return svc

@pytest.fixture
def mock_session_data(db):
    # Create session
    session = FeasibilitySession(
        feature_description="Test Feature",
        status="pending"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Create components
    comp1 = TechnicalComponent(
        session_id=session.id,
        component_name="API",
        component_description="Backend API",
        technical_category="backend",
        optimistic_hours=10,
        realistic_hours=20,
        pessimistic_hours=30,
        confidence_level="medium",
        display_order=0
    )
    db.add(comp1)
    
    # Create scenario
    scenario = TimelineScenario(
        session_id=session.id,
        scenario_type="realistic",
        total_weeks=2.0,
        sprint_count=1,
        parallelization_factor=0.5,
        overhead_percentage=10.0,
        team_size_assumed=2,
        confidence_level="medium",
        rationale="test"
    )
    db.add(scenario)
    
    # Create risks
    risk = RiskAssessment(
        session_id=session.id,
        risk_category="technical",
        risk_description="Complexity",
        probability=0.5,
        impact=0.5,
        risk_score=0.25,
        mitigation_strategy="Test",
        display_order=0
    )
    db.add(risk)
    
    db.commit()
    
    return session.id, [comp1], [scenario], [risk]


def test_generate_summary_success(service, db, mock_session_data):
    session_id, components, scenarios, risks = mock_session_data
    
    # Mock Successful LLM Response
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"executive_summary": "AI generated summary."}'
    service._client.chat.completions.create.return_value = mock_response
    
    service._generate_executive_summary(db, session_id, components, scenarios, risks)
    
    session = db.get(FeasibilitySession, session_id)
    assert session.executive_summary == "AI generated summary."
    assert session.go_no_go_recommendation is not None

def test_generate_summary_fallback_key(service, db, mock_session_data):
    session_id, components, scenarios, risks = mock_session_data
    
    # Mock LLM Response with different key
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"summary": "Alternative key summary."}'
    service._client.chat.completions.create.return_value = mock_response
    
    service._generate_executive_summary(db, session_id, components, scenarios, risks)
    
    session = db.get(FeasibilitySession, session_id)
    assert session.executive_summary == "Alternative key summary."

def test_generate_summary_constructd_fallback(service, db, mock_session_data):
    session_id, components, scenarios, risks = mock_session_data
    
    # Mock LLM Failure (raises exception in _call_llm or parsing)
    service._client.chat.completions.create.side_effect = Exception("API Error")
    
    service._generate_executive_summary(db, session_id, components, scenarios, risks)
    
    session = db.get(FeasibilitySession, session_id)
    # Checks if fallback summary is constructed
    assert "Feasibility analysis for" in session.executive_summary
    assert "estimates 20 hours" in session.executive_summary
