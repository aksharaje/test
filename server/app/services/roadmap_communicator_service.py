"""
Roadmap Communicator Service

Service layer for the Roadmap Communicator that generates audience-tailored
roadmap presentations with narratives and talking points.

Pipeline stages (5 specialized agents):
1. Audience Analyzer - Determine presentation strategy for audience
2. View Generator - Create audience-specific roadmap views
3. Narrative Creator - Generate written narrative and explanations
4. Talking Points Generator - Create bullet points and Q&A prep
5. Visual Formatter - Assemble polished presentation
"""
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select

from app.models.roadmap_communicator import (
    CommunicatorSession,
    GeneratedPresentation,
    CommunicatorSessionCreate,
    CommunicatorSessionResponse,
    PresentationConfig,
    AUDIENCE_CONFIGS,
)
from app.models.roadmap_planner import (
    RoadmapSession,
    RoadmapItem,
    RoadmapTheme,
    RoadmapMilestone,
)
from app.models.scenario_modeler import ScenarioVariant
from app.services.llm_json_utils import get_strict_json_llm, StrictJSONLLM


class RoadmapCommunicatorService:
    """Service for Roadmap Communicator operations"""

    def __init__(self, db: Session):
        self.db = db
        self._llm: Optional[StrictJSONLLM] = None

    @property
    def llm(self) -> StrictJSONLLM:
        """Lazy load the strict JSON LLM"""
        if self._llm is None:
            self._llm = get_strict_json_llm()
        return self._llm

    # =========================================================================
    # Session Management
    # =========================================================================

    def create_session(
        self,
        data: CommunicatorSessionCreate,
        user_id: Optional[int] = None
    ) -> CommunicatorSession:
        """Create a new communicator session from a roadmap or scenario"""
        # Verify roadmap exists
        roadmap = self.db.get(RoadmapSession, data.roadmap_session_id)
        if not roadmap:
            raise ValueError(f"Roadmap session {data.roadmap_session_id} not found")

        # Get source data (either from roadmap or scenario variant)
        if data.scenario_variant_id:
            variant = self.db.get(ScenarioVariant, data.scenario_variant_id)
            if not variant:
                raise ValueError(f"Scenario variant {data.scenario_variant_id} not found")
            source_snapshot = variant.generated_roadmap
        else:
            source_snapshot = self._create_roadmap_snapshot(data.roadmap_session_id)

        session = CommunicatorSession(
            user_id=user_id,
            roadmap_session_id=data.roadmap_session_id,
            scenario_variant_id=data.scenario_variant_id,
            name=data.name or f"Presentations for {roadmap.name}",
            description=data.description,
            source_snapshot=source_snapshot,
            status="draft",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int, user_id: Optional[int] = None) -> Optional[CommunicatorSession]:
        """Get a session by ID"""
        session = self.db.get(CommunicatorSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def get_sessions(self, user_id: Optional[int] = None) -> List[CommunicatorSession]:
        """Get all sessions, optionally filtered by user"""
        query = select(CommunicatorSession).order_by(CommunicatorSession.created_at.desc())
        if user_id:
            query = query.where(CommunicatorSession.user_id == user_id)
        return list(self.db.exec(query).all())

    def get_sessions_for_roadmap(self, roadmap_session_id: int) -> List[CommunicatorSession]:
        """Get all communicator sessions for a specific roadmap"""
        query = select(CommunicatorSession).where(
            CommunicatorSession.roadmap_session_id == roadmap_session_id
        ).order_by(CommunicatorSession.created_at.desc())
        return list(self.db.exec(query).all())

    def delete_session(self, session_id: int) -> bool:
        """Delete a session and all its presentations"""
        session = self.get_session(session_id)
        if not session:
            return False

        # Delete all presentations first and commit to satisfy FK constraint
        presentations = self.db.exec(
            select(GeneratedPresentation).where(GeneratedPresentation.session_id == session_id)
        ).all()
        for pres in presentations:
            self.db.delete(pres)
        self.db.commit()

        # Now delete the session
        self.db.delete(session)
        self.db.commit()
        return True

    def get_full_session(self, session_id: int) -> Optional[CommunicatorSessionResponse]:
        """Get session with all presentations"""
        session = self.get_session(session_id)
        if not session:
            return None

        presentations = self.get_presentations(session_id)
        return CommunicatorSessionResponse(
            session=session,
            presentations=presentations,
        )

    # =========================================================================
    # Presentation Management
    # =========================================================================

    def get_presentations(self, session_id: int) -> List[GeneratedPresentation]:
        """Get all presentations for a session"""
        query = select(GeneratedPresentation).where(
            GeneratedPresentation.session_id == session_id
        ).order_by(GeneratedPresentation.created_at)
        return list(self.db.exec(query).all())

    def get_presentation(self, presentation_id: int) -> Optional[GeneratedPresentation]:
        """Get a presentation by ID"""
        return self.db.get(GeneratedPresentation, presentation_id)

    def delete_presentation(self, presentation_id: int) -> bool:
        """Delete a presentation"""
        presentation = self.get_presentation(presentation_id)
        if not presentation:
            return False

        session = self.get_session(presentation.session_id)
        if session:
            session.total_presentations = max(0, session.total_presentations - 1)
            self.db.add(session)

        self.db.delete(presentation)
        self.db.commit()
        return True

    # =========================================================================
    # Pipeline Execution
    # =========================================================================

    async def generate_presentation(
        self,
        session_id: int,
        config: PresentationConfig
    ) -> GeneratedPresentation:
        """Generate a presentation for a specific audience"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Create presentation record
        audience_config = AUDIENCE_CONFIGS.get(config.audience_type, {})
        audience_profile = config.audience_profile.model_dump() if config.audience_profile else {}

        # Merge with default profile
        default_profile = audience_config.get("default_profile", {})
        merged_profile = {**default_profile, **{k: v for k, v in audience_profile.items() if v}}

        presentation = GeneratedPresentation(
            session_id=session_id,
            audience_type=config.audience_type,
            audience_name=config.audience_name or audience_config.get("name", config.audience_type.title()),
            audience_profile=merged_profile,
            format=config.format,
            status="generating",
        )
        self.db.add(presentation)
        self.db.commit()
        self.db.refresh(presentation)

        try:
            # Update session status
            session.status = "generating"
            session.progress_step = 1
            session.progress_message = f"Generating {presentation.audience_name} presentation..."
            self.db.add(session)
            self.db.commit()

            # Stage 1: Audience Analysis
            strategy = await self._analyze_audience(
                session.source_snapshot,
                config.audience_type,
                merged_profile,
                config.tone,
                config.emphasis_areas
            )
            presentation.presentation_strategy = strategy
            self.db.add(presentation)
            self.db.commit()

            # Stage 2: Generate View
            session.progress_step = 2
            session.progress_message = "Creating audience-specific view..."
            self.db.add(session)
            self.db.commit()

            visualization = await self._generate_view(
                session.source_snapshot,
                config.audience_type,
                strategy,
                merged_profile
            )
            presentation.visualization_data = visualization
            self.db.add(presentation)
            self.db.commit()

            # Stage 3: Generate Narrative
            session.progress_step = 3
            session.progress_message = "Creating narrative..."
            self.db.add(session)
            self.db.commit()

            narrative = await self._generate_narrative(
                session.source_snapshot,
                visualization,
                strategy,
                config.tone
            )
            presentation.narrative = narrative
            self.db.add(presentation)
            self.db.commit()

            # Stage 4: Generate Talking Points
            session.progress_step = 4
            session.progress_message = "Creating talking points..."
            self.db.add(session)
            self.db.commit()

            talking_points = await self._generate_talking_points(
                visualization,
                narrative,
                merged_profile
            )
            presentation.talking_points = talking_points
            self.db.add(presentation)
            self.db.commit()

            # Stage 5: Format Output
            session.progress_step = 5
            session.progress_message = "Formatting presentation..."
            self.db.add(session)
            self.db.commit()

            formatted = self._format_presentation(
                presentation,
                config.format
            )
            presentation.formatted_content = formatted
            presentation.status = "completed"
            presentation.updated_at = datetime.utcnow()
            self.db.add(presentation)

            # Update session
            session.total_presentations += 1
            session.status = "completed"
            session.progress_message = "Presentation complete!"
            session.completed_at = datetime.utcnow()
            self.db.add(session)
            self.db.commit()
            self.db.refresh(presentation)

            return presentation

        except Exception as e:
            presentation.status = "failed"
            presentation.error_message = str(e)
            self.db.add(presentation)

            session.status = "failed"
            session.error_message = str(e)
            self.db.add(session)
            self.db.commit()
            raise

    async def _analyze_audience(
        self,
        roadmap: Dict[str, Any],
        audience_type: str,
        profile: Dict[str, Any],
        tone: str,
        emphasis_areas: List[str]
    ) -> Dict[str, Any]:
        """Stage 1: Analyze audience and determine presentation strategy"""
        audience_config = AUDIENCE_CONFIGS.get(audience_type, {})

        # Build context about the roadmap
        items = roadmap.get("items", [])
        themes = roadmap.get("themes", [])
        milestones = roadmap.get("milestones", [])
        session_data = roadmap.get("session", {})

        prompt = f"""Analyze the audience and determine the optimal presentation strategy.

AUDIENCE TYPE: {audience_type}
AUDIENCE PROFILE: {json.dumps(profile, indent=2)}
TONE: {tone}
EMPHASIS AREAS: {emphasis_areas or "None specified"}

ROADMAP SUMMARY:
- Total items: {len(items)}
- Themes: {[t.get('name') for t in themes]}
- Milestones: {[m.get('name') for m in milestones]}
- Total sprints: {session_data.get('total_sprints', 0)}

REQUIRED JSON OUTPUT FORMAT:
{{
  "focus_areas": ["<area 1>", "<area 2>"],
  "visualization_style": "<timeline_with_themes|now_next_later|swimlane_by_team|feature_timeline|milestone_focused>",
  "narrative_structure": "<chronological|theme_based|problem_solution|value_driven>",
  "detail_level": "<high_level|moderate|detailed>",
  "key_messages": [
    "<message 1>",
    "<message 2>",
    "<message 3>"
  ],
  "items_to_highlight": ["<item title 1>", "<item title 2>"],
  "items_to_hide": ["<item title to exclude>"],
  "recommended_slide_count": <integer>,
  "recommended_duration_minutes": <integer>
}}

RULES:
1. Tailor strategy to audience interests and concerns
2. Choose appropriate detail level for audience
3. Identify 3-5 key messages that resonate with this audience
4. Return ONLY valid JSON"""

        result = self.llm.call(
            prompt=prompt,
            context="Audience Analysis",
            max_tokens=2000,
            required_keys=["focus_areas", "key_messages"],
            fallback_value={
                "focus_areas": audience_config.get("focus", "").split(", "),
                "visualization_style": audience_config.get("visualization_style", "timeline_with_themes"),
                "narrative_structure": "theme_based",
                "detail_level": profile.get("detail_level", "moderate"),
                "key_messages": ["Roadmap aligns with strategic priorities"],
                "items_to_highlight": [],
                "items_to_hide": [],
                "recommended_slide_count": 10,
                "recommended_duration_minutes": 15
            }
        )

        return result

    async def _generate_view(
        self,
        roadmap: Dict[str, Any],
        audience_type: str,
        strategy: Dict[str, Any],
        profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Stage 2: Generate audience-specific roadmap view"""
        items = roadmap.get("items", [])
        themes = roadmap.get("themes", [])
        milestones = roadmap.get("milestones", [])
        session_data = roadmap.get("session", {})

        detail_level = strategy.get("detail_level", "moderate")
        items_to_hide = strategy.get("items_to_hide", [])
        items_to_highlight = strategy.get("items_to_highlight", [])

        # Filter items based on audience and detail level
        filtered_items = []
        for item in items:
            # Skip hidden items
            if item.get("title") in items_to_hide:
                continue

            # Skip excluded items
            if item.get("is_excluded"):
                continue

            # For customer view, only show customer-facing items (features)
            if audience_type == "customer" and item.get("item_type") not in ["feature", "epic"]:
                continue

            # For high-level view, only show high-priority items
            if detail_level == "high_level" and item.get("priority", 3) > 2:
                continue

            filtered_items.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "description": item.get("description", "")[:200],
                "priority": item.get("priority"),
                "sprint": item.get("assigned_sprint"),
                "theme_id": item.get("theme_id"),
                "effort": item.get("effort_points"),
                "is_highlighted": item.get("title") in items_to_highlight,
            })

        # Create theme lookup
        theme_lookup = {t.get("id"): t for t in themes}

        # Group by visualization style
        visualization_style = strategy.get("visualization_style", "timeline_with_themes")

        if visualization_style == "timeline_with_themes":
            # Group items by theme
            grouped_data = {}
            for theme in themes:
                theme_items = [i for i in filtered_items if i.get("theme_id") == theme.get("id")]
                if theme_items:
                    grouped_data[theme.get("name")] = {
                        "color": theme.get("color"),
                        "items": theme_items
                    }

        elif visualization_style == "now_next_later":
            # Group by timing (Now = Sprint 1-2, Next = 3-4, Later = 5+)
            now_items = [i for i in filtered_items if (i.get("sprint") or 99) <= 2]
            next_items = [i for i in filtered_items if 3 <= (i.get("sprint") or 0) <= 4]
            later_items = [i for i in filtered_items if (i.get("sprint") or 0) >= 5]
            grouped_data = {
                "now": now_items,
                "next": next_items,
                "later": later_items
            }

        else:
            # Default grouping by sprint
            grouped_data = {}
            for item in filtered_items:
                sprint = item.get("sprint") or "Unassigned"
                if sprint not in grouped_data:
                    grouped_data[sprint] = []
                grouped_data[sprint].append(item)

        return {
            "visualization_style": visualization_style,
            "grouped_items": grouped_data,
            "themes": [{"id": t.get("id"), "name": t.get("name"), "color": t.get("color")} for t in themes],
            "milestones": [{"name": m.get("name"), "sprint": m.get("target_sprint")} for m in milestones],
            "total_sprints": session_data.get("total_sprints", 0),
            "item_count": len(filtered_items),
            "highlighted_items": [i for i in filtered_items if i.get("is_highlighted")],
        }

    async def _generate_narrative(
        self,
        roadmap: Dict[str, Any],
        visualization: Dict[str, Any],
        strategy: Dict[str, Any],
        tone: str
    ) -> Dict[str, Any]:
        """Stage 3: Generate written narrative for the presentation"""
        session_data = roadmap.get("session", {})
        themes = visualization.get("themes", [])
        milestones = visualization.get("milestones", [])
        key_messages = strategy.get("key_messages", [])
        grouped_items = visualization.get("grouped_items", {})

        # Format roadmap items for the prompt
        items_summary = []
        for group_name, group_data in grouped_items.items():
            if isinstance(group_data, dict) and "items" in group_data:
                items = group_data["items"]
            elif isinstance(group_data, list):
                items = group_data
            else:
                continue

            for item in items[:10]:  # Limit items per group
                # Extract clean title (first line only, strip any "Purpose:" suffixes)
                raw_title = item.get("title", "")
                clean_title = raw_title.split('\n')[0].strip()
                if not clean_title:
                    clean_title = raw_title[:80]

                items_summary.append({
                    "title": clean_title,
                    "sprint": item.get("sprint"),
                    "priority": item.get("priority"),
                    "theme": group_name if isinstance(group_data, dict) else None
                })

        prompt = f"""Generate a narrative for a roadmap presentation based on the ACTUAL roadmap items below.

ROADMAP NAME: {session_data.get('name', 'Product Roadmap')}

ROADMAP ITEMS (these are the real features/work items to discuss):
{json.dumps(items_summary[:20], indent=2)}

KEY THEMES: {[t.get('name') for t in themes]}

KEY MILESTONES: {json.dumps([{"name": m.get('name'), "sprint": m.get('sprint')} for m in milestones], indent=2)}

KEY MESSAGES TO CONVEY:
{json.dumps(key_messages, indent=2)}

ROADMAP SUMMARY:
- Total sprints: {session_data.get('total_sprints', 0)}
- Total items: {visualization.get('item_count', 0)}

TONE: {tone}
NARRATIVE STRUCTURE: {strategy.get('narrative_structure', 'theme_based')}

REQUIRED JSON OUTPUT FORMAT:
{{
  "opening": "<compelling opening statement that frames the roadmap>",
  "sections": [
    {{
      "title": "<section title>",
      "content": "<2-3 sentences about this section>",
      "key_points": ["<point 1>", "<point 2>"]
    }}
  ],
  "trade_off_explanations": [
    {{
      "decision": "<what was decided>",
      "rationale": "<why this decision was made>",
      "alternative_considered": "<what alternative was considered>"
    }}
  ],
  "closing": "<call-to-action or next steps statement>"
}}

RULES:
1. CRITICAL: Reference the ACTUAL roadmap items by name in your narrative
2. Opening should mention specific features/items from the roadmap
3. Each section should discuss specific roadmap items and their business value
4. Include 3-5 sections organized by theme or timeline
5. Key points should be SHORT, ORIGINAL bullet points you write (e.g., "Enables SSO authentication", "Reduces checkout friction") - NOT copied from input
6. Write complete, polished sentences - no truncated text
7. Closing should summarize specific deliverables mentioned
8. Match the specified tone throughout
9. Return ONLY valid JSON"""

        result = self.llm.call(
            prompt=prompt,
            context="Narrative",
            max_tokens=3000,
            required_keys=["opening", "sections", "closing"],
            fallback_value={
                "opening": "This roadmap outlines our delivery plan for the upcoming period.",
                "sections": [
                    {
                        "title": "Overview",
                        "content": "Our roadmap is organized around key strategic themes.",
                        "key_points": ["Aligned with business objectives", "Capacity-matched delivery"]
                    }
                ],
                "trade_off_explanations": [],
                "closing": "We look forward to your feedback and support as we execute this plan."
            }
        )

        return result

    async def _generate_talking_points(
        self,
        visualization: Dict[str, Any],
        narrative: Dict[str, Any],
        profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Stage 4: Generate talking points and Q&A preparation"""
        highlighted_items = visualization.get("highlighted_items", [])
        sections = narrative.get("sections", [])
        concerns = profile.get("concerns", [])

        prompt = f"""Generate talking points and anticipated Q&A for a roadmap presentation.

PRESENTATION SECTIONS:
{json.dumps([s.get('title') for s in sections], indent=2)}

HIGHLIGHTED ITEMS:
{json.dumps([i.get('title') for i in highlighted_items], indent=2)}

AUDIENCE CONCERNS:
{json.dumps(concerns, indent=2)}

REQUIRED JSON OUTPUT FORMAT:
{{
  "key_messages": [
    {{
      "message": "<main point>",
      "supporting_points": ["<sub-point 1>", "<sub-point 2>"],
      "data_point": "<metric or evidence to cite>"
    }}
  ],
  "anticipated_qa": [
    {{
      "question": "<likely question>",
      "suggested_response": "<recommended answer>",
      "backup_data": "<supporting evidence if challenged>"
    }}
  ],
  "metrics_to_reference": [
    {{
      "metric": "<metric name>",
      "value": "<value>",
      "context": "<why this matters>"
    }}
  ],
  "transition_phrases": ["<phrase 1>", "<phrase 2>"]
}}

RULES:
1. Create 3-5 key messages with supporting points
2. Anticipate 3-5 likely questions based on audience concerns
3. Include relevant metrics and data points
4. Provide helpful transition phrases
5. Return ONLY valid JSON"""

        result = self.llm.call(
            prompt=prompt,
            context="Talking Points",
            max_tokens=3000,
            required_keys=["key_messages", "anticipated_qa"],
            fallback_value={
                "key_messages": [
                    {
                        "message": "Our roadmap is strategically aligned",
                        "supporting_points": ["Addresses top priorities", "Capacity-matched"],
                        "data_point": f"{visualization.get('item_count', 0)} items planned"
                    }
                ],
                "anticipated_qa": [
                    {
                        "question": "What are the main risks?",
                        "suggested_response": "We've identified dependencies and capacity constraints which we're actively managing.",
                        "backup_data": "Risk mitigation strategies are in place"
                    }
                ],
                "metrics_to_reference": [],
                "transition_phrases": ["Let me now walk you through...", "Moving to the next theme..."]
            }
        )

        return result

    def _format_presentation(
        self,
        presentation: GeneratedPresentation,
        format: str
    ) -> str:
        """Stage 5: Format the presentation output"""
        narrative = presentation.narrative
        talking_points = presentation.talking_points
        visualization = presentation.visualization_data

        if format == "json":
            return json.dumps({
                "audience": presentation.audience_name,
                "narrative": narrative,
                "talking_points": talking_points,
                "visualization": visualization
            }, indent=2)

        elif format == "html":
            return self._format_as_html(presentation)

        else:  # markdown
            return self._format_as_markdown(presentation)

    def _format_as_markdown(self, presentation: GeneratedPresentation) -> str:
        """Format presentation as Markdown (narrative content only, talking points shown separately in UI)"""
        narrative = presentation.narrative
        visualization = presentation.visualization_data

        lines = []

        # Title
        lines.append(f"# Roadmap Presentation: {presentation.audience_name}")
        lines.append("")

        # Opening
        lines.append("## Overview")
        lines.append(narrative.get("opening", ""))
        lines.append("")

        # Sections
        for section in narrative.get("sections", []):
            lines.append(f"## {section.get('title', 'Section')}")
            lines.append(section.get("content", ""))
            if section.get("key_points"):
                lines.append("")
                for point in section["key_points"]:
                    lines.append(f"- {point}")
            lines.append("")

        # Milestones
        milestones = visualization.get("milestones", [])
        if milestones:
            lines.append("## Key Milestones")
            for ms in milestones:
                lines.append(f"- **{ms.get('name')}** (Sprint {ms.get('sprint', 'TBD')})")
            lines.append("")

        # Closing
        lines.append("## Next Steps")
        lines.append(narrative.get("closing", ""))

        return "\n".join(lines)

    def _format_as_html(self, presentation: GeneratedPresentation) -> str:
        """Format presentation as clean HTML fragment for embedding"""
        import re
        # Convert markdown to basic HTML
        md_content = self._format_as_markdown(presentation)
        html_lines = []
        in_list = False

        # Simple markdown to HTML conversion
        for line in md_content.split("\n"):
            # Close list if we were in one and hit non-list content
            if in_list and not line.startswith("- "):
                html_lines.append("</ul>")
                in_list = False

            if line.startswith("# "):
                html_lines.append(f"<h1>{line[2:]}</h1>")
            elif line.startswith("## "):
                html_lines.append(f"<h2>{line[3:]}</h2>")
            elif line.startswith("### "):
                html_lines.append(f"<h3>{line[4:]}</h3>")
            elif line.startswith("- "):
                if not in_list:
                    html_lines.append("<ul>")
                    in_list = True
                # Convert **text** to <strong>text</strong>
                content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', line[2:])
                html_lines.append(f"<li>{content}</li>")
            elif line.strip():
                # Convert **text** to <strong>text</strong>
                content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', line)
                html_lines.append(f"<p>{content}</p>")

        # Close list if still open
        if in_list:
            html_lines.append("</ul>")

        return "\n".join(html_lines)

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _create_roadmap_snapshot(self, roadmap_session_id: int) -> Dict[str, Any]:
        """Create a snapshot of the current roadmap state"""
        roadmap = self.db.get(RoadmapSession, roadmap_session_id)
        if not roadmap:
            return {}

        items = self.db.exec(
            select(RoadmapItem).where(RoadmapItem.session_id == roadmap_session_id)
        ).all()

        themes = self.db.exec(
            select(RoadmapTheme).where(RoadmapTheme.session_id == roadmap_session_id)
        ).all()

        milestones = self.db.exec(
            select(RoadmapMilestone).where(RoadmapMilestone.session_id == roadmap_session_id)
        ).all()

        return {
            "session": {
                "id": roadmap.id,
                "name": roadmap.name,
                "sprint_length_weeks": roadmap.sprint_length_weeks,
                "team_velocity": roadmap.team_velocity,
                "total_sprints": roadmap.total_sprints,
            },
            "items": [
                {
                    "id": item.id,
                    "title": item.title,
                    "description": item.description,
                    "priority": item.priority,
                    "effort_points": item.effort_points,
                    "item_type": item.item_type,
                    "assigned_sprint": item.assigned_sprint,
                    "theme_id": item.theme_id,
                    "is_excluded": item.is_excluded,
                }
                for item in items
            ],
            "themes": [
                {
                    "id": theme.id,
                    "name": theme.name,
                    "description": theme.description,
                    "color": theme.color,
                }
                for theme in themes
            ],
            "milestones": [
                {
                    "id": ms.id,
                    "name": ms.name,
                    "target_sprint": ms.target_sprint,
                    "theme_id": ms.theme_id,
                }
                for ms in milestones
            ],
        }

    def get_audience_types(self) -> List[Dict[str, Any]]:
        """Get available audience types with their configurations"""
        return [
            {"id": key, **value}
            for key, value in AUDIENCE_CONFIGS.items()
        ]
