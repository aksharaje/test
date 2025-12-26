"""
Research Planner Service

Business logic for AI-powered research planning workflow.
Uses LLM to recommend methods and generate research instruments.
"""
import json
import re
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.research_planner import (
    ResearchPlanSession,
    RecommendedMethod,
    InterviewGuide,
    Survey,
    RecruitingPlan
)
from openai import OpenAI


class ResearchPlannerService:
    """Service for managing research planning sessions"""

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
        """
        Robust JSON parsing for LLM responses.
        Handles markdown code fences, extra whitespace, and trailing content.
        """
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

    def _call_llm(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 3000, context: str = "LLM") -> Dict[str, Any]:
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

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        objective: str,
        constraints: Optional[Dict[str, Any]] = None,
        user_id: Optional[int] = None
    ) -> ResearchPlanSession:
        """Create a new research planning session"""
        if len(objective) < 10:
            raise ValueError("Research objective must be at least 10 characters")

        session_obj = ResearchPlanSession(
            user_id=user_id,
            objective=objective,
            constraints=constraints,
            status="pending",
            progress_step=0,
            progress_message="Initializing research planner..."
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def get_session(self, db: Session, session_id: int) -> Optional[ResearchPlanSession]:
        """Get a session by ID"""
        return db.get(ResearchPlanSession, session_id)

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[ResearchPlanSession]:
        """List all sessions, optionally filtered by user"""
        statement = select(ResearchPlanSession)
        if user_id:
            statement = statement.where(ResearchPlanSession.user_id == user_id)
        statement = statement.order_by(desc(ResearchPlanSession.created_at)).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def get_session_detail(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get complete session detail with all related data"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return None

        # Fetch related data
        methods = list(db.exec(
            select(RecommendedMethod)
            .where(RecommendedMethod.session_id == session_id)
            .order_by(RecommendedMethod.display_order)
        ).all())

        interview_guides = list(db.exec(
            select(InterviewGuide)
            .where(InterviewGuide.session_id == session_id)
        ).all())

        surveys = list(db.exec(
            select(Survey)
            .where(Survey.session_id == session_id)
        ).all())

        recruiting_plans = list(db.exec(
            select(RecruitingPlan)
            .where(RecruitingPlan.session_id == session_id)
        ).all())

        return {
            "session": session_obj,
            "recommendedMethods": methods,
            "interviewGuides": interview_guides,
            "surveys": surveys,
            "recruitingPlans": recruiting_plans
        }

    def select_methods(
        self,
        db: Session,
        session_id: int,
        method_names: List[str]
    ) -> ResearchPlanSession:
        """User selects which methods to proceed with"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        session_obj.selected_methods = method_names
        session_obj.updated_at = datetime.utcnow()

        # Update is_selected on recommended methods
        methods = db.exec(
            select(RecommendedMethod).where(RecommendedMethod.session_id == session_id)
        ).all()
        for method in methods:
            method.is_selected = method.method_name in method_names
            db.add(method)

        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def retry_session(self, db: Session, session_id: int) -> ResearchPlanSession:
        """Retry a failed session"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        # Reset session state
        session_obj.status = "pending"
        session_obj.error_message = None
        session_obj.progress_step = 0
        session_obj.progress_message = "Retrying analysis..."
        session_obj.updated_at = datetime.utcnow()

        # Clear previous results
        for obj in db.exec(select(RecommendedMethod).where(RecommendedMethod.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(InterviewGuide).where(InterviewGuide.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(Survey).where(Survey.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(RecruitingPlan).where(RecruitingPlan.session_id == session_id)):
            db.delete(obj)

        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return False

        # Delete related data
        for obj in db.exec(select(RecommendedMethod).where(RecommendedMethod.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(InterviewGuide).where(InterviewGuide.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(Survey).where(Survey.session_id == session_id)):
            db.delete(obj)
        for obj in db.exec(select(RecruitingPlan).where(RecruitingPlan.session_id == session_id)):
            db.delete(obj)

        db.delete(session_obj)
        db.commit()
        return True

    # --- Update Instruments ---

    def update_interview_guide(
        self,
        db: Session,
        guide_id: int,
        content_markdown: str
    ) -> Optional[InterviewGuide]:
        """Update interview guide content (user edits)"""
        guide = db.get(InterviewGuide, guide_id)
        if not guide:
            return None

        guide.user_edited_content = content_markdown
        guide.is_edited = True
        guide.updated_at = datetime.utcnow()

        db.add(guide)
        db.commit()
        db.refresh(guide)

        return guide

    def update_survey(
        self,
        db: Session,
        survey_id: int,
        questions: List[Dict[str, Any]]
    ) -> Optional[Survey]:
        """Update survey questions (user edits)"""
        survey = db.get(Survey, survey_id)
        if not survey:
            return None

        survey.questions = questions
        survey.is_edited = True
        survey.updated_at = datetime.utcnow()

        db.add(survey)
        db.commit()
        db.refresh(survey)

        return survey

    # --- AI Pipeline ---

    def _update_progress(
        self,
        db: Session,
        session_id: int,
        status: str,
        step: int,
        message: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update session progress"""
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

    def run_method_recommendation_pipeline(self, db: Session, session_id: int):
        """
        Pipeline Step 1: Recommend research methods based on objective.
        Runs in background task.
        """
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            self._update_progress(db, session_id, "recommending", 1, "Analyzing research objective...")
            methods = self._recommend_methods(db, session_id)

            self._update_progress(db, session_id, "selecting", 2, "Methods recommended. Please select methods to proceed.")

            # Update metadata
            session_obj = self.get_session(db, session_id)
            session_obj.generation_metadata = {
                "recommendation_time_ms": (time.time() - start_time) * 1000,
                "methods_count": len(methods)
            }
            db.add(session_obj)
            db.commit()

        except Exception as e:
            print(f"ERROR in method recommendation pipeline: {str(e)}")
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

    def run_instrument_generation_pipeline(
        self,
        db: Session,
        session_id: int,
        interview_guide_config: Optional[Dict[str, Any]] = None,
        survey_config: Optional[Dict[str, Any]] = None,
        recruiting_config: Optional[Dict[str, Any]] = None
    ):
        """
        Pipeline Step 2: Generate instruments for selected methods.
        Runs in background task.
        """
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            selected_methods = session_obj.selected_methods or []
            step = 3
            instruments_generated = []

            # Generate interview guide if user_interviews selected
            if "user_interviews" in selected_methods and interview_guide_config:
                self._update_progress(db, session_id, "generating_instruments", step, "Generating interview guide...")
                self._generate_interview_guide(db, session_id, interview_guide_config)
                instruments_generated.append("interview_guide")
                step += 1

            # Generate survey if surveys selected
            if "surveys" in selected_methods and survey_config:
                self._update_progress(db, session_id, "generating_instruments", step, "Generating survey...")
                self._generate_survey(db, session_id, survey_config)
                instruments_generated.append("survey")
                step += 1

            # Generate recruiting plan if any method needs participants
            if recruiting_config:
                self._update_progress(db, session_id, "generating_instruments", step, "Generating recruiting plan...")
                self._generate_recruiting_plan(db, session_id, recruiting_config)
                instruments_generated.append("recruiting_plan")
                step += 1

            # Mark completed
            self._update_progress(db, session_id, "completed", step, "Research plan complete!")

            session_obj = self.get_session(db, session_id)
            session_obj.completed_at = datetime.utcnow()
            metadata = session_obj.generation_metadata or {}
            metadata["instrument_generation_time_ms"] = (time.time() - start_time) * 1000
            metadata["instruments_generated"] = instruments_generated
            session_obj.generation_metadata = metadata
            db.add(session_obj)
            db.commit()

        except Exception as e:
            print(f"ERROR in instrument generation pipeline: {str(e)}")
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

    def _recommend_methods(self, db: Session, session_id: int) -> List[RecommendedMethod]:
        """Recommend research methods based on objective and constraints"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        masked_objective = self._mask_pii(session_obj.objective)
        constraints = session_obj.constraints or {}

        prompt = f"""You are an expert UX researcher helping a Product Manager design a customer research study.

User objective: {masked_objective}

Constraints:
- Budget: {constraints.get('budget', 'not specified')}
- Timeline: {constraints.get('timeline', 'not specified')}
- User access: {constraints.get('user_access', 'not specified')}
- Remote only: {constraints.get('remote_only', 'not specified')}

Analyze the objective and recommend 1-4 research methods. For each method:
1. Explain why it fits the objective
2. Estimate effort (low/medium/high), cost, timeline
3. Specify participant requirements
4. Rate confidence in recommendation (0.0-1.0)

Consider these methods:
- user_interviews: In-depth qualitative interviews
- surveys: Quantitative data collection
- usability_testing: Task-based user testing
- session_replay_analysis: Analyzing recorded user sessions
- competitive_analysis: Studying competitor products
- focus_groups: Group discussions
- diary_studies: Longitudinal self-reporting
- analytics_analysis: Data analysis from existing tools

Return EXACTLY this JSON structure:
{{
  "recommended_methods": [
    {{
      "method_name": "user_interviews",
      "method_label": "User Interviews",
      "rationale": "Deep exploration of 'why' behind user behavior...",
      "effort": "medium",
      "cost_estimate": "$1,200-2,000",
      "timeline": "2-3 weeks",
      "participant_count": "8-12 participants",
      "confidence_score": 0.89
    }}
  ],
  "suggested_sequence": ["user_interviews", "surveys"]
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2500,
            context="Method Recommendation"
        )

        # Update session with suggested sequence
        session_obj.suggested_sequence = data.get("suggested_sequence", [])
        db.add(session_obj)

        # Create recommended methods
        methods = []
        for idx, method_data in enumerate(data.get("recommended_methods", [])):
            method = RecommendedMethod(
                session_id=session_id,
                method_name=method_data.get("method_name", f"method_{idx}"),
                method_label=method_data.get("method_label", f"Method {idx + 1}"),
                rationale=method_data.get("rationale", ""),
                effort=method_data.get("effort", "medium"),
                cost_estimate=method_data.get("cost_estimate", "Unknown"),
                timeline=method_data.get("timeline", "Unknown"),
                participant_count=method_data.get("participant_count", "TBD"),
                confidence_score=method_data.get("confidence_score", 0.5),
                display_order=idx
            )
            db.add(method)
            methods.append(method)

        db.commit()
        return methods

    def _generate_interview_guide(self, db: Session, session_id: int, config: Dict[str, Any]) -> InterviewGuide:
        """Generate semi-structured interview guide"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        masked_objective = self._mask_pii(session_obj.objective)
        participant_type = config.get("participant_type", "Target users")
        duration_minutes = config.get("duration_minutes", 45)
        focus_areas = config.get("focus_areas", [])

        prompt = f"""You are an expert UX researcher creating a semi-structured interview guide.

Objective: {masked_objective}
Participant: {participant_type}
Duration: {duration_minutes} minutes
Focus areas: {', '.join(focus_areas) if focus_areas else 'None specified'}

Create a professional interview guide with:
1. Introduction (rapport building, consent, recording permission) - 2-3 minutes
2. Warm-up questions (2-3 easy questions to build comfort) - 3-5 minutes
3. Behavioral exploration (5-8 main questions focusing on specific experiences) - {duration_minutes - 20} minutes
4. Attitudinal questions (3-5 questions about opinions/preferences) - 5-8 minutes
5. Closing (anything else, next steps) - 2-3 minutes

Include probe points for deeper exploration. Add interviewer notes about what to watch for.

Return EXACTLY this JSON structure:
{{
  "sections": {{
    "introduction": "Introduction script text...",
    "warmup": ["Question 1", "Question 2"],
    "behavioral": [
      {{
        "question": "Main question text...",
        "probes": ["Follow-up probe 1", "Follow-up probe 2"]
      }}
    ],
    "attitudinal": ["Opinion question 1", "Opinion question 2"],
    "closing": "Closing script text..."
  }},
  "interviewer_notes": ["Note 1", "Note 2"],
  "timing_guide": {{
    "introduction": 3,
    "warmup": 5,
    "behavioral": {duration_minutes - 20},
    "attitudinal": 7,
    "closing": 3
  }}
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=4000,
            context="Interview Guide Generation"
        )

        # Build markdown content
        sections = data.get("sections", {})
        timing = data.get("timing_guide", {})
        notes = data.get("interviewer_notes", [])

        markdown_content = self._build_interview_guide_markdown(
            session_obj.objective, participant_type, duration_minutes, sections, timing, notes
        )

        guide = InterviewGuide(
            session_id=session_id,
            participant_type=participant_type,
            duration_minutes=duration_minutes,
            focus_areas=focus_areas,
            content_markdown=markdown_content,
            sections=data
        )
        db.add(guide)
        db.commit()
        db.refresh(guide)

        return guide

    def _build_interview_guide_markdown(
        self,
        objective: str,
        participant_type: str,
        duration: int,
        sections: Dict[str, Any],
        timing: Dict[str, int],
        notes: List[str]
    ) -> str:
        """Build markdown content from structured sections"""
        lines = [
            f"# Interview Guide",
            f"",
            f"**Objective:** {objective}",
            f"**Participant Type:** {participant_type}",
            f"**Duration:** {duration} minutes",
            f"",
            f"---",
            f"",
            f"## Introduction ({timing.get('introduction', 3)} min)",
            f"",
            sections.get("introduction", ""),
            f"",
            f"## Warm-up Questions ({timing.get('warmup', 5)} min)",
            f"",
        ]

        for i, q in enumerate(sections.get("warmup", []), 1):
            lines.append(f"{i}. {q}")
        lines.append("")

        lines.extend([
            f"## Behavioral Exploration ({timing.get('behavioral', 25)} min)",
            f"",
        ])

        for i, item in enumerate(sections.get("behavioral", []), 1):
            if isinstance(item, dict):
                lines.append(f"{i}. {item.get('question', '')}")
                for probe in item.get("probes", []):
                    lines.append(f"   - *Probe:* {probe}")
            else:
                lines.append(f"{i}. {item}")
        lines.append("")

        lines.extend([
            f"## Attitudinal Questions ({timing.get('attitudinal', 7)} min)",
            f"",
        ])

        for i, q in enumerate(sections.get("attitudinal", []), 1):
            lines.append(f"{i}. {q}")
        lines.append("")

        lines.extend([
            f"## Closing ({timing.get('closing', 3)} min)",
            f"",
            sections.get("closing", ""),
            f"",
            f"---",
            f"",
            f"## Interviewer Notes",
            f"",
        ])

        for note in notes:
            lines.append(f"- {note}")

        return "\n".join(lines)

    def _generate_survey(self, db: Session, session_id: int, config: Dict[str, Any]) -> Survey:
        """Generate survey with questions"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        masked_objective = self._mask_pii(session_obj.objective)
        target_audience = config.get("target_audience", "Target users")
        survey_length = config.get("survey_length", "medium")
        question_types = config.get("question_types", ["multiple_choice", "rating", "open_ended"])

        length_map = {"short": "5-10", "medium": "10-20", "long": "20-30"}
        question_count = length_map.get(survey_length, "10-20")

        prompt = f"""You are an expert UX researcher creating a survey.

Objective: {masked_objective}
Target audience: {target_audience}
Survey length: {survey_length} ({question_count} questions)
Question types to include: {', '.join(question_types)}

Create a survey with:
- Screening questions (if needed) to qualify respondents
- Mix of question types appropriate for objectives
- Proper scale construction (avoid leading questions, balanced options)
- Conditional logic for branching paths where relevant
- An analysis plan for how to interpret key questions

Return EXACTLY this JSON structure:
{{
  "questions": [
    {{
      "question_id": "q1",
      "text": "Question text...",
      "type": "multiple_choice|rating|open_ended|screening",
      "options": ["Option 1", "Option 2"],
      "required": true,
      "conditional_logic": null,
      "analysis_note": "How to interpret this question"
    }}
  ],
  "analysis_plan": "Overall analysis approach...",
  "estimated_completion_time": "5-7 minutes"
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=4000,
            context="Survey Generation"
        )

        survey = Survey(
            session_id=session_id,
            target_audience=target_audience,
            survey_length=survey_length,
            question_types=question_types,
            questions=data.get("questions", []),
            analysis_plan=data.get("analysis_plan", ""),
            estimated_completion_time=data.get("estimated_completion_time", "Unknown")
        )
        db.add(survey)
        db.commit()
        db.refresh(survey)

        return survey

    def _generate_recruiting_plan(self, db: Session, session_id: int, config: Dict[str, Any]) -> RecruitingPlan:
        """Generate recruiting strategy"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        masked_objective = self._mask_pii(session_obj.objective)
        selected_methods = session_obj.selected_methods or []
        participant_criteria = config.get("participant_criteria", {})
        participant_count = config.get("participant_count", 12)
        segmentation = config.get("segmentation")

        prompt = f"""You are an expert UX researcher creating a recruiting strategy.

Research objective: {masked_objective}
Selected methods: {', '.join(selected_methods)}
Participant criteria: {json.dumps(participant_criteria)}
Participants needed: {participant_count}
Segmentation requirements: {json.dumps(segmentation) if segmentation else 'None'}

Create a comprehensive recruiting plan with:
1. Detailed participant criteria
2. Screener questions (5-8 questions to qualify participants)
3. Recruiting sources (CRM, support tickets, user base, third-party panels)
4. Outreach email templates
5. Incentive recommendations
6. Expected response rates
7. Contact volume needed (accounting for response rate)

Return EXACTLY this JSON structure:
{{
  "detailed_criteria": {{
    "must_have": ["Criteria 1", "Criteria 2"],
    "nice_to_have": ["Criteria 3"],
    "exclusions": ["Exclusion 1"]
  }},
  "screener_questions": [
    {{
      "question": "Question text...",
      "type": "multiple_choice|yes_no|open_ended",
      "options": ["Option 1", "Option 2"],
      "qualifying_answer": "Option that qualifies participant"
    }}
  ],
  "recruiting_sources": ["CRM", "support_tickets", "user_base", "third_party_panel"],
  "email_templates": [
    {{
      "type": "initial_outreach",
      "subject": "Subject line...",
      "body": "Email body with {{{{name}}}} placeholder..."
    }}
  ],
  "incentive_recommendation": "$50-75 gift card for 45-minute interview",
  "expected_response_rate": 0.15,
  "contacts_needed": 80,
  "timeline_estimate": "1-2 weeks for recruiting"
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=4000,
            context="Recruiting Plan Generation"
        )

        plan = RecruitingPlan(
            session_id=session_id,
            participant_criteria=participant_criteria,
            participant_count=participant_count,
            segmentation=segmentation,
            detailed_criteria=data.get("detailed_criteria", {}),
            screener_questions=data.get("screener_questions", []),
            recruiting_sources=data.get("recruiting_sources", []),
            email_templates=data.get("email_templates", []),
            incentive_recommendation=data.get("incentive_recommendation", ""),
            expected_response_rate=data.get("expected_response_rate", 0.15),
            contacts_needed=data.get("contacts_needed", 100),
            timeline_estimate=data.get("timeline_estimate", "")
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        return plan


# Global instance
research_planner_service = ResearchPlannerService()
