# Opportunity Mapper

## Overview
Opportunity Mapper helps Product Managers translate ideas into actionable opportunities by assigning priority scores. It streamlines the process of evaluating and selecting the most promising concepts for further development.

## Key Capabilities
- Create a new prioritization session
- Process and analyze opportunities
- View detailed session insights
- Delete unnecessary sessions

## How to Use
To begin, initiate a new prioritization session and input the completed ideation session ID. The system will then map out opportunities for each idea, score their strategic fit, estimate their size, calculate priority, and generate a portfolio summary.

## Configuration & Fields
- **Database**: A storage system for all session data.
  - **What it's for**: Stores information related to prioritization sessions.
  - **Example**: Storing session details, such as idea mappings and priority scores.

- **Ideation Session ID**: Identifier for the completed ideation session.
  - **What it's for**: Links the current prioritization session to a previously completed ideation session.
  - **Example**: Connecting the prioritization of opportunities to initial idea generation.

- **User ID**: Optional identifier for the user initiating the session.
  - **What it's for**: Tracks the user responsible for the prioritization session.
  - **Example**: Assigning credit to the Product Manager leading the opportunity evaluation process.