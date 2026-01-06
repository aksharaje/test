
import pytest
from app.models.defect_manager import CreateDefectSessionRequest, DefectSessionResponse
from app.models.release_readiness import CreateReadinessSessionRequest, ReadinessSessionResponse
from app.models.progress_tracker import CreateSessionRequest, SessionResponse
from datetime import datetime

class TestModelAliases:
    """Test that models correctly handle camelCase <-> snake_case conversion."""

    def test_defect_manager_aliases(self):
        """Test Defect Manager alias config."""
        # 1. Test Input (camelCase -> snake_case)
        camel_data = {
            "integrationId": 123,
            "projectFilter": "PROJ",
            "dateRangeStart": "2024-01-01T00:00:00"
        }
        model = CreateDefectSessionRequest.model_validate(camel_data)
        assert model.integration_id == 123
        assert model.project_filter == "PROJ"
        # 2. Test Output (snake_case -> camelCase)
        response_model = DefectSessionResponse(
            id=1,
            name="Test",
            integration_id=5,
            data_level=1,
            data_level_description="Basic",
            status="ready",
            progress_step=5,
            progress_total=5,
            progress_message="Done",
            error_message=None,
            analysis_snapshot={},
            last_analysis_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        json_output = response_model.model_dump(by_alias=True)
        assert "integrationId" in json_output
        assert "dataLevelDescription" in json_output
        assert json_output["integrationId"] == 5

    def test_release_readiness_aliases(self):
        """Test Release Readiness alias config."""
        # 1. Input
        camel_data = {
            "integrationId": 456,
            "releaseIdentifier": "v1.0",
            "projectKey": "KEY",
            "targetReleaseDate": "2024-12-31T00:00:00"
        }
        model = CreateReadinessSessionRequest.model_validate(camel_data)
        assert model.integration_id == 456
        assert model.release_identifier == "v1.0"
        assert model.target_release_date is not None
        
        # 2. Output
        response_model = ReadinessSessionResponse(
            id=2,
            name="Rel",
            integration_id=8,
            release_identifier="v2.0",
            release_type="fixVersion",
            status="pending",
            progress_step=0,
            progress_total=6,
            progress_message=None,
            error_message=None,
            readiness_score=None,
            max_possible_score=100,
            confidence_level="low",
            recommendation="pending",
            recommendation_details={},
            component_scores={},
            last_assessment_at=None,
            target_release_date=None,
            created_at=datetime.utcnow()
        )
        json_output = response_model.model_dump(by_alias=True)
        assert "releaseIdentifier" in json_output
        assert "maxPossibleScore" in json_output

    def test_progress_tracker_aliases(self):
        """Test Progress Tracker alias config."""
        # 1. Input
        camel_data = {
            "integrationId": 789,
            "templateId": "scrum",
            "sprintFilter": {"sprintIds": [1, 2]},
            "blockerConfig": {"enabled": True}
        }
        model = CreateSessionRequest.model_validate(camel_data)
        assert model.integration_id == 789
        assert model.template_id == "scrum"
        assert model.sprint_filter == {"sprintIds": [1, 2]}
        
        # 2. Output
        response_model = SessionResponse(
            id=3,
            name="Sprint 1",
            integration_id=789,
            template_id="scrum",
            sprint_filter={},
            blocker_config={},
            sync_config={},
            status="draft",
            progress_step=0,
            progress_total=1,
            progress_message=None,
            error_message=None,
            metrics_snapshot={},
            last_sync_at=None,
            items_synced=0,
            blockers_detected=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        json_output = response_model.model_dump(by_alias=True)
        assert "templateId" in json_output
        assert "blockerConfig" in json_output
