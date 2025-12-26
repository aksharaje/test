#!/bin/bash
# Production startup script - tables are created in FastAPI lifespan

echo "=== PS Prototype Server Startup ==="
echo "Working directory: $(pwd)"

# Start the server - table creation happens in FastAPI lifespan
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
