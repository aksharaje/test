# ReleasePrepService

## Overview
Service file: `release_prep_service.py`

Service for Release Prep artifact generation

## Methods
### llm
Lazy load the strict JSON LLM

### create_session
Create a new release prep session

### get_session
Get a session by ID

### get_sessions
Get all sessions, optionally filtered by user

### delete_session
Delete a session and all related artifacts

### get_available_stories
Get artifacts from Story Generator, Epic Creator, and Feature Creator

Args:
    include_released: If True, include stories already in a release (for debugging)

### get_session_stories
Get all stories for a session

### get_release_notes
Get all release notes for a session

### get_decisions
Get all decisions for a session

### get_debt_items
Get all technical debt items for a session

### update_release_note
Update a release note

### update_decision
Update a decision

### update_debt_item
Update a technical debt item

### create_debt_item
Create a new technical debt item manually

### unrelease_artifact
Remove released status from an artifact so it can be included in future releases

### unrelease_session_artifacts
Remove released status from all artifacts in a session.
Returns count of artifacts unreleased.

### export_release_notes_markdown
Export release notes as markdown

### export_decision_log_markdown
Export decision log as markdown

### export_debt_inventory_markdown
Export technical debt inventory as markdown

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
