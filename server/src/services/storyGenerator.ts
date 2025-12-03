import { db } from '../db/index.js';
import {
  generatedArtifacts,
  knowledgeBases,
  documentChunks,
  type GeneratedArtifactFile,
  type GenerationMetadata,
} from '../db/schema.js';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { cosineDistance, gt } from 'drizzle-orm';
import { embeddingService } from './embedding.js';
import OpenAI from 'openai';

// Types
export type ArtifactType = 'epic' | 'feature' | 'user_story';

// Structured output types for JSON generation
export interface StoryNode {
  title: string;
  userStory: string; // "AS a... I WANT... SO THAT..."
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface AcceptanceCriterion {
  scenario: string;
  given: string;
  when: string;
  then: string;
}

export interface FeatureNode {
  title: string;
  purpose: string;
  summary: string;
  businessValue: string;
  functionalRequirements: string;
  nonFunctionalRequirements: string;
  dependencies: string;
  assumptions: string;
  acceptanceCriteria: AcceptanceCriterion[];
  stories: StoryNode[];
}

export interface EpicNode {
  title: string;
  vision: string;
  goals: string[];
  successMetrics: string[];
  risksAndDependencies: string;
  features: FeatureNode[];
}

export interface StructuredContent {
  type: 'epic' | 'feature' | 'user_story';
  epic?: EpicNode;
  feature?: FeatureNode;
  stories?: StoryNode[];
}

export interface GenerateRequest {
  type: ArtifactType;
  title: string;
  description: string;
  files?: GeneratedArtifactFile[];
  knowledgeBaseIds?: number[];
  userId?: number;
}

export interface RegenerateRequest {
  artifactId: number;
  prompt: string;
}

export interface GeneratedArtifact {
  id: number;
  userId: number | null;
  type: ArtifactType;
  title: string;
  content: string; // JSON string of StructuredContent
  parentId: number | null;
  inputDescription: string;
  inputFiles: GeneratedArtifactFile[];
  knowledgeBaseIds: number[];
  status: 'draft' | 'final';
  generationMetadata: GenerationMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

// JSON Schema for structured output
const JSON_SCHEMA = {
  epic: `{
  "type": "epic",
  "epic": {
    "title": "string - Epic title",
    "vision": "string - High-level vision for this initiative",
    "goals": ["string - Goal 1", "string - Goal 2", "..."],
    "successMetrics": ["string - Metric 1", "string - Metric 2", "..."],
    "risksAndDependencies": "string - Key risks and dependencies",
    "features": [
      {
        "title": "string - Feature title",
        "purpose": "string - Achieve X by Y because Z",
        "summary": "string - Short description of functionality",
        "businessValue": "string - Success metrics and KPIs",
        "functionalRequirements": "string - Detailed functional requirements (can use markdown)",
        "nonFunctionalRequirements": "string - Accessibility, Security, Performance, etc.",
        "dependencies": "string - API/MW needs, external systems",
        "assumptions": "string - Key assumptions",
        "acceptanceCriteria": [
          {
            "scenario": "string - Scenario name",
            "given": "string - Precondition",
            "when": "string - Action",
            "then": "string - Expected result"
          }
        ],
        "stories": [
          {
            "title": "string - Story title",
            "userStory": "string - AS a [user] I WANT [goal] SO THAT [benefit]",
            "acceptanceCriteria": [
              {
                "scenario": "string - Scenario name",
                "given": "string - Precondition",
                "when": "string - Action",
                "then": "string - Expected result"
              }
            ]
          }
        ]
      }
    ]
  }
}`,
  feature: `{
  "type": "feature",
  "feature": {
    "title": "string - Feature title",
    "purpose": "string - Achieve X by Y because Z",
    "summary": "string - Short description of functionality",
    "businessValue": "string - Success metrics and KPIs",
    "functionalRequirements": "string - Detailed functional requirements (can use markdown)",
    "nonFunctionalRequirements": "string - Accessibility, Security, Performance, etc.",
    "dependencies": "string - API/MW needs, external systems",
    "assumptions": "string - Key assumptions",
    "acceptanceCriteria": [
      {
        "scenario": "string - Scenario name",
        "given": "string - Precondition",
        "when": "string - Action",
        "then": "string - Expected result"
      }
    ],
    "stories": [
      {
        "title": "string - Story title",
        "userStory": "string - AS a [user] I WANT [goal] SO THAT [benefit]",
        "acceptanceCriteria": [
          {
            "scenario": "string - Scenario name",
            "given": "string - Precondition",
            "when": "string - Action",
            "then": "string - Expected result"
          }
        ]
      }
    ]
  }
}`,
  user_story: `{
  "type": "user_story",
  "stories": [
    {
      "title": "string - Story title",
      "userStory": "string - AS a [user] I WANT [goal] SO THAT [benefit]",
      "acceptanceCriteria": [
        {
          "scenario": "string - Scenario name",
          "given": "string - Precondition",
          "when": "string - Action",
          "then": "string - Expected result"
        }
      ]
    }
  ]
}`
};

// System prompts for different artifact types - JSON output
function getSystemPrompt(type: ArtifactType, title: string): string {
  const baseInstruction = `You are a JSON API that outputs product documentation.

CRITICAL RULES:
1. Output ONLY valid JSON - your entire response must be parseable JSON
2. NO markdown formatting, NO code fences, NO explanatory text
3. NO text before the opening { or after the closing }
4. NO comments or notes like "---" or "*All user stories...*"
5. Start your response with { and end with }

You create professional, specific, actionable product documentation.`;

  switch (type) {
    case 'epic':
      return `${baseInstruction}

You are generating an EPIC for: "${title}"

An epic represents a large initiative containing multiple features, each with their own user stories.

REQUIREMENTS:
- Generate 2-3 Features for this epic
- Each Feature should have 2-4 User Stories nested within it
- All content should be specific and detailed, not placeholder text
- Acceptance criteria should be in Gherkin format (Given/When/Then)

JSON SCHEMA (respond with ONLY this structure, filled with real content):
${JSON_SCHEMA.epic}`;

    case 'feature':
      return `${baseInstruction}

You are generating a FEATURE for: "${title}"

A feature represents a specific capability or functionality with its related user stories.

REQUIREMENTS:
- Generate complete feature documentation
- Include 3-5 User Stories that implement this feature
- All content should be specific and detailed, not placeholder text
- Acceptance criteria should be in Gherkin format (Given/When/Then)

JSON SCHEMA (respond with ONLY this structure, filled with real content):
${JSON_SCHEMA.feature}`;

    case 'user_story':
      return `${baseInstruction}

You are generating USER STORIES for: "${title}"

User stories describe functionality from an end-user perspective.

REQUIREMENTS:
- Generate 3-5 user stories
- Each story should be self-contained and testable
- Include 2-4 acceptance criteria scenarios per story
- Use the AS a/I WANT/SO THAT format for userStory field

JSON SCHEMA (respond with ONLY this structure, filled with real content):
${JSON_SCHEMA.user_story}`;
  }
}

// Label and placeholder based on type
export function getInputConfig(type: ArtifactType): { label: string; placeholder: string } {
  switch (type) {
    case 'epic':
      return {
        label: 'Describe the initiative',
        placeholder: 'What is the big-picture goal? What outcomes are you trying to achieve?',
      };
    case 'feature':
      return {
        label: 'Describe the features you need',
        placeholder: 'What capabilities do you need to add? What should users be able to do?',
      };
    case 'user_story':
      return {
        label: 'Describe the user needs',
        placeholder: "What does the user need to accomplish? What's the context?",
      };
  }
}

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

// Fetch relevant context from knowledge bases
async function getKnowledgeBaseContext(
  knowledgeBaseIds: number[],
  query: string,
  limit: number = 5
): Promise<string> {
  if (knowledgeBaseIds.length === 0) return '';

  try {
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateQueryEmbedding(query);

    // Search across all selected knowledge bases
    const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

    const results = await db
      .select({
        content: documentChunks.content,
        similarity,
      })
      .from(documentChunks)
      .where(inArray(documentChunks.knowledgeBaseId, knowledgeBaseIds))
      .orderBy(desc(similarity))
      .limit(limit);

    if (results.length === 0) return '';

    const context = results
      .filter((r) => r.similarity > 0.5)
      .map((r) => r.content)
      .join('\n\n---\n\n');

    return context ? `\n\nRelevant Context from Knowledge Base:\n${context}` : '';
  } catch (error) {
    console.error('Error fetching KB context:', error);
    return '';
  }
}

// Build message content with images
function buildMessageContent(
  description: string,
  files: GeneratedArtifactFile[],
  kbContext: string
): OpenAI.Chat.ChatCompletionContentPart[] {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

  // Add text description with KB context
  let textContent = description;
  if (kbContext) {
    textContent += kbContext;
  }
  content.push({ type: 'text', text: textContent });

  // Add images
  for (const file of files) {
    if (file.mimeType.startsWith('image/') && file.content) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${file.mimeType};base64,${file.content}`,
          detail: 'high',
        },
      });
    }
  }

  return content;
}

// Extract title from generated JSON content
function extractTitle(content: string, type: ArtifactType): string {
  try {
    const parsed = JSON.parse(content) as StructuredContent;
    if (parsed.epic?.title) return parsed.epic.title;
    if (parsed.feature?.title) return parsed.feature.title;
    if (parsed.stories?.[0]?.title) return parsed.stories[0].title;
  } catch {
    // Not valid JSON, try to extract from markdown
    const titleMatch = content.match(/^#\s+(?:EPIC:\s*)?(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }

  return `Generated ${type.replace('_', ' ')}`;
}

// Clean up LLM response to extract valid JSON
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();

  // Remove markdown code fences if present
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

// Validate and parse JSON response
function parseJsonResponse(response: string, type: ArtifactType): StructuredContent {
  const cleaned = cleanJsonResponse(response);

  try {
    const parsed = JSON.parse(cleaned);

    // Ensure the response has the expected structure
    if (type === 'epic' && !parsed.epic) {
      throw new Error('Missing epic object in response');
    }
    if (type === 'feature' && !parsed.feature) {
      throw new Error('Missing feature object in response');
    }
    if (type === 'user_story' && !parsed.stories) {
      throw new Error('Missing stories array in response');
    }

    return parsed as StructuredContent;
  } catch (error) {
    console.error('JSON parse error:', error);
    console.error('Raw response:', response.substring(0, 500));
    throw new Error(`Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main generation function
async function generate(request: GenerateRequest): Promise<GeneratedArtifact> {
  const startTime = Date.now();
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

  // Get KB context if knowledge bases are selected
  const kbContext = await getKnowledgeBaseContext(
    request.knowledgeBaseIds || [],
    request.description
  );

  // Build messages
  const systemPrompt = getSystemPrompt(request.type, request.title || request.description.slice(0, 50));
  const messageContent = buildMessageContent(
    request.description,
    request.files || [],
    kbContext
  );

  // Call LLM with JSON mode enabled
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: messageContent },
    ],
    max_tokens: 8000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content || '';
  console.log('LLM raw response (first 500 chars):', rawContent.substring(0, 500));

  // Parse and validate the JSON response
  const structuredContent = parseJsonResponse(rawContent, request.type);

  // Store as JSON string
  const generatedContent = JSON.stringify(structuredContent, null, 2);

  // Extract title from the structured content
  const title = request.title || extractTitle(generatedContent, request.type);
  const generationTimeMs = Date.now() - startTime;

  // Save to database
  const [artifact] = await db
    .insert(generatedArtifacts)
    .values({
      userId: request.userId,
      type: request.type,
      title,
      content: generatedContent,
      inputDescription: request.description,
      inputFiles: request.files || [],
      knowledgeBaseIds: request.knowledgeBaseIds || [],
      status: 'draft',
      generationMetadata: {
        model,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        generationTimeMs,
      },
    })
    .returning();

  return artifact as GeneratedArtifact;
}

// Regenerate with modifications
async function regenerate(request: RegenerateRequest): Promise<GeneratedArtifact> {
  // Get original artifact
  const [original] = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.id, request.artifactId));

