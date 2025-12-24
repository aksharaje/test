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

        # Remove markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(line for line in lines[1:-1] if not line.startswith("```"))

        content = content.strip()

        # Find the first { or [ to locate the start of JSON
        json_start = min(
            (content.find('{') if content.find('{') != -1 else len(content)),
            (content.find('[') if content.find('[') != -1 else len(content))
        )
        if json_start > 0:
            content = content[json_start:]

        # Use JSONDecoder to parse and ignore trailing content
        try:
            from json import JSONDecoder
            decoder = JSONDecoder()
            obj, end_idx = decoder.raw_decode(content)
            return obj
        except json.JSONDecodeError as e:
            print(f"ERROR: {context} - Failed to parse JSON. Content: {content[:500]}")
            raise ValueError(f"{context}: LLM returned invalid JSON - {str(e)}")

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

    def list_sessions(self, db: Session, user_id: Optional[int] = None) -> List[FeasibilitySession]:
        """List all sessions, optionally filtered by user"""
        statement = select(FeasibilitySession)
        if user_id:
            statement = statement.where(FeasibilitySession.user_id == user_id)
        statement = statement.order_by(desc(FeasibilitySession.created_at))
        return list(db.exec(statement).all())

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
- auto_detected_stack: Array of technologies mentioned or implied (e.g., ["React", "Node.js", "PostgreSQL"])

Guidelines:
- Each component should be estimable (not too broad or narrow)
- Consider frontend, backend, data layer, infrastructure, third-party integrations
- Identify clear dependencies (e.g., frontend depends on backend API)
- Be specific about what each component includes

Return EXACTLY this JSON structure:
{{
  "auto_detected_stack": ["technology1", "technology2", ...],
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

Return ONLY valid JSON, no additional text."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=3000,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = self._parse_llm_json(content, "Decomposition Agent")

        # Update session with detected stack
        session_obj.auto_detected_stack = data.get("auto_detected_stack", [])
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

Return ONLY valid JSON, no additional text."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,  # Lower for consistent numerical estimates
                max_tokens=800,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            data = self._parse_llm_json(content, f"Effort Estimation Agent (Component {component.id})")

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

Return ONLY valid JSON, no additional text."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = self._parse_llm_json(content, "Timeline Agent")

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
  "skills_needed": [
    {{
      "skill_name": "React",
      "proficiency_level": "intermediate|advanced|expert",
      "estimated_person_weeks": 2.0,
      "is_gap": false
    }},
    ...
  ]
}}

Return ONLY valid JSON, no additional text."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=2500,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = self._parse_llm_json(content, "Risk Agent")

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

        # Create skill requirements
        for idx, skill_data in enumerate(data.get("skills_needed", [])):
            skill = SkillRequirement(
                session_id=session_id,
                skill_name=skill_data.get("skill_name", f"Skill {idx + 1}"),
                proficiency_level=skill_data.get("proficiency_level", "intermediate"),
                estimated_person_weeks=skill_data.get("estimated_person_weeks", 1.0),
                is_gap=skill_data.get("is_gap", False),
                gap_mitigation=skill_data.get("gap_mitigation"),
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

        # Determine recommendation
        if total_realistic_hours < 320 and len(high_impact_risks) <= 1:
            recommendation = "go"
        elif total_realistic_hours > 800 or len(high_impact_risks) >= 3:
            recommendation = "no_go"
        else:
            recommendation = "conditional"

        # Generate summary using LLM
        prompt = f"""You are a product executive summarizing a feasibility analysis.

Total Realistic Hours: {total_realistic_hours}
Timeline: {realistic_scenario.total_weeks if realistic_scenario else 'unknown'} weeks
High-Impact Risks: {len(high_impact_risks)}
Recommendation: {recommendation}

Generate a concise executive summary (3-4 sentences) that:
1. States the scope (what the feature does)
2. Highlights the effort and timeline
3. Mentions key risks or challenges
4. Concludes with the recommendation

Return EXACTLY this JSON structure:
{{
  "executive_summary": "..."
}}

Return ONLY valid JSON, no additional text."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = self._parse_llm_json(content, "Executive Summary")

        # Update session
        session_obj = self.get_session(db, session_id)
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
