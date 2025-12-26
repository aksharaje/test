# OpportunityLinkerService

## Overview
Service file: `opportunity_linker_service.py`

Service for mapping ideas to opportunities and calculating priority scores

## Methods
### create_session
Create a new prioritization session and start processing.

Args:
    db: Database session
    ideation_session_id: ID of completed ideation session
    user_id: Optional user ID

Returns:
    Created prioritization session

Raises:
    ValueError: If ideation session not found or not completed

### process_session
Process a prioritization session through all agents.

This is the main workflow that:
1. Maps opportunities for each idea (Agent 7)
2. Scores strategic fit (Agent 8)
3. Estimates size (Agent 9)
4. Calculates priority and assigns tiers (Agent 10)
5. Generates portfolio summary

Args:
    db: Database session
    session_id: Prioritization session ID

Returns:
    Updated prioritization session

### get_session
Get a prioritization session by ID

### list_sessions
List all prioritization sessions, optionally filtered by user

### get_session_detail
Get session with all prioritized ideas

### delete_session
Delete a prioritization session

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
