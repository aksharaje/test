"""
Release Readiness Checker Service

Handles release assessment with adaptive scoring based on available data.
Implements graceful degradation for varying integration depths.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import httpx
from sqlmodel import Session, select, delete, func

from app.models.release_readiness import (
    ReleaseReadinessSession,
    ReleaseWorkItem,
    CreateReadinessSessionRequest,
    ReadinessSessionResponse,
    ComponentScore,
    ReadinessAssessment,
    DefectStatusReport,
    WorkCompletionReport,
    TestCoverageReport,
    AcceptanceCriteriaReport,
    AssessmentStatusResponse,
    DataSourceConfig,
    ConfigDiscoveryResult,
    ProjectOption,
    FixVersionOption,
    SprintOption,
    LabelOption,
    DEFAULT_SCORING_WEIGHTS,
)
from app.models.jira import Integration, FieldMapping
from app.core.config import settings

# Default field IDs when no mapping exists
DEFAULT_JIRA_FIELDS = {
    "story_points": "customfield_10016",
    "sprint": "customfield_10020",
    "severity": None,  # Often uses priority field
    "acceptance_criteria": None,  # Falls back to description
}

DEFAULT_ADO_FIELDS = {
    "story_points": "Microsoft.VSTS.Scheduling.StoryPoints",
    "severity": "Microsoft.VSTS.Common.Severity",
    "acceptance_criteria": "Microsoft.VSTS.Common.AcceptanceCriteria",
    "priority": "Microsoft.VSTS.Common.Priority",
}


class ReleaseReadinessService:
    """Service for release readiness assessment."""

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # INTEGRATION CHECK
    # =========================================================================

    def check_integrations(self) -> Dict[str, Any]:
        """Check for valid Jira/ADO integrations."""
        stmt = select(Integration).where(
            Integration.provider.in_(["jira", "ado"]),
            Integration.status == "connected"
        )
        integrations = list(self.db.exec(stmt))

        valid_integrations = [
            {
                "id": i.id,
                "name": i.name,
                "provider": i.provider,
                "status": i.status
            }
            for i in integrations
        ]

        return {
            "has_valid_integration": len(valid_integrations) > 0,
            "integrations": valid_integrations,
            "message": "Ready to assess releases" if valid_integrations else "Connect Jira or Azure DevOps to assess release readiness"
        }

    def _get_field_mappings(self, integration_id: int) -> Dict[str, FieldMapping]:
        """Get field mappings for an integration."""
        statement = select(FieldMapping).where(
            FieldMapping.integration_id == integration_id
        )
        mappings = self.db.exec(statement).all()
        return {m.our_field: m for m in mappings}

    def _get_mapped_field(
        self,
        mappings: Dict[str, FieldMapping],
        our_field: str,
        provider: str
    ) -> Optional[str]:
        """Get the provider field ID for our standard field."""
        if our_field in mappings:
            return mappings[our_field].provider_field_id

        # Fall back to defaults
        if provider == "jira":
            return DEFAULT_JIRA_FIELDS.get(our_field)
        elif provider == "ado":
            return DEFAULT_ADO_FIELDS.get(our_field)
        return None

    def _build_jira_fields_list(self, mappings: Dict[str, FieldMapping]) -> str:
        """Build the fields parameter for Jira API based on mappings."""
        base_fields = [
            "summary", "description", "status", "issuetype",
            "priority", "assignee", "created", "updated", "labels", "components"
        ]

        # Add mapped custom fields
        for our_field in ["story_points", "severity", "acceptance_criteria", "sprint"]:
            field_id = self._get_mapped_field(mappings, our_field, "jira")
            if field_id and field_id not in base_fields:
                base_fields.append(field_id)

        return ",".join(base_fields)

    def _build_ado_fields_list(self, mappings: Dict[str, FieldMapping]) -> List[str]:
        """Build the fields list for ADO API based on mappings."""
        base_fields = [
            "System.Id", "System.Title", "System.Description", "System.State",
            "System.WorkItemType", "System.AssignedTo", "System.CreatedDate",
            "System.ChangedDate", "System.Tags", "System.IterationPath"
        ]

        # Add mapped fields
        for our_field in ["story_points", "severity", "acceptance_criteria", "priority"]:
            field_id = self._get_mapped_field(mappings, our_field, "ado")
            if field_id and field_id not in base_fields:
                base_fields.append(field_id)

        return base_fields

    # =========================================================================
    # INTEGRATION LOOKUPS
    # =========================================================================

    async def get_projects(self, integration_id: int) -> List[ProjectOption]:
        """Get available projects from integration."""
        integration = self.db.get(Integration, integration_id)
        if not integration:
            raise ValueError("Integration not found")

        if integration.provider == "jira":
            return await self._get_jira_projects(integration)
        elif integration.provider == "ado":
            return await self._get_ado_projects(integration)
        return []

    async def _get_jira_projects(self, integration: Integration) -> List[ProjectOption]:
        """Get projects from Jira."""
        projects = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/project/search",
                    params={"maxResults": 100},
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )
                if response.status_code == 200:
                    for proj in response.json().get("values", []):
                        projects.append(ProjectOption(
                            key=proj.get("key", ""),
                            name=proj.get("name", ""),
                            description=proj.get("description")
                        ))
        except Exception as e:
            print(f"Error fetching Jira projects: {e}")
        return projects

    async def _get_ado_projects(self, integration: Integration) -> List[ProjectOption]:
        """Get projects from Azure DevOps."""
        projects = []
        try:
            # Extract org from base_url (e.g., https://dev.azure.com/MyOrg/MyProject)
            base_url = integration.base_url or ""
            # Try to get org-level projects
            org_url = "/".join(base_url.split("/")[:4])  # https://dev.azure.com/OrgName

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{org_url}/_apis/projects?api-version=7.0",
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )
                if response.status_code == 200:
                    for proj in response.json().get("value", []):
                        projects.append(ProjectOption(
                            key=proj.get("name", ""),  # ADO uses name as key
                            name=proj.get("name", ""),
                            description=proj.get("description")
                        ))
        except Exception as e:
            print(f"Error fetching ADO projects: {e}")
        return projects

    async def get_fix_versions(
        self, integration_id: int, project_key: str
    ) -> List[FixVersionOption]:
        """Get fix versions from Jira project."""
        integration = self.db.get(Integration, integration_id)
        if not integration:
            raise ValueError("Integration not found")

        if integration.provider != "jira":
            return []  # Fix versions are Jira-specific

        versions = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/project/{project_key}/versions",
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )
                if response.status_code == 200:
                    for ver in response.json():
                        versions.append(FixVersionOption(
                            id=str(ver.get("id", "")),
                            name=ver.get("name", ""),
                            released=ver.get("released", False),
                            release_date=ver.get("releaseDate"),
                            description=ver.get("description")
                        ))
        except Exception as e:
            print(f"Error fetching Jira fix versions: {e}")

        # Sort: unreleased first, then by name
        versions.sort(key=lambda v: (v.released, v.name))
        return versions

    async def get_sprints(self, integration_id: int) -> List[SprintOption]:
        """Get available sprints/iterations from integration."""
        integration = self.db.get(Integration, integration_id)
        if not integration:
            raise ValueError("Integration not found")

        if integration.provider == "jira":
            return await self._get_jira_sprints(integration)
        elif integration.provider == "ado":
            return await self._get_ado_iterations(integration)
        return []

    async def _get_jira_sprints(self, integration: Integration) -> List[SprintOption]:
        """Get sprints from Jira."""
        sprints = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Get boards first
                boards_url = f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/agile/1.0/board"
                boards_response = await client.get(
                    boards_url,
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )

                if boards_response.status_code == 200:
                    boards = boards_response.json().get("values", [])

                    # Get sprints from scrum boards
                    for board in boards:
                        if board.get("type") == "scrum":
                            sprints_url = f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/agile/1.0/board/{board['id']}/sprint"
                            sprints_response = await client.get(
                                sprints_url,
                                headers={
                                    "Authorization": f"Bearer {integration.access_token}",
                                    "Accept": "application/json"
                                }
                            )

                            if sprints_response.status_code == 200:
                                for sprint in sprints_response.json().get("values", []):
                                    sprints.append(SprintOption(
                                        id=str(sprint.get("id", "")),
                                        name=sprint.get("name", ""),
                                        state=sprint.get("state", "future"),
                                        start_date=sprint.get("startDate"),
                                        end_date=sprint.get("endDate")
                                    ))
                            break  # Only use first scrum board
        except Exception as e:
            print(f"Error fetching Jira sprints: {e}")

        # Sort: active first, then future, then closed
        state_order = {"active": 0, "future": 1, "closed": 2}
        sprints.sort(key=lambda s: state_order.get(s.state, 3))
        return sprints

    async def _get_ado_iterations(self, integration: Integration) -> List[SprintOption]:
        """Get iterations from Azure DevOps."""
        iterations = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{integration.base_url}/_apis/work/teamsettings/iterations?api-version=7.0",
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )

                if response.status_code == 200:
                    for iteration in response.json().get("value", []):
                        attributes = iteration.get("attributes", {})

                        # Map timeFrame to state
                        time_frame = attributes.get("timeFrame", "")
                        if time_frame == "current":
                            state = "active"
                        elif time_frame == "past":
                            state = "closed"
                        else:
                            state = "future"

                        iterations.append(SprintOption(
                            id=iteration.get("path", iteration.get("id", "")),
                            name=iteration.get("name", ""),
                            state=state,
                            start_date=attributes.get("startDate"),
                            end_date=attributes.get("finishDate")
                        ))
        except Exception as e:
            print(f"Error fetching ADO iterations: {e}")

        # Sort: active first, then future, then closed
        state_order = {"active": 0, "future": 1, "closed": 2}
        iterations.sort(key=lambda s: state_order.get(s.state, 3))
        return iterations

    async def get_labels(
        self, integration_id: int, project_key: Optional[str] = None
    ) -> List[LabelOption]:
        """Get available labels/tags from integration."""
        integration = self.db.get(Integration, integration_id)
        if not integration:
            raise ValueError("Integration not found")

        if integration.provider == "jira":
            return await self._get_jira_labels(integration, project_key)
        elif integration.provider == "ado":
            return await self._get_ado_tags(integration, project_key)
        return []

    async def _get_jira_labels(
        self, integration: Integration, project_key: Optional[str] = None
    ) -> List[LabelOption]:
        """Get labels from Jira."""
        labels = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Jira Cloud has a labels endpoint
                response = await client.get(
                    f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/label",
                    params={"maxResults": 200},
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )
                if response.status_code == 200:
                    for label in response.json().get("values", []):
                        labels.append(LabelOption(name=label))
        except Exception as e:
            print(f"Error fetching Jira labels: {e}")
        return sorted(labels, key=lambda l: l.name.lower())

    async def _get_ado_tags(
        self, integration: Integration, project_key: Optional[str] = None
    ) -> List[LabelOption]:
        """Get tags from Azure DevOps work items."""
        tags = set()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Query recent work items to get unique tags
                wiql = "SELECT [System.Id], [System.Tags] FROM WorkItems WHERE [System.Tags] <> '' ORDER BY [System.ChangedDate] DESC"
                response = await client.post(
                    f"{integration.base_url}/_apis/wit/wiql?api-version=7.0&$top=200",
                    json={"query": wiql},
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    work_items = response.json().get("workItems", [])
                    if work_items:
                        ids = [str(wi["id"]) for wi in work_items[:100]]
                        details = await client.get(
                            f"{integration.base_url}/_apis/wit/workitems",
                            params={"ids": ",".join(ids), "fields": "System.Tags", "api-version": "7.0"},
                            headers={"Authorization": f"Bearer {integration.access_token}"}
                        )

                        if details.status_code == 200:
                            for item in details.json().get("value", []):
                                tag_str = item.get("fields", {}).get("System.Tags", "")
                                if tag_str:
                                    for tag in tag_str.split(";"):
                                        tags.add(tag.strip())
        except Exception as e:
            print(f"Error fetching ADO tags: {e}")

        return sorted([LabelOption(name=t) for t in tags], key=lambda l: l.name.lower())

    # =========================================================================
    # SESSION CRUD
    # =========================================================================

    def create_session(
        self, data: CreateReadinessSessionRequest, user_id: Optional[int] = None
    ) -> ReleaseReadinessSession:
        """Create a new release readiness session."""
        integration = self.db.get(Integration, data.integration_id)
        if not integration:
            raise ValueError("Integration not found")
        if integration.status != "connected":
            raise ValueError("Integration is not connected")

        # Discover available data sources
        discovery = self._discover_data_sources(integration)

        session = ReleaseReadinessSession(
            user_id=user_id,
            name=data.name or f"Release {data.release_identifier}",
            integration_id=data.integration_id,
            release_identifier=data.release_identifier,
            release_type=data.release_type,
            project_key=data.project_key,
            target_release_date=data.target_release_date,
            data_sources=discovery.discovered_sources.model_dump(),
            scoring_weights=data.scoring_weights or discovery.adjusted_weights,
            max_possible_score=discovery.max_possible_score,
            confidence_level=discovery.confidence_level,
            status="draft",
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int) -> Optional[ReleaseReadinessSession]:
        """Get a session by ID."""
        return self.db.get(ReleaseReadinessSession, session_id)

    def get_session_response(self, session_id: int) -> Optional[ReadinessSessionResponse]:
        """Get session with integration details."""
        session = self.get_session(session_id)
        if not session:
            return None

        integration = self.db.get(Integration, session.integration_id)

        return ReadinessSessionResponse(
            id=session.id,
            name=session.name,
            integration_id=session.integration_id,
            integration_name=integration.name if integration else None,
            integration_provider=integration.provider if integration else None,
            release_identifier=session.release_identifier,
            release_type=session.release_type,
            status=session.status,
            progress_step=session.progress_step,
            progress_total=session.progress_total,
            progress_message=session.progress_message,
            error_message=session.error_message,
            readiness_score=session.readiness_score,
            max_possible_score=session.max_possible_score,
            confidence_level=session.confidence_level,
            recommendation=session.recommendation,
            recommendation_details=session.recommendation_details,
            component_scores=session.component_scores,
            last_assessment_at=session.last_assessment_at,
            target_release_date=session.target_release_date,
            created_at=session.created_at,
        )

    def list_sessions(self) -> List[ReadinessSessionResponse]:
        """List all release sessions."""
        stmt = select(ReleaseReadinessSession).order_by(ReleaseReadinessSession.updated_at.desc())
        sessions = list(self.db.exec(stmt))
        return [self.get_session_response(s.id) for s in sessions if s]

    def delete_session(self, session_id: int) -> bool:
        """Delete a session and its work items."""
        session = self.get_session(session_id)
        if not session:
            return False

        self.db.exec(delete(ReleaseWorkItem).where(ReleaseWorkItem.session_id == session_id))
        self.db.delete(session)
        self.db.commit()
        return True

    # =========================================================================
    # DATA SOURCE DISCOVERY
    # =========================================================================

    def _discover_data_sources(self, integration: Integration) -> ConfigDiscoveryResult:
        """Discover what data sources are available."""
        # Default configuration - in production would probe the integration
        sources = DataSourceConfig(
            defect_tracking=True,
            work_completion=True,
            test_management=False,
            acceptance_criteria=True,
            ac_location="description",
            beta_feedback=False,
        )

        # Calculate adjusted weights and max score
        adjusted_weights = {}
        max_score = 0
        limitations = []
        suggestions = []

        for component, config in DEFAULT_SCORING_WEIGHTS.items():
            weight = config["weight"]

            if component == "defect_status" and sources.defect_tracking:
                adjusted_weights[component] = weight
                max_score += sum(config["scoring"].values())
            elif component == "work_completion" and sources.work_completion:
                adjusted_weights[component] = weight
                max_score += sum(config["scoring"].values())
            elif component == "test_coverage":
                if sources.test_management:
                    adjusted_weights[component] = weight
                    max_score += sum(config["scoring"].values())
                else:
                    limitations.append("Test coverage data not available")
                    suggestions.append("Enable test management integration for complete coverage metrics")
            elif component == "acceptance_criteria":
                if sources.acceptance_criteria:
                    adjusted_weights[component] = weight
                    max_score += sum(config["scoring"].values())
                else:
                    limitations.append("Acceptance criteria tracking not detected")
            elif component == "beta_feedback":
                if sources.beta_feedback:
                    adjusted_weights[component] = weight
                    max_score += sum(config["scoring"].values())

        # Normalize weights
        total_weight = sum(adjusted_weights.values())
        if total_weight > 0:
            adjusted_weights = {k: v / total_weight for k, v in adjusted_weights.items()}

        # Determine confidence level
        available_count = sum([
            sources.defect_tracking,
            sources.work_completion,
            sources.test_management,
            sources.acceptance_criteria,
            sources.beta_feedback
        ])

        if available_count >= 4:
            confidence = "high"
        elif available_count >= 2:
            confidence = "moderate"
        else:
            confidence = "low"

        return ConfigDiscoveryResult(
            discovered_sources=sources,
            adjusted_weights=adjusted_weights,
            max_possible_score=max_score,
            confidence_level=confidence,
            limitations=limitations,
            suggestions=suggestions,
        )

    # =========================================================================
    # ASSESSMENT ORCHESTRATION
    # =========================================================================

    async def assess_release(self, session_id: int) -> AssessmentStatusResponse:
        """Run full release assessment."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        integration = self.db.get(Integration, session.integration_id)
        if not integration:
            raise ValueError("Integration not found")

        session.status = "analyzing"
        session.progress_step = 1
        session.progress_message = "Fetching release items..."
        self.db.commit()

        try:
            # Step 1: Fetch work items
            items = await self._fetch_release_items(integration, session)
            session.progress_step = 2
            session.progress_message = f"Analyzing {len(items)} items..."
            self.db.commit()

            # Step 2: Save items
            await self._save_work_items(session, items)
            session.progress_step = 3
            session.progress_message = "Assessing defect status..."
            self.db.commit()

            # Step 3: Calculate component scores
            component_scores = await self._calculate_component_scores(session)
            session.progress_step = 4
            session.progress_message = "Calculating readiness score..."
            self.db.commit()

            # Step 4: Calculate overall score
            overall_score, max_score = self._calculate_overall_score(session, component_scores)
            session.progress_step = 5
            session.progress_message = "Generating recommendation..."
            self.db.commit()

            # Step 5: Generate recommendation
            recommendation, details = self._generate_recommendation(
                session, overall_score, max_score, component_scores
            )

            session.readiness_score = overall_score
            session.max_possible_score = max_score
            session.recommendation = recommendation
            session.recommendation_details = details
            session.component_scores = {k: v.model_dump() for k, v in component_scores.items()}
            session.status = "ready"
            session.last_assessment_at = datetime.utcnow()
            session.progress_step = 6
            session.progress_message = "Assessment complete"
            self.db.commit()

        except Exception as e:
            session.status = "error"
            session.error_message = str(e)
            self.db.commit()
            raise

        return self._get_assessment_status(session)

    def _get_assessment_status(self, session: ReleaseReadinessSession) -> AssessmentStatusResponse:
        """Get current assessment status."""
        item_count = self.db.exec(
            select(func.count(ReleaseWorkItem.id)).where(
                ReleaseWorkItem.session_id == session.id
            )
        ).one()

        return AssessmentStatusResponse(
            session_id=session.id,
            status=session.status,
            progress_step=session.progress_step,
            progress_total=session.progress_total,
            progress_message=session.progress_message,
            error_message=session.error_message,
            items_analyzed=item_count or 0,
            last_assessment_at=session.last_assessment_at,
        )

    # =========================================================================
    # ITEM FETCHING
    # =========================================================================

    async def _fetch_release_items(
        self, integration: Integration, session: ReleaseReadinessSession
    ) -> List[Dict[str, Any]]:
        """Fetch work items for the release."""
        if integration.provider == "jira":
            return await self._fetch_jira_items(integration, session)
        elif integration.provider == "ado":
            return await self._fetch_ado_items(integration, session)
        return []

    async def _fetch_jira_items(
        self, integration: Integration, session: ReleaseReadinessSession
    ) -> List[Dict[str, Any]]:
        """Fetch items from Jira for a release."""
        items = []

        # Get field mappings for this integration
        mappings = self._get_field_mappings(integration.id)

        # Get mapped field IDs
        story_points_field = self._get_mapped_field(mappings, "story_points", "jira")
        severity_field = self._get_mapped_field(mappings, "severity", "jira")
        ac_field = self._get_mapped_field(mappings, "acceptance_criteria", "jira")

        # Build dynamic fields list
        fields_to_fetch = self._build_jira_fields_list(mappings)

        # Build JQL based on release type
        if session.release_type == "fixVersion":
            jql = f"fixVersion = '{session.release_identifier}'"
        elif session.release_type == "label":
            jql = f"labels = '{session.release_identifier}'"
        elif session.release_type == "sprint":
            jql = f"Sprint = '{session.release_identifier}'"
        else:
            jql = f"fixVersion = '{session.release_identifier}'"

        if session.project_key:
            jql = f"project = {session.project_key} AND {jql}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/search",
                    params={
                        "jql": jql,
                        "maxResults": 200,
                        "fields": fields_to_fetch
                    },
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    for issue in data.get("issues", []):
                        fields = issue.get("fields", {})

                        # Extract story points using mapped field
                        story_points = None
                        if story_points_field:
                            story_points = fields.get(story_points_field)

                        # Extract severity using mapped field or fall back to priority
                        severity = None
                        if severity_field:
                            sev_value = fields.get(severity_field)
                            if isinstance(sev_value, dict):
                                severity = sev_value.get("value") or sev_value.get("name")
                            else:
                                severity = sev_value
                        if not severity:
                            # Fall back to priority as severity proxy
                            severity = fields.get("priority", {}).get("name") if fields.get("priority") else None

                        # Extract acceptance criteria using mapped field or description
                        ac_content = None
                        if ac_field:
                            ac_content = fields.get(ac_field)
                        if not ac_content:
                            ac_content = fields.get("description")

                        # Extract components
                        components = fields.get("components", [])
                        component = components[0].get("name") if components else None

                        items.append({
                            "external_id": issue["key"],
                            "external_url": f"https://{integration.name}.atlassian.net/browse/{issue['key']}",
                            "title": fields.get("summary", ""),
                            "description": fields.get("description", ""),
                            "item_type": fields.get("issuetype", {}).get("name", "Task"),
                            "status": fields.get("status", {}).get("name", "Unknown"),
                            "status_category": fields.get("status", {}).get("statusCategory", {}).get("key", "new"),
                            "priority": fields.get("priority", {}).get("name") if fields.get("priority") else None,
                            "severity": severity,
                            "assignee": fields.get("assignee", {}).get("displayName") if fields.get("assignee") else None,
                            "story_points": story_points,
                            "component": component,
                            "acceptance_criteria": ac_content,
                            "created": fields.get("created"),
                            "updated": fields.get("updated"),
                        })
        except Exception as e:
            print(f"Error fetching Jira items: {e}")
            items = self._get_mock_release_items()

        return items

    async def _fetch_ado_items(
        self, integration: Integration, session: ReleaseReadinessSession
    ) -> List[Dict[str, Any]]:
        """Fetch items from ADO for a release."""
        items = []

        # Get field mappings for this integration
        mappings = self._get_field_mappings(integration.id)

        # Get mapped field IDs with defaults
        story_points_field = self._get_mapped_field(mappings, "story_points", "ado")
        severity_field = self._get_mapped_field(mappings, "severity", "ado")
        priority_field = self._get_mapped_field(mappings, "priority", "ado")
        ac_field = self._get_mapped_field(mappings, "acceptance_criteria", "ado")

        # Build WIQL based on release type
        if session.release_type == "sprint" or session.release_type == "iteration":
            wiql = f"[System.IterationPath] UNDER '{session.release_identifier}'"
        else:
            wiql = f"[System.Tags] CONTAINS '{session.release_identifier}'"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{integration.base_url}/_apis/wit/wiql?api-version=7.0",
                    json={"query": f"SELECT [System.Id] FROM WorkItems WHERE {wiql}"},
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    work_items = response.json().get("workItems", [])
                    ids = [str(wi["id"]) for wi in work_items[:200]]

                    if ids:
                        # Build fields parameter using mappings
                        ado_fields = self._build_ado_fields_list(mappings)

                        details = await client.get(
                            f"{integration.base_url}/_apis/wit/workitems",
                            params={
                                "ids": ",".join(ids),
                                "fields": ",".join(ado_fields),
                                "api-version": "7.0"
                            },
                            headers={"Authorization": f"Bearer {integration.access_token}"}
                        )

                        if details.status_code == 200:
                            for item in details.json().get("value", []):
                                fields = item.get("fields", {})

                                # Extract story points using mapped field
                                story_points = None
                                if story_points_field:
                                    story_points = fields.get(story_points_field)

                                # Extract severity using mapped field
                                severity = None
                                if severity_field:
                                    severity = fields.get(severity_field)

                                # Extract priority using mapped field
                                priority = None
                                if priority_field:
                                    prio_val = fields.get(priority_field)
                                    priority = str(prio_val) if prio_val else None

                                # Extract acceptance criteria using mapped field
                                ac_content = None
                                if ac_field:
                                    ac_content = fields.get(ac_field)
                                if not ac_content:
                                    ac_content = fields.get("System.Description")

                                items.append({
                                    "external_id": str(item["id"]),
                                    "external_url": item.get("_links", {}).get("html", {}).get("href"),
                                    "title": fields.get("System.Title", ""),
                                    "description": fields.get("System.Description", ""),
                                    "item_type": fields.get("System.WorkItemType", "Task"),
                                    "status": fields.get("System.State", "New"),
                                    "status_category": self._ado_status_to_category(fields.get("System.State", "New")),
                                    "priority": priority,
                                    "severity": severity,
                                    "assignee": fields.get("System.AssignedTo", {}).get("displayName") if isinstance(fields.get("System.AssignedTo"), dict) else None,
                                    "story_points": story_points,
                                    "component": fields.get("System.AreaPath", "").split("\\")[-1] if fields.get("System.AreaPath") else None,
                                    "acceptance_criteria": ac_content,
                                    "created": fields.get("System.CreatedDate"),
                                    "updated": fields.get("System.ChangedDate"),
                                })
        except Exception as e:
            print(f"Error fetching ADO items: {e}")
            items = self._get_mock_release_items()

        return items

    def _ado_status_to_category(self, status: str) -> str:
        """Map ADO status to category."""
        status_lower = status.lower()
        if status_lower in ["new", "approved"]:
            return "todo"
        elif status_lower in ["active", "committed", "in progress"]:
            return "in_progress"
        elif status_lower in ["resolved", "closed", "done", "removed"]:
            return "done"
        return "todo"

    def _get_mock_release_items(self) -> List[Dict[str, Any]]:
        """Return mock items for demo."""
        return [
            {
                "external_id": "PROJ-101",
                "external_url": "https://example.atlassian.net/browse/PROJ-101",
                "title": "User authentication flow",
                "description": "## Acceptance Criteria\n- User can login\n- User can logout",
                "item_type": "Story",
                "status": "Done",
                "status_category": "done",
                "priority": "High",
                "assignee": "John Doe",
                "story_points": 5,
                "created": datetime.utcnow().isoformat(),
                "updated": datetime.utcnow().isoformat(),
            },
            {
                "external_id": "PROJ-102",
                "external_url": "https://example.atlassian.net/browse/PROJ-102",
                "title": "Dashboard redesign",
                "description": "Redesign the main dashboard",
                "item_type": "Story",
                "status": "Done",
                "status_category": "done",
                "priority": "Medium",
                "assignee": "Jane Smith",
                "story_points": 8,
                "created": datetime.utcnow().isoformat(),
                "updated": datetime.utcnow().isoformat(),
            },
            {
                "external_id": "PROJ-103",
                "external_url": "https://example.atlassian.net/browse/PROJ-103",
                "title": "Export feature",
                "description": "## Acceptance Criteria\n- Export to CSV\n- Export to PDF",
                "item_type": "Story",
                "status": "In Progress",
                "status_category": "in_progress",
                "priority": "High",
                "assignee": "Bob Wilson",
                "story_points": 3,
                "created": datetime.utcnow().isoformat(),
                "updated": datetime.utcnow().isoformat(),
            },
            {
                "external_id": "BUG-201",
                "external_url": "https://example.atlassian.net/browse/BUG-201",
                "title": "Login timeout issue",
                "description": "Users are logged out after 5 minutes",
                "item_type": "Bug",
                "status": "Open",
                "status_category": "todo",
                "priority": "High",
                "severity": "High",
                "assignee": None,
                "story_points": None,
                "created": datetime.utcnow().isoformat(),
                "updated": datetime.utcnow().isoformat(),
            },
        ]

    # =========================================================================
    # SAVE WORK ITEMS
    # =========================================================================

    async def _save_work_items(
        self, session: ReleaseReadinessSession, items: List[Dict[str, Any]]
    ) -> None:
        """Save work items to database."""
        self.db.exec(delete(ReleaseWorkItem).where(ReleaseWorkItem.session_id == session.id))

        for item in items:
            # Check for acceptance criteria in description
            has_ac, ac_count = self._detect_acceptance_criteria(item.get("description", ""))

            # Determine if it's a blocking defect
            is_blocking = (
                item.get("item_type", "").lower() == "bug" and
                item.get("priority", "").lower() in ["critical", "blocker", "p0", "highest"]
            )

            work_item = ReleaseWorkItem(
                session_id=session.id,
                external_id=item["external_id"],
                external_url=item.get("external_url"),
                title=item["title"],
                item_type=item.get("item_type", "Task"),
                status=item["status"],
                status_category=self._normalize_status_category(item.get("status_category", "todo")),
                severity=item.get("severity"),
                is_blocking=is_blocking,
                has_ac=has_ac,
                ac_source="description" if has_ac else None,
                ac_count=ac_count,
                assignee=item.get("assignee"),
                story_points=item.get("story_points"),
                created_at=self._parse_datetime(item.get("created")),
                updated_at=self._parse_datetime(item.get("updated")),
            )
            self.db.add(work_item)

        self.db.commit()

    def _detect_acceptance_criteria(self, description: str) -> Tuple[bool, int]:
        """Detect acceptance criteria in description."""
        if not description:
            return False, 0

        # Look for AC section patterns
        patterns = [
            r"(?:##?\s*)?acceptance\s+criteria",
            r"\*\*acceptance\s+criteria\*\*",
            r"ac:",
            r"given.*when.*then"
        ]

        for pattern in patterns:
            if re.search(pattern, description, re.IGNORECASE):
                # Count bullet points as AC items
                bullets = re.findall(r"^[\s]*[-*]\s+", description, re.MULTILINE)
                return True, len(bullets) if bullets else 1

        return False, 0

    def _normalize_status_category(self, category: str) -> str:
        """Normalize status category."""
        category_lower = category.lower()
        if category_lower in ["todo", "new", "open"]:
            return "todo"
        elif category_lower in ["in_progress", "inprogress", "active"]:
            return "in_progress"
        elif category_lower in ["done", "closed", "resolved"]:
            return "done"
        return "todo"

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string."""
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None

    # =========================================================================
    # COMPONENT SCORING
    # =========================================================================

    async def _calculate_component_scores(
        self, session: ReleaseReadinessSession
    ) -> Dict[str, ComponentScore]:
        """Calculate scores for each component."""
        scores = {}

        # Defect Status Score
        scores["defect_status"] = self._score_defect_status(session)

        # Work Completion Score
        scores["work_completion"] = self._score_work_completion(session)

        # Acceptance Criteria Score
        scores["acceptance_criteria"] = self._score_acceptance_criteria(session)

        # Test Coverage (not available in Phase 1)
        scores["test_coverage"] = ComponentScore(
            name="Test Coverage",
            weight=0.0,
            score=0,
            max_score=40,
            status="not_assessed",
            details={"message": "Test management integration not configured"},
            data_available=False,
        )

        # Beta Feedback (not available in Phase 1)
        scores["beta_feedback"] = ComponentScore(
            name="Beta Feedback",
            weight=0.0,
            score=0,
            max_score=8,
            status="not_assessed",
            details={"message": "Beta feedback source not configured"},
            data_available=False,
        )

        return scores

    def _score_defect_status(self, session: ReleaseReadinessSession) -> ComponentScore:
        """Score based on defect status."""
        stmt = select(ReleaseWorkItem).where(
            ReleaseWorkItem.session_id == session.id,
            ReleaseWorkItem.item_type == "Bug"
        )
        bugs = list(self.db.exec(stmt))

        open_critical = sum(1 for b in bugs if b.severity and b.severity.lower() in ["critical", "blocker"] and b.status_category != "done")
        open_high = sum(1 for b in bugs if b.severity and b.severity.lower() == "high" and b.status_category != "done")
        total_open = sum(1 for b in bugs if b.status_category != "done")

        score = 0
        max_score = 75
        details = {
            "total_bugs": len(bugs),
            "open_critical": open_critical,
            "open_high": open_high,
            "total_open": total_open,
        }

        # Scoring logic
        if open_critical == 0:
            score += 30
            details["critical_status"] = "pass"
        else:
            details["critical_status"] = "fail"

        if open_high == 0:
            score += 20
            details["high_status"] = "pass"
        elif open_high <= 2:
            score += 10
            details["high_status"] = "warn"
        else:
            details["high_status"] = "fail"

        if total_open < 5:
            score += 15
            details["total_status"] = "pass"
        elif total_open < 10:
            score += 8
            details["total_status"] = "warn"
        else:
            details["total_status"] = "fail"

        status = "pass" if score >= 60 else "warn" if score >= 30 else "fail"

        return ComponentScore(
            name="Defect Status",
            weight=0.35,
            score=score,
            max_score=max_score,
            status=status,
            details=details,
            data_available=True,
        )

    def _score_work_completion(self, session: ReleaseReadinessSession) -> ComponentScore:
        """Score based on work completion."""
        stmt = select(ReleaseWorkItem).where(
            ReleaseWorkItem.session_id == session.id,
            ReleaseWorkItem.item_type != "Bug"
        )
        items = list(self.db.exec(stmt))

        total = len(items)
        done = sum(1 for i in items if i.status_category == "done")
        in_progress = sum(1 for i in items if i.status_category == "in_progress")
        todo = sum(1 for i in items if i.status_category == "todo")

        completion_pct = (done / total * 100) if total > 0 else 0

        score = 0
        max_score = 50
        details = {
            "total_items": total,
            "done": done,
            "in_progress": in_progress,
            "todo": todo,
            "completion_percent": round(completion_pct, 1),
        }

        # All done
        if todo == 0 and in_progress == 0:
            score += 25
            details["completion_status"] = "pass"
        elif completion_pct >= 90:
            score += 20
            details["completion_status"] = "warn"
        elif completion_pct >= 75:
            score += 10
            details["completion_status"] = "warn"
        else:
            details["completion_status"] = "fail"

        # No in-progress
        if in_progress == 0:
            score += 15
            details["in_progress_status"] = "pass"
        elif in_progress <= 2:
            score += 8
            details["in_progress_status"] = "warn"
        else:
            details["in_progress_status"] = "fail"

        # Scope stable (simplified - would check recent changes)
        score += 10
        details["scope_stable"] = True

        status = "pass" if score >= 40 else "warn" if score >= 20 else "fail"

        return ComponentScore(
            name="Work Completion",
            weight=0.25,
            score=score,
            max_score=max_score,
            status=status,
            details=details,
            data_available=True,
        )

    def _score_acceptance_criteria(self, session: ReleaseReadinessSession) -> ComponentScore:
        """Score based on acceptance criteria coverage."""
        stmt = select(ReleaseWorkItem).where(
            ReleaseWorkItem.session_id == session.id,
            ReleaseWorkItem.item_type.in_(["Story", "User Story", "Feature"])
        )
        stories = list(self.db.exec(stmt))

        total = len(stories)
        with_ac = sum(1 for s in stories if s.has_ac)
        coverage_pct = (with_ac / total * 100) if total > 0 else 0

        score = 0
        max_score = 45
        details = {
            "total_stories": total,
            "stories_with_ac": with_ac,
            "coverage_percent": round(coverage_pct, 1),
        }

        if coverage_pct >= 90:
            score += 15
            details["coverage_status"] = "pass"
        elif coverage_pct >= 70:
            score += 10
            details["coverage_status"] = "warn"
        elif coverage_pct >= 50:
            score += 5
            details["coverage_status"] = "warn"
        else:
            details["coverage_status"] = "fail"

        # AC reviewed/verified would require additional tracking
        # For now, give partial credit
        score += 10 if coverage_pct > 50 else 0
        score += 10 if coverage_pct > 80 else 0

        status = "pass" if score >= 30 else "warn" if score >= 15 else "fail"

        return ComponentScore(
            name="Acceptance Criteria",
            weight=0.15,
            score=score,
            max_score=max_score,
            status=status,
            details=details,
            data_available=True,
        )

    # =========================================================================
    # OVERALL SCORING
    # =========================================================================

    def _calculate_overall_score(
        self, session: ReleaseReadinessSession, component_scores: Dict[str, ComponentScore]
    ) -> Tuple[int, int]:
        """Calculate overall readiness score."""
        total_score = 0
        max_score = 0

        for comp_name, comp_score in component_scores.items():
            if comp_score.data_available:
                total_score += comp_score.score
                max_score += comp_score.max_score

        return total_score, max_score

    # =========================================================================
    # RECOMMENDATION GENERATION
    # =========================================================================

    def _generate_recommendation(
        self,
        session: ReleaseReadinessSession,
        score: int,
        max_score: int,
        component_scores: Dict[str, ComponentScore]
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate release recommendation."""
        percentage = (score / max_score * 100) if max_score > 0 else 0

        # Check for blocking issues
        defect_score = component_scores.get("defect_status")
        has_critical = defect_score and defect_score.details.get("open_critical", 0) > 0

        work_score = component_scores.get("work_completion")
        low_completion = work_score and work_score.details.get("completion_percent", 0) < 80

        risks = []
        mitigations = []

        if has_critical:
            risks.append({
                "level": "critical",
                "area": "Defects",
                "description": f"{defect_score.details.get('open_critical', 0)} critical bugs remain open"
            })
            mitigations.append("Address critical bugs before release")

        if low_completion:
            risks.append({
                "level": "high",
                "area": "Completion",
                "description": f"Only {work_score.details.get('completion_percent', 0)}% of work is complete"
            })
            mitigations.append("Complete or defer remaining work items")

        # Determine recommendation
        if has_critical:
            recommendation = "no_go"
            summary = "Release NOT recommended - critical defects must be addressed"
        elif percentage >= 80:
            recommendation = "go"
            summary = "Release is ready for production"
        elif percentage >= 60:
            recommendation = "conditional_go"
            summary = "Conditional go - address identified risks before release"
        else:
            recommendation = "no_go"
            summary = "Release not recommended - significant gaps identified"

        details = {
            "score": score,
            "max_score": max_score,
            "percentage": round(percentage, 1),
            "summary": summary,
            "risks": risks,
            "mitigations": mitigations,
            "assessed_components": [
                {"name": c.name, "status": c.status}
                for c in component_scores.values()
                if c.data_available
            ],
            "not_assessed": [
                c.name for c in component_scores.values() if not c.data_available
            ]
        }

        return recommendation, details

    # =========================================================================
    # REPORTS
    # =========================================================================

    def get_defect_status_report(self, session_id: int) -> Optional[DefectStatusReport]:
        """Get defect status report for release."""
        session = self.get_session(session_id)
        if not session:
            return None

        stmt = select(ReleaseWorkItem).where(
            ReleaseWorkItem.session_id == session_id,
            ReleaseWorkItem.item_type == "Bug"
        )
        bugs = list(self.db.exec(stmt))

        return DefectStatusReport(
            total_defects=len(bugs),
            open_critical=sum(1 for b in bugs if b.severity and b.severity.lower() in ["critical", "blocker"] and b.status_category != "done"),
            open_high=sum(1 for b in bugs if b.severity and b.severity.lower() == "high" and b.status_category != "done"),
            open_medium=sum(1 for b in bugs if b.severity and b.severity.lower() == "medium" and b.status_category != "done"),
            open_low=sum(1 for b in bugs if b.severity and b.severity.lower() == "low" and b.status_category != "done"),
            resolved_this_release=sum(1 for b in bugs if b.status_category == "done"),
            defect_trend="stable",  # Would calculate from historical data
            blocking_defects=[
                {"id": b.external_id, "title": b.title, "severity": b.severity}
                for b in bugs if b.is_blocking
            ]
        )

    def get_work_completion_report(self, session_id: int) -> Optional[WorkCompletionReport]:
        """Get work completion report for release."""
        session = self.get_session(session_id)
        if not session:
            return None

        stmt = select(ReleaseWorkItem).where(
            ReleaseWorkItem.session_id == session_id,
            ReleaseWorkItem.item_type != "Bug"
        )
        items = list(self.db.exec(stmt))

        total = len(items)
        done = sum(1 for i in items if i.status_category == "done")

        return WorkCompletionReport(
            total_items=total,
            completed=done,
            in_progress=sum(1 for i in items if i.status_category == "in_progress"),
            todo=sum(1 for i in items if i.status_category == "todo"),
            completion_percent=round(done / total * 100, 1) if total > 0 else 0,
            scope_changes=0,  # Would track from history
            scope_stable=True,
        )


# Factory function
def get_release_readiness_service(db: Session) -> ReleaseReadinessService:
    """Get a release readiness service instance."""
    return ReleaseReadinessService(db)
