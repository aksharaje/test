import { db } from '../db/index.js';
import {
  generatedPrds,
  prdTemplates,
  knowledgeBases,
  documentChunks,
  type GeneratedArtifactFile,
  type PrdCitation,
  type PrdGenerationMetadata,
  type PrdRefineEntry,
} from '../db/schema.js';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { cosineDistance } from 'drizzle-orm';
import { embeddingService } from './embedding.js';
import OpenAI from 'openai';

// Types
export interface PrdSection {
  key: string;
  title: string;
  content: string;
  citations?: number[]; // Citation IDs referenced in this section
}

export interface StructuredPrdContent {
  title: string;
  sections: PrdSection[];
}

export interface PrdGenerateRequest {
  concept: string;
  targetProject?: string;
  targetPersona?: string;
  industryContext?: string;
  primaryMetric?: string;
  userStoryRole?: string;
  userStoryGoal?: string;
  userStoryBenefit?: string;
  knowledgeBaseIds?: number[];
  files?: GeneratedArtifactFile[];
  templateId?: number;
  userId?: number;
}

export interface PrdRefineRequest {
  prdId: number;
  prompt: string;
}

export interface GeneratedPrd {
  id: number;
  userId: number | null;
  title: string;
  content: string;
  concept: string;
  targetProject: string | null;
  targetPersona: string | null;
  industryContext: string | null;
  primaryMetric: string | null;
  userStoryRole: string | null;
  userStoryGoal: string | null;
  userStoryBenefit: string | null;
  knowledgeBaseIds: number[];
  inputFiles: GeneratedArtifactFile[];
  templateId: number | null;
  status: 'draft' | 'final';
  generationMetadata: PrdGenerationMetadata | null;
  citations: PrdCitation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PrdTemplate {
  id: number;
  name: string;
  description: string | null;
  isDefault: number;
  isCustom: number;
  systemPrompt: string;
}

// Default PRD templates based on UI mockup
const DEFAULT_TEMPLATES: Omit<PrdTemplate, 'id'>[] = [
  {
    name: 'Default',
    description: 'A balanced PRD template suitable for most projects',
    isDefault: 1,
    isCustom: 0,
    systemPrompt: `You are a Product Requirements Document (PRD) generator. Analyze the provided business requirements and create a comprehensive PRD.

The input may include:
- Bullet-pointed requirements
- User stories (As a [user], I want [goal], so that [benefit])
- Problem statements and desired outcomes
- High-level feature descriptions

Create a PRD with the following sections:

1. Purpose - Why this product/feature exists and what problem it solves (derived from the business requirements)
2. High Level Summary - Brief overview of the solution
3. Functional Requirements - Detailed list of what the product must do (expand on and organize the input requirements)
4. Business Value - Expected outcomes, ROI, and success metrics (align with the stated primary business objective if provided)
5. Dependencies - External systems, APIs, or resources needed
6. Acceptance Criteria - Conditions that must be met for the PRD to be considered complete

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "purpose", "title": "Purpose", "content": "..."},
    {"key": "summary", "title": "High Level Summary", "content": "..."},
    {"key": "functional_requirements", "title": "Functional Requirements", "content": "..."},
    {"key": "business_value", "title": "Business Value", "content": "..."},
    {"key": "dependencies", "title": "Dependencies", "content": "..."},
    {"key": "acceptance_criteria", "title": "Acceptance Criteria", "content": "..."}
  ]
}

Use markdown formatting within content fields. Include inline citations [1], [2] etc. when referencing knowledge base content.`,
  },
  {
    name: 'Lean PRD',
    description: 'Minimal documentation for agile teams moving fast',
    isDefault: 0,
    isCustom: 0,
    systemPrompt: `You are a Lean PRD generator focused on minimal viable documentation. Analyze the provided business requirements and create a concise PRD.

The input may include bullet-pointed requirements, user stories, problem statements, or feature descriptions. Distill these into:

1. Problem Statement - What problem are we solving? (derived from the business requirements)
2. Solution Overview - How will we solve it?
3. Success Metrics - How do we measure success? (align with primary business objective if provided)
4. MVP Scope - What's included in the first release?

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "problem", "title": "Problem Statement", "content": "..."},
    {"key": "solution", "title": "Solution Overview", "content": "..."},
    {"key": "metrics", "title": "Success Metrics", "content": "..."},
    {"key": "mvp_scope", "title": "MVP Scope", "content": "..."}
  ]
}

Keep sections brief and actionable. Include citations [1], [2] when referencing knowledge base content.`,
  },
  {
    name: 'Technical Specification',
    description: 'Detailed technical requirements for engineering teams',
    isDefault: 0,
    isCustom: 0,
    systemPrompt: `You are a Technical PRD generator for engineering teams. Analyze the provided business requirements and translate them into a detailed technical specification.

The input may include business requirements, user stories, or feature descriptions. Transform these into technical specifications:

1. Overview - Technical summary of the feature (based on the business requirements)
2. Architecture - System design and component interactions
3. API Specifications - Endpoints, payloads, and responses
4. Data Models - Database schemas and data structures
5. Non-Functional Requirements - Performance, security, scalability
6. Technical Dependencies - Libraries, services, infrastructure
7. Implementation Notes - Edge cases, considerations, risks

Format your response as valid JSON with this structure:
{
  "title": "Technical Spec: [Title]",
  "sections": [
    {"key": "overview", "title": "Overview", "content": "..."},
    {"key": "architecture", "title": "Architecture", "content": "..."},
    {"key": "api_specs", "title": "API Specifications", "content": "..."},
    {"key": "data_models", "title": "Data Models", "content": "..."},
    {"key": "nfr", "title": "Non-Functional Requirements", "content": "..."},
    {"key": "dependencies", "title": "Technical Dependencies", "content": "..."},
    {"key": "implementation", "title": "Implementation Notes", "content": "..."}
  ]
}

Use code blocks for technical content. Include citations [1], [2] when referencing knowledge base content.`,
  },
  {
    name: 'Enterprise Format',
    description: 'Comprehensive documentation for enterprise stakeholders',
    isDefault: 0,
    isCustom: 0,
    systemPrompt: `You are an Enterprise PRD generator for formal documentation. Analyze the provided business requirements and create a comprehensive PRD suitable for enterprise stakeholders.

The input may include business requirements, user stories, problem statements, or feature descriptions. Expand these into enterprise-grade documentation:

1. Executive Summary - High-level overview for leadership (synthesize the business requirements)
2. Business Objectives - Strategic goals and alignment (connect to the primary business objective if provided)
3. Scope & Boundaries - What's included and excluded
4. Stakeholder Analysis - Who is affected and their needs
5. Requirements - Functional and non-functional requirements (organize and expand the input requirements)
6. Risk Assessment - Potential risks and mitigations
7. Timeline & Milestones - Key deliverables and dates
8. Resource Requirements - Budget, team, infrastructure
9. Success Criteria - KPIs and acceptance criteria
10. Appendix - Supporting documentation and references

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "executive_summary", "title": "Executive Summary", "content": "..."},
    {"key": "business_objectives", "title": "Business Objectives", "content": "..."},
    {"key": "scope", "title": "Scope & Boundaries", "content": "..."},
    {"key": "stakeholders", "title": "Stakeholder Analysis", "content": "..."},
    {"key": "requirements", "title": "Requirements", "content": "..."},
    {"key": "risks", "title": "Risk Assessment", "content": "..."},
    {"key": "timeline", "title": "Timeline & Milestones", "content": "..."},
    {"key": "resources", "title": "Resource Requirements", "content": "..."},
    {"key": "success_criteria", "title": "Success Criteria", "content": "..."},
    {"key": "appendix", "title": "Appendix", "content": "..."}
  ]
}

Include citations [1], [2] when referencing knowledge base content.`,
  },
  {
    name: 'User-Centric PRD',
    description: 'Focused on user journeys and experience design',
    isDefault: 0,
    isCustom: 0,
    systemPrompt: `You are a User-Centric PRD generator focused on user experience. Analyze the provided business requirements from a user-centered perspective.

The input may include business requirements, user stories, problem statements, or feature descriptions. Transform these into user-focused documentation:

1. User Problem - Pain points and frustrations (extract from business requirements)
2. User Personas - Target users and their characteristics (use target persona if provided)
3. User Journeys - Key workflows and interactions
4. User Stories - Features written from user perspective (expand any provided user stories)
5. UX Requirements - Interface and experience guidelines
6. Usability Criteria - How we measure user success

Format your response as valid JSON with this structure:
{
  "title": "PRD title",
  "sections": [
    {"key": "user_problem", "title": "User Problem", "content": "..."},
    {"key": "personas", "title": "User Personas", "content": "..."},
    {"key": "journeys", "title": "User Journeys", "content": "..."},
    {"key": "stories", "title": "User Stories", "content": "..."},
    {"key": "ux_requirements", "title": "UX Requirements", "content": "..."},
    {"key": "usability", "title": "Usability Criteria", "content": "..."}
  ]
}

Include citations [1], [2] when referencing knowledge base content.`,
  },
];

// Lazy OpenRouter client
let _openrouter: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!_openrouter) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
    _openrouter = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return _openrouter;
}

