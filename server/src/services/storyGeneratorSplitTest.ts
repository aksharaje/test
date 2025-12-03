import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  promptTemplates,
  storyGeneratorSplitTests,
  generatedArtifacts,
  generationFeedback,
  type PromptTemplateStatus,
  type SplitTestStatus,
} from '../db/schema.js';
import { storyGeneratorFeedbackService } from './storyGeneratorFeedback.js';

export interface CreatePromptTemplateRequest {
  name: string;
  type: 'epic' | 'feature' | 'user_story';
  systemPrompt: string;
  model?: string;
  status?: PromptTemplateStatus;
}

export interface CreateSplitTestRequest {
  name: string;
  description?: string;
  artifactType: 'epic' | 'feature' | 'user_story';
  promptTemplateIds: number[];
}

export interface PromptTemplateWithStats {
  template: typeof promptTemplates.$inferSelect;
  stats: {
    executions: number;
    positive: number;
    negative: number;
    total: number;
    positiveRate: number;
  };
}

export interface SplitTestWithStats {
  test: typeof storyGeneratorSplitTests.$inferSelect;
  templateStats: PromptTemplateWithStats[];
  significance: {
    reached: boolean;
    confidence: number;
    winner: number | null;
    message: string;
  };
}

export class StoryGeneratorSplitTestService {
  /**
   * Create a new prompt template
   */
  async createPromptTemplate(data: CreatePromptTemplateRequest) {
    // Get the next version number for this type
    const existingVersions = await db
      .select({ version: promptTemplates.version })
      .from(promptTemplates)
      .where(eq(promptTemplates.type, data.type))
      .orderBy(desc(promptTemplates.version))
      .limit(1);

    const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    const [template] = await db
      .insert(promptTemplates)
      .values({
        name: data.name,
        type: data.type,
        version: nextVersion,
        systemPrompt: data.systemPrompt,
        model: data.model || 'google/gemini-2.0-flash-001',
        status: data.status || 'draft',
      })
      .returning();

    return template;
  }

