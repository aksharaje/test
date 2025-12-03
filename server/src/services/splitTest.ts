import { eq, and, sql, desc, count, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  splitTests,
  promptVersions,
  agentExecutions,
  feedback,
  agents,
  SplitTestStatus,
  PromptVersionStatus,
} from '../db/schema.js';

export class SplitTestService {
  /**
   * Create a new prompt version for an agent
   */
  async createPromptVersion(data: {
    agentId: number;
    systemPrompt: string;
    model: string;
    status?: PromptVersionStatus;
  }) {
    // Get the next version number for this agent
    const existingVersions = await db
      .select({ version: promptVersions.version })
      .from(promptVersions)
      .where(eq(promptVersions.agentId, data.agentId))
      .orderBy(desc(promptVersions.version))
      .limit(1);

    const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    const [version] = await db
      .insert(promptVersions)
      .values({
        agentId: data.agentId,
        version: nextVersion,
        systemPrompt: data.systemPrompt,
        model: data.model,
        status: data.status || 'draft',
      })
      .returning();

    return version;
  }

  /**
   * Get a prompt version by ID
   */
  async getPromptVersion(id: number) {
    const [version] = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, id));

    return version;
  }

  /**
   * List all prompt versions for an agent
   */
  async listPromptVersions(agentId: number) {
    return db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.agentId, agentId))
      .orderBy(desc(promptVersions.version));
  }

  /**
   * Update a prompt version
   */
  async updatePromptVersion(
    id: number,
    data: Partial<{
      systemPrompt: string;
      model: string;
      status: PromptVersionStatus;
    }>
  ) {
    const [updated] = await db
      .update(promptVersions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(promptVersions.id, id))
      .returning();

    return updated;
  }

  /**
   * Create a new split test (A/B test)
   */
  async createSplitTest(data: {
    agentId: number;
    name: string;
    description?: string;
    promptVersionIds: number[];
  }) {
    // Verify all prompt versions exist and belong to the agent
    const versions = await db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentId, data.agentId),
          inArray(promptVersions.id, data.promptVersionIds)
        )
      );

    if (versions.length !== data.promptVersionIds.length) {
      throw new Error('One or more prompt versions not found or do not belong to this agent');
    }

    // Ensure at least 2 versions for A/B testing
    if (data.promptVersionIds.length < 2) {
      throw new Error('A split test requires at least 2 prompt versions');
    }

    // Deactivate any existing active split tests for this agent
    await db
      .update(splitTests)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(
        and(
          eq(splitTests.agentId, data.agentId),
          eq(splitTests.status, 'active')
        )
      );

    // Mark all versions in the test as active
    await db
      .update(promptVersions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(inArray(promptVersions.id, data.promptVersionIds));

    const [test] = await db
      .insert(splitTests)
      .values({
        agentId: data.agentId,
        name: data.name,
        description: data.description,
        promptVersionIds: data.promptVersionIds,
        status: 'active',
      })
      .returning();

    return test;
  }

  /**
   * Get a split test by ID with statistics
   */
  async getSplitTest(id: number) {
    const [test] = await db
      .select()
      .from(splitTests)
      .where(eq(splitTests.id, id));

    if (!test) {
      return null;
    }

    // Get statistics for each version in the test
    const versionStats = await Promise.all(
      test.promptVersionIds.map(async (versionId) => {
        const version = await this.getPromptVersion(versionId);
        const stats = await this.getVersionStats(versionId);
        return {
          version,
          stats,
        };
      })
    );

    // Check if statistical significance has been reached
    const significance = this.calculateStatisticalSignificance(versionStats);

    return {
      ...test,
      versionStats,
      significance,
    };
  }

  /**
   * List all split tests for an agent
   */
  async listSplitTests(agentId: number) {
    return db
      .select()
      .from(splitTests)
      .where(eq(splitTests.agentId, agentId))
      .orderBy(desc(splitTests.createdAt));
  }

  /**
   * Get the active split test for an agent
   */
  async getActiveSplitTest(agentId: number) {
    const [test] = await db
      .select()
      .from(splitTests)
      .where(
        and(
          eq(splitTests.agentId, agentId),
          eq(splitTests.status, 'active')
        )
      );

    return test;
  }

  /**
   * Update split test status
   */
  async updateSplitTestStatus(id: number, status: SplitTestStatus) {
    const [updated] = await db
      .update(splitTests)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(splitTests.id, id))
      .returning();

    return updated;
  }

  /**
   * Randomly select a prompt version from an active split test
   * Uses uniform random distribution
   */
  async selectVersionForExecution(agentId: number): Promise<number | null> {
    const activeTest = await this.getActiveSplitTest(agentId);

    if (!activeTest) {
      return null;
    }

    // Uniform random selection
    const randomIndex = Math.floor(Math.random() * activeTest.promptVersionIds.length);
    return activeTest.promptVersionIds[randomIndex];
  }

  /**
   * Get statistics for a specific prompt version
   */
  private async getVersionStats(versionId: number) {
    // Total executions
    const executions = await db
      .select({ count: count() })
      .from(agentExecutions)
      .where(eq(agentExecutions.promptVersionId, versionId));

    const executionCount = executions[0]?.count || 0;

    // Feedback breakdown
    const feedbackStats = await db
      .select({
        sentiment: feedback.sentiment,
        count: count(),
      })
      .from(feedback)
      .innerJoin(agentExecutions, eq(feedback.executionId, agentExecutions.id))
      .where(eq(agentExecutions.promptVersionId, versionId))
      .groupBy(feedback.sentiment);

    const positive = feedbackStats.find((s) => s.sentiment === 'positive')?.count || 0;
    const negative = feedbackStats.find((s) => s.sentiment === 'negative')?.count || 0;
    const totalFeedback = positive + negative;

    return {
      executions: executionCount,
      feedback: {
        positive,
        negative,
        total: totalFeedback,
        positiveRate: totalFeedback > 0 ? positive / totalFeedback : 0,
      },
    };
  }

  /**
   * Calculate if statistical significance has been reached
   * Uses a simplified chi-squared approximation
   */
  private calculateStatisticalSignificance(
    versionStats: { version: typeof promptVersions.$inferSelect | undefined; stats: { executions: number; feedback: { positive: number; negative: number; total: number; positiveRate: number; } } }[]
  ): {
    reached: boolean;
    confidence: number;
    winner: number | null;
    message: string;
  } {
    const MIN_SAMPLES = 30;
    const CONFIDENCE_THRESHOLD = 0.95;

    // Check if we have enough samples
    const allHaveEnoughSamples = versionStats.every(
      (v) => v.stats.feedback.total >= MIN_SAMPLES
    );

    if (!allHaveEnoughSamples) {
      const minSamples = Math.min(...versionStats.map((v) => v.stats.feedback.total));
      return {
        reached: false,
        confidence: 0,
        winner: null,
        message: `Need at least ${MIN_SAMPLES} feedback samples per version. Current minimum: ${minSamples}`,
      };
    }

    // Find the version with the highest positive rate
    let bestVersion: typeof versionStats[0] | null = null;
    let bestRate = 0;

    for (const v of versionStats) {
      if (v.stats.feedback.positiveRate > bestRate) {
        bestRate = v.stats.feedback.positiveRate;
        bestVersion = v;
      }
    }

    if (!bestVersion || !bestVersion.version) {
      return {
        reached: false,
        confidence: 0,
        winner: null,
        message: 'Unable to determine winner',
      };
    }

    // Simplified two-proportion z-test
    // Compare best version against the average of others
    const others = versionStats.filter((v) => v.version?.id !== bestVersion!.version?.id);
    const othersTotalPositive = others.reduce((sum, v) => sum + v.stats.feedback.positive, 0);
    const othersTotalFeedback = others.reduce((sum, v) => sum + v.stats.feedback.total, 0);
    const othersRate = othersTotalFeedback > 0 ? othersTotalPositive / othersTotalFeedback : 0;

    const p1 = bestVersion.stats.feedback.positiveRate;
    const p2 = othersRate;
    const n1 = bestVersion.stats.feedback.total;
    const n2 = othersTotalFeedback;

    // Pooled proportion
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));

    // Z-score
    const z = se > 0 ? (p1 - p2) / se : 0;

    // Convert to confidence (approximate using normal CDF)
    const confidence = this.normalCDF(Math.abs(z));

    const reached = confidence >= CONFIDENCE_THRESHOLD && p1 > p2;

    return {
      reached,
      confidence,
      winner: reached ? bestVersion.version.id : null,
      message: reached
        ? `Version ${bestVersion.version.version} is the winner with ${Math.round(confidence * 100)}% confidence`
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

export const splitTestService = new SplitTestService();
