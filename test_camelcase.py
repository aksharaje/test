import sys
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import Integer

# Mocking the model structure locally to test serialization
class KnowledgeBaseBase(SQLModel):
    name: str
    description: Optional[str] = None
    userId: Optional[int] = Field(default=None, sa_column=Column("user_id", Integer))
    settings: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    status: str = "pending"
    documentCount: int = Field(default=0, sa_column=Column("document_count", Integer))
    totalChunks: int = Field(default=0, sa_column=Column("total_chunks", Integer))

    model_config = {
        "populate_by_name": True
    }

class KnowledgeBase(KnowledgeBaseBase, table=True):
    __tablename__ = "knowledge_bases"
    id: Optional[int] = Field(default=None, primary_key=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("created_at"))
    updatedAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("updated_at"))

def test_serialization():
    kb = KnowledgeBase(
        id=1,
        name="Test KB",
        documentCount=5,
        totalChunks=100,
        userId=123,
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow()
    )
    
    # Dump
    kb_json = kb.model_dump()
    print("KnowledgeBase JSON:")
    print(json.dumps(kb_json, default=str, indent=2))
    
    expected_keys = ["documentCount", "totalChunks", "userId", "createdAt", "updatedAt"]
    missing_keys = [key for key in expected_keys if key not in kb_json]
    
    if missing_keys:
        print(f"FAILED: Missing keys in KnowledgeBase: {missing_keys}")
    else:
        print("SUCCESS: KnowledgeBase has all camelCase keys")

if __name__ == "__main__":
    test_serialization()
