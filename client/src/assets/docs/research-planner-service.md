# ResearchPlannerService

## Overview
Service file: `research_planner_service.py`

Service for managing research planning sessions

## Methods
### client

### model

### create_session
Create a new research planning session with optional context sources

### get_session
Get a session by ID

### list_sessions
List all sessions, optionally filtered by user

### get_session_detail
Get complete session detail with all related data

### select_methods
User selects which methods to proceed with

### retry_session
Retry a failed session

### delete_session
Delete a session and all related data

### update_interview_guide
Update interview guide content (user edits)

### update_survey
Update survey questions (user edits)

### run_method_recommendation_pipeline
Pipeline Step 1: Recommend research methods based on objective.
Runs in background task.

### run_instrument_generation_pipeline
Pipeline Step 2: Generate instruments for selected methods.
Runs in background task.

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
