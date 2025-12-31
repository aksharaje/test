
# Goal Setting Manager

## Overview
The Goal Setting Manager helps Product Managers efficiently create, track, and manage goal setting sessions, enabling them to drive strategic alignment and monitor progress towards key objectives.

## Key Capabilities
- Create new goal setting sessions
- Retrieve and view specific goal setting sessions
- List all goal setting sessions with pagination
- Delete goal setting sessions along with associated goals
- Generate goals using AI for a session
- View all goals associated with a session
- Retry a failed goal setting session

## How to Use
To begin, start by creating a new goal setting session where you can define objectives and key results. You can then access and manage these sessions, generate goals using AI to enhance your planning process, and track progress towards achieving set goals.

## Configuration & Fields
- **Database**: Stores session data for tracking purposes.
  - **Purpose**: Provides a repository for storing and organizing goal setting information.
  - **Example**: "2022 Q4 Strategic Planning"

- **Data**: Information related to the goal setting session.
  - **Purpose**: Contains details about the objectives and key results for the session.
  - **Example**: "Increase user engagement by 15%"

- **Session ID**: Unique identifier for a goal setting session.
  - **Purpose**: Helps in identifying and accessing specific goal setting sessions.
  - **Example**: "GS-001"

- **Skip**: Number of sessions to skip for pagination.
  - **Purpose**: Allows for navigating through a large number of sessions efficiently.
  - **Example**: 10

- **Limit**: Maximum number of sessions to display per page.
  - **Purpose**: Controls the number of sessions shown on a single page for better readability.
  - **Example**: 20