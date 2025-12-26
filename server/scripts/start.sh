#!/bin/bash
# Don't use set -e since we handle errors ourselves

echo "=== PS Prototype Server Startup ==="
echo "Checking database migration status..."

# Robust Self-healing Migration Strategy
SCHEMA_STATUS=$(python3 << 'PYTHON_EOF'
from sqlalchemy import create_engine, inspect
import os
try:
    engine = create_engine(os.environ['DATABASE_URL'])
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    # Critical tables that MUST exist
    required = ['ideation_sessions', 'feasibility_sessions', 'generated_prds']
    missing = [t for t in required if t not in tables]

    if missing:
        print("MISSING:" + ",".join(missing))
    else:
        print("OK")
except Exception as e:
    print("ERROR: " + str(e))
PYTHON_EOF
)

echo "Schema check result: $SCHEMA_STATUS"

if [[ "$SCHEMA_STATUS" == MISSING* ]] || [[ "$SCHEMA_STATUS" == ERROR* ]] || [[ -z "$SCHEMA_STATUS" ]]; then
    echo "CRITICAL: Database schema check failed ($SCHEMA_STATUS). Initiating repair..."

    # Strategy:
    # 1. Stamp 'base' to tell Alembic "we have nothing" (reset history)
    # 2. Run 'upgrade head' to run ALL migrations
    # 3. Since we patched initial_migration.py to be idempotent, it won't crash on existing tables

    echo "Stamping to base (resetting migration history)..."
    alembic stamp base || echo "Warning: stamp base failed (may be ok if fresh db)"

    echo "Running full migration upgrade..."
    if alembic upgrade head; then
        echo "Schema repair complete."
    else
        echo "ERROR: Migration failed! Check database connection and migration files."
        echo "Continuing to start server anyway..."
    fi
else
    echo "Database schema check passed (status: $SCHEMA_STATUS)"
    echo "Running alembic upgrade head to ensure latest migrations..."
    alembic upgrade head || echo "Warning: upgrade head had issues"
fi

echo "=== Starting uvicorn server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
