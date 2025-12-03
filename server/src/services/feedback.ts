import { eq, and, sql, desc, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  feedback,
  extractedFacts,
  agentExecutions,
  promptVersions,
  agents,
  documents,
  knowledgeBases,
  FeedbackSentiment,
  ExtractedFactStatus,
} from '../db/schema.js';
import { openrouter } from './openrouter.js';
import { knowledgeBaseService } from './knowledgeBase.js';

const FACT_DETECTION_PROMPT = `You are analyzing user feedback about an AI agent's output. Your task is to determine if the feedback contains a factual statement about company systems, processes, rules, or business logic that should be added to a knowledge base.

Examples of factual statements:
- "Expenses over $500 require VP approval, not Director approval"
- "The account payable system doesn't send actual payment until the invoice is marked as verified"
- "Our return policy is 30 days, not 14 days"
- "The HR system requires employee ID, not SSN"

Examples of non-factual feedback:
- "This response was too slow"
- "I don't like the formatting"
- "Can you make it shorter?"
- "Good job!"

Analyze the following feedback and respond with a JSON object:
{
  "isFact": true/false,
  "extractedFact": "The factual statement extracted and cleaned up" or null,
  "confidence": 0.0-1.0
}

Only respond with the JSON object, no other text.

Feedback to analyze:
`;

