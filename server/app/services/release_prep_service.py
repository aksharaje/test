"""
Release Prep Service

Service layer for Release Prep Agent that generates release artifacts
from user stories using a multi-stage LLM pipeline.

Pipeline stages:
1. Extract - Parse stories and extract relevant content
2. Generate Release Notes - Create user-facing changelog items
3. Generate Decision Log - Extract technical/product decisions
4. Generate Debt Inventory - Identify technical debt items
5. Validate - Quality check all generated content
"""
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select

from app.models.release_prep import (
    ReleasePrepSession,
    ReleaseStory,
    ReleaseNote,
    Decision,
    TechnicalDebtItem,
    ReleasePrepSessionCreate,
    ReleaseNoteUpdate,
    DecisionUpdate,
    TechnicalDebtItemUpdate,
    TechnicalDebtItemCreate,
    AvailableStory,
)
from app.models.story_generator import GeneratedArtifact
from app.services.llm_json_utils import get_strict_json_llm, create_json_prompt, StrictJSONLLM
from app.services.knowledge_base_service import knowledge_base_service


class ReleasePrepService:
    """Service for Release Prep artifact generation"""

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

    def create_session(self, data: ReleasePrepSessionCreate, user_id: Optional[int] = None) -> ReleasePrepSession:
        """Create a new release prep session"""
        session = ReleasePrepSession(
            user_id=user_id,
            release_name=data.release_name,
            story_artifact_ids=data.story_artifact_ids,
            manual_stories=data.manual_stories,
            knowledge_base_ids=data.knowledge_base_ids,
            status="draft",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int, user_id: Optional[int] = None) -> Optional[ReleasePrepSession]:
        """Get a session by ID"""
        session = self.db.get(ReleasePrepSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def get_sessions(self, user_id: Optional[int] = None) -> List[ReleasePrepSession]:
        """Get all sessions, optionally filtered by user"""
        query = select(ReleasePrepSession).order_by(ReleasePrepSession.created_at.desc())
        if user_id:
            query = query.where(ReleasePrepSession.user_id == user_id)
        return list(self.db.exec(query).all())

    def delete_session(self, session_id: int) -> bool:
        """Delete a session and all related artifacts"""
        session = self.get_session(session_id)
        if not session:
            return False

        # Delete related artifacts
        self.db.exec(select(ReleaseStory).where(ReleaseStory.session_id == session_id)).all()
        for story in self.db.exec(select(ReleaseStory).where(ReleaseStory.session_id == session_id)).all():
            self.db.delete(story)

        for note in self.db.exec(select(ReleaseNote).where(ReleaseNote.session_id == session_id)).all():
            self.db.delete(note)

        for decision in self.db.exec(select(Decision).where(Decision.session_id == session_id)).all():
            self.db.delete(decision)

        for debt in self.db.exec(select(TechnicalDebtItem).where(TechnicalDebtItem.session_id == session_id)).all():
            self.db.delete(debt)

        self.db.delete(session)
        self.db.commit()
        return True

    # =========================================================================
    # Available Stories (from Story Generator)
    # =========================================================================

    def get_available_stories(self, include_released: bool = False) -> List[AvailableStory]:
        """Get artifacts from Story Generator, Epic Creator, and Feature Creator

        Args:
            include_released: If True, include stories already in a release (for debugging)
        """
        # Include both draft and final status - users may want to preview release notes
        # before formally marking stories as final
        query = select(GeneratedArtifact).where(
            GeneratedArtifact.status.in_(["draft", "final"])
        )

        # Filter out released stories unless explicitly requested
        if not include_released:
            query = query.where(GeneratedArtifact.released_at.is_(None))

        query = query.order_by(GeneratedArtifact.created_at.desc())

        artifacts = self.db.exec(query).all()
        stories = []

        for artifact in artifacts:
            # Get preview and counts from content
            preview = ""
            story_count = 0
            feature_count = 0

            try:
                content_data = json.loads(artifact.content) if artifact.content else {}

                if artifact.type == "epic" and content_data.get("epic"):
                    epic = content_data["epic"]
                    preview = epic.get("vision", "")[:200]
                    features = epic.get("features", [])
                    feature_count = len(features)
                    # Count all stories within all features
                    for feature in features:
                        story_count += len(feature.get("stories", []))

                elif artifact.type == "feature" and content_data.get("feature"):
                    feature = content_data["feature"]
                    preview = feature.get("summary", "")[:200]
                    story_count = len(feature.get("stories", []))

                elif artifact.type == "user_story" and content_data.get("stories"):
                    user_stories = content_data["stories"]
                    story_count = len(user_stories)
                    first_story = user_stories[0] if user_stories else {}
                    preview = first_story.get("userStory", "")[:200]

            except (json.JSONDecodeError, KeyError, TypeError):
                preview = artifact.content[:200] if artifact.content else ""

            stories.append(AvailableStory(
                id=artifact.id,
                title=artifact.title,
                type=artifact.type,
                status=artifact.status,
                created_at=artifact.created_at,
                preview=preview + "..." if len(preview) == 200 else preview,
                story_count=story_count,
                feature_count=feature_count,
            ))

        return stories

    # =========================================================================
    # Artifact CRUD
    # =========================================================================

    def get_session_stories(self, session_id: int) -> List[ReleaseStory]:
        """Get all stories for a session"""
        query = select(ReleaseStory).where(ReleaseStory.session_id == session_id)
        return list(self.db.exec(query).all())

    def _get_kb_context(self, session: ReleasePrepSession, query: str) -> str:
        """Retrieve relevant context from knowledge bases for a query"""
        if not session.knowledge_base_ids:
            return ""

        all_results = []
        for kb_id in session.knowledge_base_ids:
            try:
                results = knowledge_base_service.search(
                    session=self.db,
                    kb_id=kb_id,
                    query=query,
                    limit=3,
                    threshold=0.6
                )
                all_results.extend(results)
            except Exception as e:
                # Log but don't fail if KB search fails
                print(f"KB search failed for kb_id={kb_id}: {e}")
                continue

        if not all_results:
            return ""

        # Format context from search results
        context_parts = []
        for i, result in enumerate(all_results[:5], 1):  # Limit to top 5 across all KBs
            context_parts.append(
                f"[Document: {result.get('documentName', 'Unknown')}]\n{result.get('content', '')}"
            )

        return "\n\n---\n\n".join(context_parts)

    def get_release_notes(self, session_id: int) -> List[ReleaseNote]:
        """Get all release notes for a session"""
        query = select(ReleaseNote).where(
            ReleaseNote.session_id == session_id
        ).order_by(ReleaseNote.display_order)
        return list(self.db.exec(query).all())

    def get_decisions(self, session_id: int) -> List[Decision]:
        """Get all decisions for a session"""
        query = select(Decision).where(Decision.session_id == session_id)
        return list(self.db.exec(query).all())

    def get_debt_items(self, session_id: int) -> List[TechnicalDebtItem]:
        """Get all technical debt items for a session"""
        query = select(TechnicalDebtItem).where(TechnicalDebtItem.session_id == session_id)
        return list(self.db.exec(query).all())

    def update_release_note(self, note_id: int, data: ReleaseNoteUpdate) -> Optional[ReleaseNote]:
        """Update a release note"""
        note = self.db.get(ReleaseNote, note_id)
        if not note:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(note, key, value)

        note.is_user_edited = True
        note.updated_at = datetime.utcnow()
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def update_decision(self, decision_id: int, data: DecisionUpdate) -> Optional[Decision]:
        """Update a decision"""
        decision = self.db.get(Decision, decision_id)
        if not decision:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(decision, key, value)

        decision.is_user_edited = True
        decision.updated_at = datetime.utcnow()
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def update_debt_item(self, item_id: int, data: TechnicalDebtItemUpdate) -> Optional[TechnicalDebtItem]:
        """Update a technical debt item"""
        item = self.db.get(TechnicalDebtItem, item_id)
        if not item:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)

        item.is_user_edited = True
        item.updated_at = datetime.utcnow()
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def create_debt_item(self, session_id: int, data: TechnicalDebtItemCreate) -> TechnicalDebtItem:
        """Create a new technical debt item manually"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        item = TechnicalDebtItem(
            session_id=session_id,
            title=data.title,
            description=data.description,
            debt_type=data.debt_type,
            affected_area=data.affected_area,
            impact_level=data.impact_level,
            risk_if_unaddressed=data.risk_if_unaddressed,
            effort_estimate=data.effort_estimate,
            effort_days=data.effort_days,
            target_resolution=data.target_resolution,
            introduced_in_release=session.release_name,
            is_user_added=True,
        )
        self.db.add(item)

        # Update session count
        session.total_debt_items += 1
        self.db.add(session)

        self.db.commit()
        self.db.refresh(item)
        return item

    # =========================================================================
    # Release Tracking
    # =========================================================================

    def _mark_artifacts_released(self, session: ReleasePrepSession):
        """Mark all artifacts included in this release as released"""
        if not session.story_artifact_ids:
            return

        for artifact_id in session.story_artifact_ids:
            artifact = self.db.get(GeneratedArtifact, artifact_id)
            if artifact:
                artifact.released_at = datetime.utcnow()
                artifact.released_in_session_id = session.id
                self.db.add(artifact)

        self.db.commit()

    def unrelease_artifact(self, artifact_id: int) -> bool:
        """Remove released status from an artifact so it can be included in future releases"""
        artifact = self.db.get(GeneratedArtifact, artifact_id)
        if not artifact:
            return False

        artifact.released_at = None
        artifact.released_in_session_id = None
        self.db.add(artifact)
        self.db.commit()
        return True

    def unrelease_session_artifacts(self, session_id: int) -> int:
        """Remove released status from all artifacts in a session.
        Returns count of artifacts unreleased."""
        query = select(GeneratedArtifact).where(
            GeneratedArtifact.released_in_session_id == session_id
        )
        artifacts = self.db.exec(query).all()

        for artifact in artifacts:
            artifact.released_at = None
            artifact.released_in_session_id = None
            self.db.add(artifact)

        self.db.commit()
        return len(artifacts)

    # =========================================================================
    # Pipeline Execution
    # =========================================================================

    async def run_pipeline(self, session_id: int) -> ReleasePrepSession:
        """Run the full release prep pipeline"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            # Update status
            session.status = "processing"
            session.progress_step = 0
            session.progress_message = "Starting pipeline..."
            self.db.add(session)
            self.db.commit()

            # Stage 1: Extract stories
            await self._stage_extract_stories(session)

            # Stage 2: Generate release notes
            await self._stage_generate_release_notes(session)

            # Stage 3: Generate decision log
            await self._stage_generate_decisions(session)

            # Stage 4: Generate debt inventory
            await self._stage_generate_debt(session)

            # Stage 5: Validate quality
            await self._stage_validate(session)

            # Recalculate actual counts from database to ensure accuracy
            session.total_release_notes = len(self.get_release_notes(session.id))
            session.total_decisions = len(self.get_decisions(session.id))
            session.total_debt_items = len(self.get_debt_items(session.id))
            session.total_stories_processed = len(self.get_session_stories(session.id))

            # Mark included artifacts as released
            self._mark_artifacts_released(session)

            # Complete
            session.status = "completed"
            session.progress_step = 6
            session.progress_message = "Pipeline completed"
            session.completed_at = datetime.utcnow()
            self.db.add(session)
            self.db.commit()

            return session

        except Exception as e:
            # Re-fetch session in case of stale reference
            session = self.get_session(session_id)
            if session:
                session.status = "failed"
                session.error_message = str(e)
                self.db.add(session)
                self.db.commit()
            raise

    async def _stage_extract_stories(self, session: ReleasePrepSession):
        """Stage 1: Extract and process input stories"""
        session.status = "extracting"
        session.progress_step = 1
        session.progress_message = "Extracting stories..."
        self.db.add(session)
        self.db.commit()

        # Load stories from Story Generator artifacts
        for artifact_id in session.story_artifact_ids or []:
            artifact = self.db.get(GeneratedArtifact, artifact_id)
            if artifact:
                # Parse content and extract acceptance criteria
                acceptance_criteria = []
                try:
                    content_data = json.loads(artifact.content) if artifact.content else {}
                    acceptance_criteria = self._extract_acceptance_criteria(content_data, artifact.type)
                except (json.JSONDecodeError, KeyError):
                    pass

                story = ReleaseStory(
                    session_id=session.id,
                    artifact_id=artifact_id,
                    title=artifact.title,
                    story_type=artifact.type,
                    content=artifact.content,
                    is_manual=False,
                    acceptance_criteria=acceptance_criteria,
                    processed=True,
                )
                self.db.add(story)

        # Add manual stories
        for manual in session.manual_stories or []:
            story = ReleaseStory(
                session_id=session.id,
                artifact_id=None,
                title=manual.get("title", "Untitled"),
                story_type=manual.get("story_type", "user_story"),
                content=manual.get("content", ""),
                is_manual=True,
                acceptance_criteria=[],
                processed=True,
            )
            self.db.add(story)

        self.db.commit()

        # Update session
        stories = self.get_session_stories(session.id)
        session.total_stories_processed = len(stories)
        self.db.add(session)
        self.db.commit()

    def _extract_acceptance_criteria(self, content_data: Dict, story_type: str) -> List[Dict]:
        """Extract acceptance criteria from structured content"""
        criteria = []

        if story_type == "epic" and content_data.get("epic"):
            # Extract from features and their stories
            for feature in content_data["epic"].get("features", []):
                criteria.extend(feature.get("acceptanceCriteria", []))
                for story in feature.get("stories", []):
                    criteria.extend(story.get("acceptanceCriteria", []))

        elif story_type == "feature" and content_data.get("feature"):
            criteria.extend(content_data["feature"].get("acceptanceCriteria", []))
            for story in content_data["feature"].get("stories", []):
                criteria.extend(story.get("acceptanceCriteria", []))

        elif story_type == "user_story" and content_data.get("stories"):
            for story in content_data["stories"]:
                criteria.extend(story.get("acceptanceCriteria", []))

        return criteria

    async def _stage_generate_release_notes(self, session: ReleasePrepSession):
        """Stage 2: Generate release notes from stories"""
        session.status = "generating_notes"
        session.progress_step = 2
        session.progress_message = "Generating release notes..."
        self.db.add(session)
        self.db.commit()

        stories = self.get_session_stories(session.id)
        if not stories:
            return

        # Prepare story summaries for LLM
        story_summaries = []
        for story in stories:
            summary = {
                "id": story.id,
                "title": story.title,
                "type": story.story_type,
            }
            # Add preview of content
            try:
                content_data = json.loads(story.content) if story.content else {}
                if story.story_type == "epic" and content_data.get("epic"):
                    summary["description"] = content_data["epic"].get("vision", "")
                    summary["goals"] = content_data["epic"].get("goals", [])
                elif story.story_type == "feature" and content_data.get("feature"):
                    summary["description"] = content_data["feature"].get("summary", "")
                    summary["business_value"] = content_data["feature"].get("businessValue", "")
                elif story.story_type == "user_story" and content_data.get("stories"):
                    first = content_data["stories"][0] if content_data["stories"] else {}
                    summary["description"] = first.get("userStory", "")
            except (json.JSONDecodeError, KeyError):
                summary["description"] = story.content[:500] if story.content else ""

            story_summaries.append(summary)

        # Get KB context if available
        kb_context = ""
        if session.knowledge_base_ids:
            # Build a query from story titles/descriptions
            query_parts = [s.get("title", "") for s in story_summaries[:5]]
            kb_query = " ".join(query_parts)
            kb_context = self._get_kb_context(session, kb_query)

        # Generate release notes via LLM
        kb_section = ""
        if kb_context:
            kb_section = f"""

ADDITIONAL CONTEXT FROM KNOWLEDGE BASE:
{kb_context}

Use this context to enrich release notes with product terminology and domain knowledge."""

        prompt = create_json_prompt(
            task_description=f"""Analyze the following {len(story_summaries)} stories and generate release notes.
Create user-friendly release notes that communicate what's new to end users.

STORIES:
{json.dumps(story_summaries, indent=2)}{kb_section}""",
            json_schema={
                "release_notes": [
                    {
                        "title": "Short, action-oriented title (e.g., 'New Dashboard Filters')",
                        "description": "User-friendly description of the change (2-3 sentences)",
                        "category": "One of: feature, improvement, fix, security, performance, breaking_change",
                        "user_impact": "Brief description of how this benefits users",
                        "audience": "One of: all, admin, developer, enterprise",
                        "is_highlighted": "true if this is a major feature worth highlighting",
                        "source_story_ids": ["List of story IDs this note is derived from"]
                    }
                ]
            },
            additional_rules=[
                "Group related stories into single release notes where appropriate",
                "Use clear, non-technical language for user-facing changes",
                "Mark security and breaking changes appropriately",
                "Focus on user benefits, not implementation details",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="ReleaseNotes",
            max_tokens=4000,
            required_keys=["release_notes"],
            fallback_value={"release_notes": []}
        )

        # Create release note records
        notes_data = result.get("release_notes", [])
        for i, note_data in enumerate(notes_data):
            # Handle is_highlighted which might be string "true"/"false" from LLM
            is_highlighted = note_data.get("is_highlighted", False)
            if isinstance(is_highlighted, str):
                is_highlighted = is_highlighted.lower() == "true"

            # Ensure source_story_ids are integers
            source_ids = note_data.get("source_story_ids", [])
            if isinstance(source_ids, list):
                source_ids = [int(x) if isinstance(x, (int, str)) and str(x).isdigit() else x for x in source_ids]

            note = ReleaseNote(
                session_id=session.id,
                title=note_data.get("title", "Untitled"),
                description=note_data.get("description", ""),
                category=note_data.get("category", "feature"),
                user_impact=note_data.get("user_impact"),
                audience=note_data.get("audience", "all"),
                source_story_ids=source_ids,
                display_order=i,
                is_highlighted=is_highlighted,
            )
            self.db.add(note)

        self.db.commit()

        # Update session
        session.total_release_notes = len(notes_data)
        self.db.add(session)
        self.db.commit()

    async def _stage_generate_decisions(self, session: ReleasePrepSession):
        """Stage 3: Extract decisions from stories"""
        session.status = "generating_decisions"
        session.progress_step = 3
        session.progress_message = "Extracting decisions..."
        self.db.add(session)
        self.db.commit()

        stories = self.get_session_stories(session.id)
        if not stories:
            return

        # Prepare full story content for decision extraction
        story_contents = []
        for story in stories:
            story_contents.append({
                "id": story.id,
                "title": story.title,
                "type": story.story_type,
                "content": story.content[:2000] if story.content else "",  # Limit content size
            })

        # Get KB context for decisions
        kb_context = ""
        if session.knowledge_base_ids:
            kb_query = "technical decisions architecture patterns technology choices"
            kb_context = self._get_kb_context(session, kb_query)

        kb_section = ""
        if kb_context:
            kb_section = f"""

ADDITIONAL CONTEXT FROM KNOWLEDGE BASE:
{kb_context}

Use this context to understand existing patterns and validate decision alignment."""

        prompt = create_json_prompt(
            task_description=f"""Analyze the following stories and extract any technical, architectural, or product decisions that were made.
Look for:
- Technology choices (frameworks, libraries, services)
- Architectural patterns chosen
- Trade-offs that were made
- Product decisions about scope or features
- Security or compliance decisions

STORIES:
{json.dumps(story_contents, indent=2)}{kb_section}""",
            json_schema={
                "decisions": [
                    {
                        "title": "Short title for the decision (e.g., 'Use PostgreSQL for user data')",
                        "description": "Detailed description of the decision",
                        "decision_type": "One of: technical, architectural, product, process, security",
                        "context": "What situation led to this decision",
                        "rationale": "Why this choice was made",
                        "alternatives_considered": ["List of alternatives that were considered"],
                        "impact_level": "One of: low, medium, high, critical",
                        "impact_areas": ["List from: performance, scalability, security, maintainability, user_experience, cost"],
                        "consequences": "What follows from this decision",
                        "reversibility": "One of: reversible, partially, irreversible",
                        "source_story_ids": ["List of story IDs this decision is derived from"]
                    }
                ]
            },
            additional_rules=[
                "Only extract actual decisions, not features or requirements",
                "Include implicit decisions (e.g., choosing a specific approach implies rejecting others)",
                "Be specific about the rationale and alternatives",
                "Assess impact realistically based on the scope",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="Decisions",
            max_tokens=4000,
            required_keys=["decisions"],
            fallback_value={"decisions": []}
        )

        # Create decision records
        decisions_data = result.get("decisions", [])
        for decision_data in decisions_data:
            # Ensure source_story_ids are integers
            source_ids = decision_data.get("source_story_ids", [])
            if isinstance(source_ids, list):
                source_ids = [int(x) if isinstance(x, (int, str)) and str(x).isdigit() else x for x in source_ids]

            # Ensure alternatives_considered is a list of strings
            alternatives = decision_data.get("alternatives_considered", [])
            if not isinstance(alternatives, list):
                alternatives = [str(alternatives)] if alternatives else []

            decision = Decision(
                session_id=session.id,
                title=decision_data.get("title", "Untitled"),
                description=decision_data.get("description", ""),
                decision_type=decision_data.get("decision_type", "technical"),
                context=decision_data.get("context"),
                rationale=decision_data.get("rationale"),
                alternatives_considered=alternatives,
                impact_level=decision_data.get("impact_level", "medium"),
                impact_areas=decision_data.get("impact_areas", []),
                consequences=decision_data.get("consequences"),
                reversibility=decision_data.get("reversibility", "reversible"),
                source_story_ids=source_ids,
            )
            self.db.add(decision)

        self.db.commit()

        # Update session
        session.total_decisions = len(decisions_data)
        self.db.add(session)
        self.db.commit()

    async def _stage_generate_debt(self, session: ReleasePrepSession):
        """Stage 4: Identify technical debt from stories"""
        session.status = "generating_debt"
        session.progress_step = 4
        session.progress_message = "Identifying technical debt..."
        self.db.add(session)
        self.db.commit()

        stories = self.get_session_stories(session.id)
        if not stories:
            return

        # Prepare story content for debt identification
        story_contents = []
        for story in stories:
            story_contents.append({
                "id": story.id,
                "title": story.title,
                "type": story.story_type,
                "content": story.content[:2000] if story.content else "",
            })

        # Get KB context for debt identification
        kb_context = ""
        if session.knowledge_base_ids:
            kb_query = "technical debt code quality performance issues known limitations"
            kb_context = self._get_kb_context(session, kb_query)

        kb_section = ""
        if kb_context:
            kb_section = f"""

ADDITIONAL CONTEXT FROM KNOWLEDGE BASE:
{kb_context}

Use this context to identify patterns and known debt areas."""

        prompt = create_json_prompt(
            task_description=f"""Analyze the following stories and identify any technical debt introduced or acknowledged.
Look for:
- Shortcuts or workarounds mentioned
- "TODO" or "FIXME" type items
- Known limitations accepted for scope
- Areas marked for future improvement
- Quick fixes that need proper solutions later
- Missing tests or documentation noted
- Performance issues acknowledged but deferred

STORIES:
{json.dumps(story_contents, indent=2)}{kb_section}""",
            json_schema={
                "debt_items": [
                    {
                        "title": "Short title for the debt item",
                        "description": "Detailed description of the technical debt",
                        "debt_type": "One of: code, design, architecture, testing, documentation, infrastructure",
                        "affected_area": "What part of the system is affected (e.g., 'Authentication module')",
                        "impact_level": "One of: low, medium, high, critical",
                        "risk_if_unaddressed": "What could go wrong if this isn't fixed",
                        "effort_estimate": "Estimated effort to fix (e.g., '2-3 days', '1 sprint')",
                        "source_story_ids": ["List of story IDs where this debt was identified"]
                    }
                ]
            },
            additional_rules=[
                "Only identify actual technical debt, not feature requests",
                "Be specific about what needs to be fixed",
                "Provide realistic effort estimates",
                "Explain the risk clearly so stakeholders understand priority",
            ]
        )

        result = self.llm.call(
            prompt=prompt,
            context="TechnicalDebt",
            max_tokens=4000,
            required_keys=["debt_items"],
            fallback_value={"debt_items": []}
        )

        # Create debt item records
        debt_data = result.get("debt_items", [])
        for item_data in debt_data:
            # Parse effort estimate to days
            effort_days = self._parse_effort_to_days(item_data.get("effort_estimate", ""))

            # Ensure source_story_ids are integers
            source_ids = item_data.get("source_story_ids", [])
            if isinstance(source_ids, list):
                source_ids = [int(x) if isinstance(x, (int, str)) and str(x).isdigit() else x for x in source_ids]

            item = TechnicalDebtItem(
                session_id=session.id,
                title=item_data.get("title", "Untitled"),
                description=item_data.get("description", ""),
                debt_type=item_data.get("debt_type", "code"),
                affected_area=item_data.get("affected_area"),
                impact_level=item_data.get("impact_level", "medium"),
                risk_if_unaddressed=item_data.get("risk_if_unaddressed"),
                effort_estimate=item_data.get("effort_estimate"),
                effort_days=effort_days,
                source_story_ids=source_ids,
                introduced_in_release=session.release_name,
                status="identified",
            )
            self.db.add(item)

        self.db.commit()

        # Update session
        session.total_debt_items = len(debt_data)
        self.db.add(session)
        self.db.commit()

    def _parse_effort_to_days(self, effort_str: str) -> Optional[int]:
        """Parse effort estimate string to number of days"""
        if not effort_str:
            return None

        effort_lower = effort_str.lower()

        # Handle ranges - take the average
        if "-" in effort_str:
            parts = effort_str.split("-")
            try:
                nums = [int(''.join(filter(str.isdigit, p))) for p in parts if any(c.isdigit() for c in p)]
                if nums:
                    return sum(nums) // len(nums)
            except ValueError:
                pass

        # Handle sprint references
        if "sprint" in effort_lower:
            try:
                num = int(''.join(filter(str.isdigit, effort_str)))
                return num * 10  # Assume 10 working days per sprint
            except ValueError:
                return 10  # Default 1 sprint = 10 days

        # Handle week references
        if "week" in effort_lower:
            try:
                num = int(''.join(filter(str.isdigit, effort_str)))
                return num * 5  # 5 working days per week
            except ValueError:
                return 5

        # Handle day references
        if "day" in effort_lower:
            try:
                return int(''.join(filter(str.isdigit, effort_str)))
            except ValueError:
                return 1

        # Try to extract just a number
        try:
            return int(''.join(filter(str.isdigit, effort_str)))
        except ValueError:
            return None

    async def _stage_validate(self, session: ReleasePrepSession):
        """Stage 5: Validate quality of generated content"""
        session.status = "validating"
        session.progress_step = 5
        session.progress_message = "Validating quality..."
        self.db.add(session)
        self.db.commit()

        # Get all generated content
        notes = self.get_release_notes(session.id)
        decisions = self.get_decisions(session.id)
        debt_items = self.get_debt_items(session.id)

        # Validate release notes
        if notes:
            notes_summary = [{"title": n.title, "description": n.description, "category": n.category} for n in notes]
            validation = self._validate_content("release_notes", notes_summary, session.total_stories_processed)
            session.release_notes_completeness = validation.get("completeness", 0)
            session.release_notes_clarity = validation.get("clarity", 0)

        # Validate decision log
        if decisions:
            decisions_summary = [{"title": d.title, "rationale": d.rationale} for d in decisions]
            validation = self._validate_content("decisions", decisions_summary, session.total_stories_processed)
            session.decision_log_completeness = validation.get("completeness", 0)

        # Validate debt inventory
        if debt_items:
            debt_summary = [{"title": d.title, "description": d.description} for d in debt_items]
            validation = self._validate_content("debt", debt_summary, session.total_stories_processed)
            session.debt_inventory_completeness = validation.get("completeness", 0)

        self.db.add(session)
        self.db.commit()

    def _validate_content(self, content_type: str, items: List[Dict], story_count: int) -> Dict[str, float]:
        """Validate generated content quality"""
        if not items:
            return {"completeness": 0, "clarity": 0}

        prompt = create_json_prompt(
            task_description=f"""Evaluate the quality of these generated {content_type} from {story_count} stories.

CONTENT:
{json.dumps(items, indent=2)}

Rate the following on a scale of 0-100:""",
            json_schema={
                "completeness": "0-100: How thoroughly do these cover the input stories?",
                "clarity": "0-100: How clear and understandable is the content?",
                "issues": ["List any quality issues found"]
            },
        )

        result = self.llm.call(
            prompt=prompt,
            context="Validation",
            max_tokens=1000,
            fallback_value={"completeness": 70, "clarity": 70, "issues": []}
        )

        # Ensure values are integers (LLM might return strings)
        try:
            completeness = int(result.get("completeness", 70))
            clarity = int(result.get("clarity", 70))
        except (ValueError, TypeError):
            completeness = 70
            clarity = 70

        return {
            "completeness": min(100, max(0, completeness)),
            "clarity": min(100, max(0, clarity)),
        }

    # =========================================================================
    # Export Functions
    # =========================================================================

    def export_release_notes_markdown(self, session_id: int) -> str:
        """Export release notes as markdown"""
        session = self.get_session(session_id)
        if not session:
            return ""

        notes = self.get_release_notes(session_id)
        active_notes = [n for n in notes if not n.is_excluded]

        lines = [
            f"# Release Notes - {session.release_name}",
            "",
        ]

        # Group by category
        categories = {
            "breaking_change": ("Breaking Changes", []),
            "feature": ("New Features", []),
            "improvement": ("Improvements", []),
            "fix": ("Bug Fixes", []),
            "security": ("Security", []),
            "performance": ("Performance", []),
        }

        for note in active_notes:
            cat = note.category if note.category in categories else "feature"
            categories[cat][1].append(note)

        for cat_key, (cat_title, cat_notes) in categories.items():
            if cat_notes:
                lines.append(f"## {cat_title}")
                lines.append("")
                for note in cat_notes:
                    highlight = " ⭐" if note.is_highlighted else ""
                    lines.append(f"### {note.title}{highlight}")
                    lines.append("")
                    lines.append(note.description)
                    if note.user_impact:
                        lines.append("")
                        lines.append(f"**Impact:** {note.user_impact}")
                    lines.append("")

        return "\n".join(lines)

    def export_decision_log_markdown(self, session_id: int) -> str:
        """Export decision log as markdown"""
        session = self.get_session(session_id)
        if not session:
            return ""

        decisions = self.get_decisions(session_id)
        active_decisions = [d for d in decisions if not d.is_excluded]

        lines = [
            f"# Decision Log - {session.release_name}",
            "",
        ]

        for decision in active_decisions:
            lines.append(f"## {decision.title}")
            lines.append("")
            lines.append(f"**Type:** {decision.decision_type.replace('_', ' ').title()}")
            lines.append(f"**Impact:** {decision.impact_level.title()}")
            lines.append("")

            if decision.context:
                lines.append("### Context")
                lines.append(decision.context)
                lines.append("")

            lines.append("### Decision")
            lines.append(decision.description)
            lines.append("")

            if decision.rationale:
                lines.append("### Rationale")
                lines.append(decision.rationale)
                lines.append("")

            if decision.alternatives_considered:
                lines.append("### Alternatives Considered")
                for alt in decision.alternatives_considered:
                    lines.append(f"- {alt}")
                lines.append("")

            if decision.consequences:
                lines.append("### Consequences")
                lines.append(decision.consequences)
                lines.append("")

            lines.append("---")
            lines.append("")

        return "\n".join(lines)

    def export_debt_inventory_markdown(self, session_id: int) -> str:
        """Export technical debt inventory as markdown"""
        session = self.get_session(session_id)
        if not session:
            return ""

        debt_items = self.get_debt_items(session_id)
        active_items = [d for d in debt_items if not d.is_excluded]

        lines = [
            f"# Technical Debt Inventory - {session.release_name}",
            "",
            f"**Total Items:** {len(active_items)}",
            "",
        ]

        # Summary by impact
        impact_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for item in active_items:
            impact_counts[item.impact_level] = impact_counts.get(item.impact_level, 0) + 1

        lines.append("## Summary by Impact")
        lines.append("")
        lines.append(f"- 🔴 Critical: {impact_counts['critical']}")
        lines.append(f"- 🟠 High: {impact_counts['high']}")
        lines.append(f"- 🟡 Medium: {impact_counts['medium']}")
        lines.append(f"- 🟢 Low: {impact_counts['low']}")
        lines.append("")

        # Sort by impact level
        impact_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        sorted_items = sorted(active_items, key=lambda x: impact_order.get(x.impact_level, 2))

        lines.append("## Items")
        lines.append("")

        for item in sorted_items:
            impact_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(item.impact_level, "🟡")
            lines.append(f"### {impact_emoji} {item.title}")
            lines.append("")
            lines.append(f"**Type:** {item.debt_type.replace('_', ' ').title()}")
            if item.affected_area:
                lines.append(f"**Affected Area:** {item.affected_area}")
            if item.effort_estimate:
                lines.append(f"**Effort Estimate:** {item.effort_estimate}")
            lines.append(f"**Status:** {item.status.replace('_', ' ').title()}")
            lines.append("")
            lines.append(item.description)
            lines.append("")
            if item.risk_if_unaddressed:
                lines.append(f"**Risk if Unaddressed:** {item.risk_if_unaddressed}")
                lines.append("")
            lines.append("---")
            lines.append("")

        return "\n".join(lines)
