import { eq, desc, count, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  agents,
  agentExecutions,
  feedback,
  promptVersions,
} from '../db/schema.js';
import { openrouter } from './openrouter.js';
import { feedbackService } from './feedback.js';
import { splitTestService } from './splitTest.js';

const FEEDBACK_SUMMARY_PROMPT = `You are analyzing user feedback for an AI agent to identify patterns and areas for improvement.

Here is the negative feedback from users:

{{FEEDBACK}}

Please provide a concise summary of the main issues and concerns. Structure your response as:

1. **Key Concerns**: List the top 3-5 main issues mentioned in the feedback
2. **Common Patterns**: Identify any recurring themes or patterns
3. **Suggested Focus Areas**: Based on the feedback, what should be the priority areas for improvement?

Keep your response clear and actionable.`;

const PROMPT_OPTIMIZATION_PROMPT = `You are an expert prompt engineer. Your task is to improve an AI agent's system prompt based on user feedback.

## Current System Prompt:
{{CURRENT_PROMPT}}

## User Feedback Summary:
{{FEEDBACK_SUMMARY}}

## Specific Negative Feedback Examples:
{{FEEDBACK_EXAMPLES}}

## Instructions:
Create an improved version of the system prompt that addresses the issues raised in the feedback. Make sure to:
1. Keep the core functionality and purpose of the agent
2. Address the specific concerns raised in feedback
3. Be more precise and clear where users reported confusion
4. Add guardrails or clarifications where users reported incorrect information

Respond with ONLY the new system prompt text. Do not include any explanation or commentary.`;

export class OptimizeService {
  /**
   * Get a list of all agents with their feedback statistics
   */
  async getAgentsWithStats() {
    const allAgents = await db.select().from(agents).orderBy(desc(agents.updatedAt));

    const agentsWithStats = await Promise.all(
      allAgents.map(async (agent) => {
        const stats = await feedbackService.getAgentFeedbackStats(agent.id);
        return {
          ...agent,
          feedbackStats: stats,
        };
      })
    );

    return agentsWithStats;
  }

  /**
   * Generate an AI summary of feedback issues for an agent
   */
  async generateFeedbackSummary(agentId: number): Promise<string> {
    const negativeFeedback = await feedbackService.getNegativeFeedbackText(agentId);

    if (negativeFeedback.length === 0) {
      return 'No negative feedback found for this agent.';
    }

    const feedbackText = negativeFeedback
      .slice(0, 50) // Limit to prevent token overflow
      .map((text, i) => `${i + 1}. "${text}"`)
      .join('\n');

    const prompt = FEEDBACK_SUMMARY_PROMPT.replace('{{FEEDBACK}}', feedbackText);

    const response = await openrouter.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 1000 }
    );

    return response.content;
  }

  /**
   * Generate an optimized prompt based on feedback
   */
  async generateOptimizedPrompt(agentId: number): Promise<{
    currentPrompt: string;
    newPrompt: string;
    feedbackSummary: string;
  }> {
    // Get the current agent
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));

    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }

    // Get the current active prompt version or fall back to agent's default
    const activeVersions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.agentId, agentId))
      .orderBy(desc(promptVersions.version))
      .limit(1);

    const currentPrompt = activeVersions.length > 0
      ? activeVersions[0].systemPrompt
      : agent.systemPrompt;

    // Generate feedback summary
    const feedbackSummary = await this.generateFeedbackSummary(agentId);

    // Get specific feedback examples
    const negativeFeedback = await feedbackService.getNegativeFeedbackText(agentId);
    const feedbackExamples = negativeFeedback
      .slice(0, 10)
      .map((text, i) => `${i + 1}. "${text}"`)
      .join('\n');

    // Generate optimized prompt
    const optimizationPrompt = PROMPT_OPTIMIZATION_PROMPT
      .replace('{{CURRENT_PROMPT}}', currentPrompt)
      .replace('{{FEEDBACK_SUMMARY}}', feedbackSummary)
      .replace('{{FEEDBACK_EXAMPLES}}', feedbackExamples || 'No specific examples available.');

    const response = await openrouter.chat(
      [{ role: 'user', content: optimizationPrompt }],
      { temperature: 0.4, maxTokens: 4000 }
    );

    return {
      currentPrompt,
      newPrompt: response.content,
      feedbackSummary,
    };
  }

  /**
   * Save an optimized prompt as a new draft version
   */
  async saveOptimizedPrompt(
    agentId: number,
    optimizedPrompt: string
  ) {
    // Get the agent's model
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));

    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }

    // Create as draft version
    return splitTestService.createPromptVersion({
      agentId,
      systemPrompt: optimizedPrompt,
      model: agent.model,
      status: 'draft',
    });
  }

  /**
   * Activate an optimized prompt version (make it the default)
   */
  async activateVersion(versionId: number) {
    const version = await splitTestService.getPromptVersion(versionId);

    if (!version) {
      throw new Error(`Version with id ${versionId} not found`);
    }

    // Archive all other active versions for this agent
    await db
      .update(promptVersions)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(promptVersions.agentId, version.agentId));

    // Activate this version
    await splitTestService.updatePromptVersion(versionId, { status: 'active' });

    // Also update the agent's default system prompt
    await db
      .update(agents)
      .set({
        systemPrompt: version.systemPrompt,
        model: version.model,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, version.agentId));

    return version;
  }

  /**
   * Get optimization details for an agent including current vs proposed prompts
   */
  async getOptimizationDetails(agentId: number) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));

    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }

    // Get all prompt versions
    const versions = await splitTestService.listPromptVersions(agentId);

    // Get feedback stats
    const feedbackStats = await feedbackService.getAgentFeedbackStats(agentId);

    // Get the latest draft version if any
    const draftVersion = versions.find((v) => v.status === 'draft');

    // Get the current active version
    const activeVersion = versions.find((v) => v.status === 'active');

    return {
      agent,
      versions,
      feedbackStats,
      currentPrompt: activeVersion?.systemPrompt || agent.systemPrompt,
      draftPrompt: draftVersion?.systemPrompt,
      draftVersionId: draftVersion?.id,
    };
  }
}

export const optimizeService = new OptimizeService();
