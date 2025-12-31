# Idea Opportunity Mapper

## Overview
The Idea Opportunity Mapper helps Product Managers transform creative ideas into actionable opportunities by assessing their strategic fit and priority.

## Key Capabilities
- Create a new prioritization session
- Process a prioritization session
- View detailed information about prioritization sessions
- List all prioritization sessions
- Delete a prioritization session

## How to Use
To get started, create a new prioritization session to map out ideas and calculate priority scores. Process the session to evaluate strategic fit, estimate size, and determine priority tiers. You can then view detailed information about the session and delete it when necessary.

## Configuration & Fields
- **Database**: Database session
  - **What it's for**: Stores information related to your prioritization sessions.
  - **Example**: Storing data on idea mappings, priority scores, and session details.
- **Ideation Session ID**: ID of completed ideation session
  - **What it's for**: Links the current prioritization session to a previous ideation session.
  - **Example**: Connecting the prioritization of ideas generated in a brainstorming session.
- **User ID**: Optional user ID
  - **What it's for**: Associates a specific user with the prioritization session.
  - **Example**: Assigning ownership of the session to a particular Product Manager.