import time
import json
import io
import zipfile
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.story_generator import GeneratedArtifact
from app.services.knowledge_base_service import knowledge_base_service
from openai import OpenAI

class StoryToCodeService:
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

    def get_knowledge_base_context(self, session: Session, kb_ids: List[int], query: str, limit: int = 5) -> str:
        if not kb_ids:
            return ""
        
        context_parts = []
        for kb_id in kb_ids:
            results = knowledge_base_service.search(session, kb_id, query, limit=limit)
            for r in results:
                context_parts.append(r["content"])
        
        if not context_parts:
            return ""
            
        return "\n\nRelevant Technical Context/Standards:\n" + "\n\n---\n\n".join(context_parts)

    def generate(self, session: Session, request: Dict[str, Any]) -> GeneratedArtifact:
        start_time = time.time()
        # Per user request, use this specific model
        model = "openai/gpt-oss-120b"
        
        # 1. Prepare Context
        stories = request.get("stories", "")
        tech_stack = request.get("techStack", "Best practices")
        kb_ids = request.get("knowledgeBaseIds", [])
        
        kb_context = self.get_knowledge_base_context(session, kb_ids, stories + " " + tech_stack)
        
        # 2. Build Prompt
        system_prompt = """You are an expert Senior Software Engineer and Architect.
Your task is to convert User Stories and Requirements into a production-ready code structure.

OUTPUT RULES:
1. Return ONLY valid JSON.
2. The JSON keys must be file paths (e.g., "src/main.py", "tests/test_auth.py").
3. The JSON values must be the full string content of the file.
4. Include configuration files (e.g., requirements.txt, package.json) if needed.
5. Do not include markdown formatting or explanations outside the JSON.
"""

        user_prompt = f"""
PROJECT REQUIREMENTS (User Stories):
{stories}

TECHNICAL STACK & CONSTRAINTS:
{tech_stack}

{kb_context}

Please generate the complete codebase structure, including implementation files and tests, that satisfies the requirements.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # 3. Call LLM
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=8000,
            temperature=0.2, # Lower temperature for code stability
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        
        # Cleaning/Parsing
        cleaned_content = raw_content.strip()
        if cleaned_content.startswith("```json"):
            cleaned_content = cleaned_content[7:]
        elif cleaned_content.startswith("```"):
            cleaned_content = cleaned_content[3:]
        if cleaned_content.endswith("```"):
            cleaned_content = cleaned_content[:-3]
        cleaned_content = cleaned_content.strip()

        # Validate JSON
        try:
            json.loads(cleaned_content)
        except json.JSONDecodeError as e:
            # Fallback: sometimes models wrap in a root key like "files"
            # Here we just raise for now, but in prod we might fix it.
            raise ValueError(f"Failed to parse generated code as JSON: {str(e)}")

        generation_time_ms = (time.time() - start_time) * 1000
        
        # Generate a Title
        title = request.get("title")
        if not title:
            title = f"Code Gen: {stories[:30]}..." if stories else "Generated Code"

        # 4. Save Artifact
        artifact = GeneratedArtifact(
            user_id=request.get("userId"),
            type="story_to_code",
            title=title,
            content=cleaned_content,
            input_description=stories,
            input_files=[],
            knowledge_base_ids=kb_ids,
            status="completed",
            generation_metadata={
                "model": model,
                "techStack": tech_stack,
                "promptTokens": response.usage.prompt_tokens,
                "completionTokens": response.usage.completion_tokens,
                "generationTimeMs": generation_time_ms
            }
        )
        
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        
        return artifact

    def list_requests(self, session: Session, user_id: int) -> List[GeneratedArtifact]:
        query = select(GeneratedArtifact)\
            .where(GeneratedArtifact.user_id == user_id)\
            .where(GeneratedArtifact.type == "story_to_code")\
            .order_by(desc(GeneratedArtifact.created_at))
        return session.exec(query).all()

    def get_artifact(self, session: Session, artifact_id: int) -> Optional[GeneratedArtifact]:
        return session.get(GeneratedArtifact, artifact_id)

    def create_zip(self, artifact: GeneratedArtifact) -> bytes:
        """Converts the JSON content (filename -> content) into a valid ZIP byte stream."""
        try:
            files_map = json.loads(artifact.content)
        except json.JSONDecodeError:
            return b""
            
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for filename, content in files_map.items():
                zip_file.writestr(filename, content)
                
        return zip_buffer.getvalue()

story_to_code_service = StoryToCodeService()
