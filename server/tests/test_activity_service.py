import pytest
from sqlmodel import Session, select
from datetime import datetime, timedelta
from app.models.user_activity import UserActivity
from app.services.activity_service import ActivityService

def test_log_activity(session: Session):
    db, service = session, ActivityService()
    activity = service.log_activity(db, user_id=1, feature_key="dashboard", metadata="test")
    
    assert activity.id is not None
    assert activity.user_id == 1
    assert activity.feature_key == "dashboard"
    assert activity.metadata_json == "test"
    
    # Verify persistence
    saved = db.get(UserActivity, activity.id)
    assert saved is not None

def test_get_frequent_shortcuts(session: Session):
    db, service = session, ActivityService()
    user_id = 999
    
    # Log 3 dashboard visits, 1 prd_generator visit, and 1 ideation visit (old)
    for _ in range(3):
        service.log_activity(db, user_id, "dashboard")
        
    service.log_activity(db, user_id, "prd_generator")
    
    # Old activity (should be filtered if > 30 days, but here we test ranking)
    service.log_activity(db, user_id, "ideation")
    
    shortcuts = service.get_frequent_shortcuts(db, user_id, limit=2)
    
    assert len(shortcuts) == 2
    assert shortcuts[0]["id"] == "dashboard"
    assert shortcuts[0]["count"] == 3
    assert shortcuts[1]["id"] == "prd_generator" # Ordered by count
    
    # Test details enrichment
    assert shortcuts[0]["name"] == "Dashboard"
    assert shortcuts[0]["url"] == "/dashboard"
    assert shortcuts[0]["icon"] == "lucideLayoutDashboard"

def test_get_recent_outputs(session: Session):
    db, service = session, ActivityService()
    user_id = 999
    
    # 1. Create a PRD
    from app.models.prd import GeneratedPrd
    prd = GeneratedPrd(
        user_id=user_id, 
        title="Test PRD", 
        content="...", 
        concept="...", 
        updated_at=datetime.utcnow()
    )
    db.add(prd)
    
    # 2. Create an Ideation
    from app.models.ideation import IdeationSession
    idea = IdeationSession(
        user_id=user_id, 
        problem_statement="Test Idea", 
        updated_at=datetime.utcnow() + timedelta(minutes=5) # Newer
    )
    db.add(idea)
    
    db.commit()
    
    outputs = service.get_recent_outputs(db, user_id, limit=5)
    
    assert len(outputs) == 2
    # Verify sorting (Ideation is newer)
    assert outputs[0]["type"] == "ideation"
    assert outputs[0]["title"] == "Test Idea"
    assert outputs[0]["icon"] == "lucideLightbulb"
    
    assert outputs[1]["type"] == "prd"
    assert outputs[1]["title"] == "Test PRD"
    assert outputs[1]["icon"] == "lucideFileText"
