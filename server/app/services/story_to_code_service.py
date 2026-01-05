"""
Story-to-Code Service

Converts user stories into production-ready code using AI with session-based workflow.
"""
import time
import json
import io
import zipfile
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.story_to_code import StoryToCodeSession
from app.models.story_generator import GeneratedArtifact
from app.models.knowledge_base import KnowledgeBase, Document
from app.services.knowledge_base_service import knowledge_base_service
from openai import OpenAI


class StoryToCodeService:
    """Service for converting user stories to code."""

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

    @property
    def model(self) -> str:
        return settings.OPENROUTER_MODEL

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        input_description: str,
        title: Optional[str] = None,
        input_source: str = "manual",
        source_artifact_id: Optional[int] = None,
        tech_stack: Optional[str] = None,
        knowledge_base_ids: Optional[List[int]] = None,
        user_id: Optional[int] = None
    ) -> StoryToCodeSession:
        """Create a new story-to-code session."""
        # Generate title if not provided
        if not title:
            title = f"Code Gen: {input_description[:50]}..." if len(input_description) > 50 else f"Code Gen: {input_description}"

        session = StoryToCodeSession(
            user_id=user_id,
            title=title,
            input_source=input_source,
            input_description=input_description,
            source_artifact_id=source_artifact_id,
            tech_stack=tech_stack,
            knowledge_base_ids=knowledge_base_ids or [],
            status="pending",
            progress_step=0,
            progress_message="Session created, starting generation..."
        )

        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[StoryToCodeSession]:
        """Get session by ID, optionally filtered by user_id."""
        session = db.get(StoryToCodeSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[StoryToCodeSession]:
        """List sessions with pagination."""
        query = select(StoryToCodeSession)
        if user_id:
            query = query.where(StoryToCodeSession.user_id == user_id)
        query = query.order_by(desc(StoryToCodeSession.created_at)).offset(skip).limit(limit)
        return list(db.exec(query).all())

    def delete_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> bool:
        """Delete a session."""
        session = self.get_session(db, session_id, user_id=user_id)
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    def retry_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[StoryToCodeSession]:
        """Reset a failed session for retry."""
        session = self.get_session(db, session_id, user_id=user_id)
        if not session:
            return None

        session.status = "pending"
        session.error_message = None
        session.progress_step = 0
        session.progress_message = "Retrying generation..."
        session.updated_at = datetime.utcnow()

        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    # --- Source Data ---

    def list_story_artifacts(self, db: Session, user_id: Optional[int] = None) -> List[GeneratedArtifact]:
        """List user story artifacts (epics, features, user stories) for selection."""
        query = select(GeneratedArtifact).where(
            GeneratedArtifact.type.in_(["epic", "feature", "user_story"])
        )
        if user_id:
            query = query.where(GeneratedArtifact.user_id == user_id)
        query = query.order_by(desc(GeneratedArtifact.created_at)).limit(50)
        return list(db.exec(query).all())

    def list_code_knowledge_bases(self, db: Session, user_id: Optional[int] = None) -> List[KnowledgeBase]:
        """List knowledge bases that have code/github content."""
        # First get KB IDs that have github documents
        kb_ids_result = db.exec(
            select(Document.knowledgeBaseId).where(Document.source == "github").distinct()
        ).all()
        kb_ids = [r for r in kb_ids_result if r is not None]

        if not kb_ids:
            return []

        # Get KBs by IDs but only those with documents (documentCount > 0)
        query = select(KnowledgeBase).where(
            KnowledgeBase.id.in_(kb_ids),
            KnowledgeBase.documentCount > 0
        )
        if user_id:
            query = query.where(KnowledgeBase.userId == user_id)
        query = query.order_by(desc(KnowledgeBase.createdAt))
        return list(db.exec(query).all())

    # --- Code Generation Pipeline ---

    def _update_progress(self, db: Session, session_id: int, status: str, step: int, message: str):
        """Update session progress."""
        session = self.get_session(db, session_id)
        if session:
            session.status = status
            session.progress_step = step
            session.progress_message = message
            session.updated_at = datetime.utcnow()
            db.add(session)
            db.commit()

    def _get_knowledge_base_context(self, db: Session, kb_ids: List[int], query: str, limit: int = 5) -> str:
        """Fetch relevant context from knowledge bases."""
        if not kb_ids:
            return ""

        context_parts = []
        for kb_id in kb_ids:
            try:
                results = knowledge_base_service.search(db, kb_id, query, limit=limit)
                for r in results:
                    context_parts.append(f"[From: {r.get('documentName', 'Unknown')}]\n{r['content']}")
            except Exception as e:
                print(f"Error searching KB {kb_id}: {str(e)}")
                continue

        if not context_parts:
            return ""

        return "\n\n---\n\n".join(context_parts)

    def process_session(self, db: Session, session_id: int):
        """Main async pipeline for code generation."""
        try:
            start_time = time.time()
            session = self.get_session(db, session_id)
            if not session:
                return

            # Step 1: Prepare context
            self._update_progress(db, session_id, "generating", 1, "Preparing context...")

            # Get KB context if available
            kb_context = ""
            if session.knowledge_base_ids:
                kb_context = self._get_knowledge_base_context(
                    db,
                    session.knowledge_base_ids,
                    session.input_description,
                    limit=8  # More context for code generation
                )

            # Step 2: Generate code structure
            self._update_progress(db, session_id, "generating", 2, "Generating code structure...")

            tech_stack_info = session.tech_stack or "Use best practices and modern frameworks appropriate for the requirements"
            if kb_context:
                tech_stack_info = "Follow the patterns and conventions from the provided codebase context"

            system_prompt = """You are an expert Senior Software Engineer and Architect.
Your task is to convert User Stories and Requirements into a production-ready code structure.

OUTPUT RULES:
1. Return ONLY valid JSON.
2. The JSON must have a "files" key containing an object.
3. The "files" object keys must be file paths (e.g., "src/main.py", "tests/test_auth.py").
4. The "files" object values must be the full string content of each file.
5. Include configuration files (e.g., requirements.txt, package.json, README.md) as needed.
6. Include proper directory structure with appropriate file organization.
7. Add comprehensive inline comments explaining the code.
8. Include basic tests for the main functionality.

EXAMPLE OUTPUT FORMAT:
{
  "files": {
    "src/main.py": "# Main application entry point\\nimport ...",
    "src/models/user.py": "# User model\\nclass User:\\n    ...",
    "tests/test_main.py": "# Tests for main module\\nimport pytest\\n...",
    "requirements.txt": "fastapi==0.100.0\\nuvicorn==0.23.0",
    "README.md": "# Project Title\\n\\n## Setup\\n..."
  }
}

IMPORTANT: Generate complete, working code files - not placeholders or stubs."""

            user_prompt = f"""PROJECT REQUIREMENTS (User Stories):
{session.input_description}

TECHNICAL STACK & CONSTRAINTS:
{tech_stack_info}
"""

            if kb_context:
                user_prompt += f"""
CODEBASE CONTEXT (follow these patterns and conventions):
{kb_context}
"""

            user_prompt += """
Please generate a complete, production-ready codebase that satisfies all the requirements.
Include proper file structure, implementation files, tests, and configuration."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Step 3: Call LLM
            self._update_progress(db, session_id, "generating", 3, "AI is generating code...")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=16000,  # Larger for code generation
                temperature=0.2,  # Lower temperature for code stability
                response_format={"type": "json_object"}
            )

            raw_content = response.choices[0].message.content

            # Step 4: Parse and validate
            self._update_progress(db, session_id, "generating", 4, "Validating generated code...")

            # Clean response
            cleaned_content = raw_content.strip()
            if cleaned_content.startswith("```json"):
                cleaned_content = cleaned_content[7:]
            elif cleaned_content.startswith("```"):
                cleaned_content = cleaned_content[3:]
            if cleaned_content.endswith("```"):
                cleaned_content = cleaned_content[:-3]
            cleaned_content = cleaned_content.strip()

            # Parse JSON
            try:
                parsed = json.loads(cleaned_content)
                # Handle both formats: direct file map or {files: {...}}
                if "files" in parsed:
                    files_map = parsed["files"]
                else:
                    files_map = parsed
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse generated code as JSON: {str(e)}")

            # Validate we have actual files
            if not files_map or not isinstance(files_map, dict):
                raise ValueError("Generated response did not contain valid file structure")

            # Step 5: Save results
            generation_time_ms = (time.time() - start_time) * 1000

            session = self.get_session(db, session_id)
            session.generated_files = files_map
            session.status = "completed"
            session.progress_step = 5
            session.progress_message = f"Complete! Generated {len(files_map)} files."
            session.completed_at = datetime.utcnow()
            session.generation_metadata = {
                "model": self.model,
                "promptTokens": response.usage.prompt_tokens if response.usage else 0,
                "completionTokens": response.usage.completion_tokens if response.usage else 0,
                "generationTimeMs": generation_time_ms,
                "fileCount": len(files_map)
            }

            db.add(session)
            db.commit()

        except Exception as e:
            print(f"Story-to-Code pipeline error: {str(e)}")
            import traceback
            traceback.print_exc()

            session = self.get_session(db, session_id)
            if session:
                session.status = "failed"
                session.error_message = str(e)
                db.add(session)
                db.commit()

    def create_zip(self, session: StoryToCodeSession) -> bytes:
        """Convert the generated files into a ZIP byte stream."""
        if not session.generated_files:
            return b""

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for filename, content in session.generated_files.items():
                zip_file.writestr(filename, content)

        return zip_buffer.getvalue()

    # --- Legacy Support (for old API) ---

    def generate(self, db: Session, request: Dict[str, Any]) -> GeneratedArtifact:
        """Legacy generate method for backwards compatibility."""
        # Create session
        session = self.create_session(
            db=db,
            input_description=request.get("stories", ""),
            title=request.get("title"),
            tech_stack=request.get("techStack"),
            knowledge_base_ids=request.get("knowledgeBaseIds", []),
            user_id=request.get("userId")
        )

        # Process synchronously for legacy API
        self.process_session(db, session.id)

        # Refresh and return as artifact-like response
        session = self.get_session(db, session.id)

        # Create a GeneratedArtifact for backwards compatibility
        artifact = GeneratedArtifact(
            id=session.id,
            user_id=session.user_id,
            type="story_to_code",
            title=session.title or "Generated Code",
            content=json.dumps(session.generated_files) if session.generated_files else "{}",
            input_description=session.input_description,
            input_files=[],
            knowledge_base_ids=session.knowledge_base_ids,
            status=session.status,
            generation_metadata=session.generation_metadata
        )

        return artifact

    def list_requests(self, db: Session, user_id: int) -> List[GeneratedArtifact]:
        """Legacy list method for backwards compatibility."""
        sessions = self.list_sessions(db, user_id=user_id)
        artifacts = []
        for s in sessions:
            artifacts.append(GeneratedArtifact(
                id=s.id,
                user_id=s.user_id,
                type="story_to_code",
                title=s.title or "Generated Code",
                content=json.dumps(s.generated_files) if s.generated_files else "{}",
                input_description=s.input_description,
                input_files=[],
                knowledge_base_ids=s.knowledge_base_ids,
                status=s.status,
                generation_metadata=s.generation_metadata,
                created_at=s.created_at
            ))
        return artifacts

    def get_artifact(self, db: Session, artifact_id: int, user_id: Optional[int] = None) -> Optional[GeneratedArtifact]:
        """Legacy get artifact method for backwards compatibility."""
        session = self.get_session(db, artifact_id, user_id=user_id)
        if not session:
            return None

        return GeneratedArtifact(
            id=session.id,
            user_id=session.user_id,
            type="story_to_code",
            title=session.title or "Generated Code",
            content=json.dumps(session.generated_files) if session.generated_files else "{}",
            input_description=session.input_description,
            input_files=[],
            knowledge_base_ids=session.knowledge_base_ids,
            status=session.status,
            generation_metadata=session.generation_metadata,
            created_at=session.created_at
        )


story_to_code_service = StoryToCodeService()
