import { db } from '../db/index.js';
import {
  codeChatSessions,
  codeChatMessages,
  knowledgeBases,
  documents,
  documentChunks,
  type CodeChatCitation,
  type CodeChatMessageMetadata,
  type KnowledgeBaseSettings,
} from '../db/schema.js';
import { eq, desc, inArray, sql, and } from 'drizzle-orm';
import { cosineDistance } from 'drizzle-orm';
import { embeddingService, type EmbeddingModel } from './embedding.js';
import { openrouter, type Message } from './openrouter.js';

// Types for API responses
export interface CodeChatSession {
  id: number;
  userId: number | null;
  title: string | null;
  knowledgeBaseIds: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeChatMessage {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  citations: CodeChatCitation[];
  metadata: CodeChatMessageMetadata | null;
  createdAt: Date;
}

export interface KnowledgeBaseInfo {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
  status: string;
}

export interface SearchContext {
  content: string;
  documentId: number;
  documentName: string;
  filePath?: string;
  similarity: number;
  metadata: {
    position: number;
    startChar?: number;
    endChar?: number;
  };
}

// System prompt for code chat
const CODE_CHAT_SYSTEM_PROMPT = `You are an AI assistant specialized in analyzing and explaining codebases. Your role is to help Product Managers and other non-technical stakeholders understand technical systems.

CORE CAPABILITIES:
1. **Logic Extraction**: Interpret code to explain business rules in plain English
2. **Flow Explanation**: Trace function calls to explain end-to-end flows
3. **Integration Analysis**: Identify API calls, data payloads, and external system integrations
4. **Effort Estimation**: Provide T-Shirt sizing (Small/Medium/Large/XL) for potential changes

RESPONSE GUIDELINES:
- Explain technical concepts in clear, non-technical language
- When referencing code, cite the specific file and relevant line numbers
- Structure responses with clear headings and bullet points when appropriate
- If you cannot find relevant code for a question, explicitly state this rather than guessing
- Use markdown formatting for code snippets, lists, and emphasis
- When providing effort estimates, explain the rationale based on the code complexity

CITATION FORMAT:
When referencing code, use this format: [filename:line_number] or [filename:start_line-end_line]

SECURITY:
- Never expose API keys, passwords, secrets, or credentials found in the code
- Mask sensitive values if they appear in code snippets
- Focus on business logic, not security-sensitive implementation details

CONTEXT HANDLING:
You will receive relevant code snippets from the selected knowledge bases. Use these to provide accurate, grounded answers. If the context doesn't contain information needed to answer a question, say so clearly.`;

// Get list of code-related knowledge bases (filtered by source type)
async function getCodeKnowledgeBases(): Promise<KnowledgeBaseInfo[]> {
  const kbs = await db
    .select({
      id: knowledgeBases.id,
      name: knowledgeBases.name,
      description: knowledgeBases.description,
      documentCount: knowledgeBases.documentCount,
      status: knowledgeBases.status,
    })
    .from(knowledgeBases)
    .where(eq(knowledgeBases.status, 'ready'))
    .orderBy(desc(knowledgeBases.createdAt));

  // Filter to only include KBs that have code-related documents
  // (GitHub source or file extensions like .ts, .js, .py, etc.)
  const codeKbs: KnowledgeBaseInfo[] = [];

  for (const kb of kbs) {
    const docs = await db
      .select({ source: documents.source, name: documents.name })
      .from(documents)
      .where(eq(documents.knowledgeBaseId, kb.id))
      .limit(10);

    const hasCodeDocs = docs.some((doc) => {
      // Check if it's from GitHub
      if (doc.source === 'github') return true;
      // Check common code file extensions
      const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.rs', '.c', '.cpp', '.h', '.hpp', '.vue', '.svelte'];
      return codeExtensions.some((ext) => doc.name.toLowerCase().endsWith(ext));
    });

    if (hasCodeDocs || docs.length === 0) {
      codeKbs.push(kb);
    }
  }

  return codeKbs;
}

// Create a new chat session
async function createSession(data: {
  userId?: number;
  knowledgeBaseIds: number[];
  title?: string;
}): Promise<CodeChatSession> {
  if (data.knowledgeBaseIds.length === 0) {
    throw new Error('At least one knowledge base must be selected');
  }

  const [session] = await db
    .insert(codeChatSessions)
    .values({
      userId: data.userId,
      knowledgeBaseIds: data.knowledgeBaseIds,
      title: data.title || 'New Chat',
    })
    .returning();

  return session as CodeChatSession;
}

// Get a session with its messages
async function getSession(sessionId: number): Promise<{
  session: CodeChatSession;
  messages: CodeChatMessage[];
  knowledgeBases: KnowledgeBaseInfo[];
} | null> {
  const [session] = await db
    .select()
    .from(codeChatSessions)
    .where(eq(codeChatSessions.id, sessionId));

  if (!session) return null;

  const messages = await db
    .select()
    .from(codeChatMessages)
    .where(eq(codeChatMessages.sessionId, sessionId))
    .orderBy(codeChatMessages.createdAt);

  // Get KB info
  const kbIds = session.knowledgeBaseIds as number[];
  const kbs = kbIds.length > 0
    ? await db
        .select({
          id: knowledgeBases.id,
          name: knowledgeBases.name,
          description: knowledgeBases.description,
          documentCount: knowledgeBases.documentCount,
          status: knowledgeBases.status,
        })
        .from(knowledgeBases)
        .where(inArray(knowledgeBases.id, kbIds))
    : [];

  return {
    session: session as CodeChatSession,
    messages: messages as CodeChatMessage[],
    knowledgeBases: kbs,
  };
}

// List all sessions for a user
async function listSessions(userId?: number): Promise<CodeChatSession[]> {
  const query = userId
    ? db.select().from(codeChatSessions).where(eq(codeChatSessions.userId, userId))
    : db.select().from(codeChatSessions);

  const results = await query.orderBy(desc(codeChatSessions.updatedAt));
  return results as CodeChatSession[];
}

// Delete a session
async function deleteSession(sessionId: number): Promise<boolean> {
  const result = await db
    .delete(codeChatSessions)
    .where(eq(codeChatSessions.id, sessionId));

  return (result.rowCount ?? 0) > 0;
}

// Search across multiple knowledge bases
async function searchKnowledgeBases(
  knowledgeBaseIds: number[],
  query: string,
  limit: number = 10
): Promise<SearchContext[]> {
  if (knowledgeBaseIds.length === 0) return [];

  // Get the first KB's settings for the embedding model
  const [firstKb] = await db
    .select({ settings: knowledgeBases.settings })
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, knowledgeBaseIds[0]));

  const settings = (firstKb?.settings as KnowledgeBaseSettings) || {
    embeddingModel: 'google/gemini-embedding-001',
  };

  // Generate query embedding
  const queryEmbedding = await embeddingService.generateQueryEmbedding(
    query,
    settings.embeddingModel as EmbeddingModel
  );

  // Search using cosine similarity across all selected KBs
  const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

  const results = await db
    .select({
      content: documentChunks.content,
      documentId: documentChunks.documentId,
      metadata: documentChunks.metadata,
      similarity,
    })
    .from(documentChunks)
    .where(inArray(documentChunks.knowledgeBaseId, knowledgeBaseIds))
    .orderBy(desc(similarity))
    .limit(limit);

  // Get document names and metadata
  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = docIds.length > 0
    ? await db
        .select({
          id: documents.id,
          name: documents.name,
          sourceMetadata: documents.sourceMetadata,
        })
        .from(documents)
        .where(inArray(documents.id, docIds))
    : [];

  const docMap = new Map(
    docs.map((d) => [d.id, { name: d.name, sourceMetadata: d.sourceMetadata }])
  );

  return results
    .filter((r) => r.similarity > 0.5)
    .map((r) => {
      const doc = docMap.get(r.documentId);
      const sourceMetadata = doc?.sourceMetadata as { path?: string } | undefined;
      return {
        content: r.content,
        documentId: r.documentId,
        documentName: doc?.name || 'Unknown',
        filePath: sourceMetadata?.path,
        similarity: r.similarity,
        metadata: r.metadata as { position: number; startChar?: number; endChar?: number },
      };
    });
}

