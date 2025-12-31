# Measurement Framework Manager

## Overview
The Measurement Framework Manager helps Product Managers streamline the creation, management, and analysis of measurement framework sessions. It enables PMs to efficiently track and evaluate key metrics, data sources, and dashboards to drive informed decision-making.

## Key Capabilities
- Create new measurement framework sessions
- Retrieve and analyze session data
- Generate measurement frameworks using AI
- Manage and visualize metrics, data sources, and dashboards
- Retry failed sessions for improved outcomes

## How to Use
To get started with the Measurement Framework Manager, begin by creating a new session to outline your measurement objectives. Populate the session with relevant data sources and metrics. Utilize the AI-powered framework generation feature to enhance your measurement strategy. Analyze metrics, explore data sources, and view dashboards to gain insights. In case of failed sessions, retry for a more successful outcome.

## Configuration & Fields
- **Database Session**: Stores session data and metrics for analysis.
  - **Purpose**: Provides a repository for session information.
  - **Example**: "Q3 Sales Performance Data"

- **Data**: Information related to the measurement framework session.
  - **Purpose**: Defines the data to be analyzed within the session.
  - **Example**: "Customer Satisfaction Survey Results"

- **Session ID**: Unique identifier for each session.
  - **Purpose**: Facilitates session retrieval and management.
  - **Example**: "12345"

- **Skip**: Number of sessions to skip for pagination.
  - **Purpose**: Controls the display of session data for better organization.
  - **Example**: "0"

- **Limit**: Maximum number of sessions to display per page.
  - **Purpose**: Manages the quantity of sessions shown at once.
  - **Example**: "10"