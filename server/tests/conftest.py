# Fix for fastapi-mail 1.5.2 bug: SecretStr not imported from pydantic
# This patch must run before any app imports that use app.core.email
# See: https://github.com/sabuhish/fastapi-mail/issues/XXX
def _patch_fastapi_mail():
    """Patch fastapi_mail.config to import SecretStr if missing."""
    import importlib.util
    spec = importlib.util.find_spec("fastapi_mail")
    if spec and spec.submodule_search_locations:
        config_path = None
        for loc in spec.submodule_search_locations:
            import os
            candidate = os.path.join(loc, "config.py")
            if os.path.exists(candidate):
                config_path = candidate
                break

        if config_path:
            with open(config_path, 'r') as f:
                content = f.read()

            # Check if SecretStr is missing from pydantic imports
            if "from pydantic import" in content and "SecretStr" not in content:
                patched = content.replace(
                    "from pydantic import FilePath, DirectoryPath, EmailStr, conint",
                    "from pydantic import FilePath, DirectoryPath, EmailStr, conint, SecretStr"
                )
                with open(config_path, 'w') as f:
                    f.write(patched)
                print("[conftest] Auto-patched fastapi_mail SecretStr import bug")

_patch_fastapi_mail()

import pytest
from typing import Generator
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from app.main import app
from app.core.db import get_session
from app.models.user import User


@pytest.fixture(autouse=True)
def mock_auth():
    """Auto-use fixture to mock authentication for all tests"""
    from app.api.deps import get_current_user

    # Create a mock user that will be returned for all auth checks
    mock_user = User(id=1, email="test@example.com", is_active=True)

    def mock_get_current_user():
        return mock_user

    # Override at the app level
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield mock_user
    # Cleanup - don't remove other overrides
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]

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

@pytest.fixture(name="test_user")
def test_user_fixture(session: Session):
    """Get the default test user from the session"""
    return session.get(User, 1)

@pytest.fixture(name="client")
def client_fixture(session: Session, test_user: User):
    from app.api.deps import get_current_user

    def get_session_override():
        return session

    def get_current_user_override():
        return test_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
