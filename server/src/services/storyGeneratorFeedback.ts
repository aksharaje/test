import { eq, and, count, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  generationFeedback,
  generationExtractedFacts,
  generatedArtifacts,
  knowledgeBases,
  type FeedbackSentiment,
  type ExtractedFactStatus,
} from '../db/schema.js';
import { knowledgeBaseService } from './knowledgeBase.js';
import OpenAI from 'openai';

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

export interface SubmitFeedbackRequest {
  artifactId: number;
  sentiment: FeedbackSentiment;
  text?: string;
  userId?: number;
}

export interface FeedbackWithFacts {
  id: number;
  artifactId: number;
  userId: number | null;
  sentiment: FeedbackSentiment;
  text: string | null;
  createdAt: Date;
  extractedFacts: {
    id: number;
    content: string;
    status: ExtractedFactStatus;
    knowledgeBaseId: number | null;
  }[];
}

export interface ExtractedFact {
  content: string;
  isFactual: boolean;
  confidence: number;
}

export interface ArtifactFeedbackStats {
  artifactId: number;
  positive: number;
  negative: number;
  total: number;
  positiveRate: number;
}

export class StoryGeneratorFeedbackService {
  /**
   * Submit feedback for a generated artifact
   */
  async submitFeedback(request: SubmitFeedbackRequest): Promise<FeedbackWithFacts> {
    // Verify the artifact exists
    const [artifact] = await db
      .select()
      .from(generatedArtifacts)
      .where(eq(generatedArtifacts.id, request.artifactId));

    if (!artifact) {
      throw new Error('Artifact not found');
    }

    // Create the feedback record
    const [feedbackRecord] = await db
      .insert(generationFeedback)
      .values({
        artifactId: request.artifactId,
        userId: request.userId,
        sentiment: request.sentiment,
        text: request.text,
      })
      .returning();

    const result: FeedbackWithFacts = {
      id: feedbackRecord.id,
      artifactId: feedbackRecord.artifactId,
      userId: feedbackRecord.userId,
      sentiment: feedbackRecord.sentiment as FeedbackSentiment,
      text: feedbackRecord.text,
      createdAt: feedbackRecord.createdAt,
      extractedFacts: [],
    };

    // If negative feedback with text, analyze for facts
    if (request.sentiment === 'negative' && request.text) {
      const facts = await this.detectFacts(
        request.text,
        artifact.content,
        artifact.type as 'epic' | 'feature' | 'user_story'
      );

      // Store any detected facts
      for (const fact of facts) {
        if (fact.isFactual && fact.confidence >= 0.7) {
          const [extractedFact] = await db
            .insert(generationExtractedFacts)
            .values({
              feedbackId: feedbackRecord.id,
              content: fact.content,
              status: 'pending',
            })
            .returning();

          result.extractedFacts.push({
            id: extractedFact.id,
            content: extractedFact.content,
            status: extractedFact.status as ExtractedFactStatus,
            knowledgeBaseId: extractedFact.knowledgeBaseId,
          });
        }
      }
    }

    return result;
  }

  /**
   * Use LLM to detect facts in feedback text
   */
  private async detectFacts(
    feedbackText: string,
    artifactContent: string,
    artifactType: 'epic' | 'feature' | 'user_story'
  ): Promise<ExtractedFact[]> {
    const client = getOpenRouterClient();
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

    const systemPrompt = `You are an expert at identifying business rules, domain knowledge, and factual corrections in user feedback.

Analyze the feedback text and identify any statements that are:
1. Business rules or constraints (e.g., "passwords must be at least 8 characters")
2. Domain-specific facts (e.g., "users can only have one active subscription")
3. Corrections to incorrect assumptions in the generated content
4. Requirements that were missed or misunderstood

Do NOT extract:
- Subjective opinions or preferences
- Style/formatting suggestions
- General complaints without specific corrections

For each fact found, assess your confidence that it's a genuine business rule/fact (0.0 to 1.0).

IMPORTANT: Respond with ONLY a valid JSON array. No markdown, no code fences, no explanation.

Example response format:
[
  {"content": "Users must verify their email before making purchases", "isFactual": true, "confidence": 0.9},
  {"content": "The checkout flow requires 3 steps, not 4", "isFactual": true, "confidence": 0.85}
]

If no facts are found, respond with an empty array: []`;

    const userPrompt = `Artifact Type: ${artifactType}

Generated Content (for context):
${artifactContent.substring(0, 2000)}...

User Feedback:
${feedbackText}

Extract any business rules, facts, or corrections from this feedback.`;

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0]?.message?.content || '[]';

