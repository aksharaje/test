"""
Tests for Scope Definition API Endpoints

Comprehensive tests for scope definition workflow including:
- Session CRUD
- Scope items (in_scope, out_of_scope, deferred) CRUD
- Assumptions, Constraints, Deliverables CRUD
"""
import pytest
from contextlib import ExitStack
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.scope_definition import service
from app.models.scope_definition import (
    ScopeDefinitionSession,
    ScopeItem,
    ScopeAssumption,
    ScopeConstraint,
    ScopeDeliverable,
)


class TestScopeDefinitionSessionAPI:
    """Tests for session endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'generate_scope', mock_service.generate_scope),
            patch.object(service, 'list_sessions', mock_service.list_sessions),
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'delete_session', mock_service.delete_session),
            patch.object(service, 'get_scope_items', mock_service.get_scope_items),
            patch.object(service, 'get_assumptions', mock_service.get_assumptions),
            patch.object(service, 'get_constraints', mock_service.get_constraints),
            patch.object(service, 'get_deliverables', mock_service.get_deliverables),
            patch.object(service, 'create_scope_item', mock_service.create_scope_item),
            patch.object(service, 'update_scope_item', mock_service.update_scope_item),
            patch.object(service, 'delete_scope_item', mock_service.delete_scope_item),
            patch.object(service, 'create_assumption', mock_service.create_assumption),
            patch.object(service, 'update_assumption', mock_service.update_assumption),
            patch.object(service, 'delete_assumption', mock_service.delete_assumption),
            patch.object(service, 'create_constraint', mock_service.create_constraint),
            patch.object(service, 'update_constraint', mock_service.update_constraint),
            patch.object(service, 'delete_constraint', mock_service.delete_constraint),
            patch.object(service, 'create_deliverable', mock_service.create_deliverable),
            patch.object(service, 'update_deliverable', mock_service.update_deliverable),
            patch.object(service, 'delete_deliverable', mock_service.delete_deliverable),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_session_success(self, client, mock_service):
        """Test creating a new scope definition session"""
        mock_session = ScopeDefinitionSession(
            id=1,
            project_name="Customer Portal V2",
            product_vision="Build a self-service portal...",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/scope-definition/sessions",
            json={
                "projectName": "Customer Portal V2",
                "productVision": "Build a self-service portal that allows customers to manage their accounts, view usage, and resolve issues without contacting support.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projectName"] == "Customer Portal V2"
        assert data["status"] == "pending"

    def test_create_session_validation_min_length(self, client, mock_service):
        """Test validation: product vision too short"""
        response = client.post(
            "/api/scope-definition/sessions",
            json={
                "projectName": "Test",
                "productVision": "Too short",
            },
        )
        assert response.status_code == 422

    def test_list_sessions(self, client, mock_service):
        """Test listing scope definition sessions"""
        mock_sessions = [
            ScopeDefinitionSession(id=1, project_name="Project 1", product_vision="Vision 1", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            ScopeDefinitionSession(id=2, project_name="Project 2", product_vision="Vision 2", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/scope-definition/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_session(self, client, mock_service):
        """Test getting a specific session"""
        mock_session = ScopeDefinitionSession(
            id=1,
            project_name="Test Project",
            product_vision="Test vision",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/scope-definition/sessions/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["projectName"] == "Test Project"

    def test_get_session_not_found(self, client, mock_service):
        """Test getting non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/scope-definition/sessions/999")
        assert response.status_code == 404

    def test_get_session_full(self, client, mock_service):
        """Test getting session with all components"""
        mock_session = ScopeDefinitionSession(
            id=1,
            project_name="Test Project",
            product_vision="Test vision",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_items = [
            ScopeItem(id=1, session_id=1, title="Item 1", description="Desc", scope_type="in_scope", category="feature", created_at=datetime.utcnow()),
            ScopeItem(id=2, session_id=1, title="Item 2", description="Desc", scope_type="out_of_scope", category="feature", created_at=datetime.utcnow()),
        ]
        mock_assumptions = [ScopeAssumption(id=1, session_id=1, assumption="Test", risk_if_wrong="Risk", created_at=datetime.utcnow())]
        mock_constraints = [ScopeConstraint(id=1, session_id=1, constraint="Test", category="technical", impact="Impact", created_at=datetime.utcnow())]
        mock_deliverables = [ScopeDeliverable(id=1, session_id=1, name="Test", description="Desc", type="feature", created_at=datetime.utcnow())]

        mock_service.get_session.return_value = mock_session
        mock_service.get_scope_items.return_value = mock_items
        mock_service.get_assumptions.return_value = mock_assumptions
        mock_service.get_constraints.return_value = mock_constraints
        mock_service.get_deliverables.return_value = mock_deliverables

        response = client.get("/api/scope-definition/sessions/1/full")
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "in_scope_items" in data
        assert "out_of_scope_items" in data
        assert "deferred_items" in data
        assert "assumptions" in data
        assert "constraints" in data
        assert "deliverables" in data
        assert len(data["in_scope_items"]) == 1
        assert len(data["out_of_scope_items"]) == 1

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/scope-definition/sessions/1")
        assert response.status_code == 200

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/scope-definition/sessions/999")
        assert response.status_code == 404


class TestScopeItemAPI:
    """Tests for scope item CRUD endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_scope_items', mock_service.get_scope_items),
            patch.object(service, 'create_scope_item', mock_service.create_scope_item),
            patch.object(service, 'update_scope_item', mock_service.update_scope_item),
            patch.object(service, 'delete_scope_item', mock_service.delete_scope_item),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_scope_item(self, client, mock_service):
        """Test creating a new scope item"""
        mock_session = ScopeDefinitionSession(id=1, project_name="Test", product_vision="Test", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        mock_item = ScopeItem(
            id=1,
            session_id=1,
            title="User Authentication",
            description="Implement secure login",
            scope_type="in_scope",
            category="feature",
            priority="high",
            created_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session
        mock_service.create_scope_item.return_value = mock_item

        response = client.post(
            "/api/scope-definition/sessions/1/items",
            json={
                "title": "User Authentication",
                "description": "Implement secure login",
                "scopeType": "in_scope",
                "category": "feature",
                "priority": "high",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "User Authentication"
        assert data["scopeType"] == "in_scope"

    def test_get_scope_items(self, client, mock_service):
        """Test getting all scope items for a session"""
        mock_items = [
            ScopeItem(id=1, session_id=1, title="Item 1", description="Desc", scope_type="in_scope", category="feature", created_at=datetime.utcnow()),
            ScopeItem(id=2, session_id=1, title="Item 2", description="Desc", scope_type="out_of_scope", category="feature", created_at=datetime.utcnow()),
        ]
        mock_service.get_scope_items.return_value = mock_items

        response = client.get("/api/scope-definition/sessions/1/items")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_scope_item(self, client, mock_service):
        """Test updating a scope item"""
        mock_item = ScopeItem(
            id=1,
            session_id=1,
            title="Updated Title",
            description="Updated desc",
            scope_type="in_scope",
            category="feature",
            created_at=datetime.utcnow(),
        )
        mock_service.update_scope_item.return_value = mock_item

        response = client.patch(
            "/api/scope-definition/items/1",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    def test_update_scope_item_not_found(self, client, mock_service):
        """Test updating non-existent item"""
        mock_service.update_scope_item.return_value = None

        response = client.patch(
            "/api/scope-definition/items/999",
            json={"title": "Test"},
        )
        assert response.status_code == 404

    def test_delete_scope_item(self, client, mock_service):
        """Test deleting a scope item"""
        mock_service.delete_scope_item.return_value = True

        response = client.delete("/api/scope-definition/items/1")
        assert response.status_code == 200

    def test_delete_scope_item_not_found(self, client, mock_service):
        """Test deleting non-existent item"""
        mock_service.delete_scope_item.return_value = False

        response = client.delete("/api/scope-definition/items/999")
        assert response.status_code == 404


class TestAssumptionAPI:
    """Tests for assumption CRUD endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_assumptions', mock_service.get_assumptions),
            patch.object(service, 'create_assumption', mock_service.create_assumption),
            patch.object(service, 'update_assumption', mock_service.update_assumption),
            patch.object(service, 'delete_assumption', mock_service.delete_assumption),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_assumption(self, client, mock_service):
        """Test creating a new assumption"""
        mock_session = ScopeDefinitionSession(id=1, project_name="Test", product_vision="Test", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        mock_assumption = ScopeAssumption(
            id=1,
            session_id=1,
            assumption="Users have modern browsers",
            risk_if_wrong="May need fallback UI",
            created_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session
        mock_service.create_assumption.return_value = mock_assumption

        response = client.post(
            "/api/scope-definition/sessions/1/assumptions",
            json={
                "assumption": "Users have modern browsers",
                "riskIfWrong": "May need fallback UI",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assumption"] == "Users have modern browsers"

    def test_get_assumptions(self, client, mock_service):
        """Test getting all assumptions for a session"""
        mock_assumptions = [
            ScopeAssumption(id=1, session_id=1, assumption="Assumption 1", risk_if_wrong="Risk 1", created_at=datetime.utcnow()),
            ScopeAssumption(id=2, session_id=1, assumption="Assumption 2", risk_if_wrong="Risk 2", created_at=datetime.utcnow()),
        ]
        mock_service.get_assumptions.return_value = mock_assumptions

        response = client.get("/api/scope-definition/sessions/1/assumptions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_assumption(self, client, mock_service):
        """Test updating an assumption"""
        mock_assumption = ScopeAssumption(
            id=1,
            session_id=1,
            assumption="Updated assumption",
            risk_if_wrong="Updated risk",
            created_at=datetime.utcnow(),
        )
        mock_service.update_assumption.return_value = mock_assumption

        response = client.patch(
            "/api/scope-definition/assumptions/1",
            json={"assumption": "Updated assumption"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assumption"] == "Updated assumption"

    def test_delete_assumption(self, client, mock_service):
        """Test deleting an assumption"""
        mock_service.delete_assumption.return_value = True

        response = client.delete("/api/scope-definition/assumptions/1")
        assert response.status_code == 200


class TestConstraintAPI:
    """Tests for constraint CRUD endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_constraints', mock_service.get_constraints),
            patch.object(service, 'create_constraint', mock_service.create_constraint),
            patch.object(service, 'update_constraint', mock_service.update_constraint),
            patch.object(service, 'delete_constraint', mock_service.delete_constraint),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_constraint(self, client, mock_service):
        """Test creating a new constraint"""
        mock_session = ScopeDefinitionSession(id=1, project_name="Test", product_vision="Test", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        mock_constraint = ScopeConstraint(
            id=1,
            session_id=1,
            constraint="Must use existing auth",
            category="technical",
            impact="Limits custom auth flows",
            created_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session
        mock_service.create_constraint.return_value = mock_constraint

        response = client.post(
            "/api/scope-definition/sessions/1/constraints",
            json={
                "constraint": "Must use existing auth",
                "category": "technical",
                "impact": "Limits custom auth flows",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["constraint"] == "Must use existing auth"
        assert data["category"] == "technical"

    def test_get_constraints(self, client, mock_service):
        """Test getting all constraints for a session"""
        mock_constraints = [
            ScopeConstraint(id=1, session_id=1, constraint="Constraint 1", category="technical", impact="Impact 1", created_at=datetime.utcnow()),
            ScopeConstraint(id=2, session_id=1, constraint="Constraint 2", category="budget", impact="Impact 2", created_at=datetime.utcnow()),
        ]
        mock_service.get_constraints.return_value = mock_constraints

        response = client.get("/api/scope-definition/sessions/1/constraints")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_constraint(self, client, mock_service):
        """Test updating a constraint"""
        mock_constraint = ScopeConstraint(
            id=1,
            session_id=1,
            constraint="Updated constraint",
            category="budget",
            impact="Updated impact",
            created_at=datetime.utcnow(),
        )
        mock_service.update_constraint.return_value = mock_constraint

        response = client.patch(
            "/api/scope-definition/constraints/1",
            json={"constraint": "Updated constraint"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["constraint"] == "Updated constraint"

    def test_delete_constraint(self, client, mock_service):
        """Test deleting a constraint"""
        mock_service.delete_constraint.return_value = True

        response = client.delete("/api/scope-definition/constraints/1")
        assert response.status_code == 200


class TestDeliverableAPI:
    """Tests for deliverable CRUD endpoints"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_deliverables', mock_service.get_deliverables),
            patch.object(service, 'create_deliverable', mock_service.create_deliverable),
            patch.object(service, 'update_deliverable', mock_service.update_deliverable),
            patch.object(service, 'delete_deliverable', mock_service.delete_deliverable),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_deliverable(self, client, mock_service):
        """Test creating a new deliverable"""
        mock_session = ScopeDefinitionSession(id=1, project_name="Test", product_vision="Test", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        mock_deliverable = ScopeDeliverable(
            id=1,
            session_id=1,
            name="Auth Module",
            description="Complete login/logout",
            type="feature",
            acceptance_criteria=["Users can login", "SSO works"],
            created_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session
        mock_service.create_deliverable.return_value = mock_deliverable

        response = client.post(
            "/api/scope-definition/sessions/1/deliverables",
            json={
                "name": "Auth Module",
                "description": "Complete login/logout",
                "type": "feature",
                "acceptanceCriteria": ["Users can login", "SSO works"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Auth Module"
        assert data["type"] == "feature"

    def test_get_deliverables(self, client, mock_service):
        """Test getting all deliverables for a session"""
        mock_deliverables = [
            ScopeDeliverable(id=1, session_id=1, name="Deliverable 1", description="Desc 1", type="feature", created_at=datetime.utcnow()),
            ScopeDeliverable(id=2, session_id=1, name="Deliverable 2", description="Desc 2", type="document", created_at=datetime.utcnow()),
        ]
        mock_service.get_deliverables.return_value = mock_deliverables

        response = client.get("/api/scope-definition/sessions/1/deliverables")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_deliverable(self, client, mock_service):
        """Test updating a deliverable"""
        mock_deliverable = ScopeDeliverable(
            id=1,
            session_id=1,
            name="Updated name",
            description="Updated desc",
            type="feature",
            acceptance_criteria=["New criteria"],
            created_at=datetime.utcnow(),
        )
        mock_service.update_deliverable.return_value = mock_deliverable

        response = client.patch(
            "/api/scope-definition/deliverables/1",
            json={"name": "Updated name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated name"

    def test_delete_deliverable(self, client, mock_service):
        """Test deleting a deliverable"""
        mock_service.delete_deliverable.return_value = True

        response = client.delete("/api/scope-definition/deliverables/1")
        assert response.status_code == 200