  /**
   * Get a prompt template by ID
   */
  async getPromptTemplate(id: number) {
    const [template] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, id));

    return template;
  }

  /**
   * List all prompt templates, optionally filtered by type
   */
  async listPromptTemplates(type?: 'epic' | 'feature' | 'user_story') {
    const query = type
      ? db.select().from(promptTemplates).where(eq(promptTemplates.type, type))
      : db.select().from(promptTemplates);

    return query.orderBy(desc(promptTemplates.version));
  }

  /**
   * Update a prompt template
   */
  async updatePromptTemplate(
    id: number,
    data: Partial<{
      name: string;
      systemPrompt: string;
      model: string;
      status: PromptTemplateStatus;
    }>
  ) {
    const [updated] = await db
      .update(promptTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(promptTemplates.id, id))
      .returning();

    return updated;
  }

  /**
   * Create a new split test for Story Generator
   */
  async createSplitTest(data: CreateSplitTestRequest) {
    // Verify all prompt templates exist and match the artifact type
    const templates = await db
      .select()
      .from(promptTemplates)
      .where(
        and(
          eq(promptTemplates.type, data.artifactType),
          inArray(promptTemplates.id, data.promptTemplateIds)
        )
      );

    if (templates.length !== data.promptTemplateIds.length) {
      throw new Error('One or more prompt templates not found or do not match the artifact type');
    }

    // Ensure at least 2 templates for A/B testing
    if (data.promptTemplateIds.length < 2) {
      throw new Error('A split test requires at least 2 prompt templates');
    }

    // Deactivate any existing active split tests for this artifact type
    await db
      .update(storyGeneratorSplitTests)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(
        and(
          eq(storyGeneratorSplitTests.artifactType, data.artifactType),
          eq(storyGeneratorSplitTests.status, 'active')
        )
      );

    // Mark all templates in the test as active
    await db
      .update(promptTemplates)
      .set({ status: 'active', updatedAt: new Date() })
      .where(inArray(promptTemplates.id, data.promptTemplateIds));

    const [test] = await db
      .insert(storyGeneratorSplitTests)
      .values({
        name: data.name,
        description: data.description,
        artifactType: data.artifactType,
        promptTemplateIds: data.promptTemplateIds,
        status: 'active',
      })
      .returning();

    return test;
  }

  /**
   * Get a split test by ID with statistics
   */
  async getSplitTest(id: number): Promise<SplitTestWithStats | null> {
    const [test] = await db
      .select()
      .from(storyGeneratorSplitTests)
      .where(eq(storyGeneratorSplitTests.id, id));

    if (!test) {
      return null;
    }

    // Get statistics for each template in the test
    const templateStats = await Promise.all(
      test.promptTemplateIds.map(async (templateId) => {
        const template = await this.getPromptTemplate(templateId);
        const stats = await this.getTemplateStats(templateId);
        return {
          template: template!,
          stats,
        };
      })
    );

    // Check if statistical significance has been reached
    const significance = this.calculateStatisticalSignificance(templateStats);

    return {
      test,
      templateStats,
      significance,
    };
  }

  /**
   * List all split tests, optionally filtered by artifact type
   */
  async listSplitTests(artifactType?: 'epic' | 'feature' | 'user_story') {
    const query = artifactType
      ? db.select().from(storyGeneratorSplitTests).where(eq(storyGeneratorSplitTests.artifactType, artifactType))
      : db.select().from(storyGeneratorSplitTests);

    return query.orderBy(desc(storyGeneratorSplitTests.createdAt));
  }

  /**
   * Get the active split test for an artifact type
   */
  async getActiveSplitTest(artifactType: 'epic' | 'feature' | 'user_story') {
    const [test] = await db
      .select()
      .from(storyGeneratorSplitTests)
      .where(
        and(
          eq(storyGeneratorSplitTests.artifactType, artifactType),
          eq(storyGeneratorSplitTests.status, 'active')
        )
      );

    return test;
  }

  /**
   * Update split test status
   */
  async updateSplitTestStatus(id: number, status: SplitTestStatus) {
    const [updated] = await db
      .update(storyGeneratorSplitTests)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(storyGeneratorSplitTests.id, id))
      .returning();

    return updated;
  }

  /**
   * Randomly select a prompt template from an active split test
   */
  async selectTemplateForGeneration(artifactType: 'epic' | 'feature' | 'user_story'): Promise<number | null> {
    const activeTest = await this.getActiveSplitTest(artifactType);

    if (!activeTest) {
      return null;
    }

    // Uniform random selection
    const randomIndex = Math.floor(Math.random() * activeTest.promptTemplateIds.length);
    return activeTest.promptTemplateIds[randomIndex];
  }

  /**
   * Get statistics for a specific prompt template
   */
  private async getTemplateStats(templateId: number) {
    // Get artifacts generated with this template
    const artifacts = await db
      .select({ id: generatedArtifacts.id })
      .from(generatedArtifacts)
      .where(eq(generatedArtifacts.promptTemplateId, templateId));

    const artifactIds = artifacts.map((a) => a.id);
    const executionCount = artifactIds.length;

    if (artifactIds.length === 0) {
      return {
        executions: 0,
        positive: 0,
        negative: 0,
        total: 0,
        positiveRate: 0,
      };
    }

    // Get feedback for these artifacts
    const feedbackStats = await db
      .select({
        sentiment: generationFeedback.sentiment,
        count: count(),
      })
      .from(generationFeedback)
      .where(inArray(generationFeedback.artifactId, artifactIds))
      .groupBy(generationFeedback.sentiment);

    const positive = feedbackStats.find((s) => s.sentiment === 'positive')?.count || 0;
    const negative = feedbackStats.find((s) => s.sentiment === 'negative')?.count || 0;
    const total = positive + negative;

    return {
      executions: executionCount,
      positive,
      negative,
      total,
      positiveRate: total > 0 ? positive / total : 0,
    };
  }

  /**
   * Calculate if statistical significance has been reached
   */
  private calculateStatisticalSignificance(
    templateStats: PromptTemplateWithStats[]
  ): {
    reached: boolean;
    confidence: number;
    winner: number | null;
    message: string;
  } {
    const MIN_SAMPLES = 30;
    const CONFIDENCE_THRESHOLD = 0.95;

    // Check if we have enough samples
    const allHaveEnoughSamples = templateStats.every(
      (t) => t.stats.total >= MIN_SAMPLES
    );

    if (!allHaveEnoughSamples) {
      const minSamples = Math.min(...templateStats.map((t) => t.stats.total));
      return {
        reached: false,
        confidence: 0,
        winner: null,
        message: `Need at least ${MIN_SAMPLES} feedback samples per template. Current minimum: ${minSamples}`,
      };
    }

    // Find the template with the highest positive rate
    let bestTemplate: PromptTemplateWithStats | null = null;
    let bestRate = 0;

    for (const t of templateStats) {
      if (t.stats.positiveRate > bestRate) {
        bestRate = t.stats.positiveRate;
        bestTemplate = t;
      }
    }

    if (!bestTemplate || !bestTemplate.template) {
      return {
        reached: false,
        confidence: 0,
        winner: null,
        message: 'Unable to determine winner',
      };
    }

    // Simplified two-proportion z-test
    const others = templateStats.filter((t) => t.template?.id !== bestTemplate!.template?.id);
    const othersTotalPositive = others.reduce((sum, t) => sum + t.stats.positive, 0);
    const othersTotalFeedback = others.reduce((sum, t) => sum + t.stats.total, 0);
    const othersRate = othersTotalFeedback > 0 ? othersTotalPositive / othersTotalFeedback : 0;

    const p1 = bestTemplate.stats.positiveRate;
    const p2 = othersRate;
    const n1 = bestTemplate.stats.total;
    const n2 = othersTotalFeedback;

    // Pooled proportion
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));

    // Z-score
    const z = se > 0 ? (p1 - p2) / se : 0;

    // Convert to confidence
    const confidence = this.normalCDF(Math.abs(z));

    const reached = confidence >= CONFIDENCE_THRESHOLD && p1 > p2;

    return {
      reached,
      confidence,
      winner: reached ? bestTemplate.template.id : null,
      message: reached
        ? `Template "${bestTemplate.template.name}" (v${bestTemplate.template.version}) is the winner with ${Math.round(confidence * 100)}% confidence`
        : `No statistically significant winner yet. Current confidence: ${Math.round(confidence * 100)}%`,
    };
  }

  /**
   * Approximate normal CDF for z-score
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }
}

export const storyGeneratorSplitTestService = new StoryGeneratorSplitTestService();
