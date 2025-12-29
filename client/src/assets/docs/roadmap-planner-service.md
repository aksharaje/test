# RoadmapPlannerService

## Overview
Service file: `roadmap_planner_service.py`

Service for Roadmap Planner operations

## Methods
### llm
Lazy load the strict JSON LLM

### create_session
Create a new roadmap planning session

### get_session
Get a session by ID

### get_sessions
Get all sessions, optionally filtered by user

### delete_session
Delete a session and all related data

### get_available_artifacts
Get epics and features from Story Generator available for roadmap planning

### get_available_feasibility_analyses
Get completed feasibility analyses available for roadmap planning

### get_available_ideation_ideas
Get ideation ideas available for roadmap planning (final, non-duplicate)

### get_all_available_sources
Get all available sources for roadmap planning in one call

### get_items
Get all items for a session

### update_item
Update a roadmap item

### get_dependencies
Get all dependencies for a session

### create_dependency
Create a manual dependency

### delete_dependency
Delete a dependency

### get_themes
Get all themes for a session

### get_milestones
Get all milestones for a session

### create_milestone
Create a milestone

### update_milestone
Update a milestone

### delete_milestone
Delete a milestone

### get_segments
Get all segments for a session (via items)

### get_segments_for_item
Get all segments for a specific item

### create_segment
Create a new segment for an item

### update_segment
Update a segment

### update_segments_bulk
Bulk update segments (for drag-and-drop)

### delete_segment
Delete a segment

### delete_segments_for_item
Delete all segments for an item, returns count deleted

### regenerate_segments_for_item
Regenerate default segments for an item based on its current
assigned_sprint, sprint_span, assigned_team, and effort_points.
Deletes existing segments first.

### get_dependency_graph
Build dependency graph for visualization

### get_sprint_summaries
Get sprint-by-sprint breakdown, accounting for items that span multiple sprints

### export_roadmap_json
Export roadmap as JSON

### export_roadmap_csv
Export roadmap as CSV

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
