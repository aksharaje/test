# AI System Prompts Documentation

This directory contains documentation for the AI prompts used throughout the Product Studio application. Each section details the specific flow, the prompts used, their triggers, and the expected inputs/outputs.

## Table of Contents
- [Goal Setting](#goal-setting)
- [OKR Generator](#okr-generator)
- [KPI Assignment](#kpi-assignment)
- [Measurement Framework](#measurement-framework)
- [Scope Definition](#scope-definition)
- [Ideation (Multi-Agent)](#ideation-multi-agent)
- [Feasibility Analysis (Multi-Agent)](#feasibility-analysis-multi-agent)
- [User Story Generator](#user-story-generator)
- [PRD Generator](#prd-generator)

---

## Goal Setting

**Service:** `GoalSettingService` in `server/app/services/goal_setting_service.py`

### 1. Goal Generation
*   **Trigger:** User clicks "Generate Goals" in the Goal Setting Assistant.
*   **Method:** `generate_goals`
*   **Input:** `GoalSettingSession` (Domain, Problem Statements, Strategy, Team Charter, Baselines)
*   **Output:** JSON Object containing `executive_summary` and a list of `goals`.

**System Prompt:**
```text
You are an expert product management coach specializing in goal setting.
You help teams define clear, actionable SMART goals that drive business outcomes.
Always respond with valid JSON only, no additional text or markdown.
```

**User Prompt Template:**
```text
Based on the following context, generate 3-5 strategic goals using the SMART framework.

## PM Role / Domain
{session.domain}

## Customer Problem Statements
{session.problem_statements}

## Company Strategy
{session.strategy}

## Team Charter
{session.team_charter}

## Current Baselines / Metrics
{session.baselines}

## Instructions
Generate goals that are:
1. Strategic and aligned with the company strategy and team charter
2. Address the customer problem statements
3. Include measurable improvements from current baselines
4. Follow SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)
...
Respond with JSON in this exact format:
{
    "executive_summary": "...",
    "goals": [...]
}
```

---

## OKR Generator

**Service:** `OkrGeneratorService` in `server/app/services/okr_generator_service.py`

### 1. OKR Generation
*   **Trigger:** User clicks "Generate OKRs" after inputting goal description and preferences.
*   **Method:** `generate_okrs`
*   **Input:** `OkrSession` (Goal Description, Timeframe, Team Context, Measurement Preferences)
*   **Output:** JSON Object containing `executive_summary`, `objectives` (with Key Results), and `kpis`.

**System Prompt:**
```text
You are an expert in OKR methodology and performance measurement.
You help teams create clear, measurable objectives with actionable key results and KPIs.
Always respond with valid JSON only, no additional text or markdown.
```

**User Prompt Template:**
```text
Based on the following goals, generate OKRs (Objectives and Key Results) with supporting KPIs.

## Goals
{session.goal_description}

## Timeframe
{session.timeframe}

## Team Context
{session.team_context}

## Measurement Preferences
{session.measurement_preferences}

## Instructions
Generate 2-4 Objectives, each with 3-5 Key Results. Include supporting KPIs.
...
Respond with JSON in this exact format:
{
    "executive_summary": "...",
    "objectives": [...],
    "kpis": [...]
}
```

---

## KPI Assignment

**Service:** `KpiAssignmentService` in `server/app/services/kpi_assignment_service.py`

### 1. KPI Generation
*   **Trigger:** Automatically triggered when a KPI Assignment session is created from a Goal or OKR session.
*   **Method:** `generate_kpis`
*   **Input:** List of `Goal` objects.
*   **Output:** JSON Object with `kpi_assignments` mapping goals to primary/secondary KPIs.

**System Prompt:**
```text
You are an expert in performance measurement and KPI definition.
You help teams define clear, measurable KPIs for their goals.
Always respond with valid JSON only, no additional text or markdown.
```

**User Prompt Template:**
```text
Based on the following goals, generate appropriate KPIs (Key Performance Indicators) for each goal.

## Goals
Goal 1:
- Title: {goal.title}
- Description: {goal.description}
...

## Instructions
For each goal, provide:
1. A primary KPI
2. Measurement unit
3. Secondary KPI
...
Respond with JSON in this exact format:
{
    "executive_summary": "...",
    "kpi_assignments": [...]
}
```

---

## Measurement Framework

**Service:** `MeasurementFrameworkService` in `server/app/services/measurement_framework_service.py`

### 1. Framework Generation
*   **Trigger:** User clicks "Build Framework".
*   **Method:** `generate_framework`
*   **Input:** `MeasurementFrameworkSession` (Objectives, Data Sources, Reporting Req, Audience) + Knowledge Base Context (RAG).
*   **Output:** JSON Object with `metrics`, `data_sources`, and `dashboards`.

**System Prompt:**
```text
You are a JSON-only API for building measurement frameworks.
CRITICAL: You MUST respond with valid JSON only. No markdown, no explanations.
Your expertise is in creating comprehensive measurement strategies...
```

**User Prompt Template:**
```text
Create a comprehensive measurement framework based on the following requirements.

## Framework Name
{session.name}

## Objectives to Measure
{session.objectives_description}

{kb_section} (Optional Knowledge Base Context)

## Existing Data Sources
{session.existing_data_sources}
...
Respond with JSON in this exact format:
{
    "executive_summary": "...",
    "framework_overview": "...",
    "metrics": [...],
    "data_sources": [...],
    "dashboards": [...]
}
```

---

## Scope Definition

**Service:** `ScopeDefinitionService` in `server/app/services/scope_definition_service.py`

### 1. Scope Generation
*   **Trigger:** User clicks "Define Scope".
*   **Method:** `generate_scope`
*   **Input:** `ScopeDefinitionSession` (Vision, Requirements, Constraints, Users) + KB Context.
*   **Output:** JSON Object with `scope_items` (In/Out/Deferred), `assumptions`, `constraints`, `deliverables`.

**System Prompt:**
```text
You are a JSON-only API for project scope definition.
CRITICAL: You MUST respond with valid JSON only.
Your expertise is in defining project boundaries...
```

**User Prompt Template:**
```text
Define the scope for the following project.

## Project Name
{session.project_name}

## Product Vision
{session.product_vision}

{kb_section}

## Initial Requirements
{session.initial_requirements}
...
Respond with JSON in this exact format:
{
    "scope_statement": "...",
    "scope_items": [...],
    "assumptions": [...],
    "constraints": [...],
    "deliverables": [...]
}
```

---

## Ideation (Multi-Agent)

**Service:** `IdeationService` in `server/app/services/ideation_service.py`
This flow runs as a pipeline of 4 sequential agents.

### Agent 1: Problem Parser
*   **Goal:** Extract structured problem definition from unstructured user input.
*   **Input:** Problem Statement, Constraints, Goals, Research Insights.
*   **Output:** JSON with structured fields (`who`, `what`, `why`, `impact`, etc.).
*   **System Prompt:** `You are a problem analysis expert. Extract structured information...`

### Agent 2: Idea Generator
*   **Goal:** Generate exactly 18 diverse ideas across 4 categories (Quick Wins, Strategic Bets, Incremental, Moonshots).
*   **Input:** Structured Problem + Optional Knowledge Base Context.
*   **Output:** JSON with list of 18 ideas.
*   **System Prompt:** `You are an innovation strategist. Generate creative, diverse ideas... Generate EXACTLY 18 ideas total...`

### Agent 3: Enrichment Agent
*   **Goal:** Add implementation details (Use Cases, Edge Cases, Implementation Notes) to each idea.
*   **Input:** Individual Idea + Problem Context.
*   **Output:** JSON with `use_cases`, `edge_cases`, `implementation_notes`.
*   **System Prompt:** `You are enriching a product idea with practical implementation details...`

### Agent 4: Scoring Agent
*   **Goal:** Score each idea on 5 criteria (Impact, Feasibility, Effort, Strategic Fit, Risk).
*   **Input:** Individual Idea.
*   **Output:** JSON with scores (1-10) and rationale for each criteria.
*   **System Prompt:** `You are an evaluation expert. Score this idea objectively on 5 criteria using a 1-10 scale...`

---

## Feasibility Analysis (Multi-Agent)

**Service:** `FeasibilityService` in `server/app/services/feasibility_service.py`
This flow runs as a pipeline of 4 sequential agents plus a final summarizer.

### Agent 1: Decomposition
*   **Goal:** Break feature into 4-8 technical components.
*   **Input:** Feature Description, Technical Constraints, Target Users.
*   **Output:** JSON with `components` list and `mentioned_technologies`.
*   **Prompt:** `You are a technical architect analyzing a feature request... Break this feature into 4-8 technical components...`

### Agent 2: Effort Estimation
*   **Goal:** Estimate Optimistic, Realistic, and Pessimistic hours for each component.
*   **Input:** Independent Component details.
*   **Output:** JSON with hour estimates and confidence level.
*   **Prompt:** `You are a technical lead estimating effort for a component... Provide three effort estimates in hours...`

### Agent 3: Timeline & Resource
*   **Goal:** Project timeline scenarios (Optimistic, Realistic, Pessimistic).
*   **Input:** All components with their estimates.
*   **Output:** JSON with 3 `scenarios` (weeks, sprint count, parallelization).
*   **Prompt:** `You are a project manager creating timeline projections... Create 3 timeline scenarios...`

### Agent 4: Risk Assessment
*   **Goal:** Identify risks and skill requirements.
*   **Input:** Feature Description, Components, Realistic Timeline.
*   **Output:** JSON with `risks` (Technical, Resource, Schedule, etc.) and `skills_required`.
*   **Prompt:** `You are a risk analyst identifying project risks... Identify 5-10 risks across these categories...`

### Finalizer: Executive Summary
*   **Goal:** Generate a human-readable summary and Go/No-Go recommendation.
*   **Input:** Aggregated results from previous agents.
*   **Output:** JSON with `executive_summary`.
*   **Prompt:** `You are a product executive summarizing a feasibility analysis... Generate a concise executive summary...`

---

## User Story Generator

**Service:** `StoryGeneratorService` in `server/app/services/story_generator_service.py`

### 1. Artifact Generation
*   **Trigger:** User clicks "Generate" for Epics, Features, or User Stories.
*   **Method:** `generate`
*   **Input:** Type (Epic/Feature/Story), Description, Title, KB IDs.
*   **Output:** JSON content specific to the artifact type.

**Dynamic System Prompt (based on type):**
*   **Epic:** `You are generating an EPIC... Generate 2-3 Features... Feature should have 2-4 User Stories...`
*   **Feature:** `You are generating a FEATURE... Include 3-5 User Stories...`
*   **User Story:** `You are generating USER STORIES... Generate 3-5 user stories...`

**Base Instruction:**
```text
You are a JSON API that outputs product documentation.
CRITICAL RULES:
1. Output ONLY valid JSON
2. NO markdown formatting
...
```

---

## PRD Generator

**Service:** `PrdGeneratorService` in `server/app/services/prd_generator_service.py`

### 1. PRD Generation
*   **Trigger:** User clicks "Generate PRD".
*   **Method:** `run_prd_pipeline`
*   **Input:** Concept, Context (Project, Persona, Industry), Template Type.
*   **Output:** JSON with PRD sections.

**System Prompts (Variable by Template):**
*   **Default:** `You are a Product Requirements Document (PRD) generator... Create a PRD with the following sections...`
*   **Lean:** `You are a Lean PRD generator focused on minimal viable documentation...`
*   **Technical Spec:** `You are a Technical PRD generator for engineering teams...`
*   **Enterprise:** `You are an Enterprise PRD generator for formal documentation...`
*   **User-Centric:** `You are a User-Centric PRD generator focused on user experience...`

**User Prompt Template:**
```text
Generate a PRD based on the following business requirements:

{prd.concept}

Context:
Target Project/Team: {prd.target_project}
Target Persona: {prd.target_persona}
...
(Optional KB Context)
```
