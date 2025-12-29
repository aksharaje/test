# BusinessCaseService

## Overview
Service file: `business_case_service.py`

Service for managing business case analysis sessions

## Methods
### client

### model

### create_session
Create a new business case session.

If feasibility_session_id is provided, feature_name and feature_description
are derived from the feasibility session if not provided.

### get_session
Get a session by ID

### list_sessions
List all sessions, optionally filtered by user

### get_session_detail
Get complete session with all related data

### update_cost_item
Update cost item with user override

### update_benefit_item
Update benefit item with user override

### delete_session
Delete session and all related data

### update_rate_assumption
Update a rate assumption with user override

### get_user_rate_preferences
Get user's previous rate preferences for a company size

### get_rate_assumptions
Get all rate assumptions for a session

### save_user_learning
Save a user correction for future learning

### run_business_case_pipeline
Main pipeline: orchestrates 5 AI agents

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
