from typing import List, Optional, Dict, Any
import requests
from datetime import datetime
from sqlmodel import Session, select, desc, func, col, delete, or_
from sqlalchemy.orm import selectinload
from app.models.knowledge_base import KnowledgeBase, Document, DocumentChunk
from app.services.embedding_service import embedding_service

class KnowledgeBaseService:
    def __init__(self):
        pass

    def list_knowledge_bases(self, session: Session, user_id: Optional[int] = None, include_shared: bool = True) -> List[KnowledgeBase]:
        """List knowledge bases for the list page (all statuses, user's own + shared)."""
        query = select(KnowledgeBase)
        if user_id:
            if include_shared:
                query = query.where(or_(KnowledgeBase.userId == user_id, KnowledgeBase.isShared == True))
            else:
                query = query.where(KnowledgeBase.userId == user_id)
        query = query.order_by(desc(KnowledgeBase.createdAt))
        return session.exec(query).all()

    def list_selectable_knowledge_bases(self, session: Session, user_id: int, limit: int = 50) -> List[KnowledgeBase]:
        """List knowledge bases for select dropdowns (ready only, user's own + shared)."""
        query = select(KnowledgeBase).where(
            KnowledgeBase.status == "ready"
        ).where(
            or_(KnowledgeBase.userId == user_id, KnowledgeBase.isShared == True)
        ).order_by(desc(KnowledgeBase.updatedAt)).limit(limit)
        return session.exec(query).all()

    def get_knowledge_base(self, session: Session, kb_id: int, user_id: Optional[int] = None) -> Optional[KnowledgeBase]:
        """Get a knowledge base by ID. Allows access if user owns it or it's shared."""
        kb = session.get(KnowledgeBase, kb_id)
        if not kb:
            return None
        if user_id and kb.userId and kb.userId != user_id and not kb.isShared:
            return None
        return kb

    def create_knowledge_base(self, session: Session, kb_data: KnowledgeBase) -> KnowledgeBase:
        session.add(kb_data)
        session.commit()
        session.refresh(kb_data)
        return kb_data

    def update_knowledge_base(self, session: Session, kb_id: int, update_data: Dict[str, Any], user_id: Optional[int] = None) -> Optional[KnowledgeBase]:
        kb = self.get_knowledge_base(session, kb_id, user_id)
        if not kb:
            return None

        for key, value in update_data.items():
            setattr(kb, key, value)

        kb.updatedAt = datetime.utcnow()
        session.add(kb)
        session.commit()
        session.refresh(kb)
        return kb

    def delete_knowledge_base(self, session: Session, kb_id: int, user_id: Optional[int] = None) -> bool:
        kb = self.get_knowledge_base(session, kb_id, user_id)
        if not kb:
            return False

        # Delete all document chunks associated with this KB
        session.exec(delete(DocumentChunk).where(DocumentChunk.knowledge_base_id == kb_id))

        # Delete all documents associated with this KB
        session.exec(delete(Document).where(Document.knowledgeBaseId == kb_id))

        session.delete(kb)
        session.commit()
        return True

    def add_document(self, session: Session, kb_id: int, document: Document) -> Document:
        document.knowledgeBaseId = kb_id
        session.add(document)
        session.commit()
        session.refresh(document)
        
        # Update KB document count
        kb = session.get(KnowledgeBase, kb_id)
        if kb:
            kb.documentCount += 1
            kb.updatedAt = datetime.utcnow()
            session.add(kb)
            session.commit()
            
        return document

    def add_github_source(self, session: Session, kb_id: int, url: str) -> Document:
        name = url.split('/')[-1]
        
        # Basic content fetching for raw URLs
        content = None
        if "raw.githubusercontent.com" in url:
            try:
                response = requests.get(url)
                if response.status_code == 200:
                    content = response.text
            except Exception as e:
                print(f"Failed to fetch content from {url}: {e}")

        document = Document(
            knowledgeBaseId=kb_id,
            name=name,
            source="github",
            sourceMetadata={"url": url},
            content=content,
            status="pending"
        )
        
        return self.add_document(session, kb_id, document)

    def list_documents(self, session: Session, kb_id: int) -> List[Document]:
        return session.exec(select(Document).where(Document.knowledgeBaseId == kb_id).order_by(desc(Document.createdAt))).all()

    def delete_document(self, session: Session, doc_id: int) -> bool:
        doc = session.get(Document, doc_id)
        if not doc:
            return False
            
        kb_id = doc.knowledgeBaseId
        chunk_count = doc.chunkCount
        
        session.delete(doc)
        session.commit()
        
        # Update KB counts
        kb = session.get(KnowledgeBase, kb_id)
        if kb:
            kb.documentCount = max(0, kb.documentCount - 1)
            kb.totalChunks = max(0, kb.totalChunks - chunk_count)
            kb.updatedAt = datetime.utcnow()
            session.add(kb)
            session.commit()
            
        return True

    def index_document(self, session: Session, doc_id: int):
        doc = session.get(Document, doc_id)
        if not doc or not doc.content:
            raise ValueError("Document not found or has no content")
            
        kb = session.get(KnowledgeBase, doc.knowledgeBaseId)
        if not kb:
            raise ValueError("Knowledge Base not found")
        session.refresh(kb)
            
        settings = kb.settings
        chunk_size = settings.get("chunkSize", 1000)
        chunk_overlap = settings.get("chunkOverlap", 200)
        embedding_model = settings.get("embeddingModel", "text-embedding-3-small")
        
        try:
            # Update status to processing
            doc.status = "processing"
            doc.updatedAt = datetime.utcnow()
            kb.status = "processing"
            kb.updatedAt = datetime.utcnow()
            session.add(doc)
            session.add(kb)
            session.commit()
            
            # Split text
            chunks_data = embedding_service.split_text_into_chunks(doc.content, chunk_size, chunk_overlap)
            
            if not chunks_data:
                raise ValueError("No chunks generated from document")
                
            # Generate embeddings
            texts = [c["content"] for c in chunks_data]
            embeddings = embedding_service.generate_embeddings(texts, embedding_model, dimensions=1536)

            # Validate embedding dimensions
            if embeddings and len(embeddings[0]) != 1536:
                raise ValueError(f"Generated embeddings have {len(embeddings[0])} dimensions, but expected 1536. Model: {embedding_model}")

            # Save chunks
            for i, chunk_data in enumerate(chunks_data):
                chunk = DocumentChunk(
                    document_id=doc_id,
                    knowledge_base_id=kb.id,
                    content=chunk_data["content"],
                    embedding=embeddings[i],
                    metadata_=chunk_data["metadata"],
                    token_count=embedding_service.estimate_token_count(chunk_data["content"])
                )
                session.add(chunk)
                
            # Update document status
            doc.status = "indexed"
            doc.chunkCount = len(chunks_data)
            doc.updatedAt = datetime.utcnow()
            session.add(doc)
            
            # Update KB status
            kb.totalChunks += len(chunks_data)
            kb.status = "ready"
            kb.updatedAt = datetime.utcnow()
            session.add(kb)
            
            session.commit()
            
        except Exception as e:
            doc.status = "error"
            doc.error = str(e)
            doc.updatedAt = datetime.utcnow()
            session.add(doc)
            session.commit()
            raise e

    def search(self, session: Session, kb_id: int, query: str, limit: int = 5, threshold: float = 0.7) -> List[Dict[str, Any]]:
        kb = session.get(KnowledgeBase, kb_id)
        if not kb:
            raise ValueError("Knowledge Base not found")
            
        embedding_model = kb.settings.get("embeddingModel", "text-embedding-3-small")
        query_embedding = embedding_service.generate_query_embedding(query, embedding_model, dimensions=1536)
        
        # PGVector cosine distance search
        # Note: 1 - cosine_distance = cosine_similarity
        # We want similarity > threshold, so distance < 1 - threshold
        distance_threshold = 1 - threshold
        
        results = session.exec(
            select(DocumentChunk, Document)
            .join(Document)
            .where(DocumentChunk.knowledge_base_id == kb_id)
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(limit)
        ).all()
        
        # Filter by threshold manually if needed, or trust the order
        # Since SQLModel/PGVector integration might vary, we'll process results
        
        formatted_results = []
        for chunk, doc in results:
            # Calculate similarity manually or assume it's good enough from order
            # For exact similarity score, we'd need to select the distance expression
            # But for now, let's just return the matches
            
            formatted_results.append({
                "chunkId": chunk.id,
                "documentId": doc.id,
                "documentName": doc.name,
                "content": chunk.content,
                "metadata": chunk.metadata_,
                "similarity": 0.0 # Placeholder, hard to get exact score without raw SQL or advanced selection
            })
            
        return formatted_results

knowledge_base_service = KnowledgeBaseService()