// Initialize default templates if they don't exist
async function ensureDefaultTemplates(): Promise<void> {
  const existing = await db.select().from(prdTemplates).where(eq(prdTemplates.isDefault, 1));

  if (existing.length === 0) {
    // Insert all default templates
    for (const template of DEFAULT_TEMPLATES) {
      await db.insert(prdTemplates).values({
        name: template.name,
        description: template.description,
        isDefault: template.isDefault,
        isCustom: template.isCustom,
        systemPrompt: template.systemPrompt,
      });
    }
  }
}

// Get all templates
async function getTemplates(): Promise<PrdTemplate[]> {
  await ensureDefaultTemplates();
  const templates = await db.select({
    id: prdTemplates.id,
    name: prdTemplates.name,
    description: prdTemplates.description,
    isDefault: prdTemplates.isDefault,
    isCustom: prdTemplates.isCustom,
    systemPrompt: prdTemplates.systemPrompt,
  }).from(prdTemplates);
  return templates;
}

// Get template by ID
async function getTemplate(id: number): Promise<PrdTemplate | null> {
  const [template] = await db.select({
    id: prdTemplates.id,
    name: prdTemplates.name,
    description: prdTemplates.description,
    isDefault: prdTemplates.isDefault,
    isCustom: prdTemplates.isCustom,
    systemPrompt: prdTemplates.systemPrompt,
  }).from(prdTemplates).where(eq(prdTemplates.id, id));
  return template || null;
}

