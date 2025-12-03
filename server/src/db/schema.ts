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

// Generated artifacts (epics, features, user stories)
export const generatedArtifacts = pgTable('generated_artifacts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  type: text('type').$type<'epic' | 'feature' | 'user_story'>().notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Markdown content
  parentId: integer('parent_id').references((): ReturnType<typeof pgTable> => generatedArtifacts.id),
  // Generation context
  inputDescription: text('input_description').notNull(),
  inputFiles: jsonb('input_files').$type<GeneratedArtifactFile[]>().default([]),
  knowledgeBaseIds: jsonb('knowledge_base_ids').$type<number[]>().default([]),
  // Metadata
  status: text('status').$type<'draft' | 'final'>().notNull().default('draft'),
  generationMetadata: jsonb('generation_metadata').$type<GenerationMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
