# Scope Definition Manager

## Overview
The Scope Definition Manager helps Product Managers define, manage, and analyze project scopes efficiently. It enables PMs to streamline scope definition sessions, generate scope using AI, and track key project deliverables.

## Key Capabilities
- Create new scope definition sessions
- Get detailed insights into session data
- Generate scope definitions using AI
- Track scope items, assumptions, constraints, and deliverables
- Retry failed sessions for continuous improvement

## How to Use
To start using the Scope Definition Manager, begin by creating a new scope definition session. Input the necessary data and proceed to generate scope using AI. Analyze the scope items, assumptions, constraints, and deliverables to ensure project alignment. In case of a failed session, utilize the retry functionality to improve outcomes.

## Configuration & Fields
- **Session ID**: Unique identifier for the session
  - **Purpose**: Identifies the specific scope definition session
  - **Example**: "Q3 Project Kickoff"

- **Data**: Scope definition details
  - **Purpose**: Provides context for generating the project scope
  - **Example**: "Project requirements document"

- **Skip**: Number of sessions to skip for pagination
  - **Purpose**: Controls the session listing display
  - **Example**: 0

- **Limit**: Maximum number of sessions to display
  - **Purpose**: Manages the number of sessions shown per page
  - **Example**: 10

- **DB**: Database connection
  - **Purpose**: Stores session and project data
  - **Example**: "Project_DB_Connection"