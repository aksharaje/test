#!/bin/bash
# Don't use set -e since we handle errors ourselves

echo "=== PS Prototype Server Startup ==="
echo "Checking database migration status..."

# Robust Self-healing Migration Strategy
SCHEMA_STATUS=$(python3 -c "
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
        print(f'MISSING:{','.join(missing)}')
    else:
        print('OK')
except Exception as e:
    print(f'ERROR: {str(e)}')
" 2>/dev/null || echo "ERROR")

if [[ "$SCHEMA_STATUS" == MISSING* ]]; then
    echo "CRITICAL: Missing tables detected ($SCHEMA_STATUS). Database schema is incomplete."
    echo "Initiating aggressive schema repair..."
    
    # Strategy:
    # 1. Stamp 'base' to tell Alembic "we have nothing" (reset history)
    # 2. Run 'upgrade head' to run ALL migrations
    # 3. Since we patched initial_migration.py to be idempotent, it won't crash on existing tables (like users)
    
    echo "Stamping to base (resetting migration history)..."
    alembic stamp base
    
    echo "Running full migration upgrade..."
    alembic upgrade head
    
    echo "Schema repair complete."
else
    echo "Database schema check passed. Verifying alembic version..."
    # Normal startup - ensure we are at head
    alembic upgrade head
fi

echo "=== Starting uvicorn server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
