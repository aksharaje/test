# Jira Manager

## Overview
Jira Manager helps you streamline project management tasks and track progress efficiently. Stay organized and collaborate seamlessly with your team to deliver results.

## Key Capabilities
- View and manage project states
- Generate OAuth URLs for secure integrations
- List all project integrations

## How to Use
To manage project states, start by cleaning up expired states using the "Cleanup Expired States" feature. Next, generate OAuth URLs for integrations by providing a return URL. Finally, list all integrations associated with your projects by providing a session reference.

## Configuration & Fields
- **Return URL**: Enter the URL where OAuth responses should be redirected. This field is optional.
  - **Purpose**: Used to redirect OAuth responses securely.
  - **Example**: "https://www.yourwebsite.com/oauth/callback"

- **Session Reference**: Provide a reference to the session for listing integrations.
  - **Purpose**: Identifies the session for retrieving integration details.
  - **Example**: "Project XYZ Session"