// Fetch relevant context from knowledge bases with citations
async function getKnowledgeBaseContext(
  knowledgeBaseIds: number[],
  query: string,
  limit: number = 8
): Promise<{ context: string; citations: PrdCitation[] }> {
  if (knowledgeBaseIds.length === 0) return { context: '', citations: [] };

  try {
    const queryEmbedding = await embeddingService.generateQueryEmbedding(query);
    const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

    const results = await db
      .select({
        content: documentChunks.content,
        documentId: documentChunks.documentId,
        knowledgeBaseId: documentChunks.knowledgeBaseId,
        similarity,
      })
      .from(documentChunks)
      .where(inArray(documentChunks.knowledgeBaseId, knowledgeBaseIds))
      .orderBy(desc(similarity))
      .limit(limit);

    if (results.length === 0) return { context: '', citations: [] };

    // Get KB names for citations
    const kbInfo = await db
      .select({ id: knowledgeBases.id, name: knowledgeBases.name })
      .from(knowledgeBases)
      .where(inArray(knowledgeBases.id, knowledgeBaseIds));

    const kbNameMap = new Map(kbInfo.map(kb => [kb.id, kb.name]));

    const citations: PrdCitation[] = [];
    const contextParts: string[] = [];

    results.forEach((r, index) => {
      if (r.similarity > 0.5) {
        const citationId = index + 1;
        citations.push({
          id: citationId,
          type: 'knowledge_base',
          source: kbNameMap.get(r.knowledgeBaseId) || 'Unknown KB',
          documentId: r.documentId,
          content: r.content.substring(0, 500),
          similarity: r.similarity,
        });
        contextParts.push(`[${citationId}] ${r.content}`);
      }
    });

    return {
      context: contextParts.length > 0
        ? `\n\nRelevant Knowledge Base Context:\n${contextParts.join('\n\n---\n\n')}`
        : '',
      citations,
    };
  } catch (error) {
    console.error('Error fetching KB context:', error);
    return { context: '', citations: [] };
  }
}

