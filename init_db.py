import sys
import os

# Add server_py to path
sys.path.append(os.path.join(os.path.dirname(__file__), "server"))

from app.core.db import create_db_and_tables, engine
from sqlalchemy import text

print("Testing database connection...")
try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"Connection successful: {result.scalar()}")
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)

print("Creating tables...")
try:
    create_db_and_tables()
    print("Tables created successfully.")
except Exception as e:
    print(f"Table creation failed: {e}")
    sys.exit(1)
