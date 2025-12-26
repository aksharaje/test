# IdeationService

## Overview
Service file: `ideation_service.py`

Service for managing ideation sessions and SMART goals

## Methods
### client

### model

### create_session
Create new ideation session

### get_session
Get session by ID

### list_sessions
List sessions for user with pagination

### retry_session
Reset failed session to pending for retry

### get_session_detail
Get session with clusters, ideas, and prioritized backlog

### update_idea
Update idea fields

### delete_session
Delete session and all related data

### run_ideation_pipeline
Main async pipeline: 7 steps
1. Parse input → structured problem
2. Generate 18 ideas (4 categories)
3. Create embeddings & cluster into 3-5 themes
4. Enrich with use cases, edge cases, notes
5. Score on 5 criteria
6. Deduplicate to 15-16 final ideas

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
