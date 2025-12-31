import sys
import os
from sqlalchemy import text
from sqlmodel import create_engine

# Add parent directory to path to import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.core.db import engine

def reset_auth_tables():
    with engine.connect() as conn:
        print("Dropping auth tables if they exist...")
        conn.execute(text("DROP TABLE IF EXISTS account_invites CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS magic_links CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS accounts CASCADE"))
        
        print("Dropping auth columns from users if they exist...")
        # We need to drop columns individually
        columns = ['account_id', 'role', 'is_active', 'full_name', 'has_accepted_terms']
        for col in columns:
            try:
                conn.execute(text(f"ALTER TABLE users DROP COLUMN IF EXISTS {col} CASCADE"))
            except Exception as e:
                print(f"Error dropping column {col}: {e}")
        
        conn.commit()
        print("Done.")

if __name__ == "__main__":
    reset_auth_tables()
