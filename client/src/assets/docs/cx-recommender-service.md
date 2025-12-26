# CX Improvement Recommender

## Overview
The CX Improvement Recommender helps Product Managers generate prioritized improvement recommendations by synthesizing pain points from customer journey maps and gaps from competitive analysis. It produces categorized recommendations (Quick Wins, High Impact, Strategic) with effort estimates and success metrics.

## Key Capabilities
- Generate improvement recommendations from journey map pain points
- Incorporate competitive gap analysis insights
- Automatically categorize recommendations by impact and effort
- Provide implementation approaches with pros/cons
- Generate sprint planning suggestions
- Export recommendations for stakeholder review

## How to Use
1. Start by selecting one or more completed journey maps that contain pain points you want to address
2. Optionally add completed gap analyses to incorporate competitive insights
3. Configure your recommendation focus (comprehensive, quick wins, strategic, or parity)
4. Set timeline constraints if you have specific delivery windows
5. Add team capacity information for more accurate effort estimates
6. Click "Generate Recommendations" to start the AI-powered analysis
7. Review results organized in three columns: Quick Wins, High Impact, and Strategic

## Configuration & Fields

### Select Journey Maps (Required)
- **What it's for**: Choose which completed journey maps to analyze for pain points
- **How to use**: Check one or more journey maps from the list. Each shows the journey description, number of stages, and pain point count.
- **Example**: Select "Mobile app onboarding journey" (5 stages, 8 pain points)
- **Note**: You must have at least one completed journey map with pain points identified

### Select Gap Analyses (Optional)
- **What it's for**: Include competitive gap insights to inform recommendations
- **How to use**: Check any relevant completed gap analyses to add competitive context
- **Example**: Select "Best Practice Analysis" (12 gaps identified)
- **Note**: Only shows gap analyses that have been completed with identified gaps

### Session Name (Optional)
- **What it's for**: Give your recommendation session a memorable name for easy reference
- **How to use**: Enter a descriptive name that helps you identify this analysis later
- **Example**: "Q1 2025 Mobile Onboarding Improvements" or "Enterprise SSO Pain Points"

### Recommendation Focus
- **What it's for**: Control what type of recommendations the system prioritizes
- **Options**:
  - **Comprehensive**: All recommendations regardless of effort level (default)
  - **Quick Wins**: High impact, low effort solutions you can implement quickly
  - **Strategic**: Transformative, long-term improvements requiring significant investment
  - **Parity**: Focus on closing competitive gaps identified in gap analyses
- **Example**: Select "Quick Wins" when you need to show progress fast with limited resources

### Timeline Constraint
- **What it's for**: Filter recommendations based on when you need to deliver
- **Options**:
  - **Flexible**: No time constraint, see all recommendations
  - **Q1 2025**: Only recommendations achievable in ~12 weeks
  - **Q2 2025**: Only recommendations achievable in ~24 weeks
  - **H1 2025**: Only recommendations achievable in ~26 weeks
  - **H2 2025**: Only recommendations achievable in ~52 weeks
- **Example**: Select "Q1 2025" if you have a quarterly planning deadline

### Team Capacity (Optional)
- **What it's for**: Help the system estimate more accurate effort and feasibility
- **How to use**: Describe your available team resources
- **Example**: "2 designers, 3 frontend engineers, 1 backend engineer"
- **Note**: More specific capacity information leads to better effort estimates

## Understanding Results

### Quick Wins Column (Yellow)
Recommendations with high impact (>7) and low effort (<4). These are the fastest path to demonstrable improvements.

### High Impact Column (Blue)
Important improvements with significant impact that require moderate effort. Good candidates for medium-term planning.

### Strategic Column (Purple)
Long-term initiatives that may require significant investment but deliver transformative value.

### Recommendation Cards
Each recommendation includes:
- **Title**: Action-oriented description of what to implement
- **Description**: Brief explanation of the improvement
- **Scores**: Impact, Effort, and Urgency ratings (1-10)
- **Opportunity Score**: Calculated as (Impact x Urgency) / Effort
- **Solution Approaches**: Multiple implementation options with pros/cons
- **Success Metrics**: How to measure the impact
- **Effort Estimates**: Design, engineering, and testing days

### Sprint Plan
A suggested implementation sequence:
- Sprint 1-2: Quick wins to show early progress
- Sprint 3-4: High impact items for substantial improvements
- Q2+: Strategic initiatives for long-term roadmap
