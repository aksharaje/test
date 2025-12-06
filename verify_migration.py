import sys
import os

# Add server_py to path
sys.path.append(os.path.join(os.path.dirname(__file__), "server"))

from app.models.agent import Agent
from app.models.user import User
from sqlmodel import SQLModel

print("Imports successful!")
print("Verifying models...")
try:
    user = User(email="test@example.com", name="Test User")
    agent = Agent(name="Test Agent", system_prompt="You are a test agent.")
    print("Models instantiated successfully.")
except Exception as e:
    print(f"Model verification failed: {e}")
    sys.exit(1)

print("Verification complete.")
