"""
Roadmap Planner Service

Service layer for the Roadmap Planner that transforms prioritized backlog items
into a sequenced, capacity-matched roadmap using a multi-agent pipeline.

Pipeline stages (5 specialized agents):
1. Sequencing Agent - Analyze priorities, order items by value/risk/effort
2. Dependency Agent - Identify technical/business dependencies, detect cycles
3. Theme Agent - Cluster items into strategic themes
4. Capacity Agent - Match items to sprints based on team velocity
5. Milestones Agent - Suggest delivery milestones aligned with themes
"""
import json
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlmodel import Session, select

from app.models.roadmap_planner import (
    RoadmapSession,
    RoadmapItem,
    RoadmapItemSegment,
    RoadmapDependency,
    RoadmapTheme,
    RoadmapMilestone,
    JiraFieldMapping,
    JiraSyncLog,
    RoadmapSessionCreate,
    RoadmapItemUpdate,
    RoadmapDependencyCreate,
    RoadmapMilestoneCreate,
    RoadmapMilestoneUpdate,
    RoadmapSegmentCreate,
    RoadmapSegmentUpdate,
    RoadmapSegmentBulkUpdate,
    JiraFieldMappingCreate,
    AvailableArtifactForRoadmap,
    AvailableFeasibilityForRoadmap,
    AvailableIdeaForRoadmap,
    AllAvailableSourcesResponse,
    SprintSummary,
    DependencyGraph,
    DependencyGraphNode,
    DependencyGraphEdge,
)
from app.models.story_generator import GeneratedArtifact
from app.models.feasibility import FeasibilitySession, TechnicalComponent, TimelineScenario
from app.models.ideation import GeneratedIdea
from app.services.llm_json_utils import get_strict_json_llm, create_json_prompt, StrictJSONLLM


# Theme colors for auto-assignment
THEME_COLORS = [
    "#3b82f6",  # Blue
    "#10b981",  # Emerald
    "#f59e0b",  # Amber
    "#8b5cf6",  # Purple
    "#ec4899",  # Pink
    "#06b6d4",  # Cyan
    "#6366f1",  # Indigo
    "#ef4444",  # Red
]


