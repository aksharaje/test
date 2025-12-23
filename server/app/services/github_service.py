import os
import shutil
import tempfile
import git
import time
from typing import List, Optional
from pathlib import Path
from sqlmodel import Session
from app.models.knowledge_base import KnowledgeBase, Document
# knowledge_base_service import moved to inside method to avoid circular import
from app.core.config import settings
from openai import OpenAI

class GithubService:
    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            api_key = settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY
            # Default to OpenRouter if key is present, otherwise standard OpenAI
            base_url = "https://openrouter.ai/api/v1" if settings.OPENROUTER_API_KEY else None
            
            if not api_key:
                # Fallback or just let it fail later
                pass
                
            self._client = OpenAI(
                api_key=api_key,
                base_url=base_url
            )
        return self._client

    def process_repository(self, kb_id: int, repo_url: str, access_token: Optional[str] = None, placeholder_doc_id: Optional[int] = None):
        from app.core.db import engine
        from sqlmodel import Session, select
        
        print(f"Starting processing for repo: {repo_url} (KB: {kb_id})")
        
        with Session(engine) as session:
            # Update KB status and metadata
            kb = session.get(KnowledgeBase, kb_id)
            if kb:
                kb.status = "processing"
                # Update metadata with repoUrl if not present or changed
                metadata = kb.sourceMetadata or {}
                metadata["repoUrl"] = repo_url
                if access_token:
                    metadata["accessToken"] = access_token # Ideally this should be encrypted
                kb.sourceMetadata = metadata
                session.add(kb)
                session.commit()
            
            temp_dir = tempfile.mkdtemp()
            try:
                # Clone repo
                print(f"Cloning to {temp_dir}...")
                
                # Construct auth URL if token is present
                clone_url = repo_url
                if access_token:
                    # Handle both https://github.com/user/repo and git@github.com:user/repo cases roughly
                    # For HTTPS: https://<token>@github.com/user/repo.git
                    if repo_url.startswith("https://"):
                        clone_url = repo_url.replace("https://", f"https://oauth2:{access_token}@")
                
                git.Repo.clone_from(clone_url, temp_dir, depth=1)
                
                # Walk files
                processed_count = 0
                for root, dirs, files in os.walk(temp_dir):
                    # Skip .git and node_modules
                    if '.git' in dirs:
                        dirs.remove('.git')
                    if 'node_modules' in dirs:
                        dirs.remove('node_modules')
                    if '__pycache__' in dirs:
                        dirs.remove('__pycache__')
                        
                    for file in files:
                        if file.startswith('.') or file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.ttf', '.eot', '.lock', '.json')):
                            continue
                            
                        file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(file_path, temp_dir)
                        
                        try:
                            # Check if document already exists and is indexed (Resumability)
                            # We check specifically for this KB and this relative path
                            statement = select(Document).where(
                                Document.knowledgeBaseId == kb_id,
                                Document.name == rel_path,
                                Document.status == "indexed"
                            )
                            existing_doc = session.exec(statement).first()
                            
                            if existing_doc:
                                print(f"Skipping existing file: {rel_path}")
                                continue

                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                
                            # Skip empty or very small files
                            if len(content.strip()) < 50:
                                continue
                                
                            # Generate Documentation
                            doc_content = self._generate_documentation(content, rel_path, repo_url)
                            
                            # Create Document
                            document = Document(
                                knowledgeBaseId=kb_id,
                                name=rel_path,
                                source="github",
                                sourceMetadata={"repoUrl": repo_url, "path": rel_path},
                                content=doc_content,
                                status="indexed" 
                            )
                            
                            # We use add_document from service which updates counts
                            from app.services.knowledge_base_service import knowledge_base_service
                            saved_doc = knowledge_base_service.add_document(session, kb_id, document)
                            
                            knowledge_base_service.index_document(session, saved_doc.id)
                            processed_count += 1
                            print(f"Processed {rel_path}")
                            
                        except Exception as e:
                            session.rollback()
                            print(f"Error processing {rel_path}: {e}")
                            continue

                print(f"Repository processing complete. Processed {processed_count} files.")
                
                # Update placeholder document if provided
                if placeholder_doc_id:
                    doc = session.get(Document, placeholder_doc_id)
                    if doc:
                        doc.name = f"Import Summary: {repo_url.split('/')[-1]}"
                        doc.content = f"# Repository Import Summary\n\nSuccessfully imported {processed_count} new files from [{repo_url}]({repo_url})."
                        doc.status = "indexed"
                        session.add(doc)
                
                # Update KB status to ready
                kb = session.get(KnowledgeBase, kb_id)
                if kb:
                    kb.status = "ready"
                    session.add(kb)
                    session.commit()

            except Exception as e:
                print(f"Error processing repository: {e}")
                kb = session.get(KnowledgeBase, kb_id)
                if kb:
                    kb.status = "error"
                    session.add(kb)
                
                if placeholder_doc_id:
                     doc = session.get(Document, placeholder_doc_id)
                     if doc:
                         doc.status = "error"
                         doc.error = str(e)
                         session.add(doc)
                         
                session.commit()
            finally:
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)

    def _generate_documentation(self, code: str, filename: str, repo_url: str) -> str:
        prompt = f"""
You are a Technical Business Analyst. Your goal is to document the following code file for a business user.
File: {filename}
Repo: {repo_url}

CODE:
```
{code[:10000]} 
```
(Code truncated if too long)

Please generate a Markdown document with the following sections:
1. **Business Logic**: What business rules or domain concepts are handled here?
2. **Functional Requirements**: What does this code actually DO from a user/system perspective?
3. **Integrations**: What external systems, APIs, or databases does it interact with?
4. **Key Information**: Any other details a business stakeholder needs to know.

After the documentation, please append the original code in a collapsible section or just a code block called "Original Code".
"""
        try:
            response = self.client.chat.completions.create(
                model=settings.OPENROUTER_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2000,
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"LLM Generation failed for {filename}: {e}")
            # Fallback to just the code
            return f"# {filename}\n\n*Documentation generation failed.*\n\n## Original Code\n\n```\n{code}\n```"

github_service = GithubService()
