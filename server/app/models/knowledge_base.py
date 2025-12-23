from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON, Relationship
from sqlalchemy import Integer, DateTime, ForeignKey
from pgvector.sqlalchemy import Vector

class KnowledgeBaseBase(SQLModel):
    name: str
    description: Optional[str] = None
    userId: Optional[int] = Field(default=None, sa_column=Column("user_id", Integer, ForeignKey("users.id")))
    settings: Dict[str, Any] = Field(default={
        "chunkSize": 1000,
        "chunkOverlap": 200,
        "embeddingModel": "text-embedding-ada-002"
    }, sa_column=Column(JSON))
    sourceMetadata: Dict[str, Any] = Field(default={}, sa_column=Column("source_metadata", JSON))
    status: str = "pending"
    documentCount: int = Field(default=0, sa_column=Column("document_count", Integer))
    totalChunks: int = Field(default=0, sa_column=Column("total_chunks", Integer))

    model_config = {
        "populate_by_name": True
    }

class KnowledgeBase(KnowledgeBaseBase, table=True):
    __tablename__ = "knowledge_bases"
    id: Optional[int] = Field(default=None, primary_key=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("created_at", DateTime))
    updatedAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("updated_at", DateTime))

class DocumentBase(SQLModel):
    knowledgeBaseId: int = Field(sa_column=Column("knowledge_base_id", Integer, ForeignKey("knowledge_bases.id")))
    name: str
    source: str # 'file_upload', 'github'
    sourceMetadata: Dict[str, Any] = Field(default={}, sa_column=Column("source_metadata", JSON))
    content: Optional[str] = None
    status: str = "pending"
    error: Optional[str] = None
    chunkCount: int = Field(default=0, sa_column=Column("chunk_count", Integer))

    model_config = {
        "populate_by_name": True
    }

class Document(DocumentBase, table=True):
    __tablename__ = "documents"
    id: Optional[int] = Field(default=None, primary_key=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("created_at", DateTime))
    updatedAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("updated_at", DateTime))

class DocumentChunkBase(SQLModel):
    document_id: int = Field(foreign_key="documents.id")
    knowledge_base_id: int = Field(foreign_key="knowledge_bases.id")
    content: str
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(1536)))
    metadata_: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON, name="metadata"))
    token_count: int = 0

class DocumentChunk(DocumentChunkBase, table=True):
    __tablename__ = "document_chunks"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
