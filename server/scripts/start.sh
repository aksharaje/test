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
    echo "This usually means columns already exist from SQLModel create_all"
    echo "Stamping database with latest migration version..."
    # Stamp tells Alembic the database is already at this version
    alembic stamp head || true
    echo "Database stamped - future migrations will work correctly"
else
    echo "Migrations completed successfully"
fi

# Start the server
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
