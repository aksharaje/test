"""
Journey & Pain Point Mapper Service

Business logic for AI-powered customer journey mapping.
Supports Standard, Multi-Persona, and Competitive journey modes.
"""
import json
import re
import time
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from humps import camelize

from app.models.journey_mapper import (
    JourneyMapSession,
    JourneyPainPoint,
    JourneyPersona,
    JourneyDivergencePoint,
    CompetitorJourneyObservation
)
from app.models.knowledge_base import KnowledgeBase, DocumentChunk
from openai import OpenAI


def _camelize_nested(obj: Any) -> Any:
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {camelize(k): _camelize_nested(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_camelize_nested(item) for item in obj]
    return obj


class JourneyMapperService:
    """Service for managing journey mapping sessions"""

    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            from app.core.config import settings
            api_key = settings.OPENROUTER_API_KEY
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY required")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    @property
    def model(self) -> str:
        from app.core.config import settings
        return settings.OPENROUTER_MODEL

    def _parse_llm_json(self, content: str, context: str = "LLM") -> Dict[str, Any]:
        """Robust JSON parsing for LLM responses."""
        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        original_content = content
        content = content.strip()

        # Remove markdown code fences if present
        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        # Find the first { or [ to locate the start of JSON
        brace_idx = content.find('{')
        bracket_idx = content.find('[')

        if brace_idx == -1 and bracket_idx == -1:
            print(f"ERROR: {context} - No JSON found. Content: {original_content[:500]}")
            raise ValueError(f"{context}: No JSON object found in response")

        json_start = min(
            brace_idx if brace_idx != -1 else len(content),
            bracket_idx if bracket_idx != -1 else len(content)
        )
        content = content[json_start:]

        # Find matching closing brace/bracket
        if content.startswith('{'):
            depth = 0
            in_string = False
            escape_next = False
            for i, char in enumerate(content):
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\':
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            content = content[:i+1]
                            break

        # Parse JSON
        from json import JSONDecoder
        decoder = JSONDecoder()

        def try_parse(s: str) -> Dict[str, Any]:
            obj, _ = decoder.raw_decode(s)
            if not isinstance(obj, (dict, list)):
                raise ValueError(f"Parsed content is not a dict or list, got {type(obj)}")
            return obj

        try:
            return try_parse(content)
        except json.JSONDecodeError:
            pass

        # Retry strategies
        if content.startswith('{'):
            inner = content[1:].strip()
            if inner.startswith('{') and inner.endswith('}'):
                if inner.count('{') < inner.count('}'):
                    inner = inner[:-1].rstrip()
                try:
                    return try_parse(inner)
                except json.JSONDecodeError:
                    pass

        print(f"ERROR: {context} - Failed to parse JSON. Content: {content[:500]}")
        raise ValueError(f"{context}: LLM returned invalid JSON")

    def _mask_pii(self, text: str) -> str:
        """Mask PII before sending to external API."""
        if not text:
            return text
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
        text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', text)
        text = re.sub(r'\(\d{3}\)\s*\d{3}[-.]?\d{4}', '[PHONE]', text)
        text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]', text)
        text = re.sub(r'\b\d{13,16}\b', '[CARD]', text)
        return text

    def _call_llm(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 4000, context: str = "LLM") -> Dict[str, Any]:
        """Call LLM with retry logic."""
        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            try:
                use_json_mode = attempt < (max_retries - 1)

                kwargs = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if use_json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                response = self.client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content

                if not content or not content.strip():
                    raise ValueError("Received empty string content from LLM API")

                return self._parse_llm_json(content, context)

            except Exception as e:
                print(f"Error calling LLM for {context} (Attempt {attempt + 1}/{max_retries}): {e}")
                last_error = e

            time.sleep(2 * (attempt + 1))

        raise ValueError(f"{context}: Failed to get valid response from LLM after {max_retries} attempts. Last error: {last_error}")

    # --- Context Fetching ---

    def _fetch_knowledge_base_context(
        self,
        db: Session,
        kb_ids: List[int],
        query: str,
        limit_per_kb: int = 10
    ) -> Dict[str, Any]:
        """Fetch relevant context from knowledge bases using semantic search."""
        if not kb_ids:
            return {"text": "", "metadata": []}

        context_parts = []
        metadata = []

        for kb_id in kb_ids:
            kb = db.get(KnowledgeBase, kb_id)
            if not kb or kb.status != "ready":
                continue

            try:
                from app.core.config import settings
                from openai import OpenAI as EmbeddingClient
                embed_client = EmbeddingClient(api_key=settings.OPENAI_API_KEY)
                embedding_response = embed_client.embeddings.create(
                    model=kb.settings.get("embeddingModel", "text-embedding-ada-002") if kb.settings else "text-embedding-ada-002",
                    input=query
                )
                query_embedding = embedding_response.data[0].embedding

                from sqlalchemy import text as sql_text
                results = db.execute(
                    sql_text("""
                        SELECT id, document_id, content, metadata_,
                               1 - (embedding <=> :embedding::vector) as similarity
                        FROM document_chunks
                        WHERE document_id IN (SELECT id FROM documents WHERE knowledge_base_id = :kb_id)
                        ORDER BY embedding <=> :embedding::vector
                        LIMIT :limit
                    """),
                    {"embedding": str(query_embedding), "kb_id": kb_id, "limit": limit_per_kb}
                ).fetchall()

                chunks_used = 0
                for row in results:
                    if row.similarity > 0.5:
                        context_parts.append(f"[From {kb.name}]\n{row.content}")
                        chunks_used += 1

                if chunks_used > 0:
                    metadata.append({
                        "id": kb_id,
                        "name": kb.name,
                        "chunks_used": chunks_used
                    })

            except Exception as e:
                print(f"Error fetching KB context from {kb_id}: {e}")
                continue

        return {
            "text": "\n\n---\n\n".join(context_parts) if context_parts else "",
            "metadata": metadata
        }

    def _parse_file_content(self, file_metadata: List[Dict[str, Any]]) -> str:
        """Extract text content from uploaded files for LLM context."""
        if not file_metadata:
            return ""

        content_parts = []
        for file_info in file_metadata:
            content = file_info.get("content_preview", "")
            filename = file_info.get("filename", "Unknown file")
            if content:
                content_parts.append(f"[From uploaded file: {filename}]\n{content}")

        return "\n\n---\n\n".join(content_parts)

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        mode: str,
        journey_description: str,
        user_id: Optional[int] = None,
        file_metadata: Optional[List[Dict[str, Any]]] = None,
        knowledge_base_ids: Optional[List[int]] = None,
        ideation_session_id: Optional[int] = None,
        feasibility_session_id: Optional[int] = None,
        business_case_session_id: Optional[int] = None,
        competitor_name: Optional[str] = None,
        personas: Optional[List[Dict[str, Any]]] = None
    ) -> JourneyMapSession:
        """Create a new journey mapping session."""
        if len(journey_description) < 5:
            raise ValueError("Journey description must be at least 5 characters")

        if mode not in ["standard", "multi_persona", "competitive"]:
            raise ValueError("Mode must be standard, multi_persona, or competitive")

        # Store context source IDs in file_metadata for now
        context_sources = {}
        if ideation_session_id:
            context_sources["ideation_session_id"] = ideation_session_id
        if feasibility_session_id:
            context_sources["feasibility_session_id"] = feasibility_session_id
        if business_case_session_id:
            context_sources["business_case_session_id"] = business_case_session_id

        # Merge context sources into file_metadata
        combined_metadata = file_metadata or []
        if context_sources:
            combined_metadata.append({"type": "context_sources", **context_sources})

        session_obj = JourneyMapSession(
            user_id=user_id,
            mode=mode,
            journey_description=journey_description,
            competitor_name=competitor_name,
            file_metadata=combined_metadata if combined_metadata else None,
            knowledge_base_ids=knowledge_base_ids,
            status="pending",
            progress_step=0,
            progress_message="Initializing journey mapper..."
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        # Create personas if multi-persona mode
        if mode == "multi_persona" and personas:
            colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]
            for idx, persona_data in enumerate(personas):
                persona = JourneyPersona(
                    journey_map_id=session_obj.id,
                    name=persona_data.get("name", f"Persona {idx + 1}"),
                    description=persona_data.get("description"),
                    attributes=persona_data.get("attributes"),
                    color=colors[idx % len(colors)]
                )
                db.add(persona)
            db.commit()

        return session_obj

    def get_session(self, db: Session, session_id: int) -> Optional[JourneyMapSession]:
        """Get a session by ID."""
        return db.get(JourneyMapSession, session_id)

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[JourneyMapSession]:
        """List all sessions, optionally filtered by user."""
        statement = select(JourneyMapSession)
        if user_id:
            statement = statement.where(JourneyMapSession.user_id == user_id)
        statement = statement.order_by(desc(JourneyMapSession.created_at)).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def get_session_detail(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get complete session detail with all related data."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return None

        # Fetch related data
        pain_points = list(db.exec(
            select(JourneyPainPoint)
            .where(JourneyPainPoint.journey_map_id == session_id)
        ).all())

        personas = list(db.exec(
            select(JourneyPersona)
            .where(JourneyPersona.journey_map_id == session_id)
        ).all())

        divergence_points = list(db.exec(
            select(JourneyDivergencePoint)
            .where(JourneyDivergencePoint.journey_map_id == session_id)
        ).all())

        competitor_observations = list(db.exec(
            select(CompetitorJourneyObservation)
            .where(CompetitorJourneyObservation.journey_map_id == session_id)
            .order_by(CompetitorJourneyObservation.stage_order)
        ).all())

        # Get version history
        versions = []
        if session_obj.parent_version_id:
            # Get lineage
            current = session_obj
            while current:
                versions.append({
                    "id": current.id,
                    "version": current.version,
                    "created_at": current.created_at.isoformat() if current.created_at else None
                })
                if current.parent_version_id:
                    current = db.get(JourneyMapSession, current.parent_version_id)
                else:
                    break
            versions.reverse()
        else:
            # Check for child versions
            children = list(db.exec(
                select(JourneyMapSession)
                .where(JourneyMapSession.parent_version_id == session_id)
                .order_by(JourneyMapSession.created_at)
            ).all())
            versions = [{"id": session_obj.id, "version": session_obj.version, "created_at": session_obj.created_at.isoformat()}]
            for child in children:
                versions.append({
                    "id": child.id,
                    "version": child.version,
                    "created_at": child.created_at.isoformat() if child.created_at else None
                })

        return {
            "session": session_obj,
            "painPoints": [_camelize_nested(pp.model_dump()) for pp in pain_points],
            "personas": [_camelize_nested(p.model_dump()) for p in personas],
            "divergencePoints": [_camelize_nested(dp.model_dump()) for dp in divergence_points],
            "competitorObservations": [_camelize_nested(co.model_dump()) for co in competitor_observations],
            "versions": versions
        }

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return False

        # Delete related data
        for obj in db.exec(select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(JourneyPersona).where(JourneyPersona.journey_map_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(JourneyDivergencePoint).where(JourneyDivergencePoint.journey_map_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(CompetitorJourneyObservation).where(CompetitorJourneyObservation.journey_map_id == session_id)):
            db.delete(obj)

        db.delete(session_obj)
        db.commit()
        return True

    # --- Pain Point Management ---

    def update_pain_point(
        self,
        db: Session,
        pain_point_id: int,
        updates: Dict[str, Any]
    ) -> Optional[JourneyPainPoint]:
        """Update a pain point (user edits)."""
        pain_point = db.get(JourneyPainPoint, pain_point_id)
        if not pain_point:
            return None

        if "description" in updates:
            pain_point.description = updates["description"]
        if "severity" in updates:
            pain_point.severity = float(updates["severity"])
        if "stage_id" in updates:
            pain_point.stage_id = updates["stage_id"]

        pain_point.is_user_edited = True
        pain_point.updated_at = datetime.utcnow()

        db.add(pain_point)
        db.commit()
        db.refresh(pain_point)

        return pain_point

    def add_pain_point(
        self,
        db: Session,
        journey_map_id: int,
        stage_id: str,
        description: str,
        severity: float = 5.0,
        persona_id: Optional[int] = None
    ) -> JourneyPainPoint:
        """Manually add a pain point."""
        pain_point = JourneyPainPoint(
            journey_map_id=journey_map_id,
            stage_id=stage_id,
            description=description,
            severity=severity,
            frequency=1,
            persona_id=persona_id,
            is_user_edited=True,
            delta_status="new"
        )
        db.add(pain_point)
        db.commit()
        db.refresh(pain_point)
        return pain_point

    def delete_pain_point(self, db: Session, pain_point_id: int) -> bool:
        """Delete a pain point."""
        pain_point = db.get(JourneyPainPoint, pain_point_id)
        if not pain_point:
            return False
        db.delete(pain_point)
        db.commit()
        return True

    # --- Stage Management ---

    def update_stage(
        self,
        db: Session,
        session_id: int,
        stage_id: str,
        updates: Dict[str, Any]
    ) -> Optional[JourneyMapSession]:
        """Update a stage in the journey map."""
        session_obj = self.get_session(db, session_id)
        if not session_obj or not session_obj.stages:
            return None

        stages = session_obj.stages
        for stage in stages:
            if stage.get("id") == stage_id:
                if "name" in updates:
                    stage["name"] = updates["name"]
                if "description" in updates:
                    stage["description"] = updates["description"]
                if "duration_estimate" in updates:
                    stage["duration_estimate"] = updates["duration_estimate"]
                break

        session_obj.stages = stages
        session_obj.updated_at = datetime.utcnow()
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def add_stage(
        self,
        db: Session,
        session_id: int,
        name: str,
        description: str = "",
        insert_after_stage_id: Optional[str] = None
    ) -> Optional[JourneyMapSession]:
        """Add a new stage to the journey map."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return None

        stages = session_obj.stages or []
        new_stage = {
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "description": description,
            "order": len(stages),
            "duration_estimate": "",
            "touchpoints": [],
            "emotion_score": 5.0
        }

        if insert_after_stage_id:
            for idx, stage in enumerate(stages):
                if stage.get("id") == insert_after_stage_id:
                    stages.insert(idx + 1, new_stage)
                    # Reorder
                    for i, s in enumerate(stages):
                        s["order"] = i
                    break
        else:
            stages.append(new_stage)
            new_stage["order"] = len(stages) - 1

        session_obj.stages = stages
        session_obj.updated_at = datetime.utcnow()
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def delete_stage(self, db: Session, session_id: int, stage_id: str) -> Optional[JourneyMapSession]:
        """Delete a stage from the journey map."""
        session_obj = self.get_session(db, session_id)
        if not session_obj or not session_obj.stages:
            return None

        stages = [s for s in session_obj.stages if s.get("id") != stage_id]
        # Reorder
        for i, s in enumerate(stages):
            s["order"] = i

        session_obj.stages = stages
        session_obj.updated_at = datetime.utcnow()

        # Also delete pain points for this stage
        for pp in db.exec(select(JourneyPainPoint).where(
            JourneyPainPoint.journey_map_id == session_id,
            JourneyPainPoint.stage_id == stage_id
        )):
            db.delete(pp)

        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    # --- Progress Updates ---

    def _update_progress(
        self,
        db: Session,
        session_id: int,
        status: str,
        step: int,
        message: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update session progress."""
        session_obj = self.get_session(db, session_id)
        if session_obj:
            session_obj.status = status
            session_obj.progress_step = step
            if message:
                session_obj.progress_message = message
            if error_message:
                session_obj.error_message = error_message
            session_obj.updated_at = datetime.utcnow()
            db.add(session_obj)
            db.commit()

    # --- Journey Generation Pipeline ---

    def run_journey_generation_pipeline(self, db: Session, session_id: int):
        """Main pipeline for generating journey maps. Runs in background task."""
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            mode = session_obj.mode

            self._update_progress(db, session_id, "processing", 1, "Analyzing data sources...")

            # Build context from all sources
            context = self._build_journey_context(db, session_obj)

            if mode == "standard":
                self._generate_standard_journey(db, session_id, context)
            elif mode == "multi_persona":
                self._generate_multi_persona_journey(db, session_id, context)
            elif mode == "competitive":
                self._generate_competitive_journey(db, session_id, context)

            # Mark completed
            session_obj = self.get_session(db, session_id)
            session_obj.status = "completed"
            session_obj.completed_at = datetime.utcnow()
            session_obj.progress_message = "Journey map complete!"
            db.add(session_obj)
            db.commit()

            print(f"Journey generation completed in {time.time() - start_time:.2f}s")

        except Exception as e:
            print(f"ERROR in journey generation pipeline: {str(e)}")
            import traceback
            traceback.print_exc()
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

    def _build_journey_context(self, db: Session, session_obj: JourneyMapSession) -> str:
        """Build aggregated context from all data sources."""
        context_parts = []

        # File content
        if session_obj.file_metadata:
            file_context = self._parse_file_content(session_obj.file_metadata)
            if file_context:
                context_parts.append(f"## Uploaded Data Sources\n\n{file_context}")

        # Knowledge base context
        if session_obj.knowledge_base_ids:
            kb_context = self._fetch_knowledge_base_context(
                db,
                session_obj.knowledge_base_ids,
                session_obj.journey_description,
                limit_per_kb=15
            )
            if kb_context["text"]:
                context_parts.append(f"## Knowledge Base Context\n\n{kb_context['text']}")

        return "\n\n---\n\n".join(context_parts) if context_parts else ""

    def _generate_standard_journey(self, db: Session, session_id: int, context: str):
        """Generate a standard (single persona) journey map."""
        session_obj = self.get_session(db, session_id)
        masked_description = self._mask_pii(session_obj.journey_description)
        masked_context = self._mask_pii(context)

        self._update_progress(db, session_id, "processing", 2, "Generating journey stages...")

        # Check if we have enough data
        word_count = len(context.split()) if context else 0
        data_quality_warning = None
        if word_count < 500:
            data_quality_warning = "Limited data detected. Journey may be incomplete. Add more sources for better quality."

        prompt = f"""You are an expert UX researcher and customer experience analyst. Create a detailed customer journey map from the provided data.

JOURNEY TO MAP: {masked_description}

DATA SOURCES:
{masked_context if masked_context else "No additional data provided. Generate a typical journey based on the description."}

Analyze the data and create a journey map with:
1. 4-8 journey stages (phases the customer goes through)
2. Key touchpoints at each stage (interactions with the product/service)
3. Pain points with severity scores (0-10 scale, based on frequency and sentiment in data)
4. Emotion scores per stage (0-10, where 0=very negative, 5=neutral, 10=very positive)
5. Duration estimates per stage (if inferable from data)

For each pain point:
- Extract evidence from the source data (direct quotes or paraphrased observations)
- Score severity based on: frequency of mention, emotional intensity, impact on user goals
- Link to the specific stage where it occurs

Return EXACTLY this JSON structure:
{{
  "stages": [
    {{
      "id": "stage_1",
      "name": "Stage Name",
      "description": "What happens in this stage",
      "order": 0,
      "duration_estimate": "1-2 days",
      "touchpoints": [
        {{"id": "tp_1", "name": "Touchpoint name", "description": "Details", "channel": "web|email|phone|in-person"}}
      ],
      "emotion_score": 6.5
    }}
  ],
  "pain_points": [
    {{
      "stage_id": "stage_1",
      "description": "Pain point description",
      "severity": 7.5,
      "frequency": 12,
      "evidence": [
        {{"source": "transcript", "excerpt": "Direct quote or observation from data"}}
      ]
    }}
  ],
  "emotion_curve": [
    {{"stage_id": "stage_1", "score": 6.5, "label": "Hopeful"}}
  ],
  "confidence_score": 0.85,
  "summary": "Brief summary of the overall journey and key findings"
}}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }. Every value must be properly typed - arrays must contain objects, not strings."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=6000,
            context="Standard Journey Generation"
        )

        self._update_progress(db, session_id, "processing", 3, "Saving journey map...")

        # Ensure data is a dict
        if not isinstance(data, dict):
            print(f"WARNING: Standard journey LLM returned non-dict: {type(data)} - {str(data)[:200]}")
            data = {"stages": [], "pain_points": [], "emotion_curve": [], "confidence_score": 0.5}

        # Update session with generated data
        session_obj = self.get_session(db, session_id)
        session_obj.stages = data.get("stages", [])
        session_obj.emotion_curve = data.get("emotion_curve", [])
        session_obj.confidence_score = data.get("confidence_score", 0.7)
        session_obj.data_quality_warning = data_quality_warning
        session_obj.raw_llm_response = json.dumps(data)
        db.add(session_obj)
        db.commit()

        # Create pain points
        for pp_data in data.get("pain_points", []):
            # Skip if pp_data is not a dict
            if not isinstance(pp_data, dict):
                print(f"WARNING: Skipping non-dict pain point: {pp_data}")
                continue
            evidence = pp_data.get("evidence", [])
            if not isinstance(evidence, list):
                evidence = []
            data_sources = []
            for e in evidence:
                if isinstance(e, dict):
                    data_sources.append({"source_type": e.get("source", "unknown"), "excerpt": e.get("excerpt", "")})
                elif isinstance(e, str):
                    data_sources.append({"source_type": "unknown", "excerpt": e})
            pain_point = JourneyPainPoint(
                journey_map_id=session_id,
                stage_id=pp_data.get("stage_id", "unknown"),
                description=pp_data.get("description", ""),
                severity=float(pp_data.get("severity", 5.0)),
                frequency=int(pp_data.get("frequency", 1)),
                data_sources=data_sources
            )
            db.add(pain_point)

        db.commit()

    def _generate_multi_persona_journey(self, db: Session, session_id: int, context: str):
        """Generate journey maps for multiple personas with divergence analysis."""
        session_obj = self.get_session(db, session_id)
        masked_description = self._mask_pii(session_obj.journey_description)
        masked_context = self._mask_pii(context)

        # Get personas
        personas = list(db.exec(
            select(JourneyPersona).where(JourneyPersona.journey_map_id == session_id)
        ).all())

        if not personas:
            raise ValueError("No personas defined for multi-persona journey")

        persona_names = [p.name for p in personas]
        persona_descriptions = {p.name: p.description or "" for p in personas}

        self._update_progress(db, session_id, "processing", 2, f"Generating journeys for {len(personas)} personas...")

        prompt = f"""You are an expert UX researcher. Create multi-persona customer journey maps.

JOURNEY TO MAP: {masked_description}

PERSONAS TO MAP:
{json.dumps([{"name": p.name, "description": p.description, "attributes": p.attributes} for p in personas], indent=2)}

DATA SOURCES:
{masked_context if masked_context else "No additional data. Generate typical journeys based on persona characteristics."}

Create journey maps for EACH persona, identifying:
1. Shared stages (common to all personas)
2. Persona-specific experiences at each stage
3. Divergence points (where personas have significantly different experiences)
4. Dependencies (where one persona blocks another, e.g., Admin must act before End User)
5. Pain points specific to each persona

Return EXACTLY this JSON structure:
{{
  "stages": [
    {{
      "id": "stage_1",
      "name": "Stage Name",
      "description": "General stage description",
      "order": 0,
      "touchpoints": [{{"id": "tp_1", "name": "Touchpoint", "description": "Details", "channel": "web"}}],
      "persona_experiences": {{
        "Persona Name": {{
          "emotion_score": 7.0,
          "duration_estimate": "1-2 days",
          "specific_notes": "How this persona experiences this stage differently"
        }}
      }}
    }}
  ],
  "pain_points": [
    {{
      "stage_id": "stage_1",
      "persona_name": "Persona Name",
      "description": "Pain point specific to this persona",
      "severity": 8.0,
      "frequency": 5,
      "evidence": [{{"source": "transcript", "excerpt": "Quote"}}]
    }}
  ],
  "divergence_points": [
    {{
      "stage_id": "stage_1",
      "description": "How personas diverge at this point",
      "divergence_score": 7.5,
      "persona_differences": [
        {{"persona_name": "Admin", "experience": "Must configure settings first", "pain_severity": 6.0}},
        {{"persona_name": "End User", "experience": "Blocked waiting for Admin", "pain_severity": 8.5}}
      ],
      "dependency": {{
        "blocking_persona": "Admin",
        "blocked_persona": "End User",
        "description": "End User cannot proceed until Admin completes configuration"
      }}
    }}
  ],
  "emotion_curves": {{
    "Persona Name": [
      {{"stage_id": "stage_1", "score": 7.0, "label": "Confident"}}
    ]
  }},
  "confidence_score": 0.8,
  "summary": "Multi-persona journey summary"
}}

IMPORTANT: Return ONLY valid JSON."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }. Every value must be properly typed - arrays must contain objects, not strings."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=8000,
            context="Multi-Persona Journey Generation"
        )

        self._update_progress(db, session_id, "processing", 3, "Saving journey maps...")

        # Ensure data is a dict
        if not isinstance(data, dict):
            print(f"WARNING: Multi-persona journey LLM returned non-dict: {type(data)} - {str(data)[:200]}")
            data = {"stages": [], "pain_points": [], "divergence_points": [], "emotion_curves": {}, "confidence_score": 0.5}

        # Update session
        session_obj = self.get_session(db, session_id)
        session_obj.stages = data.get("stages", [])
        session_obj.emotion_curve = data.get("emotion_curves", {})
        session_obj.confidence_score = data.get("confidence_score", 0.7)
        session_obj.raw_llm_response = json.dumps(data)
        db.add(session_obj)
        db.commit()

        # Map persona names to IDs
        persona_id_map = {p.name: p.id for p in personas}

        # Create pain points
        for pp_data in data.get("pain_points", []):
            # Skip if pp_data is not a dict
            if not isinstance(pp_data, dict):
                print(f"WARNING: Skipping non-dict pain point: {pp_data}")
                continue
            persona_name = pp_data.get("persona_name")
            persona_id = persona_id_map.get(persona_name) if persona_name else None
            evidence = pp_data.get("evidence", [])
            if not isinstance(evidence, list):
                evidence = []
            data_sources = []
            for e in evidence:
                if isinstance(e, dict):
                    data_sources.append({"source_type": e.get("source", "unknown"), "excerpt": e.get("excerpt", "")})
                elif isinstance(e, str):
                    data_sources.append({"source_type": "unknown", "excerpt": e})

            pain_point = JourneyPainPoint(
                journey_map_id=session_id,
                stage_id=pp_data.get("stage_id", "unknown"),
                description=pp_data.get("description", ""),
                severity=float(pp_data.get("severity", 5.0)),
                frequency=int(pp_data.get("frequency", 1)),
                persona_id=persona_id,
                data_sources=data_sources
            )
            db.add(pain_point)

        # Create divergence points
        for dp_data in data.get("divergence_points", []):
            # Skip if dp_data is not a dict
            if not isinstance(dp_data, dict):
                print(f"WARNING: Skipping non-dict divergence point: {dp_data}")
                continue
            dependency = dp_data.get("dependency", {})
            if not isinstance(dependency, dict):
                dependency = {}
            blocking_persona_id = persona_id_map.get(dependency.get("blocking_persona")) if dependency else None
            blocked_persona_id = persona_id_map.get(dependency.get("blocked_persona")) if dependency else None

            divergence = JourneyDivergencePoint(
                journey_map_id=session_id,
                stage_id=dp_data.get("stage_id", "unknown"),
                description=dp_data.get("description", ""),
                divergence_score=float(dp_data.get("divergence_score", 5.0)),
                persona_differences=dp_data.get("persona_differences", []),
                dependency_description=dependency.get("description") if dependency else None,
                blocking_persona_id=blocking_persona_id,
                blocked_persona_id=blocked_persona_id
            )
            db.add(divergence)

        db.commit()

    def _generate_competitive_journey(self, db: Session, session_id: int, context: str):
        """Generate a competitive journey map from user observations."""
        session_obj = self.get_session(db, session_id)
        masked_description = self._mask_pii(session_obj.journey_description)
        competitor_name = session_obj.competitor_name or "Competitor"

        # Get observations
        observations = list(db.exec(
            select(CompetitorJourneyObservation)
            .where(CompetitorJourneyObservation.journey_map_id == session_id)
            .order_by(CompetitorJourneyObservation.stage_order)
        ).all())

        self._update_progress(db, session_id, "processing", 2, f"Analyzing {competitor_name} journey...")

        if observations:
            # Generate from user observations
            obs_data = [
                {
                    "stage_name": o.stage_name,
                    "touchpoints": o.touchpoints_observed,
                    "time_taken": o.time_taken,
                    "friction_points": o.friction_points,
                    "strengths": o.strengths_observed,
                    "notes": o.notes
                }
                for o in observations
            ]

            prompt = f"""You are a competitive analysis expert. Create a journey map for {competitor_name} based on walkthrough observations.

JOURNEY: {masked_description}
COMPETITOR: {competitor_name}

USER OBSERVATIONS:
{json.dumps(obs_data, indent=2)}

Synthesize the observations into a structured journey map:
1. Organize stages logically
2. Identify pain points from friction observations
3. Note strengths as positive touchpoints
4. Estimate severity based on described friction

Return EXACTLY this JSON structure:
{{
  "stages": [
    {{
      "id": "stage_1",
      "name": "Stage Name",
      "description": "What happens",
      "order": 0,
      "duration_estimate": "from observations",
      "touchpoints": [{{"id": "tp_1", "name": "Touchpoint", "description": "Details", "channel": "web", "is_strength": false}}],
      "emotion_score": 6.0
    }}
  ],
  "pain_points": [
    {{
      "stage_id": "stage_1",
      "description": "Friction point observed",
      "severity": 6.5,
      "frequency": 1,
      "evidence": [{{"source": "observation", "excerpt": "User noted..."}}]
    }}
  ],
  "strengths": [
    {{
      "stage_id": "stage_1",
      "description": "What competitor does well",
      "evidence": "From observation"
    }}
  ],
  "emotion_curve": [{{"stage_id": "stage_1", "score": 6.0, "label": "Neutral"}}],
  "confidence_score": 0.75,
  "summary": "Competitive analysis summary"
}}

IMPORTANT: Return ONLY valid JSON."""

        else:
            # Generate hypothetical competitor journey
            prompt = f"""You are a competitive analysis expert. Create a hypothetical journey map for {competitor_name}.

JOURNEY TO MAP: {masked_description}
COMPETITOR: {competitor_name}

Based on typical competitor patterns, create a journey map that:
1. Represents a plausible competitor experience
2. Identifies common pain points in this type of journey
3. Notes typical competitor strengths

Return EXACTLY this JSON structure:
{{
  "stages": [...],
  "pain_points": [...],
  "strengths": [...],
  "emotion_curve": [...],
  "confidence_score": 0.5,
  "summary": "Hypothetical competitive analysis - based on typical patterns, not actual observations"
}}

IMPORTANT: Return ONLY valid JSON."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }. Every value must be properly typed - arrays must contain objects, not strings."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=5000,
            context="Competitive Journey Generation"
        )

        self._update_progress(db, session_id, "processing", 3, "Saving competitive analysis...")

        # Ensure data is a dict
        if not isinstance(data, dict):
            print(f"WARNING: Competitive journey LLM returned non-dict: {type(data)}")
            data = {"stages": [], "pain_points": [], "emotion_curve": [], "confidence_score": 0.5}

        # Update session
        session_obj = self.get_session(db, session_id)
        session_obj.stages = data.get("stages", [])
        session_obj.emotion_curve = data.get("emotion_curve", [])
        session_obj.confidence_score = data.get("confidence_score", 0.6)
        session_obj.raw_llm_response = json.dumps(data)
        db.add(session_obj)
        db.commit()

        # Create pain points
        for pp_data in data.get("pain_points", []):
            # Skip if pp_data is not a dict
            if not isinstance(pp_data, dict):
                print(f"WARNING: Skipping non-dict pain point: {pp_data}")
                continue
            evidence = pp_data.get("evidence", [])
            # Ensure evidence items are dicts
            if not isinstance(evidence, list):
                evidence = []
            data_sources = []
            for e in evidence:
                if isinstance(e, dict):
                    data_sources.append({"source_type": e.get("source", "observation"), "excerpt": e.get("excerpt", "")})
                elif isinstance(e, str):
                    data_sources.append({"source_type": "observation", "excerpt": e})
            pain_point = JourneyPainPoint(
                journey_map_id=session_id,
                stage_id=pp_data.get("stage_id", "unknown"),
                description=pp_data.get("description", ""),
                severity=float(pp_data.get("severity", 5.0)),
                frequency=int(pp_data.get("frequency", 1)),
                data_sources=data_sources
            )
            db.add(pain_point)

        db.commit()

    # --- Competitor Walkthrough ---

    def add_competitor_observation(
        self,
        db: Session,
        journey_map_id: int,
        stage_order: int,
        stage_name: str,
        touchpoints_observed: Optional[List[str]] = None,
        time_taken: Optional[str] = None,
        friction_points: Optional[List[str]] = None,
        strengths_observed: Optional[List[str]] = None,
        notes: Optional[str] = None,
        screenshot_url: Optional[str] = None
    ) -> CompetitorJourneyObservation:
        """Add an observation during competitive walkthrough."""
        observation = CompetitorJourneyObservation(
            journey_map_id=journey_map_id,
            stage_order=stage_order,
            stage_name=stage_name,
            touchpoints_observed=touchpoints_observed,
            time_taken=time_taken,
            friction_points=friction_points,
            strengths_observed=strengths_observed,
            notes=notes,
            screenshot_url=screenshot_url
        )
        db.add(observation)
        db.commit()
        db.refresh(observation)
        return observation

    # --- Version Control ---

    def create_new_version(
        self,
        db: Session,
        parent_session_id: int,
        new_file_metadata: Optional[List[Dict[str, Any]]] = None,
        new_knowledge_base_ids: Optional[List[int]] = None,
        update_type: str = "refresh"  # refresh, expand, correct
    ) -> JourneyMapSession:
        """Create a new version of a journey map with updated data."""
        parent = self.get_session(db, parent_session_id)
        if not parent:
            raise ValueError("Parent session not found")

        # Calculate new version number
        current_version = parent.version or "1.0"
        major, minor = map(int, current_version.split("."))
        if update_type == "refresh":
            new_version = f"{major}.{minor + 1}"
        else:
            new_version = f"{major + 1}.0"

        # Merge file metadata
        combined_files = (parent.file_metadata or []) + (new_file_metadata or [])
        combined_kbs = list(set((parent.knowledge_base_ids or []) + (new_knowledge_base_ids or [])))

        # Create new session
        new_session = JourneyMapSession(
            user_id=parent.user_id,
            mode=parent.mode,
            journey_description=parent.journey_description,
            competitor_name=parent.competitor_name,
            version=new_version,
            parent_version_id=parent_session_id,
            file_metadata=combined_files,
            knowledge_base_ids=combined_kbs,
            status="pending",
            progress_step=0,
            progress_message="Preparing version update..."
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        # Copy personas for multi-persona mode
        if parent.mode == "multi_persona":
            parent_personas = list(db.exec(
                select(JourneyPersona).where(JourneyPersona.journey_map_id == parent_session_id)
            ).all())
            for p in parent_personas:
                new_persona = JourneyPersona(
                    journey_map_id=new_session.id,
                    name=p.name,
                    description=p.description,
                    attributes=p.attributes,
                    color=p.color,
                    source_persona_id=p.id
                )
                db.add(new_persona)
            db.commit()

        return new_session

    def run_version_update_pipeline(self, db: Session, session_id: int):
        """Pipeline for updating an existing journey with new data and computing deltas."""
        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj or not session_obj.parent_version_id:
                raise ValueError("Session not found or is not a version update")

            parent = self.get_session(db, session_obj.parent_version_id)
            if not parent:
                raise ValueError("Parent session not found")

            # Get parent pain points for comparison
            parent_pain_points = list(db.exec(
                select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == parent.id)
            ).all())

            self._update_progress(db, session_id, "processing", 1, "Analyzing data changes...")

            # Run normal generation
            context = self._build_journey_context(db, session_obj)
            if session_obj.mode == "standard":
                self._generate_standard_journey(db, session_id, context)
            elif session_obj.mode == "multi_persona":
                self._generate_multi_persona_journey(db, session_id, context)
            elif session_obj.mode == "competitive":
                self._generate_competitive_journey(db, session_id, context)

            self._update_progress(db, session_id, "processing", 4, "Computing delta analysis...")

            # Compute deltas
            new_pain_points = list(db.exec(
                select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == session_id)
            ).all())

            delta_summary = self._compute_pain_point_deltas(
                db, parent_pain_points, new_pain_points
            )

            session_obj = self.get_session(db, session_id)
            session_obj.delta_summary = delta_summary
            session_obj.status = "completed"
            session_obj.completed_at = datetime.utcnow()
            session_obj.progress_message = "Version update complete!"
            db.add(session_obj)
            db.commit()

        except Exception as e:
            print(f"ERROR in version update pipeline: {str(e)}")
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

    def _compute_pain_point_deltas(
        self,
        db: Session,
        parent_points: List[JourneyPainPoint],
        new_points: List[JourneyPainPoint]
    ) -> Dict[str, Any]:
        """Compare pain points between versions and mark deltas."""
        # Simple matching by description similarity
        improved = 0
        worsened = 0
        new_count = 0
        resolved = 0

        parent_map = {pp.description.lower()[:50]: pp for pp in parent_points}

        for new_pp in new_points:
            key = new_pp.description.lower()[:50]
            if key in parent_map:
                parent_pp = parent_map[key]
                if new_pp.severity < parent_pp.severity - 0.5:
                    new_pp.delta_status = "improved"
                    new_pp.previous_severity = parent_pp.severity
                    improved += 1
                elif new_pp.severity > parent_pp.severity + 0.5:
                    new_pp.delta_status = "worsened"
                    new_pp.previous_severity = parent_pp.severity
                    worsened += 1
                else:
                    new_pp.delta_status = "unchanged"
                    new_pp.previous_severity = parent_pp.severity
                del parent_map[key]
            else:
                new_pp.delta_status = "new"
                new_count += 1
            db.add(new_pp)

        # Remaining parent points are resolved
        resolved = len(parent_map)

        db.commit()

        return {
            "improved": improved,
            "worsened": worsened,
            "new": new_count,
            "resolved": resolved,
            "total_before": len(parent_points),
            "total_after": len(new_points)
        }

    # --- Comparison ---

    def compare_versions(
        self,
        db: Session,
        version1_id: int,
        version2_id: int
    ) -> Dict[str, Any]:
        """Compare two journey map versions."""
        v1 = self.get_session_detail(db, version1_id)
        v2 = self.get_session_detail(db, version2_id)

        if not v1 or not v2:
            raise ValueError("One or both versions not found")

        return {
            "version1": v1,
            "version2": v2,
            "deltaSummary": v2.get("session").delta_summary if v2.get("session") else None
        }


# Global instance
journey_mapper_service = JourneyMapperService()
