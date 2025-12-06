import os
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.story_generator import GeneratedArtifact, PromptTemplate
from app.services.embedding_service import embedding_service
from app.services.knowledge_base_service import knowledge_base_service
from openai import OpenAI

class StoryGeneratorService:
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

    def get_system_prompt(self, type: str, title: str) -> str:
        base_instruction = """You are a JSON API that outputs product documentation.

CRITICAL RULES:
1. Output ONLY valid JSON - your entire response must be parseable JSON
2. NO markdown formatting, NO code fences, NO explanatory text
3. NO text before the opening { or after the closing }
4. NO comments or notes like "---" or "*All user stories...*"
5. Start your response with { and end with }

You create professional, specific, actionable product documentation."""

        json_schema = {
            "epic": """{
  "type": "epic",
  "epic": {
    "title": "string - Epic title",
    "vision": "string - High-level vision",
    "goals": ["string - Goal 1", "string - Goal 2"],
    "successMetrics": ["string - Metric 1"],
    "risksAndDependencies": "string",
    "features": [
      {
        "title": "string - Feature title",
        "purpose": "string",
        "summary": "string",
        "businessValue": "string",
        "functionalRequirements": "string",
        "nonFunctionalRequirements": "string",
        "dependencies": "string",
        "assumptions": "string",
        "acceptanceCriteria": [{"scenario": "string", "given": "string", "when": "string", "then": "string"}],
        "stories": [{"title": "string", "userStory": "string", "acceptanceCriteria": [{"scenario": "string", "given": "string", "when": "string", "then": "string"}]}]
      }
    ]
  }
}""",
            "feature": """{
  "type": "feature",
  "feature": {
    "title": "string - Feature title",
    "purpose": "string",
    "summary": "string",
    "businessValue": "string",
    "functionalRequirements": "string",
    "nonFunctionalRequirements": "string",
    "dependencies": "string",
    "assumptions": "string",
    "acceptanceCriteria": [{"scenario": "string", "given": "string", "when": "string", "then": "string"}],
    "stories": [{"title": "string", "userStory": "string", "acceptanceCriteria": [{"scenario": "string", "given": "string", "when": "string", "then": "string"}]}]
  }
}""",
            "user_story": """{
  "type": "user_story",
  "stories": [
    {
      "title": "string - Story title",
      "userStory": "string - AS a [user] I WANT [goal] SO THAT [benefit]",
      "acceptanceCriteria": [{"scenario": "string", "given": "string", "when": "string", "then": "string"}]
    }
  ]
}"""
        }

        if type == "epic":
            return f"""{base_instruction}

You are generating an EPIC for: "{title}"

An epic represents a large initiative containing multiple features, each with their own user stories.

REQUIREMENTS:
- Generate 2-3 Features for this epic
- Each Feature should have 2-4 User Stories nested within it
- All content should be specific and detailed, not placeholder text
- Acceptance criteria should be in Gherkin format (Given/When/Then)

JSON SCHEMA (respond with ONLY this structure, filled with real content):
{json_schema['epic']}"""

        elif type == "feature":
            return f"""{base_instruction}

You are generating a FEATURE for: "{title}"

A feature represents a specific capability or functionality with its related user stories.

REQUIREMENTS:
- Generate complete feature documentation
- Include 3-5 User Stories that implement this feature
- All content should be specific and detailed, not placeholder text
- Acceptance criteria should be in Gherkin format (Given/When/Then)

JSON SCHEMA (respond with ONLY this structure, filled with real content):
{json_schema['feature']}"""

        elif type == "user_story":
            return f"""{base_instruction}

You are generating USER STORIES for: "{title}"

User stories describe functionality from an end-user perspective.

REQUIREMENTS:
- Generate 3-5 user stories
- Each story should be self-contained and testable
- Include 2-4 acceptance criteria scenarios per story
- Use the AS a/I WANT/SO THAT format for userStory field

JSON SCHEMA (respond with ONLY this structure, filled with real content):
{json_schema['user_story']}"""

        return base_instruction

    def get_knowledge_base_context(self, session: Session, kb_ids: List[int], query: str, limit: int = 5) -> str:
        if not kb_ids:
            return ""
        
        context_parts = []
        for kb_id in kb_ids:
            results = knowledge_base_service.search(session, kb_id, query, limit=limit)
            for r in results:
                # Simple threshold check (though search already limits)
                # In python service we didn't implement threshold filtering in search yet, 
                # but we can do it here or assume search returns good results.
                context_parts.append(r["content"])
        
        if not context_parts:
            return ""
            
        return "\\n\\nRelevant Context from Knowledge Base:\\n" + "\\n\\n---\\n\\n".join(context_parts)

    def clean_json_response(self, response: str) -> str:
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    def generate(self, session: Session, request: Dict[str, Any]) -> GeneratedArtifact:
        start_time = time.time()
        from app.core.config import settings
        model = settings.OPENROUTER_MODEL
        
        # Get KB context
        kb_ids = request.get("knowledgeBaseIds", [])
        kb_context = self.get_knowledge_base_context(session, kb_ids, request.get("description", ""))
        
        # Build prompt
        system_prompt = self.get_system_prompt(request["type"], request.get("title") or request["description"][:50])
        
        user_content = request["description"]
        if kb_context:
            user_content += kb_context
            
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        # Call LLM
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=8000,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        cleaned_content = self.clean_json_response(raw_content)
        
        # Parse to ensure valid JSON
        try:
            json.loads(cleaned_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse LLM response as JSON: {str(e)}")
            
        # Extract title if not provided
        title = request.get("title")
        if not title:
            try:
                parsed = json.loads(cleaned_content)
                if request["type"] == "epic" and "epic" in parsed:
                    title = parsed["epic"].get("title")
                elif request["type"] == "feature" and "feature" in parsed:
                    title = parsed["feature"].get("title")
                elif request["type"] == "user_story" and "stories" in parsed and parsed["stories"]:
                    title = parsed["stories"][0].get("title")
            except:
                pass
            if not title:
                title = f"Generated {request['type'].replace('_', ' ')}"

        generation_time_ms = (time.time() - start_time) * 1000
        
        # Save artifact
        artifact = GeneratedArtifact(
            user_id=request.get("userId"),
            type=request["type"],
            title=title,
            content=cleaned_content,
            input_description=request["description"],
            input_files=request.get("files", []),
            knowledge_base_ids=kb_ids,
            status="draft",
            generation_metadata={
                "model": model,
                "promptTokens": response.usage.prompt_tokens,
                "completionTokens": response.usage.completion_tokens,
                "generationTimeMs": generation_time_ms
            }
        )
        
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        
        return artifact

    def list_artifacts(self, session: Session, user_id: Optional[int] = None) -> List[GeneratedArtifact]:
        query = select(GeneratedArtifact)
        if user_id:
            query = query.where(GeneratedArtifact.user_id == user_id)
        query = query.order_by(desc(GeneratedArtifact.created_at))
        return session.exec(query).all()

    def get_artifact(self, session: Session, id: int) -> Optional[GeneratedArtifact]:
        return session.get(GeneratedArtifact, id)

    def update_artifact(self, session: Session, id: int, data: Dict[str, Any]) -> Optional[GeneratedArtifact]:
        artifact = session.get(GeneratedArtifact, id)
        if not artifact:
            return None
            
        for key, value in data.items():
            setattr(artifact, key, value)
            
        artifact.updated_at = datetime.utcnow()
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        return artifact

    def delete_artifact(self, session: Session, id: int) -> bool:
        artifact = session.get(GeneratedArtifact, id)
        if not artifact:
            return False
        session.delete(artifact)
        session.commit()
        return True

story_generator_service = StoryGeneratorService()
