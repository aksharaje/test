export interface KnowledgeBaseSettings {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  userId: number | null;
  settings: KnowledgeBaseSettings;
  status: 'pending' | 'processing' | 'ready' | 'error';
  documentCount: number;
  totalChunks: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSourceMetadata {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  repoUrl?: string;
  branch?: string;
  path?: string;
  commitSha?: string;
}

export interface Document {
  id: number;
  knowledgeBaseId: number;
  name: string;
  source: 'file_upload' | 'github';
  sourceMetadata: DocumentSourceMetadata;
  content: string | null;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  chunkId: number;
  documentId: number;
  documentName: string;
  content: string;
  similarity: number;
  metadata: {
    position: number;
    startChar?: number;
    endChar?: number;
  };
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  settings?: Partial<KnowledgeBaseSettings>;
}

export interface GitHubImportRequest {
  repoUrl: string;
  token?: string;
}
