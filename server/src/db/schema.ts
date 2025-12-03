import { pgTable, serial, text, timestamp, jsonb, integer, vector, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Agent definitions - reusable agent configurations
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull().default('openai/gpt-oss-120b'),
  tools: jsonb('tools').$type<AgentTool[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Conversations - a session with an agent
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id).notNull(),
  title: text('title'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages within a conversation
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id).notNull(),
  role: text('role').$type<'user' | 'assistant' | 'system' | 'tool'>().notNull(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls').$type<ToolCall[]>(),
  toolCallId: text('tool_call_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ===================
// FLOW STATE MACHINE
// ===================

// Flow definitions - the state machine blueprint
export const flows = pgTable('flows', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  initialState: text('initial_state').notNull(),
  states: jsonb('states').$type<FlowState[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Flow executions - instances of running flows
export const flowExecutions = pgTable('flow_executions', {
  id: serial('id').primaryKey(),
  flowId: integer('flow_id').references(() => flows.id).notNull(),
  currentState: text('current_state').notNull(),
  status: text('status').$type<'running' | 'completed' | 'failed' | 'paused'>().notNull().default('running'),
  context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
  history: jsonb('history').$type<ExecutionHistoryEntry[]>().notNull().default([]),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===================
// KNOWLEDGE BASE
// ===================

// Knowledge Base - a collection of documents for RAG
export const knowledgeBases = pgTable('knowledge_bases', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  userId: integer('user_id').references(() => users.id),
  settings: jsonb('settings').$type<KnowledgeBaseSettings>().default({
    chunkSize: 1000,
    chunkOverlap: 200,
    embeddingModel: 'google/gemini-embedding-001',
  }),
  status: text('status').$type<'pending' | 'processing' | 'ready' | 'error'>().notNull().default('pending'),
  documentCount: integer('document_count').notNull().default(0),
  totalChunks: integer('total_chunks').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Documents within a knowledge base
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  knowledgeBaseId: integer('knowledge_base_id').references(() => knowledgeBases.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  source: text('source').$type<'file_upload' | 'github'>().notNull(),
  sourceMetadata: jsonb('source_metadata').$type<DocumentSourceMetadata>().default({}),
  content: text('content'),
  status: text('status').$type<'pending' | 'processing' | 'indexed' | 'error'>().notNull().default('pending'),
  error: text('error'),
  chunkCount: integer('chunk_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Document chunks with embeddings for RAG
// Note: Using 1536 dimensions to support text-embedding-3-small via OpenRouter (HNSW max is 2000)
export const documentChunks = pgTable('document_chunks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  knowledgeBaseId: integer('knowledge_base_id').references(() => knowledgeBases.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata').$type<ChunkMetadata>(),
  tokenCount: integer('token_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('document_chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('document_chunks_kb_idx').on(table.knowledgeBaseId),
]);

// ===================
// TYPE DEFINITIONS
// ===================

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

// State machine types
export type FlowState = {
  name: string;
  type: 'agent' | 'condition' | 'action' | 'end';
  // For agent states
  agentId?: number;
  prompt?: string; // Template with {{variable}} placeholders
  // For condition states
  condition?: string; // Expression to evaluate
  // Transitions to other states
  transitions: FlowTransition[];
};

export type FlowTransition = {
  target: string; // Target state name
  event?: string; // Event name that triggers this transition (e.g., 'success', 'failure', 'default')
  condition?: string; // Optional condition expression
};

export type ExecutionHistoryEntry = {
  state: string;
  timestamp: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
};

// Knowledge Base types
export type KnowledgeBaseSettings = {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large' | 'google/gemini-embedding-001';
};

export type DocumentSourceMetadata = {
  // For file uploads
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  // For GitHub
  repoUrl?: string;
  branch?: string;
  path?: string;
  commitSha?: string;
};

export type ChunkMetadata = {
  position: number;
  startChar?: number;
  endChar?: number;
  section?: string;
  pageNumber?: number;
};

// ===================
// STORY GENERATOR
// ===================

// Prompt Templates - versioned templates for Story Generator A/B testing
export const promptTemplates = pgTable('prompt_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'epic' | 'feature' | 'user_story'>().notNull(),
  version: integer('version').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull().default('google/gemini-2.0-flash-001'),
  status: text('status').$type<PromptTemplateStatus>().notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('prompt_templates_type_idx').on(table.type),
  index('prompt_templates_status_idx').on(table.status),
]);

// Story Generator Split Tests - A/B test configurations for prompt templates
export const storyGeneratorSplitTests = pgTable('story_generator_split_tests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  artifactType: text('artifact_type').$type<'epic' | 'feature' | 'user_story'>().notNull(),
  promptTemplateIds: jsonb('prompt_template_ids').$type<number[]>().notNull(),
  status: text('status').$type<SplitTestStatus>().notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('sg_split_tests_type_idx').on(table.artifactType),
  index('sg_split_tests_status_idx').on(table.status),
]);

// Generated artifacts (epics, features, user stories)
export const generatedArtifacts = pgTable('generated_artifacts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  type: text('type').$type<'epic' | 'feature' | 'user_story'>().notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Markdown content
  parentId: integer('parent_id'),
  // Generation context
  inputDescription: text('input_description').notNull(),
  inputFiles: jsonb('input_files').$type<GeneratedArtifactFile[]>().default([]),
  knowledgeBaseIds: jsonb('knowledge_base_ids').$type<number[]>().default([]),
  // A/B Testing - track which prompt template was used
  promptTemplateId: integer('prompt_template_id').references(() => promptTemplates.id, { onDelete: 'set null' }),
  splitTestId: integer('split_test_id').references(() => storyGeneratorSplitTests.id, { onDelete: 'set null' }),
  // Metadata
  status: text('status').$type<'draft' | 'final'>().notNull().default('draft'),
  generationMetadata: jsonb('generation_metadata').$type<GenerationMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('generated_artifacts_template_idx').on(table.promptTemplateId),
  index('generated_artifacts_split_test_idx').on(table.splitTestId),
]);

// Types for story generator
export type GeneratedArtifactFile = {
  name: string;
  mimeType: string;
  size: number;
  // For images, we store base64 or URL
  content?: string;
  url?: string;
};

export type GenerationMetadata = {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  generationTimeMs?: number;
  regeneratePrompt?: string;
};

// Story Generator Feedback - user feedback on generated artifacts
export const generationFeedback = pgTable('generation_feedback', {
  id: serial('id').primaryKey(),
  artifactId: integer('artifact_id').references(() => generatedArtifacts.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id),
  sentiment: text('sentiment').$type<FeedbackSentiment>().notNull(),
  text: text('text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('generation_feedback_artifact_idx').on(table.artifactId),
  index('generation_feedback_sentiment_idx').on(table.sentiment),
]);

// Story Generator Extracted Facts - facts detected in feedback
export const generationExtractedFacts = pgTable('generation_extracted_facts', {
  id: serial('id').primaryKey(),
  feedbackId: integer('feedback_id').references(() => generationFeedback.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  knowledgeBaseId: integer('knowledge_base_id').references(() => knowledgeBases.id, { onDelete: 'set null' }),
  status: text('status').$type<ExtractedFactStatus>().notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('gen_extracted_facts_feedback_idx').on(table.feedbackId),
  index('gen_extracted_facts_status_idx').on(table.status),
]);

// Story Generator Types
export type PromptTemplateStatus = 'draft' | 'active' | 'archived';

// ===================
// CODE CHAT
// ===================

// Code Chat Sessions - conversations about code knowledge bases
export const codeChatSessions = pgTable('code_chat_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  title: text('title'),
  knowledgeBaseIds: jsonb('knowledge_base_ids').$type<number[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Code Chat Messages - individual messages in a code chat session
export const codeChatMessages = pgTable('code_chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => codeChatSessions.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').$type<CodeChatCitation[]>().default([]),
  metadata: jsonb('metadata').$type<CodeChatMessageMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Code Chat Types
export type CodeChatCitation = {
  documentId: number;
  documentName: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  content: string;
  similarity: number;
};

export type CodeChatMessageMetadata = {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  responseTimeMs?: number;
  chunksSearched?: number;
};

// ===================
// AGENT FEEDBACK & A/B TESTING
// ===================

// Prompt Versions - different versions of agent prompts for A/B testing
export const promptVersions = pgTable('prompt_versions', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull(),
  status: text('status').$type<PromptVersionStatus>().notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('prompt_versions_agent_idx').on(table.agentId),
]);

// Split Tests - A/B test configurations
export const splitTests = pgTable('split_tests', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  promptVersionIds: jsonb('prompt_version_ids').$type<number[]>().notNull(),
  status: text('status').$type<SplitTestStatus>().notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('split_tests_agent_idx').on(table.agentId),
  index('split_tests_status_idx').on(table.status),
]);

// Agent Executions - tracks each agent execution with version info for A/B correlation
export const agentExecutions = pgTable('agent_executions', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  splitTestId: integer('split_test_id').references(() => splitTests.id, { onDelete: 'set null' }),
  promptVersionId: integer('prompt_version_id').references(() => promptVersions.id, { onDelete: 'set null' }),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  inputPrompt: text('input_prompt').notNull(),
  response: text('response').notNull(),
  metadata: jsonb('metadata').$type<ExecutionMetadata>(),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
}, (table) => [
  index('agent_executions_agent_idx').on(table.agentId),
  index('agent_executions_split_test_idx').on(table.splitTestId),
  index('agent_executions_version_idx').on(table.promptVersionId),
]);

// Feedback - user feedback on agent executions
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').references(() => agentExecutions.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id),
  sentiment: text('sentiment').$type<FeedbackSentiment>().notNull(),
  text: text('text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('feedback_execution_idx').on(table.executionId),
  index('feedback_sentiment_idx').on(table.sentiment),
]);

// Extracted Facts - facts detected in feedback to be added to Knowledge Base
export const extractedFacts = pgTable('extracted_facts', {
  id: serial('id').primaryKey(),
  feedbackId: integer('feedback_id').references(() => feedback.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  knowledgeBaseId: integer('knowledge_base_id').references(() => knowledgeBases.id, { onDelete: 'set null' }),
  status: text('status').$type<ExtractedFactStatus>().notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('extracted_facts_feedback_idx').on(table.feedbackId),
  index('extracted_facts_status_idx').on(table.status),
]);

// Feedback Loop Types
export type PromptVersionStatus = 'draft' | 'active' | 'archived';
export type SplitTestStatus = 'active' | 'completed' | 'paused';
export type FeedbackSentiment = 'positive' | 'negative';
export type ExtractedFactStatus = 'pending' | 'approved' | 'rejected';

export type ExecutionMetadata = {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  responseTimeMs?: number;
};
