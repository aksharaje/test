import sys
import os

# Add server_py to path
sys.path.append(os.path.join(os.path.dirname(__file__), "server"))

try:
    print("Importing services...")
    from app.services.knowledge_base_service import knowledge_base_service
    print("KnowledgeBaseService imported.")
    
    from app.services.story_generator_service import story_generator_service
    print("StoryGeneratorService imported.")
    
    from app.services.code_chat_service import code_chat_service
    print("CodeChatService imported.")
    
    from app.services.prd_generator_service import prd_generator_service
    print("PrdGeneratorService imported.")
    
    from app.services.library_service import library_service
    print("LibraryService imported.")
    
    print("All services imported successfully.")
    
except Exception as e:
    print(f"Error importing services: {e}")
    sys.exit(1)
