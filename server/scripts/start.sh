#!/bin/bash
# Production startup script with robust migration handling

echo "=== PS Prototype Server Startup ==="
echo "Working directory: $(pwd)"
echo "Python version: $(python3 --version)"

# First, ensure pgvector extension is enabled (required for embeddings)
echo "Checking/enabling pgvector extension..."
python3 << 'PYTHON_EOF'
from sqlalchemy import create_engine, text
import os
import sys

try:
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url:
        print("ERROR: DATABASE_URL not set!")
        sys.exit(1)

    # Fix postgres:// -> postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Enable pgvector extension (required for embeddings)
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
        print("pgvector extension enabled")
except Exception as e:
    print(f"Warning: Could not enable pgvector: {e}")
    # Continue anyway - some tables don't need it
PYTHON_EOF

# Check current database state
echo ""
echo "Checking database state..."
SCHEMA_STATUS=$(python3 << 'PYTHON_EOF'
from sqlalchemy import create_engine, inspect, text
import os
import sys

try:
    db_url = os.environ.get('DATABASE_URL', '')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    print(f"Found {len(tables)} tables: {', '.join(sorted(tables)[:10])}...")

    # Check alembic version
    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            print(f"Alembic version: {version}")
        except Exception as e:
            print(f"Alembic version table not found: {e}")

    # Critical tables
    required = ['ideation_sessions', 'feasibility_sessions', 'generated_prds']
    missing = [t for t in required if t not in tables]

    if missing:
        print(f"MISSING: {','.join(missing)}")
    else:
        print("OK")

except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
PYTHON_EOF
)

echo "Schema status: $SCHEMA_STATUS"

# Run migrations based on state
if echo "$SCHEMA_STATUS" | grep -q "MISSING:"; then
    echo ""
    echo "=== Missing tables detected - Running migrations ==="

    # Check if alembic_version exists
    HAS_ALEMBIC=$(python3 << 'PYTHON_EOF'
from sqlalchemy import create_engine, text
import os
db_url = os.environ.get('DATABASE_URL', '')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
engine = create_engine(db_url)
with engine.connect() as conn:
    try:
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        version = result.scalar()
        print(f"HAS_VERSION:{version}" if version else "NO_VERSION")
    except:
        print("NO_TABLE")
PYTHON_EOF
)

    echo "Alembic state: $HAS_ALEMBIC"

    if echo "$HAS_ALEMBIC" | grep -q "NO_TABLE"; then
        echo "No alembic_version table - stamping base..."
        alembic stamp base 2>&1 || echo "Warning: stamp base had issues"
    elif echo "$HAS_ALEMBIC" | grep -q "NO_VERSION"; then
        echo "Empty alembic_version - stamping base..."
        alembic stamp base 2>&1 || echo "Warning: stamp base had issues"
    fi

    echo ""
    echo "Running alembic upgrade head..."
    # Actually capture and show errors
    UPGRADE_OUTPUT=$(alembic upgrade head 2>&1)
    UPGRADE_STATUS=$?
    echo "$UPGRADE_OUTPUT"

    if [ $UPGRADE_STATUS -ne 0 ]; then
        echo ""
        echo "=== MIGRATION FAILED (exit code: $UPGRADE_STATUS) ==="
        echo "Attempting direct table creation fallback..."

        # Fallback: Create tables directly using SQLModel
        python3 << 'FALLBACK_EOF'
import os
import sys

# Add current directory to path
sys.path.insert(0, os.getcwd())

try:
    from sqlalchemy import create_engine
    from sqlmodel import SQLModel

    # Import all models to register them
    from app.models import *

    db_url = os.environ.get('DATABASE_URL', '')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)

    # Create all tables that don't exist
    SQLModel.metadata.create_all(engine, checkfirst=True)
    print("Direct table creation completed!")

except Exception as e:
    print(f"Fallback table creation failed: {e}")
    import traceback
    traceback.print_exc()
FALLBACK_EOF

    else
        echo "Migrations completed successfully!"
    fi

elif echo "$SCHEMA_STATUS" | grep -q "ERROR:"; then
    echo "Database connection error - cannot run migrations"
    echo "Will attempt to start server anyway..."
else
    echo "All required tables exist."
    echo "Running alembic upgrade head to ensure latest migrations..."
    alembic upgrade head 2>&1 || echo "Warning: upgrade had issues (may be ok if already current)"
fi

echo ""
echo "=== Starting uvicorn server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
