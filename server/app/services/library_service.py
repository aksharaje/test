import os
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc, asc
from app.models.library import LibraryBook, LibraryPage, LibraryIntegration
from app.models.knowledge_base import KnowledgeBase
from app.services.knowledge_base_service import knowledge_base_service
from app.services.embedding_service import embedding_service
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
        # For prototype, return all books as per Node.js implementation
        return session.exec(select(LibraryBook).order_by(desc(LibraryBook.created_at))).all()

    def get_book(self, session: Session, id: int) -> Optional[LibraryBook]:
        return session.get(LibraryBook, id)

    def get_book_pages(self, session: Session, book_id: int) -> List[Dict[str, Any]]:
        pages = session.exec(
            select(LibraryPage)
            .where(LibraryPage.book_id == book_id)
            .order_by(asc(LibraryPage.order))
        ).all()
        
        # Build hierarchy
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

    def get_integrations(self, session: Session, book_id: int) -> List[LibraryIntegration]:
        return session.exec(select(LibraryIntegration).where(LibraryIntegration.book_id == book_id)).all()

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
        
        # Note: In a real async setup, we'd use Celery or BackgroundTasks.
        # Here we rely on the caller (FastAPI endpoint) to pass BackgroundTasks.
        # But since this method returns the book, the caller should handle the background task trigger.
        # We'll expose a separate method for generation.
        
        return book

    def generate_book_content(self, session: Session, book_id: int, kb_id: int):
        try:
            # 1. Fetch KB Context
            # Get some chunks for context
            # In python service, we can use search or just grab random chunks if we want general context
            # Or better, list documents and grab their content if small enough
            # For now, let's grab top 50 chunks from the KB
            from app.models.knowledge_base import DocumentChunk
            chunks = session.exec(
                select(DocumentChunk)
                .where(DocumentChunk.knowledge_base_id == kb_id)
                .limit(50)
            ).all()
            
            context = "\\n\\n---\\n\\n".join([c.content for c in chunks])[:50000]
            
            from app.core.config import settings
            model = settings.OPENROUTER_MODEL
            
            # 2. Generate Structure
            structure_prompt = f"""
    Analyze the following code snippets/documentation context and propose a COMPREHENSIVE and DETAILED hierarchical structure for a technical documentation book.
    
    The goal is to create a "Premium" documentation experience.
    - Break down the content into granular, focused chapters.
    - Each chapter MUST have multiple sections (at least 3-5).
    - Avoid generic titles; use specific technical terms from the context.
    - Include a specific section for "Integrations" if you detect external system calls.
    
    Return ONLY valid JSON in this format:
    {{
      "title": "Book Title",
      "description": "Book Description",
      "chapters": [
        {{
          "title": "Chapter Title",
          "description": "What this chapter covers",
          "sections": [
            {{ "title": "Section Title", "description": "Section content summary" }}
          ]
        }}
      ],
      "integrations": [
        {{
          "name": "System Name",
          "type": "API/Database/etc",
          "description": "What it does"
        }}
      ]
    }}

    Context:
    {context}
            """
            
            structure_res = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": structure_prompt}],
                response_format={"type": "json_object"}
            )
            
            structure = json.loads(structure_res.choices[0].message.content)
            
            # 3. Update Book Title (Skip title update to keep KB name)
            book = session.get(LibraryBook, book_id)
            if book:
                # book.title = structure.get("title", book.title) # Keep original title
                book.description = structure.get("description", book.description)
                session.add(book)
                session.commit()
                
            # 4. Create Pages & Content
            order = 0
            
            for chapter in structure.get("chapters", []):
                # Create Chapter Page
                chapter_content = self._generate_page_content(context, chapter["title"], chapter["description"], model)
                parent_page = LibraryPage(
                    book_id=book_id,
                    title=chapter["title"],
                    content=chapter_content,
                    order=order,
                    type="content"
                )
                order += 1
                session.add(parent_page)
                session.commit()
                session.refresh(parent_page)
                
                # Create Sections
                for section in chapter.get("sections", []):
                    section_content = self._generate_page_content(context, section["title"], section["description"], model)
                    child_page = LibraryPage(
                        book_id=book_id,
                        parent_id=parent_page.id,
                        title=section["title"],
                        content=section_content,
                        order=order,
                        type="content"
                    )
                    order += 1
                    session.add(child_page)
                    session.commit()
                    
            # 5. Handle Integrations
            if structure.get("integrations"):
                # Create Index Page
                int_index = LibraryPage(
                    book_id=book_id,
                    title="Integrations",
                    content="# Integrations\\n\\nExternal systems and services used by this project.",
                    order=order,
                    type="integration_index"
                )
                order += 1
                session.add(int_index)
                session.commit()
                session.refresh(int_index)
                
                for integration in structure["integrations"]:
                    detail_prompt = f"""
        Analyze the usage of the external system "{integration['name']}" ({integration['type']}).
        Write technical details about how it is integrated, authentication methods, and key API calls.
        Also write functional details about why it is used.
        
        Context:
        {context}
                    """
                    
                    detail_res = self.client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": detail_prompt}]
                    )
                    
                    details = detail_res.choices[0].message.content
                    
                    # Store integration
                    int_record = LibraryIntegration(
                        book_id=book_id,
                        name=integration["name"],
                        description=integration.get("description"),
                        integration_type=integration["type"],
                        technical_details=details,
                        functional_details="See technical details"
                    )
                    session.add(int_record)
                    
                    # Store page
                    int_page = LibraryPage(
                        book_id=book_id,
                        parent_id=int_index.id,
                        title=integration["name"],
                        content=details,
                        order=order,
                        type="integration_detail"
                    )
                    order += 1
                    session.add(int_page)
                    session.commit()
                    
            # 6. Mark as Ready
            if book:
                book.status = "ready"
                book.updated_at = datetime.utcnow()
                session.add(book)
                session.commit()
                
        except Exception as e:
            print(f"Error generating book {book_id}: {str(e)}")
            book = session.get(LibraryBook, book_id)
            if book:
                book.status = "error"
                book.error = str(e)
                session.add(book)
                session.commit()

    def _generate_page_content(self, context: str, title: str, description: str, model: str) -> str:
        page_prompt = f"""
      Write detailed technical documentation for the section: "{title}".
      Description: {description}
      
      Use Markdown formatting. Include code examples if relevant.
      
      Context:
      {context}
        """
        
        res = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": page_prompt}]
        )
        
        return res.choices[0].message.content

    def delete_book(self, session: Session, id: int) -> bool:
        book = session.get(LibraryBook, id)
        if not book:
            return False
        session.delete(book)
        session.commit()
        return True

library_service = LibraryService()
