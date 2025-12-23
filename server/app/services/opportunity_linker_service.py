"""
Opportunity Linker Service

Implements AI-powered opportunity mapping and prioritization workflow.
Uses openai/gpt-oss-120b via OpenRouter for all LLM calls.
Supports batch processing for faster execution.
"""
import json
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlmodel import Session, select
import requests
from app.models.opportunity_linker import PrioritizationSession, PrioritizedIdea
from app.models.ideation import IdeationSession, GeneratedIdea
from app.core.config import settings


class OpportunityLinkerService:
    """Service for mapping ideas to opportunities and calculating priority scores"""

    def __init__(self):
        self.openrouter_api_key = settings.OPENROUTER_API_KEY
        self.model = settings.OPENROUTER_MODEL  # Should be "openai/gpt-oss-120b"
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.batch_size = 5  # Process 5 ideas concurrently
        self.executor = ThreadPoolExecutor(max_workers=5)

    def _call_llm(self, prompt: str, system_prompt: str = "", retry_count: int = 1) -> Dict[str, Any]:
        """
        Call OpenRouter LLM with retry logic and strict JSON formatting.

        IMPORTANT: Enforces response_format: {type: "json_object"} to ensure valid JSON.
        Implements cleanup for model quirks (double braces, prefix characters).
        """
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "response_format": {"type": "json_object"},  # Enforce JSON output
        }

        attempt = 0
        while attempt < retry_count:
            try:
                response = requests.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                response.raise_for_status()

                content = response.json()["choices"][0]["message"]["content"]

                # Clean up model quirks - some models prepend characters before JSON
                content = content.strip()

                # Handle double-brace issue: if first line is just "{" or "[", skip it
                lines = content.split('\n')
                if lines and lines[0].strip() in ['{', '[']:
                    content = '\n'.join(lines[1:])

                # Find the first { or [ to locate the start of JSON
                json_start = min(
                    (content.find('{') if content.find('{') != -1 else len(content)),
                    (content.find('[') if content.find('[') != -1 else len(content))
                )
                if json_start > 0:
                    content = content[json_start:]

                return json.loads(content)

            except requests.Timeout:
                attempt += 1
                if attempt < retry_count:
                    time.sleep(2)  # Backoff period
                    continue
                else:
                    raise Exception("LLM request timed out after retry")
            except requests.RequestException as e:
                raise Exception(f"LLM request failed: {str(e)}")
            except json.JSONDecodeError as e:
                raise Exception(f"LLM returned invalid JSON: {str(e)}")

        raise Exception("Failed to get LLM response")

    def _agent_7_opportunity_mapping(
        self,
        idea: GeneratedIdea,
        problem_statement: str
    ) -> Dict[str, Any]:
        """
        Agent 7: Opportunity Mapping

        Generates synthetic opportunities for market, strategic, and customer dimensions.
        """
        system_prompt = """You are an expert business strategist.
You MUST respond ONLY with valid JSON. Do NOT include any markdown, code blocks, or explanatory text.
Your response must be a single JSON object with no additional formatting."""

        prompt = f"""Given this idea and problem context, generate synthetic opportunity estimates.

PROBLEM STATEMENT:
{problem_statement}

IDEA:
Title: {idea.title}
Description: {idea.description}
Category: {idea.category}

Generate a JSON object with this EXACT structure:
{{
  "market_opportunity": {{
    "estimated_market_size": "$XXX annually or One-time $XXX",
    "confidence_level": "Very Low|Low|Medium|High",
    "rationale": "Explanation based on problem impact"
  }},
  "strategic_opportunity": {{
    "connection_strength": "Low|Medium|High",
    "alignment_rationale": "How this aligns with stated goals"
  }},
  "customer_opportunity": {{
    "value_delivered": "Specific value proposition",
    "customer_segment": "Target user segment",
    "pain_point_addressed": "Specific pain point resolved"
  }}
}}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations."""

        return self._call_llm(prompt, system_prompt, retry_count=2)

    def _agent_8_strategic_fit(
        self,
        idea: GeneratedIdea,
        problem_statement: str,
        structured_problem: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Agent 8: Strategic Fit Scoring

        Calculates 0-10 score based on:
        - Directness of solution to problem
        - Root cause vs symptom resolution
        - Prevention of recurrence
        """
        system_prompt = """You are a strategic analyst.
You MUST respond ONLY with valid JSON. Do NOT include any markdown, code blocks, or explanatory text.
Your response must be a single JSON object with no additional formatting."""

        who = structured_problem.get('who', 'users') if structured_problem else 'users'
        what = structured_problem.get('what', problem_statement) if structured_problem else problem_statement

        prompt = f"""Analyze the strategic fit of this idea to the problem.

PROBLEM:
Who: {who}
What: {what}

IDEA:
Title: {idea.title}
Description: {idea.description}

Score this idea's strategic fit on a scale of 0-10 based on:
1. How directly it solves the core problem (not just symptoms)
2. Whether it addresses root causes
3. How well it prevents problem recurrence

Return a JSON object with this EXACT structure:
{{
  "strategic_fit_score": 7.5,
  "rationale": "Detailed explanation of the score"
}}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations."""

        return self._call_llm(prompt, system_prompt, retry_count=2)

    def _agent_9_size_estimation(
        self,
        idea: GeneratedIdea,
        problem_statement: str,
        structured_problem: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Agent 9: Size Estimation

        Calculates T-shirt size (S/M/L/XL) based on impact value and affected percentage.
        """
        system_prompt = """You are a product sizing expert.
You MUST respond ONLY with valid JSON. Do NOT include any markdown, code blocks, or explanatory text.
Your response must be a single JSON object with no additional formatting."""

        impact = structured_problem.get('impact', '') if structured_problem else ''
        affects = structured_problem.get('affects', '') if structured_problem else ''

        prompt = f"""Estimate the size of this opportunity.

PROBLEM CONTEXT:
Impact: {impact if impact else 'Not specified'}
Affects: {affects if affects else 'Not specified'}
Problem: {problem_statement}

IDEA:
Title: {idea.title}
Impact Score: {idea.impact_score if idea.impact_score else 'Not scored'}

Assign a T-shirt size (S/M/L/XL) based on potential revenue and effort:
- S: Small opportunity (<$50K potential or <10% affected)
- M: Medium opportunity ($50K-$200K or 10-25% affected)
- L: Large opportunity ($200K-$500K or 25-50% affected)
- XL: Extra Large opportunity (>$500K or >50% affected)

If financial data is missing or unparseable, default to "S" with "Very Low" confidence.

Return a JSON object with this EXACT structure:
{{
  "tshirt_size": "S|M|L|XL",
  "potential_revenue": "$XXX or Not quantifiable",
  "confidence": "Very Low|Low|Medium|High",
  "rationale": "Explanation of sizing decision"
}}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations."""

        return self._call_llm(prompt, system_prompt, retry_count=2)

    def _agent_10_prioritization(
        self,
        idea: GeneratedIdea,
        strategic_fit_score: float
    ) -> Dict[str, Any]:
        """
        Agent 10: Prioritization Logic

        Calculates priority score using weighted average:
        - Impact: 30%
        - Strategic Fit: 25%
        - Effort: 20%
        - Feasibility: 15%
        - Risk: 10%

        Assigns tier based on score:
        - P0: >= 8.0
        - P1: >= 6.5
        - P2: >= 5.0
        - P3: < 5.0
        """
        # Get scores from idea (already calculated by ideation engine)
        impact = idea.impact_score if idea.impact_score else 5.0
        feasibility = idea.feasibility_score if idea.feasibility_score else 5.0
        effort = idea.effort_score if idea.effort_score else 5.0
        risk = idea.risk_score if idea.risk_score else 5.0

        # Calculate weighted average
        priority_score = (
            impact * 0.30 +
            strategic_fit_score * 0.25 +
            effort * 0.20 +
            feasibility * 0.15 +
            risk * 0.10
        )

        # Assign tier
        if priority_score >= 8.0:
            tier = "P0"
        elif priority_score >= 6.5:
            tier = "P1"
        elif priority_score >= 5.0:
            tier = "P2"
        else:
            tier = "P3"

        return {
            "priority_score": round(priority_score, 2),
            "priority_tier": tier
        }

    def _process_single_idea(
        self,
        idea: GeneratedIdea,
        session: PrioritizationSession,
        ideation_session: IdeationSession,
        idx: int
    ) -> Dict[str, Any]:
        """
        Process a single idea through all agents.

        Returns a dictionary with all the processed data for this idea.
        """
        # Agent 7: Opportunity Mapping
        opp_data = self._agent_7_opportunity_mapping(
            idea,
            ideation_session.problem_statement
        )

        # Agent 8: Strategic Fit
        fit_data = self._agent_8_strategic_fit(
            idea,
            ideation_session.problem_statement,
            ideation_session.structured_problem
        )

        # Agent 9: Size Estimation
        size_data = self._agent_9_size_estimation(
            idea,
            ideation_session.problem_statement,
            ideation_session.structured_problem
        )

        # Agent 10: Prioritization
        priority_data = self._agent_10_prioritization(
            idea,
            fit_data.get("strategic_fit_score", 5.0)
        )

        return {
            "idea_id": idea.id,
            "idx": idx,
            "market_opportunity": opp_data.get("market_opportunity"),
            "strategic_opportunity": opp_data.get("strategic_opportunity"),
            "customer_opportunity": opp_data.get("customer_opportunity"),
            "strategic_fit_score": fit_data.get("strategic_fit_score"),
            "strategic_fit_rationale": fit_data.get("rationale"),
            "tshirt_size": size_data.get("tshirt_size"),
            "potential_revenue": size_data.get("potential_revenue"),
            "size_confidence": size_data.get("confidence"),
            "size_rationale": size_data.get("rationale"),
            "priority_score": priority_data.get("priority_score"),
            "priority_tier": priority_data.get("priority_tier"),
        }

    def create_session(
        self,
        db: Session,
        ideation_session_id: int,
        user_id: Optional[int] = None
    ) -> PrioritizationSession:
        """
        Create a new prioritization session and start processing.

        Args:
            db: Database session
            ideation_session_id: ID of completed ideation session
            user_id: Optional user ID

        Returns:
            Created prioritization session

        Raises:
            ValueError: If ideation session not found or not completed
        """
        # Validate ideation session exists and is completed
        ideation_session = db.get(IdeationSession, ideation_session_id)
        if not ideation_session:
            raise ValueError("Ideation session not found")

        if ideation_session.status != "completed":
            raise ValueError("Ideation session must be completed before prioritization")

        # Create prioritization session
        session = PrioritizationSession(
            user_id=user_id,
            ideation_session_id=ideation_session_id,
            status="pending",
            progress_step=0,
            progress_message="Initializing opportunity mapping..."
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        return session

    def process_session(
        self,
        db: Session,
        session_id: int
    ) -> PrioritizationSession:
        """
        Process a prioritization session through all agents.

        This is the main workflow that:
        1. Maps opportunities for each idea (Agent 7)
        2. Scores strategic fit (Agent 8)
        3. Estimates size (Agent 9)
        4. Calculates priority and assigns tiers (Agent 10)
        5. Generates portfolio summary

        Args:
            db: Database session
            session_id: Prioritization session ID

        Returns:
            Updated prioritization session
        """
        start_time = time.time()

        session = db.get(PrioritizationSession, session_id)
        if not session:
            raise ValueError("Prioritization session not found")

        try:
            # Get ideation session and ideas
            ideation_session = db.get(IdeationSession, session.ideation_session_id)
            if not ideation_session:
                raise ValueError("Ideation session not found")

            # Get all final ideas from ideation session
            ideas = db.exec(
                select(GeneratedIdea)
                .where(GeneratedIdea.session_id == session.ideation_session_id)
                .where(GeneratedIdea.is_final == True)
            ).all()

            if not ideas:
                raise ValueError("No ideas found in ideation session")

            total_ideas = len(ideas)
            prioritized_ideas = []

            # Process ideas in batches for better performance
            session.status = "mapping"
            db.add(session)
            db.commit()

            # Process in batches using ThreadPoolExecutor
            for batch_start in range(0, total_ideas, self.batch_size):
                batch_end = min(batch_start + self.batch_size, total_ideas)
                batch_ideas = list(enumerate(ideas))[batch_start:batch_end]

                # Update progress
                session.progress_step = batch_end
                session.progress_message = f"Processing batch: ideas {batch_start + 1}-{batch_end} of {total_ideas}"
                db.add(session)
                db.commit()

                # Process batch concurrently
                futures = []
                for idx, idea in batch_ideas:
                    future = self.executor.submit(
                        self._process_single_idea,
                        idea,
                        session,
                        ideation_session,
                        idx
                    )
                    futures.append((idea, future))

                # Collect results
                for idea, future in futures:
                    try:
                        result = future.result(timeout=90)  # 90 second timeout per idea

                        # Create prioritized idea record
                        prioritized_idea = PrioritizedIdea(
                            prioritization_session_id=session.id,
                            generated_idea_id=result["idea_id"],
                            market_opportunity=result["market_opportunity"],
                            strategic_opportunity=result["strategic_opportunity"],
                            customer_opportunity=result["customer_opportunity"],
                            strategic_fit_score=result["strategic_fit_score"],
                            strategic_fit_rationale=result["strategic_fit_rationale"],
                            tshirt_size=result["tshirt_size"],
                            potential_revenue=result["potential_revenue"],
                            size_confidence=result["size_confidence"],
                            size_rationale=result["size_rationale"],
                            priority_score=result["priority_score"],
                            priority_tier=result["priority_tier"],
                            display_order=result["idx"]
                        )
                        db.add(prioritized_idea)
                        prioritized_ideas.append(prioritized_idea)
                    except Exception as e:
                        print(f"Error processing idea {idea.id}: {e}")
                        # Continue with next idea instead of failing entire batch

                # Commit batch results
                db.commit()

            # Final commit to ensure all ideas are saved
            db.commit()

            # Generate portfolio summary
            portfolio_summary = self._generate_portfolio_summary(prioritized_ideas, ideas)

            # Update session with completion
            session.status = "completed"
            session.progress_step = total_ideas
            session.progress_message = "Opportunity mapping completed"
            session.portfolio_summary = portfolio_summary
            session.processing_time_ms = int((time.time() - start_time) * 1000)
            session.completed_at = datetime.utcnow()
            db.add(session)
            db.commit()
            db.refresh(session)

            return session

        except Exception as e:
            session.status = "failed"
            session.error_message = str(e)
            db.add(session)
            db.commit()
            raise e

    def _generate_portfolio_summary(
        self,
        prioritized_ideas: List[PrioritizedIdea],
        original_ideas: List[GeneratedIdea]
    ) -> Dict[str, Any]:
        """Generate portfolio summary from prioritized ideas"""
        # Count by tier
        by_tier = {"p0": 0, "p1": 0, "p2": 0, "p3": 0}
        for idea in prioritized_ideas:
            tier_key = idea.priority_tier.lower() if idea.priority_tier else "p3"
            by_tier[tier_key] = by_tier.get(tier_key, 0) + 1

        # Count by category (from original ideas)
        by_category = {
            "quick_wins": 0,
            "strategic_bets": 0,
            "incremental": 0,
            "moonshots": 0
        }
        for idea in original_ideas:
            cat = idea.category if idea.category else "incremental"
            by_category[cat] = by_category.get(cat, 0) + 1

        # Count by effort
        by_effort = {"S": 0, "M": 0, "L": 0, "XL": 0}
        for idea in prioritized_ideas:
            size = idea.tshirt_size if idea.tshirt_size else "M"
            by_effort[size] = by_effort.get(size, 0) + 1

        # Get top 3 P0 recommendations
        p0_ideas = [
            p.generated_idea_id
            for p in sorted(prioritized_ideas, key=lambda x: x.priority_score or 0, reverse=True)
            if p.priority_tier == "P0"
        ][:3]

        return {
            "by_tier": by_tier,
            "by_category": by_category,
            "by_effort": by_effort,
            "top_p0_recommendations": p0_ideas
        }

    def get_session(self, db: Session, session_id: int) -> Optional[PrioritizationSession]:
        """Get a prioritization session by ID"""
        return db.get(PrioritizationSession, session_id)

    def list_sessions(self, db: Session, user_id: Optional[int] = None) -> List[PrioritizationSession]:
        """List all prioritization sessions, optionally filtered by user"""
        query = select(PrioritizationSession).order_by(PrioritizationSession.created_at.desc())
        if user_id:
            query = query.where(PrioritizationSession.user_id == user_id)
        return list(db.exec(query).all())

    def get_session_detail(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get session with all prioritized ideas"""
        session = db.get(PrioritizationSession, session_id)
        if not session:
            return None

        # Get prioritized ideas with original idea data
        prioritized_ideas = db.exec(
            select(PrioritizedIdea, GeneratedIdea)
            .join(GeneratedIdea, PrioritizedIdea.generated_idea_id == GeneratedIdea.id)
            .where(PrioritizedIdea.prioritization_session_id == session_id)
            .order_by(PrioritizedIdea.priority_score.desc())
        ).all()

        ideas_data = []
        for p_idea, g_idea in prioritized_ideas:
            idea_dict = p_idea.model_dump()
            idea_dict.update({
                "title": g_idea.title,
                "description": g_idea.description,
                "category": g_idea.category,
                "impactScore": g_idea.impact_score,
                "feasibilityScore": g_idea.feasibility_score,
                "effortScore": g_idea.effort_score,
                "riskScore": g_idea.risk_score,
            })
            ideas_data.append(idea_dict)

        return {
            "session": session.model_dump(),
            "ideas": ideas_data
        }

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a prioritization session"""
        session = db.get(PrioritizationSession, session_id)
        if not session:
            return False

        # Delete all prioritized ideas
        ideas = db.exec(
            select(PrioritizedIdea)
            .where(PrioritizedIdea.prioritization_session_id == session_id)
        ).all()
        for idea in ideas:
            db.delete(idea)

        db.delete(session)
        db.commit()
        return True


# Singleton instance
opportunity_linker_service = OpportunityLinkerService()
