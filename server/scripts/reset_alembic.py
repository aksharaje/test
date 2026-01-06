"""Reset alembic_version table to allow fresh migration run."""
import os
from sqlalchemy import create_engine, text

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("DATABASE_URL not set, skipping alembic reset")
    exit(0)

engine = create_engine(database_url)

with engine.connect() as conn:
    # Clear the alembic_version table
    conn.execute(text("DELETE FROM alembic_version"))
    conn.commit()
    print("Cleared alembic_version table")
