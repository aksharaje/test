# Story to Code Converter

## Overview
The Story to Code Converter helps Product Managers translate user stories into executable code, streamlining the development process and ensuring alignment between business requirements and technical implementation.

## Key Capabilities
- Create new story-to-code sessions
- Retrieve and manage existing sessions
- Generate code from user stories
- List and select user story artifacts for coding
- Convert generated files into downloadable ZIP format

## How to Use
To begin, start by creating a new session where you can input the description of the user story, select the input source, and specify any additional technical details. Once the session is created, you can manage it by retrieving, updating, or deleting as needed. Utilize the code generation pipeline to automatically convert the user story into executable code. Finally, download the generated code files in a ZIP format for further development.

## Configuration & Fields
- **Input Description**: Descriptive label for the user story.
  - **Purpose**: Provides context for code generation.
  - **Example**: "E-commerce Checkout Feature Details"
  
- **Title**: Title for the story-to-code session.
  - **Purpose**: Helps identify the session.
  - **Example**: "New Payment Gateway Integration"
  
- **Input Source**: Source of the user story (e.g., customer feedback, product backlog).
  - **Purpose**: Guides the development process.
  - **Example**: "Customer Support Ticket #12345"
  
- **Source Artifact ID**: Identifier for the source artifact.
  - **Purpose**: Links the user story to the original artifact.
  - **Example**: "Feature ID: F123"
  
- **Tech Stack**: Technology stack to be used for code implementation.
  - **Purpose**: Specifies the tools and frameworks for development.
  - **Example**: "React, Node.js"
  
- **Connected Knowledge Base**: Knowledge base with relevant code/github content.
  - **Purpose**: Provides additional resources for coding.
  - **Example**: "Technical Documentation Repository"
  
- **Owner**: User responsible for the session.
  - **Purpose**: Assigns accountability for the code generation process.
  - **Example**: "Product Manager John Doe"