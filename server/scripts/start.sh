#!/bin/bash
# Production startup script

echo "=== PS Prototype Server Startup ==="
echo "Working directory: $(pwd)"

# Run database migrations
echo "Running database migrations..."
alembic upgrade head || echo "Migration failed or already up to date"

# Start the server
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
