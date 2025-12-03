export interface CodeChatSession {
  id: number;
  userId: number | null;
  title: string | null;
  knowledgeBaseIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface CodeChatCitation {
  documentId: number;
  documentName: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  content: string;
  similarity: number;
}

export interface CodeChatMessageMetadata {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  responseTimeMs?: number;
  chunksSearched?: number;
}

export interface CodeChatMessage {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  citations: CodeChatCitation[];
  metadata: CodeChatMessageMetadata | null;
  createdAt: string;
}

export interface KnowledgeBaseInfo {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
  status: string;
}

export interface SessionWithMessages {
  session: CodeChatSession;
  messages: CodeChatMessage[];
  knowledgeBases: KnowledgeBaseInfo[];
}

export interface SendMessageResponse {
  userMsg: CodeChatMessage;
  assistantMsg: CodeChatMessage;
}
