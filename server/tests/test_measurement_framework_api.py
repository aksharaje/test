"""
Tests for Measurement Framework API Endpoints

Comprehensive tests for measurement framework workflow including:
- Session CRUD
- Framework metrics
- Data sources
- Dashboards
- Knowledge base integration
"""
import pytest
from contextlib import ExitStack
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime

from app.main import app
from app.api.api_v1.endpoints.measurement_framework import service
from app.models.measurement_framework import (
    MeasurementFrameworkSession,
    FrameworkMetric,
    FrameworkDataSource,
    FrameworkDashboard,
)


class TestMeasurementFrameworkSessionAPI:
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
            patch.object(service, 'generate_framework', mock_service.generate_framework),
            patch.object(service, 'list_sessions', mock_service.list_sessions),
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'delete_session', mock_service.delete_session),
            patch.object(service, 'get_metrics', mock_service.get_metrics),
            patch.object(service, 'get_data_sources', mock_service.get_data_sources),
            patch.object(service, 'get_dashboards', mock_service.get_dashboards),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_create_session_success(self, client, mock_service):
        """Test creating a new measurement framework session"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Login Success Framework",
            objectives_description="Track and measure login success rate",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "Login Success Framework",
                "objectivesDescription": "Track and measure login success rate, authentication latency, and support ticket volume to improve user activation and reduce friction.",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Login Success Framework"
        assert data["status"] == "pending"
        assert "id" in data

    def test_create_session_validation_min_length(self, client, mock_service):
        """Test validation: objectives description too short"""
        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "Test",
                "objectivesDescription": "Too short",
            },
        )
        assert response.status_code == 422

    def test_create_session_with_okr_link(self, client, mock_service):
        """Test creating session linked to OKR session"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="OKR-Linked Framework",
            objectives_description="Track metrics aligned with our quarterly OKRs",
            okr_session_id=1,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "OKR-Linked Framework",
                "objectivesDescription": "Track metrics aligned with our quarterly OKRs for user activation and engagement improvement.",
                "okrSessionId": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["okrSessionId"] == 1

    def test_create_session_with_data_sources(self, client, mock_service):
        """Test creating session with existing data sources"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Data-Aware Framework",
            objectives_description="Track metrics using our existing analytics infrastructure",
            existing_data_sources="PostgreSQL analytics DB, Mixpanel events, Stripe webhooks",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "Data-Aware Framework",
                "objectivesDescription": "Track metrics using our existing analytics infrastructure including database and API sources.",
                "existingDataSources": "PostgreSQL analytics DB, Mixpanel events, Stripe webhooks",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "PostgreSQL" in data["existingDataSources"]

    def test_create_session_with_knowledge_bases(self, client, mock_service):
        """Test creating session with knowledge base IDs for context"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="KB-Enhanced Framework",
            objectives_description="Build a measurement framework using existing analytics documentation",
            knowledge_base_ids=[1, 2, 3],
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "KB-Enhanced Framework",
                "objectivesDescription": "Build a measurement framework using existing analytics documentation and best practices from our knowledge base.",
                "knowledgeBaseIds": [1, 2, 3],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "KB-Enhanced Framework"
        # knowledgeBaseIds is stored but may not be returned in response model

    def test_create_session_with_all_fields(self, client, mock_service):
        """Test creating session with all optional fields"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Complete Framework",
            objectives_description="Comprehensive measurement framework",
            okr_session_id=1,
            existing_data_sources="PostgreSQL, Mixpanel, Stripe",
            reporting_requirements="Weekly executive dashboard, monthly board report",
            stakeholder_audience="Executive team, Product managers, Engineering leads",
            knowledge_base_ids=[1, 2],
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "Complete Framework",
                "objectivesDescription": "Comprehensive measurement framework tracking user activation, engagement, and retention metrics for Q1 goals.",
                "okrSessionId": 1,
                "existingDataSources": "PostgreSQL, Mixpanel, Stripe",
                "reportingRequirements": "Weekly executive dashboard, monthly board report",
                "stakeholderAudience": "Executive team, Product managers, Engineering leads",
                "knowledgeBaseIds": [1, 2],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Complete Framework"
        assert data["existingDataSources"] == "PostgreSQL, Mixpanel, Stripe"
        assert data["reportingRequirements"] == "Weekly executive dashboard, monthly board report"
        assert data["stakeholderAudience"] == "Executive team, Product managers, Engineering leads"

    def test_list_sessions(self, client, mock_service):
        """Test listing measurement framework sessions"""
        mock_sessions = [
            MeasurementFrameworkSession(id=1, name="Framework 1", objectives_description="Obj 1", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            MeasurementFrameworkSession(id=2, name="Framework 2", objectives_description="Obj 2", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            MeasurementFrameworkSession(id=3, name="Framework 3", objectives_description="Obj 3", status="failed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/measurement-framework/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_sessions_with_pagination(self, client, mock_service):
        """Test listing sessions with pagination"""
        mock_sessions = [
            MeasurementFrameworkSession(id=1, name="Framework 1", objectives_description="Obj 1", status="completed", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            MeasurementFrameworkSession(id=2, name="Framework 2", objectives_description="Obj 2", status="pending", created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        ]
        mock_service.list_sessions.return_value = mock_sessions

        response = client.get("/api/measurement-framework/sessions?skip=0&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_session(self, client, mock_service):
        """Test getting a specific session"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Test Framework",
            objectives_description="Test objectives",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.get("/api/measurement-framework/sessions/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["name"] == "Test Framework"

    def test_get_session_not_found(self, client, mock_service):
        """Test getting non-existent session"""
        mock_service.get_session.return_value = None

        response = client.get("/api/measurement-framework/sessions/999")
        assert response.status_code == 404

    def test_get_session_full(self, client, mock_service):
        """Test getting session with all framework components"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Test Framework",
            objectives_description="Test objectives",
            status="completed",
            executive_summary="Framework summary",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_metrics = [
            FrameworkMetric(id=1, session_id=1, name="Login Success Rate", description="Success rate", category="outcome", metric_type="quantitative", data_type="percentage", unit="%", display_order=0, created_at=datetime.utcnow()),
        ]
        mock_data_sources = [
            FrameworkDataSource(id=1, session_id=1, name="Auth Service API", source_type="api", description="Auth metrics", display_order=0, created_at=datetime.utcnow()),
        ]
        mock_dashboards = [
            FrameworkDashboard(id=1, session_id=1, name="Executive Auth Dashboard", description="High-level metrics", audience="executive", display_order=0, created_at=datetime.utcnow()),
        ]

        mock_service.get_session.return_value = mock_session
        mock_service.get_metrics.return_value = mock_metrics
        mock_service.get_data_sources.return_value = mock_data_sources
        mock_service.get_dashboards.return_value = mock_dashboards

        response = client.get("/api/measurement-framework/sessions/1/full")
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "metrics" in data
        assert "data_sources" in data
        assert "dashboards" in data

    def test_delete_session(self, client, mock_service):
        """Test deleting a session"""
        mock_service.delete_session.return_value = True

        response = client.delete("/api/measurement-framework/sessions/1")
        assert response.status_code == 200

    def test_delete_session_not_found(self, client, mock_service):
        """Test deleting non-existent session"""
        mock_service.delete_session.return_value = False

        response = client.delete("/api/measurement-framework/sessions/999")
        assert response.status_code == 404

    def test_retry_session(self, client, mock_service):
        """Test retrying a failed session"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Test Framework",
            objectives_description="Test objectives",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session

        response = client.post("/api/measurement-framework/sessions/1/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"


class TestFrameworkDataRetrieval:
    """Tests for retrieving framework components"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_metrics', mock_service.get_metrics),
            patch.object(service, 'get_data_sources', mock_service.get_data_sources),
            patch.object(service, 'get_dashboards', mock_service.get_dashboards),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_get_metrics(self, client, mock_service):
        """Test getting metrics for a session"""
        mock_metrics = [
            FrameworkMetric(id=1, session_id=1, name="Login Success Rate", description="Percentage of successful login attempts", category="outcome", metric_type="quantitative", data_type="percentage", formula="successful_logins / total_logins * 100", unit="%", target="95%", collection_method="automated", collection_frequency="real-time", display_order=0, created_at=datetime.utcnow()),
            FrameworkMetric(id=2, session_id=1, name="Auth Latency", description="Average authentication response time", category="output", metric_type="quantitative", data_type="count", unit="ms", target="<200ms", collection_method="automated", collection_frequency="real-time", display_order=1, created_at=datetime.utcnow()),
        ]
        mock_service.get_metrics.return_value = mock_metrics

        response = client.get("/api/measurement-framework/sessions/1/metrics")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Login Success Rate"
        assert data[0]["category"] == "outcome"

    def test_get_data_sources(self, client, mock_service):
        """Test getting data sources for a session"""
        mock_sources = [
            FrameworkDataSource(id=1, session_id=1, name="Auth Service API", source_type="api", description="Authentication service metrics endpoint", refresh_frequency="real-time", reliability_score="high", display_order=0, created_at=datetime.utcnow()),
        ]
        mock_service.get_data_sources.return_value = mock_sources

        response = client.get("/api/measurement-framework/sessions/1/data-sources")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Auth Service API"
        assert data[0]["sourceType"] == "api"

    def test_get_dashboards(self, client, mock_service):
        """Test getting dashboards for a session"""
        mock_dashboards = [
            FrameworkDashboard(id=1, session_id=1, name="Executive Auth Dashboard", description="High-level authentication health metrics", audience="executive", purpose="strategic", key_metrics=["Login Success Rate", "Auth Latency"], refresh_frequency="daily", recommended_tool="PowerBI", display_order=0, created_at=datetime.utcnow()),
        ]
        mock_service.get_dashboards.return_value = mock_dashboards

        response = client.get("/api/measurement-framework/sessions/1/dashboards")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Executive Auth Dashboard"
        assert data[0]["audience"] == "executive"

    def test_get_full_session_with_components(self, client, mock_service):
        """Test getting full session includes all components"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="Complete Framework",
            objectives_description="Track user activation metrics",
            status="completed",
            executive_summary="Framework summary",
            framework_overview="Overview of the framework",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_metrics = [
            FrameworkMetric(id=1, session_id=1, name="Metric 1", description="Desc", category="outcome", metric_type="quantitative", data_type="percentage", display_order=0, created_at=datetime.utcnow()),
            FrameworkMetric(id=2, session_id=1, name="Metric 2", description="Desc", category="output", metric_type="quantitative", data_type="count", display_order=1, created_at=datetime.utcnow()),
        ]
        mock_sources = [
            FrameworkDataSource(id=1, session_id=1, name="Source 1", source_type="api", display_order=0, created_at=datetime.utcnow()),
        ]
        mock_dashboards = [
            FrameworkDashboard(id=1, session_id=1, name="Dashboard 1", description="Desc", audience="executive", display_order=0, created_at=datetime.utcnow()),
        ]

        mock_service.get_session.return_value = mock_session
        mock_service.get_metrics.return_value = mock_metrics
        mock_service.get_data_sources.return_value = mock_sources
        mock_service.get_dashboards.return_value = mock_dashboards

        response = client.get("/api/measurement-framework/sessions/1/full")
        assert response.status_code == 200
        data = response.json()

        # Verify session data
        assert data["session"]["name"] == "Complete Framework"
        assert data["session"]["status"] == "completed"
        assert data["session"]["executiveSummary"] == "Framework summary"

        # Verify metrics
        assert len(data["metrics"]) == 2

        # Verify data sources
        assert len(data["data_sources"]) == 1

        # Verify dashboards
        assert len(data["dashboards"]) == 1


class TestMeasurementFrameworkIntegration:
    """Integration tests for complete workflows"""

    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        return MagicMock()

    @pytest.fixture
    def client(self, mock_service):
        """Create test client with mocked service"""
        patches = [
            patch.object(service, 'create_session', mock_service.create_session),
            patch.object(service, 'generate_framework', mock_service.generate_framework),
            patch.object(service, 'get_session', mock_service.get_session),
            patch.object(service, 'get_metrics', mock_service.get_metrics),
            patch.object(service, 'get_data_sources', mock_service.get_data_sources),
            patch.object(service, 'get_dashboards', mock_service.get_dashboards),
        ]
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app)

    def test_full_framework_workflow(self, client, mock_service):
        """Test complete measurement framework workflow"""
        # Setup mocks for create
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="User Activation Framework",
            objectives_description="Track and measure user activation funnel metrics",
            existing_data_sources="PostgreSQL analytics, Mixpanel events",
            reporting_requirements="Weekly team dashboard, monthly board report",
            stakeholder_audience="Product team, Executive leadership",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        # 1. Create session with all inputs
        session_response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "User Activation Framework",
                "objectivesDescription": "Track and measure user activation funnel metrics including signup completion, first action, and 7-day retention.",
                "existingDataSources": "PostgreSQL analytics, Mixpanel events",
                "reportingRequirements": "Weekly team dashboard, monthly board report",
                "stakeholderAudience": "Product team, Executive leadership",
            },
        )
        assert session_response.status_code == 200
        assert session_response.json()["status"] == "pending"

        # Setup mocks for get
        mock_session_completed = MeasurementFrameworkSession(
            id=1,
            name="User Activation Framework",
            objectives_description="Track and measure user activation funnel metrics",
            status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.get_session.return_value = mock_session_completed
        mock_service.get_metrics.return_value = []
        mock_service.get_data_sources.return_value = []
        mock_service.get_dashboards.return_value = []

        # 2. Get full session to check structure
        full_response = client.get("/api/measurement-framework/sessions/1/full")
        assert full_response.status_code == 200
        data = full_response.json()

        # Verify structure exists
        assert "session" in data
        assert "metrics" in data
        assert "data_sources" in data
        assert "dashboards" in data

    def test_session_with_knowledge_base_context(self, client, mock_service):
        """Test session creation with knowledge base IDs"""
        mock_session = MeasurementFrameworkSession(
            id=1,
            name="KB-Enhanced Analytics Framework",
            objectives_description="Build measurement framework informed by our existing analytics documentation",
            knowledge_base_ids=[1, 2],
            existing_data_sources="See knowledge base for current data infrastructure",
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_service.create_session.return_value = mock_session

        response = client.post(
            "/api/measurement-framework/sessions",
            json={
                "name": "KB-Enhanced Analytics Framework",
                "objectivesDescription": "Build measurement framework informed by our existing analytics documentation and measurement best practices.",
                "knowledgeBaseIds": [1, 2],
                "existingDataSources": "See knowledge base for current data infrastructure",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "KB-Enhanced Analytics Framework"
        # knowledgeBaseIds is stored but may not be returned in response model

    def test_multiple_sessions_different_purposes(self, client, mock_service):
        """Test creating sessions for different measurement purposes"""
        purposes = [
            ("Product Metrics", "Track product usage, feature adoption, and user engagement metrics."),
            ("Business Metrics", "Track revenue, conversion rates, and customer lifetime value metrics."),
            ("Technical Metrics", "Track system performance, uptime, and error rates for infrastructure."),
        ]

        for idx, (name, description) in enumerate(purposes):
            mock_session = MeasurementFrameworkSession(
                id=idx + 1,
                name=name,
                objectives_description=description,
                status="pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            mock_service.create_session.return_value = mock_session

            response = client.post(
                "/api/measurement-framework/sessions",
                json={
                    "name": name,
                    "objectivesDescription": description,
                },
            )
            assert response.status_code == 200
            assert response.json()["name"] == name
