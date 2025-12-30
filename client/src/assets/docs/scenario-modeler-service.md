# ScenarioModelerService

## Overview
Service file: `scenario_modeler_service.py`

Service for Scenario Modeler operations

## Methods
### llm
Lazy load the strict JSON LLM

### create_session
Create a new scenario modeling session from an existing roadmap

### get_session
Get a session by ID

### get_sessions
Get all sessions, optionally filtered by user

### get_sessions_for_roadmap
Get all scenario sessions for a specific roadmap

### delete_session
Delete a session and all its variants

### get_full_session
Get session with all variants and comparison

### get_variants
Get all variants for a session

### get_variant
Get a variant by ID

### create_variant
Create a new scenario variant

### create_variant_from_template
Create a variant from a predefined template

### update_variant
Update a variant

### delete_variant
Delete a variant

### get_scenario_templates
Get available scenario templates

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
