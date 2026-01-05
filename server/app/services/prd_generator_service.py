import os
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.prd import GeneratedPrd, PrdTemplate
from app.services.knowledge_base_service import knowledge_base_service
from openai import OpenAI

DEFAULT_TEMPLATES = [
    {
        "name": "Default",
        "description": "A balanced PRD template suitable for most projects",
        "is_default": 1,
        "is_custom": 0,
        "system_prompt": """You are a Product Requirements Document (PRD) generator. Analyze the provided business requirements and create a comprehensive PRD.

The input may include:
- Bullet-pointed requirements
- User stories (As a [user], I want [goal], so that [benefit])
- Problem statements and desired outcomes
- High-level feature descriptions

Create a PRD with the following sections:

1. Purpose - Why this product/feature exists and what problem it solves (derived from the business requirements)
2. High Level Summary - Brief overview of the solution
3. Functional Requirements - Detailed list of what the product must do (expand on and organize the input requirements)
4. Business Value - Expected outcomes, ROI, and success metrics (align with the stated primary business objective if provided)
5. Dependencies - External systems, APIs, or resources needed
6. Acceptance Criteria - Conditions that must be met for the PRD to be considered complete

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "purpose", "title": "Purpose", "content": "..."},
    {"key": "summary", "title": "High Level Summary", "content": "..."},
    {"key": "functional_requirements", "title": "Functional Requirements", "content": "..."},
    {"key": "business_value", "title": "Business Value", "content": "..."},
    {"key": "dependencies", "title": "Dependencies", "content": "..."},
    {"key": "acceptance_criteria", "title": "Acceptance Criteria", "content": "..."}
  ]
}

Use markdown formatting within content fields. Include inline citations [1], [2] etc. when referencing knowledge base content."""
    },
    {
        "name": "Lean PRD",
        "description": "Minimal documentation for agile teams moving fast",
        "is_default": 0,
        "is_custom": 0,
        "system_prompt": """You are a Lean PRD generator focused on minimal viable documentation. Analyze the provided business requirements and create a concise PRD.

The input may include bullet-pointed requirements, user stories, problem statements, or feature descriptions. Distill these into:

1. Problem Statement - What problem are we solving? (derived from the business requirements)
2. Solution Overview - How will we solve it?
3. Success Metrics - How do we measure success? (align with primary business objective if provided)
4. MVP Scope - What's included in the first release?

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "problem", "title": "Problem Statement", "content": "..."},
    {"key": "solution", "title": "Solution Overview", "content": "..."},
    {"key": "metrics", "title": "Success Metrics", "content": "..."},
    {"key": "mvp_scope", "title": "MVP Scope", "content": "..."}
  ]
}

Keep sections brief and actionable. Include citations [1], [2] when referencing knowledge base content."""
    },
    {
        "name": "Technical Specification",
        "description": "Detailed technical requirements for engineering teams",
        "is_default": 0,
        "is_custom": 0,
        "system_prompt": """You are a Technical PRD generator for engineering teams. Analyze the provided business requirements and translate them into a detailed technical specification.

The input may include business requirements, user stories, or feature descriptions. Transform these into technical specifications:

1. Overview - Technical summary of the feature (based on the business requirements)
2. Architecture - System design and component interactions
3. API Specifications - Endpoints, payloads, and responses
4. Data Models - Database schemas and data structures
5. Non-Functional Requirements - Performance, security, scalability
6. Technical Dependencies - Libraries, services, infrastructure
7. Implementation Notes - Edge cases, considerations, risks

Format your response as valid JSON with this structure:
{
  "title": "Technical Spec: [Title]",
  "sections": [
    {"key": "overview", "title": "Overview", "content": "..."},
    {"key": "architecture", "title": "Architecture", "content": "..."},
    {"key": "api_specs", "title": "API Specifications", "content": "..."},
    {"key": "data_models", "title": "Data Models", "content": "..."},
    {"key": "nfr", "title": "Non-Functional Requirements", "content": "..."},
    {"key": "dependencies", "title": "Technical Dependencies", "content": "..."},
    {"key": "implementation", "title": "Implementation Notes", "content": "..."}
  ]
}

Use code blocks for technical content. Include citations [1], [2] when referencing knowledge base content."""
    },
    {
        "name": "Enterprise Format",
        "description": "Comprehensive documentation for enterprise stakeholders",
        "is_default": 0,
        "is_custom": 0,
        "system_prompt": """You are an Enterprise PRD generator for formal documentation. Analyze the provided business requirements and create a comprehensive PRD suitable for enterprise stakeholders.

The input may include business requirements, user stories, problem statements, or feature descriptions. Expand these into enterprise-grade documentation:

1. Executive Summary - High-level overview for leadership (synthesize the business requirements)
2. Business Objectives - Strategic goals and alignment (connect to the primary business objective if provided)
3. Scope & Boundaries - What's included and excluded
4. Stakeholder Analysis - Who is affected and their needs
5. Requirements - Functional and non-functional requirements (organize and expand the input requirements)
6. Risk Assessment - Potential risks and mitigations
7. Timeline & Milestones - Key deliverables and dates
8. Resource Requirements - Budget, team, infrastructure
9. Success Criteria - KPIs and acceptance criteria
10. Appendix - Supporting documentation and references

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "executive_summary", "title": "Executive Summary", "content": "..."},
    {"key": "business_objectives", "title": "Business Objectives", "content": "..."},
    {"key": "scope", "title": "Scope & Boundaries", "content": "..."},
    {"key": "stakeholders", "title": "Stakeholder Analysis", "content": "..."},
    {"key": "requirements", "title": "Requirements", "content": "..."},
    {"key": "risks", "title": "Risk Assessment", "content": "..."},
    {"key": "timeline", "title": "Timeline & Milestones", "content": "..."},
    {"key": "resources", "title": "Resource Requirements", "content": "..."},
    {"key": "success_criteria", "title": "Success Criteria", "content": "..."},
    {"key": "appendix", "title": "Appendix", "content": "..."}
  ]
}

Include citations [1], [2] when referencing knowledge base content."""
    },
    {
        "name": "User-Centric PRD",
        "description": "Focused on user journeys and experience design",
        "is_default": 0,
        "is_custom": 0,
        "system_prompt": """You are a User-Centric PRD generator focused on user experience. Analyze the provided business requirements from a user-centered perspective.

The input may include business requirements, user stories, problem statements, or feature descriptions. Transform these into user-focused documentation:

1. User Problem - Pain points and frustrations (extract from business requirements)
2. User Personas - Target users and their characteristics (use target persona if provided)
3. User Journeys - Key workflows and interactions
4. User Stories - Features written from user perspective (expand any provided user stories)
5. UX Requirements - Interface and experience guidelines
6. Usability Criteria - How we measure user success

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "user_problem", "title": "User Problem", "content": "..."},
    {"key": "personas", "title": "User Personas", "content": "..."},
    {"key": "journeys", "title": "User Journeys", "content": "..."},
    {"key": "stories", "title": "User Stories", "content": "..."},
    {"key": "ux_requirements", "title": "UX Requirements", "content": "..."},
    {"key": "usability", "title": "Usability Criteria", "content": "..."}
  ]
}

Include citations [1], [2] when referencing knowledge base content."""
    }
]

