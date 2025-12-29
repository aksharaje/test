import sys
import os

# Add server directory to path
sys.path.append(os.path.join(os.getcwd(), 'server'))

try:
    from app.services.assistant_service import assistant_service
    print("Successfully imported assistant_service")
except Exception as e:
    print(f"Failed to import: {e}")
    sys.exit(1)

# Mock mocks
class MockSession:
    def exec(self, *args, **kwargs):
        class Result:
            def all(self): return []
        return Result()

try:
    print("Testing chat function...")
    # Test with empty history and mock session
    session = MockSession()
    # We won't actually call OpenRouter to save tokens/time, just check if it gets to that point without crashing on context building
    # But wait, checking logic inside chat method.
    # It calls session.exec only if keywords found.
    # It calls client.chat.completions.create at the end.
    
    # We just want to see if it syntax checks out.
    print("Assistant Service initialized:", assistant_service)
    print("Tools knowledge:", len(assistant_service.tools_knowledge))
    
    print("Attempting chat with query 'Stories'...")
    # This will trigger client property access
    import asyncio
    response = asyncio.run(assistant_service.chat(session, 1, "Stories"))
    print("Chat response:", response)
    
    print("Debug verification passed.")
except Exception as e:
    print(f"Runtime error: {e}")
