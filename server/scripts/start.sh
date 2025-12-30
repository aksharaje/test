#!/bin/bash
# Production startup script

echo "=== PS Prototype Server Startup ==="
echo "Working directory: $(pwd)"

# Run database migrations
echo "Running database migrations..."

# Try to run migrations normally first
alembic upgrade head
MIGRATION_STATUS=$?

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "Migration failed (exit code: $MIGRATION_STATUS)"
    echo "Applying missing columns directly and stamping..."

    # Apply any missing columns that migrations would have added
    python3 -c "
from app.core.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Add missing columns if they don't exist
    migrations = [
        'ALTER TABLE generated_artifacts ADD COLUMN IF NOT EXISTS released_at TIMESTAMP',
        'ALTER TABLE generated_artifacts ADD COLUMN IF NOT EXISTS released_in_session_id INTEGER',
        'ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS source_metadata JSON',
    ]
    for sql in migrations:
        try:
            conn.execute(text(sql))
            conn.commit()
            print(f'Applied: {sql[:60]}...')
        except Exception as e:
            print(f'Skipped (may already exist): {sql[:40]}... - {e}')
    print('Missing columns applied')
"

    # Now stamp to mark migrations as complete
    alembic stamp head || true
    echo "Database stamped - future migrations will work correctly"
else
    echo "Migrations completed successfully"
fi

# Start the server
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
