from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
from app.core.config import settings

# Fix for "postgres://" scheme which SQLAlchemy doesn't support anymore (it wants "postgresql://")
database_url = str(settings.DATABASE_URL)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(database_url)

def get_session():
    with Session(engine) as session:
        yield session

def ensure_schema_migrations():
    """
    Run ad-hoc migrations for schema changes that Alembic might have missed
    or when running in an environment where we can't run alembic.
    """
    try:
        with engine.connect() as conn:
            # Check if account_id column exists in users table
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='account_id'"
            ))
            if not result.scalar():
                print("Migrating: Adding account_id column to users table")
                conn.execute(text("ALTER TABLE users ADD COLUMN account_id INTEGER REFERENCES accounts(id)"))
                conn.commit()
                print("Migration successful: Added account_id to users")
            else:
                print("Schema check: users.account_id exists")
                
    except Exception as e:
        print(f"Schema migration warning: {e}")

def create_db_and_tables():
    """Create all tables. Safe to call multiple times (idempotent)."""
    # First ensure pgvector extension exists (needed for embeddings)
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
            print("pgvector extension enabled")
    except Exception as e:
        print(f"Warning: Could not enable pgvector extension: {e}")

    # Import all models to register them with SQLModel
    from app.models import ideation, feasibility, research_planner, business_case, account
    
    # Create all tables (checkfirst=True is default, won't fail if exists)
    SQLModel.metadata.create_all(engine)
    print("Database tables created/verified")
    
    # Run manual migrations after tables are created
    ensure_schema_migrations()