// Send a message and get AI response
async function sendMessage(
  sessionId: number,
  userMessage: string
): Promise<{
  userMsg: CodeChatMessage;
  assistantMsg: CodeChatMessage;
}> {
  const startTime = Date.now();

  // Get session
  const sessionData = await getSession(sessionId);
  if (!sessionData) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const { session, messages } = sessionData;

  // Save user message
  const [userMsg] = await db
    .insert(codeChatMessages)
    .values({
      sessionId,
      role: 'user',
      content: userMessage,
      citations: [],
    })
    .returning();

  // Search for relevant context
  const searchResults = await searchKnowledgeBases(
    session.knowledgeBaseIds,
    userMessage,
    8
  );

  // Build context from search results
  const contextParts = searchResults.map((r, i) => {
    const location = r.filePath || r.documentName;
    return `[Source ${i + 1}: ${location}]\n${r.content}`;
  });

  const contextText = contextParts.length > 0
    ? `\n\nRelevant code context from the codebase:\n\n${contextParts.join('\n\n---\n\n')}`
    : '\n\n[No relevant code context found for this query]';

  // Build message history
  const messageHistory: Message[] = [
    { role: 'system', content: CODE_CHAT_SYSTEM_PROMPT },
  ];

  // Add previous messages (limit to last 20 for context window)
  const recentMessages = messages.slice(-20);
  for (const msg of recentMessages) {
    messageHistory.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current user message with context
  messageHistory.push({
    role: 'user',
    content: `${userMessage}${contextText}`,
  });

  // Call LLM
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
  const response = await openrouter.chat(messageHistory, {
    model,
    temperature: 0.3, // Lower temperature for more factual responses
    maxTokens: 4096,
  });

  const responseTimeMs = Date.now() - startTime;

  // Build citations from search results
  const citations: CodeChatCitation[] = searchResults.map((r) => ({
    documentId: r.documentId,
    documentName: r.documentName,
    filePath: r.filePath,
    content: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    similarity: r.similarity,
  }));

  // Save assistant message
  const [assistantMsg] = await db
    .insert(codeChatMessages)
    .values({
      sessionId,
      role: 'assistant',
      content: response.content,
      citations,
      metadata: {
        model,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        responseTimeMs,
        chunksSearched: searchResults.length,
      },
    })
    .returning();

  // Update session title if it's the first message
  if (messages.length === 0) {
    // Generate a title from the first user message
    const title = userMessage.length > 50
      ? userMessage.substring(0, 50) + '...'
      : userMessage;

    await db
      .update(codeChatSessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(codeChatSessions.id, sessionId));
  } else {
    // Just update the timestamp
    await db
      .update(codeChatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(codeChatSessions.id, sessionId));
  }

  return {
    userMsg: userMsg as CodeChatMessage,
    assistantMsg: assistantMsg as CodeChatMessage,
  };
}

// Update session knowledge bases
async function updateSessionKnowledgeBases(
  sessionId: number,
  knowledgeBaseIds: number[]
): Promise<CodeChatSession | null> {
  if (knowledgeBaseIds.length === 0) {
    throw new Error('At least one knowledge base must be selected');
  }

  const [updated] = await db
    .update(codeChatSessions)
    .set({
      knowledgeBaseIds,
      updatedAt: new Date(),
    })
    .where(eq(codeChatSessions.id, sessionId))
    .returning();

  return (updated as CodeChatSession) || null;
}

export const codeChatService = {
  getCodeKnowledgeBases,
  createSession,
  getSession,
  listSessions,
  deleteSession,
  sendMessage,
  updateSessionKnowledgeBases,
};
