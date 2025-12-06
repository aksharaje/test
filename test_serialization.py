import sys
import os
import json
from datetime import datetime

# Add server_py to path
sys.path.append(os.path.join(os.path.dirname(__file__), "server"))

from app.models.knowledge_base import KnowledgeBase, Document

def test_serialization():
    kb = KnowledgeBase(
        id=1,
        name="Test KB",
        document_count=5,
        total_chunks=100,
        user_id=123,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Inspect fields
    print("Model Fields:")
    for name, field in KnowledgeBase.model_fields.items():
        print(f"{name}: alias={field.alias}, serialization_alias={field.serialization_alias}")

    # Dump with by_alias=True
    kb_json = kb.model_dump(by_alias=True)
    print("KnowledgeBase JSON:")
    print(json.dumps(kb_json, default=str, indent=2))
    
    # Check for camelCase keys
    expected_keys = ["documentCount", "totalChunks", "userId", "createdAt", "updatedAt"]
    missing_keys = [key for key in expected_keys if key not in kb_json]
    
    if missing_keys:
        print(f"FAILED: Missing keys in KnowledgeBase: {missing_keys}")
    else:
        print("SUCCESS: KnowledgeBase has all camelCase keys")

    doc = Document(
        id=1,
        knowledge_base_id=1,
        name="Test Doc",
        source="file_upload",
        chunk_count=10,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    doc_json = doc.model_dump(by_alias=True)
    print("\nDocument JSON:")
    print(json.dumps(doc_json, default=str, indent=2))
    
    expected_doc_keys = ["knowledgeBaseId", "chunkCount", "createdAt", "updatedAt"]
    missing_doc_keys = [key for key in expected_doc_keys if key not in doc_json]
    
    if missing_doc_keys:
        print(f"FAILED: Missing keys in Document: {missing_doc_keys}")
    else:
        print("SUCCESS: Document has all camelCase keys")

if __name__ == "__main__":
    test_serialization()
