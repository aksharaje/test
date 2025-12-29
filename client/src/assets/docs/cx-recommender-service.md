# CXRecommenderService

## Overview
Service file: `cx_recommender_service.py`

Service for generating CX improvement recommendations

## Methods
### llm
Get the strict JSON LLM instance.

### create_session
Create a new recommender session.

### get_session
Get a session by ID.

### list_sessions
List all sessions, optionally filtered by user.

### get_session_detail
Get complete session detail with all recommendations.

### delete_session
Delete a session and all related data.

### get_recommendation
Get a single recommendation by ID.

### update_recommendation
Update a recommendation (user edits).

### dismiss_recommendation
Dismiss (soft delete) a recommendation.

### restore_recommendation
Restore a dismissed recommendation.

### add_custom_recommendation
Manually add a custom recommendation.

### run_recommendation_pipeline
Main pipeline for generating recommendations. Runs in background task.

### list_available_journey_maps
List completed journey maps available for selection.

### list_available_gap_analyses
List completed gap analyses available for selection.

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
