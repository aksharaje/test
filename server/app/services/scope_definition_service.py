"""
Scope Definition Agent Service

Business logic for AI-powered scope definition workflow.
"""
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.scope_definition import (
    ScopeDefinitionSession,
    ScopeItem,
    ScopeAssumption,
    ScopeConstraint,
    ScopeDeliverable,
    ScopeDefinitionSessionCreate,
)
from openai import OpenAI


class ScopeDefinitionService:
    """Service for managing scope definition sessions"""

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
        import re

        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        content = content.strip()

        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        brace_idx = content.find('{')
        if brace_idx == -1:
            raise ValueError(f"{context}: No JSON object found in response")
        content = content[brace_idx:]

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            if content.startswith('{'):
                depth = 0
                for i, char in enumerate(content):
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(content[:i+1])
                            except json.JSONDecodeError:
                                break
            raise ValueError(f"{context}: Failed to parse JSON: {str(e)}")

    # ==================== SESSION MANAGEMENT ====================

    def create_session(self, db: Session, data: ScopeDefinitionSessionCreate) -> ScopeDefinitionSession:
        """Create a new scope definition session."""
        session = ScopeDefinitionSession(
            project_name=data.project_name,
            product_vision=data.product_vision,
            initial_requirements=data.initial_requirements,
            known_constraints=data.known_constraints,
            stakeholder_needs=data.stakeholder_needs,
            target_users=data.target_users,
            status="pending",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int) -> Optional[ScopeDefinitionSession]:
        """Get a session by ID."""
        return db.get(ScopeDefinitionSession, session_id)

    def list_sessions(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
    ) -> List[ScopeDefinitionSession]:
        """List sessions with pagination."""
        statement = (
            select(ScopeDefinitionSession)
            .order_by(desc(ScopeDefinitionSession.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(db.exec(statement).all())

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data."""
        session = db.get(ScopeDefinitionSession, session_id)
        if not session:
            return False

        # Delete related data
        for item in db.exec(select(ScopeItem).where(ScopeItem.session_id == session_id)).all():
            db.delete(item)
        for assumption in db.exec(select(ScopeAssumption).where(ScopeAssumption.session_id == session_id)).all():
            db.delete(assumption)
        for constraint in db.exec(select(ScopeConstraint).where(ScopeConstraint.session_id == session_id)).all():
            db.delete(constraint)
        for deliverable in db.exec(select(ScopeDeliverable).where(ScopeDeliverable.session_id == session_id)).all():
            db.delete(deliverable)

        db.delete(session)
        db.commit()
        return True

    # ==================== AI GENERATION ====================

    def generate_scope(self, db: Session, session_id: int) -> ScopeDefinitionSession:
        """Generate scope definition using AI."""
        session = db.get(ScopeDefinitionSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "generating"
            session.progress_message = "Analyzing requirements and defining scope..."
            session.updated_at = datetime.utcnow()
            db.commit()

            prompt = self._build_scope_prompt(session)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert project manager specializing in scope definition.
You help teams clearly define project boundaries, identify what's in and out of scope,
document assumptions and constraints, and define key deliverables.
Always respond with valid JSON only, no additional text or markdown."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=6000,
            )

            content = response.choices[0].message.content
            result = self._parse_llm_json(content, "Scope Generation")

            self._save_scope(db, session_id, result)

            session.status = "completed"
            session.scope_statement = result.get("scope_statement", "")
            session.executive_summary = result.get("executive_summary", "")
            session.completed_at = datetime.utcnow()
            session.updated_at = datetime.utcnow()
            session.progress_message = None
            db.commit()
            db.refresh(session)

            return session

        except Exception as e:
            session.status = "failed"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            db.commit()
            raise

    def _build_scope_prompt(self, session: ScopeDefinitionSession) -> str:
        """Build the prompt for scope generation."""
        prompt = f"""Define the scope for the following project.

## Project Name
{session.project_name}

## Product Vision
{session.product_vision}

## Initial Requirements
{session.initial_requirements or "Not specified - derive from vision"}

## Known Constraints
{session.known_constraints or "None specified"}

## Stakeholder Needs
{session.stakeholder_needs or "Not specified"}

## Target Users
{session.target_users or "Not specified"}

## Instructions
Create a comprehensive scope definition that includes:
1. Clear scope statement
2. In-scope items (categorized and prioritized using MoSCoW)
3. Out-of-scope items with rationale
4. Deferred items for future phases
5. Key assumptions with risk implications
6. Constraints with impact assessment
7. Key deliverables with acceptance criteria

Respond with JSON in this exact format:
{{
    "scope_statement": "A clear, concise statement defining what the project will deliver",
    "executive_summary": "Brief summary of the scope definition",
    "scope_items": [
        {{
            "title": "Item title",
            "description": "Detailed description",
            "category": "feature|integration|infrastructure|process",
            "scope_type": "in_scope|out_of_scope|deferred",
            "priority": "must_have|should_have|could_have|wont_have",
            "rationale": "Why included/excluded/deferred",
            "estimated_complexity": "low|medium|high",
            "dependencies": ["Dependency 1", "Dependency 2"]
        }}
    ],
    "assumptions": [
        {{
            "assumption": "The assumption statement",
            "category": "technical|business|resource|timeline",
            "risk_if_wrong": "What happens if this assumption is wrong",
            "validation_method": "How to validate this assumption",
            "confidence": "low|medium|high"
        }}
    ],
    "constraints": [
        {{
            "constraint": "The constraint statement",
            "category": "budget|timeline|resource|technical|regulatory",
            "impact": "How this affects the project",
            "flexibility": "fixed|negotiable|flexible",
            "mitigation_strategy": "How to work within this constraint"
        }}
    ],
    "deliverables": [
        {{
            "name": "Deliverable name",
            "description": "What will be delivered",
            "type": "document|software|service|integration",
            "acceptance_criteria": ["Criterion 1", "Criterion 2"],
            "target_milestone": "When this should be completed",
            "estimated_completion": "Estimated date/timeframe",
            "dependencies": ["Dependency 1"]
        }}
    ]
}}"""
        return prompt

    def _save_scope(self, db: Session, session_id: int, result: Dict[str, Any]) -> None:
        """Save generated scope to database."""
        # Save scope items
        for i, item_data in enumerate(result.get("scope_items", [])):
            item = ScopeItem(
                session_id=session_id,
                title=item_data.get("title", ""),
                description=item_data.get("description", ""),
                category=item_data.get("category", "feature"),
                scope_type=item_data.get("scope_type", "in_scope"),
                priority=item_data.get("priority"),
                rationale=item_data.get("rationale"),
                estimated_complexity=item_data.get("estimated_complexity"),
                dependencies=item_data.get("dependencies", []),
                display_order=i,
            )
            db.add(item)

        # Save assumptions
        for j, a_data in enumerate(result.get("assumptions", [])):
            assumption = ScopeAssumption(
                session_id=session_id,
                assumption=a_data.get("assumption", ""),
                category=a_data.get("category", "business"),
                risk_if_wrong=a_data.get("risk_if_wrong", ""),
                validation_method=a_data.get("validation_method"),
                confidence=a_data.get("confidence", "medium"),
                display_order=j,
            )
            db.add(assumption)

        # Save constraints
        for k, c_data in enumerate(result.get("constraints", [])):
            constraint = ScopeConstraint(
                session_id=session_id,
                constraint=c_data.get("constraint", ""),
                category=c_data.get("category", "technical"),
                impact=c_data.get("impact", ""),
                flexibility=c_data.get("flexibility", "negotiable"),
                mitigation_strategy=c_data.get("mitigation_strategy"),
                display_order=k,
            )
            db.add(constraint)

        # Save deliverables
        for l, d_data in enumerate(result.get("deliverables", [])):
            deliverable = ScopeDeliverable(
                session_id=session_id,
                name=d_data.get("name", ""),
                description=d_data.get("description", ""),
                type=d_data.get("type", "software"),
                acceptance_criteria=d_data.get("acceptance_criteria", []),
                target_milestone=d_data.get("target_milestone"),
                estimated_completion=d_data.get("estimated_completion"),
                dependencies=d_data.get("dependencies", []),
                display_order=l,
            )
            db.add(deliverable)

        db.commit()

    # ==================== DATA RETRIEVAL ====================

    def get_scope_items(self, db: Session, session_id: int) -> List[ScopeItem]:
        """Get all scope items for a session."""
        statement = (
            select(ScopeItem)
            .where(ScopeItem.session_id == session_id)
            .order_by(ScopeItem.display_order)
        )
        return list(db.exec(statement).all())

    def get_assumptions(self, db: Session, session_id: int) -> List[ScopeAssumption]:
        """Get all assumptions for a session."""
        statement = (
            select(ScopeAssumption)
            .where(ScopeAssumption.session_id == session_id)
            .order_by(ScopeAssumption.display_order)
        )
        return list(db.exec(statement).all())

    def get_constraints(self, db: Session, session_id: int) -> List[ScopeConstraint]:
        """Get all constraints for a session."""
        statement = (
            select(ScopeConstraint)
            .where(ScopeConstraint.session_id == session_id)
            .order_by(ScopeConstraint.display_order)
        )
        return list(db.exec(statement).all())

    def get_deliverables(self, db: Session, session_id: int) -> List[ScopeDeliverable]:
        """Get all deliverables for a session."""
        statement = (
            select(ScopeDeliverable)
            .where(ScopeDeliverable.session_id == session_id)
            .order_by(ScopeDeliverable.display_order)
        )
        return list(db.exec(statement).all())

    def retry_session(self, db: Session, session_id: int) -> ScopeDefinitionSession:
        """Retry a failed session."""
        session = db.get(ScopeDefinitionSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Clear existing data
        for item in db.exec(select(ScopeItem).where(ScopeItem.session_id == session_id)).all():
            db.delete(item)
        for assumption in db.exec(select(ScopeAssumption).where(ScopeAssumption.session_id == session_id)).all():
            db.delete(assumption)
        for constraint in db.exec(select(ScopeConstraint).where(ScopeConstraint.session_id == session_id)).all():
            db.delete(constraint)
        for deliverable in db.exec(select(ScopeDeliverable).where(ScopeDeliverable.session_id == session_id)).all():
            db.delete(deliverable)

        session.status = "pending"
        session.error_message = None
        session.scope_statement = None
        session.executive_summary = None
        session.completed_at = None
        session.updated_at = datetime.utcnow()
        db.commit()

        return self.generate_scope(db, session_id)
