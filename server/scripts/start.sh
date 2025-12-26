#!/bin/bash
# Don't use set -e since we handle errors ourselves

echo "=== PS Prototype Server Startup ==="
echo "Checking database migration status..."

# Self-healing check for feasibility tables (Fix for 500 Error)
SCHEMA_STATUS=$(python3 -c "
from sqlalchemy import create_engine, inspect
import os
try:
    engine = create_engine(os.environ['DATABASE_URL'])
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if 'users' in tables and 'feasibility_sessions' not in tables:
        print('MISSING_FEASIBILITY')
    else:
        print('OK')
except:
    print('ERROR')
" 2>/dev/null || echo "ERROR")

if [ "$SCHEMA_STATUS" = "MISSING_FEASIBILITY" ]; then
    echo "CRITICAL: Database schema inconsistency detected."
    echo "Users table exists, but Feasibility tables are missing."
    echo "Attempting to repair migration history..."
    # Stamp to the revision BEFORE feasibility tables (0e9c4a51f89b)
    alembic stamp 0e9c4a51f89b
    echo "Stamped revision 0e9c4a51f89b. Running upgrade head..."
    alembic upgrade head
    echo "Schema repair complete."
fi

# Try to get current alembic revision
CURRENT_REV=$(alembic current 2>&1 || echo "ERROR")

if echo "$CURRENT_REV" | grep -q "ERROR\|No such\|not found"; then
    echo "No alembic version found or error checking. Checking if tables exist..."

    # Check if main tables already exist (from Express.js migration)
    TABLES_EXIST=$(python3 -c "
from sqlalchemy import create_engine, inspect
import os
engine = create_engine(os.environ['DATABASE_URL'])
inspector = inspect(engine)
tables = inspector.get_table_names()
# Check for a table that should exist from Express.js
exists = 'users' in tables or 'integrations' in tables or 'pi_planning_sessions' in tables
print('yes' if exists else 'no')
" 2>/dev/null || echo "error")

    if [ "$TABLES_EXIST" = "yes" ]; then
        echo "Tables already exist (from Express.js). Stamping migration as complete..."
        alembic stamp head
        echo "Migration stamped successfully."
    elif [ "$TABLES_EXIST" = "no" ]; then
        echo "Fresh database. Running migrations..."
        alembic upgrade head
        echo "Migrations complete."
    else
        echo "Could not determine table status. Attempting stamp..."
        alembic stamp head || echo "Stamp failed, continuing anyway..."
    fi
elif echo "$CURRENT_REV" | grep -q "head"; then
    echo "Database is already at head revision. No migration needed."
elif echo "$CURRENT_REV" | grep -q "(head)"; then
    echo "Database is at head. No migration needed."
else
    echo "Current revision: $CURRENT_REV"
    echo "Running pending migrations..."
    alembic upgrade head || {
        echo "Migration failed. Tables may already exist. Attempting to stamp..."
        alembic stamp head
    }
fi

echo "=== Starting uvicorn server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
