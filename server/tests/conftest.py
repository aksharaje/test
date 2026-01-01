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
