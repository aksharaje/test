#!/bin/bash
set -e

echo "Checking Alembic migration status..."

# Check if alembic_version table exists
TABLE_EXISTS=$(python -c "
from sqlalchemy import create_engine, inspect
import os

engine = create_engine(os.environ['DATABASE_URL'])
inspector = inspect(engine)
tables = inspector.get_table_names()
print('yes' if 'alembic_version' in tables else 'no')
")

if [ "$TABLE_EXISTS" = "no" ]; then
    echo "No alembic_version table found. Stamping current migration as applied..."
    # Tables already exist from Express.js, so just mark migration as done
    alembic stamp head
    echo "Migration stamped successfully."
else
    echo "Alembic version table exists. Running any pending migrations..."
    alembic upgrade head
    echo "Migrations complete."
fi

echo "Starting uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
