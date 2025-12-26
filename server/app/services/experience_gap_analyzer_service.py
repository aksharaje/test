"""
Experience Gap Analyzer Service

Business logic for AI-powered experience gap analysis.
Compares customer journeys to identify gaps and generate prioritized improvement roadmaps.
"""
import json
import re
import time
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from humps import camelize

from app.models.experience_gap_analyzer import (
    GapAnalysisSession,
    GapItem,
    CapabilityMatrixItem,
    StageAlignment
)
from app.models.journey_mapper import JourneyMapSession, JourneyPainPoint
from openai import OpenAI


def _camelize_nested(obj: Any) -> Any:
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {camelize(k): _camelize_nested(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_camelize_nested(item) for item in obj]
    return obj


class ExperienceGapAnalyzerService:
    """Service for managing experience gap analysis sessions"""

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

    def _calculate_opportunity_score(self, impact: float, urgency: float, effort: float) -> float:
        """Calculate opportunity score: (Impact × Urgency) / Effort"""
        if effort <= 0:
            effort = 1.0
        return round((impact * urgency) / effort, 2)

    def _calculate_priority_tier(self, opportunity_score: float) -> int:
        """Determine priority tier based on opportunity score."""
        if opportunity_score > 15:
            return 1  # Critical
        elif opportunity_score >= 8:
            return 2  # Important
        else:
            return 3  # Nice-to-have

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        analysis_type: str,
        your_journey_id: int,
        comparison_journey_id: Optional[int] = None,
        analysis_name: Optional[str] = None,
        user_id: Optional[int] = None,
        knowledge_base_ids: Optional[List[int]] = None,
        analysis_parameters: Optional[Dict[str, Any]] = None
    ) -> GapAnalysisSession:
        """Create a new gap analysis session."""
        if analysis_type not in ["competitive", "best_practice", "temporal"]:
            raise ValueError("Analysis type must be competitive, best_practice, or temporal")

        # Verify your journey exists
        your_journey = db.get(JourneyMapSession, your_journey_id)
        if not your_journey:
            raise ValueError("Your journey map not found")
        if your_journey.status != "completed":
            raise ValueError("Your journey map must be completed before analysis")

        # For competitive/best_practice, comparison journey is required
        if analysis_type in ["competitive", "best_practice"] and comparison_journey_id:
            comparison_journey = db.get(JourneyMapSession, comparison_journey_id)
            if not comparison_journey:
                raise ValueError("Comparison journey map not found")
            if comparison_journey.status != "completed":
                raise ValueError("Comparison journey map must be completed before analysis")

        session_obj = GapAnalysisSession(
            user_id=user_id,
            analysis_type=analysis_type,
            analysis_name=analysis_name or f"{analysis_type.replace('_', ' ').title()} Analysis",
            your_journey_id=your_journey_id,
            comparison_journey_id=comparison_journey_id,
            knowledge_base_ids=knowledge_base_ids,
            analysis_parameters=analysis_parameters or {"impactWeight": 1.0, "urgencyWeight": 1.0, "effortWeight": 1.0},
            status="pending",
            progress_step=0,
            progress_message="Initializing gap analysis..."
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def get_session(self, db: Session, session_id: int) -> Optional[GapAnalysisSession]:
        """Get a session by ID."""
        return db.get(GapAnalysisSession, session_id)

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[GapAnalysisSession]:
        """List all sessions, optionally filtered by user."""
        statement = select(GapAnalysisSession)
        if user_id:
            statement = statement.where(GapAnalysisSession.user_id == user_id)
        statement = statement.order_by(desc(GapAnalysisSession.created_at)).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def get_session_detail(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get complete session detail with all related data."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return None

        # Fetch related data
        gaps = list(db.exec(
            select(GapItem)
            .where(GapItem.session_id == session_id)
            .order_by(GapItem.priority_tier, desc(GapItem.opportunity_score))
        ).all())

        capability_matrix = list(db.exec(
            select(CapabilityMatrixItem)
            .where(CapabilityMatrixItem.session_id == session_id)
            .order_by(CapabilityMatrixItem.display_order)
        ).all())

        stage_alignments = list(db.exec(
            select(StageAlignment)
            .where(StageAlignment.session_id == session_id)
            .order_by(StageAlignment.display_order)
        ).all())

        # Get journey details for context
        your_journey = None
        comparison_journey = None
        if session_obj.your_journey_id:
            your_journey = db.get(JourneyMapSession, session_obj.your_journey_id)
        if session_obj.comparison_journey_id:
            comparison_journey = db.get(JourneyMapSession, session_obj.comparison_journey_id)

        return {
            "session": session_obj,
            "gaps": [_camelize_nested(g.model_dump()) for g in gaps],
            "capabilityMatrix": [_camelize_nested(c.model_dump()) for c in capability_matrix],
            "stageAlignments": [_camelize_nested(s.model_dump()) for s in stage_alignments],
            "yourJourney": _camelize_nested(your_journey.model_dump()) if your_journey else None,
            "comparisonJourney": _camelize_nested(comparison_journey.model_dump()) if comparison_journey else None
        }

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return False

        # Delete related data
        for obj in db.exec(select(GapItem).where(GapItem.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(CapabilityMatrixItem).where(CapabilityMatrixItem.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(StageAlignment).where(StageAlignment.session_id == session_id)):
            db.delete(obj)

        db.delete(session_obj)
        db.commit()
        return True

    # --- Gap Management ---

    def update_gap(
        self,
        db: Session,
        gap_id: int,
        updates: Dict[str, Any]
    ) -> Optional[GapItem]:
        """Update a gap item (user edits)."""
        gap = db.get(GapItem, gap_id)
        if not gap:
            return None

        if "title" in updates:
            gap.title = updates["title"]
        if "description" in updates:
            gap.description = updates["description"]
        if "impact_score" in updates:
            gap.impact_score = float(updates["impact_score"])
        if "urgency_score" in updates:
            gap.urgency_score = float(updates["urgency_score"])
        if "effort_score" in updates:
            gap.effort_score = float(updates["effort_score"])
        if "user_priority_override" in updates:
            gap.user_priority_override = updates["user_priority_override"]

        # Recalculate opportunity score and tier
        gap.opportunity_score = self._calculate_opportunity_score(
            gap.impact_score, gap.urgency_score, gap.effort_score
        )
        if gap.user_priority_override:
            gap.priority_tier = gap.user_priority_override
        else:
            gap.priority_tier = self._calculate_priority_tier(gap.opportunity_score)

        gap.is_user_edited = True
        gap.updated_at = datetime.utcnow()

        db.add(gap)
        db.commit()
        db.refresh(gap)

        return gap

    def add_gap(
        self,
        db: Session,
        session_id: int,
        title: str,
        description: str,
        category: str = "experience",
        impact_score: float = 5.0,
        urgency_score: float = 5.0,
        effort_score: float = 5.0,
        stage_id: Optional[str] = None,
        stage_name: Optional[str] = None
    ) -> GapItem:
        """Manually add a gap."""
        opportunity_score = self._calculate_opportunity_score(impact_score, urgency_score, effort_score)
        priority_tier = self._calculate_priority_tier(opportunity_score)

        gap = GapItem(
            session_id=session_id,
            title=title,
            description=description,
            category=category,
            stage_id=stage_id,
            stage_name=stage_name,
            impact_score=impact_score,
            urgency_score=urgency_score,
            effort_score=effort_score,
            opportunity_score=opportunity_score,
            priority_tier=priority_tier,
            is_user_edited=True
        )
        db.add(gap)
        db.commit()
        db.refresh(gap)
        return gap

    def delete_gap(self, db: Session, gap_id: int) -> bool:
        """Delete a gap."""
        gap = db.get(GapItem, gap_id)
        if not gap:
            return False
        db.delete(gap)
        db.commit()
        return True

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

    # --- Analysis Pipeline ---

    def run_gap_analysis_pipeline(self, db: Session, session_id: int):
        """Main pipeline for generating gap analysis. Runs in background task."""
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            self._update_progress(db, session_id, "analyzing", 1, "Loading journey maps...")

            # Load journeys
            your_journey = db.get(JourneyMapSession, session_obj.your_journey_id)
            if not your_journey:
                raise ValueError("Your journey map not found")

            comparison_journey = None
            if session_obj.comparison_journey_id:
                comparison_journey = db.get(JourneyMapSession, session_obj.comparison_journey_id)

            # Load pain points for both journeys
            your_pain_points = list(db.exec(
                select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == your_journey.id)
            ).all())

            comparison_pain_points = []
            if comparison_journey:
                comparison_pain_points = list(db.exec(
                    select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == comparison_journey.id)
                ).all())

            self._update_progress(db, session_id, "analyzing", 2, "Aligning journey stages...")

            # Step 1: Align stages between journeys
            self._generate_stage_alignments(db, session_id, your_journey, comparison_journey)

            self._update_progress(db, session_id, "analyzing", 3, "Identifying experience gaps...")

            # Step 2: Identify gaps
            self._generate_gaps(
                db, session_id, your_journey, comparison_journey,
                your_pain_points, comparison_pain_points,
                session_obj.analysis_type
            )

            self._update_progress(db, session_id, "analyzing", 4, "Building capability matrix...")

            # Step 3: Generate capability matrix
            self._generate_capability_matrix(db, session_id, your_journey, comparison_journey)

            self._update_progress(db, session_id, "generating_roadmap", 5, "Creating prioritized roadmap...")

            # Step 4: Generate roadmap and overall assessment
            self._generate_roadmap_and_assessment(db, session_id)

            # Mark completed
            session_obj = self.get_session(db, session_id)
            session_obj.status = "completed"
            session_obj.completed_at = datetime.utcnow()
            session_obj.progress_message = "Gap analysis complete!"
            db.add(session_obj)
            db.commit()

            print(f"Gap analysis completed in {time.time() - start_time:.2f}s")

        except Exception as e:
            print(f"ERROR in gap analysis pipeline: {str(e)}")
            import traceback
            traceback.print_exc()
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

    def _generate_stage_alignments(
        self,
        db: Session,
        session_id: int,
        your_journey: JourneyMapSession,
        comparison_journey: Optional[JourneyMapSession]
    ):
        """Align stages between your journey and comparison journey."""
        your_stages = your_journey.stages or []
        comparison_stages = comparison_journey.stages if comparison_journey else []

        if not comparison_stages:
            # No comparison - just create alignments for your stages
            for idx, stage in enumerate(your_stages):
                alignment = StageAlignment(
                    session_id=session_id,
                    your_stage_id=stage.get("id", f"stage_{idx}"),
                    your_stage_name=stage.get("name", f"Stage {idx + 1}"),
                    alignment_type="no_comparison",
                    display_order=idx
                )
                db.add(alignment)
            db.commit()
            return

        # Use LLM to intelligently match stages
        prompt = f"""You are an expert at comparing customer journey maps. Match stages between two journeys.

YOUR JOURNEY STAGES:
{json.dumps([{"id": s.get("id"), "name": s.get("name"), "description": s.get("description", "")} for s in your_stages], indent=2)}

COMPARISON JOURNEY STAGES:
{json.dumps([{"id": s.get("id"), "name": s.get("name"), "description": s.get("description", "")} for s in comparison_stages], indent=2)}

Match each of your stages to the most similar comparison stage. Some stages may not have a match.

Return JSON with this structure:
{{
  "alignments": [
    {{
      "your_stage_id": "stage_1",
      "your_stage_name": "Discovery",
      "comparison_stage_id": "comp_1",
      "comparison_stage_name": "Awareness",
      "alignment_type": "aligned"
    }}
  ]
}}

alignment_type options:
- "aligned": Stages represent the same phase
- "missing_in_comparison": Your stage has no equivalent in comparison
- "different": Stages are at same position but represent different things

IMPORTANT: Return ONLY valid JSON."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=2000,
            context="Stage Alignment"
        )

        alignments = data.get("alignments", [])
        for idx, align in enumerate(alignments):
            if not isinstance(align, dict):
                continue
            alignment = StageAlignment(
                session_id=session_id,
                your_stage_id=align.get("your_stage_id", ""),
                your_stage_name=align.get("your_stage_name", ""),
                comparison_stage_id=align.get("comparison_stage_id"),
                comparison_stage_name=align.get("comparison_stage_name"),
                alignment_type=align.get("alignment_type", "aligned"),
                display_order=idx
            )
            db.add(alignment)

        db.commit()

    def _generate_gaps(
        self,
        db: Session,
        session_id: int,
        your_journey: JourneyMapSession,
        comparison_journey: Optional[JourneyMapSession],
        your_pain_points: List[JourneyPainPoint],
        comparison_pain_points: List[JourneyPainPoint],
        analysis_type: str
    ):
        """Identify gaps between journeys using LLM analysis."""
        your_stages = your_journey.stages or []
        comparison_stages = comparison_journey.stages if comparison_journey else []

        # Build context for LLM
        your_journey_context = {
            "stages": [{"id": s.get("id"), "name": s.get("name"), "description": s.get("description", ""), "emotion_score": s.get("emotion_score", 5)} for s in your_stages],
            "pain_points": [{"stage_id": pp.stage_id, "description": pp.description, "severity": pp.severity} for pp in your_pain_points]
        }

        comparison_context = None
        if comparison_journey:
            comparison_context = {
                "stages": [{"id": s.get("id"), "name": s.get("name"), "description": s.get("description", ""), "emotion_score": s.get("emotion_score", 5)} for s in comparison_stages],
                "pain_points": [{"stage_id": pp.stage_id, "description": pp.description, "severity": pp.severity} for pp in comparison_pain_points]
            }

        analysis_context = ""
        if analysis_type == "competitive":
            analysis_context = "Compare your customer journey against a competitor's journey based on the provided data."
        elif analysis_type == "best_practice":
            analysis_context = "Analyze your customer journey for potential improvement areas."
        else:  # temporal
            analysis_context = "Compare your current journey against a previous version to identify changes."

        prompt = f"""You are a customer experience analyst. {analysis_context}

IMPORTANT INSTRUCTIONS:
- ONLY identify gaps that are directly supported by evidence in the journey data below
- Do NOT invent or assume gaps that aren't visible in the data
- Base all scores on the actual data provided (pain point severity, emotion scores, etc.)
- If the data is limited, identify fewer gaps rather than inventing them

YOUR JOURNEY DATA:
{json.dumps(your_journey_context, indent=2)}

{"COMPARISON JOURNEY DATA:" if comparison_context else ""}
{json.dumps(comparison_context, indent=2) if comparison_context else ""}

For gaps you identify from the data:
1. Impact Score (1-10): Based on pain point severity and emotion scores in the data
2. Urgency Score (1-10): Based on how severe the pain points are in the data
3. Effort Score (1-10): Your estimate of implementation difficulty (acknowledge this is an estimate)

Return JSON with this structure:
{{
  "gaps": [
    {{
      "title": "Short descriptive title",
      "description": "Detailed description of the gap",
      "category": "experience|capability|quality|process",
      "stage_id": "stage_id from your journey",
      "stage_name": "Stage name",
      "impact_score": 8,
      "urgency_score": 7,
      "effort_score": 4,
      "evidence": "REQUIRED: Quote or reference the specific data point (pain point, emotion score, stage description) that supports this gap",
      "comparison_notes": "How the comparison journey differs (if comparison data provided)"
    }}
  ],
  "relative_strengths": [
    {{
      "stage_id": "stage_id",
      "title": "Area where your journey shows strength",
      "description": "Description based on the journey data",
      "evidence": "REQUIRED: Specific data point (e.g., 'emotion_score: 8 in Checkout stage', 'no pain points in Support stage')"
    }}
  ],
  "data_limitations": "Describe any limitations in the data that affect the analysis"
}}

CRITICAL RULES:
1. Only include gaps where you can cite specific data (pain point description, low emotion score, etc.)
2. For relative_strengths: ONLY include if there is concrete numeric evidence (emotion scores > 7, fewer pain points than comparison). If no evidence exists, return empty array.
3. If the journey data has few pain points or limited detail, return fewer gaps rather than inventing them.
4. The "evidence" field MUST reference actual data from the journey, not assumptions.

IMPORTANT: Return ONLY valid JSON."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=6000,
            context="Gap Identification"
        )

        # Process gaps
        gaps = data.get("gaps", [])
        for gap_data in gaps:
            if not isinstance(gap_data, dict):
                continue

            impact = float(gap_data.get("impact_score", 5))
            urgency = float(gap_data.get("urgency_score", 5))
            effort = float(gap_data.get("effort_score", 5))
            opportunity_score = self._calculate_opportunity_score(impact, urgency, effort)
            priority_tier = self._calculate_priority_tier(opportunity_score)

            gap = GapItem(
                session_id=session_id,
                title=gap_data.get("title", "Untitled Gap"),
                description=gap_data.get("description", ""),
                category=gap_data.get("category", "experience"),
                stage_id=gap_data.get("stage_id"),
                stage_name=gap_data.get("stage_name"),
                impact_score=impact,
                urgency_score=urgency,
                effort_score=effort,
                opportunity_score=opportunity_score,
                priority_tier=priority_tier,
                evidence=gap_data.get("evidence"),
                comparison_notes=gap_data.get("comparison_notes")
            )
            db.add(gap)

        # Store competitive advantages in session
        session_obj = self.get_session(db, session_id)
        # Use relative_strengths (renamed from competitive_advantages to be more honest)
        session_obj.competitive_advantages = data.get("relative_strengths", [])
        db.add(session_obj)

        db.commit()

    def _generate_capability_matrix(
        self,
        db: Session,
        session_id: int,
        your_journey: JourneyMapSession,
        comparison_journey: Optional[JourneyMapSession]
    ):
        """Generate capability comparison matrix."""
        your_stages = your_journey.stages or []
        comparison_stages = comparison_journey.stages if comparison_journey else []

        prompt = f"""Analyze the customer experience capabilities visible in this journey data.

IMPORTANT: This is an INFERENCE exercise based on limited journey data. Be honest about confidence levels.

YOUR JOURNEY STAGES:
{json.dumps([{"name": s.get("name"), "description": s.get("description", ""), "touchpoints": s.get("touchpoints", [])} for s in your_stages], indent=2)}

{"COMPARISON JOURNEY STAGES:" if comparison_stages else "No comparison journey provided."}
{json.dumps([{"name": s.get("name"), "description": s.get("description", ""), "touchpoints": s.get("touchpoints", [])} for s in comparison_stages], indent=2) if comparison_stages else ""}

ONLY evaluate capabilities where you have actual evidence from the journey data.
Categories to consider (only include if evidence exists):
- Onboarding & First Use
- Self-Service
- Support & Help
- Communication & Transparency

For each capability you can assess from the data:
- your_score: Based on what's visible in your journey data (or null if not assessable)
- comparison_score: Based on comparison data (or null if no comparison/not visible)
- confidence: "high" if clear evidence, "low" if inferring from limited data

Return JSON:
{{
  "capabilities": [
    {{
      "capability_name": "Onboarding Flow",
      "category": "Onboarding & First Use",
      "your_score": 6,
      "comparison_score": 8,
      "confidence": "low",
      "your_evidence": "REQUIRED: Specific stage/touchpoint that supports this score",
      "comparison_evidence": "Specific evidence from comparison data, or 'No comparison data'",
      "improvement_suggestion": "How to improve based on visible gaps"
    }}
  ],
  "analysis_notes": "Describe limitations of this analysis given the data available"
}}

Only include capabilities where you have actual evidence. If data is limited, return fewer items.

IMPORTANT: Return ONLY valid JSON."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000,
            context="Capability Matrix"
        )

        capabilities = data.get("capabilities", [])
        for idx, cap in enumerate(capabilities):
            if not isinstance(cap, dict):
                continue

            your_score = float(cap.get("your_score", 5))
            comparison_score = float(cap.get("comparison_score", 5))
            gap_score = comparison_score - your_score

            matrix_item = CapabilityMatrixItem(
                session_id=session_id,
                capability_name=cap.get("capability_name", ""),
                category=cap.get("category", "General"),
                your_score=your_score,
                comparison_score=comparison_score,
                gap_score=gap_score,
                your_evidence=cap.get("your_evidence"),
                comparison_evidence=cap.get("comparison_evidence"),
                improvement_suggestion=cap.get("improvement_suggestion"),
                display_order=idx
            )
            db.add(matrix_item)

        # Store summary in session
        categories = list(set(cap.get("category", "General") for cap in capabilities if isinstance(cap, dict)))
        session_obj = self.get_session(db, session_id)
        session_obj.capability_matrix_summary = {
            "categories": categories,
            "totalCapabilities": len(capabilities)
        }
        db.add(session_obj)

        db.commit()

    def _generate_roadmap_and_assessment(self, db: Session, session_id: int):
        """Generate prioritized roadmap and overall assessment."""
        # Get all gaps
        gaps = list(db.exec(
            select(GapItem)
            .where(GapItem.session_id == session_id)
            .order_by(GapItem.priority_tier, desc(GapItem.opportunity_score))
        ).all())

        # Organize into tiers
        tier1 = [g for g in gaps if g.priority_tier == 1]
        tier2 = [g for g in gaps if g.priority_tier == 2]
        tier3 = [g for g in gaps if g.priority_tier == 3]

        # Build roadmap
        roadmap = {
            "tier1": [{"gapId": g.id, "title": g.title, "opportunityScore": g.opportunity_score, "rationale": f"High impact ({g.impact_score}) × High urgency ({g.urgency_score}) / Moderate effort ({g.effort_score})"} for g in tier1],
            "tier2": [{"gapId": g.id, "title": g.title, "opportunityScore": g.opportunity_score, "rationale": "Important but not critical"} for g in tier2],
            "tier3": [{"gapId": g.id, "title": g.title, "opportunityScore": g.opportunity_score, "rationale": "Nice-to-have improvements"} for g in tier3]
        }

        # Calculate overall health score
        total_gaps = len(gaps)
        critical_gaps = len(tier1)
        avg_gap_severity = sum(g.impact_score for g in gaps) / total_gaps if total_gaps > 0 else 0

        # Health score: 100 - (weighted gap impact)
        # More critical gaps = lower score
        health_score = max(0, min(100, 100 - (critical_gaps * 10) - (avg_gap_severity * 3)))

        # Get competitive advantages
        session_obj = self.get_session(db, session_id)
        advantages = session_obj.competitive_advantages or []

        # Generate executive summary using LLM
        summary_prompt = f"""Write a brief, honest summary of this gap analysis.

ANALYSIS DATA:
- Total gaps identified: {total_gaps}
- Critical (Tier 1): {critical_gaps}
- Important (Tier 2): {len(tier2)}
- Nice-to-have (Tier 3): {len(tier3)}

TOP GAPS (if any):
{json.dumps([{"title": g.title, "description": g.description, "evidence": g.evidence} for g in tier1[:3]], indent=2) if tier1 else "No critical gaps identified"}

RELATIVE STRENGTHS (if data supported):
{json.dumps(advantages[:3], indent=2) if advantages else "No data-supported strengths identified"}

IMPORTANT: Be honest about the limitations of this analysis. This is based on journey map data, not comprehensive competitive research.

Return JSON:
{{
  "summary": "2-3 sentence summary that honestly describes what the analysis found and its limitations",
  "recommendedFocusAreas": ["Focus Area 1", "Focus Area 2"],
  "dataLimitations": "Brief note on what data would improve this analysis"
}}

IMPORTANT: Return ONLY valid JSON."""

        summary_data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. Return valid JSON only."},
                {"role": "user", "content": summary_prompt}
            ],
            temperature=0.3,
            max_tokens=1000,
            context="Executive Summary"
        )

        # Update session with results
        session_obj.overall_assessment = {
            "summary": summary_data.get("summary", "Gap analysis complete."),
            "totalGapsIdentified": total_gaps,
            "criticalGapsCount": critical_gaps,
            "competitiveAdvantagesCount": len(advantages),
            "overallHealthScore": round(health_score, 1),
            "recommendedFocusAreas": summary_data.get("recommendedFocusAreas", [])
        }
        session_obj.roadmap = roadmap

        db.add(session_obj)
        db.commit()

    # --- Roadmap Reordering ---

    def reorder_roadmap(
        self,
        db: Session,
        session_id: int,
        gap_id: int,
        new_tier: int
    ) -> Optional[GapItem]:
        """Allow user to drag-drop reorder gaps between tiers."""
        gap = db.get(GapItem, gap_id)
        if not gap or gap.session_id != session_id:
            return None

        gap.user_priority_override = new_tier
        gap.priority_tier = new_tier
        gap.is_user_edited = True
        gap.updated_at = datetime.utcnow()

        db.add(gap)
        db.commit()
        db.refresh(gap)

        # Regenerate roadmap in session
        self._regenerate_roadmap(db, session_id)

        return gap

    def _regenerate_roadmap(self, db: Session, session_id: int):
        """Regenerate roadmap after user edits."""
        gaps = list(db.exec(
            select(GapItem)
            .where(GapItem.session_id == session_id)
            .order_by(GapItem.priority_tier, desc(GapItem.opportunity_score))
        ).all())

        tier1 = [g for g in gaps if g.priority_tier == 1]
        tier2 = [g for g in gaps if g.priority_tier == 2]
        tier3 = [g for g in gaps if g.priority_tier == 3]

        roadmap = {
            "tier1": [{"gapId": g.id, "title": g.title, "opportunityScore": g.opportunity_score, "userOverride": g.user_priority_override is not None} for g in tier1],
            "tier2": [{"gapId": g.id, "title": g.title, "opportunityScore": g.opportunity_score, "userOverride": g.user_priority_override is not None} for g in tier2],
            "tier3": [{"gapId": g.id, "title": g.title, "opportunityScore": g.opportunity_score, "userOverride": g.user_priority_override is not None} for g in tier3]
        }

        session_obj = self.get_session(db, session_id)
        session_obj.roadmap = roadmap
        db.add(session_obj)
        db.commit()


# Global instance
experience_gap_analyzer_service = ExperienceGapAnalyzerService()
