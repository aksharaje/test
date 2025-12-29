# FeasibilityService

## Overview
Service file: `feasibility_service.py`

Service for managing feasibility analysis sessions

## Methods
### client

### model

### create_session
Create a new feasibility analysis session

### get_session
Get a session by ID

### list_sessions
List all sessions, optionally filtered by user, with pagination

### retry_session
Retry a failed session.
Resets status and triggers background processing.

### get_session_detail
Get complete session detail with all related data.
Returns: Dict with session, components, scenarios, risks, skills

### update_component
Update component estimates (if editable)

### capture_actuals
Capture actual results for learning.
actuals_data: List of dicts with component_id, actual_hours_spent, lessons_learned

### delete_session
Delete a session and all related data (cascade)

### run_feasibility_pipeline
Main pipeline: orchestrates 4 AI agents sequentially.
Runs in background task.

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
