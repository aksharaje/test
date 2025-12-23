"""
Ideation Service

Business logic for AI-powered ideation workflow.
"""
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.ideation import IdeationSession, GeneratedIdea, IdeaCluster
from app.services.embedding_service import embedding_service
from openai import OpenAI


class IdeationService:
    """Service for managing ideation sessions and SMART goals"""

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

        Args:
            content: Raw LLM response text
            context: Description of what's being parsed (for error messages)

        Returns:
            Parsed JSON object

        Raises:
            ValueError: If JSON cannot be parsed
        """
        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        # Remove markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(line for line in lines[1:-1] if not line.startswith("```"))

        # Clean up whitespace
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

            # Warn if there's significant trailing content
            remaining = content[end_idx:].strip()
            if remaining and len(remaining) > 10:
                print(f"WARNING: {context} had trailing content after JSON: {remaining[:100]}")

            return obj
        except json.JSONDecodeError as e:
            print(f"ERROR: {context} - Failed to parse JSON. Content: {content[:500]}")
            print(f"ERROR: JSONDecodeError: {str(e)}")
            raise ValueError(f"{context}: LLM returned invalid JSON - {str(e)}")

    # --- Session Management ---

    def create_session(
        self,
        session: Session,
        problem_statement: str,
        constraints: Optional[str] = None,
        goals: Optional[str] = None,
        research_insights: Optional[str] = None,
        knowledge_base_ids: Optional[List[int]] = None,
        user_id: Optional[int] = None
    ) -> IdeationSession:
        """Create new ideation session"""
        confidence = self._assess_confidence(problem_statement, constraints, goals, research_insights)

        ideation_session = IdeationSession(
            user_id=user_id,
            problem_statement=problem_statement,
            constraints=constraints,
            goals=goals,
            research_insights=research_insights,
            knowledge_base_ids=knowledge_base_ids,
            status="pending",
            progress_step=0,
            progress_message="Session created, starting processing...",
            confidence=confidence
        )

        session.add(ideation_session)
        session.commit()
        session.refresh(ideation_session)
        return ideation_session

    def _assess_confidence(self, problem: str, constraints: Optional[str], goals: Optional[str], insights: Optional[str]) -> str:
        """Assess input confidence level"""
        score = 0
        if len(problem) >= 200:
            score += 2
        elif len(problem) >= 100:
            score += 1

        if constraints and len(constraints) >= 50:
            score += 1
        if goals and len(goals) >= 50:
            score += 1
        if insights and len(insights) >= 50:
            score += 1

        if score >= 4:
            return "high"
        elif score >= 2:
            return "medium"
        else:
            return "low"

    def get_session(self, session: Session, session_id: int) -> Optional[IdeationSession]:
        """Get session by ID"""
        return session.get(IdeationSession, session_id)

    def list_sessions(self, session: Session, user_id: Optional[int] = None) -> List[IdeationSession]:
        """List sessions for user"""
        query = select(IdeationSession)
        if user_id:
            query = query.where(IdeationSession.user_id == user_id)
        query = query.order_by(desc(IdeationSession.created_at))
        return list(session.exec(query).all())

    def get_session_detail(self, session: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get session with clusters, ideas, and prioritized backlog"""
        ideation_session = self.get_session(session, session_id)
        if not ideation_session:
            return None

        # Get clusters
        clusters_data = list(session.exec(
            select(IdeaCluster)
            .where(IdeaCluster.session_id == session_id)
            .order_by(IdeaCluster.cluster_number)
        ).all())

        # Get final ideas
        ideas_data = list(session.exec(
            select(GeneratedIdea)
            .where(GeneratedIdea.session_id == session_id)
            .where(GeneratedIdea.is_final == True)
            .order_by(GeneratedIdea.display_order)
        ).all())

        # Group ideas by cluster
        clusters_response = []
        for cluster in clusters_data:
            cluster_ideas = [idea for idea in ideas_data if idea.cluster_id == cluster.id]
            clusters_response.append({
                "id": cluster.id,
                "clusterNumber": cluster.cluster_number,
                "themeName": cluster.theme_name,
                "themeDescription": cluster.theme_description,
                "ideaCount": len(cluster_ideas),
                "ideas": cluster_ideas
            })

        response = {
            "session": ideation_session,
            "clusters": clusters_response,
            "ideas": ideas_data
        }

        # If prioritization session exists, include prioritized backlog
        if ideation_session.prioritization_session_id:
            from app.services.opportunity_linker_service import opportunity_linker_service
            prioritization_detail = opportunity_linker_service.get_session_detail(
                session, ideation_session.prioritization_session_id
            )
            if prioritization_detail:
                response["prioritizedBacklog"] = prioritization_detail

        return response

    def update_idea(self, session: Session, idea_id: int, data: Dict[str, Any]) -> Optional[GeneratedIdea]:
        """Update idea fields"""
        idea = session.get(GeneratedIdea, idea_id)
        if not idea:
            return None

        for key, value in data.items():
            if hasattr(idea, key):
                setattr(idea, key, value)

        idea.updated_at = datetime.utcnow()
        session.add(idea)
        session.commit()
        session.refresh(idea)
        return idea

    def delete_session(self, session: Session, session_id: int) -> bool:
        """Delete session and all related data"""
        ideation_session = self.get_session(session, session_id)
        if not ideation_session:
            return False

        # Delete ideas and clusters
        for idea in session.exec(select(GeneratedIdea).where(GeneratedIdea.session_id == session_id)):
            session.delete(idea)

        for cluster in session.exec(select(IdeaCluster).where(IdeaCluster.session_id == session_id)):
            session.delete(cluster)

        session.delete(ideation_session)
        session.commit()
        return True

    # --- MAIN PIPELINE ---

    def run_ideation_pipeline(self, session: Session, session_id: int):
        """
        Main async pipeline: 7 steps
        1. Parse input → structured problem
        2. Generate 18 ideas (4 categories)
        3. Create embeddings & cluster into 3-5 themes
        4. Enrich with use cases, edge cases, notes
        5. Score on 5 criteria
        6. Deduplicate to 15-16 final ideas
        """
        try:
            start_time = time.time()
            ideation_session = self.get_session(session, session_id)
            if not ideation_session:
                return

            # Step 1: Parse Input
            self._update_progress(session, session_id, "parsing", 1, "Analyzing problem statement...")
            structured_problem = self._parse_input(ideation_session)
            ideation_session.structured_problem = structured_problem
            session.add(ideation_session)
            session.commit()

            # Step 1.5: Knowledge Base RAG (if KB IDs provided)
            kb_context = None
            if ideation_session.knowledge_base_ids:
                self._update_progress(session, session_id, "searching", 1, "Fetching relevant context from knowledge bases...")
                kb_context = self._augment_with_kb_rag(session, ideation_session.knowledge_base_ids, structured_problem)
                if kb_context:
                    # Add KB context to metadata
                    meta = ideation_session.generation_metadata or {}
                    meta["kb_rag_performed"] = True
                    meta["kb_context_length"] = len(kb_context)
                    meta["kb_count"] = len(ideation_session.knowledge_base_ids)
                    ideation_session.generation_metadata = meta
                    session.add(ideation_session)
                    session.commit()

            # Step 2: Generate Ideas
            self._update_progress(session, session_id, "generating", 2, "Generating ideas across categories...")
            ideas = self._generate_ideas(session, session_id, structured_problem, kb_context)

            # Step 3: Cluster Ideas
            self._update_progress(session, session_id, "clustering", 3, "Clustering ideas into themes...")
            clusters = self._cluster_ideas(session, session_id, ideas)

            # Step 4: Enrich Ideas
            self._update_progress(session, session_id, "enriching", 4, "Enriching ideas with use cases...")
            self._enrich_ideas(session, session_id, structured_problem)

            # Step 5: Score Ideas
            self._update_progress(session, session_id, "scoring", 5, "Scoring ideas on multiple criteria...")
            self._score_ideas(session, session_id, structured_problem)

            # Step 6: Deduplicate
            self._update_progress(session, session_id, "deduplicating", 6, "Removing duplicate ideas...")
            final_count = self._deduplicate_ideas(session, session_id)

            # Mark ideation phase as completed BEFORE triggering opportunity linker
            ideation_session = self.get_session(session, session_id)
            ideation_session.status = "completed"
            ideation_session.completed_at = datetime.utcnow()
            ideation_session.progress_step = 7
            ideation_session.progress_message = "Starting opportunity mapping and prioritization..."
            generation_time_ms = (time.time() - start_time) * 1000
            ideation_session.generation_metadata = {
                "generation_time_ms": generation_time_ms,
                "final_idea_count": final_count
            }
            session.add(ideation_session)
            session.commit()

            # Step 7: Automatically trigger Opportunity Linker (Prioritization)
            # DO NOT call _update_progress here - it would overwrite status to "prioritizing"

            from app.services.opportunity_linker_service import opportunity_linker_service

            # Create prioritization session (ideation must be completed first)
            prioritization_session = opportunity_linker_service.create_session(
                db=session,
                ideation_session_id=session_id,
                user_id=ideation_session.user_id
            )

            # Store the prioritization session ID and update final message
            ideation_session = self.get_session(session, session_id)
            ideation_session.prioritization_session_id = prioritization_session.id
            ideation_session.progress_message = f"Complete! Generated {final_count} prioritized ideas with backlog."
            session.add(ideation_session)
            session.commit()

            # Process prioritization in the same flow
            opportunity_linker_service.process_session(session, prioritization_session.id)

        except Exception as e:
            print(f"Ideation pipeline error: {str(e)}")
            import traceback
            traceback.print_exc()

            ideation_session = self.get_session(session, session_id)
            if ideation_session:
                ideation_session.status = "failed"
                ideation_session.error_message = str(e)
                session.add(ideation_session)
                session.commit()

    def _update_progress(self, session: Session, session_id: int, status: str, step: int, message: str):
        """Update session progress"""
        ideation_session = self.get_session(session, session_id)
        if ideation_session:
            ideation_session.status = status
            ideation_session.progress_step = step
            ideation_session.progress_message = message
            ideation_session.updated_at = datetime.utcnow()
            session.add(ideation_session)
            session.commit()

    # --- Agent Implementations ---

    def _parse_input(self, ideation_session: IdeationSession) -> Dict[str, Any]:
        """Extract structured problem from user input"""
        system_prompt = """You are a problem analysis expert. Extract structured information from the user's problem statement.

CRITICAL FORMATTING RULES:
- Output ONLY the JSON object - NO explanations, NO markdown, NO extra text before or after
- All field values MUST be strings or arrays of strings as specified
- Arrays must contain at least one item if the field exists in input, otherwise use empty array []

REQUIRED JSON STRUCTURE (copy this format exactly):
{
  "who": "string describing who is affected by this problem",
  "what": "string describing the core problem or need",
  "why": "string explaining the underlying reason or motivation",
  "impact": "string describing expected impact if solved",
  "affects": "string listing stakeholders/users affected",
  "constraints_parsed": ["constraint1", "constraint2"],
  "goals_parsed": ["goal1", "goal2"],
  "insights_parsed": ["insight1", "insight2"]
}

EXAMPLE OUTPUT:
{
  "who": "Product managers and developers",
  "what": "Need to prioritize feature requests efficiently",
  "why": "Current manual process is time-consuming and inconsistent",
  "impact": "Save 10 hours per week and improve prioritization accuracy",
  "affects": "Product teams, engineering teams, stakeholders",
  "constraints_parsed": ["Must integrate with existing tools", "Limited budget"],
  "goals_parsed": ["Reduce prioritization time by 50%", "Increase stakeholder satisfaction"],
  "insights_parsed": ["Users prefer visual interfaces", "Data-driven scoring is valued"]
}"""

        user_content = f"""Problem Statement: {ideation_session.problem_statement}

"""
        if ideation_session.constraints:
            user_content += f"Constraints: {ideation_session.constraints}\n\n"
        if ideation_session.goals:
            user_content += f"Goals: {ideation_session.goals}\n\n"
        if ideation_session.research_insights:
            user_content += f"Research Insights: {ideation_session.research_insights}\n\n"

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            max_tokens=2000,
            temperature=0.2,  # Lower temperature for structured output
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        return self._parse_llm_json(content, "Problem Parser (Agent 1)")

    def _augment_with_kb_rag(self, session: Session, kb_ids: List[int], structured_problem: Dict[str, Any]) -> Optional[str]:
        """Fetch relevant context from knowledge bases using RAG"""
        if not kb_ids:
            return None

        from app.services.knowledge_base_service import knowledge_base_service

        query = structured_problem.get('what', '')
        if not query:
            return None

        context_parts = []
        for kb_id in kb_ids:
            try:
                # Search each KB for relevant chunks (top 5 per KB)
                results = knowledge_base_service.search(session, kb_id, query, limit=5, threshold=0.7)
                for result in results:
                    # Format: [Document: name] content
                    context_parts.append(f"[From: {result['documentName']}]\n{result['content']}")
            except Exception as e:
                print(f"Error searching KB {kb_id}: {str(e)}")
                continue

        if not context_parts:
            return None

        # Join all context with separators
        return "\n\n---\n\n".join(context_parts)

    def _generate_ideas(self, session: Session, session_id: int, structured_problem: Dict[str, Any], kb_context: Optional[str] = None) -> List[GeneratedIdea]:
        """Generate 18 ideas across 4 categories"""
        system_prompt = """You are an innovation strategist. Generate creative, diverse ideas to solve the problem.

CRITICAL FORMATTING RULES:
- Output ONLY the JSON object - NO explanations, NO markdown, NO extra text
- Generate EXACTLY 18 ideas total (count them!)
- Each field MUST use the exact values specified below - NO variations

REQUIRED DISTRIBUTION (EXACTLY these counts):
- Quick Wins: EXACTLY 4 ideas (low effort, immediate impact, tactical)
- Strategic Bets: EXACTLY 5 ideas (higher effort, transformational potential, strategic)
- Incremental: EXACTLY 5 ideas (gradual improvements to existing approaches)
- Moonshots: EXACTLY 4 ideas (ambitious, high-risk, high-reward, innovative)

REQUIRED JSON STRUCTURE:
{
  "ideas": [
    {
      "title": "string (5-10 words, clear and specific)",
      "description": "string (2-3 sentences with concrete details)",
      "category": "quick_wins|strategic_bets|incremental|moonshots",
      "effort_estimate": "low|medium|high",
      "impact_estimate": "low|medium|high"
    }
  ]
}

EXAMPLE OUTPUT (showing 3 of 18):
{
  "ideas": [
    {
      "title": "Automated Priority Scoring Dashboard",
      "description": "Build a dashboard that automatically scores features using predefined criteria. Users can see real-time priority rankings and adjust weights. Integrates with existing project management tools via API.",
      "category": "quick_wins",
      "effort_estimate": "low",
      "impact_estimate": "medium"
    },
    {
      "title": "AI-Powered Opportunity Analyzer",
      "description": "Develop an AI system that analyzes market data, customer feedback, and competitive intelligence to surface high-value opportunities. Uses machine learning to predict feature success rates. Provides strategic recommendations with confidence scores.",
      "category": "strategic_bets",
      "effort_estimate": "high",
      "impact_estimate": "high"
    },
    {
      "title": "Quantum-Enhanced Prediction Engine",
      "description": "Leverage quantum computing to model complex market dynamics and predict product-market fit with unprecedented accuracy. Simulates thousands of scenarios simultaneously. Revolutionary approach to strategic planning.",
      "category": "moonshots",
      "effort_estimate": "high",
      "impact_estimate": "high"
    }
  ]
}"""

        user_content = f"""Problem Analysis:
Who: {structured_problem.get('who')}
What: {structured_problem.get('what')}
Why: {structured_problem.get('why')}
Impact: {structured_problem.get('impact')}
Constraints: {', '.join(structured_problem.get('constraints_parsed', []))}
Goals: {', '.join(structured_problem.get('goals_parsed', []))}"""

        if kb_context:
            user_content += f"\n\nRelevant Knowledge Base Context:\n{kb_context}"

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            max_tokens=4000,
            temperature=0.7,  # Slightly lower for better format compliance
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        parsed = self._parse_llm_json(content, "Idea Generator (Agent 2)")

        # Save ideas to DB
        ideas = []
        for idx, idea_data in enumerate(parsed.get("ideas", [])):
            idea = GeneratedIdea(
                session_id=session_id,
                title=idea_data["title"],
                description=idea_data["description"],
                category=idea_data["category"],
                effort_estimate=idea_data["effort_estimate"],
                impact_estimate=idea_data["impact_estimate"],
                display_order=idx
            )
            session.add(idea)
            ideas.append(idea)

        session.commit()
        for idea in ideas:
            session.refresh(idea)

        return ideas

    def _cluster_ideas(self, session: Session, session_id: int, ideas: List[GeneratedIdea]) -> List[IdeaCluster]:
        """Cluster ideas using embeddings"""
        # Generate embeddings
        texts = [f"{idea.title}\n{idea.description}" for idea in ideas]
        embeddings = embedding_service.generate_embeddings(texts, model="text-embedding-3-small", dimensions=1536)

        # Save embeddings
        for idea, embedding in zip(ideas, embeddings):
            idea.embedding = embedding
            session.add(idea)
        session.commit()

        # Perform clustering
        import numpy as np
        from sklearn.cluster import AgglomerativeClustering

        X = np.array(embeddings)
        n_clusters = min(5, max(3, len(ideas) // 4))

        clustering = AgglomerativeClustering(n_clusters=n_clusters, metric='cosine', linkage='average')
        labels = clustering.fit_predict(X)

        # Create clusters
        clusters = []
        for i in range(n_clusters):
            cluster_ideas = [ideas[j] for j in range(len(ideas)) if labels[j] == i]

            # Generate theme name
            theme_name = f"Theme {i+1}: {cluster_ideas[0].category.replace('_', ' ').title()}"

            cluster = IdeaCluster(
                session_id=session_id,
                cluster_number=i + 1,
                theme_name=theme_name,
                idea_count=len(cluster_ideas)
            )
            session.add(cluster)
            session.commit()
            session.refresh(cluster)

            # Assign ideas to cluster
            for idea in cluster_ideas:
                idea.cluster_id = cluster.id
                session.add(idea)

            clusters.append(cluster)

        session.commit()
        return clusters

    def _enrich_ideas(self, session: Session, session_id: int, structured_problem: Dict[str, Any]):
        """Enrich each idea with use cases, edge cases, implementation notes using LLM"""
        ideas = list(session.exec(
            select(GeneratedIdea).where(GeneratedIdea.session_id == session_id)
        ).all())

        for idea in ideas:
            # Full LLM-based enrichment
            system_prompt = """You are enriching a product idea with practical implementation details.

CRITICAL FORMATTING RULES:
- Output ONLY the JSON object - NO explanations, NO markdown, NO extra text
- Each array MUST contain EXACTLY 3 items (count them!)
- Each item must be a complete, specific, actionable string

REQUIRED JSON STRUCTURE:
{
  "use_cases": [
    "Concrete use case 1 with specific user scenario and outcome",
    "Concrete use case 2 with specific user scenario and outcome",
    "Concrete use case 3 with specific user scenario and outcome"
  ],
  "edge_cases": [
    "Edge case 1 with specific problem and mitigation strategy",
    "Edge case 2 with specific problem and mitigation strategy",
    "Edge case 3 with specific problem and mitigation strategy"
  ],
  "implementation_notes": [
    "Technical/architectural consideration with specifics",
    "Resource/timeline consideration with estimates",
    "Risk/dependency consideration with mitigation"
  ]
}

EXAMPLE OUTPUT:
{
  "use_cases": [
    "Product manager reviews prioritized backlog in weekly planning meeting, exports top 10 items to Jira with single click, saving 30 minutes of manual data entry",
    "Engineering lead filters ideas by technical feasibility score during sprint planning, identifies quick wins that can fit in current sprint, improves sprint throughput by 15%",
    "Executive stakeholder views portfolio-level priority distribution in quarterly review, makes data-driven resource allocation decisions, increases strategic alignment"
  ],
  "edge_cases": [
    "When two ideas have identical scores, system maintains stable sort order by creation timestamp and displays tie-breaker badge to users for transparency",
    "When integrations are unavailable, system queues export requests with retry logic and notifies users via email when completed, preventing data loss",
    "When user modifies scoring weights mid-session, system recalculates all scores asynchronously and shows loading state to prevent stale data confusion"
  ],
  "implementation_notes": [
    "Use PostgreSQL materialized views for score calculations to handle 10k+ ideas efficiently, refresh on insert/update triggers",
    "Estimated 2-3 sprints for MVP with 1 backend dev and 1 frontend dev, requires existing API infrastructure",
    "Dependency on stable OpenRouter API availability, implement circuit breaker pattern and fallback to rule-based scoring if API fails"
  ]
}"""

            user_content = f"""Problem Context:
Who: {structured_problem.get('who')}
What: {structured_problem.get('what')}
Why: {structured_problem.get('why')}
Constraints: {', '.join(structured_problem.get('constraints_parsed', []))}

Idea to Enrich:
Title: {idea.title}
Description: {idea.description}
Category: {idea.category}
Effort Estimate: {idea.effort_estimate}
Impact Estimate: {idea.impact_estimate}

Generate specific, actionable enrichment for this idea."""

            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    max_tokens=2000,
                    temperature=0.4,  # Lower for more consistent structure
                    response_format={"type": "json_object"},
                    timeout=60.0  # 60 second timeout
                )

                content = response.choices[0].message.content
                enrichment = self._parse_llm_json(content, f"Enrichment (Agent 4) - Idea {idea.id}")

                # Validate the response has the required fields
                if not enrichment.get("use_cases") or not enrichment.get("edge_cases"):
                    print(f"Warning: Enrichment missing fields for idea {idea.id}. Response: {content[:200]}")
                    raise ValueError("Missing required fields in enrichment response")

                idea.use_cases = enrichment.get("use_cases", [])
                idea.edge_cases = enrichment.get("edge_cases", [])
                idea.implementation_notes = enrichment.get("implementation_notes", [])

            except json.JSONDecodeError as e:
                print(f"JSON decode error for idea {idea.id}: {str(e)}")
                print(f"Raw content: {content[:500]}")
                # Fallback to template if JSON parsing fails
                idea.use_cases = [f"Detailed use case for {idea.title} with specific scenarios"]
                idea.edge_cases = [f"Edge case considerations for {idea.category} implementation"]
                idea.implementation_notes = [f"Implementation requires {idea.effort_estimate} effort with technical planning"]
            except Exception as e:
                print(f"Enrichment error for idea {idea.id}: {type(e).__name__}: {str(e)}")
                # Fallback to template if LLM fails
                idea.use_cases = [f"Detailed use case for {idea.title} with specific scenarios"]
                idea.edge_cases = [f"Edge case considerations for {idea.category} implementation"]
                idea.implementation_notes = [f"Implementation requires {idea.effort_estimate} effort with technical planning"]

            session.add(idea)

        session.commit()

    def _score_ideas(self, session: Session, session_id: int, structured_problem: Dict[str, Any]):
        """Score each idea on 5 criteria using LLM analysis"""
        ideas = list(session.exec(
            select(GeneratedIdea).where(GeneratedIdea.session_id == session_id)
        ).all())

        for idea in ideas:
            # Full LLM-based scoring
            system_prompt = """You are an evaluation expert. Score this idea objectively on 5 criteria using a 1-10 scale.

CRITICAL FORMATTING RULES:
- Output ONLY the JSON object - NO explanations, NO markdown, NO extra text
- Score values MUST be integers from 1 to 10 (not decimals, not strings, not ranges)
- Rationale MUST be 1-2 complete sentences with specific reasoning

REQUIRED JSON STRUCTURE:
{
  "impact": {
    "score": <integer 1-10>,
    "rationale": "1-2 sentences explaining user/business impact with specifics"
  },
  "feasibility": {
    "score": <integer 1-10>,
    "rationale": "1-2 sentences explaining technical/organizational feasibility"
  },
  "effort": {
    "score": <integer 1-10>,
    "rationale": "1-2 sentences. HIGHER score = LESS effort (10=hours, 1=months)"
  },
  "strategic_fit": {
    "score": <integer 1-10>,
    "rationale": "1-2 sentences explaining alignment to problem statement and goals"
  },
  "risk": {
    "score": <integer 1-10>,
    "rationale": "1-2 sentences. HIGHER score = LESS risk (10=minimal risk, 1=high risk)"
  }
}

SCORING CALIBRATION (use these ranges):
- Impact: 1-3=minimal benefit, 4-6=moderate improvement, 7-8=high value, 9-10=transformational
- Feasibility: 1-3=major barriers, 4-6=significant challenges, 7-8=doable with effort, 9-10=straightforward
- Effort: 1-3=many months, 4-6=several weeks, 7-8=few days, 9-10=hours
- Strategic Fit: 1-3=tangential, 4-6=somewhat related, 7-8=well aligned, 9-10=perfect match
- Risk: 1-3=high risk/unknowns, 4-6=moderate risk, 7-8=low risk, 9-10=minimal risk

EXAMPLE OUTPUT:
{
  "impact": {
    "score": 8,
    "rationale": "Directly addresses the core prioritization problem with data-driven approach. Could save teams 10+ hours per week and improve decision quality significantly."
  },
  "feasibility": {
    "score": 7,
    "rationale": "Requires integration with existing systems and ML expertise, but all components are proven technology. Some organizational change management needed."
  },
  "effort": {
    "score": 5,
    "rationale": "Estimated 6-8 weeks with dedicated team of 2-3 developers. Requires backend API development, frontend UI, and integration work."
  },
  "strategic_fit": {
    "score": 9,
    "rationale": "Perfectly aligned with stated goal of improving prioritization efficiency. Directly enables core product management workflow improvements."
  },
  "risk": {
    "score": 7,
    "rationale": "Main risk is user adoption and change management. Technical risks are low given mature technology stack and proven patterns."
  }
}"""

            user_content = f"""Problem Context:
Who: {structured_problem.get('who')}
What: {structured_problem.get('what')}
Why: {structured_problem.get('why')}
Goals: {', '.join(structured_problem.get('goals_parsed', []))}
Constraints: {', '.join(structured_problem.get('constraints_parsed', []))}

Idea to Score:
Title: {idea.title}
Description: {idea.description}
Category: {idea.category}

Use Cases:
{chr(10).join('- ' + uc for uc in idea.use_cases) if idea.use_cases else 'None yet'}

Edge Cases:
{chr(10).join('- ' + ec for ec in idea.edge_cases) if idea.edge_cases else 'None yet'}

Implementation Notes:
{chr(10).join('- ' + note for note in idea.implementation_notes) if idea.implementation_notes else 'None yet'}

Score this idea objectively across all 5 criteria."""

            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    max_tokens=1500,
                    temperature=0.2,  # Lower for consistent numerical scoring
                    response_format={"type": "json_object"}
                )

                content = response.choices[0].message.content
                scores = self._parse_llm_json(content, f"Scoring (Agent 5) - Idea {idea.id}")

                idea.impact_score = float(scores["impact"]["score"])
                idea.impact_rationale = scores["impact"]["rationale"]

                idea.feasibility_score = float(scores["feasibility"]["score"])
                idea.feasibility_rationale = scores["feasibility"]["rationale"]

                idea.effort_score = float(scores["effort"]["score"])
                idea.effort_rationale = scores["effort"]["rationale"]

                idea.strategic_fit_score = float(scores["strategic_fit"]["score"])
                idea.strategic_fit_rationale = scores["strategic_fit"]["rationale"]

                idea.risk_score = float(scores["risk"]["score"])
                idea.risk_rationale = scores["risk"]["rationale"]

            except Exception as e:
                print(f"Scoring error for idea {idea.id}: {str(e)}")
                # Fallback to simple scoring
                effort_map = {"low": 8, "medium": 6, "high": 4}
                impact_map = {"low": 4, "medium": 6, "high": 8}
                idea.impact_score = float(impact_map.get(idea.impact_estimate, 6))
                idea.impact_rationale = f"Fallback: {idea.impact_estimate} impact"
                idea.feasibility_score = 7.0
                idea.feasibility_rationale = "Fallback: standard feasibility"
                idea.effort_score = float(effort_map.get(idea.effort_estimate, 6))
                idea.effort_rationale = f"Fallback: {idea.effort_estimate} effort"
                idea.strategic_fit_score = 7.0
                idea.strategic_fit_rationale = "Fallback: aligned to problem"
                idea.risk_score = 7.0
                idea.risk_rationale = "Fallback: moderate risk"

            # Calculate composite score (weighted average)
            idea.composite_score = (
                idea.impact_score * 0.3 +        # 30% weight
                idea.strategic_fit_score * 0.25 + # 25% weight
                idea.feasibility_score * 0.2 +   # 20% weight
                idea.effort_score * 0.15 +       # 15% weight
                idea.risk_score * 0.1            # 10% weight
            )

            session.add(idea)

        session.commit()

    def _deduplicate_ideas(self, session: Session, session_id: int) -> int:
        """Remove semantic duplicates"""
        ideas = list(session.exec(
            select(GeneratedIdea)
            .where(GeneratedIdea.session_id == session_id)
            .order_by(desc(GeneratedIdea.composite_score))
        ).all())

        # Calculate pairwise similarities
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity

        embeddings = [idea.embedding for idea in ideas]
        X = np.array(embeddings)
        sim_matrix = cosine_similarity(X)

        # Mark duplicates
        marked_duplicates = set()
        for i in range(len(ideas)):
            if i in marked_duplicates:
                continue
            for j in range(i + 1, len(ideas)):
                if j in marked_duplicates:
                    continue
                if sim_matrix[i, j] > 0.90:
                    ideas[j].is_duplicate = True
                    ideas[j].duplicate_of_id = ideas[i].id
                    ideas[j].is_final = False
                    marked_duplicates.add(j)
                    session.add(ideas[j])

        session.commit()

        final_ideas = [idea for idea in ideas if idea.is_final]
        return len(final_ideas)


ideation_service = IdeationService()
