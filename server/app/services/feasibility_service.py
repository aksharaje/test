"""
Feasibility Service

Business logic for AI-powered feasibility analysis workflow.
Uses 4 AI agents to decompose features, estimate effort, project timelines, and assess risks.
"""
import json
import re
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.feasibility import (
    FeasibilitySession,
    TechnicalComponent,
    TimelineScenario,
    RiskAssessment,
    SkillRequirement,
    ActualResult
)
from openai import OpenAI


class FeasibilityService:
    """Service for managing feasibility analysis sessions"""

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

        # Remove markdown code fences if present (handles ```json, ```JSON, ``` etc.)
        if "```" in content:
            # Extract content between code fences
            import re
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                # Just remove all ``` markers
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

        # Handle malformed JSON with extra wrapper braces or characters
        # Common issues: "{\n{...}", "{ {...}", "```json\n{...}\n```"
        if content.startswith('{'):
            # Check if the content after first { starts with another {
            rest = content[1:].lstrip()
            if rest.startswith('{'):
                # Skip the outer wrapper brace
                content = rest
                print(f"DEBUG: Stripped outer brace wrapper, content now starts with: {content[:50]}")
            elif rest.startswith('"') or rest.startswith("'"):
                # Looks like valid JSON starting with a key
                pass
            else:
                # First { might be a wrapper - check if there's valid JSON inside
                inner_brace = rest.find('{')
                if inner_brace != -1 and inner_brace < 20:  # Close enough to be a wrapper issue
                    content = rest[inner_brace:]
                    print(f"DEBUG: Found inner JSON object, content now starts with: {content[:50]}")

        # Find matching closing brace/bracket
        if content.startswith('{'):
            # Find the matching }
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

        # Use JSONDecoder to parse, with retry on common malformed patterns
        from json import JSONDecoder
        decoder = JSONDecoder()

        def try_parse(s: str) -> Dict[str, Any]:
            obj, _ = decoder.raw_decode(s)
            if not isinstance(obj, (dict, list)):
                raise ValueError(f"Parsed content is not a dict or list, got {type(obj)}")
            return obj

        # Try parsing as-is first
        try:
            return try_parse(content)
        except json.JSONDecodeError:
            pass

        # Retry: strip outer wrapper braces (common LLM issue: "{\n{...}\n}")
        if content.startswith('{'):
            inner = content[1:].strip()
            if inner.startswith('{') and inner.endswith('}'):
                # Remove trailing } that matches the outer {
                if inner.count('{') < inner.count('}'):
                    inner = inner[:-1].rstrip()
                try:
                    return try_parse(inner)
                except json.JSONDecodeError:
                    pass
            # Just try without first brace
            try:
                return try_parse(inner)
            except json.JSONDecodeError:
                pass

        # Retry: find first complete JSON object using brace matching
        if '{' in content:
            start = content.find('{')
            depth = 0
            in_str = False
            escape = False
            for i, c in enumerate(content[start:], start):
                if escape:
                    escape = False
                    continue
                if c == '\\':
                    escape = True
                    continue
                if c == '"':
                    in_str = not in_str
                    continue
                if not in_str:
                    if c == '{':
                        depth += 1
                    elif c == '}':
                        depth -= 1
                        if depth == 0:
                            try:
                                return try_parse(content[start:i+1])
                            except json.JSONDecodeError:
                                break

        print(f"ERROR: {context} - Failed to parse JSON. Content: {content[:500]}")
        raise ValueError(f"{context}: LLM returned invalid JSON")

    def _mask_pii(self, text: str) -> str:
        """
        Mask PII before sending to external API.
        Replaces emails, phones, SSN, credit cards with placeholders.
        """
        # Email pattern
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)

        # Phone pattern (various formats)
        text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', text)
        text = re.sub(r'\(\d{3}\)\s*\d{3}[-.]?\d{4}', '[PHONE]', text)

        # SSN pattern
        text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]', text)

        # Credit card pattern (basic, 13-16 digits)
        text = re.sub(r'\b\d{13,16}\b', '[CARD]', text)

        return text

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        feature_description: str,
        technical_constraints: Optional[str] = None,
        target_users: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> FeasibilitySession:
        """Create a new feasibility analysis session"""

        # Validate input length
        if len(feature_description) < 100:
            raise ValueError("Feature description must be at least 100 characters")

        session_obj = FeasibilitySession(
            user_id=user_id,
            feature_description=feature_description,
            technical_constraints=technical_constraints,
            target_users=target_users,
            status="pending",
            progress_step=0,
            progress_message="Initializing feasibility analysis...",
            confidence_level="medium"
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def get_session(self, db: Session, session_id: int) -> Optional[FeasibilitySession]:
        """Get a session by ID"""
        return db.get(FeasibilitySession, session_id)

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[FeasibilitySession]:
        """List all sessions, optionally filtered by user, with pagination"""
        statement = select(FeasibilitySession)
        if user_id:
            statement = statement.where(FeasibilitySession.user_id == user_id)
        statement = statement.order_by(desc(FeasibilitySession.created_at)).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def retry_session(self, db: Session, session_id: int) -> FeasibilitySession:
        """
        Retry a failed session.
        Resets status and triggers background processing.
        """
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")
            
        # Reset session state
        session_obj.status = "pending"
        session_obj.error_message = None
        session_obj.progress_step = 0
        session_obj.progress_message = "Retrying analysis..."
        session_obj.updated_at = datetime.utcnow()
        
        # Clear previous results to avoid duplicates
        # (This mimics delete_session logic but keeps the session itself)
        db.exec(select(TechnicalComponent).where(TechnicalComponent.session_id == session_id)).all() # execute properly
        for obj in db.exec(select(TechnicalComponent).where(TechnicalComponent.session_id == session_id)): db.delete(obj)
        for obj in db.exec(select(TimelineScenario).where(TimelineScenario.session_id == session_id)): db.delete(obj)
        for obj in db.exec(select(RiskAssessment).where(RiskAssessment.session_id == session_id)): db.delete(obj)
        for obj in db.exec(select(SkillRequirement).where(SkillRequirement.session_id == session_id)): db.delete(obj)
        for obj in db.exec(select(ActualResult).where(ActualResult.session_id == session_id)): db.delete(obj)
        
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)
        
        return session_obj

    def get_session_detail(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """
        Get complete session detail with all related data.
        Returns: Dict with session, components, scenarios, risks, skills
        """
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return None

        # Fetch related data
        components = list(db.exec(
            select(TechnicalComponent)
            .where(TechnicalComponent.session_id == session_id)
            .order_by(TechnicalComponent.display_order)
        ).all())

        scenarios = list(db.exec(
            select(TimelineScenario)
            .where(TimelineScenario.session_id == session_id)
        ).all())

        risks = list(db.exec(
            select(RiskAssessment)
            .where(RiskAssessment.session_id == session_id)
            .order_by(desc(RiskAssessment.risk_score))
        ).all())

        skills = list(db.exec(
            select(SkillRequirement)
            .where(SkillRequirement.session_id == session_id)
            .order_by(SkillRequirement.display_order)
        ).all())

        return {
            "session": session_obj,
            "components": components,
            "scenarios": scenarios,
            "risks": risks,
            "skills": skills
        }

    def update_component(
        self,
        db: Session,
        component_id: int,
        optimistic_hours: Optional[float] = None,
        realistic_hours: Optional[float] = None,
        pessimistic_hours: Optional[float] = None
    ) -> Optional[TechnicalComponent]:
        """Update component estimates (if editable)"""
        component = db.get(TechnicalComponent, component_id)
        if not component:
            return None

        if not component.is_editable:
            raise ValueError("Component is locked and cannot be edited")

        if optimistic_hours is not None:
            component.optimistic_hours = optimistic_hours
        if realistic_hours is not None:
            component.realistic_hours = realistic_hours
        if pessimistic_hours is not None:
            component.pessimistic_hours = pessimistic_hours

        component.estimated_by_agent = False  # Mark as manually edited
        component.updated_at = datetime.utcnow()

        db.add(component)
        db.commit()
        db.refresh(component)

        return component

    def capture_actuals(
        self,
        db: Session,
        session_id: int,
        actuals_data: List[Dict[str, Any]],
        recorded_by_user_id: Optional[int] = None
    ) -> List[ActualResult]:
        """
        Capture actual results for learning.
        actuals_data: List of dicts with component_id, actual_hours_spent, lessons_learned
        """
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        results = []
        for data in actuals_data:
            component_id = data.get("component_id")
            actual_hours = data.get("actual_hours_spent")
            lessons = data.get("lessons_learned")

            if not component_id or actual_hours is None:
                continue

            # Get component to calculate variance
            component = db.get(TechnicalComponent, component_id)
            if component:
                estimated_hours = component.realistic_hours
                variance = ((actual_hours - estimated_hours) / estimated_hours) * 100 if estimated_hours > 0 else 0
            else:
                variance = 0

            actual = ActualResult(
                session_id=session_id,
                component_id=component_id,
                actual_hours_spent=actual_hours,
                variance_percentage=variance,
                lessons_learned=lessons,
                recorded_by_user_id=recorded_by_user_id
            )
            db.add(actual)
            results.append(actual)

        db.commit()
        return results

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data (cascade)"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return False

        # Delete related data (manual cascade since SQLModel doesn't auto-cascade)
        db.exec(select(TechnicalComponent).where(TechnicalComponent.session_id == session_id)).all()
        for obj in db.exec(select(TechnicalComponent).where(TechnicalComponent.session_id == session_id)):
            db.delete(obj)

        for obj in db.exec(select(TimelineScenario).where(TimelineScenario.session_id == session_id)):
            db.delete(obj)

        for obj in db.exec(select(RiskAssessment).where(RiskAssessment.session_id == session_id)):
            db.delete(obj)

        for obj in db.exec(select(SkillRequirement).where(SkillRequirement.session_id == session_id)):
            db.delete(obj)

        for obj in db.exec(select(ActualResult).where(ActualResult.session_id == session_id)):
            db.delete(obj)

        db.delete(session_obj)
        db.commit()
        return True

    # --- AI Pipeline ---

    def run_feasibility_pipeline(self, db: Session, session_id: int):
        """
        Main pipeline: orchestrates 4 AI agents sequentially.
        Runs in background task.
        """
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            # Step 1: Decomposition Agent
            self._update_progress(db, session_id, "decomposing", 1, "Breaking down into technical components...")
            components = self._decompose_feature(db, session_id)

            # Step 2: Effort Estimation Agent
            self._update_progress(db, session_id, "estimating", 2, "Estimating effort for each component...")
            self._estimate_effort(db, session_id, components)

            # Step 3: Timeline & Resource Agent
            self._update_progress(db, session_id, "scheduling", 3, "Projecting timelines and resource needs...")
            scenarios = self._project_timelines(db, session_id, components)

            # Step 4: Risk Agent
            self._update_progress(db, session_id, "risk_analyzing", 4, "Identifying risks and mitigation strategies...")
            risks = self._assess_risks(db, session_id, components, scenarios)

            # Step 5: Finalize
            self._update_progress(db, session_id, "completed", 5, "Analysis complete!")
            self._generate_executive_summary(db, session_id, components, scenarios, risks)

            # Update metadata
            session_obj = self.get_session(db, session_id)
            session_obj.completed_at = datetime.utcnow()
            session_obj.generation_metadata = {
                "processing_time_ms": (time.time() - start_time) * 1000,
                "components_count": len(components),
                "scenarios_count": len(scenarios),
                "risks_count": len(risks)
            }
            db.add(session_obj)
            db.commit()

        except Exception as e:
            print(f"ERROR in feasibility pipeline: {str(e)}")
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

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

    # --- Agent 1: Decomposition ---

    def _call_llm(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 3000, context: str = "LLM") -> Dict[str, Any]:
        """
        Call LLM with retry logic for empty responses or API errors.
        """
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # On last attempt, try without response_format in case model doesn't support it well
                # Update: Only use JSON mode on first attempt. If it fails (e.g. empty string), try without it.
                use_json_mode = attempt == 0
                
                kwargs = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if use_json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                response = self.client.chat.completions.create(**kwargs)
                choice = response.choices[0]
                content = choice.message.content
                finish_reason = choice.finish_reason
                
                if not content or not content.strip():
                    raise ValueError(f"Received empty string content from LLM API. Finish reason: {finish_reason}")
                
                return self._parse_llm_json(content, context)
                
            except Exception as e:
                print(f"Error calling LLM for {context} (Attempt {attempt + 1}/{max_retries}): {e}")
                last_error = e
                
            time.sleep(2 * (attempt + 1)) # Increased backoff (2s, 4s, 6s)
            
        raise ValueError(f"{context}: Failed to get valid response from LLM after {max_retries} attempts. Last error: {last_error}")

    def _decompose_feature(self, db: Session, session_id: int) -> List[TechnicalComponent]:
        """
        Agent 1: Decompose feature into 4-8 technical components.
        Auto-detects technology stack and architecture patterns.
        """
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        # Mask PII before sending to API
        masked_description = self._mask_pii(session_obj.feature_description)
        masked_constraints = self._mask_pii(session_obj.technical_constraints or "")
        masked_users = self._mask_pii(session_obj.target_users or "")

        prompt = f"""You are a technical architect analyzing a feature request.

Feature Description:
{masked_description}

Technical Constraints:
{masked_constraints if masked_constraints else "None specified"}

Target Users:
{masked_users if masked_users else "None specified"}

Your task: Break this feature into 4-8 technical components that can be estimated independently.

For each component, provide:
1. component_name: Short, descriptive name (e.g., "User Authentication API")
2. component_description: What this component does (2-3 sentences)
3. technical_category: One of: backend, frontend, infrastructure, data, integration
4. dependencies: Array of indices of other components this depends on (0-indexed, empty array if none)

Also identify:
- mentioned_technologies: Array of technologies explicitly mentioned OR reasonably implied by the feature description (e.g., if it mentions "mobile app" you might infer iOS/Android)

Guidelines:
- Each component should be estimable (not too broad or narrow)
- Consider frontend, backend, data layer, infrastructure, third-party integrations
- Identify clear dependencies (e.g., frontend depends on backend API)
- Be specific about what each component includes

Return EXACTLY this JSON structure:
{{
  "mentioned_technologies": ["technology1", "technology2", ...],
  "components": [
    {{
      "component_name": "...",
      "component_description": "...",
      "technical_category": "backend|frontend|infrastructure|data|integration",
      "dependencies": [0, 1]  // indices of components this depends on, or empty array
    }},
    ...
  ]
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences. Start your response with {{ and end with }}."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=10000,
            context="Decomposition Agent"
        )

        # Update session with detected stack
        # Store mentioned technologies (field still called auto_detected_stack in DB for compatibility)
        session_obj.auto_detected_stack = data.get("mentioned_technologies", data.get("auto_detected_stack", []))
        db.add(session_obj)
        db.commit()

        # Create components
        components = []
        for idx, comp_data in enumerate(data.get("components", [])):
            component = TechnicalComponent(
                session_id=session_id,
                component_name=comp_data.get("component_name", f"Component {idx + 1}"),
                component_description=comp_data.get("component_description", "No description provided"),
                technical_category=comp_data.get("technical_category", "backend"),
                dependencies=comp_data.get("dependencies", []),
                optimistic_hours=0,  # Will be filled by Agent 2
                realistic_hours=0,
                pessimistic_hours=0,
                confidence_level="medium",
                display_order=idx
            )
            db.add(component)
            components.append(component)

        db.commit()
        return components

    # --- Agent 2: Effort Estimation ---

    def _estimate_effort(self, db: Session, session_id: int, components: List[TechnicalComponent]):
        """
        Agent 2: Estimate hours for each component (optimistic, realistic, pessimistic).
        Uses historical data if available, otherwise industry benchmarks.
        """
        for component in components:
            prompt = f"""You are a technical lead estimating effort for a component.

Component: {component.component_name}
Description: {component.component_description}
Category: {component.technical_category}

Your task: Provide three effort estimates in hours:

1. Optimistic: Best-case scenario (everything goes smoothly, no unknowns)
2. Realistic: Most likely scenario (normal development pace, some minor issues)
3. Pessimistic: Worst-case scenario (complications, unknowns, rework) - typically 2-3x optimistic

Also provide:
- confidence_level: "low" (many unknowns), "medium" (some unknowns), "high" (well-defined)
- rationale: Brief explanation of your estimates (1-2 sentences)

Guidelines for estimates:
- Consider complexity, unknowns, dependencies, testing time
- Optimistic should be achievable by an experienced developer
- Realistic should account for code review, testing, minor debugging
- Pessimistic should account for learning curve, integration issues, rework

Return EXACTLY this JSON structure:
{{
  "optimistic_hours": 8.0,
  "realistic_hours": 16.0,
  "pessimistic_hours": 32.0,
  "confidence_level": "low|medium|high",
  "rationale": "..."
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences. Start your response with {{ and end with }}."""

            data = self._call_llm(
                messages=[
                    {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=800,
                context=f"Effort Estimation Agent (Component {component.id})"
            )

            # Update component with estimates (with safe defaults)
            component.optimistic_hours = data.get("optimistic_hours", 8.0)
            component.realistic_hours = data.get("realistic_hours", 16.0)
            component.pessimistic_hours = data.get("pessimistic_hours", 32.0)
            component.confidence_level = data.get("confidence_level", "medium")
            db.add(component)

        db.commit()

    # --- Agent 3: Timeline & Resource ---

    def _project_timelines(self, db: Session, session_id: int, components: List[TechnicalComponent]) -> List[TimelineScenario]:
        """
        Agent 3: Convert effort estimates to timeline scenarios.
        Considers parallelization, team size, overhead.
        """
        # Prepare component summary for LLM
        components_summary = []
        for comp in components:
            components_summary.append({
                "name": comp.component_name,
                "category": comp.technical_category,
                "optimistic_hours": comp.optimistic_hours,
                "realistic_hours": comp.realistic_hours,
                "pessimistic_hours": comp.pessimistic_hours,
                "dependencies": comp.dependencies or [],
                "can_parallelize": len(comp.dependencies or []) == 0  # Simplified: no deps = can parallelize
            })

        prompt = f"""You are a project manager creating timeline projections.

Components:
{json.dumps(components_summary, indent=2)}

Your task: Create 3 timeline scenarios (optimistic, realistic, pessimistic) considering:
1. Team size (assume 2 developers for realistic, scale for others)
2. Parallelization (which components can be built concurrently)
3. Overhead (meetings 10%, code reviews 5%, rework 15-30%)
4. Dependencies (critical path analysis)

For each scenario, calculate:
- total_weeks: Calendar weeks needed
- sprint_count: Number of 2-week sprints
- parallelization_factor: How much work can be done in parallel (1.0 = sequential, 0.5 = 50% parallel)
- overhead_percentage: Meeting/review/rework overhead
- team_size_assumed: Number of developers
- confidence_level: Your confidence in this projection
- rationale: Brief explanation of timeline calculation

Convert hours to weeks using: weeks = (total_hours / team_size / 40) * (1 + overhead)

Return EXACTLY this JSON structure:
{{
  "scenarios": [
    {{
      "scenario_type": "optimistic",
      "total_weeks": 2.5,
      "sprint_count": 2,
      "parallelization_factor": 0.6,
      "overhead_percentage": 20.0,
      "team_size_assumed": 3,
      "confidence_level": "low|medium|high",
      "rationale": "..."
    }},
    {{
      "scenario_type": "realistic",
      ...
    }},
    {{
      "scenario_type": "pessimistic",
      ...
    }}
  ]
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences. Start your response with {{ and end with }}."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=10000,
            context="Timeline Agent"
        )

        # Create timeline scenarios
        scenarios = []
        for scenario_data in data.get("scenarios", []):
            scenario = TimelineScenario(
                session_id=session_id,
                scenario_type=scenario_data.get("scenario_type", "realistic"),
                total_weeks=scenario_data.get("total_weeks", 4.0),
                sprint_count=scenario_data.get("sprint_count", 2),
                parallelization_factor=scenario_data.get("parallelization_factor", 0.7),
                overhead_percentage=scenario_data.get("overhead_percentage", 20.0),
                team_size_assumed=scenario_data.get("team_size_assumed", 2),
                confidence_level=scenario_data.get("confidence_level", "medium"),
                rationale=scenario_data.get("rationale", "Based on component estimates")
            )
            db.add(scenario)
            scenarios.append(scenario)

        db.commit()
        return scenarios

    # --- Agent 4: Risk Assessment ---

    def _assess_risks(
        self,
        db: Session,
        session_id: int,
        components: List[TechnicalComponent],
        scenarios: List[TimelineScenario]
    ) -> List[RiskAssessment]:
        """
        Agent 4: Identify and score risks.
        Categories: technical, resource, schedule, dependency, integration
        """
        session_obj = self.get_session(db, session_id)

        # Prepare context for LLM
        components_summary = [{"name": c.component_name, "category": c.technical_category} for c in components]
        realistic_scenario = next((s for s in scenarios if s.scenario_type == "realistic"), None)

        prompt = f"""You are a risk analyst identifying project risks.

Feature: {session_obj.feature_description}
Components: {json.dumps(components_summary)}
Realistic Timeline: {realistic_scenario.total_weeks if realistic_scenario else 'unknown'} weeks

Your task: Identify 5-10 risks across these categories:
- technical: Technology complexity, unknowns, integration challenges
- resource: Skill gaps, team availability, hiring needs
- schedule: Optimistic estimates, dependencies, scope creep
- dependency: External APIs, third-party services, team dependencies
- integration: System integration, data migration, compatibility

For each risk, provide:
- risk_category: One of the categories above
- risk_description: Clear description of the risk (1-2 sentences)
- probability: Likelihood this risk occurs (0.0-1.0, where 1.0 = certain)
- impact: Severity if it occurs (0.0-1.0, where 1.0 = project failure)
- risk_score: probability * impact (calculated automatically)
- mitigation_strategy: How to reduce or handle this risk (1-2 sentences)

Sort risks by risk_score descending (highest first).

Return EXACTLY this JSON structure:
{{
  "risks": [
    {{
      "risk_category": "technical|resource|schedule|dependency|integration",
      "risk_description": "...",
      "probability": 0.7,
      "impact": 0.8,
      "mitigation_strategy": "..."
    }},
    ...
  ],
  "skills_required": [
    {{
      "skill_name": "React",
      "proficiency_level": "beginner|intermediate|advanced|expert",
      "estimated_person_weeks": 2.0
    }},
    ...
  ]
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences. Start your response with {{ and end with }}."""

        data = self._call_llm(
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=2500,
            context="Risk Agent"
        )

        # Create risk assessments
        risks = []
        for idx, risk_data in enumerate(data.get("risks", [])):
            probability = risk_data.get("probability", 0.5)
            impact = risk_data.get("impact", 0.5)
            risk_score = probability * impact
            risk = RiskAssessment(
                session_id=session_id,
                risk_category=risk_data.get("risk_category", "technical"),
                risk_description=risk_data.get("risk_description", "Risk identified"),
                probability=probability,
                impact=impact,
                risk_score=risk_score,
                mitigation_strategy=risk_data.get("mitigation_strategy", "Monitor and address as needed"),
                display_order=idx
            )
            db.add(risk)
            risks.append(risk)

        # Create skill requirements (we don't assess gaps - that requires knowing the team's actual skills)
        for idx, skill_data in enumerate(data.get("skills_required", data.get("skills_needed", []))):
            skill = SkillRequirement(
                session_id=session_id,
                skill_name=skill_data.get("skill_name", f"Skill {idx + 1}"),
                proficiency_level=skill_data.get("proficiency_level", "intermediate"),
                estimated_person_weeks=skill_data.get("estimated_person_weeks", 1.0),
                is_gap=False,  # We can't know gaps without team skill data
                gap_mitigation=None,
                display_order=idx
            )
            db.add(skill)

        db.commit()
        return risks

    # --- Executive Summary & Recommendation ---

    def _generate_executive_summary(
        self,
        db: Session,
        session_id: int,
        components: List[TechnicalComponent],
        scenarios: List[TimelineScenario],
        risks: List[RiskAssessment]
    ):
        """
        Generate executive summary and go/no-go recommendation.
        Logic:
        - Go: realistic_hours < 320 (2 devs, 4 weeks), low high-impact risks
        - No-Go: realistic_hours > 800 (2 devs, 10 weeks), multiple high-impact risks
        - Conditional: In between, or skill gaps, or high dependencies
        """
        total_realistic_hours = sum(c.realistic_hours for c in components)
        realistic_scenario = next((s for s in scenarios if s.scenario_type == "realistic"), None)
        high_impact_risks = [r for r in risks if r.impact >= 0.7]

        # Calculate feasibility factors based on OBJECTIVE data we have

        # 1. Estimate confidence (variance between optimistic and pessimistic)
        # High variance = high uncertainty = risk
        variances = []
        for c in components:
            if c.realistic_hours > 0:
                variance = (c.pessimistic_hours - c.optimistic_hours) / c.realistic_hours
                variances.append(variance)
        avg_variance = sum(variances) / len(variances) if variances else 0
        high_uncertainty = avg_variance > 2.0  # Pessimistic is 3x+ optimistic
        moderate_uncertainty = avg_variance > 1.5

        # 2. Risk analysis - focus on high-impact + high-probability risks
        high_impact_high_prob = [r for r in high_impact_risks if r.probability >= 0.5]
        moderate_risks = [r for r in risks if r.impact >= 0.5 and r.probability >= 0.4]
        severe_risk_profile = len(high_impact_high_prob) >= 2
        elevated_risk = len(high_impact_risks) >= 3 or len(high_impact_high_prob) >= 1

        # 3. Technical complexity (component interdependencies)
        components_with_deps = [c for c in components if c.dependencies and len(c.dependencies) > 0]
        dependency_ratio = len(components_with_deps) / len(components) if components else 0
        high_complexity = dependency_ratio >= 0.6  # 60%+ have dependencies

        # 4. Scope size (as a secondary factor, not primary)
        large_scope = total_realistic_hours > 500  # Significant effort
        very_large_scope = total_realistic_hours > 1000

        # Build rationale based on what we actually know
        factors_positive = []
        factors_negative = []
        factors_caution = []

        # Estimate confidence assessment
        if avg_variance <= 1.2:
            factors_positive.append("high estimate confidence (low variance)")
        elif high_uncertainty:
            factors_negative.append(f"significant estimate uncertainty - pessimistic estimates are {avg_variance:.1f}x the optimistic")
        elif moderate_uncertainty:
            factors_caution.append("moderate estimate uncertainty suggests some unknowns")

        # Risk assessment
        if len(high_impact_risks) == 0:
            factors_positive.append("no high-impact risks identified")
        elif severe_risk_profile:
            factors_negative.append(f"{len(high_impact_high_prob)} high-impact risks with >50% probability")
        elif elevated_risk:
            factors_caution.append(f"{len(high_impact_risks)} high-impact risk(s) identified - review mitigation strategies")

        # Complexity assessment
        if dependency_ratio <= 0.3:
            factors_positive.append("low component interdependency allows parallel development")
        elif high_complexity:
            factors_caution.append(f"high component interdependency ({dependency_ratio:.0%}) may constrain parallelization")

        # Scope assessment (informational, not blocking)
        if very_large_scope:
            factors_caution.append(f"significant scope ({total_realistic_hours:.0f} hours) - consider phased delivery")
        elif large_scope:
            factors_caution.append(f"substantial scope ({total_realistic_hours:.0f} hours) warrants careful planning")

        # Determine recommendation
        # NO-GO: Multiple severe issues that compound risk
        # CONDITIONAL: Issues exist but are manageable with mitigation
        # GO: Favorable profile across factors

        severe_issues = sum([severe_risk_profile, high_uncertainty and elevated_risk])
        caution_issues = sum([elevated_risk, moderate_uncertainty, high_complexity, very_large_scope])

        if severe_issues >= 2 or (severe_risk_profile and high_uncertainty):
            recommendation = "no_go"
            rationale = f"Not recommended due to compounding risk factors: {'; '.join(factors_negative)}. Consider descoping or addressing critical risks before proceeding."
        elif severe_issues >= 1 or caution_issues >= 3:
            recommendation = "conditional"
            all_concerns = factors_negative + factors_caution
            rationale = f"Conditional approval. Key considerations: {'; '.join(all_concerns[:3])}. Recommend risk mitigation planning and/or phased delivery approach."
        else:
            recommendation = "go"
            if factors_positive:
                rationale = f"Recommended to proceed. Favorable factors: {'; '.join(factors_positive)}."
            else:
                rationale = "Recommended to proceed. Analysis indicates acceptable risk profile and manageable complexity."

        # Get session for feature description
        session_obj = self.get_session(db, session_id)
        feature_desc = session_obj.feature_description[:500] if session_obj else "Feature"

        # Build component summary
        component_names = [c.component_name for c in components[:5]]
        risk_descriptions = [r.risk_description for r in high_impact_risks[:3]]

        # Generate summary using LLM
        prompt = f"""You are a product executive summarizing a feasibility analysis.

Feature Description:
{feature_desc}

Key Components: {', '.join(component_names)}

Analysis Results:
- Total Realistic Hours: {total_realistic_hours}
- Timeline: {realistic_scenario.total_weeks if realistic_scenario else 'unknown'} weeks
- Number of Components: {len(components)}
- High-Impact Risks: {len(high_impact_risks)}
- Key Risks: {'; '.join(risk_descriptions) if risk_descriptions else 'None critical'}
- Recommendation: {recommendation.upper().replace('_', '-')}
- Recommendation Rationale: {rationale}

Generate a concise executive summary (4-5 sentences) that:
1. States what the feature delivers (based on the description above)
2. Highlights the estimated effort ({total_realistic_hours} hours) and timeline ({realistic_scenario.total_weeks if realistic_scenario else 'unknown'} weeks)
3. Mentions key risks or challenges if any
4. States the {recommendation.upper().replace('_', '-')} recommendation AND explains WHY (use the rationale provided above)

Return EXACTLY this JSON structure:
{{
  "executive_summary": "Your 4-5 sentence summary here..."
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences. Start your response with {{ and end with }}."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a JSON-only API. You must respond with valid JSON only. No markdown, no explanations, no code fences. Start with { and end with }."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = self._parse_llm_json(content, "Executive Summary")

        # Update session (session_obj already fetched above for prompt context)
        session_obj.executive_summary = data.get("executive_summary", "Analysis complete. Review the detailed findings above.")
        session_obj.go_no_go_recommendation = recommendation

        # Set confidence based on estimate variance
        hour_estimates = [(c.optimistic_hours, c.realistic_hours, c.pessimistic_hours) for c in components]
        avg_variance = sum([(p - o) / r for o, r, p in hour_estimates if r > 0]) / len(hour_estimates) if hour_estimates else 0

        if avg_variance < 1.5:
            session_obj.confidence_level = "high"
        elif avg_variance < 2.5:
            session_obj.confidence_level = "medium"
        else:
            session_obj.confidence_level = "low"

        db.add(session_obj)
        db.commit()


# Global instance
feasibility_service = FeasibilityService()
