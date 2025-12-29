# StoryToCodeService

## Overview
Service file: `story_to_code_service.py`

Service for converting user stories to code.

## Methods
### client

### model

### create_session
Create a new story-to-code session.

### get_session
Get session by ID.

### list_sessions
List sessions with pagination.

### delete_session
Delete a session.

### retry_session
Reset a failed session for retry.

### list_story_artifacts
List user story artifacts (epics, features, user stories) for selection.

### list_code_knowledge_bases
List knowledge bases that have code/github content.

### process_session
Main async pipeline for code generation.

### create_zip
Convert the generated files into a ZIP byte stream.

### generate
Legacy generate method for backwards compatibility.

### list_requests
Legacy list method for backwards compatibility.

### get_artifact
Legacy get artifact method for backwards compatibility.

> [!NOTE]
> This documentation was auto-generated without AI enhancement.