// Build user prompt with all context
function buildUserPrompt(request: PrdGenerateRequest, kbContext: string): string {
  let prompt = `Generate a PRD based on the following business requirements:\n\n${request.concept}`;

  // Add context section
  const contextItems: string[] = [];
  if (request.targetProject) {
    contextItems.push(`Target Project/Team: ${request.targetProject}`);
  }
  if (request.targetPersona) {
    contextItems.push(`Target Persona: ${request.targetPersona}`);
  }
  if (request.industryContext) {
    contextItems.push(`Industry: ${request.industryContext}`);
  }
  if (request.primaryMetric) {
    contextItems.push(`Primary Business Objective: ${request.primaryMetric}`);
  }

  if (contextItems.length > 0) {
    prompt += `\n\nContext:\n${contextItems.join('\n')}`;
  }

  // Add user story if provided
  if (request.userStoryRole && request.userStoryGoal && request.userStoryBenefit) {
    prompt += `\n\nUser Story:\nAs a ${request.userStoryRole}, I want ${request.userStoryGoal}, so that ${request.userStoryBenefit}`;
  }

  // Add KB context
  if (kbContext) {
    prompt += kbContext;
  }

  return prompt;
}

// Clean up LLM response to extract valid JSON
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Generate a new PRD
async function generate(request: PrdGenerateRequest): Promise<GeneratedPrd> {
  const startTime = Date.now();
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

  // Get template
  let template: PrdTemplate | null = null;
  if (request.templateId) {
    template = await getTemplate(request.templateId);
  }
  if (!template) {
    // Use default template
    await ensureDefaultTemplates();
    const templates = await getTemplates();
    template = templates.find(t => t.isDefault === 1) || templates[0];
  }

  // Get KB context with citations
  const { context: kbContext, citations } = await getKnowledgeBaseContext(
    request.knowledgeBaseIds || [],
    request.concept
  );

  // Build prompts
  const systemPrompt = template.systemPrompt;
  const userPrompt = buildUserPrompt(request, kbContext);

  // Call LLM
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 8000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content || '';
  console.log('PRD LLM raw response (first 500 chars):', rawContent.substring(0, 500));

  // Parse JSON response
  const cleaned = cleanJsonResponse(rawContent);
  let structuredContent: StructuredPrdContent;
  try {
    structuredContent = JSON.parse(cleaned);
  } catch (error) {
    console.error('JSON parse error:', error);
    throw new Error('Failed to parse PRD response as JSON');
  }

  const generationTimeMs = Date.now() - startTime;

  // Save to database
  const [prd] = await db
    .insert(generatedPrds)
    .values({
      userId: request.userId,
      title: structuredContent.title || 'Generated PRD',
      content: JSON.stringify(structuredContent),
      concept: request.concept,
      targetProject: request.targetProject,
      targetPersona: request.targetPersona,
      industryContext: request.industryContext,
      primaryMetric: request.primaryMetric,
      userStoryRole: request.userStoryRole,
      userStoryGoal: request.userStoryGoal,
      userStoryBenefit: request.userStoryBenefit,
      knowledgeBaseIds: request.knowledgeBaseIds || [],
      inputFiles: request.files || [],
      templateId: template.id,
      status: 'draft',
      generationMetadata: {
        model,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        generationTimeMs,
      },
      citations,
    })
    .returning();

  return prd as GeneratedPrd;
}

