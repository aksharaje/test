import OpenAI from 'openai';

// Lazy-initialize the OpenRouter client to avoid startup errors when env var is missing
let _openrouter: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!_openrouter) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required for embeddings');
    }
    _openrouter = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return _openrouter;
}

export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'google/gemini-embedding-001';

export interface TextChunk {
  content: string;
  metadata: {
    position: number;
    startChar: number;
    endChar: number;
  };
}

/**
 * Split text into chunks with overlap
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let position = 0;
  let startChar = 0;

  while (startChar < text.length) {
    // Find end position for this chunk
    let endChar = Math.min(startChar + chunkSize, text.length);

    // Try to break at a sentence or paragraph boundary
    if (endChar < text.length) {
      const searchText = text.slice(startChar, endChar);

      // Look for paragraph break
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      if (paragraphBreak > chunkSize * 0.5) {
        endChar = startChar + paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = Math.max(
          searchText.lastIndexOf('. '),
          searchText.lastIndexOf('.\n'),
          searchText.lastIndexOf('! '),
          searchText.lastIndexOf('? ')
        );
        if (sentenceBreak > chunkSize * 0.5) {
          endChar = startChar + sentenceBreak + 2;
        }
      }
    }

    const content = text.slice(startChar, endChar).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        metadata: {
          position,
          startChar,
          endChar,
        },
      });
      position++;
    }

    // Move start position (with overlap)
    startChar = endChar - chunkOverlap;
    if (startChar >= text.length) break;
    if (endChar >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(
  texts: string[],
  model: EmbeddingModel = 'text-embedding-3-small'
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Batch requests to avoid rate limits
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await getOpenRouterClient().embeddings.create({
      model,
      input: batch,
    });

    const embeddings = response.data.map((item) => item.embedding);
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query
 */
export async function generateQueryEmbedding(
  query: string,
  model: EmbeddingModel = 'text-embedding-3-small'
): Promise<number[]> {
  const response = await getOpenRouterClient().embeddings.create({
    model,
    input: query,
  });

  return response.data[0].embedding;
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

export const embeddingService = {
  splitTextIntoChunks,
  generateEmbeddings,
  generateQueryEmbedding,
  estimateTokenCount,
};