  if (!original) {
    throw new Error('Artifact not found');
  }

  const startTime = Date.now();
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

  // Get KB context
  const kbContext = await getKnowledgeBaseContext(
    (original.knowledgeBaseIds as number[]) || [],
    original.inputDescription as string
  );

  // Build regeneration prompt
  const systemPrompt = getSystemPrompt(original.type as ArtifactType, original.title);
  const regeneratePrompt = `Based on the following original inputs and the current generated content,
please regenerate with these modifications: ${request.prompt}

Original Description:
${original.inputDescription}

Current Generated Content (JSON):
${original.content}
${kbContext}

Please generate an improved version incorporating the requested changes.
IMPORTANT: Respond with ONLY valid JSON in the same structure as the current content.`;

  // Call LLM with JSON mode enabled
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: regeneratePrompt },
    ],
    max_tokens: 8000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content || '';
  console.log('Regenerate LLM raw response (first 500 chars):', rawContent.substring(0, 500));

  // Parse and validate the JSON response
  const structuredContent = parseJsonResponse(rawContent, original.type as ArtifactType);

  // Store as JSON string
  const generatedContent = JSON.stringify(structuredContent, null, 2);

  const title = extractTitle(generatedContent, original.type as ArtifactType);
  const generationTimeMs = Date.now() - startTime;

  // Update artifact
  const [updated] = await db
    .update(generatedArtifacts)
    .set({
      title,
      content: generatedContent,
      generationMetadata: {
        model,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        generationTimeMs,
        regeneratePrompt: request.prompt,
      },
      updatedAt: new Date(),
    })
    .where(eq(generatedArtifacts.id, request.artifactId))
    .returning();

  return updated as GeneratedArtifact;
}

