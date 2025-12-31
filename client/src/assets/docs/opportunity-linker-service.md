# Opportunity Mapper

## Overview
The Opportunity Mapper helps Product Managers transform ideas into actionable opportunities by assigning priority scores. It streamlines the process of evaluating and prioritizing potential projects based on strategic fit and estimated impact.

## Key Capabilities
- Create prioritization sessions
- Process and analyze opportunities
- Retrieve session details
- Delete unnecessary sessions

## How to Use
To begin, create a new prioritization session by providing the completed ideation session ID. Process the session to map opportunities, score strategic fit, estimate size, calculate priority, and generate a portfolio summary. You can then view session details, including all prioritized ideas, and delete sessions that are no longer needed.

## Configuration & Fields
- **Database**: Stores session data for analysis.
  - **Purpose**: Manages the information related to prioritization sessions.
  - **Example**: Product Roadmap Database

- **Ideation Session ID**: ID of the completed ideation session.
  - **Purpose**: Links the prioritization session to the initial ideation phase.
  - **Example**: Q3 Brainstorming Session ID

- **User ID**: Optional user identifier.
  - **Purpose**: Associates a specific user with the prioritization session.
  - **Example**: Product Manager John Doe's ID

- **Session ID**: Unique identifier for the prioritization session.
  - **Purpose**: Identifies and retrieves a specific prioritization session.
  - **Example**: Session #12345