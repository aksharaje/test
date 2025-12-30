#!/bin/bash
# Production startup script

echo "=== PS Prototype Server Startup ==="
echo "Working directory: $(pwd)"

# Run database migrations
echo "Running database migrations..."

# Try to run migrations
alembic upgrade head
MIGRATION_STATUS=$?

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "Warning: Alembic migration failed (exit code: $MIGRATION_STATUS)"
fi

# ALWAYS run this safety check to ensure critical columns exist,
# regardless of what Alembic thinks (fixes 'UndefinedColumn' errors if Alembic is out of sync)
echo "Verifying critical schema columns..."
python3 -c "
import sys
import logging
from sqlalchemy import text, inspect

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('schema_fixer')

try:
    from app.core.db import engine
    
    with engine.connect() as conn:
        # Define columns that MUST exist
        # format: (table, column, type_def)
        required_columns = [
            ('generated_artifacts', 'released_at', 'TIMESTAMP'),
            ('generated_artifacts', 'released_in_session_id', 'INTEGER'),
            ('knowledge_bases', 'source_metadata', 'JSON'),
        ]
        
        inspector = inspect(conn)
        
        for table, col, type_def in required_columns:
            # Check if table exists first
            if not inspector.has_table(table):
                logger.warning(f'Table {table} does not exist, skipping column check.')
                continue
                
            # Check if column exists
            columns = [c['name'] for c in inspector.get_columns(table)]
            if col not in columns:
                logger.info(f'Missing column detected: {table}.{col}. Adding it now...')
                try:
                    # Use idempotent add if supported, or just add
                    # Postgres supports IF NOT EXISTS for columns in recent versions, 
                    # but pure SQL alchemy text call is safest
                    sql = f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {type_def}'
                    conn.execute(text(sql))
                    conn.commit()
                    logger.info(f'Successfully added {table}.{col}')
                except Exception as e:
                    logger.error(f'Failed to add {table}.{col}: {e}')
            else:
                logger.info(f'Column {table}.{col} already exists.')
                
except Exception as e:
    logger.error(f'Schema verification failed: {e}')
    # We don't exit here because we want to try starting the server anyway,
    # as the error might be unrelated to the core DB connection.
"

echo "Schema verification completed."

# Start the server
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
