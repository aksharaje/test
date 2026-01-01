"""
Progress & Blocker Tracker Service

Handles sprint data sync, blocker detection, and metrics computation.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import httpx
from sqlmodel import Session, select, delete

from app.models.progress_tracker import (
    ProgressTrackerSession,
    TrackedWorkItem,
    TRACKER_TEMPLATES,
    CreateSessionRequest,
    UpdateSessionRequest,
    SessionResponse,
    MetricsResponse,
    BlockersResponse,
    BlockerSummary,
    SyncStatusResponse,
    IntegrationCheckResponse,
    SprintOption,
    TemplateInfo,
)
from app.models.jira import Integration, FieldMapping
from app.core.config import settings


class ProgressTrackerService:
    """Service for progress tracking and blocker detection."""

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # SESSION CRUD
    # =========================================================================

    def create_session(
        self, data: CreateSessionRequest, user_id: Optional[int] = None
    ) -> ProgressTrackerSession:
        """Create a new tracker session."""
        # Validate integration exists and is connected
        integration = self.db.get(Integration, data.integration_id)
        if not integration:
            raise ValueError("Integration not found")
        if integration.status != "connected":
            raise ValueError("Integration is not connected")

        # Validate template
        if data.template_id not in TRACKER_TEMPLATES:
            raise ValueError(f"Unknown template: {data.template_id}")

        # Get template defaults for blocker config
        template = TRACKER_TEMPLATES[data.template_id]
        blocker_config = data.blocker_config or template.get("blocker_signals", {})

        session = ProgressTrackerSession(
            user_id=user_id,
            name=data.name,
            integration_id=data.integration_id,
            template_id=data.template_id,
            sprint_filter=data.sprint_filter,
            blocker_config=blocker_config,
            status="draft",
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int) -> Optional[ProgressTrackerSession]:
        """Get a tracker session by ID."""
        return self.db.get(ProgressTrackerSession, session_id)

    def get_session_response(self, session_id: int) -> Optional[SessionResponse]:
        """Get a tracker session with integration details."""
        session = self.get_session(session_id)
        if not session:
            return None

        integration = self.db.get(Integration, session.integration_id)

        return SessionResponse(
            id=session.id,
            name=session.name,
            integration_id=session.integration_id,
            integration_name=integration.name if integration else None,
            integration_provider=integration.provider if integration else None,
            template_id=session.template_id,
            sprint_filter=session.sprint_filter,
            blocker_config=session.blocker_config,
            sync_config=session.sync_config,
            status=session.status,
            progress_step=session.progress_step,
            progress_total=session.progress_total,
            progress_message=session.progress_message,
            error_message=session.error_message,
            metrics_snapshot=session.metrics_snapshot,
            last_sync_at=session.last_sync_at,
            items_synced=session.items_synced,
            blockers_detected=session.blockers_detected,
            created_at=session.created_at,
            updated_at=session.updated_at,
        )

    def list_sessions(self, user_id: Optional[int] = None) -> List[SessionResponse]:
        """List all tracker sessions, optionally filtered by user."""
        statement = select(ProgressTrackerSession).order_by(
            ProgressTrackerSession.updated_at.desc()
        )
        if user_id:
            statement = statement.where(ProgressTrackerSession.user_id == user_id)

        sessions = self.db.exec(statement).all()
        result = []

        for session in sessions:
            integration = self.db.get(Integration, session.integration_id)
            result.append(
                SessionResponse(
                    id=session.id,
                    name=session.name,
                    integration_id=session.integration_id,
                    integration_name=integration.name if integration else None,
                    integration_provider=integration.provider if integration else None,
                    template_id=session.template_id,
                    sprint_filter=session.sprint_filter,
                    blocker_config=session.blocker_config,
                    sync_config=session.sync_config,
                    status=session.status,
                    progress_step=session.progress_step,
                    progress_total=session.progress_total,
                    progress_message=session.progress_message,
                    error_message=session.error_message,
                    metrics_snapshot=session.metrics_snapshot,
                    last_sync_at=session.last_sync_at,
                    items_synced=session.items_synced,
                    blockers_detected=session.blockers_detected,
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                )
            )

        return result

    def update_session(
        self, session_id: int, data: UpdateSessionRequest
    ) -> Optional[ProgressTrackerSession]:
        """Update a tracker session."""
        session = self.get_session(session_id)
        if not session:
            return None

        if data.name is not None:
            session.name = data.name
        if data.template_id is not None:
            if data.template_id not in TRACKER_TEMPLATES:
                raise ValueError(f"Unknown template: {data.template_id}")
            session.template_id = data.template_id
        if data.sprint_filter is not None:
            session.sprint_filter = data.sprint_filter
        if data.blocker_config is not None:
            session.blocker_config = data.blocker_config
        if data.sync_config is not None:
            session.sync_config = data.sync_config

        session.updated_at = datetime.utcnow()
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete_session(self, session_id: int) -> bool:
        """Delete a tracker session and its items."""
        session = self.get_session(session_id)
        if not session:
            return False

        # Delete tracked items first
        self.db.exec(
            delete(TrackedWorkItem).where(TrackedWorkItem.session_id == session_id)
        )

        self.db.delete(session)
        self.db.commit()
        return True

    # =========================================================================
    # INTEGRATION CHECKS
    # =========================================================================

    def check_integrations(self) -> IntegrationCheckResponse:
        """Check if user has valid Jira or ADO integrations."""
        statement = select(Integration).where(
            Integration.provider.in_(["jira", "ado"]),
            Integration.status == "connected",
        )
        integrations = self.db.exec(statement).all()

        if not integrations:
            return IntegrationCheckResponse(
                has_valid_integration=False,
                integrations=[],
                message="No connected Jira or Azure DevOps integrations found. Please connect an integration first.",
            )

        return IntegrationCheckResponse(
            has_valid_integration=True,
            integrations=[
                {
                    "id": i.id,
                    "name": i.name,
                    "provider": i.provider,
                    "status": i.status,
                }
                for i in integrations
            ],
            message=f"Found {len(integrations)} connected integration(s).",
        )

    # =========================================================================
    # TEMPLATES
    # =========================================================================

    def get_templates(self, provider: Optional[str] = None) -> List[TemplateInfo]:
        """Get available templates, optionally filtered by provider."""
        templates = []
        for template_id, template in TRACKER_TEMPLATES.items():
            if provider and template["provider"] not in [provider, "any"]:
                continue

            templates.append(
                TemplateInfo(
                    id=template_id,
                    name=template["name"],
                    description=template["description"],
                    provider=template["provider"],
                    estimation_field=template.get("estimation_field"),
                    blocker_signals=list(template.get("blocker_signals", {}).keys()),
                )
            )

        return templates

    # =========================================================================
    # DATA SYNC
    # =========================================================================

    async def sync_session(self, session_id: int) -> SyncStatusResponse:
        """Sync data from the integration for a session."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        integration = self.db.get(Integration, session.integration_id)
        if not integration:
            raise ValueError("Integration not found")

        # Update status to syncing
        session.status = "syncing"
        session.progress_step = 1
        session.progress_message = "Fetching data from integration..."
        session.error_message = None
        self.db.add(session)
        self.db.commit()

        try:
            # Fetch items from integration
            if integration.provider == "jira":
                items = await self._fetch_jira_items(integration, session)
            elif integration.provider == "ado":
                items = await self._fetch_ado_items(integration, session)
            else:
                raise ValueError(f"Unsupported provider: {integration.provider}")

            # Update progress
            session.progress_step = 2
            session.progress_message = f"Analyzing {len(items)} items..."
            self.db.add(session)
            self.db.commit()

            # Clear old items and store new ones
            self.db.exec(
                delete(TrackedWorkItem).where(TrackedWorkItem.session_id == session_id)
            )

            # Process and detect blockers for each item
            template = TRACKER_TEMPLATES.get(session.template_id, TRACKER_TEMPLATES["basic"])
            blocker_config = session.blocker_config or template.get("blocker_signals", {})

            blocked_count = 0
            for item_data in items:
                item = self._create_tracked_item(session, item_data, template)
                item = self._detect_blockers(item, blocker_config)
                if item.is_blocked:
                    blocked_count += 1
                self.db.add(item)

            # Update progress
            session.progress_step = 3
            session.progress_message = "Computing metrics..."
            self.db.add(session)
            self.db.commit()

            # Compute and cache metrics
            metrics = self._compute_metrics(session_id, template)
            session.metrics_snapshot = metrics.model_dump()

            # Finalize
            session.status = "ready"
            session.progress_message = None
            session.last_sync_at = datetime.utcnow()
            session.items_synced = len(items)
            session.blockers_detected = blocked_count
            session.updated_at = datetime.utcnow()
            self.db.add(session)
            self.db.commit()

            return SyncStatusResponse(
                session_id=session_id,
                status=session.status,
                progress_step=session.progress_step,
                progress_total=session.progress_total,
                progress_message=session.progress_message,
                error_message=None,
                items_synced=len(items),
                last_sync_at=session.last_sync_at,
            )

        except Exception as e:
            session.status = "error"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            self.db.add(session)
            self.db.commit()

            return SyncStatusResponse(
                session_id=session_id,
                status=session.status,
                progress_step=session.progress_step,
                progress_total=session.progress_total,
                progress_message=session.progress_message,
                error_message=str(e),
                items_synced=0,
                last_sync_at=session.last_sync_at,
            )

    async def _fetch_jira_items(
        self, integration: Integration, session: ProgressTrackerSession
    ) -> List[Dict[str, Any]]:
        """Fetch work items from Jira."""
        # Get field mappings for this integration
        mappings = self._get_field_mappings(integration.id)

        # Build JQL query
        jql_parts = []

        # Sprint filter
        sprint_filter = session.sprint_filter
        if sprint_filter.get("sprint_ids"):
            sprint_names = sprint_filter["sprint_ids"]
            sprint_jql = " OR ".join([f'Sprint = "{s}"' for s in sprint_names])
            jql_parts.append(f"({sprint_jql})")
        elif sprint_filter.get("active_sprint"):
            jql_parts.append("Sprint in openSprints()")

        # Default to active sprint if no filter
        if not jql_parts:
            jql_parts.append("Sprint in openSprints()")

        jql = " AND ".join(jql_parts)

        # Fetch from Jira API
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {integration.access_token}",
                "Accept": "application/json",
            }

            # Get issues
            search_url = f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/search"
            params = {
                "jql": jql,
                "maxResults": 200,
                "fields": "*all",
                "expand": "changelog",
            }

            response = await client.get(search_url, headers=headers, params=params)

            if response.status_code != 200:
                raise ValueError(f"Jira API error: {response.text}")

            data = response.json()
            issues = data.get("issues", [])

            # Transform to our format
            items = []
            for issue in issues:
                item = self._transform_jira_issue(issue, mappings)
                items.append(item)

            return items

    async def _fetch_ado_items(
        self, integration: Integration, session: ProgressTrackerSession
    ) -> List[Dict[str, Any]]:
        """Fetch work items from Azure DevOps."""
        # Get field mappings
        mappings = self._get_field_mappings(integration.id)

        # Build WIQL query
        sprint_filter = session.sprint_filter
        iteration_path = sprint_filter.get("iteration_path", "")

        wiql = """
        SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType],
               [System.AssignedTo], [System.Tags], [Microsoft.VSTS.Scheduling.StoryPoints],
               [System.IterationPath], [System.ChangedDate]
        FROM WorkItems
        WHERE [System.TeamProject] = @project
        """

        if iteration_path:
            wiql += f" AND [System.IterationPath] UNDER '{iteration_path}'"

        # ADO API call
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {integration.access_token}",
                "Content-Type": "application/json",
            }

            # Query for work item IDs
            query_url = f"{integration.base_url}/_apis/wit/wiql?api-version=7.0"
            response = await client.post(
                query_url,
                headers=headers,
                json={"query": wiql},
            )

            if response.status_code != 200:
                raise ValueError(f"ADO API error: {response.text}")

            query_result = response.json()
            work_item_ids = [wi["id"] for wi in query_result.get("workItems", [])]

            if not work_item_ids:
                return []

            # Fetch full work items (batched)
            items = []
            batch_size = 200
            for i in range(0, len(work_item_ids), batch_size):
                batch_ids = work_item_ids[i : i + batch_size]
                ids_param = ",".join(map(str, batch_ids))

                items_url = f"{integration.base_url}/_apis/wit/workitems?ids={ids_param}&$expand=relations&api-version=7.0"
                items_response = await client.get(items_url, headers=headers)

                if items_response.status_code != 200:
                    continue

                work_items = items_response.json().get("value", [])
                for wi in work_items:
                    item = self._transform_ado_work_item(wi, mappings, integration.base_url)
                    items.append(item)

            return items

    def _get_field_mappings(self, integration_id: int) -> Dict[str, FieldMapping]:
        """Get field mappings for an integration as a dict."""
        statement = select(FieldMapping).where(
            FieldMapping.integration_id == integration_id
        )
        mappings = self.db.exec(statement).all()
        return {m.our_field: m for m in mappings}

    def _transform_jira_issue(
        self, issue: Dict[str, Any], mappings: Dict[str, FieldMapping]
    ) -> Dict[str, Any]:
        """Transform a Jira issue to our internal format."""
        fields = issue.get("fields", {})

        # Get story points from mapped field or common locations
        story_points = None
        if "story_points" in mappings:
            sp_field = mappings["story_points"].provider_field_id
            story_points = fields.get(sp_field)
        if story_points is None:
            # Try common field names
            for field_name in ["customfield_10016", "customfield_10026", "storyPoints"]:
                if fields.get(field_name) is not None:
                    story_points = fields.get(field_name)
                    break

        # Get sprint info from mapped field or common locations
        sprint_name = None
        sprint_id = None
        sprint_field = None
        if "sprint" in mappings:
            sp_field_id = mappings["sprint"].provider_field_id
            sprint_field = fields.get(sp_field_id)
        if sprint_field is None:
            # Try common field names
            for field_name in ["customfield_10020", "customfield_10010", "sprint"]:
                if fields.get(field_name) is not None:
                    sprint_field = fields.get(field_name)
                    break
        if sprint_field and isinstance(sprint_field, list) and len(sprint_field) > 0:
            sprint = sprint_field[0]
            if isinstance(sprint, dict):
                sprint_name = sprint.get("name")
                sprint_id = str(sprint.get("id"))
            elif isinstance(sprint, str):
                # Parse sprint string format
                name_match = re.search(r"name=([^,]+)", sprint)
                if name_match:
                    sprint_name = name_match.group(1)

        # Get parent info
        parent_id = None
        parent_title = None
        parent_field = fields.get("parent")
        if parent_field:
            parent_id = parent_field.get("key")
            parent_title = parent_field.get("fields", {}).get("summary")

        # Get labels
        labels = fields.get("labels", [])

        # Get priority
        priority = None
        priority_order = None
        priority_field = fields.get("priority")
        if priority_field:
            priority = priority_field.get("name")
            priority_order = priority_field.get("id")

        # Get assignee
        assignee = None
        assignee_email = None
        assignee_field = fields.get("assignee")
        if assignee_field:
            assignee = assignee_field.get("displayName")
            assignee_email = assignee_field.get("emailAddress")

        # Get status and category
        status = fields.get("status", {}).get("name", "Unknown")
        status_category = fields.get("status", {}).get("statusCategory", {}).get("key", "undefined")
        # Map Jira status categories
        category_map = {"new": "todo", "indeterminate": "in_progress", "done": "done"}
        status_category = category_map.get(status_category, "todo")

        # Get flagged status
        flagged = fields.get("flagged", False)

        # Get last updated
        updated = fields.get("updated")
        last_updated = None
        if updated:
            try:
                last_updated = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

        # Calculate days in status (simplified - would need changelog for accuracy)
        days_in_status = None
        if last_updated:
            days_in_status = (datetime.utcnow() - last_updated.replace(tzinfo=None)).days

        # Get links
        links = []
        issue_links = fields.get("issuelinks", [])
        for link in issue_links:
            link_type = link.get("type", {}).get("inward", "related to")
            target = link.get("inwardIssue") or link.get("outwardIssue")
            if target:
                links.append({
                    "type": link_type,
                    "target_id": target.get("key"),
                    "target_status": target.get("fields", {}).get("status", {}).get("name"),
                })

        return {
            "external_id": issue.get("key"),
            "external_url": f"https://{issue.get('self', '').split('/rest/')[0].split('//')[1] if issue.get('self') else ''}/browse/{issue.get('key')}",
            "item_type": fields.get("issuetype", {}).get("name", "Unknown").lower(),
            "title": fields.get("summary", ""),
            "description": fields.get("description"),
            "status": status,
            "status_category": status_category,
            "assignee": assignee,
            "assignee_email": assignee_email,
            "sprint_name": sprint_name,
            "sprint_id": sprint_id,
            "story_points": story_points,
            "priority": priority,
            "priority_order": int(priority_order) if priority_order else None,
            "labels": labels,
            "parent_id": parent_id,
            "parent_title": parent_title,
            "flagged": flagged,
            "last_updated_external": last_updated,
            "days_in_status": days_in_status,
            "links": links,
            "raw_data": {"fields": fields},
        }

    def _transform_ado_work_item(
        self, work_item: Dict[str, Any], mappings: Dict[str, FieldMapping], base_url: str
    ) -> Dict[str, Any]:
        """Transform an ADO work item to our internal format."""
        fields = work_item.get("fields", {})
        wi_id = work_item.get("id")

        # Get story points from mapped field or default
        story_points = None
        if "story_points" in mappings:
            sp_field = mappings["story_points"].provider_field_id
            story_points = fields.get(sp_field)
        if story_points is None:
            story_points = fields.get("Microsoft.VSTS.Scheduling.StoryPoints")

        # Get status and map to category
        status = fields.get("System.State", "New")
        status_category = "todo"
        in_progress_states = ["Active", "In Progress", "Committed", "Resolved"]
        done_states = ["Done", "Closed", "Removed"]
        if status in done_states:
            status_category = "done"
        elif status in in_progress_states:
            status_category = "in_progress"

        # Get assignee
        assignee = None
        assignee_email = None
        assigned_to = fields.get("System.AssignedTo")
        if assigned_to:
            if isinstance(assigned_to, dict):
                assignee = assigned_to.get("displayName")
                assignee_email = assigned_to.get("uniqueName")
            else:
                assignee = assigned_to

        # Get iteration (sprint)
        iteration_path = fields.get("System.IterationPath", "")
        sprint_name = iteration_path.split("\\")[-1] if iteration_path else None

        # Get tags as labels
        tags = fields.get("System.Tags", "")
        labels = [t.strip() for t in tags.split(";")] if tags else []

        # Get priority from mapped field or default
        priority = None
        if "priority" in mappings:
            priority_field = mappings["priority"].provider_field_id
            priority = fields.get(priority_field)
        if priority is None:
            priority = fields.get("Microsoft.VSTS.Common.Priority")
        priority_name = f"Priority {priority}" if priority else None

        # Get parent from relations
        parent_id = None
        relations = work_item.get("relations", [])
        for rel in relations:
            if rel.get("rel") == "System.LinkTypes.Hierarchy-Reverse":
                parent_url = rel.get("url", "")
                parent_id = parent_url.split("/")[-1] if parent_url else None
                break

        # Get links (blockers)
        links = []
        for rel in relations:
            rel_type = rel.get("rel", "")
            if "Dependency" in rel_type or "Related" in rel_type:
                target_url = rel.get("url", "")
                target_id = target_url.split("/")[-1] if target_url else None
                links.append({
                    "type": rel_type,
                    "target_id": target_id,
                    "target_status": None,  # Would need additional API call
                })

        # Get last updated
        changed_date = fields.get("System.ChangedDate")
        last_updated = None
        if changed_date:
            try:
                last_updated = datetime.fromisoformat(changed_date.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

        days_in_status = None
        if last_updated:
            days_in_status = (datetime.utcnow() - last_updated.replace(tzinfo=None)).days

        return {
            "external_id": str(wi_id),
            "external_url": f"{base_url}/_workitems/edit/{wi_id}",
            "item_type": fields.get("System.WorkItemType", "Unknown").lower(),
            "title": fields.get("System.Title", ""),
            "description": fields.get("System.Description"),
            "status": status,
            "status_category": status_category,
            "assignee": assignee,
            "assignee_email": assignee_email,
            "sprint_name": sprint_name,
            "sprint_id": iteration_path,
            "story_points": story_points,
            "priority": priority_name,
            "priority_order": priority,
            "labels": labels,
            "parent_id": parent_id,
            "parent_title": None,
            "flagged": "blocked" in [l.lower() for l in labels],
            "last_updated_external": last_updated,
            "days_in_status": days_in_status,
            "links": links,
            "raw_data": {"fields": fields},
        }

    def _create_tracked_item(
        self,
        session: ProgressTrackerSession,
        item_data: Dict[str, Any],
        template: Dict[str, Any],
    ) -> TrackedWorkItem:
        """Create a TrackedWorkItem from fetched data."""
        return TrackedWorkItem(
            session_id=session.id,
            external_id=item_data.get("external_id", ""),
            external_url=item_data.get("external_url"),
            item_type=item_data.get("item_type", "unknown"),
            title=item_data.get("title", ""),
            description=item_data.get("description"),
            status=item_data.get("status", "Unknown"),
            status_category=item_data.get("status_category", "todo"),
            assignee=item_data.get("assignee"),
            assignee_email=item_data.get("assignee_email"),
            sprint_name=item_data.get("sprint_name"),
            sprint_id=item_data.get("sprint_id"),
            story_points=item_data.get("story_points"),
            priority=item_data.get("priority"),
            priority_order=item_data.get("priority_order"),
            labels=item_data.get("labels", []),
            parent_id=item_data.get("parent_id"),
            parent_title=item_data.get("parent_title"),
            last_updated_external=item_data.get("last_updated_external"),
            days_in_status=item_data.get("days_in_status"),
            links=item_data.get("links", []),
            raw_data=item_data.get("raw_data", {}),
        )

    # =========================================================================
    # BLOCKER DETECTION
    # =========================================================================

    def _detect_blockers(
        self, item: TrackedWorkItem, blocker_config: Dict[str, Any]
    ) -> TrackedWorkItem:
        """Detect blockers using multi-signal approach."""
        signals = {}
        reasons = []

        raw_data = item.raw_data.get("fields", {})

        # Signal 1: Explicit flag
        if blocker_config.get("explicit_flag", {}).get("enabled", True):
            weight = blocker_config.get("explicit_flag", {}).get("weight", 1.0)
            flag_fields = blocker_config.get("explicit_flag", {}).get("fields", ["flagged"])

            for field in flag_fields:
                if raw_data.get(field) is True:
                    signals["explicit_flag"] = weight
                    reasons.append("Flagged as blocked")
                    break

        # Signal 2: Status-based
        if blocker_config.get("status_based", {}).get("enabled", True):
            weight = blocker_config.get("status_based", {}).get("weight", 0.95)
            blocked_statuses = blocker_config.get("status_based", {}).get(
                "statuses", ["Blocked", "On Hold", "Impediment"]
            )

            if item.status in blocked_statuses:
                signals["status_based"] = weight
                reasons.append(f"Status is '{item.status}'")

        # Signal 3: Label-based
        if blocker_config.get("label_based", {}).get("enabled", True):
            weight = blocker_config.get("label_based", {}).get("weight", 0.9)
            patterns = blocker_config.get("label_based", {}).get(
                "patterns", ["blocked", "impediment", "waiting"]
            )

            for label in item.labels:
                label_lower = label.lower()
                for pattern in patterns:
                    if pattern.lower() in label_lower:
                        signals["label_based"] = weight
                        reasons.append(f"Label '{label}' indicates blocker")
                        break
                if "label_based" in signals:
                    break

        # Signal 4: Link analysis
        if blocker_config.get("link_analysis", {}).get("enabled", True):
            weight = blocker_config.get("link_analysis", {}).get("weight", 0.85)
            blocking_link_types = blocker_config.get("link_analysis", {}).get(
                "link_types", ["is blocked by", "depends on"]
            )

            for link in item.links:
                link_type = link.get("type", "").lower()
                for blocking_type in blocking_link_types:
                    if blocking_type.lower() in link_type:
                        # Check if blocking item is not done
                        target_status = link.get("target_status", "")
                        if target_status and target_status.lower() not in ["done", "closed", "resolved"]:
                            signals["link_analysis"] = weight
                            reasons.append(f"Blocked by {link.get('target_id')}")
                            break
                if "link_analysis" in signals:
                    break

        # Signal 5: Keyword analysis
        if blocker_config.get("keyword_analysis", {}).get("enabled", True):
            weight = blocker_config.get("keyword_analysis", {}).get("weight", 0.7)
            patterns = blocker_config.get("keyword_analysis", {}).get(
                "patterns", ["blocked by", "waiting on", "can't proceed"]
            )

            text_to_search = f"{item.title} {item.description or ''}".lower()
            for pattern in patterns:
                if pattern.lower() in text_to_search:
                    signals["keyword_analysis"] = weight
                    reasons.append(f"Contains '{pattern}'")
                    break

        # Signal 6: Velocity anomaly (stale items)
        if blocker_config.get("velocity_anomaly", {}).get("enabled", True):
            weight = blocker_config.get("velocity_anomaly", {}).get("weight", 0.6)
            stale_days = blocker_config.get("velocity_anomaly", {}).get("stale_days", 5)

            if (
                item.status_category == "in_progress"
                and item.days_in_status
                and item.days_in_status >= stale_days
            ):
                signals["velocity_anomaly"] = weight
                reasons.append(f"In progress for {item.days_in_status} days with no updates")

        # Compute final confidence score
        if signals:
            # Use highest signal weight as the confidence
            max_signal = max(signals.values())
            item.blocker_confidence = round(max_signal * 100, 1)
            item.is_blocked = item.blocker_confidence >= 50
            item.blocker_reason = "; ".join(reasons)
        else:
            item.blocker_confidence = 0.0
            item.is_blocked = False
            item.blocker_reason = None

        item.blocker_signals = signals
        return item

    # =========================================================================
    # METRICS COMPUTATION
    # =========================================================================

    def _compute_metrics(
        self, session_id: int, template: Dict[str, Any]
    ) -> MetricsResponse:
        """Compute metrics from tracked items."""
        statement = select(TrackedWorkItem).where(
            TrackedWorkItem.session_id == session_id
        )
        items = self.db.exec(statement).all()

        # Get session for last sync info
        session = self.get_session(session_id)

        # Initialize metrics
        metrics = MetricsResponse(session_id=session_id)

        if not items:
            return metrics

        # Get sprint name from first item
        metrics.sprint_name = items[0].sprint_name if items else None

        # Count by status category
        for item in items:
            metrics.total_items += 1

            if item.status_category == "todo":
                metrics.items_todo += 1
            elif item.status_category == "in_progress":
                metrics.items_in_progress += 1
            elif item.status_category == "done":
                metrics.items_done += 1

            # Points
            if item.story_points is not None:
                if metrics.total_points is None:
                    metrics.total_points = 0
                    metrics.points_todo = 0
                    metrics.points_in_progress = 0
                    metrics.points_done = 0

                metrics.total_points += item.story_points

                if item.status_category == "todo":
                    metrics.points_todo += item.story_points
                elif item.status_category == "in_progress":
                    metrics.points_in_progress += item.story_points
                elif item.status_category == "done":
                    metrics.points_done += item.story_points

            # Blockers
            if item.is_blocked:
                metrics.blocked_items += 1
                if item.story_points is not None:
                    if metrics.blocked_points is None:
                        metrics.blocked_points = 0
                    metrics.blocked_points += item.story_points

            # Stale items
            stale_days = template.get("blocker_signals", {}).get("velocity_anomaly", {}).get("stale_days", 5)
            if item.days_in_status and item.days_in_status >= stale_days and item.status_category == "in_progress":
                metrics.stale_items += 1

            # By type
            item_type = item.item_type
            if item_type not in metrics.by_type:
                metrics.by_type[item_type] = {"todo": 0, "in_progress": 0, "done": 0}
            metrics.by_type[item_type][item.status_category] += 1

            # By assignee
            assignee = item.assignee or "Unassigned"
            if assignee not in metrics.by_assignee:
                metrics.by_assignee[assignee] = {"todo": 0, "in_progress": 0, "done": 0}
            metrics.by_assignee[assignee][item.status_category] += 1

        # Calculate percentages
        if metrics.total_items > 0:
            metrics.completion_percentage_items = round(
                (metrics.items_done / metrics.total_items) * 100, 1
            )

        if metrics.total_points and metrics.total_points > 0:
            metrics.completion_percentage_points = round(
                (metrics.points_done / metrics.total_points) * 100, 1
            )

        # Data freshness
        metrics.last_sync_at = session.last_sync_at if session else None
        if session and session.last_sync_at:
            hours_since_sync = (datetime.utcnow() - session.last_sync_at).total_seconds() / 3600
            if hours_since_sync < 1:
                metrics.data_freshness = "fresh"
            elif hours_since_sync < 24:
                metrics.data_freshness = "recent"
            else:
                metrics.data_freshness = "stale"

        return metrics

    def get_metrics(self, session_id: int) -> Optional[MetricsResponse]:
        """Get metrics for a session (from cache or compute)."""
        session = self.get_session(session_id)
        if not session:
            return None

        # Return cached metrics if available
        if session.metrics_snapshot:
            return MetricsResponse(**session.metrics_snapshot)

        # Otherwise compute fresh
        template = TRACKER_TEMPLATES.get(session.template_id, TRACKER_TEMPLATES["basic"])
        return self._compute_metrics(session_id, template)

    def get_blockers(self, session_id: int) -> Optional[BlockersResponse]:
        """Get blocked items for a session."""
        session = self.get_session(session_id)
        if not session:
            return None

        statement = select(TrackedWorkItem).where(
            TrackedWorkItem.session_id == session_id,
            TrackedWorkItem.is_blocked == True,
        ).order_by(TrackedWorkItem.blocker_confidence.desc())

        items = self.db.exec(statement).all()

        blockers = []
        high_count = 0
        medium_count = 0
        low_count = 0
        blocked_points = 0.0

        for item in items:
            if item.blocker_confidence >= 80:
                high_count += 1
            elif item.blocker_confidence >= 50:
                medium_count += 1
            else:
                low_count += 1

            if item.story_points:
                blocked_points += item.story_points

            blockers.append(
                BlockerSummary(
                    item_id=item.id,
                    external_id=item.external_id,
                    external_url=item.external_url,
                    title=item.title,
                    item_type=item.item_type,
                    status=item.status,
                    assignee=item.assignee,
                    story_points=item.story_points,
                    blocker_confidence=item.blocker_confidence,
                    blocker_reason=item.blocker_reason,
                    blocker_signals=item.blocker_signals,
                    days_in_status=item.days_in_status,
                    sprint_name=item.sprint_name,
                )
            )

        return BlockersResponse(
            session_id=session_id,
            total_blockers=len(blockers),
            high_confidence_blockers=high_count,
            medium_confidence_blockers=medium_count,
            low_confidence_blockers=low_count,
            blocked_points=blocked_points if blocked_points > 0 else None,
            blockers=blockers,
        )

    def get_items(
        self,
        session_id: int,
        status_category: Optional[str] = None,
        is_blocked: Optional[bool] = None,
    ) -> List[TrackedWorkItem]:
        """Get tracked items for a session with optional filters."""
        statement = select(TrackedWorkItem).where(
            TrackedWorkItem.session_id == session_id
        )

        if status_category:
            statement = statement.where(
                TrackedWorkItem.status_category == status_category
            )

        if is_blocked is not None:
            statement = statement.where(TrackedWorkItem.is_blocked == is_blocked)

        statement = statement.order_by(TrackedWorkItem.priority_order)

        return list(self.db.exec(statement).all())

    # =========================================================================
    # SPRINT DISCOVERY
    # =========================================================================

    async def get_available_sprints(
        self, integration_id: int
    ) -> List[SprintOption]:
        """Get available sprints/iterations from an integration."""
        integration = self.db.get(Integration, integration_id)
        if not integration:
            raise ValueError("Integration not found")

        if integration.provider == "jira":
            return await self._get_jira_sprints(integration)
        elif integration.provider == "ado":
            return await self._get_ado_iterations(integration)
        else:
            return []

    async def _get_jira_sprints(self, integration: Integration) -> List[SprintOption]:
        """Get sprints from Jira."""
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {integration.access_token}",
                "Accept": "application/json",
            }

            # First get boards
            boards_url = f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/agile/1.0/board"
            boards_response = await client.get(boards_url, headers=headers)

            if boards_response.status_code != 200:
                return []

            boards = boards_response.json().get("values", [])
            sprints = []

            # Get sprints from first scrum board
            for board in boards:
                if board.get("type") == "scrum":
                    sprints_url = f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/agile/1.0/board/{board['id']}/sprint"
                    sprints_response = await client.get(sprints_url, headers=headers)

                    if sprints_response.status_code == 200:
                        for sprint in sprints_response.json().get("values", []):
                            start_date = None
                            end_date = None
                            if sprint.get("startDate"):
                                try:
                                    start_date = datetime.fromisoformat(
                                        sprint["startDate"].replace("Z", "+00:00")
                                    )
                                except (ValueError, TypeError):
                                    pass
                            if sprint.get("endDate"):
                                try:
                                    end_date = datetime.fromisoformat(
                                        sprint["endDate"].replace("Z", "+00:00")
                                    )
                                except (ValueError, TypeError):
                                    pass

                            sprints.append(
                                SprintOption(
                                    id=str(sprint["id"]),
                                    name=sprint["name"],
                                    state=sprint.get("state", "future"),
                                    start_date=start_date,
                                    end_date=end_date,
                                )
                            )
                    break

            return sprints

    async def _get_ado_iterations(self, integration: Integration) -> List[SprintOption]:
        """Get iterations from Azure DevOps."""
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {integration.access_token}",
                "Accept": "application/json",
            }

            # Get iterations
            iterations_url = f"{integration.base_url}/_apis/work/teamsettings/iterations?api-version=7.0"
            response = await client.get(iterations_url, headers=headers)

            if response.status_code != 200:
                return []

            iterations = []
            for iteration in response.json().get("value", []):
                attributes = iteration.get("attributes", {})

                start_date = None
                end_date = None
                if attributes.get("startDate"):
                    try:
                        start_date = datetime.fromisoformat(
                            attributes["startDate"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass
                if attributes.get("finishDate"):
                    try:
                        end_date = datetime.fromisoformat(
                            attributes["finishDate"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

                # Determine state
                state = "future"
                time_frame = attributes.get("timeFrame", "")
                if time_frame == "current":
                    state = "active"
                elif time_frame == "past":
                    state = "closed"

                iterations.append(
                    SprintOption(
                        id=iteration.get("path", iteration.get("id", "")),
                        name=iteration.get("name", ""),
                        state=state,
                        start_date=start_date,
                        end_date=end_date,
                    )
                )

            return iterations


# Singleton-ish factory function
def get_progress_tracker_service(db: Session) -> ProgressTrackerService:
    """Get a progress tracker service instance."""
    return ProgressTrackerService(db)
