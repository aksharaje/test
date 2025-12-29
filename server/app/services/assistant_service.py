import json
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select, or_
from app.models.story_generator import GeneratedArtifact
from app.core.config import settings
from app.services.openrouter_service import openrouter_service

class AssistantService:
    def __init__(self):
        # Knowledge of available tools in the platform
        self.tools_knowledge = [
            {"name": "Story Generator", "path": "/story-generator", "desc": "Create Epics, Features, and User Stories."},
            {"name": "PRD Generator", "path": "/prd-generator", "desc": "Generate Product Requirements Documents."},
            {"name": "Code Chat", "path": "/code-chat", "desc": "Chat about code, debug, or explain concepts."},
            {"name": "Feasibility Analyzer", "path": "/feasibility", "desc": "Analyze technical feasibility of ideas."},
            {"name": "Business Case Builder", "path": "/business-case", "desc": "Build ROI and business value cases."},
            {"name": "Research Planner", "path": "/research-planner", "desc": "Plan user research and interviews."},
            {"name": "Journey Mapper", "path": "/journey-mapper", "desc": "Map user journeys and experience flows."},
            {"name": "Ideation Engine", "path": "/ideation", "desc": "Brainstorm and generate new product ideas."},
            {"name": "Story to Code", "path": "/story-to-code", "desc": "Turn user stories directly into code scaffolding."},
            {"name": "Documentation", "path": "/docs", "desc": "Read system documentation and help files."},
        ]

    async def chat(self, session: Session, user_id: int, message: str, history: List[Dict[str, str]] = []) -> Dict[str, Any]:
        # 1. Search Artifacts (Simple keyword match for now)
        # We check if the user is asking about "my X" or "previous Y"
        found_artifacts = []
        if any(w in message.lower() for w in ["my", "find", "search", "where", "previous", "last"]):
            # Simple fuzzy search on title or input description
            # In a real app we'd use vector search or full text search
            keywords = [w for w in message.split() if len(w) > 3 and w.lower() not in ["find", "show", "where", "with"]]
            if keywords:
                # Naive implementation: just fetch recent 10 and filter in python or basic ILIKE
                # Using ILIKE for first keyword
                term = f"%{keywords[0]}%"
                statement = select(GeneratedArtifact)\
                    .where(GeneratedArtifact.user_id == user_id)\
                    .where(or_(GeneratedArtifact.title.ilike(term), GeneratedArtifact.input_description.ilike(term)))\
                    .order_by(GeneratedArtifact.created_at.desc())\
                    .limit(5)
                found_artifacts = session.exec(statement).all()

        # 2. Construct System Prompt
        artifacts_context = ""
        if found_artifacts:
            artifacts_context = "User's Found Artifacts:\n"
            for art in found_artifacts:
                artifacts_context += f"- ID {art.id}: {art.title} ({art.type}) created at {art.created_at}\n"
        
        tools_context = "Available Tools:\n"
        for t in self.tools_knowledge:
            tools_context += f"- {t['name']}: {t['desc']} (Path: {t['path']})\n"

        system_prompt = f"""You are 'Navigator', a helpful assistant for the Product Studio platform.
Your goal is to guide the user to the right tool for their task or help them find their past work.

CONTEXT:
{tools_context}

{artifacts_context}

INSTRUCTIONS:
- If the user asks how to do something, recommend the specific tool and provide a markdown link to its path (e.g. `[Tool Name](/path)`).
- If the user is looking for a file/document, refer to the found artifacts using their IDs and Titles. You can provide links like `[Title](/story-to-code/results/ID)` (adapt path based on type).
    - Epic/Feature/Story -> `/story-generator` (viewing logic depends on frontend, but generic link is start)
    - Code -> `/story-to-code/results/ID`
    - PRD -> `/prd-generator/results/ID` (assumed path)
- Be concise and friendly.
- If unsure, ask clarifying questions.
"""

        messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]

        if not settings.OPENROUTER_API_KEY:
            return {
                "role": "assistant",
                "content": "I am not configured correctly. Please set the `OPENROUTER_API_KEY` environment variable."
            }

        # 3. Call LLM
        # Using a cheaper/faster model for chat if available, defaulting to standard config
        model = settings.OPENROUTER_MODEL 
        
        try:
            response_data = await openrouter_service.chat(
                messages=messages,
                model=model,
                max_tokens=1000,
                temperature=0.7
            )
            return {
                "role": "assistant",
                "content": response_data["content"]
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Assistant Chat Error: {e}")
            return {
                "role": "assistant",
                "content": f"I'm having trouble connecting to my brain right now. Error: {str(e)}"
            }

assistant_service = AssistantService()