class PrdGeneratorService:
    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            from app.core.config import settings
            api_key = settings.OPENROUTER_API_KEY
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY environment variable is required")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    def ensure_default_templates(self, session: Session):
        existing = session.exec(select(PrdTemplate).where(PrdTemplate.is_default == 1)).all()
        if not existing:
            for tpl in DEFAULT_TEMPLATES:
                template = PrdTemplate(**tpl)
                session.add(template)
            session.commit()

    def get_templates(self, session: Session) -> List[PrdTemplate]:
        self.ensure_default_templates(session)
        return session.exec(select(PrdTemplate)).all()

    def get_template(self, session: Session, id: int) -> Optional[PrdTemplate]:
        return session.get(PrdTemplate, id)

    def get_knowledge_base_context(self, session: Session, kb_ids: List[int], query: str, limit: int = 8) -> Dict[str, Any]:
        if not kb_ids:
            return {"context": "", "citations": []}
        
        context_parts = []
        citations = []
        
        for kb_id in kb_ids:
            results = knowledge_base_service.search(session, kb_id, query, limit=limit)
            for i, r in enumerate(results):
                citation_id = len(citations) + 1
                citations.append({
                    "id": citation_id,
                    "type": "knowledge_base",
                    "source": r["documentName"],
                    "documentId": r["documentId"],
                    "content": r["content"][:500],
                    "similarity": r.get("similarity", 0)
                })
                context_parts.append(f"[{citation_id}] {r['content']}")
        
        context_text = ""
        if context_parts:
            context_text = "\\n\\nRelevant Knowledge Base Context:\\n" + "\\n\\n---\\n\\n".join(context_parts)
            
        return {"context": context_text, "citations": citations}

    def clean_json_response(self, response: str) -> str:
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    def create_prd(self, session: Session, request: Dict[str, Any], user_id: Optional[int] = None) -> GeneratedPrd:
        """Create PRD record in pending state"""
        # Get template
        template_id = request.get("templateId")
        template = None
        if template_id:
            template = self.get_template(session, template_id)

        if not template:
            self.ensure_default_templates(session)
            templates = self.get_templates(session)
            template = next((t for t in templates if t.is_default == 1), templates[0])

        prd = GeneratedPrd(
            user_id=user_id if user_id else request.get("userId"),
            title="Generating PRD...",
            content="",  # Empty content initially
            concept=request.get("concept", ""),
            target_project=request.get("targetProject"),
            target_persona=request.get("targetPersona"),
            industry_context=request.get("industryContext"),
            primary_metric=request.get("primaryMetric"),
            user_story_role=request.get("userStoryRole"),
            user_story_goal=request.get("userStoryGoal"),
            user_story_benefit=request.get("userStoryBenefit"),
            knowledge_base_ids=request.get("knowledgeBaseIds", []),
            input_files=request.get("files", []),
            template_id=template.id,
            status="pending",
            progress_step=0,
            progress_message="Starting generation...",
        )
        
        session.add(prd)
        session.commit()
        session.refresh(prd)
        return prd

    def run_prd_pipeline(self, session: Session, prd_id: int):
        """Async pipeline to generate PRD content"""
        try:
            start_time = time.time()
            from app.core.config import settings
            model = settings.OPENROUTER_MODEL
            
            prd = self.get_prd(session, prd_id)
            if not prd:
                return

            # Step 1: Preparation
            self._update_progress(session, prd_id, "processing", 1, "Analyzing requirements and context...")
            
            template = self.get_template(session, prd.template_id)
            if not template:
                raise ValueError("Template not found")

            # Step 2: Knowledge Base RAG
            kb_context = ""
            citations = []
            if prd.knowledge_base_ids:
                self._update_progress(session, prd_id, "processing", 2, "Searching knowledge bases...")
                kb_result = self.get_knowledge_base_context(session, prd.knowledge_base_ids, prd.concept)
                kb_context = kb_result["context"]
                citations = kb_result["citations"]

            # Step 3: Generation
            self._update_progress(session, prd_id, "processing", 3, "Generating comprehensive PRD...")
            
            # Build user prompt
            user_prompt = f"Generate a PRD based on the following business requirements:\\n\\n{prd.concept}"
            
            context_items = []
            if prd.target_project:
                context_items.append(f"Target Project/Team: {prd.target_project}")
            if prd.target_persona:
                context_items.append(f"Target Persona: {prd.target_persona}")
            if prd.industry_context:
                context_items.append(f"Industry: {prd.industry_context}")
            if prd.primary_metric:
                context_items.append(f"Primary Business Objective: {prd.primary_metric}")
                
            if context_items:
                context_str = '\\n'.join(context_items)
                user_prompt += f"\\n\\nContext:\\n{context_str}"
                
            if prd.user_story_role and prd.user_story_goal and prd.user_story_benefit:
                user_prompt += f"\\n\\nUser Story:\\nAs a {prd.user_story_role}, I want {prd.user_story_goal}, so that {prd.user_story_benefit}"
                
            if kb_context:
                user_prompt += kb_context
                
            # Call LLM
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": template.system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=8000,
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            raw_content = response.choices[0].message.content
            cleaned_content = self.clean_json_response(raw_content)
            
            try:
                structured_content = json.loads(cleaned_content)
            except json.JSONDecodeError as e:
                print(f"JSON Parse Error. Raw content: {raw_content}")
                raise ValueError(f"Failed to parse PRD response as JSON.")
                
            generation_time_ms = (time.time() - start_time) * 1000
            
            # Update PRD
            prd.title = structured_content.get("title", "Generated PRD")
            prd.content = cleaned_content
            prd.status = "draft"  # Or "completed" if you prefer
            prd.progress_step = 4
            prd.progress_message = "Generation complete!"
            prd.generation_metadata = {
                "model": model,
                "promptTokens": response.usage.prompt_tokens,
                "completionTokens": response.usage.completion_tokens,
                "generationTimeMs": generation_time_ms
            }
            prd.citations = citations
            prd.updated_at = datetime.utcnow()
            
            session.add(prd)
            session.commit()
            
        except Exception as e:
            print(f"PRD Generation Error: {str(e)}")
            import traceback
            traceback.print_exc()
            
            prd = self.get_prd(session, prd_id)
            if prd:
                prd.status = "failed"
                prd.error_message = str(e)
                session.add(prd)
                session.commit()

    def _update_progress(self, session: Session, prd_id: int, status: str, step: int, message: str):
        prd = self.get_prd(session, prd_id)
        if prd:
            prd.status = status
            prd.progress_step = step
            prd.progress_message = message
            prd.updated_at = datetime.utcnow()
            session.add(prd)
            session.commit()

    def refine(self, session: Session, request: Dict[str, Any]) -> GeneratedPrd:
        prd_id = request.get("prdId")
        prompt = request.get("prompt")
        
        original = session.get(GeneratedPrd, prd_id)
        if not original:
            raise ValueError("PRD not found")
            
        start_time = time.time()
        from app.core.config import settings
        model = settings.OPENROUTER_MODEL
        
        # Get template
        template = None
        if original.template_id:
            template = self.get_template(session, original.template_id)
        if not template:
            self.ensure_default_templates(session)
            templates = self.get_templates(session)
            template = next((t for t in templates if t.is_default == 1), templates[0])
            
        # Get fresh KB context
        kb_result = self.get_knowledge_base_context(session, original.knowledge_base_ids, original.concept)
        kb_context = kb_result["context"]
        new_citations = kb_result["citations"]
        
        refine_prompt = f"""Based on the following existing PRD and the modification request, please generate an updated PRD.

Current PRD:
{original.content}

Modification Request:
{prompt}
{kb_context}

Generate the complete updated PRD in the same JSON format."""

        # Call LLM
        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": template.system_prompt},
                {"role": "user", "content": refine_prompt}
            ],
            max_tokens=8000,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        cleaned_content = self.clean_json_response(raw_content)
        
        try:
            structured_content = json.loads(cleaned_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse refined PRD response as JSON: {str(e)}")
            
        generation_time_ms = (time.time() - start_time) * 1000
        
        # Update metadata
        metadata = original.generation_metadata or {}
        refine_history = metadata.get("refineHistory", [])
        refine_history.append({
            "prompt": prompt,
            "timestamp": datetime.utcnow().isoformat()
        })
        metadata["refineHistory"] = refine_history
        metadata.update({
            "model": model,
            "promptTokens": response.usage.prompt_tokens,
            "completionTokens": response.usage.completion_tokens,
            "generationTimeMs": generation_time_ms
        })
        
        # Update PRD
        original.title = structured_content.get("title", original.title)
        original.content = cleaned_content
        original.generation_metadata = metadata
        original.citations = (original.citations or []) + new_citations
        original.updated_at = datetime.utcnow()
        
        session.add(original)
        session.commit()
        session.refresh(original)
        
        return original

    def list_prds(self, session: Session, skip: int = 0, limit: int = 20, user_id: Optional[int] = None) -> List[GeneratedPrd]:
        query = select(GeneratedPrd)
        if user_id:
            query = query.where(GeneratedPrd.user_id == user_id)
        query = query.order_by(desc(GeneratedPrd.created_at)).offset(skip).limit(limit)
        return session.exec(query).all()

    def get_prd(self, session: Session, id: int, user_id: Optional[int] = None) -> Optional[GeneratedPrd]:
        prd = session.get(GeneratedPrd, id)
        if prd and user_id and prd.user_id and prd.user_id != user_id:
            return None
        return prd

    def update_prd(self, session: Session, id: int, data: Dict[str, Any], user_id: Optional[int] = None) -> Optional[GeneratedPrd]:
        prd = session.get(GeneratedPrd, id)
        if not prd:
            return None

        # Check user_id scoping
        if user_id and prd.user_id and prd.user_id != user_id:
            return None

        for key, value in data.items():
            setattr(prd, key, value)

        prd.updated_at = datetime.utcnow()
        session.add(prd)
        session.commit()
        session.refresh(prd)
        return prd

    def delete_prd(self, session: Session, id: int, user_id: Optional[int] = None) -> bool:
        prd = session.get(GeneratedPrd, id)
        if not prd:
            return False

        # Check user_id scoping
        if user_id and prd.user_id and prd.user_id != user_id:
            return False

        session.delete(prd)
        session.commit()
        return True

    def retry_prd(self, session: Session, id: int, user_id: Optional[int] = None) -> Optional[GeneratedPrd]:
        """Reset failed PRD to pending for retry"""
        prd = self.get_prd(session, id, user_id=user_id)
        if not prd:
            return None

        # Reset state
        prd.status = "pending"
        prd.error_message = None
        prd.progress_step = 0
        prd.progress_message = "Retrying generation..."
        prd.updated_at = datetime.utcnow()

        session.add(prd)
        session.commit()
        session.refresh(prd)

        return prd

prd_generator_service = PrdGeneratorService()