class RoadmapPlannerService:
    """Service for Roadmap Planner operations"""

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

    def create_session(self, data: RoadmapSessionCreate, user_id: Optional[int] = None) -> RoadmapSession:
        """Create a new roadmap planning session"""
        # Convert custom items to dict for storage
        custom_items_dict = [item.model_dump() for item in data.custom_items] if data.custom_items else []

        session = RoadmapSession(
            user_id=user_id,
            name=data.name,
            description=data.description,
            artifact_ids=data.artifact_ids,
            feasibility_ids=data.feasibility_ids,
            ideation_ids=data.ideation_ids,
            custom_items=custom_items_dict,
            sprint_length_weeks=data.sprint_length_weeks,
            team_velocity=data.team_velocity,
            team_count=data.team_count,
            buffer_percentage=data.buffer_percentage,
            start_date=data.start_date or datetime.utcnow(),
            status="draft",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int) -> Optional[RoadmapSession]:
        """Get a session by ID"""
        return self.db.get(RoadmapSession, session_id)

    def get_sessions(self, user_id: Optional[int] = None) -> List[RoadmapSession]:
        """Get all sessions, optionally filtered by user"""
        query = select(RoadmapSession).order_by(RoadmapSession.created_at.desc())
        if user_id:
            query = query.where(RoadmapSession.user_id == user_id)
        return list(self.db.exec(query).all())

    def delete_session(self, session_id: int) -> bool:
        """Delete a session and all related data"""
        session = self.get_session(session_id)
        if not session:
            return False

        # Delete in order of foreign key dependencies
        for log in self.db.exec(select(JiraSyncLog).where(JiraSyncLog.session_id == session_id)).all():
            self.db.delete(log)
        for dep in self.db.exec(select(RoadmapDependency).where(RoadmapDependency.session_id == session_id)).all():
            self.db.delete(dep)
        for milestone in self.db.exec(select(RoadmapMilestone).where(RoadmapMilestone.session_id == session_id)).all():
            self.db.delete(milestone)
        # Delete segments before items (segments reference items)
        items = self.db.exec(select(RoadmapItem).where(RoadmapItem.session_id == session_id)).all()
        for item in items:
            for segment in self.db.exec(select(RoadmapItemSegment).where(RoadmapItemSegment.item_id == item.id)).all():
                self.db.delete(segment)
        for item in items:
            self.db.delete(item)
        for theme in self.db.exec(select(RoadmapTheme).where(RoadmapTheme.session_id == session_id)).all():
            self.db.delete(theme)

        self.db.delete(session)
        self.db.commit()
        return True

    # =========================================================================
    # Available Artifacts (Epics/Features from Story Generator)
    # =========================================================================

    def get_available_artifacts(self) -> List[AvailableArtifactForRoadmap]:
        """Get epics and features from Story Generator available for roadmap planning"""
        # Only fetch epics and features, not individual user stories
        query = select(GeneratedArtifact).where(
            GeneratedArtifact.status.in_(["draft", "final"]),
            GeneratedArtifact.type.in_(["epic", "feature"])
        ).order_by(GeneratedArtifact.created_at.desc())

        artifacts = self.db.exec(query).all()
        result = []

        for artifact in artifacts:
            preview = ""
            effort_estimate = None
            priority = None
            child_count = 0

            try:
                content_data = json.loads(artifact.content) if artifact.content else {}

                if artifact.type == "epic" and content_data.get("epic"):
                    epic = content_data["epic"]
                    preview = epic.get("vision", "")[:200]
                    # Count features as children if available
                    features = epic.get("features", [])
                    child_count = len(features) if features else 0
                    # Estimate effort from features
                    if features:
                        total_effort = 0
                        for f in features:
                            stories = f.get("stories", [])
                            for s in stories:
                                total_effort += s.get("storyPoints", 3)
                        effort_estimate = total_effort if total_effort > 0 else None

                elif artifact.type == "feature" and content_data.get("feature"):
                    feature = content_data["feature"]
                    preview = feature.get("summary", "")[:200]
                    # Count user stories as children
                    stories = feature.get("stories", content_data.get("stories", []))
                    child_count = len(stories) if stories else 0
                    # Sum effort from stories
                    if stories:
                        total_effort = sum(s.get("storyPoints", 3) for s in stories)
                        effort_estimate = total_effort if total_effort > 0 else None

            except (json.JSONDecodeError, KeyError, TypeError):
                preview = artifact.content[:200] if artifact.content else ""

            result.append(AvailableArtifactForRoadmap(
                id=artifact.id,
                title=artifact.title,
                type=artifact.type,
                status=artifact.status,
                created_at=artifact.created_at,
                preview=preview + "..." if len(preview) == 200 else preview,
                effort_estimate=effort_estimate,
                priority=priority,
                child_count=child_count,
            ))

        return result

    def get_available_feasibility_analyses(self) -> List[AvailableFeasibilityForRoadmap]:
        """Get completed feasibility analyses available for roadmap planning"""
        query = select(FeasibilitySession).where(
            FeasibilitySession.status == "completed"
        ).order_by(FeasibilitySession.created_at.desc())

        sessions = self.db.exec(query).all()
        result = []

        for session in sessions:
            # Get total hours from technical components
            components_query = select(TechnicalComponent).where(
                TechnicalComponent.session_id == session.id
            )
            components = self.db.exec(components_query).all()
            total_hours = sum(c.realistic_hours for c in components) if components else None

            # Get realistic timeline weeks
            timeline_query = select(TimelineScenario).where(
                TimelineScenario.session_id == session.id,
                TimelineScenario.scenario_type == "realistic"
            )
            timeline = self.db.exec(timeline_query).first()
            total_weeks = timeline.total_weeks if timeline else None

            # Create title from first 100 chars of feature description
            title = session.feature_description[:100]
            if len(session.feature_description) > 100:
                title += "..."

            result.append(AvailableFeasibilityForRoadmap(
                id=session.id,
                feature_description=session.feature_description,
                title=title,
                go_no_go=session.go_no_go_recommendation,
                confidence=session.confidence_level,
                status=session.status,
                created_at=session.created_at,
                total_hours=total_hours,
                total_weeks=total_weeks,
            ))

        return result

    def get_available_ideation_ideas(self) -> List[AvailableIdeaForRoadmap]:
        """Get ideation ideas available for roadmap planning (final, non-duplicate)"""
        query = select(GeneratedIdea).where(
            GeneratedIdea.is_final == True,
            GeneratedIdea.is_duplicate == False
        ).order_by(GeneratedIdea.composite_score.desc())

        ideas = self.db.exec(query).all()
        result = []

        for idea in ideas:
            result.append(AvailableIdeaForRoadmap(
                id=idea.id,
                title=idea.title,
                description=idea.description[:200] + "..." if len(idea.description) > 200 else idea.description,
                category=idea.category,
                effort_estimate=idea.effort_estimate,
                impact_estimate=idea.impact_estimate,
                composite_score=idea.composite_score,
                session_id=idea.session_id,
                created_at=idea.created_at,
            ))

        return result

    def get_all_available_sources(self) -> AllAvailableSourcesResponse:
        """Get all available sources for roadmap planning in one call"""
        return AllAvailableSourcesResponse(
            artifacts=self.get_available_artifacts(),
            feasibility_analyses=self.get_available_feasibility_analyses(),
            ideation_ideas=self.get_available_ideation_ideas(),
        )

    # =========================================================================
    # Items, Dependencies, Themes, Milestones CRUD
    # =========================================================================

    def get_items(self, session_id: int) -> List[RoadmapItem]:
        """Get all items for a session"""
        query = select(RoadmapItem).where(
            RoadmapItem.session_id == session_id
        ).order_by(RoadmapItem.sequence_order)
        return list(self.db.exec(query).all())

    def update_item(self, item_id: int, data: RoadmapItemUpdate) -> Optional[RoadmapItem]:
        """Update a roadmap item"""
        item = self.db.get(RoadmapItem, item_id)
        if not item:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)

        # Mark as manually positioned if sprint was changed
        if "assigned_sprint" in update_data or "sprint_position" in update_data:
            item.is_manually_positioned = True

        item.updated_at = datetime.utcnow()
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_dependencies(self, session_id: int) -> List[RoadmapDependency]:
        """Get all dependencies for a session"""
        query = select(RoadmapDependency).where(RoadmapDependency.session_id == session_id)
        return list(self.db.exec(query).all())

    def create_dependency(self, session_id: int, data: RoadmapDependencyCreate) -> RoadmapDependency:
        """Create a manual dependency"""
        dep = RoadmapDependency(
            session_id=session_id,
            from_item_id=data.from_item_id,
            to_item_id=data.to_item_id,
            dependency_type=data.dependency_type,
            rationale=data.rationale,
            is_manual=True,
            confidence=1.0,
        )
        self.db.add(dep)

        # Update session count
        session = self.get_session(session_id)
        if session:
            session.total_dependencies += 1
            self.db.add(session)

        self.db.commit()
        self.db.refresh(dep)
        return dep

    def delete_dependency(self, dep_id: int) -> bool:
        """Delete a dependency"""
        dep = self.db.get(RoadmapDependency, dep_id)
        if not dep:
            return False

        session = self.get_session(dep.session_id)
        if session:
            session.total_dependencies = max(0, session.total_dependencies - 1)
            self.db.add(session)

        self.db.delete(dep)
        self.db.commit()
        return True

    def get_themes(self, session_id: int) -> List[RoadmapTheme]:
        """Get all themes for a session"""
        query = select(RoadmapTheme).where(
            RoadmapTheme.session_id == session_id
        ).order_by(RoadmapTheme.display_order)
        return list(self.db.exec(query).all())

    def get_milestones(self, session_id: int) -> List[RoadmapMilestone]:
        """Get all milestones for a session"""
        query = select(RoadmapMilestone).where(
            RoadmapMilestone.session_id == session_id
        ).order_by(RoadmapMilestone.target_sprint)
        return list(self.db.exec(query).all())

    def create_milestone(self, session_id: int, data: RoadmapMilestoneCreate) -> RoadmapMilestone:
        """Create a milestone"""
        milestone = RoadmapMilestone(
            session_id=session_id,
            name=data.name,
            description=data.description,
            target_sprint=data.target_sprint,
            target_date=data.target_date,
            theme_id=data.theme_id,
            criteria=data.criteria,
            color=data.color,
        )
        self.db.add(milestone)

        session = self.get_session(session_id)
        if session:
            session.total_milestones += 1
            self.db.add(session)

        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def update_milestone(self, milestone_id: int, data: RoadmapMilestoneUpdate) -> Optional[RoadmapMilestone]:
        """Update a milestone"""
        milestone = self.db.get(RoadmapMilestone, milestone_id)
        if not milestone:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(milestone, key, value)

        milestone.updated_at = datetime.utcnow()
        self.db.add(milestone)
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def delete_milestone(self, milestone_id: int) -> bool:
        """Delete a milestone"""
        milestone = self.db.get(RoadmapMilestone, milestone_id)
        if not milestone:
            return False

        session = self.get_session(milestone.session_id)
        if session:
            session.total_milestones = max(0, session.total_milestones - 1)
            self.db.add(session)

        self.db.delete(milestone)
        self.db.commit()
        return True

    # =========================================================================
    # Segments CRUD
    # =========================================================================

    def get_segments(self, session_id: int) -> List[RoadmapItemSegment]:
        """Get all segments for a session (via items)"""
        items = self.get_items(session_id)
        item_ids = [item.id for item in items]
        if not item_ids:
            return []
        query = select(RoadmapItemSegment).where(
            RoadmapItemSegment.item_id.in_(item_ids)
        ).order_by(RoadmapItemSegment.start_sprint, RoadmapItemSegment.assigned_team)
        return list(self.db.exec(query).all())

    def get_segments_for_item(self, item_id: int) -> List[RoadmapItemSegment]:
        """Get all segments for a specific item"""
        query = select(RoadmapItemSegment).where(
            RoadmapItemSegment.item_id == item_id
        ).order_by(RoadmapItemSegment.sequence_order)
        return list(self.db.exec(query).all())

    def create_segment(self, data: RoadmapSegmentCreate) -> RoadmapItemSegment:
        """Create a new segment for an item"""
        # Validate item exists
        item = self.db.get(RoadmapItem, data.item_id)
        if not item:
            raise ValueError(f"Item {data.item_id} not found")

        # Get next sequence order
        existing = self.get_segments_for_item(data.item_id)
        next_order = max([s.sequence_order for s in existing], default=-1) + 1

        segment = RoadmapItemSegment(
            item_id=data.item_id,
            assigned_team=data.assigned_team,
            start_sprint=data.start_sprint,
            sprint_count=data.sprint_count,
            effort_points=data.effort_points,
            row_index=data.row_index,
            sequence_order=next_order,
            label=data.label,
            color_override=data.color_override,
            is_manually_positioned=True,  # User-created segments are manual
        )
        self.db.add(segment)
        self.db.commit()
        self.db.refresh(segment)
        return segment

    def update_segment(self, segment_id: int, data: RoadmapSegmentUpdate) -> Optional[RoadmapItemSegment]:
        """Update a segment"""
        segment = self.db.get(RoadmapItemSegment, segment_id)
        if not segment:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(segment, key, value)

        # Mark as manually positioned if position changed
        if any(k in update_data for k in ["start_sprint", "sprint_count", "assigned_team", "row_index"]):
            segment.is_manually_positioned = True

        segment.updated_at = datetime.utcnow()
        self.db.add(segment)
        self.db.commit()
        self.db.refresh(segment)
        return segment

    def update_segments_bulk(self, session_id: int, data: RoadmapSegmentBulkUpdate) -> List[RoadmapItemSegment]:
        """Bulk update segments (for drag-and-drop)"""
        updated_segments = []

        for seg_update in data.segments:
            segment_id = seg_update.get("id")
            if not segment_id:
                continue

            segment = self.db.get(RoadmapItemSegment, segment_id)
            if not segment:
                continue

            # Verify segment belongs to this session
            item = self.db.get(RoadmapItem, segment.item_id)
            if not item or item.session_id != session_id:
                continue

            # Apply updates
            for key, value in seg_update.items():
                if key != "id" and hasattr(segment, key):
                    setattr(segment, key, value)

            segment.is_manually_positioned = True
            segment.updated_at = datetime.utcnow()
            self.db.add(segment)
            updated_segments.append(segment)

        self.db.commit()

        # Refresh all segments
        for segment in updated_segments:
            self.db.refresh(segment)

        return updated_segments

    def delete_segment(self, segment_id: int) -> bool:
        """Delete a segment"""
        segment = self.db.get(RoadmapItemSegment, segment_id)
        if not segment:
            return False

        self.db.delete(segment)
        self.db.commit()
        return True

    def delete_segments_for_item(self, item_id: int) -> int:
        """Delete all segments for an item, returns count deleted"""
        segments = self.get_segments_for_item(item_id)
        count = len(segments)
        for segment in segments:
            self.db.delete(segment)
        self.db.commit()
        return count

    def regenerate_segments_for_item(self, item_id: int) -> List[RoadmapItemSegment]:
        """
        Regenerate default segments for an item based on its current
        assigned_sprint, sprint_span, assigned_team, and effort_points.
        Deletes existing segments first.
        """
        item = self.db.get(RoadmapItem, item_id)
        if not item:
            return []

        # Delete existing segments
        self.delete_segments_for_item(item_id)

        # Create default segment(s)
        # For now, create a single segment matching the item's assignment
        segment = RoadmapItemSegment(
            item_id=item.id,
            assigned_team=item.assigned_team or 1,
            start_sprint=item.assigned_sprint or 1,
            sprint_count=item.sprint_span or 1,
            effort_points=item.effort_points,
            sequence_order=0,
            row_index=0,
            is_manually_positioned=False,
        )
        self.db.add(segment)
        self.db.commit()
        self.db.refresh(segment)
        return [segment]

    # =========================================================================
    # Dependency Graph
    # =========================================================================

    def get_dependency_graph(self, session_id: int) -> DependencyGraph:
        """Build dependency graph for visualization"""
        items = self.get_items(session_id)
        dependencies = self.get_dependencies(session_id)
        themes = {t.id: t for t in self.get_themes(session_id)}

        nodes = []
        for item in items:
            theme_color = None
            if item.theme_id and item.theme_id in themes:
                theme_color = themes[item.theme_id].color

            nodes.append(DependencyGraphNode(
                id=item.id,
                title=item.title,
                sprint=item.assigned_sprint,
                theme_id=item.theme_id,
                theme_color=theme_color,
            ))

        edges = []
        for dep in dependencies:
            edges.append(DependencyGraphEdge(
                from_id=dep.from_item_id,
                to_id=dep.to_item_id,
                dependency_type=dep.dependency_type,
                is_blocking=dep.dependency_type in ["blocks", "depends_on"],
            ))

        # Detect cycles
        has_cycles, cycle_items = self._detect_cycles(items, dependencies)

        return DependencyGraph(
            nodes=nodes,
            edges=edges,
            has_cycles=has_cycles,
            cycle_items=cycle_items,
        )

    def _detect_cycles(self, items: List[RoadmapItem], dependencies: List[RoadmapDependency]) -> Tuple[bool, List[int]]:
        """Detect cycles in dependency graph using DFS"""
        # Build adjacency list
        graph: Dict[int, List[int]] = {item.id: [] for item in items}
        for dep in dependencies:
            if dep.dependency_type in ["blocks", "depends_on"]:
                graph[dep.from_item_id].append(dep.to_item_id)

        visited = set()
        rec_stack = set()
        cycle_items = set()

        def dfs(node: int, path: List[int]) -> bool:
            visited.add(node)
            rec_stack.add(node)

            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor, path + [neighbor]):
                        cycle_items.update(path + [neighbor])
                        return True
                elif neighbor in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor) if neighbor in path else 0
                    cycle_items.update(path[cycle_start:] + [neighbor])
                    return True

            rec_stack.remove(node)
            return False

        for item in items:
            if item.id not in visited:
                if dfs(item.id, [item.id]):
                    pass  # Continue checking all nodes

        return len(cycle_items) > 0, list(cycle_items)

    # =========================================================================
    # Sprint Summaries
    # =========================================================================

    def get_sprint_summaries(self, session_id: int) -> List[SprintSummary]:
        """Get sprint-by-sprint breakdown, accounting for items that span multiple sprints"""
        session = self.get_session(session_id)
        if not session:
            return []

        items = self.get_items(session_id)
        if not items:
            return []

        # Find all sprints that have work (including spanned sprints)
        all_sprint_nums = set()
        for item in items:
            if item.assigned_sprint is not None and not item.is_excluded:
                sprint_span = getattr(item, 'sprint_span', 1) or 1
                for s in range(item.assigned_sprint, item.assigned_sprint + sprint_span):
                    all_sprint_nums.add(s)

        if not all_sprint_nums:
            return []

        # Group items by the sprints they occupy
        # An item appears in all sprints it spans
        sprint_items: Dict[int, List[RoadmapItem]] = {s: [] for s in all_sprint_nums}
        sprint_points: Dict[int, int] = {s: 0 for s in all_sprint_nums}

        for item in items:
            if item.assigned_sprint is not None and not item.is_excluded:
                sprint_span = getattr(item, 'sprint_span', 1) or 1
                # Calculate points per sprint for this item
                points_per_sprint = item.effort_points / sprint_span if sprint_span > 0 else item.effort_points

                # Add to start sprint's item list (item appears once in its start sprint)
                if item.assigned_sprint in sprint_items:
                    sprint_items[item.assigned_sprint].append(item)

                # Distribute points across all sprints in the span
                for s in range(item.assigned_sprint, item.assigned_sprint + sprint_span):
                    if s in sprint_points:
                        sprint_points[s] += points_per_sprint

        # Calculate capacity with buffer (velocity per team * number of teams * buffer)
        effective_velocity = int(session.team_velocity * session.team_count * (1 - session.buffer_percentage / 100))

        summaries = []
        for sprint_num in sorted(all_sprint_nums):
            items_in_sprint = sprint_items.get(sprint_num, [])
            total_points = int(sprint_points.get(sprint_num, 0))

            # Calculate dates
            start_date = None
            end_date = None
            if session.start_date:
                sprint_days = (sprint_num - 1) * session.sprint_length_weeks * 7
                start_date = session.start_date + timedelta(days=sprint_days)
                end_date = start_date + timedelta(days=session.sprint_length_weeks * 7 - 1)

            summaries.append(SprintSummary(
                sprint_number=sprint_num,
                total_points=total_points,
                capacity=effective_velocity,
                utilization_percentage=round(total_points / effective_velocity * 100, 1) if effective_velocity > 0 else 0,
                item_count=len(items_in_sprint),
                items=items_in_sprint,
                start_date=start_date,
                end_date=end_date,
            ))

        return summaries

    # =========================================================================
    # Pipeline Execution
    # =========================================================================

    async def run_pipeline(self, session_id: int) -> RoadmapSession:
        """Run the full roadmap planning pipeline"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "processing"
            session.progress_step = 0
            session.progress_message = "Starting pipeline..."
            self.db.add(session)
            self.db.commit()

            # Stage 1: Load and sequence items
            await self._stage_sequencing(session)

            # Stage 2: Identify dependencies
            await self._stage_dependencies(session)

            # Stage 3: Cluster into themes
            await self._stage_themes(session)

            # Stage 4: Capacity planning
            await self._stage_capacity(session)

            # Stage 5: Generate milestones
            await self._stage_milestones(session)

            # Update final counts
            session.total_items = len(self.get_items(session.id))
            session.total_dependencies = len(self.get_dependencies(session.id))
            session.total_themes = len(self.get_themes(session.id))
            session.total_milestones = len(self.get_milestones(session.id))

            # Calculate total sprints
            items = self.get_items(session.id)
            max_sprint = max((item.assigned_sprint or 0 for item in items), default=0)
            session.total_sprints = max_sprint

            session.status = "completed"
            session.progress_step = 5
            session.progress_message = "Roadmap complete!"
            session.completed_at = datetime.utcnow()
            self.db.add(session)
            self.db.commit()

            return session

        except Exception as e:
            session = self.get_session(session_id)
            if session:
                session.status = "failed"
                session.error_message = str(e)
                self.db.add(session)
                self.db.commit()
            raise

    async def _stage_sequencing(self, session: RoadmapSession):
        """Stage 1: Load items from all sources and determine optimal sequence"""
        session.status = "sequencing"
        session.progress_step = 1
        session.progress_message = "Analyzing priorities and sequencing items..."
        self.db.add(session)
        self.db.commit()

        # Collect items from all sources
        all_items = []

        # 1. Load epics/features from Story Generator artifacts
        for artifact_id in session.artifact_ids or []:
            artifact = self.db.get(GeneratedArtifact, artifact_id)
            if artifact:
                story_info = self._extract_story_info(artifact)
                effort_estimate = self._extract_artifact_effort(artifact)
                all_items.append({
                    "source_id": artifact_id,
                    "source_type": "artifact",
                    "title": artifact.title,
                    "item_type": artifact.type,
                    "description": story_info.get("description", ""),
                    "effort_estimate": effort_estimate,
                })

        # 2. Load feasibility analyses
        # Calculate points per week based on team config
        points_per_sprint = session.team_velocity * session.team_count
        points_per_week = points_per_sprint / session.sprint_length_weeks

        for feasibility_id in session.feasibility_ids or []:
            feas_session = self.db.get(FeasibilitySession, feasibility_id)
            if feas_session:
                # Get realistic timeline weeks for effort estimation
                timeline_query = select(TimelineScenario).where(
                    TimelineScenario.session_id == feas_session.id,
                    TimelineScenario.scenario_type == "realistic"
                )
                timeline = self.db.exec(timeline_query).first()
                total_weeks = timeline.total_weeks if timeline else None

                # Convert weeks to story points based on team capacity
                # If a feature takes 4 weeks and team does 20 pts/week, that's 80 points
                estimated_points = None
                if total_weeks:
                    estimated_points = int(total_weeks * points_per_week)

                title = feas_session.feature_description[:100]
                if len(feas_session.feature_description) > 100:
                    title += "..."

                all_items.append({
                    "source_id": feasibility_id,
                    "source_type": "feasibility",
                    "title": title,
                    "item_type": "feature",
                    "description": feas_session.feature_description,
                    "effort_estimate": estimated_points,
                    "total_weeks": total_weeks,
                    "go_no_go": feas_session.go_no_go_recommendation,
                    "confidence": feas_session.confidence_level,
                })

        # 3. Load ideation ideas (disabled for now)
        # for idea_id in session.ideation_ids or []:
        #     idea = self.db.get(GeneratedIdea, idea_id)
        #     if idea:
        #         effort_map = {"low": 3, "medium": 5, "high": 8}
        #         estimated_points = effort_map.get(idea.effort_estimate, 5)
        #         all_items.append({
        #             "source_id": idea_id,
        #             "source_type": "ideation",
        #             "title": idea.title,
        #             "item_type": "feature",
        #             "description": idea.description,
        #             "effort_estimate": estimated_points,
        #             "impact": idea.impact_estimate,
        #             "category": idea.category,
        #         })

        # 4. Load custom items
        for i, custom in enumerate(session.custom_items or []):
            all_items.append({
                "source_id": i,  # Use index as ID for custom items
                "source_type": "custom",
                "title": custom.get("title", f"Custom Item {i + 1}"),
                "item_type": "feature",
                "description": custom.get("description", ""),
                "effort_estimate": custom.get("effortEstimate"),
            })

        if not all_items:
            return

        # Use LLM to analyze and sequence all items together
        prompt = create_json_prompt(
            task_description=f"""Analyze these {len(all_items)} backlog items from various sources and determine optimal sequencing.

