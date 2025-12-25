#!/bin/bash

# Port to check
PORT=8000

# check if lsof is installed
if ! command -v lsof &> /dev/null; then
    echo "lsof could not be found, attempting to identify running process via ps"
     # This part is a fallback and might need adjustment for specific OS
fi

echo "Checking for processes on port $PORT..."
PIDS=$(lsof -i :$PORT -t)

if [ -n "$PIDS" ]; then
    echo "Killing processes: $PIDS"
    kill -9 $PIDS
    echo "Port $PORT freed."
else
    echo "Port $PORT is free."
fi

# Activate venv if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Starting Uvicorn..."
uvicorn app.main:app --reload --port $PORT