export class FeedbackService {
  /**
   * Submit feedback for an agent execution
   */
  async submitFeedback(data: {
    executionId: number;
    userId?: number;
    sentiment: FeedbackSentiment;
    text?: string;
  }) {
    // Verify execution exists
    const [execution] = await db
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.id, data.executionId));

    if (!execution) {
      throw new Error(`Execution with id ${data.executionId} not found`);
    }

    const [newFeedback] = await db
      .insert(feedback)
      .values({
        executionId: data.executionId,
        userId: data.userId,
        sentiment: data.sentiment,
        text: data.text,
      })
      .returning();

    return newFeedback;
  }

  /**
   * Get feedback by ID with related execution info
   */
  async getFeedback(id: number) {
    const [feedbackItem] = await db
      .select({
        feedback: feedback,
        execution: agentExecutions,
      })
      .from(feedback)
      .leftJoin(agentExecutions, eq(feedback.executionId, agentExecutions.id))
      .where(eq(feedback.id, id));

    return feedbackItem;
  }

  /**
   * Get all feedback for an execution
   */
  async getFeedbackForExecution(executionId: number) {
    return db
      .select()
      .from(feedback)
      .where(eq(feedback.executionId, executionId))
      .orderBy(desc(feedback.createdAt));
  }

  /**
   * Analyze feedback text to detect if it contains factual information
   * Returns the analysis result and creates an extracted fact if detected
   */
  async analyzeFeedbackForFacts(feedbackId: number): Promise<{
    isFact: boolean;
    extractedFact: string | null;
    confidence: number;
    factId?: number;
  }> {
    const [feedbackItem] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId));

    if (!feedbackItem) {
      throw new Error(`Feedback with id ${feedbackId} not found`);
    }

    if (!feedbackItem.text) {
      return { isFact: false, extractedFact: null, confidence: 0 };
    }

    // Use LLM to analyze the feedback
    const response = await openrouter.chat(
      [
        {
          role: 'user',
          content: FACT_DETECTION_PROMPT + feedbackItem.text,
        },
      ],
      {
        temperature: 0.1,
        maxTokens: 500,
      }
    );

    try {
      const analysis = JSON.parse(response.content);

      if (analysis.isFact && analysis.extractedFact && analysis.confidence > 0.7) {
        // Create an extracted fact record
        const [fact] = await db
          .insert(extractedFacts)
          .values({
            feedbackId,
            content: analysis.extractedFact,
            status: 'pending',
          })
          .returning();

        return {
          isFact: true,
          extractedFact: analysis.extractedFact,
          confidence: analysis.confidence,
          factId: fact.id,
        };
      }

      return {
        isFact: analysis.isFact || false,
        extractedFact: analysis.extractedFact || null,
        confidence: analysis.confidence || 0,
      };
    } catch {
      console.error('Failed to parse fact detection response:', response.content);
      return { isFact: false, extractedFact: null, confidence: 0 };
    }
  }

  /**
   * Approve an extracted fact and add it to a knowledge base
   */
  async approveFact(factId: number, knowledgeBaseId: number): Promise<void> {
    const [fact] = await db
      .select()
      .from(extractedFacts)
      .where(eq(extractedFacts.id, factId));

    if (!fact) {
      throw new Error(`Fact with id ${factId} not found`);
    }

    // Verify knowledge base exists
    const [kb] = await db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, knowledgeBaseId));

    if (!kb) {
      throw new Error(`Knowledge base with id ${knowledgeBaseId} not found`);
    }

    // Add the fact as a document to the knowledge base
    await knowledgeBaseService.addFactAsDocument(knowledgeBaseId, fact.content);

    // Update the fact status
    await db
      .update(extractedFacts)
      .set({
        status: 'approved',
        knowledgeBaseId,
      })
      .where(eq(extractedFacts.id, factId));
  }

  /**
   * Reject an extracted fact
   */
  async rejectFact(factId: number): Promise<void> {
    await db
      .update(extractedFacts)
      .set({ status: 'rejected' })
      .where(eq(extractedFacts.id, factId));
  }

  /**
   * Get extracted fact by ID
   */
  async getExtractedFact(id: number) {
    const [fact] = await db
      .select()
      .from(extractedFacts)
      .where(eq(extractedFacts.id, id));

    return fact;
  }

  /**
   * Get all pending extracted facts
   */
  async getPendingFacts() {
    return db
      .select({
        fact: extractedFacts,
        feedback: feedback,
      })
      .from(extractedFacts)
      .leftJoin(feedback, eq(extractedFacts.feedbackId, feedback.id))
      .where(eq(extractedFacts.status, 'pending'))
      .orderBy(desc(extractedFacts.createdAt));
  }

  /**
   * Get feedback statistics for an agent
   */
  async getAgentFeedbackStats(agentId: number) {
    const stats = await db
      .select({
        sentiment: feedback.sentiment,
        count: count(),
      })
      .from(feedback)
      .innerJoin(agentExecutions, eq(feedback.executionId, agentExecutions.id))
      .where(eq(agentExecutions.agentId, agentId))
      .groupBy(feedback.sentiment);

    const positive = stats.find((s) => s.sentiment === 'positive')?.count || 0;
    const negative = stats.find((s) => s.sentiment === 'negative')?.count || 0;
    const total = positive + negative;

    return {
      positive,
      negative,
      total,
      positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
    };
  }

  /**
   * Get feedback statistics per prompt version for A/B testing
   */
  async getVersionFeedbackStats(promptVersionId: number) {
    const stats = await db
      .select({
        sentiment: feedback.sentiment,
        count: count(),
      })
      .from(feedback)
      .innerJoin(agentExecutions, eq(feedback.executionId, agentExecutions.id))
      .where(eq(agentExecutions.promptVersionId, promptVersionId))
      .groupBy(feedback.sentiment);

    const positive = stats.find((s) => s.sentiment === 'positive')?.count || 0;
    const negative = stats.find((s) => s.sentiment === 'negative')?.count || 0;
    const total = positive + negative;

    return {
      positive,
      negative,
      total,
      positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
    };
  }

  /**
   * Get all feedback for an agent
   */
  async getAgentFeedback(agentId: number): Promise<{
    id: number;
    sentiment: 'positive' | 'negative';
    text: string | null;
    createdAt: Date;
    artifactTitle?: string;
  }[]> {
    const feedbackRecords = await db
      .select({
        id: feedback.id,
        sentiment: feedback.sentiment,
        text: feedback.text,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .innerJoin(agentExecutions, eq(feedback.executionId, agentExecutions.id))
      .where(eq(agentExecutions.agentId, agentId))
      .orderBy(desc(feedback.createdAt))
      .limit(100);

    return feedbackRecords.map((f) => ({
      id: f.id,
      sentiment: f.sentiment as 'positive' | 'negative',
      text: f.text,
      createdAt: f.createdAt,
    }));
  }

  /**
   * Get all negative feedback text for an agent (for summarization)
   */
  async getNegativeFeedbackText(agentId: number): Promise<string[]> {
    const negativeFeedback = await db
      .select({
        text: feedback.text,
      })
      .from(feedback)
      .innerJoin(agentExecutions, eq(feedback.executionId, agentExecutions.id))
      .where(
        and(
          eq(agentExecutions.agentId, agentId),
          eq(feedback.sentiment, 'negative')
        )
      )
      .orderBy(desc(feedback.createdAt))
      .limit(100);

    return negativeFeedback
      .map((f) => f.text)
      .filter((text): text is string => text !== null);
  }
}

export const feedbackService = new FeedbackService();
