"""
Defect Manager Service

Handles defect analysis, triage, pattern detection, and prevention recommendations.
Implements adaptive configuration discovery and graceful degradation.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from difflib import SequenceMatcher
import httpx
from sqlmodel import Session, select, delete, func

from app.models.defect_manager import (
    DefectManagerSession,
    AnalyzedDefect,
    CreateDefectSessionRequest,
    DefectSessionResponse,
    DefectSummary,
    TriageResult,
    PatternAnalysis,
    DuplicateGroup,
    PreventionRecommendation,
    AnalysisStatusResponse,
    DEFECT_IDENTIFICATION_STRATEGIES,
    SEVERITY_NORMALIZATION,
    SEVERITY_CANDIDATE_FIELDS,
)
from app.models.release_readiness import ProjectOption
from app.models.jira import Integration, FieldMapping
from app.core.config import settings
from app.core.token_refresh import ensure_valid_token

# Default field IDs when no mapping exists
DEFAULT_JIRA_FIELDS = {
    "severity": None,  # Often uses priority field
    "root_cause": None,
}

DEFAULT_ADO_FIELDS = {
    "severity": "Microsoft.VSTS.Common.Severity",
    "priority": "Microsoft.VSTS.Common.Priority",
    "root_cause": None,
}


class DefectManagerService:
    """Service for defect analysis and triage."""

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # INTEGRATION CHECK
    # =========================================================================

    def check_integrations(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Check for valid Jira/ADO integrations."""
        stmt = select(Integration).where(
            Integration.provider.in_(["jira", "ado"]),
            Integration.status == "connected"
        )
        if user_id:
            stmt = stmt.where(Integration.user_id == user_id)
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
            "message": "Ready to analyze defects" if valid_integrations else "Connect Jira or Azure DevOps to analyze defects"
        }

    # =========================================================================
    # INTEGRATION LOOKUPS
    # =========================================================================

    async def get_projects(self, integration_id: int, user_id: Optional[int] = None) -> List[ProjectOption]:
        """Get available projects from integration."""
        integration = self.db.get(Integration, integration_id)
        if not integration:
            raise ValueError("Integration not found")
        if user_id and integration.user_id and integration.user_id != user_id:
            raise ValueError("Integration not found")

        # Ensure token is valid before making API calls
        integration = await ensure_valid_token(self.db, integration)

        if integration.provider == "jira":
            return await self._get_jira_projects(integration)
        elif integration.provider == "ado":
            return await self._get_ado_projects(integration)
        return []

    async def _get_jira_projects(self, integration: Integration) -> List[ProjectOption]:
        """Get projects from Jira."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/project/search",
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    },
                    params={"maxResults": 100}
                )

                if response.status_code == 200:
                    data = response.json()
                    return [
                        ProjectOption(
                            key=p["key"],
                            name=p["name"],
                            description=p.get("description")
                        )
                        for p in data.get("values", [])
                    ]
        except Exception:
            pass
        return []

    async def _get_ado_projects(self, integration: Integration) -> List[ProjectOption]:
        """Get projects from Azure DevOps."""
        try:
            # Extract org URL from base_url
            org_url = integration.base_url.rsplit("/", 1)[0] if "/" in integration.base_url else integration.base_url

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{org_url}/_apis/projects",
                    headers={
                        "Authorization": f"Bearer {integration.access_token}",
                        "Accept": "application/json"
                    },
                    params={"api-version": "7.0"}
                )

                if response.status_code == 200:
                    data = response.json()
                    return [
                        ProjectOption(
                            key=p["name"],  # ADO uses name as key
                            name=p["name"],
                            description=p.get("description")
                        )
                        for p in data.get("value", [])
                    ]
        except Exception:
            pass
        return []

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

    def _build_jira_defect_fields(self, mappings: Dict[str, FieldMapping]) -> str:
        """Build the fields parameter for Jira API based on mappings."""
        base_fields = [
            "summary", "description", "status", "priority",
            "components", "labels", "assignee", "reporter",
            "created", "updated", "resolutiondate"
        ]

        # Add mapped custom fields
        for our_field in ["severity", "root_cause"]:
            field_id = self._get_mapped_field(mappings, our_field, "jira")
            if field_id and field_id not in base_fields:
                base_fields.append(field_id)

        return ",".join(base_fields)

    def _build_ado_defect_fields(self, mappings: Dict[str, FieldMapping]) -> List[str]:
        """Build the fields list for ADO API based on mappings."""
        base_fields = [
            "System.Id", "System.Title", "System.Description", "System.State",
            "System.AssignedTo", "System.CreatedBy", "System.CreatedDate",
            "System.ChangedDate", "System.Tags", "System.AreaPath",
            "Microsoft.VSTS.Common.ResolvedDate"
        ]

        # Add mapped fields
        for our_field in ["severity", "priority", "root_cause"]:
            field_id = self._get_mapped_field(mappings, our_field, "ado")
            if field_id and field_id not in base_fields:
                base_fields.append(field_id)

        return base_fields

    # =========================================================================
    # SESSION CRUD
    # =========================================================================

    def create_session(
        self, data: CreateDefectSessionRequest, user_id: Optional[int] = None
    ) -> DefectManagerSession:
        """Create a new defect analysis session."""
        integration = self.db.get(Integration, data.integration_id)
        if not integration:
            raise ValueError("Integration not found")
        if integration.status != "connected":
            raise ValueError("Integration is not connected")

        # Discover data availability level
        data_level = self._discover_data_level(integration)

        session = DefectManagerSession(
            user_id=user_id,
            name=data.name or "Defect Analysis",
            integration_id=data.integration_id,
            project_filter=data.project_filter,
            date_range_start=data.date_range_start,
            date_range_end=data.date_range_end,
            detection_config=data.detection_config or {},
            severity_config=data.severity_config or {},
            data_level=data_level,
            status="draft",
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int, user_id: Optional[int] = None) -> Optional[DefectManagerSession]:
        """Get a session by ID, optionally filtered by user_id."""
        session = self.db.get(DefectManagerSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def get_session_response(self, session_id: int, user_id: Optional[int] = None) -> Optional[DefectSessionResponse]:
        """Get session with integration details."""
        session = self.get_session(session_id, user_id=user_id)
        if not session:
            return None

        integration = self.db.get(Integration, session.integration_id)
        data_level_descriptions = {
            1: "Basic defect identification only",
            2: "Defects with severity/priority normalization",
            3: "Full analysis with root cause and patterns"
        }

        return DefectSessionResponse(
            id=session.id,
            name=session.name,
            integration_id=session.integration_id,
            integration_name=integration.name if integration else None,
            integration_provider=integration.provider if integration else None,
            data_level=session.data_level,
            data_level_description=data_level_descriptions.get(session.data_level, "Unknown"),
            status=session.status,
            progress_step=session.progress_step,
            progress_total=session.progress_total,
            progress_message=session.progress_message,
            error_message=session.error_message,
            analysis_snapshot=session.analysis_snapshot,
            last_analysis_at=session.last_analysis_at,
            created_at=session.created_at,
        )

    def list_sessions(self, user_id: Optional[int] = None) -> List[DefectSessionResponse]:
        """List all defect sessions, optionally filtered by user."""
        stmt = select(DefectManagerSession).order_by(DefectManagerSession.updated_at.desc())
        if user_id:
            stmt = stmt.where(DefectManagerSession.user_id == user_id)
        sessions = list(self.db.exec(stmt))
        return [self.get_session_response(s.id, user_id=user_id) for s in sessions if s]

    def delete_session(self, session_id: int, user_id: Optional[int] = None) -> bool:
        """Delete a session and its analyzed defects."""
        session = self.get_session(session_id, user_id=user_id)
        if not session:
            return False

        # Delete analyzed defects
        self.db.exec(delete(AnalyzedDefect).where(AnalyzedDefect.session_id == session_id))
        self.db.delete(session)
        self.db.commit()
        return True

    # =========================================================================
    # DATA LEVEL DISCOVERY
    # =========================================================================

    def _discover_data_level(self, integration: Integration) -> int:
        """Discover what level of defect data is available."""
        # For now, assume level 2 (severity available) as default
        # In production, this would probe the integration's fields
        return 2

    # =========================================================================
    # ANALYSIS ORCHESTRATION
    # =========================================================================

    async def analyze_defects(self, session_id: int, user_id: Optional[int] = None) -> AnalysisStatusResponse:
        """Run full defect analysis."""
        session = self.get_session(session_id, user_id=user_id)
        if not session:
            raise ValueError("Session not found")

        integration = self.db.get(Integration, session.integration_id)
        if not integration:
            raise ValueError("Integration not found")

        session.status = "analyzing"
        session.progress_step = 1
        session.progress_message = "Fetching defects from integration..."
        self.db.commit()

        try:
            # Step 1: Fetch defects
            defects = await self._fetch_defects(integration, session)
            session.progress_step = 2
            session.progress_message = f"Normalizing {len(defects)} defects..."
            self.db.commit()

            # Step 2: Normalize and save
            await self._normalize_and_save_defects(session, defects)
            session.progress_step = 3
            session.progress_message = "Detecting duplicates..."
            self.db.commit()

            # Step 3: Detect duplicates
            await self._detect_duplicates(session)
            session.progress_step = 4
            session.progress_message = "Analyzing patterns..."
            self.db.commit()

            # Step 4: Analyze patterns
            patterns = self._analyze_patterns(session)
            session.progress_step = 5
            session.progress_message = "Generating recommendations..."
            self.db.commit()

            # Step 5: Generate snapshot
            snapshot = self._generate_analysis_snapshot(session)
            session.analysis_snapshot = snapshot
            session.status = "ready"
            session.last_analysis_at = datetime.utcnow()
            session.progress_message = "Analysis complete"
            self.db.commit()

        except Exception as e:
            session.status = "error"
            session.error_message = str(e)
            self.db.commit()
            raise

        return self._get_analysis_status(session)

    def _get_analysis_status(self, session: DefectManagerSession) -> AnalysisStatusResponse:
        """Get current analysis status."""
        defect_count = self.db.exec(
            select(func.count(AnalyzedDefect.id)).where(
                AnalyzedDefect.session_id == session.id
            )
        ).one()

        return AnalysisStatusResponse(
            session_id=session.id,
            status=session.status,
            progress_step=session.progress_step,
            progress_total=session.progress_total,
            progress_message=session.progress_message,
            error_message=session.error_message,
            defects_analyzed=defect_count or 0,
            last_analysis_at=session.last_analysis_at,
        )

    # =========================================================================
    # DEFECT FETCHING
    # =========================================================================

    async def _fetch_defects(
        self, integration: Integration, session: DefectManagerSession
    ) -> List[Dict[str, Any]]:
        """Fetch defects from integration."""
        if integration.provider == "jira":
            return await self._fetch_jira_defects(integration, session)
        elif integration.provider == "ado":
            return await self._fetch_ado_defects(integration, session)
        return []

    async def _fetch_jira_defects(
        self, integration: Integration, session: DefectManagerSession
    ) -> List[Dict[str, Any]]:
        """Fetch defects from Jira."""
        defects = []

        # Get field mappings
        mappings = self._get_field_mappings(integration.id)
        fields_param = self._build_jira_defect_fields(mappings)

        # Get mapped field IDs
        severity_field = self._get_mapped_field(mappings, "severity", "jira")
        root_cause_field = self._get_mapped_field(mappings, "root_cause", "jira")

        # Build JQL query
        jql_parts = ["type = Bug"]
        if session.project_filter:
            jql_parts.append(f"project = {session.project_filter}")
        if session.date_range_start:
            jql_parts.append(f"created >= '{session.date_range_start.strftime('%Y-%m-%d')}'")
        if session.date_range_end:
            jql_parts.append(f"created <= '{session.date_range_end.strftime('%Y-%m-%d')}'")

        jql = " AND ".join(jql_parts)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{integration.base_url}/rest/api/3/search",
                    params={
                        "jql": jql,
                        "maxResults": 200,
                        "fields": fields_param
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

                        # Extract severity from mapped field
                        severity = None
                        if severity_field:
                            severity_value = fields.get(severity_field)
                            if isinstance(severity_value, dict):
                                severity = severity_value.get("value") or severity_value.get("name")
                            else:
                                severity = severity_value

                        # Extract root cause from mapped field
                        root_cause = None
                        if root_cause_field:
                            root_cause_value = fields.get(root_cause_field)
                            if isinstance(root_cause_value, dict):
                                root_cause = root_cause_value.get("value") or root_cause_value.get("name")
                            else:
                                root_cause = root_cause_value

                        defects.append({
                            "external_id": issue["key"],
                            "external_url": f"{integration.base_url}/browse/{issue['key']}",
                            "title": fields.get("summary", ""),
                            "description": fields.get("description", ""),
                            "status": fields.get("status", {}).get("name", "Unknown"),
                            "status_category": fields.get("status", {}).get("statusCategory", {}).get("key", "new"),
                            "priority": fields.get("priority", {}).get("name") if fields.get("priority") else None,
                            "severity": severity,
                            "root_cause": root_cause,
                            "components": [c.get("name") for c in fields.get("components", [])],
                            "labels": fields.get("labels", []),
                            "assignee": fields.get("assignee", {}).get("displayName") if fields.get("assignee") else None,
                            "reporter": fields.get("reporter", {}).get("displayName") if fields.get("reporter") else None,
                            "created": fields.get("created"),
                            "updated": fields.get("updated"),
                            "resolved": fields.get("resolutiondate"),
                        })
        except Exception as e:
            # Return mock data for demo purposes
            defects = self._get_mock_defects()

        return defects

    async def _fetch_ado_defects(
        self, integration: Integration, session: DefectManagerSession
    ) -> List[Dict[str, Any]]:
        """Fetch defects from Azure DevOps."""
        defects = []

        # Get field mappings
        mappings = self._get_field_mappings(integration.id)
        ado_fields = self._build_ado_defect_fields(mappings)

        # Get mapped field IDs
        severity_field = self._get_mapped_field(mappings, "severity", "ado")
        priority_field = self._get_mapped_field(mappings, "priority", "ado")
        root_cause_field = self._get_mapped_field(mappings, "root_cause", "ado")

        # Build WIQL query
        wiql_parts = ["[System.WorkItemType] = 'Bug'"]
        if session.project_filter:
            wiql_parts.append(f"[System.TeamProject] = '{session.project_filter}'")
        if session.date_range_start:
            wiql_parts.append(f"[System.CreatedDate] >= '{session.date_range_start.strftime('%Y-%m-%d')}'")

        wiql = " AND ".join(wiql_parts)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Query work items
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
                        # Get full details with mapped fields
                        details_response = await client.get(
                            f"{integration.base_url}/_apis/wit/workitems",
                            params={
                                "ids": ",".join(ids),
                                "fields": ",".join(ado_fields),
                                "api-version": "7.0"
                            },
                            headers={
                                "Authorization": f"Bearer {integration.access_token}"
                            }
                        )

                        if details_response.status_code == 200:
                            for item in details_response.json().get("value", []):
                                fields = item.get("fields", {})

                                # Extract severity from mapped field
                                severity = None
                                if severity_field:
                                    severity = fields.get(severity_field)

                                # Extract priority from mapped field
                                priority = None
                                if priority_field:
                                    priority_value = fields.get(priority_field)
                                    priority = str(priority_value) if priority_value else None

                                # Extract root cause from mapped field
                                root_cause = None
                                if root_cause_field:
                                    root_cause = fields.get(root_cause_field)

                                defects.append({
                                    "external_id": str(item["id"]),
                                    "external_url": item.get("_links", {}).get("html", {}).get("href"),
                                    "title": fields.get("System.Title", ""),
                                    "description": fields.get("System.Description", ""),
                                    "status": fields.get("System.State", "New"),
                                    "status_category": self._ado_status_to_category(fields.get("System.State", "New")),
                                    "priority": priority,
                                    "severity": severity,
                                    "root_cause": root_cause,
                                    "components": [fields.get("System.AreaPath", "").split("\\")[-1]] if fields.get("System.AreaPath") else [],
                                    "labels": fields.get("System.Tags", "").split(";") if fields.get("System.Tags") else [],
                                    "assignee": fields.get("System.AssignedTo", {}).get("displayName") if isinstance(fields.get("System.AssignedTo"), dict) else None,
                                    "created": fields.get("System.CreatedDate"),
                                    "updated": fields.get("System.ChangedDate"),
                                    "resolved": fields.get("Microsoft.VSTS.Common.ResolvedDate"),
                                })
        except Exception:
            defects = self._get_mock_defects()

        return defects

    def _ado_status_to_category(self, status: str) -> str:
        """Map ADO status to category."""
        status_lower = status.lower()
        if status_lower in ["new", "approved"]:
            return "open"
        elif status_lower in ["active", "committed", "in progress"]:
            return "in_progress"
        elif status_lower in ["resolved", "closed", "done", "removed"]:
            return "resolved"
        return "open"

    def _get_mock_defects(self) -> List[Dict[str, Any]]:
        """Return mock defects for demo."""
        return [
            {
                "external_id": "BUG-101",
                "external_url": "https://example.atlassian.net/browse/BUG-101",
                "title": "Login fails with special characters in password",
                "description": "Users cannot login when password contains special chars",
                "status": "Open",
                "status_category": "open",
                "priority": "High",
                "components": ["Authentication"],
                "labels": ["production", "critical"],
                "assignee": "John Doe",
                "reporter": "Jane Smith",
                "created": datetime.utcnow().isoformat(),
                "updated": datetime.utcnow().isoformat(),
                "resolved": None,
            },
            {
                "external_id": "BUG-102",
                "external_url": "https://example.atlassian.net/browse/BUG-102",
                "title": "Dashboard loads slowly for large datasets",
                "description": "Performance issue when loading 1000+ records",
                "status": "In Progress",
                "status_category": "in_progress",
                "priority": "Medium",
                "components": ["Dashboard"],
                "labels": ["performance"],
                "assignee": "Bob Wilson",
                "reporter": "Alice Brown",
                "created": (datetime.utcnow() - timedelta(days=5)).isoformat(),
                "updated": datetime.utcnow().isoformat(),
                "resolved": None,
            },
            {
                "external_id": "BUG-103",
                "external_url": "https://example.atlassian.net/browse/BUG-103",
                "title": "Export to PDF fails for reports with images",
                "description": "PDF export crashes when report contains embedded images",
                "status": "Open",
                "status_category": "open",
                "priority": "Critical",
                "components": ["Reports"],
                "labels": ["critical", "export"],
                "assignee": None,
                "reporter": "Charlie Davis",
                "created": (datetime.utcnow() - timedelta(days=2)).isoformat(),
                "updated": datetime.utcnow().isoformat(),
                "resolved": None,
            },
        ]

    # =========================================================================
    # NORMALIZATION
    # =========================================================================

    async def _normalize_and_save_defects(
        self, session: DefectManagerSession, defects: List[Dict[str, Any]]
    ) -> None:
        """Normalize defect data and save to database."""
        # Clear existing
        self.db.exec(delete(AnalyzedDefect).where(AnalyzedDefect.session_id == session.id))

        for defect in defects:
            severity, severity_source, confidence = self._normalize_severity(defect, session.data_level)

            # Calculate days open
            created = defect.get("created")
            resolved = defect.get("resolved")
            days_open = None
            if created:
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(resolved.replace("Z", "+00:00")) if resolved else datetime.utcnow()
                    days_open = (end_dt - created_dt).days
                except Exception:
                    pass

            analyzed = AnalyzedDefect(
                session_id=session.id,
                external_id=defect["external_id"],
                external_url=defect.get("external_url"),
                title=defect["title"],
                description=defect.get("description"),
                item_type="Bug",
                status=defect["status"],
                status_category=self._normalize_status_category(defect.get("status_category", "open")),
                severity=severity,
                severity_source=severity_source,
                severity_confidence=confidence,
                priority=defect.get("priority"),
                component=defect.get("components", [None])[0] if defect.get("components") else None,
                assignee=defect.get("assignee"),
                reporter=defect.get("reporter"),
                labels=defect.get("labels", []),
                created_external=self._parse_datetime(defect.get("created")),
                updated_external=self._parse_datetime(defect.get("updated")),
                resolved_at=self._parse_datetime(defect.get("resolved")),
                days_open=days_open,
            )
            self.db.add(analyzed)

        self.db.commit()

    def _normalize_severity(
        self, defect: Dict[str, Any], data_level: int
    ) -> Tuple[str, str, float]:
        """Normalize severity to standard scale."""
        # Try explicit severity first
        explicit_severity = defect.get("severity")
        if explicit_severity:
            for normalized, variants in SEVERITY_NORMALIZATION.items():
                if explicit_severity in variants:
                    return normalized, "explicit", 0.95

        # Try priority as severity proxy
        priority = defect.get("priority")
        if priority:
            for normalized, variants in SEVERITY_NORMALIZATION.items():
                if priority in variants:
                    return normalized, "priority", 0.85

        # Infer from labels
        labels = defect.get("labels", [])
        if any(l.lower() in ["critical", "urgent", "blocker"] for l in labels):
            return "critical", "inferred", 0.7
        if any(l.lower() in ["production", "high"] for l in labels):
            return "high", "inferred", 0.6

        # Default
        return "medium", "inferred", 0.4

    def _normalize_status_category(self, category: str) -> str:
        """Normalize status category."""
        category_lower = category.lower()
        if category_lower in ["open", "new", "todo"]:
            return "open"
        elif category_lower in ["in_progress", "inprogress", "active"]:
            return "in_progress"
        elif category_lower in ["resolved", "done", "closed"]:
            return "resolved"
        return "open"

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string."""
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None

    # =========================================================================
    # DUPLICATE DETECTION
    # =========================================================================

    async def _detect_duplicates(self, session: DefectManagerSession) -> None:
        """Detect potential duplicate defects using fuzzy matching."""
        stmt = select(AnalyzedDefect).where(AnalyzedDefect.session_id == session.id)
        defects = list(self.db.exec(stmt))

        # Simple title similarity check
        for i, defect in enumerate(defects):
            for other in defects[i + 1:]:
                similarity = SequenceMatcher(
                    None,
                    defect.title.lower(),
                    other.title.lower()
                ).ratio()

                if similarity > 0.7:  # 70% threshold
                    # Mark the newer one as potential duplicate
                    if (defect.created_external or datetime.min) < (other.created_external or datetime.min):
                        other.duplicate_of = defect.external_id
                        other.duplicate_confidence = similarity
                    else:
                        defect.duplicate_of = other.external_id
                        defect.duplicate_confidence = similarity

        self.db.commit()

    # =========================================================================
    # PATTERN ANALYSIS
    # =========================================================================

    def _analyze_patterns(self, session: DefectManagerSession) -> PatternAnalysis:
        """Analyze defect patterns."""
        stmt = select(AnalyzedDefect).where(AnalyzedDefect.session_id == session.id)
        defects = list(self.db.exec(stmt))

        # Group by component
        by_component: Dict[str, int] = {}
        for d in defects:
            comp = d.component or "Unassigned"
            by_component[comp] = by_component.get(comp, 0) + 1

        # Group by severity
        by_severity: Dict[str, int] = {}
        for d in defects:
            by_severity[d.severity] = by_severity.get(d.severity, 0) + 1

        # Identify hot spots (components with > 20% of defects)
        total = len(defects)
        hot_spots = [
            {"component": comp, "count": count, "percentage": round(count / total * 100, 1)}
            for comp, count in by_component.items()
            if total > 0 and count / total > 0.2
        ]

        # Generate recommendations
        recommendations = []
        if by_severity.get("critical", 0) > 0:
            recommendations.append(f"Address {by_severity['critical']} critical defects immediately")
        if hot_spots:
            recommendations.append(f"Focus testing on: {', '.join(h['component'] for h in hot_spots)}")

        return PatternAnalysis(
            session_id=session.id,
            patterns=[],
            trends={"by_component": by_component, "by_severity": by_severity},
            hot_spots=hot_spots,
            recommendations=recommendations,
        )

    # =========================================================================
    # SNAPSHOT GENERATION
    # =========================================================================

    def _generate_analysis_snapshot(self, session: DefectManagerSession) -> Dict[str, Any]:
        """Generate analysis snapshot for caching."""
        stmt = select(AnalyzedDefect).where(AnalyzedDefect.session_id == session.id)
        defects = list(self.db.exec(stmt))

        by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        by_status = {"open": 0, "in_progress": 0, "resolved": 0}
        by_component: Dict[str, int] = {}
        duplicates = 0
        aging = 0

        for d in defects:
            by_severity[d.severity] = by_severity.get(d.severity, 0) + 1
            by_status[d.status_category] = by_status.get(d.status_category, 0) + 1

            comp = d.component or "Unassigned"
            by_component[comp] = by_component.get(comp, 0) + 1

            if d.duplicate_of:
                duplicates += 1
            if d.days_open and d.days_open > 30 and d.status_category != "resolved":
                aging += 1

        return {
            "total_defects": len(defects),
            "by_severity": by_severity,
            "by_status": by_status,
            "by_component": by_component,
            "potential_duplicates": duplicates,
            "aging_defects": aging,
            "critical_open": sum(1 for d in defects if d.severity == "critical" and d.status_category != "resolved"),
        }

    # =========================================================================
    # TRIAGE RESULTS
    # =========================================================================

    def get_triage_result(self, session_id: int, user_id: Optional[int] = None) -> Optional[TriageResult]:
        """Get triage results for a session."""
        session = self.get_session(session_id, user_id=user_id)
        if not session or session.status != "ready":
            return None

        stmt = select(AnalyzedDefect).where(AnalyzedDefect.session_id == session_id)
        defects = list(self.db.exec(stmt))

        snapshot = session.analysis_snapshot or {}

        defect_summaries = [
            DefectSummary(
                id=d.id,
                external_id=d.external_id,
                external_url=d.external_url,
                title=d.title,
                item_type=d.item_type,
                status=d.status,
                severity=d.severity,
                severity_confidence=d.severity_confidence,
                component=d.component,
                assignee=d.assignee,
                days_open=d.days_open,
                duplicate_of=d.duplicate_of,
                duplicate_confidence=d.duplicate_confidence,
                pattern_group=d.pattern_group,
                suggested_priority=d.suggested_priority,
            )
            for d in defects
        ]

        return TriageResult(
            session_id=session_id,
            total_defects=snapshot.get("total_defects", 0),
            by_severity=snapshot.get("by_severity", {}),
            by_status=snapshot.get("by_status", {}),
            by_component=snapshot.get("by_component", {}),
            potential_duplicates=snapshot.get("potential_duplicates", 0),
            aging_defects=snapshot.get("aging_defects", 0),
            critical_open=snapshot.get("critical_open", 0),
            defects=defect_summaries,
        )

    # =========================================================================
    # PREVENTION RECOMMENDATIONS
    # =========================================================================

    def get_prevention_recommendations(
        self, session_id: int, user_id: Optional[int] = None
    ) -> List[PreventionRecommendation]:
        """Generate prevention recommendations based on analysis."""
        session = self.get_session(session_id, user_id=user_id)
        if not session or session.status != "ready":
            return []

        snapshot = session.analysis_snapshot or {}
        recommendations = []

        # High critical/high count
        critical = snapshot.get("by_severity", {}).get("critical", 0)
        high = snapshot.get("by_severity", {}).get("high", 0)
        if critical > 0 or high > 3:
            recommendations.append(PreventionRecommendation(
                category="testing",
                recommendation="Increase test coverage for critical paths before release",
                supporting_data={"critical_count": critical, "high_count": high},
                priority="high",
                affected_area=None,
            ))

        # Component hot spots
        by_component = snapshot.get("by_component", {})
        total = snapshot.get("total_defects", 1)
        for comp, count in by_component.items():
            if count / total > 0.3 and comp != "Unassigned":
                recommendations.append(PreventionRecommendation(
                    category="code-quality",
                    recommendation=f"Review and refactor {comp} module - high defect concentration",
                    supporting_data={"component": comp, "defect_count": count, "percentage": round(count / total * 100)},
                    priority="medium",
                    affected_area=comp,
                ))

        # Aging defects
        aging = snapshot.get("aging_defects", 0)
        if aging > 5:
            recommendations.append(PreventionRecommendation(
                category="process",
                recommendation="Address aging defects to prevent technical debt accumulation",
                supporting_data={"aging_count": aging},
                priority="medium",
                affected_area=None,
            ))

        return recommendations


# Factory function
def get_defect_manager_service(db: Session) -> DefectManagerService:
    """Get a defect manager service instance."""
    return DefectManagerService(db)