The items come from:
- Story Generator (epics/features)
- Feasibility Analysis (analyzed features with estimates)
- Ideation (brainstormed ideas with impact/effort)
- Custom entries (user-defined items)

Consider:
- Business value and priority
- Risk level (high-risk items may need to be earlier for learning)
- Effort required (use existing estimates as hints where provided)
- Natural groupings and dependencies

ITEMS:
{json.dumps(all_items, indent=2)}""",
            json_schema={
                "sequenced_items": [
                    {
                        "source_id": "Original source ID",
                        "source_type": "Source type: artifact, feasibility, ideation, or custom",
                        "sequence_order": "1-based sequence position",
                        "priority": "1 (highest) to 5 (lowest)",
                        "effort_points": "Story points estimate (1-13 fibonacci-ish scale). Use provided effort_estimate as baseline if available.",
                        "risk_level": "One of: low, medium, high",
                        "value_score": "Business value 1-10",
                        "rationale": "Why this position in sequence"
                    }
                ]
            },
            additional_rules=[
                "Higher value items should generally come earlier",
                "Consider risk-first vs value-first trade-offs",
                "Use Fibonacci-like story points: 1, 2, 3, 5, 8, 13",
                "When effort_estimate is provided, use it as a baseline but adjust if needed",
                "Be realistic about effort estimates",
                "Return exactly one entry per input item",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="Sequencing",
            max_tokens=4000,
            required_keys=["sequenced_items"],
            fallback_value={"sequenced_items": []}
        )

        # Create RoadmapItem records
        sequenced = result.get("sequenced_items", [])

        # Create a map from (source_type, source_id) to sequenced data
        sequence_map = {}
        for item in sequenced:
            key = (item.get("source_type"), item.get("source_id"))
            sequence_map[key] = item

        for i, source_item in enumerate(all_items):
            source_type = source_item["source_type"]
            source_id = source_item["source_id"]
            key = (source_type, source_id)
            seq_data = sequence_map.get(key, {})

            # Determine effort points: LLM estimate > source estimate > default
            effort_points = self._safe_int(seq_data.get("effort_points"))
            if not effort_points and source_item.get("effort_estimate"):
                effort_points = source_item["effort_estimate"]
            if not effort_points:
                effort_points = 3  # Default

            item = RoadmapItem(
                session_id=session.id,
                source_artifact_id=source_id if source_type == "artifact" else None,
                source_type=source_type,
                title=source_item["title"],
                description=source_item.get("description", ""),
                item_type=source_item["item_type"],
                priority=self._safe_int(seq_data.get("priority"), 3),
                effort_points=effort_points,
                risk_level=seq_data.get("risk_level", "medium"),
                value_score=self._safe_int(seq_data.get("value_score")),
                sequence_order=self._safe_int(seq_data.get("sequence_order"), i + 1),
            )
            self.db.add(item)

        self.db.commit()

    def _extract_story_info(self, artifact: GeneratedArtifact) -> Dict[str, Any]:
        """Extract useful info from artifact content"""
        try:
            content_data = json.loads(artifact.content) if artifact.content else {}

            if artifact.type == "epic" and content_data.get("epic"):
                epic = content_data["epic"]
                return {
                    "description": epic.get("vision", ""),
                    "goals": epic.get("goals", []),
                }

            elif artifact.type == "feature" and content_data.get("feature"):
                feature = content_data["feature"]
                return {
                    "description": feature.get("summary", ""),
                    "business_value": feature.get("businessValue", ""),
                }

            elif artifact.type == "user_story" and content_data.get("stories"):
                stories = content_data["stories"]
                first = stories[0] if stories else {}
                return {
                    "description": first.get("userStory", ""),
                    "acceptance_criteria": first.get("acceptanceCriteria", []),
                }

        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        return {"description": artifact.content[:500] if artifact.content else ""}

    def _extract_artifact_effort(self, artifact: GeneratedArtifact) -> Optional[int]:
        """Extract effort estimate (story points) from artifact content"""
        try:
            content_data = json.loads(artifact.content) if artifact.content else {}

            if artifact.type == "epic" and content_data.get("epic"):
                epic = content_data["epic"]
                features = epic.get("features", [])
                if features:
                    total_effort = 0
                    for f in features:
                        stories = f.get("stories", [])
                        for s in stories:
                            total_effort += s.get("storyPoints", 3)
                    return total_effort if total_effort > 0 else None

            elif artifact.type == "feature" and content_data.get("feature"):
                feature = content_data["feature"]
                stories = feature.get("stories", content_data.get("stories", []))
                if stories:
                    total_effort = sum(s.get("storyPoints", 3) for s in stories)
                    return total_effort if total_effort > 0 else None

        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        return None

    async def _stage_dependencies(self, session: RoadmapSession):
        """Stage 2: Identify dependencies between items and external prerequisites"""
        session.status = "analyzing_dependencies"
        session.progress_step = 2
        session.progress_message = "Identifying dependencies..."
        self.db.add(session)
        self.db.commit()

        items = self.get_items(session.id)
        if not items:
            return

        # Prepare items for LLM
        item_data = [
            {"id": item.id, "title": item.title, "description": item.description or "", "type": item.item_type}
            for item in items
        ]

        prompt = create_json_prompt(
            task_description=f"""Analyze these {len(item_data)} roadmap items and identify:
