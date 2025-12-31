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
            # For the list view, we want stats for the ACTIVE version only to reflect current performance
            stats = self._get_agent_feedback_stats(session, agent.id, only_active=True)
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
            # For the list view, we want stats for the ACTIVE version only
            stats = self._get_story_gen_feedback_stats(session, type_, only_active=True)
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

Respond with a JSON object containing the improved system prompt in the "system_prompt" field.
Example: { "system_prompt": "Your upgraded prompt here..." }"""

        try:
            from app.services.openrouter_service import openrouter_service
            response = await openrouter_service.chat(
                [{"role": "user", "content": prompt}], 
                temperature=0.4, 
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            # Parse and clean response
            content = response["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            try:
                parsed = json.loads(content)
                new_prompt = parsed.get("system_prompt", content)
            except json.JSONDecodeError:
                # Fallback: if JSON fails, try to use content directly if it looks reasonable, or raise
                print("Failed to parse optimization response as JSON, using raw content")
                new_prompt = content
                
            return {
                "currentPrompt": details['currentPrompt'],
                "newPrompt": new_prompt,
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

    def _get_agent_feedback_stats(self, session: Session, agent_id: int, only_active: bool = False) -> Dict[str, Any]:
        # Join Feedback -> AgentExecution -> Agent
        query = select(Feedback.sentiment, func.count(Feedback.id)).join(AgentExecution).where(AgentExecution.agent_id == agent_id)
        
        if only_active:
            # Filter by the currently active version
            active_version = session.exec(select(PromptVersion).where(PromptVersion.agent_id == agent_id, PromptVersion.status == "active")).first()
            if active_version:
                query = query.where(AgentExecution.prompt_version_id == active_version.id)
            else:
                # If no active version (shouldn't happen for agents usually), return 0 stats
                return {
                    "positive": 0, "negative": 0, "total": 0,
                    "positivePercent": 0, "negativePercent": 0
                }
                
        results = session.exec(query.group_by(Feedback.sentiment)).all()
        
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

    def _get_agent_version_stats(self, session: Session, agent_id: int) -> Dict[int, Dict[str, Any]]:
        # Map version_id -> stats
        statement = select(
            AgentExecution.prompt_version_id,
            Feedback.sentiment,
            func.count(Feedback.id)
        ).select_from(Feedback).join(AgentExecution).where(
            AgentExecution.agent_id == agent_id,
            AgentExecution.prompt_version_id.is_not(None)
        ).group_by(AgentExecution.prompt_version_id, Feedback.sentiment)
        
        results = session.exec(statement).all()
        
        stats_map = {}
        for ver_id, sentiment, count in results:
            if ver_id not in stats_map:
                stats_map[ver_id] = {"positive": 0, "negative": 0, "total": 0}
            
            if sentiment == 'positive':
                stats_map[ver_id]["positive"] += count
            elif sentiment == 'negative':
                stats_map[ver_id]["negative"] += count
            
            stats_map[ver_id]["total"] += count
            
        # Calculate percentages
        for ver_id, stats in stats_map.items():
            total = stats["total"]
            stats["positivePercent"] = round((stats["positive"] / total) * 100) if total > 0 else 0
            stats["negativePercent"] = round((stats["negative"] / total) * 100) if total > 0 else 0
            
        return stats_map

    def _get_agent_details(self, session: Session, agent_id: int) -> Optional[Dict[str, Any]]:
        agent = session.get(Agent, agent_id)
        if not agent:
            return None
            
        # Stats for ACTIVE version only
        stats = self._get_agent_feedback_stats(session, agent_id, only_active=True)
        version_stats = self._get_agent_version_stats(session, agent_id)
        
        # Get versions
        versions = session.exec(select(PromptVersion).where(PromptVersion.agent_id == agent_id).order_by(desc(PromptVersion.version))).all()
        
        # Prepare version list with stats
        version_list = []
        for v in versions:
            v_dict = v.model_dump()
            # Fix date format
            v_dict["createdAt"] = v.created_at.isoformat()
            if v.updated_at:
                v_dict["updatedAt"] = v.updated_at.isoformat()
            
            # Attach stats
            if v.id in version_stats:
                v_dict["feedbackStats"] = version_stats[v.id]
            else:
                v_dict["feedbackStats"] = {
                    "positive": 0, "negative": 0, "total": 0, "positivePercent": 0, "negativePercent": 0
                }
            version_list.append(v_dict)

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
            "versions": version_list,
            "splitTest": split_test.model_dump() if split_test else None
        }

    def _get_agent_feedback(self, session: Session, agent_id: int) -> List[Dict[str, Any]]:
        statement = select(Feedback, AgentExecution, PromptVersion).select_from(Feedback).join(AgentExecution).outerjoin(PromptVersion, AgentExecution.prompt_version_id == PromptVersion.id).where(AgentExecution.agent_id == agent_id).order_by(desc(Feedback.created_at))
        results = session.exec(statement).all()
        
        feedback_list = []
        for fb, exec, version in results:
            feedback_list.append({
                "id": fb.id,
                "sentiment": fb.sentiment,
                "text": fb.text,
                "createdAt": fb.created_at.isoformat(),
                "artifactTitle": f"Execution {exec.id}", # Placeholder title
                "version": version.version if version else None,
                "versionId": version.id if version else None
            })
        return feedback_list

    # --- Story Generator Helpers ---

    def _get_story_gen_feedback_stats(self, session: Session, type_: str, only_active: bool = False) -> Dict[str, Any]:
        # Join GenerationFeedback -> GeneratedArtifact
        query = select(GenerationFeedback.sentiment, func.count(GenerationFeedback.id)).join(GeneratedArtifact).where(GeneratedArtifact.type == type_)
        
        if only_active:
             # Filter by the currently active template
            active_template = session.exec(select(PromptTemplate).where(PromptTemplate.type == type_, PromptTemplate.status == "active")).first()
            if active_template:
                query = query.where(GeneratedArtifact.prompt_template_id == active_template.id)
            else:
                return {
                    "positive": 0, "negative": 0, "total": 0,
                    "positivePercent": 0, "negativePercent": 0
                }
                
        results = session.exec(query.group_by(GenerationFeedback.sentiment)).all()
        
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

    def _get_story_gen_version_stats(self, session: Session, type_: str) -> Dict[int, Dict[str, Any]]:
        # Map template_id -> stats
        statement = select(
            GeneratedArtifact.prompt_template_id,
            GenerationFeedback.sentiment,
            func.count(GenerationFeedback.id)
        ).select_from(GenerationFeedback).join(GeneratedArtifact).where(
            GeneratedArtifact.type == type_,
            GeneratedArtifact.prompt_template_id.is_not(None)
        ).group_by(GeneratedArtifact.prompt_template_id, GenerationFeedback.sentiment)
        
        results = session.exec(statement).all()
        
        stats_map = {}
        for ver_id, sentiment, count in results:
            if ver_id not in stats_map:
                stats_map[ver_id] = {"positive": 0, "negative": 0, "total": 0}
            
            if sentiment == 'positive':
                stats_map[ver_id]["positive"] += count
            elif sentiment == 'negative':
                stats_map[ver_id]["negative"] += count
            
            stats_map[ver_id]["total"] += count
            
        # Calculate percentages
        for ver_id, stats in stats_map.items():
            total = stats["total"]
            stats["positivePercent"] = round((stats["positive"] / total) * 100) if total > 0 else 0
            stats["negativePercent"] = round((stats["negative"] / total) * 100) if total > 0 else 0
            
        return stats_map

    def _get_story_gen_details(self, session: Session, type_: str) -> Dict[str, Any]:
        # Stats for ACTIVE version only
        stats = self._get_story_gen_feedback_stats(session, type_, only_active=True)
        version_stats = self._get_story_gen_version_stats(session, type_)
        
        # Get versions (PromptTemplates)
        versions = session.exec(select(PromptTemplate).where(PromptTemplate.type == type_).order_by(desc(PromptTemplate.version))).all()
        
        # Prepare version list with stats
        version_list = []
        for v in versions:
            v_dict = v.model_dump()
            # Fix date format
            v_dict["createdAt"] = v.created_at.isoformat()
            if v.updated_at:
                v_dict["updatedAt"] = v.updated_at.isoformat()
                
            # Attach stats
            if v.id in version_stats:
                v_dict["feedbackStats"] = version_stats[v.id]
            else:
                v_dict["feedbackStats"] = {
                    "positive": 0, "negative": 0, "total": 0, "positivePercent": 0, "negativePercent": 0
                }
            version_list.append(v_dict)
        
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
            "versions": version_list,
            "splitTest": split_test.model_dump() if split_test else None
        }

    def _get_story_gen_feedback(self, session: Session, type_: str) -> List[Dict[str, Any]]:
        statement = select(GenerationFeedback, GeneratedArtifact, PromptTemplate).select_from(GenerationFeedback).join(GeneratedArtifact).outerjoin(PromptTemplate, GeneratedArtifact.prompt_template_id == PromptTemplate.id).where(GeneratedArtifact.type == type_).order_by(desc(GenerationFeedback.created_at))
        results = session.exec(statement).all()
        
        feedback_list = []
        for fb, artifact, template in results:
            feedback_list.append({
                "id": fb.id,
                "sentiment": fb.sentiment,
                "text": fb.text,
                "createdAt": fb.created_at.isoformat(),
                "artifactTitle": artifact.title,
                "version": template.version if template else None,
                "versionId": template.id if template else None
            })
        return feedback_list

optimize_service = OptimizeService()
