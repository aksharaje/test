"""
Research Planner Service

Business logic for AI-powered research planning workflow.
Uses LLM to recommend methods and generate research instruments.
Supports optional context from knowledge bases and other agentic flows.
"""
import json
import re
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from humps import camelize


def _camelize_nested(obj: Any) -> Any:
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {camelize(k): _camelize_nested(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_camelize_nested(item) for item in obj]
    return obj
from app.models.research_planner import (
    ResearchPlanSession,
    RecommendedMethod,
    InterviewGuide,
    Survey,
    RecruitingPlan
)
from app.models.ideation import IdeationSession, GeneratedIdea, IdeaCluster
from app.models.feasibility import FeasibilitySession, TechnicalComponent, RiskAssessment
from app.models.business_case import BusinessCaseSession, CostItem, BenefitItem, Assumption
from app.models.knowledge_base import KnowledgeBase, DocumentChunk
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

    # --- Context Fetching from External Sources ---

    def _fetch_knowledge_base_context(
        self,
        db: Session,
        kb_ids: List[int],
        query: str,
        limit_per_kb: int = 5
    ) -> Dict[str, Any]:
        """
        Fetch relevant context from knowledge bases using semantic search.
        Returns formatted context and metadata for tracking.
        """
        if not kb_ids:
            return {"text": "", "metadata": []}

        context_parts = []
        metadata = []

        for kb_id in kb_ids:
            kb = db.get(KnowledgeBase, kb_id)
            if not kb or kb.status != "ready":
                continue

            # Generate embedding for search query
            try:
                from app.core.config import settings
                from openai import OpenAI as EmbeddingClient
                embed_client = EmbeddingClient(api_key=settings.OPENAI_API_KEY)
                embedding_response = embed_client.embeddings.create(
                    model=kb.settings.get("embeddingModel", "text-embedding-ada-002") if kb.settings else "text-embedding-ada-002",
                    input=query
                )
                query_embedding = embedding_response.data[0].embedding

                # Search chunks using vector similarity
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
                    if row.similarity > 0.5:  # Threshold for relevance
                        context_parts.append(f"[From Knowledge Base: {kb.name}]\n{row.content}")
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

    def _fetch_ideation_context(self, db: Session, session_id: int) -> Dict[str, Any]:
        """
        Fetch context from an ideation session including problem statement and generated ideas.
        """
        session = db.get(IdeationSession, session_id)
        if not session or session.status != "completed":
            return {"text": "", "metadata": None}

        context_parts = []

        # Problem context
        if session.problem_statement:
            context_parts.append(f"**Problem Statement:** {session.problem_statement}")
        if session.constraints:
            context_parts.append(f"**Constraints:** {session.constraints}")
        if session.goals:
            context_parts.append(f"**Goals:** {session.goals}")
        if session.research_insights:
            context_parts.append(f"**Research Insights:** {session.research_insights}")

        # Get generated ideas (top ranked)
        ideas = list(db.exec(
            select(GeneratedIdea)
            .where(GeneratedIdea.session_id == session_id)
            .where(GeneratedIdea.is_final == True)
            .order_by(desc(GeneratedIdea.composite_score))
            .limit(10)
        ).all())

        if ideas:
            ideas_text = "\n".join([
                f"- **{idea.title}** ({idea.category}): {idea.description[:200]}..."
                for idea in ideas
            ])
            context_parts.append(f"**Top Ideas Generated:**\n{ideas_text}")

        # Get clusters
        clusters = list(db.exec(
            select(IdeaCluster).where(IdeaCluster.session_id == session_id)
        ).all())
        if clusters:
            theme_names = [c.theme_name for c in clusters if c.theme_name]
            if theme_names:
                context_parts.append(f"**Idea Themes:** {', '.join(theme_names)}")

        return {
            "text": "\n\n".join(context_parts) if context_parts else "",
            "metadata": {
                "session_id": session_id,
                "problem_statement": session.problem_statement[:200] if session.problem_statement else None,
                "idea_count": len(ideas),
                "cluster_count": len(clusters)
            } if context_parts else None
        }

    def _fetch_feasibility_context(self, db: Session, session_id: int) -> Dict[str, Any]:
        """
        Fetch context from a feasibility session including technical analysis and risks.
        """
        session = db.get(FeasibilitySession, session_id)
        if not session or session.status != "completed":
            return {"text": "", "metadata": None}

        context_parts = []

        # Feature description
        if session.feature_description:
            context_parts.append(f"**Feature Being Analyzed:** {session.feature_description[:500]}")

        # Technical constraints
        if session.technical_constraints:
            context_parts.append(f"**Technical Constraints:** {session.technical_constraints}")

        # Target users
        if session.target_users:
            context_parts.append(f"**Target Users:** {session.target_users}")

        # Executive summary
        if session.executive_summary:
            context_parts.append(f"**Executive Summary:** {session.executive_summary}")

        # Get technical components
        components = list(db.exec(
            select(TechnicalComponent).where(TechnicalComponent.session_id == session_id)
        ).all())
        if components:
            comp_text = "\n".join([
                f"- {c.component_name} ({c.technical_category}): {c.realistic_hours}h estimated"
                for c in components[:5]
            ])
            context_parts.append(f"**Technical Components:**\n{comp_text}")

        # Get risks
        risks = list(db.exec(
            select(RiskAssessment)
            .where(RiskAssessment.session_id == session_id)
            .order_by(desc(RiskAssessment.risk_score))
            .limit(5)
        ).all())
        if risks:
            risks_text = "\n".join([
                f"- {r.risk_category}: {r.risk_description[:100]}... (Score: {r.risk_score:.2f})"
                for r in risks
            ])
            context_parts.append(f"**Key Risks:**\n{risks_text}")

        return {
            "text": "\n\n".join(context_parts) if context_parts else "",
            "metadata": {
                "session_id": session_id,
                "feature_name": session.feature_description[:100] if session.feature_description else None,
                "component_count": len(components),
                "risk_count": len(risks),
                "go_decision": session.go_no_go_recommendation
            } if context_parts else None
        }

    def _fetch_business_case_context(self, db: Session, session_id: int) -> Dict[str, Any]:
        """
        Fetch context from a business case session including market analysis and financials.
        """
        session = db.get(BusinessCaseSession, session_id)
        if not session or session.status != "completed":
            return {"text": "", "metadata": None}

        context_parts = []

        # Feature info
        if session.feature_name:
            context_parts.append(f"**Feature:** {session.feature_name}")
        if session.feature_description:
            context_parts.append(f"**Description:** {session.feature_description[:300]}")

        # Business context
        if session.business_context:
            context_parts.append(f"**Business Context:** {session.business_context}")

        # Target market
        if session.target_market:
            context_parts.append(f"**Target Market:** {session.target_market}")

        # Executive summary
        if session.executive_summary:
            context_parts.append(f"**Executive Summary:** {session.executive_summary}")

        # Key financials
        financials = []
        if session.total_investment:
            financials.append(f"Total Investment: ${session.total_investment:,.0f}")
        if session.net_present_value:
            financials.append(f"NPV: ${session.net_present_value:,.0f}")
        if session.roi_percentage:
            financials.append(f"ROI: {session.roi_percentage:.1f}%")
        if session.payback_months:
            financials.append(f"Payback: {session.payback_months} months")
        if financials:
            context_parts.append(f"**Financial Summary:** {', '.join(financials)}")

        # Get key assumptions
        assumptions = list(db.exec(
            select(Assumption)
            .where(Assumption.session_id == session_id)
            .limit(5)
        ).all())
        if assumptions:
            assumptions_text = "\n".join([
                f"- {a.assumption_category}: {a.assumption_text[:100]}..."
                for a in assumptions
            ])
            context_parts.append(f"**Key Assumptions:**\n{assumptions_text}")

        return {
            "text": "\n\n".join(context_parts) if context_parts else "",
            "metadata": {
                "session_id": session_id,
                "feature_name": session.feature_name,
                "recommendation": session.recommendation,
                "total_investment": session.total_investment,
                "roi_percentage": session.roi_percentage
            } if context_parts else None
        }

    def _build_aggregated_context(
        self,
        db: Session,
        objective: str,
        kb_ids: Optional[List[int]] = None,
        ideation_session_id: Optional[int] = None,
        feasibility_session_id: Optional[int] = None,
        business_case_session_id: Optional[int] = None
    ) -> tuple[str, Dict[str, Any]]:
        """
        Aggregate context from all sources into a formatted string for LLM prompts.
        Returns (context_text, context_summary_metadata).
        """
        context_sections = []
        context_summary = {}

        # Knowledge Base context
        if kb_ids:
            kb_context = self._fetch_knowledge_base_context(db, kb_ids, objective)
            if kb_context["text"]:
                context_sections.append(f"## Knowledge Base Context\n\n{kb_context['text']}")
                context_summary["knowledge_bases"] = kb_context["metadata"]

        # Ideation context
        if ideation_session_id:
            ideation_context = self._fetch_ideation_context(db, ideation_session_id)
            if ideation_context["text"]:
                context_sections.append(f"## Previous Ideation Analysis\n\n{ideation_context['text']}")
                context_summary["ideation"] = ideation_context["metadata"]

        # Feasibility context
        if feasibility_session_id:
            feasibility_context = self._fetch_feasibility_context(db, feasibility_session_id)
            if feasibility_context["text"]:
                context_sections.append(f"## Feasibility Analysis\n\n{feasibility_context['text']}")
                context_summary["feasibility"] = feasibility_context["metadata"]

        # Business case context
        if business_case_session_id:
            business_context = self._fetch_business_case_context(db, business_case_session_id)
            if business_context["text"]:
                context_sections.append(f"## Business Case Analysis\n\n{business_context['text']}")
                context_summary["business_case"] = business_context["metadata"]

        full_context = "\n\n---\n\n".join(context_sections) if context_sections else ""
        return full_context, context_summary

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
        research_context: str = "b2b",
        constraints: Optional[Dict[str, Any]] = None,
        user_id: Optional[int] = None,
        knowledge_base_ids: Optional[List[int]] = None,
        ideation_session_id: Optional[int] = None,
        feasibility_session_id: Optional[int] = None,
        business_case_session_id: Optional[int] = None
    ) -> ResearchPlanSession:
        """Create a new research planning session with optional context sources"""
        if len(objective) < 10:
            raise ValueError("Research objective must be at least 10 characters")

        session_obj = ResearchPlanSession(
            user_id=user_id,
            objective=objective,
            research_context=research_context,
            constraints=constraints,
            knowledge_base_ids=knowledge_base_ids,
            ideation_session_id=ideation_session_id,
            feasibility_session_id=feasibility_session_id,
            business_case_session_id=business_case_session_id,
            status="pending",
            progress_step=0,
            progress_message="Initializing research planner..."
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[ResearchPlanSession]:
        """Get a session by ID"""
        session = db.get(ResearchPlanSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

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

    def get_session_detail(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get complete session detail with all related data"""
        session_obj = self.get_session(db, session_id, user_id=user_id)
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

        # Transform recruiting plans to ensure nested JSON keys are camelCase
        # (SQLModel alias_generator only handles top-level fields)
        transformed_recruiting_plans = []
        for plan in recruiting_plans:
            plan_dict = plan.model_dump(by_alias=True)
            # Camelize nested JSON fields that were stored with snake_case keys
            if plan_dict.get("detailedCriteria"):
                plan_dict["detailedCriteria"] = _camelize_nested(plan_dict["detailedCriteria"])
            if plan_dict.get("screenerQuestions"):
                plan_dict["screenerQuestions"] = _camelize_nested(plan_dict["screenerQuestions"])
            if plan_dict.get("emailTemplates"):
                plan_dict["emailTemplates"] = _camelize_nested(plan_dict["emailTemplates"])
            transformed_recruiting_plans.append(plan_dict)

        return {
            "session": session_obj,
            "recommendedMethods": methods,
            "interviewGuides": interview_guides,
            "surveys": surveys,
            "recruitingPlans": transformed_recruiting_plans
        }

    def select_methods(
        self,
        db: Session,
        session_id: int,
        method_names: List[str],
        user_id: Optional[int] = None
    ) -> ResearchPlanSession:
        """User selects which methods to proceed with"""
        session_obj = self.get_session(db, session_id, user_id=user_id)
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

    def retry_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> ResearchPlanSession:
        """Retry a failed session"""
        session_obj = self.get_session(db, session_id, user_id=user_id)
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

    def delete_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> bool:
        """Delete a session and all related data"""
        session_obj = self.get_session(db, session_id, user_id=user_id)
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
        """Recommend research methods based on objective, constraints, and optional context"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        masked_objective = self._mask_pii(session_obj.objective)
        constraints = session_obj.constraints or {}

        # Fetch and aggregate context from all sources
        aggregated_context, context_summary = self._build_aggregated_context(
            db,
            masked_objective,
            kb_ids=session_obj.knowledge_base_ids,
            ideation_session_id=session_obj.ideation_session_id,
            feasibility_session_id=session_obj.feasibility_session_id,
            business_case_session_id=session_obj.business_case_session_id
        )

        # Store context summary for transparency
        session_obj.context_summary = context_summary if context_summary else None
        db.add(session_obj)
        db.commit()

        # Build context section for prompt
        context_section = ""
        if aggregated_context:
            context_section = f"""
ADDITIONAL CONTEXT FROM PRIOR ANALYSIS:
{aggregated_context}

Use the above context to inform your recommendations. Consider:
- Ideas and problems identified in ideation
- Technical constraints and risks from feasibility analysis
- Market context and business assumptions from business case
- Domain knowledge from knowledge bases
"""

        prompt = f"""You are an expert UX researcher helping a Product Manager design a customer research study.

User objective: {masked_objective}

Constraints:
- Budget: {constraints.get('budget', 'not specified')}
- Timeline: {constraints.get('timeline', 'not specified')}
- User access: {constraints.get('user_access', 'not specified')}
- Remote only: {constraints.get('remote_only', 'not specified')}
{context_section}
Analyze the objective and recommend 1-4 research methods. For each method:
1. Explain why it fits the objective
2. Estimate effort (low/medium/high), cost, timeline
3. Specify participant requirements
4. Rate confidence in recommendation (0.0-1.0)

Also determine if this is B2B (business/enterprise) or B2C (consumer) research, then provide:
- 4-6 participant types who would provide valuable insights
- For B2B: suggest relevant job roles/titles
- For B2C: suggest demographic or behavioral segments (e.g., "Parents with young children", "Budget-conscious shoppers", "Daily active users")
- 5-8 focus topics that should be explored during research
- Appropriate recruiting criteria fields based on context type

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
  "suggested_sequence": ["user_interviews", "surveys"],
  "research_context": "b2b OR b2c",
  "suggested_participants": ["Current enterprise customers", "Recent churned users", "Power users", "New sign-ups in last 30 days"],
  "suggested_segments": ["For B2B: job roles like Product Manager, Engineering Lead. For B2C: segments like Parents 25-40, Budget-conscious millennials, Daily active users"],
  "suggested_topics": ["Onboarding friction points", "Feature discovery", "Pain points in current workflow", "Competitor comparisons", "Willingness to pay"],
  "recruiting_criteria_fields": [
    {{"field": "role", "label": "Job Title or Role", "placeholder": "e.g., Product Manager", "applies_to": "b2b"}},
    {{"field": "company_size", "label": "Company Size", "placeholder": "e.g., 200+ employees", "applies_to": "b2b"}},
    {{"field": "demographic", "label": "Age Range or Life Stage", "placeholder": "e.g., 25-40, Parents", "applies_to": "b2c"}},
    {{"field": "behavior", "label": "Usage or Behavior", "placeholder": "e.g., Daily users, First-time buyers", "applies_to": "b2c"}}
  ]
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

        # Update session with suggested sequence and configuration suggestions
        session_obj.suggested_sequence = data.get("suggested_sequence", [])
        session_obj.generation_metadata = {
            "research_context": data.get("research_context", "b2b"),  # b2b or b2c
            "suggested_participants": data.get("suggested_participants", []),
            "suggested_segments": data.get("suggested_segments", []),
            "suggested_topics": data.get("suggested_topics", []),
            "recruiting_criteria_fields": data.get("recruiting_criteria_fields", []),
        }
        db.add(session_obj)

        # Get recommended methods from LLM response
        recommended_methods_data = data.get("recommended_methods", [])

        # Log what we received for debugging
        print(f"Method Recommendation: LLM returned {len(recommended_methods_data)} methods")
        if not recommended_methods_data:
            print(f"Method Recommendation: Full LLM response keys: {list(data.keys())}")

        # If LLM returned no methods, provide sensible defaults based on objective
        if not recommended_methods_data:
            print("Method Recommendation: No methods returned, using fallback defaults")
            recommended_methods_data = [
                {
                    "method_name": "user_interviews",
                    "method_label": "User Interviews",
                    "rationale": f"In-depth interviews will help understand user needs and pain points related to: {masked_objective[:100]}",
                    "effort": "medium",
                    "cost_estimate": "$1,500-3,000",
                    "timeline": "2-3 weeks",
                    "participant_count": "8-12 participants",
                    "confidence_score": 0.85
                },
                {
                    "method_name": "surveys",
                    "method_label": "Surveys",
                    "rationale": "Quantitative surveys can validate findings from interviews and gather broader feedback.",
                    "effort": "low",
                    "cost_estimate": "$500-1,000",
                    "timeline": "1-2 weeks",
                    "participant_count": "50-100 respondents",
                    "confidence_score": 0.80
                }
            ]

        # Create recommended methods
        methods = []
        for idx, method_data in enumerate(recommended_methods_data):
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
        print(f"Method Recommendation: Saved {len(methods)} methods to database")
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

        # Build context about participant criteria for better prompting
        role_context = participant_criteria.get("role", "target users")
        company_context = participant_criteria.get("companySize", "")

        prompt = f"""You are an expert UX researcher creating a recruiting strategy.

RESEARCH CONTEXT:
- Objective: {masked_objective}
- Methods: {', '.join(selected_methods) if selected_methods else 'user interviews'}
- Target participants: {role_context}{f' at {company_context} companies' if company_context else ''}
- Number needed: {participant_count}

YOUR TASK: Create a comprehensive recruiting plan. You MUST include ALL fields below with real, specific content.

REQUIRED JSON RESPONSE (fill in ALL fields with specific, relevant content):
{{
  "detailed_criteria": {{
    "must_have": ["At least 2-3 specific criteria based on the research objective"],
    "nice_to_have": ["At least 1-2 preferred but not required criteria"],
    "exclusions": ["At least 1 exclusion criteria"]
  }},
  "screener_questions": [
    {{
      "question": "A specific screening question",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C"],
      "qualifying_answer": "The answer that qualifies someone"
    }}
  ],
  "recruiting_sources": ["user_base", "CRM", "support_tickets"],
  "email_templates": [
    {{
      "type": "initial_outreach",
      "subject": "A compelling subject line",
      "body": "Hi {{{{name}}}},\\n\\nEmail body..."
    }}
  ],
  "incentive_recommendation": "Specific incentive like '$50 Amazon gift card' or '$75 for 60-minute session'",
  "expected_response_rate": 0.15,
  "contacts_needed": {int(participant_count / 0.15)},
  "timeline_estimate": "1-2 weeks"
}}

CRITICAL REQUIREMENTS:
1. detailed_criteria.must_have MUST have at least 2 specific criteria
2. detailed_criteria.nice_to_have MUST have at least 1 criterion
3. incentive_recommendation MUST be a specific dollar amount recommendation
4. screener_questions MUST have at least 3 questions

Return ONLY valid JSON. No markdown, no explanations."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API that creates UX research recruiting plans. You MUST return complete JSON with ALL required fields filled in. Never return empty arrays or missing fields."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=4000,
            context="Recruiting Plan Generation"
        )

        # Validate and provide sensible defaults for critical fields
        detailed_criteria = data.get("detailed_criteria", {})
        if not detailed_criteria.get("must_have"):
            detailed_criteria["must_have"] = [
                f"Experience with {masked_objective[:50]}..." if len(masked_objective) > 50 else f"Relevant experience with the research topic",
                f"Matches target profile: {role_context}"
            ]
        if not detailed_criteria.get("nice_to_have"):
            detailed_criteria["nice_to_have"] = ["Previous research participation experience"]
        if not detailed_criteria.get("exclusions"):
            detailed_criteria["exclusions"] = ["Employees of competing companies"]

        incentive = data.get("incentive_recommendation", "")
        if not incentive:
            # Calculate sensible default based on methods
            if "user_interviews" in selected_methods:
                incentive = "$50-75 gift card for 45-60 minute interview"
            elif "surveys" in selected_methods:
                incentive = "$10-25 gift card for survey completion"
            else:
                incentive = "$50 gift card for participation"

        plan = RecruitingPlan(
            session_id=session_id,
            participant_criteria=participant_criteria,
            participant_count=participant_count,
            segmentation=segmentation,
            detailed_criteria=detailed_criteria,
            screener_questions=data.get("screener_questions", []),
            recruiting_sources=data.get("recruiting_sources", ["user_base", "CRM"]),
            email_templates=data.get("email_templates", []),
            incentive_recommendation=incentive,
            expected_response_rate=data.get("expected_response_rate", 0.15),
            contacts_needed=data.get("contacts_needed", max(100, int(participant_count / 0.15))),
            timeline_estimate=data.get("timeline_estimate", "1-2 weeks for recruiting")
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        return plan


# Global instance
research_planner_service = ResearchPlannerService()