1. Dependencies BETWEEN these items
2. External prerequisites that may be needed but are NOT in this list

ITEMS:
{json.dumps(item_data, indent=2)}""",
            json_schema={
                "internal_dependencies": [
                    {
                        "from_item_id": "ID of the item that blocks or enables another",
                        "to_item_id": "ID of the dependent item",
                        "dependency_type": "One of: blocks, depends_on, related_to, enables",
                        "confidence": "0.0-1.0 confidence score",
                        "rationale": "Brief explanation of why this dependency exists"
                    }
                ],
                "external_prerequisites": [
                    {
                        "item_id": "ID of the item that needs this prerequisite",
                        "prerequisite_type": "One of: backend_system, api, ux_design, infrastructure, data_migration, third_party, security, compliance, other",
                        "description": "What external work/system/resource is needed",
                        "rationale": "Why this prerequisite is needed for the item",
                        "criticality": "One of: blocking, important, nice_to_have"
                    }
                ]
            },
            additional_rules=[
                "Only identify real dependencies, not just thematic relationships",
                "'blocks' means from_item must complete before to_item can start",
                "'depends_on' is the inverse - to_item depends on from_item",
                "'enables' means from_item makes to_item easier but isn't required",
                "'related_to' is informational only, no sequencing constraint",
                "Be conservative with internal dependencies - false ones are worse than missing",
                "For external prerequisites, think about: backend APIs needed, UX designs required, infrastructure setup, data migrations, third-party integrations, security requirements, compliance needs",
                "External prerequisites should be work NOT included in the items list above",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="Dependencies",
            max_tokens=4000,
            required_keys=["internal_dependencies", "external_prerequisites"],
            fallback_value={"internal_dependencies": [], "external_prerequisites": []}
        )

        valid_item_ids = {item.id for item in items}

        # Create internal dependency records
        deps_data = result.get("internal_dependencies", [])
        for dep_data in deps_data:
            from_id = self._safe_int(dep_data.get("from_item_id"))
            to_id = self._safe_int(dep_data.get("to_item_id"))

            # Validate IDs exist
            if from_id not in valid_item_ids or to_id not in valid_item_ids:
                continue
            if from_id == to_id:
                continue

            dep = RoadmapDependency(
                session_id=session.id,
                from_item_id=from_id,
                to_item_id=to_id,
                dependency_type=dep_data.get("dependency_type", "related_to"),
                confidence=float(dep_data.get("confidence", 0.8)),
                rationale=dep_data.get("rationale"),
                is_manual=False,
            )
            self.db.add(dep)

        # Create external prerequisite records
        # We use to_item_id = None to indicate external prerequisite
        # The rationale field stores the prerequisite description
        prereqs_data = result.get("external_prerequisites", [])
        for prereq_data in prereqs_data:
            item_id = self._safe_int(prereq_data.get("item_id"))
            if item_id not in valid_item_ids:
                continue

            prereq_type = prereq_data.get("prerequisite_type", "other")
            description = prereq_data.get("description", "External dependency")
            criticality = prereq_data.get("criticality", "important")

            dep = RoadmapDependency(
                session_id=session.id,
                from_item_id=item_id,
                to_item_id=None,  # None indicates external prerequisite
                dependency_type=f"requires_{prereq_type}",
                confidence=1.0 if criticality == "blocking" else 0.8 if criticality == "important" else 0.5,
                rationale=description,
                is_manual=False,
            )
            self.db.add(dep)

        self.db.commit()

    async def _stage_themes(self, session: RoadmapSession):
        """Stage 3: Cluster items into strategic themes"""
        session.status = "clustering_themes"
        session.progress_step = 3
        session.progress_message = "Clustering into strategic themes..."
        self.db.add(session)
        self.db.commit()

        items = self.get_items(session.id)
        if not items:
            return

        item_data = [
            {"id": item.id, "title": item.title, "description": item.description or "", "type": item.item_type}
            for item in items
        ]

        prompt = create_json_prompt(
            task_description=f"""Analyze these {len(item_data)} roadmap items and group them into 3-7 strategic themes.

