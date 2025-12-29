# JourneyMapperService

## Overview
Service file: `journey_mapper_service.py`

Service for managing journey mapping sessions

## Methods
### client

### model

### create_session
Create a new journey mapping session.

### get_session
Get a session by ID.

### list_sessions
List all sessions, optionally filtered by user.

### get_session_detail
Get complete session detail with all related data.

### delete_session
Delete a session and all related data.

### update_pain_point
Update a pain point (user edits).

### add_pain_point
Manually add a pain point.

### delete_pain_point
Delete a pain point.

### update_stage
Update a stage in the journey map.

### add_stage
Add a new stage to the journey map.

### delete_stage
Delete a stage from the journey map.

### run_journey_generation_pipeline
Main pipeline for generating journey maps. Runs in background task.

### add_competitor_observation
Add an observation during competitive walkthrough.

### create_new_version
Create a new version of a journey map with updated data.

### run_version_update_pipeline
Pipeline for updating an existing journey with new data and computing deltas.

### compare_versions
Compare two journey map versions.

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
