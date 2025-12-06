from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc, func, col
from app.models.optimize import SplitTest, PromptVersion, AgentExecution
from app.models.agent import Agent
from app.models.story_generator import GeneratedArtifact, PromptTemplate, StoryGeneratorSplitTest, GenerationFeedback
from app.models.feedback import Feedback
from app.core.db import engine

class OptimizeService:
    def get_all_flows_with_stats(self, session: Session) -> List[Dict[str, Any]]:
        flows = []
        
        # 1. Get Agents
        agents = session.exec(select(Agent)).all()
        for agent in agents:
            stats = self._get_agent_feedback_stats(session, agent.id)
            flows.append({
                "id": f"agent:{agent.id}",
                "type": "agent",
                "name": agent.name,
                "description": agent.description,
                "feedbackStats": stats
            })
            
        # 2. Get Story Generators (Epic, Feature, User Story)
        types = ["epic", "feature", "user_story"]
        names = {
            "epic": "Story Generator: Epic",
            "feature": "Story Generator: Feature",
            "user_story": "Story Generator: User Story"
        }
        
        for type_ in types:
            stats = self._get_story_gen_feedback_stats(session, type_)
            flows.append({
                "id": f"story_generator:{type_}",
                "type": f"story_generator_{type_}",
                "name": names[type_],
                "description": f"Generates {type_.replace('_', ' ').title()}s with A/B testing",
                "feedbackStats": stats
            })
            
        return flows

    def get_flow_details(self, session: Session, flow_id: str) -> Optional[Dict[str, Any]]:
        if flow_id.startswith("agent:"):
            agent_id = int(flow_id.split(":")[1])
            return self._get_agent_details(session, agent_id)
        elif flow_id.startswith("story_generator:"):
            type_ = flow_id.split(":")[1]
            return self._get_story_gen_details(session, type_)
        return None

    def get_flow_feedback(self, session: Session, flow_id: str) -> List[Dict[str, Any]]:
        if flow_id.startswith("agent:"):
            agent_id = int(flow_id.split(":")[1])
            return self._get_agent_feedback(session, agent_id)
        elif flow_id.startswith("story_generator:"):
            type_ = flow_id.split(":")[1]
            return self._get_story_gen_feedback(session, type_)
        return []

    # --- Generation & Optimization ---

    async def generate_feedback_summary(self, session: Session, flow_id: str) -> str:
        negative_feedback = self._get_negative_feedback_text(session, flow_id)
        
        if not negative_feedback:
            return "No negative feedback found for this flow."
            
        feedback_text = "\n".join([f"{i+1}. \"{text}\"" for i, text in enumerate(negative_feedback[:50])])
        
        prompt = f"""You are analyzing user feedback for an AI-powered generation system to identify patterns and areas for improvement.

Here is the negative feedback from users:

{feedback_text}

Please provide a concise summary of the main issues and concerns. Structure your response as:

1. **Key Concerns**: List the top 3-5 main issues mentioned in the feedback
2. **Common Patterns**: Identify any recurring themes or patterns
3. **Suggested Focus Areas**: Based on the feedback, what should be the priority areas for improvement?

Keep your response clear and actionable."""

        try:
            from app.services.openrouter_service import openrouter_service
            response = await openrouter_service.chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=1000)
            return response["content"]
        except Exception as e:
            print(f"Error generating feedback summary: {e}")
            return "Failed to generate feedback summary."

    async def generate_optimized_prompt(self, session: Session, flow_id: str) -> Dict[str, str]:
        details = self.get_flow_details(session, flow_id)
        if not details:
            raise ValueError("Flow not found")
            
        feedback_summary = await self.generate_feedback_summary(session, flow_id)
        negative_feedback = self._get_negative_feedback_text(session, flow_id)
        feedback_examples = "\n".join([f"{i+1}. \"{text}\"" for i, text in enumerate(negative_feedback[:10])]) if negative_feedback else "No specific examples available."
        
        prompt = f"""You are an expert prompt engineer. Your task is to improve a system prompt based on user feedback.

## Current System Prompt:
{details['currentPrompt']}

## User Feedback Summary:
{feedback_summary}

## Specific Negative Feedback Examples:
{feedback_examples}

## Instructions:
Create an improved version of the system prompt that addresses the issues raised in the feedback. Make sure to:
1. Keep the core functionality and purpose
2. Address the specific concerns raised in feedback
3. Be more precise and clear where users reported confusion
4. Add guardrails or clarifications where users reported incorrect information

Respond with ONLY the new system prompt text. Do not include any explanation or commentary."""

        try:
            from app.services.openrouter_service import openrouter_service
            response = await openrouter_service.chat([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=4000)
            return {
                "currentPrompt": details['currentPrompt'],
                "newPrompt": response["content"],
                "feedbackSummary": feedback_summary
            }
        except Exception as e:
            print(f"Error generating optimized prompt: {e}")
            raise e

    def save_optimized_prompt(self, session: Session, flow_id: str, optimized_prompt: str) -> Any:
        if flow_id.startswith("agent:"):
            agent_id = int(flow_id.split(":")[1])
            agent = session.get(Agent, agent_id)
            if not agent:
                raise ValueError("Agent not found")
                
            # Create new draft version
            # Get max version number
            max_ver = session.exec(select(func.max(PromptVersion.version)).where(PromptVersion.agent_id == agent_id)).one() or 0
            
            new_version = PromptVersion(
                agent_id=agent_id,
                version=max_ver + 1,
                system_prompt=optimized_prompt,
                model=agent.model,
                status="draft"
            )
            session.add(new_version)
            session.commit()
            session.refresh(new_version)
            return new_version
            
        elif flow_id.startswith("story_generator:"):
            type_ = flow_id.split(":")[1]
            
            # Get max version
            max_ver = session.exec(select(func.max(PromptTemplate.version)).where(PromptTemplate.type == type_)).one() or 0
            
            new_template = PromptTemplate(
                name=f"Optimized {type_.title()} Prompt v{max_ver + 1}",
                type=type_,
                system_prompt=optimized_prompt,
                version=max_ver + 1,
                status="draft"
            )
            session.add(new_template)
            session.commit()
            session.refresh(new_template)
            return new_template
            
        raise ValueError(f"Unknown flow type: {flow_id}")

    def activate_version(self, session: Session, flow_id: str, version_id: int) -> Any:
        if flow_id.startswith("agent:"):
            version = session.get(PromptVersion, version_id)
            if not version:
                raise ValueError("Version not found")
                
            # Archive all active versions for this agent
            active_versions = session.exec(select(PromptVersion).where(PromptVersion.agent_id == version.agent_id, PromptVersion.status == "active")).all()
            for v in active_versions:
                v.status = "archived"
                session.add(v)
            
            # Activate this version
            version.status = "active"
            session.add(version)
            
            # Update agent
            agent = session.get(Agent, version.agent_id)
            agent.system_prompt = version.system_prompt
            agent.model = version.model
            session.add(agent)
            
            session.commit()
            session.refresh(version)
            return version
            
        elif flow_id.startswith("story_generator:"):
            template = session.get(PromptTemplate, version_id)
            if not template:
                raise ValueError("Template not found")
                
            # Archive all active templates of this type
            active_templates = session.exec(select(PromptTemplate).where(PromptTemplate.type == template.type, PromptTemplate.status == "active")).all()
            for t in active_templates:
                t.status = "archived"
                session.add(t)
                
            # Activate this template
            template.status = "active"
            session.add(template)
            
            session.commit()
            session.refresh(template)
            return template
            
        raise ValueError(f"Unknown flow type: {flow_id}")

    def create_split_test(self, session: Session, flow_id: str, name: str, version_ids: List[int]) -> Any:
        if flow_id.startswith("agent:"):
            agent_id = int(flow_id.split(":")[1])
            
            split_test = SplitTest(
                agent_id=agent_id,
                name=name,
                prompt_version_ids=version_ids,
                status="active"
            )
            session.add(split_test)
            session.commit()
            session.refresh(split_test)
            return split_test
            
        elif flow_id.startswith("story_generator:"):
            type_ = flow_id.split(":")[1]
            
            split_test = StoryGeneratorSplitTest(
                name=name,
                artifact_type=type_,
                prompt_template_ids=version_ids,
                status="active"
            )
            session.add(split_test)
            session.commit()
            session.refresh(split_test)
            return split_test
            
        raise ValueError(f"Unknown flow type: {flow_id}")

    # --- Helpers ---

    def _get_negative_feedback_text(self, session: Session, flow_id: str) -> List[str]:
        if flow_id.startswith("agent:"):
            agent_id = int(flow_id.split(":")[1])
            statement = select(Feedback.text).join(AgentExecution).where(
                AgentExecution.agent_id == agent_id,
                Feedback.sentiment == 'negative',
                Feedback.text.is_not(None)
            ).order_by(desc(Feedback.created_at)).limit(100)
            return session.exec(statement).all()
            
        elif flow_id.startswith("story_generator:"):
            type_ = flow_id.split(":")[1]
            statement = select(GenerationFeedback.text).join(GeneratedArtifact).where(
                GeneratedArtifact.type == type_,
                GenerationFeedback.sentiment == 'negative',
                GenerationFeedback.text.is_not(None)
            ).order_by(desc(GenerationFeedback.created_at)).limit(100)
            return session.exec(statement).all()
            
        return []

    # --- Agent Helpers ---

    def _get_agent_feedback_stats(self, session: Session, agent_id: int) -> Dict[str, Any]:
        # Join Feedback -> AgentExecution -> Agent
        statement = select(Feedback.sentiment, func.count(Feedback.id)).join(AgentExecution).where(AgentExecution.agent_id == agent_id).group_by(Feedback.sentiment)
        results = session.exec(statement).all()
        
        positive = 0
        negative = 0
        for sentiment, count in results:
            if sentiment == 'positive':
                positive = count
            elif sentiment == 'negative':
                negative = count
                
        total = positive + negative
        return {
            "positive": positive,
            "negative": negative,
            "total": total,
            "positivePercent": round((positive / total) * 100) if total > 0 else 0,
            "negativePercent": round((negative / total) * 100) if total > 0 else 0
        }

    def _get_agent_details(self, session: Session, agent_id: int) -> Optional[Dict[str, Any]]:
        agent = session.get(Agent, agent_id)
        if not agent:
            return None
            
        stats = self._get_agent_feedback_stats(session, agent_id)
        
        # Get versions
        versions = session.exec(select(PromptVersion).where(PromptVersion.agent_id == agent_id).order_by(desc(PromptVersion.version))).all()
        
        # Get active split test
        split_test = session.exec(select(SplitTest).where(SplitTest.agent_id == agent_id, SplitTest.status == "active")).first()
        
        return {
            "id": f"agent:{agent.id}",
            "type": "agent",
            "name": agent.name,
            "description": agent.description,
            "currentPrompt": agent.system_prompt,
            "draftPrompt": None, # TODO: Implement draft logic
            "draftVersionId": None,
            "feedbackStats": stats,
            "versions": [v.model_dump() for v in versions],
            "splitTest": split_test.model_dump() if split_test else None
        }

    def _get_agent_feedback(self, session: Session, agent_id: int) -> List[Dict[str, Any]]:
        statement = select(Feedback, AgentExecution).join(AgentExecution).where(AgentExecution.agent_id == agent_id).order_by(desc(Feedback.created_at))
        results = session.exec(statement).all()
        
        feedback_list = []
        for fb, exec in results:
            feedback_list.append({
                "id": fb.id,
                "sentiment": fb.sentiment,
                "text": fb.text,
                "createdAt": fb.created_at.isoformat(),
                "artifactTitle": f"Execution {exec.id}" # Placeholder title
            })
        return feedback_list

    # --- Story Generator Helpers ---

    def _get_story_gen_feedback_stats(self, session: Session, type_: str) -> Dict[str, Any]:
        # Join GenerationFeedback -> GeneratedArtifact
        statement = select(GenerationFeedback.sentiment, func.count(GenerationFeedback.id)).join(GeneratedArtifact).where(GeneratedArtifact.type == type_).group_by(GenerationFeedback.sentiment)
        results = session.exec(statement).all()
        
        positive = 0
        negative = 0
        for sentiment, count in results:
            if sentiment == 'positive':
                positive = count
            elif sentiment == 'negative':
                negative = count
                
        total = positive + negative
        return {
            "positive": positive,
            "negative": negative,
            "total": total,
            "positivePercent": round((positive / total) * 100) if total > 0 else 0,
            "negativePercent": round((negative / total) * 100) if total > 0 else 0
        }

    def _get_story_gen_details(self, session: Session, type_: str) -> Dict[str, Any]:
        stats = self._get_story_gen_feedback_stats(session, type_)
        
        # Get versions (PromptTemplates)
        versions = session.exec(select(PromptTemplate).where(PromptTemplate.type == type_).order_by(desc(PromptTemplate.version))).all()
        
        # Get active split test
        split_test = session.exec(select(StoryGeneratorSplitTest).where(StoryGeneratorSplitTest.artifact_type == type_, StoryGeneratorSplitTest.status == "active")).first()
        
        # Find current active template
        current_template = next((v for v in versions if v.status == 'active'), None)
        current_prompt = current_template.system_prompt if current_template else "No active prompt"

        return {
            "id": f"story_generator:{type_}",
            "type": f"story_generator_{type_}",
            "name": f"Story Generator: {type_.replace('_', ' ').title()}",
            "description": f"Generates {type_.replace('_', ' ').title()}s with A/B testing",
            "currentPrompt": current_prompt,
            "draftPrompt": None,
            "draftVersionId": None,
            "feedbackStats": stats,
            "versions": [v.model_dump() for v in versions],
            "splitTest": split_test.model_dump() if split_test else None
        }

    def _get_story_gen_feedback(self, session: Session, type_: str) -> List[Dict[str, Any]]:
        statement = select(GenerationFeedback, GeneratedArtifact).join(GeneratedArtifact).where(GeneratedArtifact.type == type_).order_by(desc(GenerationFeedback.created_at))
        results = session.exec(statement).all()
        
        feedback_list = []
        for fb, artifact in results:
            feedback_list.append({
                "id": fb.id,
                "sentiment": fb.sentiment,
                "text": fb.text,
                "createdAt": fb.created_at.isoformat(),
                "artifactTitle": artifact.title
            })
        return feedback_list

optimize_service = OptimizeService()
