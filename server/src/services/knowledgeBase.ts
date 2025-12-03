import { db } from '../db/index.js';
import {
  knowledgeBases,
  documents,
  documentChunks,
  type KnowledgeBaseSettings,
  type DocumentSourceMetadata,
  type ChunkMetadata,
} from '../db/schema.js';
import { eq, sql, desc, and, cosineDistance, gt } from 'drizzle-orm';
import {
  embeddingService,
  type EmbeddingModel,
} from './embedding.js';
import { githubService, type GitHubFile } from './github.js';

// Types for API responses
export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  userId: number | null;
  settings: KnowledgeBaseSettings;
  status: 'pending' | 'processing' | 'ready' | 'error';
  documentCount: number;
  totalChunks: number;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  chunkId: number;
  documentId: number;
  documentName: string;
  content: string;
  similarity: number;
  metadata: ChunkMetadata;
}

// CRUD Operations
async function createKnowledgeBase(data: {
  name: string;
  description?: string;
  userId?: number;
  settings?: Partial<KnowledgeBaseSettings>;
}): Promise<KnowledgeBase> {
  const defaultSettings: KnowledgeBaseSettings = {
    chunkSize: 1000,
    chunkOverlap: 200,
    embeddingModel: 'text-embedding-3-small',
  };

  const [kb] = await db
    .insert(knowledgeBases)
    .values({
      name: data.name,
      description: data.description,
      userId: data.userId,
      settings: { ...defaultSettings, ...data.settings },
      status: 'pending',
    })
    .returning();

  return kb as KnowledgeBase;
}

async function getKnowledgeBase(id: number): Promise<KnowledgeBase | null> {
  const [kb] = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, id));

  return (kb as KnowledgeBase) || null;
}

async function listKnowledgeBases(userId?: number): Promise<KnowledgeBase[]> {
  const query = userId
    ? db.select().from(knowledgeBases).where(eq(knowledgeBases.userId, userId))
    : db.select().from(knowledgeBases);

  const results = await query.orderBy(desc(knowledgeBases.createdAt));
  return results as KnowledgeBase[];
}

async function updateKnowledgeBase(
  id: number,
  data: Partial<{ name: string; description: string; settings: Partial<KnowledgeBaseSettings> }>
): Promise<KnowledgeBase | null> {
  const existing = await getKnowledgeBase(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.settings) {
    updateData.settings = { ...existing.settings, ...data.settings };
  }

  const [updated] = await db
    .update(knowledgeBases)
    .set(updateData)
    .where(eq(knowledgeBases.id, id))
    .returning();

  return updated as KnowledgeBase;
}

async function deleteKnowledgeBase(id: number): Promise<boolean> {
  const result = await db
    .delete(knowledgeBases)
    .where(eq(knowledgeBases.id, id));

  return (result.rowCount ?? 0) > 0;
}

