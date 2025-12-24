import os
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc, asc
from app.models.library import LibraryBook, LibraryPage, LibraryIntegration, LibraryBookVersion
from app.models.knowledge_base import KnowledgeBase
from app.services.knowledge_base_service import knowledge_base_service
from app.services.repository_mapper import RepositoryMapper
from app.services.flow_tracer import FlowTracer
from openai import OpenAI

class LibraryService:
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

    def list_books(self, session: Session, user_id: Optional[int] = None) -> List[LibraryBook]:
        return session.exec(select(LibraryBook).order_by(desc(LibraryBook.created_at))).all()

    def get_book(self, session: Session, id: int) -> Optional[LibraryBook]:
        return session.get(LibraryBook, id)

    def get_book_pages(self, session: Session, book_id: int) -> List[Dict[str, Any]]:
        # Same hierarchy logic as before
        pages = session.exec(
            select(LibraryPage)
            .where(LibraryPage.book_id == book_id)
            .order_by(asc(LibraryPage.order))
        ).all()
        
        page_map = {p.id: {"id": p.id, "title": p.title, "content": p.content, "type": p.type, "children": []} for p in pages}
        root_pages = []
        for p in pages:
            page_obj = page_map[p.id]
            if p.parent_id:
                parent = page_map.get(p.parent_id)
                if parent:
                    parent["children"].append(page_obj)
                else:
                    root_pages.append(page_obj)
            else:
                root_pages.append(page_obj)
        return root_pages

    def get_page(self, session: Session, id: int) -> Optional[LibraryPage]:
        return session.get(LibraryPage, id)

    def create_book(self, session: Session, knowledge_base_id: int, user_id: Optional[int] = None) -> LibraryBook:
        kb = session.get(KnowledgeBase, knowledge_base_id)
        if not kb:
            raise ValueError("Knowledge Base not found")
            
        book = LibraryBook(
            knowledge_base_id=knowledge_base_id,
            title=kb.name,
            description=f"AI-generated documentation for {kb.name}",
            status="generating"
        )
        session.add(book)
        session.commit()
        session.refresh(book)
        return book

    def delete_book(self, session: Session, id: int) -> bool:
        book = session.get(LibraryBook, id)
        if not book: return False
        
        # Manually cascade delete dependencies
        # Delete pages
        pages = session.exec(select(LibraryPage).where(LibraryPage.book_id == id)).all()
        # Unlink parents first to avoid self-referential FK violation
        for p in pages:
            p.parent_id = None
            session.add(p)
        session.flush()
        
        # print(f"Deleting {len(pages)} pages")
        for p in pages: session.delete(p)
            
        # Delete integrations
        integrations = session.exec(select(LibraryIntegration).where(LibraryIntegration.book_id == id)).all()
        # print(f"Deleting {len(integrations)} integrations")
        for i in integrations: session.delete(i)
            
        # Delete versions
        versions = session.exec(select(LibraryBookVersion).where(LibraryBookVersion.book_id == id)).all()
        # print(f"Deleting {len(versions)} versions")
        for v in versions: session.delete(v)
        
        session.flush() # Ensure dependents are deleted first
        
        session.delete(book)
        session.commit()
        return True

    def generate_book_content(self, session: Session, book_id: int, kb_id: int, commit_hash: str = None, change_summary: str = None):
        try:
            from app.core.config import settings
            from app.models.knowledge_base import Document
            import tempfile
            import pathlib
            
            model = settings.OPENROUTER_MODEL
            
            # Fetch Documents
            docs = session.exec(select(Document).where(Document.knowledgeBaseId == kb_id)).all()
            if not docs:
                print(f"No documents found for KB {kb_id}")
                return

            # Use Temporary Directory for Analysis to support "Virtual" File Systems
            with tempfile.TemporaryDirectory() as temp_dir:
                print(f"Staging {len(docs)} documents to {temp_dir}")
                
                # Write docs to temp dir
                for doc in docs:
                    if not doc.content: continue
                    # Handle paths in doc names (e.g. app/main.py)
                    safe_path = os.path.normpath(doc.name)
                    if safe_path.startswith("..") or safe_path.startswith("/"):
                        safe_path = os.path.basename(doc.name) # Fallback for safety
                        
                    full_path = os.path.join(temp_dir, safe_path)
                    os.makedirs(os.path.dirname(full_path), exist_ok=True)
                    
                    with open(full_path, "w", encoding="utf-8") as f:
                        f.write(doc.content)
                
                root_dir = temp_dir
                
                # 1. Map Features
                mapper = RepositoryMapper(root_dir)
                domains = mapper.map_features(self.client, model)
                
                if not domains:
                    print("No domains mapped, skipping generation")
                    return
                
                # 2. Update Book Description
                book = session.get(LibraryBook, book_id)
                if not book: return
                
                # 3. Clear existing content (This is a Full Regeneration strategy)
                existing_pages = session.exec(select(LibraryPage).where(LibraryPage.book_id == book_id)).all()
                for p in existing_pages:
                    session.delete(p)
                session.commit() # Commit deletion
                
                order = 0
                
                # 4. Create "Overview" Chapter
                overview_content = self._generate_overview(domains, change_summary)
                overview_page = LibraryPage(book_id=book_id, title="System Overview", content=overview_content, order=order, type="content")
                session.add(overview_page)
                session.commit()
                order += 1
                
                tracer = FlowTracer(root_dir)
                
                # 5. Generate Domain Specific Chapters
                for domain in domains:
                    # Trace context for this domain
                    domain_context = ""
                    for entry in domain.entry_points:
                        domain_context += tracer.trace_flow(entry) + "\n\n"
                    
                    # Fallback if no entry points (use related files)
                    if not domain_context and domain.related_files:
                         for f in domain.related_files[:3]: # Limit to avoiding token overflow
                             domain_context += tracer._read_file(f) + "\n\n"
    
                    # Generate Chapter
                    chapter_prompt = f"""
                    Act as a Product Manager writing a PRD for the feature: "{domain.name}".
                    
                    Context (Codebase analysis):
                    {domain_context[:30000]}
                    
                    Requirements:
                    1. **User Flows**: Describe step-by-step flows from an END USER perspective. 
                       - Use Mermaid Sequence Diagrams (```mermaid ... ```).
                       - **Participants**: Use high-level actors like "User", "System", "Third Party" (avoid "UI", "Controller", "DB").
                       - **Messages**: Use business actions (e.g. "Submit Form", "Validate Input", "Confirm") NOT technical details (e.g. "POST /api/v1", "JSON", "200 OK").
                    2. **Business Rules**: specific logic constraints.
                    3. **Data Model**: Key concepts involved (e.g. "Project", "User") - avoid SQL types.
                    4. **External Integrations**: Services used.
                    
                    Format as Markdown.
                    """
                    
                    res = self.client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": chapter_prompt}]
                    )
                    content = res.choices[0].message.content
                    
                    page = LibraryPage(book_id=book_id, title=domain.name, content=content, order=order, type="content")
                    session.add(page)
                    session.commit()
                    order += 1
                    
                # 6. Save Version
                self._save_version(session, book_id, commit_hash, change_summary)
                
                # 7. Complete
                book.status = "ready"
                book.updated_at = datetime.utcnow()
                session.add(book)
                session.commit()
        
        except Exception as e:
            print(f"Error generating book: {e}")
            # Refresh session to handle rollback if needed
            session.rollback()
            book = session.get(LibraryBook, book_id)
            if book:
                book.status = "error"
                book.error = str(e)
                session.add(book)
                session.commit()

    def _generate_overview(self, domains, change_summary):
        domain_list = "\n".join([f"- **{d.name}**: {d.description}" for d in domains])
        content = f"# System Overview\n\nThis documentation is auto-generated based on the codebase analysis.\n\n"
        if change_summary:
            content += f"## Latest Changes\n\n{change_summary}\n\n---\n\n"
        
        content += f"## Functional Domains\n\n{domain_list}\n"
        return content

    def _save_version(self, session: Session, book_id: int, commit_hash: str, change_summary: str):
        # Count existing versions
        count = session.exec(select(LibraryBookVersion).where(LibraryBookVersion.book_id == book_id)).all()
        version_num = len(count) + 1
        
        # Snapshot content (simplified - just storing titles for now or we could store full JSON tree)
        # For this prototype, let's store a simple JSON of the pages
        pages = self.get_book_pages(session, book_id)
        snapshot = json.dumps(pages)
        
        ver = LibraryBookVersion(
            book_id=book_id,
            version_number=version_num,
            content_snapshot=snapshot,
            commit_hash=commit_hash,
            change_summary=change_summary
        )
        session.add(ver)
        session.commit()

library_service = LibraryService()
