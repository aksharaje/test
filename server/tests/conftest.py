import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.models.user import User

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", 
        connect_args={"check_same_thread": False}, 
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Create a default user for tests
        user = User(id=1, email="test@example.com")
        session.add(user)
        
        # Create a default template for tests
        from app.models.prd import PrdTemplate
        template = PrdTemplate(
            id=1, 
            name="Standard", 
            description="Standard Template", 
            system_prompt="You are a PM...",
            is_default=1
        )
        session.add(template)
        session.commit()
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
