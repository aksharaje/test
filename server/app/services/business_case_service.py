"""
Business Case Builder Service

Orchestrates 5 AI agents for comprehensive business case analysis:
1. Context Agent - Gathers business context, market data, competitive landscape
2. Effort Agent - Imports/estimates development and operational costs
3. Cost Agent - Infrastructure, licensing, maintenance projections
4. Benefit Agent - Revenue, savings, strategic value estimation
5. Financial Agent - NPV, IRR, Payback, sensitivity analysis

Uses Tiered Data Strategy:
1. User Learning - Previous corrections and overrides
2. Web Research - Real-time market data (when available)
3. Static Benchmarks - Industry standard ranges
4. Feasibility Import - Leverage existing feasibility analysis
"""
import json
import re
import time
import math
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.business_case import (
    BusinessCaseSession,
    CostItem,
    BenefitItem,
    FinancialScenario,
    Assumption,
    SensitivityAnalysis,
    RateAssumption,
    UserLearning
)
from app.models.feasibility import (
    FeasibilitySession,
    TechnicalComponent,
    TimelineScenario
)
from openai import OpenAI


class BusinessCaseService:
    """Service for managing business case analysis sessions"""

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
        """Robust JSON parsing for LLM responses with multiple fallback strategies."""
        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        original_content = content
        content = content.strip()

        # Remove markdown code fences
        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        # Remove common prefixes that LLMs sometimes add
        prefixes_to_remove = [
            "Here is the JSON:",
            "Here's the JSON:",
            "JSON:",
            "Result:",
            "Output:",
        ]
        for prefix in prefixes_to_remove:
            if content.lower().startswith(prefix.lower()):
                content = content[len(prefix):].strip()

        # Find JSON start
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

        # Handle double brace wrapper
        if content.startswith('{'):
            rest = content[1:].lstrip()
            if rest.startswith('{'):
                content = rest

        # Find matching closing brace
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

        from json import JSONDecoder
        decoder = JSONDecoder()

        def try_parse(s: str) -> Dict[str, Any]:
            obj, _ = decoder.raw_decode(s)
            return obj

        # Strategy 1: Direct parse
        try:
            return try_parse(content)
        except json.JSONDecodeError:
            pass

        # Strategy 2: Fix common JSON issues
        fixed_content = content
        # Fix trailing commas before closing braces/brackets
        fixed_content = re.sub(r',(\s*[}\]])', r'\1', fixed_content)
        # Fix unquoted keys (simple cases)
        fixed_content = re.sub(r'(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1 "\2":', fixed_content)
        # Fix single quotes to double quotes (outside of values)
        try:
            return try_parse(fixed_content)
        except json.JSONDecodeError:
            pass

        # Strategy 3: Try extracting just the object
        if content.startswith('{'):
            inner = content[1:].strip()
            if inner.startswith('{') and inner.endswith('}'):
                if inner.count('{') < inner.count('}'):
                    inner = inner[:-1].rstrip()
                try:
                    return try_parse(inner)
                except json.JSONDecodeError:
                    pass

        # Strategy 4: Use Python's ast.literal_eval as fallback for simple dicts
        try:
            import ast
            # Convert to Python dict syntax
            python_dict = content.replace('true', 'True').replace('false', 'False').replace('null', 'None')
            result = ast.literal_eval(python_dict)
            if isinstance(result, dict):
                return result
        except (ValueError, SyntaxError):
            pass

        print(f"ERROR: {context} - Failed to parse JSON after all strategies. Content: {content[:500]}")
        raise ValueError(f"{context}: LLM returned invalid JSON")

    def _call_llm_with_retry(
        self,
        prompt: str,
        context: str,
        model: str,
        max_retries: int = 2
    ) -> Dict[str, Any]:
        """Call LLM with retry logic for JSON parsing failures."""
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                # Add stricter instruction on retries
                system_msg = "You are a JSON-only API. Respond with valid JSON only. No explanations, no markdown."
                if attempt > 0:
                    system_msg = (
                        "CRITICAL: You MUST respond with ONLY a valid JSON object. "
                        "Do NOT include any text before or after the JSON. "
                        "Do NOT use markdown code fences. Start directly with { and end with }."
                    )

                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2 if attempt > 0 else 0.3,  # Lower temperature on retry
                    max_tokens=2000,
                    response_format={"type": "json_object"}
                )

                content = response.choices[0].message.content
                return self._parse_llm_json(content, context)

            except ValueError as e:
                last_error = e
                if attempt < max_retries:
                    print(f"WARNING: {context} - Retry {attempt + 1}/{max_retries} after JSON parse failure")
                    time.sleep(0.5)  # Brief delay before retry
                continue

        raise last_error or ValueError(f"{context}: Failed after {max_retries + 1} attempts")

    def _mask_pii(self, text: str) -> str:
        """Mask PII before sending to external API."""
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
        text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', text)
        text = re.sub(r'\(\d{3}\)\s*\d{3}[-.]?\d{4}', '[PHONE]', text)
        text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]', text)
        text = re.sub(r'\b\d{13,16}\b', '[CARD]', text)
        return text

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        feature_name: Optional[str] = None,
        feature_description: Optional[str] = None,
        business_context: Optional[str] = None,
        target_market: Optional[str] = None,
        feasibility_session_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> BusinessCaseSession:
        """
        Create a new business case session.

        If feasibility_session_id is provided, feature_name and feature_description
        are derived from the feasibility session if not provided.
        """
        feasibility: Optional[FeasibilitySession] = None

        # If feasibility session provided, load and use its data
        if feasibility_session_id:
            feasibility = db.get(FeasibilitySession, feasibility_session_id)
            if not feasibility:
                raise ValueError("Feasibility session not found")
            if feasibility.status != "completed":
                raise ValueError("Feasibility analysis must be completed first")

            # Use feasibility data if not provided
            if not feature_description:
                feature_description = feasibility.feature_description

            if not feature_name:
                # Generate a short name from the description
                feature_name = self._generate_feature_name(feature_description)

        # Validate required fields
        if not feature_name or len(feature_name) < 3:
            raise ValueError("Feature name must be at least 3 characters")
        if not feature_description or len(feature_description) < 50:
            raise ValueError("Feature description must be at least 50 characters")

        # Truncate feature name if too long
        if len(feature_name) > 200:
            feature_name = feature_name[:197] + "..."

        session_obj = BusinessCaseSession(
            user_id=user_id,
            feasibility_session_id=feasibility_session_id,
            feature_name=feature_name,
            feature_description=feature_description,
            business_context=business_context,
            target_market=target_market,
            status="pending",
            progress_step=0,
            progress_message="Initializing business case analysis...",
            confidence_level="medium"
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def _generate_feature_name(self, description: str) -> str:
        """Generate a short feature name from a description."""
        # Take first line or first 100 chars
        first_line = description.split('\n')[0].strip()
        if len(first_line) <= 100:
            return first_line

        # Truncate at word boundary
        truncated = first_line[:100]
        last_space = truncated.rfind(' ')
        if last_space > 50:
            truncated = truncated[:last_space]
        return truncated + "..."

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[BusinessCaseSession]:
        """Get a session by ID, optionally filtered by user_id"""
        session = db.get(BusinessCaseSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def list_sessions(self, db: Session, user_id: Optional[int] = None) -> List[BusinessCaseSession]:
        """List all sessions, optionally filtered by user"""
        statement = select(BusinessCaseSession)
        if user_id:
            statement = statement.where(BusinessCaseSession.user_id == user_id)
        statement = statement.order_by(desc(BusinessCaseSession.created_at))
        return list(db.exec(statement).all())

    def get_session_detail(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get complete session with all related data"""
        session_obj = self.get_session(db, session_id, user_id=user_id)
        if not session_obj:
            return None

        costs = list(db.exec(
            select(CostItem)
            .where(CostItem.session_id == session_id)
            .order_by(CostItem.display_order)
        ).all())

        benefits = list(db.exec(
            select(BenefitItem)
            .where(BenefitItem.session_id == session_id)
            .order_by(BenefitItem.display_order)
        ).all())

        scenarios = list(db.exec(
            select(FinancialScenario)
            .where(FinancialScenario.session_id == session_id)
        ).all())

        assumptions = list(db.exec(
            select(Assumption)
            .where(Assumption.session_id == session_id)
            .order_by(Assumption.display_order)
        ).all())

        sensitivity = list(db.exec(
            select(SensitivityAnalysis)
            .where(SensitivityAnalysis.session_id == session_id)
            .order_by(desc(SensitivityAnalysis.is_critical), SensitivityAnalysis.display_order)
        ).all())

        rates = list(db.exec(
            select(RateAssumption)
            .where(RateAssumption.session_id == session_id)
            .order_by(RateAssumption.display_order)
        ).all())

        # Get linked feasibility data if available
        feasibility_data = None
        if session_obj.feasibility_session_id:
            feasibility = db.get(FeasibilitySession, session_obj.feasibility_session_id)
            if feasibility:
                components = list(db.exec(
                    select(TechnicalComponent)
                    .where(TechnicalComponent.session_id == session_obj.feasibility_session_id)
                ).all())
                feasibility_data = {
                    "session": feasibility,
                    "components": components,
                    "total_hours": sum(c.realistic_hours for c in components)
                }

        return {
            "session": session_obj,
            "costs": costs,
            "benefits": benefits,
            "scenarios": scenarios,
            "assumptions": assumptions,
            "sensitivity": sensitivity,
            "rates": rates,
            "feasibility": feasibility_data
        }

    def update_cost_item(
        self,
        db: Session,
        cost_id: int,
        optimistic_amount: Optional[float] = None,
        realistic_amount: Optional[float] = None,
        pessimistic_amount: Optional[float] = None
    ) -> Optional[CostItem]:
        """Update cost item with user override"""
        cost = db.get(CostItem, cost_id)
        if not cost:
            return None

        # Track original if first override
        if not cost.is_user_override and cost.original_estimate is None:
            cost.original_estimate = cost.realistic_amount

        if optimistic_amount is not None:
            cost.optimistic_amount = optimistic_amount
        if realistic_amount is not None:
            cost.realistic_amount = realistic_amount
        if pessimistic_amount is not None:
            cost.pessimistic_amount = pessimistic_amount

        cost.is_user_override = True
        cost.data_source = "user_input"
        cost.updated_at = datetime.utcnow()

        db.add(cost)
        db.commit()
        db.refresh(cost)

        return cost

    def update_benefit_item(
        self,
        db: Session,
        benefit_id: int,
        optimistic_amount: Optional[float] = None,
        realistic_amount: Optional[float] = None,
        pessimistic_amount: Optional[float] = None
    ) -> Optional[BenefitItem]:
        """Update benefit item with user override"""
        benefit = db.get(BenefitItem, benefit_id)
        if not benefit:
            return None

        if not benefit.is_user_override and benefit.original_estimate is None:
            benefit.original_estimate = benefit.realistic_amount

        if optimistic_amount is not None:
            benefit.optimistic_amount = optimistic_amount
        if realistic_amount is not None:
            benefit.realistic_amount = realistic_amount
        if pessimistic_amount is not None:
            benefit.pessimistic_amount = pessimistic_amount

        benefit.is_user_override = True
        benefit.data_source = "user_input"
        benefit.updated_at = datetime.utcnow()

        db.add(benefit)
        db.commit()
        db.refresh(benefit)

        return benefit

    def delete_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> bool:
        """Delete session and all related data"""
        from sqlalchemy import text

        session_obj = self.get_session(db, session_id, user_id=user_id)
        if not session_obj:
            return False

        # Use raw SQL to delete related data in proper order
        # This bypasses ORM ordering issues with foreign keys
        # Note: user_learnings is global (not session-specific) so not deleted here
        tables_to_delete = [
            "business_case_cost_items",
            "business_case_benefit_items",
            "business_case_financial_scenarios",
            "business_case_assumptions",
            "business_case_sensitivity",
            "business_case_rate_assumptions",
        ]

        for table in tables_to_delete:
            db.execute(text(f"DELETE FROM {table} WHERE session_id = :sid"), {"sid": session_id})

        # Delete the session itself
        db.execute(text("DELETE FROM business_case_sessions WHERE id = :sid"), {"sid": session_id})
        db.commit()
        return True

    def update_rate_assumption(
        self,
        db: Session,
        rate_id: int,
        rate_value: float,
        save_for_future: bool = True
    ) -> Optional[RateAssumption]:
        """Update a rate assumption with user override"""
        rate = db.get(RateAssumption, rate_id)
        if not rate:
            return None

        original_value = rate.rate_value
        rate.rate_value = rate_value
        rate.is_user_override = True
        rate.data_source = "user_input"

        db.add(rate)
        db.commit()
        db.refresh(rate)

        # Save as user learning for future sessions
        if save_for_future and original_value > 0:
            # Get the session to find user_id
            session_obj = db.get(BusinessCaseSession, rate.session_id)
            if session_obj:
                learning = UserLearning(
                    user_id=session_obj.user_id,
                    learning_type="rate_adjustment",
                    category=rate.rate_name,
                    original_value=original_value,
                    corrected_value=rate_value,
                    correction_factor=rate_value / original_value,
                    context=f"Rate adjustment for {rate.rate_name} ({rate.rate_type})",
                    company_size=rate.company_size
                )
                db.add(learning)
                db.commit()

        return rate

    def get_user_rate_preferences(
        self,
        db: Session,
        user_id: Optional[int],
        company_size: str
    ) -> Dict[str, float]:
        """Get user's previous rate preferences for a company size"""
        if not user_id:
            return {}

        learnings = list(db.exec(
            select(UserLearning)
            .where(
                UserLearning.user_id == user_id,
                UserLearning.learning_type == "rate_adjustment",
                UserLearning.company_size == company_size
            )
            .order_by(desc(UserLearning.created_at))
        ).all())

        # Group by category and take the most recent
        preferences: Dict[str, float] = {}
        for learning in learnings:
            if learning.category not in preferences and learning.corrected_value:
                preferences[learning.category] = learning.corrected_value

        return preferences

    def get_rate_assumptions(self, db: Session, session_id: int) -> List[RateAssumption]:
        """Get all rate assumptions for a session"""
        return list(db.exec(
            select(RateAssumption)
            .where(RateAssumption.session_id == session_id)
            .order_by(RateAssumption.display_order)
        ).all())

    # --- User Learning ---

    def _get_user_learnings(
        self,
        db: Session,
        learning_type: str,
        category: str,
        user_id: Optional[int] = None
    ) -> List[UserLearning]:
        """Get applicable user learnings for estimation"""
        statement = select(UserLearning).where(
            UserLearning.learning_type == learning_type,
            UserLearning.category == category
        )
        if user_id:
            statement = statement.where(UserLearning.user_id == user_id)
        return list(db.exec(statement).all())

    def _apply_learning_factor(
        self,
        base_estimate: float,
        learnings: List[UserLearning]
    ) -> Tuple[float, str]:
        """Apply learning factor to base estimate"""
        if not learnings:
            return base_estimate, "benchmark"

        # Use most recent learning with a correction factor
        valid_learnings = [l for l in learnings if l.correction_factor is not None]
        if not valid_learnings:
            return base_estimate, "benchmark"

        # Average the correction factors
        avg_factor = sum(l.correction_factor for l in valid_learnings) / len(valid_learnings)
        adjusted = base_estimate * avg_factor

        return adjusted, "user_learning"

    def save_user_learning(
        self,
        db: Session,
        session_id: int,
        learning_type: str,
        category: str,
        original_value: float,
        corrected_value: float,
        context: str,
        user_id: Optional[int] = None
    ) -> UserLearning:
        """Save a user correction for future learning"""
        correction_factor = corrected_value / original_value if original_value > 0 else 1.0

        learning = UserLearning(
            user_id=user_id,
            learning_type=learning_type,
            category=category,
            original_value=original_value,
            corrected_value=corrected_value,
            correction_factor=correction_factor,
            context=context
        )
        db.add(learning)
        db.commit()
        db.refresh(learning)

        return learning

    # --- AI Pipeline ---

    def run_business_case_pipeline(self, db: Session, session_id: int):
        """Main pipeline: orchestrates 5 AI agents"""
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            # Load feasibility data if linked
            feasibility_data = None
            if session_obj.feasibility_session_id:
                feasibility = db.get(FeasibilitySession, session_obj.feasibility_session_id)
                if feasibility:
                    components = list(db.exec(
                        select(TechnicalComponent)
                        .where(TechnicalComponent.session_id == session_obj.feasibility_session_id)
                    ).all())
                    scenarios = list(db.exec(
                        select(TimelineScenario)
                        .where(TimelineScenario.session_id == session_obj.feasibility_session_id)
                    ).all())
                    feasibility_data = {
                        "session": feasibility,
                        "components": components,
                        "scenarios": scenarios
                    }

            # Agent 1: Context Agent
            self._update_progress(db, session_id, "analyzing", 1, "Analyzing business context and market...")
            context_data = self._analyze_context(db, session_id, feasibility_data)

            # Agent 2: Effort/Cost Agent (Development Costs)
            self._update_progress(db, session_id, "analyzing", 2, "Estimating development costs...")
            self._estimate_development_costs(db, session_id, feasibility_data, context_data)

            # Agent 3: Operational Cost Agent
            self._update_progress(db, session_id, "analyzing", 3, "Projecting operational costs...")
            self._estimate_operational_costs(db, session_id, context_data)

            # Agent 4: Benefit Agent
            self._update_progress(db, session_id, "analyzing", 4, "Estimating potential benefits...")
            self._estimate_benefits(db, session_id, context_data)

            # Agent 5: Financial Agent
            self._update_progress(db, session_id, "analyzing", 5, "Calculating financial metrics...")
            self._calculate_financials(db, session_id)

            # Generate executive summary
            self._update_progress(db, session_id, "completed", 6, "Analysis complete!")
            self._generate_executive_summary(db, session_id)

            # Update metadata
            session_obj = self.get_session(db, session_id)
            session_obj.completed_at = datetime.utcnow()
            session_obj.generation_metadata = {
                "processing_time_ms": (time.time() - start_time) * 1000,
                "used_feasibility": feasibility_data is not None
            }
            db.add(session_obj)
            db.commit()

        except Exception as e:
            print(f"ERROR in business case pipeline: {str(e)}")
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

    # --- Agent 1: Context Agent ---

    def _analyze_context(
        self,
        db: Session,
        session_id: int,
        feasibility_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze business context, market, and competitive landscape"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            raise ValueError("Session not found")

        masked_description = self._mask_pii(session_obj.feature_description)
        masked_context = self._mask_pii(session_obj.business_context or "")
        masked_market = self._mask_pii(session_obj.target_market or "")

        feasibility_info = ""
        if feasibility_data:
            components = feasibility_data.get("components", [])
            total_hours = sum(c.realistic_hours for c in components)
            feasibility_info = f"""
Linked Feasibility Analysis:
- Total Development Hours: {total_hours}
- Number of Components: {len(components)}
- Technologies: {feasibility_data['session'].auto_detected_stack or []}
"""

        prompt = f"""You are a business analyst gathering context for a business case.

Feature: {session_obj.feature_name}
Description: {masked_description}

Business Context: {masked_context if masked_context else "Not specified"}
Target Market: {masked_market if masked_market else "Not specified"}
{feasibility_info}

Your task: Analyze the business context and identify key assumptions.

Return EXACTLY this JSON structure:
{{
  "industry_context": {{
    "primary_industry": "e.g., SaaS, E-commerce, Healthcare",
    "company_size_indicator": "startup|small|medium|large|enterprise",
    "market_maturity": "emerging|growing|mature|declining"
  }},
  "key_assumptions": [
    {{
      "category": "market|technical|resource|timeline|financial",
      "assumption_text": "Clear statement of the assumption",
      "impact_if_wrong": "low|medium|high"
    }}
  ],
  "competitive_factors": {{
    "differentiation": "How this feature differentiates from competitors",
    "market_timing": "first_mover|fast_follower|late_entrant",
    "competitive_pressure": "low|medium|high"
  }},
  "risk_factors": [
    "Key risk 1",
    "Key risk 2"
  ],
  "success_metrics": [
    "Suggested KPI 1",
    "Suggested KPI 2"
  ]
}}

IMPORTANT: Return ONLY a valid JSON object. No explanations, no markdown, no code fences."""

        from app.services.ai_config_service import ai_config_service
        model_name = ai_config_service.get_active_model(db)

        data = self._call_llm_with_retry(prompt, "Context Agent", model_name)

        # Save assumptions
        for idx, assumption_data in enumerate(data.get("key_assumptions", [])):
            assumption = Assumption(
                session_id=session_id,
                assumption_category=assumption_data.get("category", "market"),
                assumption_text=assumption_data.get("assumption_text", ""),
                impact_if_wrong=assumption_data.get("impact_if_wrong", "medium"),
                data_source="ai_inference",
                display_order=idx
            )
            db.add(assumption)

        db.commit()
        return data

    # --- Agent 2: Development Cost Agent ---

    def _estimate_development_costs(
        self,
        db: Session,
        session_id: int,
        feasibility_data: Optional[Dict[str, Any]],
        context_data: Dict[str, Any]
    ):
        """Estimate development costs, importing from feasibility if available"""
        session_obj = self.get_session(db, session_id)

        # Determine hourly rates based on context
        company_size = context_data.get("industry_context", {}).get("company_size_indicator", "medium")
        hourly_rate_map = {
            "startup": {"low": 75, "mid": 100, "high": 150},
            "small": {"low": 85, "mid": 120, "high": 175},
            "medium": {"low": 100, "mid": 150, "high": 225},
            "large": {"low": 125, "mid": 175, "high": 275},
            "enterprise": {"low": 150, "mid": 200, "high": 350}
        }
        rates = hourly_rate_map.get(company_size, hourly_rate_map["medium"])

        # Get user preferences from previous sessions
        user_prefs = self.get_user_rate_preferences(db, session_obj.user_id, company_size)

        # Save rate assumptions for transparency
        # Apply user preferences if available
        rate_definitions = [
            {
                "rate_type": "hourly_rate",
                "rate_name": "Junior/Optimistic Rate",
                "default_value": rates["low"],
                "rate_unit": "per_hour",
                "description": f"Lower-end hourly rate for optimistic cost estimates. Based on {company_size} company size benchmarks.",
                "display_order": 0
            },
            {
                "rate_type": "hourly_rate",
                "rate_name": "Mid-Level/Realistic Rate",
                "default_value": rates["mid"],
                "rate_unit": "per_hour",
                "description": f"Average hourly rate for realistic cost estimates. Based on {company_size} company size benchmarks.",
                "display_order": 1
            },
            {
                "rate_type": "hourly_rate",
                "rate_name": "Senior/Pessimistic Rate",
                "default_value": rates["high"],
                "rate_unit": "per_hour",
                "description": f"Higher-end hourly rate for pessimistic cost estimates. Based on {company_size} company size benchmarks.",
                "display_order": 2
            },
            {
                "rate_type": "discount_rate",
                "rate_name": "Discount Rate",
                "default_value": 0.10,
                "rate_unit": "percentage",
                "description": "Annual discount rate for NPV calculations. Standard corporate rate.",
                "display_order": 3
            },
            {
                "rate_type": "benefit_growth_rate",
                "rate_name": "Annual Benefit Growth",
                "default_value": 0.05,
                "rate_unit": "percentage",
                "description": "Expected annual growth rate for benefits after year 1.",
                "display_order": 4
            }
        ]

        for rate_def in rate_definitions:
            # Check if user has a preference for this rate
            is_user_pref = rate_def["rate_name"] in user_prefs
            rate_value = user_prefs.get(rate_def["rate_name"], rate_def["default_value"])
            description = rate_def["description"]
            if is_user_pref:
                description += " (Using your saved preference)"

            rate = RateAssumption(
                session_id=session_id,
                rate_type=rate_def["rate_type"],
                rate_name=rate_def["rate_name"],
                rate_value=rate_value,
                rate_unit=rate_def["rate_unit"],
                company_size=company_size,
                rate_description=description,
                data_source="user_input" if is_user_pref else "benchmark",
                is_user_override=is_user_pref,
                display_order=rate_def["display_order"]
            )
            db.add(rate)

            # Update the rates dict if user preference was applied (for cost calculations)
            if is_user_pref and rate_def["rate_type"] == "hourly_rate":
                if rate_def["rate_name"] == "Junior/Optimistic Rate":
                    rates["low"] = rate_value
                elif rate_def["rate_name"] == "Mid-Level/Realistic Rate":
                    rates["mid"] = rate_value
                elif rate_def["rate_name"] == "Senior/Pessimistic Rate":
                    rates["high"] = rate_value

        if feasibility_data:
            # Import from feasibility analysis
            components = feasibility_data.get("components", [])
            for idx, comp in enumerate(components):
                cost = CostItem(
                    session_id=session_id,
                    cost_category="development",
                    cost_type="one_time",
                    item_name=f"Development: {comp.component_name}",
                    item_description=comp.component_description,
                    optimistic_amount=comp.optimistic_hours * rates["low"],
                    realistic_amount=comp.realistic_hours * rates["mid"],
                    pessimistic_amount=comp.pessimistic_hours * rates["high"],
                    data_source="feasibility_import",
                    confidence_level=comp.confidence_level,
                    source_reference=f"Feasibility Session #{session_obj.feasibility_session_id}",
                    display_order=idx
                )
                db.add(cost)
        else:
            # AI estimation without feasibility data
            prompt = f"""You are a technical cost estimator.

Feature: {session_obj.feature_name}
Description: {session_obj.feature_description}
Company Size: {company_size}

Estimate development costs. Use hourly rates: ${rates['low']}-${rates['high']}/hour.

Return EXACTLY this JSON structure:
{{
  "development_costs": [
    {{
      "item_name": "Development item name",
      "item_description": "What this includes",
      "optimistic_hours": 40,
      "realistic_hours": 80,
      "pessimistic_hours": 160,
      "confidence_level": "low|medium|high"
    }}
  ]
}}

IMPORTANT: Return ONLY valid JSON."""

            from app.services.ai_config_service import ai_config_service
            model_name = ai_config_service.get_active_model(db)

            data = self._call_llm_with_retry(prompt, "Development Cost Agent", model_name)

            for idx, item in enumerate(data.get("development_costs", [])):
                cost = CostItem(
                    session_id=session_id,
                    cost_category="development",
                    cost_type="one_time",
                    item_name=item.get("item_name", f"Development Item {idx+1}"),
                    item_description=item.get("item_description", ""),
                    optimistic_amount=item.get("optimistic_hours", 40) * rates["low"],
                    realistic_amount=item.get("realistic_hours", 80) * rates["mid"],
                    pessimistic_amount=item.get("pessimistic_hours", 160) * rates["high"],
                    data_source="ai_estimate",
                    confidence_level=item.get("confidence_level", "medium"),
                    display_order=idx
                )
                db.add(cost)

        db.commit()

    # --- Agent 3: Operational Cost Agent ---

    def _estimate_operational_costs(
        self,
        db: Session,
        session_id: int,
        context_data: Dict[str, Any]
    ):
        """Estimate ongoing operational costs"""
        session_obj = self.get_session(db, session_id)

        prompt = f"""You are an operations cost analyst.

Feature: {session_obj.feature_name}
Description: {session_obj.feature_description}
Industry: {context_data.get('industry_context', {}).get('primary_industry', 'Technology')}
Company Size: {context_data.get('industry_context', {}).get('company_size_indicator', 'medium')}

Estimate ongoing operational costs including:
- Infrastructure (cloud, hosting, CDN)
- Third-party services/APIs
- Maintenance and support
- Licensing fees

Return EXACTLY this JSON structure:
{{
  "operational_costs": [
    {{
      "category": "infrastructure|licensing|maintenance|support|training",
      "cost_type": "recurring_monthly|recurring_annual",
      "item_name": "Cost item name",
      "item_description": "What this covers",
      "optimistic_amount": 500,
      "realistic_amount": 1000,
      "pessimistic_amount": 2000,
      "confidence_level": "low|medium|high"
    }}
  ]
}}

IMPORTANT: Return ONLY valid JSON. No explanations."""

        from app.services.ai_config_service import ai_config_service
        model_name = ai_config_service.get_active_model(db)

        data = self._call_llm_with_retry(prompt, "Operational Cost Agent", model_name)

        # Get existing cost count for display order
        existing_count = len(list(db.exec(
            select(CostItem).where(CostItem.session_id == session_id)
        ).all()))

        for idx, item in enumerate(data.get("operational_costs", [])):
            cost = CostItem(
                session_id=session_id,
                cost_category=item.get("category", "infrastructure"),
                cost_type=item.get("cost_type", "recurring_monthly"),
                item_name=item.get("item_name", f"Operational Cost {idx+1}"),
                item_description=item.get("item_description", ""),
                optimistic_amount=item.get("optimistic_amount", 500),
                realistic_amount=item.get("realistic_amount", 1000),
                pessimistic_amount=item.get("pessimistic_amount", 2000),
                data_source="ai_estimate",
                confidence_level=item.get("confidence_level", "medium"),
                display_order=existing_count + idx
            )
            db.add(cost)

        db.commit()

    # --- Agent 4: Benefit Agent ---

    def _estimate_benefits(
        self,
        db: Session,
        session_id: int,
        context_data: Dict[str, Any]
    ):
        """Estimate potential benefits"""
        session_obj = self.get_session(db, session_id)

        prompt = f"""You are a business value analyst.

Feature: {session_obj.feature_name}
Description: {session_obj.feature_description}
Industry: {context_data.get('industry_context', {}).get('primary_industry', 'Technology')}
Company Size: {context_data.get('industry_context', {}).get('company_size_indicator', 'medium')}
Success Metrics: {context_data.get('success_metrics', [])}

Estimate potential benefits including:
- Revenue increases (new sales, upsells, reduced churn)
- Cost reductions (efficiency gains, automation savings)
- Strategic value (competitive advantage, market positioning)

For each benefit, provide realistic dollar amounts based on industry benchmarks.

Return EXACTLY this JSON structure:
{{
  "benefits": [
    {{
      "category": "revenue_increase|cost_reduction|efficiency_gain|risk_reduction|strategic",
      "benefit_type": "quantifiable|semi_quantifiable|qualitative",
      "item_name": "Benefit name",
      "item_description": "How this benefit is realized",
      "optimistic_amount": 50000,
      "realistic_amount": 30000,
      "pessimistic_amount": 15000,
      "recurrence": "monthly|annual|one_time",
      "time_to_realize_months": 6,
      "confidence_level": "low|medium|high"
    }}
  ]
}}

IMPORTANT: Return ONLY valid JSON. For qualitative benefits, set amounts to null."""

        from app.services.ai_config_service import ai_config_service
        model_name = ai_config_service.get_active_model(db)

        data = self._call_llm_with_retry(prompt, "Benefit Agent", model_name)

        for idx, item in enumerate(data.get("benefits", [])):
            benefit = BenefitItem(
                session_id=session_id,
                benefit_category=item.get("category", "revenue_increase"),
                benefit_type=item.get("benefit_type", "quantifiable"),
                item_name=item.get("item_name", f"Benefit {idx+1}"),
                item_description=item.get("item_description", ""),
                optimistic_amount=item.get("optimistic_amount"),
                realistic_amount=item.get("realistic_amount"),
                pessimistic_amount=item.get("pessimistic_amount"),
                recurrence=item.get("recurrence", "annual"),
                time_to_realize_months=item.get("time_to_realize_months", 0),
                data_source="ai_estimate",
                confidence_level=item.get("confidence_level", "medium"),
                display_order=idx
            )
            db.add(benefit)

        db.commit()

    # --- Agent 5: Financial Agent ---

    def _calculate_financials(self, db: Session, session_id: int):
        """Calculate financial metrics and scenarios"""
        session_obj = self.get_session(db, session_id)

        # Fetch costs and benefits
        costs = list(db.exec(
            select(CostItem).where(CostItem.session_id == session_id)
        ).all())
        benefits = list(db.exec(
            select(BenefitItem).where(BenefitItem.session_id == session_id)
        ).all())

        # Calculate scenarios
        for scenario_type in ["conservative", "base", "optimistic"]:
            scenario = self._calculate_scenario(
                session_id, costs, benefits, scenario_type
            )
            db.add(scenario)

        # Calculate sensitivity analysis
        self._calculate_sensitivity(db, session_id, costs, benefits)

        db.commit()

        # Update session with base scenario values
        base_scenario = next((s for s in db.exec(
            select(FinancialScenario).where(
                FinancialScenario.session_id == session_id,
                FinancialScenario.scenario_type == "base"
            )
        ).all()), None)

        if base_scenario:
            session_obj.total_investment = base_scenario.total_investment_year_1
            session_obj.net_present_value = base_scenario.net_present_value
            session_obj.internal_rate_of_return = base_scenario.internal_rate_of_return
            session_obj.payback_months = base_scenario.payback_period_months
            session_obj.roi_percentage = base_scenario.roi_percentage
            db.add(session_obj)
            db.commit()

    def _calculate_scenario(
        self,
        session_id: int,
        costs: List[CostItem],
        benefits: List[BenefitItem],
        scenario_type: str
    ) -> FinancialScenario:
        """Calculate a single financial scenario"""
        # Select amounts based on scenario
        amount_key = {
            "conservative": "pessimistic",  # High costs, low benefits
            "base": "realistic",
            "optimistic": "optimistic"  # Low costs, high benefits
        }[scenario_type]

        # For costs: conservative = pessimistic (higher), optimistic = optimistic (lower)
        cost_key = "pessimistic" if scenario_type == "conservative" else (
            "optimistic" if scenario_type == "optimistic" else "realistic"
        )
        # For benefits: conservative = pessimistic (lower), optimistic = optimistic (higher)
        benefit_key = amount_key

        # Calculate one-time costs
        one_time_costs = sum(
            getattr(c, f"{cost_key}_amount", c.realistic_amount)
            for c in costs if c.cost_type == "one_time"
        )

        # Calculate recurring costs (annualized)
        monthly_costs = sum(
            getattr(c, f"{cost_key}_amount", c.realistic_amount)
            for c in costs if c.cost_type == "recurring_monthly"
        )
        annual_costs = sum(
            getattr(c, f"{cost_key}_amount", c.realistic_amount)
            for c in costs if c.cost_type == "recurring_annual"
        )
        total_recurring_annual = (monthly_costs * 12) + annual_costs

        # Calculate year 1 investment
        year_1_investment = one_time_costs + total_recurring_annual

        # Calculate benefits (annualized)
        quantifiable_benefits = [b for b in benefits if b.benefit_type in ["quantifiable", "semi_quantifiable"]]

        annual_benefits_year_1 = 0
        for b in quantifiable_benefits:
            amount = getattr(b, f"{benefit_key}_amount", b.realistic_amount) or 0
            if b.recurrence == "monthly":
                # Adjust for time to realize
                months_active = max(0, 12 - b.time_to_realize_months)
                annual_benefits_year_1 += amount * months_active
            elif b.recurrence == "annual":
                if b.time_to_realize_months <= 12:
                    annual_benefits_year_1 += amount
            elif b.recurrence == "one_time":
                if b.time_to_realize_months <= 12:
                    annual_benefits_year_1 += amount

        # Year 3 benefits (full year, with some growth)
        annual_benefits_year_3 = sum(
            (getattr(b, f"{benefit_key}_amount", b.realistic_amount) or 0) *
            (12 if b.recurrence == "monthly" else 1)
            for b in quantifiable_benefits
            if b.benefit_type in ["quantifiable", "semi_quantifiable"]
        )

        # 5-year projections
        discount_rate = 0.10
        projection_years = 5

        yearly_cash_flows = []
        cumulative_npv = -one_time_costs  # Initial investment
        payback_reached = False
        payback_months = None

        for year in range(1, projection_years + 1):
            # Benefits grow slightly each year
            year_benefits = annual_benefits_year_1 * (1.05 ** (year - 1))
            # Year 1 includes one-time costs, subsequent years only recurring
            year_costs = total_recurring_annual + (one_time_costs if year == 1 else 0)
            net_cash_flow = year_benefits - year_costs

            # Discount factor
            discount_factor = 1 / ((1 + discount_rate) ** year)
            discounted_cf = net_cash_flow * discount_factor
            cumulative_npv += discounted_cf

            yearly_cash_flows.append({
                "year": year,
                "benefits": round(year_benefits, 2),
                "costs": round(year_costs, 2),
                "netCashFlow": round(net_cash_flow, 2),
                "discountedCashFlow": round(discounted_cf, 2),
                "cumulativeNpv": round(cumulative_npv, 2)
            })

            # Track payback
            if not payback_reached and cumulative_npv >= 0:
                payback_reached = True
                # Estimate months within the year
                if year == 1:
                    payback_months = 12
                else:
                    prev_cumulative = yearly_cash_flows[year-2]["cumulativeNpv"]
                    if net_cash_flow > 0:
                        fraction = (-prev_cumulative) / (cumulative_npv - prev_cumulative)
                        payback_months = (year - 1) * 12 + int(fraction * 12)

        # Calculate NPV and IRR
        npv = cumulative_npv
        total_benefits_5_year = sum(cf["benefits"] for cf in yearly_cash_flows)

        # Calculate IRR using Newton-Raphson approximation
        irr = self._calculate_irr(
            -one_time_costs,
            [cf["netCashFlow"] for cf in yearly_cash_flows]
        )

        # ROI calculation
        total_investment_5_year = one_time_costs + (total_recurring_annual * 5)
        roi = ((total_benefits_5_year - total_investment_5_year) / total_investment_5_year * 100) if total_investment_5_year > 0 else 0

        rationale = f"{scenario_type.capitalize()} scenario: "
        if scenario_type == "conservative":
            rationale += "Higher cost estimates, lower benefit estimates, slower realization."
        elif scenario_type == "optimistic":
            rationale += "Lower cost estimates, higher benefit estimates, faster realization."
        else:
            rationale += "Most likely estimates for costs and benefits."

        return FinancialScenario(
            session_id=session_id,
            scenario_type=scenario_type,
            total_one_time_costs=round(one_time_costs, 2),
            total_recurring_annual_costs=round(total_recurring_annual, 2),
            total_investment_year_1=round(year_1_investment, 2),
            total_investment_5_year=round(total_investment_5_year, 2),
            total_annual_benefits_year_1=round(annual_benefits_year_1, 2),
            total_annual_benefits_year_3=round(annual_benefits_year_3, 2),
            total_benefits_5_year=round(total_benefits_5_year, 2),
            net_present_value=round(npv, 2),
            internal_rate_of_return=round(irr * 100, 2) if irr else None,
            payback_period_months=payback_months,
            roi_percentage=round(roi, 2),
            discount_rate=discount_rate,
            projection_years=projection_years,
            rationale=rationale,
            confidence_level="medium",
            yearly_cash_flows=yearly_cash_flows
        )

    def _calculate_irr(self, initial_investment: float, cash_flows: List[float]) -> Optional[float]:
        """Calculate Internal Rate of Return using Newton-Raphson method"""
        if not cash_flows:
            return None

        # Combine initial investment with cash flows
        all_flows = [initial_investment] + cash_flows

        # Check if IRR is possible (need sign change)
        if all(cf >= 0 for cf in all_flows) or all(cf <= 0 for cf in all_flows):
            return None

        def npv_at_rate(rate: float) -> float:
            return sum(cf / ((1 + rate) ** i) for i, cf in enumerate(all_flows))

        def npv_derivative(rate: float) -> float:
            return sum(-i * cf / ((1 + rate) ** (i + 1)) for i, cf in enumerate(all_flows))

        # Newton-Raphson iteration
        rate = 0.1  # Initial guess
        for _ in range(100):
            npv = npv_at_rate(rate)
            derivative = npv_derivative(rate)
            if abs(derivative) < 1e-10:
                break
            new_rate = rate - npv / derivative
            if abs(new_rate - rate) < 1e-6:
                return new_rate if new_rate > -1 else None
            rate = new_rate

        return rate if -1 < rate < 10 else None  # Reasonable IRR range

    def _calculate_sensitivity(
        self,
        db: Session,
        session_id: int,
        costs: List[CostItem],
        benefits: List[BenefitItem]
    ):
        """Calculate sensitivity analysis for key variables"""
        # Get base NPV
        base_scenario = self._calculate_scenario(session_id, costs, benefits, "base")
        base_npv = base_scenario.net_present_value

        sensitivity_items = []

        # Analyze major cost items
        for idx, cost in enumerate(costs[:5]):  # Top 5 costs
            base_value = cost.realistic_amount
            if base_value <= 0:
                continue

            # Calculate NPV at -20% and +20%
            low_value = base_value * 0.8
            high_value = base_value * 1.2

            # For costs, lower = better NPV, higher = worse NPV
            # Approximate impact (simplified)
            annual_multiplier = 12 if cost.cost_type == "recurring_monthly" else (
                1 if cost.cost_type == "recurring_annual" else 0
            )
            one_time = 1 if cost.cost_type == "one_time" else 0

            impact_per_unit = (annual_multiplier * 5 + one_time) * 0.7  # Rough discounted impact
            npv_change = (base_value * 0.2) * impact_per_unit

            sensitivity = SensitivityAnalysis(
                session_id=session_id,
                variable_name=cost.item_name,
                variable_type="cost",
                base_value=base_value,
                low_value=low_value,
                high_value=high_value,
                npv_at_low=base_npv + npv_change,
                npv_at_high=base_npv - npv_change,
                npv_sensitivity=npv_change / (base_value * 0.01),
                is_critical=npv_change > abs(base_npv * 0.1),
                display_order=idx
            )
            sensitivity_items.append(sensitivity)
            db.add(sensitivity)

        # Analyze major benefit items
        benefit_offset = len(sensitivity_items)
        for idx, benefit in enumerate(benefits[:5]):
            if benefit.benefit_type == "qualitative":
                continue
            base_value = benefit.realistic_amount or 0
            if base_value <= 0:
                continue

            low_value = base_value * 0.8
            high_value = base_value * 1.2

            annual_multiplier = 12 if benefit.recurrence == "monthly" else (
                1 if benefit.recurrence == "annual" else 0
            )
            impact_per_unit = annual_multiplier * 5 * 0.7

            npv_change = (base_value * 0.2) * impact_per_unit

            sensitivity = SensitivityAnalysis(
                session_id=session_id,
                variable_name=benefit.item_name,
                variable_type="benefit",
                base_value=base_value,
                low_value=low_value,
                high_value=high_value,
                npv_at_low=base_npv - npv_change,  # Lower benefit = lower NPV
                npv_at_high=base_npv + npv_change,
                npv_sensitivity=npv_change / (base_value * 0.01),
                is_critical=npv_change > abs(base_npv * 0.1),
                display_order=benefit_offset + idx
            )
            db.add(sensitivity)

        db.commit()

    # --- Executive Summary ---

    def _generate_executive_summary(self, db: Session, session_id: int):
        """Generate executive summary and recommendation"""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return

        # Get all data
        detail = self.get_session_detail(db, session_id)
        base_scenario = next(
            (s for s in detail["scenarios"] if s.scenario_type == "base"),
            None
        )
        conservative_scenario = next(
            (s for s in detail["scenarios"] if s.scenario_type == "conservative"),
            None
        )

        # Determine recommendation
        recommendation = "defer"
        rationale = ""

        if base_scenario:
            npv = base_scenario.net_present_value
            irr = base_scenario.internal_rate_of_return
            payback = base_scenario.payback_period_months
            conservative_npv = conservative_scenario.net_present_value if conservative_scenario else npv

            if npv > 0 and conservative_npv > 0:
                recommendation = "invest"
                rationale = f"Positive NPV of ${npv:,.0f} with strong financial returns even in conservative scenario."
            elif npv > 0 and conservative_npv < 0:
                recommendation = "conditional"
                rationale = f"Positive base NPV of ${npv:,.0f} but conservative scenario shows risk. Recommend phased approach."
            else:
                recommendation = "defer"
                rationale = f"Negative NPV of ${npv:,.0f} suggests this investment may not generate sufficient returns."

        # Build summary using LLM
        costs_summary = f"${session_obj.total_investment:,.0f}" if session_obj.total_investment else "Unknown"
        npv_summary = f"${session_obj.net_present_value:,.0f}" if session_obj.net_present_value else "Unknown"
        irr_summary = f"{session_obj.internal_rate_of_return:.1f}%" if session_obj.internal_rate_of_return else "N/A"
        payback_summary = f"{session_obj.payback_months} months" if session_obj.payback_months else "N/A"

        prompt = f"""Generate an executive summary for a business case.

Feature: {session_obj.feature_name}
Description: {session_obj.feature_description[:500]}

Financial Summary:
- Total Investment (Year 1): {costs_summary}
- Net Present Value (5-year): {npv_summary}
- Internal Rate of Return: {irr_summary}
- Payback Period: {payback_summary}

Recommendation: {recommendation.upper()}
Rationale: {rationale}

Key Assumptions: {len(detail['assumptions'])}
Number of Cost Items: {len(detail['costs'])}
Number of Benefit Items: {len(detail['benefits'])}

Generate a 4-5 sentence executive summary that:
1. States the investment proposition
2. Highlights key financial metrics
3. Notes key risks or assumptions
4. States the recommendation with rationale

Return EXACTLY this JSON:
{{
  "executive_summary": "Your summary here..."
}}

IMPORTANT: Return ONLY valid JSON."""

        from app.services.ai_config_service import ai_config_service
        model_name = ai_config_service.get_active_model(db)

        data = self._call_llm_with_retry(prompt, "Executive Summary", model_name)

        session_obj.executive_summary = data.get("executive_summary", "Analysis complete.")
        session_obj.recommendation = recommendation

        # Set confidence based on data sources
        costs = detail["costs"]
        user_data_count = sum(1 for c in costs if c.data_source in ["user_input", "feasibility_import"])
        if user_data_count >= len(costs) * 0.5:
            session_obj.confidence_level = "high"
        elif user_data_count >= len(costs) * 0.2:
            session_obj.confidence_level = "medium"
        else:
            session_obj.confidence_level = "low"

        db.add(session_obj)
        db.commit()


# Global instance
business_case_service = BusinessCaseService()