// CRUD operations
async function getArtifact(id: number): Promise<GeneratedArtifact | null> {
  const [artifact] = await db
    .select()
    .from(generatedArtifacts)
    .where(eq(generatedArtifacts.id, id));

  return (artifact as GeneratedArtifact) || null;
}

async function listArtifacts(userId?: number): Promise<GeneratedArtifact[]> {
  const query = userId
    ? db.select().from(generatedArtifacts).where(eq(generatedArtifacts.userId, userId))
    : db.select().from(generatedArtifacts);

  const results = await query.orderBy(desc(generatedArtifacts.createdAt));
  return results as GeneratedArtifact[];
}

async function updateArtifact(
  id: number,
  data: { title?: string; content?: string; status?: 'draft' | 'final' }
): Promise<GeneratedArtifact | null> {
  const [updated] = await db
    .update(generatedArtifacts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(generatedArtifacts.id, id))
    .returning();

  return (updated as GeneratedArtifact) || null;
}

async function deleteArtifact(id: number): Promise<boolean> {
  const result = await db
    .delete(generatedArtifacts)
    .where(eq(generatedArtifacts.id, id));

  return (result.rowCount ?? 0) > 0;
}

export const storyGeneratorService = {
  generate,
  regenerate,
  getArtifact,
  listArtifacts,
  updateArtifact,
  deleteArtifact,
  getInputConfig,
};