ITEMS:
{json.dumps(item_data, indent=2)}""",
            json_schema={
                "themes": [
                    {
                        "name": "Short, descriptive theme name",
                        "description": "What this theme encompasses",
                        "business_objective": "What business goal this theme serves",
                        "success_metrics": ["List of metrics to measure success"],
                        "item_ids": ["List of item IDs belonging to this theme"]
                    }
                ]
            },
            additional_rules=[
                "Create 3-7 themes based on natural groupings",
                "Each item should belong to exactly one theme",
                "Themes should align with business objectives",
                "Use clear, stakeholder-friendly theme names",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="Themes",
            max_tokens=3000,
            required_keys=["themes"],
            fallback_value={"themes": []}
        )

        # Create theme records and assign items
        themes_data = result.get("themes", [])
        valid_item_ids = {item.id for item in items}

        for i, theme_data in enumerate(themes_data):
            theme = RoadmapTheme(
                session_id=session.id,
                name=theme_data.get("name", f"Theme {i+1}"),
                description=theme_data.get("description"),
                business_objective=theme_data.get("business_objective"),
                success_metrics=theme_data.get("success_metrics", []),
                color=THEME_COLORS[i % len(THEME_COLORS)],
                display_order=i,
            )
            self.db.add(theme)
            self.db.commit()
            self.db.refresh(theme)

            # Assign items to theme
            item_ids = theme_data.get("item_ids", [])
            theme_effort = 0
            theme_item_count = 0

            for item_id in item_ids:
                item_id_int = self._safe_int(item_id)
                if item_id_int in valid_item_ids:
                    item = self.db.get(RoadmapItem, item_id_int)
                    if item:
                        item.theme_id = theme.id
                        theme_effort += item.effort_points
                        theme_item_count += 1
                        self.db.add(item)

            theme.total_effort_points = theme_effort
            theme.total_items = theme_item_count
            self.db.add(theme)

        self.db.commit()

    async def _stage_capacity(self, session: RoadmapSession):
        """Stage 4: Match items to sprints based on capacity, distributing across teams"""
        session.status = "matching_capacity"
        session.progress_step = 4
        session.progress_message = "Matching to sprint capacity..."
        self.db.add(session)
        self.db.commit()

        items = self.get_items(session.id)
        dependencies = self.get_dependencies(session.id)

        if not items:
            return

        team_count = session.team_count or 1
        # Calculate effective capacity per team per sprint
        team_velocity = int(session.team_velocity * (1 - session.buffer_percentage / 100))

        # Build dependency graph for topological sort
        blocking_deps = [d for d in dependencies if d.dependency_type in ["blocks", "depends_on"]]

        # Topological sort respecting dependencies
        sorted_items = self._topological_sort(items, blocking_deps)

        if team_count == 1:
            # Single team: simple assignment
            current_sprint = 1
            current_sprint_points = 0

            for item in sorted_items:
                # Calculate how many sprints this item needs
                sprints_needed = max(1, math.ceil(item.effort_points / team_velocity)) if team_velocity > 0 else 1

                # Check if item fits in current sprint
                if current_sprint_points > 0 and current_sprint_points + item.effort_points > team_velocity:
                    # Move to next sprint
                    current_sprint += 1
                    current_sprint_points = 0

                item.assigned_sprint = current_sprint
                item.sprint_span = sprints_needed
                item.assigned_team = None  # No team assignment for single team
                item.sprint_position = current_sprint_points

                # For spanning items, advance to after the span
                if sprints_needed > 1:
                    current_sprint += sprints_needed
                    current_sprint_points = 0
                else:
                    current_sprint_points += item.effort_points
                    # If this fills the sprint, move to next
                    if current_sprint_points >= team_velocity:
                        current_sprint += 1
                        current_sprint_points = 0

                self.db.add(item)
        else:
            # Multiple teams: distribute work across teams
            # Track which sprints are occupied per team (True = occupied by spanning item)
            # team_sprint_points[team_num][sprint_num] = points used (or 'blocked' for spanning)
            team_sprint_points: Dict[int, Dict[int, int]] = {
                team: {} for team in range(1, team_count + 1)
            }
            # Track blocked sprints (occupied by spanning items)
            team_blocked_sprints: Dict[int, set] = {
                team: set() for team in range(1, team_count + 1)
            }

            for item in sorted_items:
                # Calculate how many sprints this item needs
                sprints_needed = max(1, math.ceil(item.effort_points / team_velocity)) if team_velocity > 0 else 1

                # Find the best team/sprint combination
                best_team = None
                best_sprint = float('inf')
                best_load = float('inf')

                for team in range(1, team_count + 1):
                    # Find the earliest sprint where this team can take the item
                    sprint = 1
                    while sprint <= 100:  # Safety limit
                        # Check if this sprint is blocked
                        if sprint in team_blocked_sprints[team]:
                            sprint += 1
                            continue

                        current_points = team_sprint_points[team].get(sprint, 0)

                        if sprints_needed > 1:
                            # For spanning items, need consecutive empty sprints
                            can_fit = True
                            for s in range(sprint, sprint + sprints_needed):
                                if s in team_blocked_sprints[team] or team_sprint_points[team].get(s, 0) > 0:
                                    can_fit = False
                                    break
                            if can_fit and sprint < best_sprint:
                                best_team = team
                                best_sprint = sprint
                                best_load = 0
                                break
                        else:
                            # Normal item: find slot where it fits within capacity
                            if current_points + item.effort_points <= team_velocity:
                                if sprint < best_sprint or (sprint == best_sprint and current_points < best_load):
                                    best_team = team
                                    best_sprint = sprint
                                    best_load = current_points
                                break
                        sprint += 1

                # Fallback if no valid assignment found
                if best_team is None:
                    # Find the team with the least total work
                    team_totals = {
                        t: sum(team_sprint_points[t].values())
                        for t in range(1, team_count + 1)
                    }
                    best_team = min(team_totals, key=team_totals.get)
                    # Find next available sprint range for this team
                    best_sprint = 1
                    while True:
                        can_fit = True
                        for s in range(best_sprint, best_sprint + sprints_needed):
                            if s in team_blocked_sprints[best_team] or team_sprint_points[best_team].get(s, 0) > 0:
                                can_fit = False
                                break
                        if can_fit:
                            break
                        best_sprint += 1
                        if best_sprint > 100:
                            break

                # Assign item to best team/sprint
                item.assigned_sprint = best_sprint
                item.sprint_span = sprints_needed
                item.assigned_team = best_team
                item.sprint_position = team_sprint_points[best_team].get(best_sprint, 0)

                # Update team's sprint capacity / blocked sprints
                if sprints_needed > 1:
                    # Block all sprints in the span
                    for s in range(best_sprint, best_sprint + sprints_needed):
                        team_blocked_sprints[best_team].add(s)
                        team_sprint_points[best_team][s] = team_velocity  # Mark as full
                else:
                    # Normal item: add points to sprint
                    if best_sprint not in team_sprint_points[best_team]:
                        team_sprint_points[best_team][best_sprint] = 0
                    team_sprint_points[best_team][best_sprint] += item.effort_points

                self.db.add(item)

        self.db.commit()

        # Generate initial segments for all items
        self._generate_initial_segments(sorted_items, team_count)

    def _generate_initial_segments(self, items: List[RoadmapItem], team_count: int):
        """
        Generate initial segments for all items based on their current assignment.

        For multi-team scenarios:
        - Single sprint items get one segment
        - Multi-sprint items can be split into segments for flexibility
        """
        for item in items:
            if item.assigned_sprint is None:
                continue

            # Create a single segment matching the item's assignment
            # Users can later split/modify these segments via the UI
            segment = RoadmapItemSegment(
                item_id=item.id,
                assigned_team=item.assigned_team or 1,
                start_sprint=item.assigned_sprint,
                sprint_count=item.sprint_span or 1,
                effort_points=item.effort_points,
                sequence_order=0,
                row_index=0,
                is_manually_positioned=False,
            )
            self.db.add(segment)

        self.db.commit()

    def _topological_sort(self, items: List[RoadmapItem], dependencies: List[RoadmapDependency]) -> List[RoadmapItem]:
        """Sort items respecting dependencies"""
        # Build adjacency and in-degree maps
        item_map = {item.id: item for item in items}
        in_degree = {item.id: 0 for item in items}
        graph: Dict[int, List[int]] = {item.id: [] for item in items}

        for dep in dependencies:
            if dep.from_item_id in graph and dep.to_item_id in in_degree:
                graph[dep.from_item_id].append(dep.to_item_id)
                in_degree[dep.to_item_id] += 1

        # Kahn's algorithm with priority queue
        # Items with no dependencies come first, sorted by sequence_order
        queue = sorted([item_id for item_id, deg in in_degree.items() if deg == 0],
                       key=lambda x: item_map[x].sequence_order)
        result = []

        while queue:
            current = queue.pop(0)
            result.append(item_map[current])

            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    # Insert maintaining sequence order
                    inserted = False
                    for i, q_item in enumerate(queue):
                        if item_map[neighbor].sequence_order < item_map[q_item].sequence_order:
                            queue.insert(i, neighbor)
                            inserted = True
                            break
                    if not inserted:
                        queue.append(neighbor)

        # Add any remaining items (in case of cycles)
        remaining = [item_map[item_id] for item_id in in_degree if item_id not in [r.id for r in result]]
        remaining.sort(key=lambda x: x.sequence_order)
        result.extend(remaining)

        return result

    async def _stage_milestones(self, session: RoadmapSession):
        """Stage 5: Generate milestones aligned with themes"""
        session.status = "generating_milestones"
        session.progress_step = 5
        session.progress_message = "Generating milestones..."
        self.db.add(session)
        self.db.commit()

        themes = self.get_themes(session.id)
        items = self.get_items(session.id)

        if not themes or not items:
            return

        # Prepare theme and sprint data
        theme_data = []
        for theme in themes:
            theme_items = [item for item in items if item.theme_id == theme.id]
            if theme_items:
                sprints = [item.assigned_sprint for item in theme_items if item.assigned_sprint]
                theme_data.append({
                    "id": theme.id,
                    "name": theme.name,
                    "description": theme.description,
                    "start_sprint": min(sprints) if sprints else 1,
                    "end_sprint": max(sprints) if sprints else 1,
                    "total_points": sum(item.effort_points for item in theme_items),
                })

        prompt = create_json_prompt(
            task_description=f"""Based on these themes and their sprint spans, suggest meaningful milestones.

