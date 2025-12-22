# Goal Setting Assistant - Complete Workflow UI Mockup

A high-fidelity interactive UI mockup suite for the complete PM workflow: from goal setting through OKR generation, KPI assignment, and benchmark comparison. This helps Product Managers translate broad business intentions into clear, aligned, measurable objectives with industry-calibrated targets.

## Complete Workflow

The mockup demonstrates a 4-step workflow that PMs follow:

1. **Goal Setting** ([index.html](index.html)) - Define SMART goals
2. **OKR Generator** ([okr-generator.html](okr-generator.html)) - Convert goals into Objectives and Key Results
3. **KPI Assignment** ([kpi-assignment.html](kpi-assignment.html)) - Map KPIs to Key Results
4. **Benchmark Comparison** ([benchmark-comparison.html](benchmark-comparison.html)) - Calibrate targets against industry benchmarks

## Features by Page

### 1. Goal Setting Assistant
- **Summary of Inputs**: Displays domain, customer problems, company strategy, and team charter
- **Editable Goals**: 4 pre-populated SMART goals with tags and descriptions
- **Priority Recommendations**: AI-suggested prioritization based on strategic alignment
- **Why Was This Generated?**: Transparency into AI reasoning for each goal
- **Navigation**: Direct flow to OKR Generator

### 2. OKR Generator
- **Objectives & Key Results**: Structured conversion of goals into OKRs
- **Editable OKRs**: Full editing capabilities for objectives and KRs
- **Owner Assignment**: Assign owners to each KR
- **Baseline Tracking**: Capture baseline metrics for each KR
- **Navigation**: Breadcrumb navigation + continue to KPI Assignment

### 3. KPI Assignment Panel
- **KPI Matching**: Suggested KPIs automatically matched to Key Results
- **Primary/Supporting Classification**: KPIs categorized by importance
- **Selectable KPIs**: Toggle KPIs on/off with checkboxes
- **KPI Settings**: Configure thresholds and measurement details
- **Real-time Stats**: Live count of assigned KPIs
- **Navigation**: Continue to Benchmark Comparison

### 4. Benchmark Comparison
- **Industry Benchmarks**: Compare targets against industry averages and top performers
- **Visual Charts**: Bar charts showing baseline, commit, stretch, and benchmark ranges
- **Smart Recommendations**: AI-suggested stretch targets based on benchmarks
- **Customization**: Ability to override and customize all targets
- **Summary Panel**: Overview of benchmark performance across all KRs
- **Navigation**: Continue to Measurement Framework

### Interactive Elements
1. **Edit Goal**: Click the pencil icon to open the edit modal with:
   - Goal title, success target, and timeframe
   - Description and category tags
   - Dependencies (Engineering, Design, Analytics, etc.)
   - Notes field
   - Impact preview showing affected downstream systems

2. **Delete Goal**: Remove goals with confirmation

3. **Reorder Goals**: Move goals up/down with arrow buttons

4. **Why Was This Generated?**: Click on any goal to see:
   - Input signals that led to goal generation
   - Strategic alignment reasoning
   - SMART criteria breakdown

5. **Add New Goal**: Add custom goals to the list

6. **View Impact**: See how goal changes affect OKR Generation, KPI Selection, Measurement Targeting, and Dashboards

## How to Use

Simply open `index.html` in your web browser. All functionality is self-contained in the HTML, CSS, and JavaScript files.

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server
python3 -m http.server 8000
# Then visit: http://localhost:8000
```

## File Structure

```
goal-setting-mockup/
├── index.html                  # Goal Setting Assistant (Step 1)
├── okr-generator.html          # OKR Generator (Step 2)
├── kpi-assignment.html         # KPI Assignment Panel (Step 3)
├── benchmark-comparison.html   # Benchmark Comparison (Step 4)
├── styles.css                  # Base styling (shared)
├── okr-styles.css              # Styles for steps 2-4
├── script.js                   # Goal Setting interactivity
├── okr-script.js               # OKR Generator interactivity
├── kpi-script.js               # KPI Assignment interactivity
├── benchmark-script.js         # Benchmark Comparison interactivity
└── README.md                   # This file
```

## Design System

### Colors
- **Primary**: Indigo/Violet (#5E6AD2)
- **Background**: Soft blue-gray (#F7F9FB)
- **Cards**: White (#FFFFFF)
- **Text**: Almost black (#1A1D21) / Secondary (#5F6B7C)

### Tag Colors
- **Blue**: Activation
- **Gray**: Reliability
- **Purple**: Support
- **Green**: Efficiency
- **Orange**: UX
- **Indigo**: Retention
- **Pink**: Engagement

### Typography
- **Font**: Inter (with fallbacks to system fonts)
- **Icons**: Phosphor Icons

## Acceptance Criteria Fulfilled

✅ Ability to generate 3–5 SMART goals per user input
✅ Ability to edit, delete, or add new goals manually
✅ Ability to rank goals based on impact, urgency, or PM preference
✅ Output is structurally compatible with the OKR Generator
✅ Ability to store versions and compare prior drafts (UI prepared)
✅ Ability to click "Why was this generated?" for transparency

## Future Enhancements

- Backend integration for saving/loading goals
- Version history and comparison view
- Real-time collaboration features
- Export to various formats (PDF, CSV, etc.)
- Integration with OKR Generator API
- Analytics dashboard integration