      // Clean up the response
      let cleaned = rawContent.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Handle both array and object responses
      const parsed = JSON.parse(cleaned);
      const facts = Array.isArray(parsed) ? parsed : (parsed.facts || []);

      return facts as ExtractedFact[];
    } catch (error) {
      console.error('Error detecting facts:', error);
      return [];
    }
  }

  /**
   * Get all feedback for an artifact
   */
  async getArtifactFeedback(artifactId: number): Promise<FeedbackWithFacts[]> {
    const feedbackRecords = await db
      .select()
      .from(generationFeedback)
      .where(eq(generationFeedback.artifactId, artifactId))
      .orderBy(desc(generationFeedback.createdAt));

    const results: FeedbackWithFacts[] = [];

    for (const feedback of feedbackRecords) {
      const facts = await db
        .select()
        .from(generationExtractedFacts)
        .where(eq(generationExtractedFacts.feedbackId, feedback.id));

      results.push({
        id: feedback.id,
        artifactId: feedback.artifactId,
        userId: feedback.userId,
        sentiment: feedback.sentiment as FeedbackSentiment,
        text: feedback.text,
        createdAt: feedback.createdAt,
        extractedFacts: facts.map((f) => ({
          id: f.id,
          content: f.content,
          status: f.status as ExtractedFactStatus,
          knowledgeBaseId: f.knowledgeBaseId,
        })),
      });
    }

    return results;
  }

  /**
   * Get feedback statistics for an artifact
   */
  async getArtifactStats(artifactId: number): Promise<ArtifactFeedbackStats> {
    const feedbackRecords = await db
      .select({ sentiment: generationFeedback.sentiment, count: count() })
      .from(generationFeedback)
      .where(eq(generationFeedback.artifactId, artifactId))
      .groupBy(generationFeedback.sentiment);

    const positive = feedbackRecords.find((r) => r.sentiment === 'positive')?.count || 0;
    const negative = feedbackRecords.find((r) => r.sentiment === 'negative')?.count || 0;
    const total = positive + negative;

    return {
      artifactId,
      positive,
      negative,
      total,
      positiveRate: total > 0 ? positive / total : 0,
    };
  }

  /**
   * Get pending extracted facts for review
   */
  async getPendingFacts(): Promise<{
    id: number;
    content: string;
    feedbackId: number;
    feedbackText: string | null;
    artifactId: number;
    artifactTitle: string;
    createdAt: Date;
  }[]> {
    const facts = await db
      .select({
        id: generationExtractedFacts.id,
        content: generationExtractedFacts.content,
        feedbackId: generationExtractedFacts.feedbackId,
        createdAt: generationExtractedFacts.createdAt,
      })
      .from(generationExtractedFacts)
      .where(eq(generationExtractedFacts.status, 'pending'))
      .orderBy(desc(generationExtractedFacts.createdAt));

    const results = [];

    for (const fact of facts) {
      const [feedback] = await db
        .select()
        .from(generationFeedback)
        .where(eq(generationFeedback.id, fact.feedbackId));

      if (feedback) {
        const [artifact] = await db
          .select({ id: generatedArtifacts.id, title: generatedArtifacts.title })
          .from(generatedArtifacts)
          .where(eq(generatedArtifacts.id, feedback.artifactId));

        results.push({
          id: fact.id,
          content: fact.content,
          feedbackId: fact.feedbackId,
          feedbackText: feedback.text,
          artifactId: artifact?.id || 0,
          artifactTitle: artifact?.title || 'Unknown',
          createdAt: fact.createdAt,
        });
      }
    }

    return results;
  }

  /**
   * Approve a fact and optionally add it to a knowledge base
   */
  async approveFact(factId: number, knowledgeBaseId?: number): Promise<void> {
    const [fact] = await db
      .select()
      .from(generationExtractedFacts)
      .where(eq(generationExtractedFacts.id, factId));

    if (!fact) {
      throw new Error('Fact not found');
    }

    // If knowledge base is specified, add the fact as a document
    if (knowledgeBaseId) {
      const [kb] = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.id, knowledgeBaseId));

      if (!kb) {
        throw new Error('Knowledge base not found');
      }

      // Add fact to knowledge base
      await knowledgeBaseService.addFactAsDocument(knowledgeBaseId, fact.content);
    }

    // Update fact status
    await db
      .update(generationExtractedFacts)
      .set({
        status: 'approved',
        knowledgeBaseId,
      })
      .where(eq(generationExtractedFacts.id, factId));
  }

  /**
   * Reject a fact
   */
  async rejectFact(factId: number): Promise<void> {
    await db
      .update(generationExtractedFacts)
      .set({ status: 'rejected' })
      .where(eq(generationExtractedFacts.id, factId));
  }

  /**
   * Get feedback statistics for multiple artifacts (for A/B testing)
   */
  async getStatsForArtifacts(artifactIds: number[]): Promise<Map<number, ArtifactFeedbackStats>> {
    if (artifactIds.length === 0) {
      return new Map();
    }

    const feedbackRecords = await db
      .select({
        artifactId: generationFeedback.artifactId,
        sentiment: generationFeedback.sentiment,
        count: count(),
      })
      .from(generationFeedback)
      .where(inArray(generationFeedback.artifactId, artifactIds))
      .groupBy(generationFeedback.artifactId, generationFeedback.sentiment);

    const statsMap = new Map<number, ArtifactFeedbackStats>();

    // Initialize all artifacts with zero stats
    for (const id of artifactIds) {
      statsMap.set(id, {
        artifactId: id,
        positive: 0,
        negative: 0,
        total: 0,
        positiveRate: 0,
      });
    }

    // Fill in actual stats
    for (const record of feedbackRecords) {
      const stats = statsMap.get(record.artifactId);
      if (stats) {
        if (record.sentiment === 'positive') {
          stats.positive = record.count;
        } else {
          stats.negative = record.count;
        }
        stats.total = stats.positive + stats.negative;
        stats.positiveRate = stats.total > 0 ? stats.positive / stats.total : 0;
      }
    }

    return statsMap;
  }

  /**
   * Generate an AI summary of negative feedback for an artifact
   */
  async generateFeedbackSummary(artifactId: number): Promise<string> {
    const feedback = await this.getArtifactFeedback(artifactId);
    const negativeFeedback = feedback.filter((f) => f.sentiment === 'negative' && f.text);

    if (negativeFeedback.length === 0) {
      return 'No negative feedback to summarize.';
    }

    const client = getOpenRouterClient();
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

    const feedbackTexts = negativeFeedback.map((f) => `- ${f.text}`).join('\n');

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that summarizes user feedback. Provide a concise summary of the main themes and issues raised in the feedback. Be constructive and focus on actionable insights.',
        },
        {
          role: 'user',
          content: `Summarize the following negative feedback on a generated artifact:\n\n${feedbackTexts}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || 'Unable to generate summary.';
  }
}

export const storyGeneratorFeedbackService = new StoryGeneratorFeedbackService();