// Refine an existing PRD
async function refine(request: PrdRefineRequest): Promise<GeneratedPrd> {
  const [original] = await db
    .select()
    .from(generatedPrds)
    .where(eq(generatedPrds.id, request.prdId));

  if (!original) {
    throw new Error('PRD not found');
  }

  const startTime = Date.now();
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

  // Get template for system prompt
  let template: PrdTemplate | null = null;
  if (original.templateId) {
    template = await getTemplate(original.templateId);
  }
  if (!template) {
    await ensureDefaultTemplates();
    const templates = await getTemplates();
    template = templates.find(t => t.isDefault === 1) || templates[0];
  }

  // Get fresh KB context
  const { context: kbContext, citations } = await getKnowledgeBaseContext(
    (original.knowledgeBaseIds as number[]) || [],
    original.concept as string
  );

  // Build refine prompt
  const refinePrompt = `Based on the following existing PRD and the modification request, please generate an updated PRD.

Current PRD:
${original.content}

Modification Request:
${request.prompt}
${kbContext}

Generate the complete updated PRD in the same JSON format.`;

  // Call LLM
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: template.systemPrompt },
      { role: 'user', content: refinePrompt },
    ],
    max_tokens: 8000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content || '';
  const cleaned = cleanJsonResponse(rawContent);

  let structuredContent: StructuredPrdContent;
  try {
    structuredContent = JSON.parse(cleaned);
  } catch (error) {
    console.error('JSON parse error on refine:', error);
    throw new Error('Failed to parse refined PRD response as JSON');
  }

  const generationTimeMs = Date.now() - startTime;

  // Update refine history
  const existingMetadata = original.generationMetadata as PrdGenerationMetadata || {};
  const refineHistory: PrdRefineEntry[] = existingMetadata.refineHistory || [];
  refineHistory.push({
    prompt: request.prompt,
    timestamp: new Date().toISOString(),
  });

  // Update in database
  const [updated] = await db
    .update(generatedPrds)
    .set({
      title: structuredContent.title || original.title,
      content: JSON.stringify(structuredContent),
      generationMetadata: {
        model,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        generationTimeMs,
        refineHistory,
      },
      citations: [...(original.citations as PrdCitation[] || []), ...citations],
      updatedAt: new Date(),
    })
    .where(eq(generatedPrds.id, request.prdId))
    .returning();

  return updated as GeneratedPrd;
}

// Get a single PRD
async function getPrd(id: number): Promise<GeneratedPrd | null> {
  const [prd] = await db
    .select()
    .from(generatedPrds)
    .where(eq(generatedPrds.id, id));
  return (prd as GeneratedPrd) || null;
}

// List all PRDs
async function listPrds(userId?: number): Promise<GeneratedPrd[]> {
  const query = userId
    ? db.select().from(generatedPrds).where(eq(generatedPrds.userId, userId))
    : db.select().from(generatedPrds);

  const results = await query.orderBy(desc(generatedPrds.createdAt));
  return results as GeneratedPrd[];
}

// Update a PRD
async function updatePrd(
  id: number,
  data: { title?: string; content?: string; status?: 'draft' | 'final' }
): Promise<GeneratedPrd | null> {
  const [updated] = await db
    .update(generatedPrds)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(generatedPrds.id, id))
    .returning();

  return (updated as GeneratedPrd) || null;
}

// Delete a PRD
async function deletePrd(id: number): Promise<boolean> {
  const result = await db
    .delete(generatedPrds)
    .where(eq(generatedPrds.id, id));
  return (result.rowCount ?? 0) > 0;
}

export const prdGeneratorService = {
  generate,
  refine,
  getPrd,
  listPrds,
  updatePrd,
  deletePrd,
  getTemplates,
  getTemplate,
};
