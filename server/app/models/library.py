from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON, Relationship

class LibraryBookBase(SQLModel):
    knowledge_base_id: int = Field(foreign_key="knowledge_bases.id")
    title: str
    description: Optional[str] = None
    status: str = "generating" # 'generating', 'ready', 'error'
    error: Optional[str] = None

class LibraryBook(LibraryBookBase, table=True):
    __tablename__ = "library_books"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LibraryPageBase(SQLModel):
    book_id: int = Field(foreign_key="library_books.id")
    parent_id: Optional[int] = Field(default=None, foreign_key="library_pages.id")
    title: str
    content: str
    order: int
    type: str # 'content', 'integration_index', 'integration_detail'

class LibraryPage(LibraryPageBase, table=True):
    __tablename__ = "library_pages"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LibraryIntegrationBase(SQLModel):
    book_id: int = Field(foreign_key="library_books.id")
    name: str
    description: Optional[str] = None
    integration_type: str
    technical_details: Optional[str] = None
    functional_details: Optional[str] = None

class LibraryIntegration(LibraryIntegrationBase, table=True):
    __tablename__ = "library_integrations"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