// Document operations
async function addDocument(data: {
  knowledgeBaseId: number;
  name: string;
  source: 'file_upload' | 'github';
  content: string;
  sourceMetadata?: DocumentSourceMetadata;
}): Promise<Document> {
  const [doc] = await db
    .insert(documents)
    .values({
      knowledgeBaseId: data.knowledgeBaseId,
      name: data.name,
      source: data.source,
      content: data.content,
      sourceMetadata: data.sourceMetadata || {},
      status: 'pending',
    })
    .returning();

  // Update document count
  await db
    .update(knowledgeBases)
    .set({
      documentCount: sql`${knowledgeBases.documentCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBases.id, data.knowledgeBaseId));

  return doc as Document;
}

async function getDocuments(knowledgeBaseId: number): Promise<Document[]> {
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.knowledgeBaseId, knowledgeBaseId))
    .orderBy(desc(documents.createdAt));

  return docs as Document[];
}

async function deleteDocument(documentId: number): Promise<boolean> {
  // Get the document first to update KB counts
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) return false;

  // Delete the document (chunks will cascade)
  await db.delete(documents).where(eq(documents.id, documentId));

  // Update counts
  await db
    .update(knowledgeBases)
    .set({
      documentCount: sql`${knowledgeBases.documentCount} - 1`,
      totalChunks: sql`${knowledgeBases.totalChunks} - ${doc.chunkCount}`,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBases.id, doc.knowledgeBaseId));

  return true;
}

// Indexing operations
async function indexDocument(documentId: number): Promise<void> {
  // Get document and knowledge base
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc || !doc.content) {
    throw new Error('Document not found or has no content');
  }

  const [kb] = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, doc.knowledgeBaseId));

  if (!kb) {
    throw new Error('Knowledge base not found');
  }

  const settings = kb.settings as KnowledgeBaseSettings;

  try {
    // Update status to processing
    await db
      .update(documents)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    await db
      .update(knowledgeBases)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(knowledgeBases.id, kb.id));

    // Split content into chunks
    const chunks = embeddingService.splitTextIntoChunks(
      doc.content,
      settings.chunkSize,
      settings.chunkOverlap
    );

    if (chunks.length === 0) {
      throw new Error('No chunks generated from document');
    }

    // Generate embeddings
    const embeddings = await embeddingService.generateEmbeddings(
      chunks.map((c) => c.content),
      settings.embeddingModel
    );

    // Insert chunks with embeddings
    const chunkData = chunks.map((chunk, i) => ({
      documentId,
      knowledgeBaseId: kb.id,
      content: chunk.content,
      embedding: embeddings[i],
      metadata: chunk.metadata as ChunkMetadata,
      tokenCount: embeddingService.estimateTokenCount(chunk.content),
    }));

    await db.insert(documentChunks).values(chunkData);

    // Update document status and chunk count
    await db
      .update(documents)
      .set({
        status: 'indexed',
        chunkCount: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    // Update KB total chunks and status
    await db
      .update(knowledgeBases)
      .set({
        totalChunks: sql`${knowledgeBases.totalChunks} + ${chunks.length}`,
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBases.id, kb.id));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db
      .update(documents)
      .set({ status: 'error', error: errorMessage, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    throw error;
  }
}

async function indexKnowledgeBase(knowledgeBaseId: number): Promise<void> {
  const docs = await getDocuments(knowledgeBaseId);
  const pendingDocs = docs.filter((d) => d.status === 'pending');

  for (const doc of pendingDocs) {
    await indexDocument(doc.id);
  }
}

// Search/Query operations
async function searchKnowledgeBase(
  knowledgeBaseId: number,
  query: string,
  limit: number = 5,
  similarityThreshold: number = 0.7
): Promise<SearchResult[]> {
  // Get KB settings for embedding model
  const kb = await getKnowledgeBase(knowledgeBaseId);
  if (!kb) {
    throw new Error('Knowledge base not found');
  }

  // Generate query embedding
  const queryEmbedding = await embeddingService.generateQueryEmbedding(
    query,
    kb.settings.embeddingModel as EmbeddingModel
  );

  // Search using cosine similarity
  const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

  const results = await db
    .select({
      chunkId: documentChunks.id,
      documentId: documentChunks.documentId,
      content: documentChunks.content,
      metadata: documentChunks.metadata,
      similarity,
    })
    .from(documentChunks)
    .where(
      and(
        eq(documentChunks.knowledgeBaseId, knowledgeBaseId),
        gt(similarity, similarityThreshold)
      )
    )
    .orderBy(desc(similarity))
    .limit(limit);

  // Get document names
  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = docIds.length > 0
    ? await db
        .select({ id: documents.id, name: documents.name })
        .from(documents)
        .where(sql`${documents.id} IN ${docIds}`)
    : [];

  const docMap = new Map(docs.map((d) => [d.id, d.name]));

  return results.map((r) => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    documentName: docMap.get(r.documentId) || 'Unknown',
    content: r.content,
    similarity: r.similarity,
    metadata: r.metadata as ChunkMetadata,
  }));
}

// GitHub import
async function importFromGitHub(
  knowledgeBaseId: number,
  repoUrl: string,
  token?: string
): Promise<Document[]> {
  const kb = await getKnowledgeBase(knowledgeBaseId);
  if (!kb) {
    throw new Error('Knowledge base not found');
  }

  const { owner, repo, branch } = githubService.parseGitHubUrl(repoUrl);
  const files = await githubService.importFromGitHub(repoUrl, token);

  const addedDocs: Document[] = [];

  for (const file of files) {
    const doc = await addDocument({
      knowledgeBaseId,
      name: file.name,
      source: 'github',
      content: file.content,
      sourceMetadata: {
        repoUrl: `https://github.com/${owner}/${repo}`,
        branch,
        path: file.path,
        commitSha: file.sha,
        fileName: file.name,
        fileSize: file.size,
      },
    });

    addedDocs.push(doc);
  }

  return addedDocs;
}

// File upload handling
async function uploadFiles(
  knowledgeBaseId: number,
  files: Array<{ name: string; content: string; mimeType: string; size: number }>
): Promise<Document[]> {
  const kb = await getKnowledgeBase(knowledgeBaseId);
  if (!kb) {
    throw new Error('Knowledge base not found');
  }

  const addedDocs: Document[] = [];

  for (const file of files) {
    const doc = await addDocument({
      knowledgeBaseId,
      name: file.name,
      source: 'file_upload',
      content: file.content,
      sourceMetadata: {
        fileName: file.name,
        mimeType: file.mimeType,
        fileSize: file.size,
      },
    });

    addedDocs.push(doc);
  }

  return addedDocs;
}

export const knowledgeBaseService = {
  // CRUD
  create: createKnowledgeBase,
  get: getKnowledgeBase,
  list: listKnowledgeBases,
  update: updateKnowledgeBase,
  delete: deleteKnowledgeBase,

  // Documents
  addDocument,
  getDocuments,
  deleteDocument,

  // Indexing
  indexDocument,
  indexKnowledgeBase,

  // Search
  search: searchKnowledgeBase,

  // Import
  importFromGitHub,
  uploadFiles,
};