THEMES:
{json.dumps(theme_data, indent=2)}

Total sprints in roadmap: {max(item.assigned_sprint or 1 for item in items)}""",
            json_schema={
                "milestones": [
                    {
                        "name": "Milestone name",
                        "description": "What this milestone represents",
                        "target_sprint": "Sprint number when milestone should be achieved",
                        "theme_id": "ID of primary theme (optional)",
                        "criteria": ["List of completion criteria"]
                    }
                ]
            },
            additional_rules=[
                "Suggest 2-5 meaningful milestones",
                "Milestones should mark significant deliverables",
                "Space milestones reasonably across the roadmap",
                "Include clear success criteria",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="Milestones",
            max_tokens=2000,
            required_keys=["milestones"],
            fallback_value={"milestones": []}
        )

        # Create milestone records
        milestones_data = result.get("milestones", [])
        valid_theme_ids = {theme.id for theme in themes}

        for ms_data in milestones_data:
            theme_id = self._safe_int(ms_data.get("theme_id"))
            if theme_id and theme_id not in valid_theme_ids:
                theme_id = None

            target_sprint = self._safe_int(ms_data.get("target_sprint"), 1)

            # Calculate target date
            target_date = None
            if session.start_date:
                sprint_days = (target_sprint - 1) * session.sprint_length_weeks * 7
                target_date = session.start_date + timedelta(days=sprint_days + session.sprint_length_weeks * 7)

            milestone = RoadmapMilestone(
                session_id=session.id,
                name=ms_data.get("name", "Milestone"),
                description=ms_data.get("description"),
                target_sprint=target_sprint,
                target_date=target_date,
                theme_id=theme_id,
                criteria=ms_data.get("criteria", []),
            )
            self.db.add(milestone)

        self.db.commit()

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _safe_int(self, value: Any, default: Optional[int] = None) -> Optional[int]:
        """Safely convert value to int"""
        if value is None:
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    # =========================================================================
    # Export Functions
    # =========================================================================

    def export_roadmap_json(self, session_id: int) -> Dict[str, Any]:
        """Export roadmap as JSON"""
        session = self.get_session(session_id)
        if not session:
            return {}

        return {
            "session": {
                "id": session.id,
                "name": session.name,
                "description": session.description,
                "sprint_length_weeks": session.sprint_length_weeks,
                "team_velocity": session.team_velocity,
                "team_count": session.team_count,
                "buffer_percentage": session.buffer_percentage,
                "start_date": session.start_date.isoformat() if session.start_date else None,
            },
            "items": [
                {
                    "id": item.id,
                    "title": item.title,
                    "description": item.description,
                    "priority": item.priority,
                    "effort_points": item.effort_points,
                    "assigned_sprint": item.assigned_sprint,
                    "theme_id": item.theme_id,
                }
                for item in self.get_items(session_id)
            ],
            "themes": [
                {
                    "id": theme.id,
                    "name": theme.name,
                    "description": theme.description,
                    "color": theme.color,
                }
                for theme in self.get_themes(session_id)
            ],
            "dependencies": [
                {
                    "from_item_id": dep.from_item_id,
                    "to_item_id": dep.to_item_id,
                    "type": dep.dependency_type,
                }
                for dep in self.get_dependencies(session_id)
            ],
            "milestones": [
                {
                    "id": ms.id,
                    "name": ms.name,
                    "target_sprint": ms.target_sprint,
                    "target_date": ms.target_date.isoformat() if ms.target_date else None,
                }
                for ms in self.get_milestones(session_id)
            ],
            "sprints": [
                {
                    "number": s.sprint_number,
                    "total_points": s.total_points,
                    "capacity": s.capacity,
                    "utilization": s.utilization_percentage,
                    "start_date": s.start_date.isoformat() if s.start_date else None,
                    "end_date": s.end_date.isoformat() if s.end_date else None,
                }
                for s in self.get_sprint_summaries(session_id)
            ],
        }

    def export_roadmap_csv(self, session_id: int) -> str:
        """Export roadmap as CSV"""
        items = self.get_items(session_id)
        themes = {t.id: t.name for t in self.get_themes(session_id)}

        lines = ["ID,Title,Type,Priority,Effort,Sprint,Theme,Status"]

        for item in items:
            theme_name = themes.get(item.theme_id, "")
            lines.append(
                f'{item.id},"{item.title}",{item.item_type},{item.priority},'
                f'{item.effort_points},{item.assigned_sprint or ""},"{theme_name}",{item.status}'
            )

        return "\n".join(lines)
