# Story Generator

## Overview
The Story Generator helps product managers create compelling narratives for their products, enhancing communication and alignment across teams. It enables PMs to craft engaging stories that resonate with stakeholders and customers.

## Key Capabilities
- Generate story prompts
- Retrieve contextual knowledge
- Manage and update story artifacts

## How to Use
To begin, start by requesting a system prompt based on the type and title you want to explore. Use the retrieved knowledge base context to enrich your story. Generate a narrative based on the gathered information and manage your story artifacts effectively.

## Configuration & Fields

- **Type**: Type of prompt
  - **What it's for**: Specifies the category or theme for the story prompt.
  - **Example**: "Product Launch", "Customer Journey"

- **Title**: Title of the prompt
  - **What it's for**: Provides a specific focus for the story prompt.
  - **Example**: "New Feature Announcement", "User Persona Story"

- **Session**: Work session identifier
  - **What it's for**: Tracks and manages the current working session.
  - **Example**: "Q3 Strategy Meeting", "Product Ideation Workshop"

- **Knowledge Base IDs**: Connected knowledge sources
  - **What it's for**: Identifies relevant sources of information to enhance the story.
  - **Example**: Linked customer feedback, market research reports

- **Query**: Search query for knowledge retrieval
  - **What it's for**: Refines the information search to specific topics or keywords.
  - **Example**: "Competitor Analysis", "Trend Forecasting"

- **Limit**: Result limit for retrieved knowledge
  - **What it's for**: Controls the quantity of information retrieved for the story.
  - **Example**: 5, 10

- **Response**: Cleaned JSON response
  - **What it's for**: Formats the retrieved data for easy understanding and utilization.
  - **Example**: Well-structured story insights

- **Request**: Story generation request details
  - **What it's for**: Specifies the parameters and content for generating the narrative.
  - **Example**: Story outline, key points

- **User ID**: User identifier for artifact management
  - **What it's for**: Associates artifacts with specific users for tracking and access control.
  - **Example**: Assigned team member ID

- **ID**: Artifact identifier
  - **What it's for**: Uniquely identifies a story artifact for retrieval and updates.
  - **Example**: 12345

- **Data**: Updated artifact details
  - **What it's for**: Contains the revised content or information for the artifact.
  - **Example**: Revised storyline, additional insights