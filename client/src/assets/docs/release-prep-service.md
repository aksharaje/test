# Release Prep Agent

## Overview
The Release Prep Agent helps Product Managers generate release documentation artifacts from user stories. It creates three key outputs: Release Notes (user-facing changelog), Decision Log (technical and product decisions), and Technical Debt Inventory (debt items identified during development).

## Key Capabilities
- Select epics, features, or stories from Epic Creator, Feature Creator, or Story Generator
- Generate user-facing release notes categorized by type
- Extract technical and product decisions with context and rationale
- Identify technical debt items with impact assessment
- Inline editing of all generated content
- Export to Markdown for documentation systems
- Track debt balance across releases

## How to Use
1. Navigate to Development > Release Prep in the sidebar
2. Enter a session name and release version (optional)
3. Select completed epics, features, or stories from available artifacts
4. Optionally add manual stories that aren't in the system
5. Click "Generate Release Artifacts" to start the pipeline
6. Review and edit the generated content
7. Export artifacts as needed for your release process

## Configuration & Fields

### Release Name (Optional)
- **What it's for**: Give your release a memorable name
- **How to use**: Enter a descriptive name that identifies this release
- **Example**: "Q1 2025 Release", "v2.4.0", "Sprint 12 Features", "Mobile App 3.0"

### Select Stories (Required)
- **What it's for**: Choose which epics, features, or stories to process
- **How to use**: Check the items from Epic Creator, Feature Creator, or Story Generator that are part of this release
- **Example**: Select "Authentication Epic" (contains 3 features, 12 stories) or "Login flow redesign" (Feature with 4 stories)
- **Note**: Epics and features show how many stories they contain.

### Manual Stories (Optional)
- **What it's for**: Add stories that aren't in the Story Generator
- **How to use**: Click "Add Story" and fill in title, type, and content
- **Example**: Add a story for a hotfix that was done outside the normal workflow

## Understanding Results

### Release Notes Tab
Shows user-facing changelog items organized by category:
- **Feature** (blue): New capabilities added
- **Improvement** (green): Enhancements to existing features
- **Fix** (amber): Bug fixes
- **Security** (red): Security-related changes
- **Performance** (purple): Performance improvements
- **Breaking Change** (red): Changes that may affect existing users

Each note shows the title, description, and user impact. Use the eye icon to exclude notes you don't want in the final export.

### Decision Log Tab
Shows technical and product decisions extracted from stories:
- **Title**: Short description of the decision
- **Type**: Technical, Architectural, Product, Process, or Security
- **Impact Level**: Low, Medium, High, or Critical
- **Rationale**: Why this decision was made
- **Alternatives**: Other options that were considered

### Technical Debt Tab
Shows identified debt items:
- **Type**: Code, Design, Architecture, Testing, Documentation, or Infrastructure
- **Impact Level**: Color-coded from green (low) to red (critical)
- **Affected Area**: Which part of the system is impacted
- **Effort Estimate**: Approximate effort to address
- **Risk**: What could happen if not addressed

You can add new debt items manually using the "Add Debt Item" button.

## Export Options
- **Download**: Exports the current tab as a Markdown file
- **Copy**: Copies the content to your clipboard

## Quality Scores
Each artifact type shows a quality score (0-100%):
- **Completeness**: How thoroughly the content covers the input stories
- **Clarity**: How clear and understandable the content is

These scores help identify areas that may need manual review or enhancement.
