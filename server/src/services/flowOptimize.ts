import { eq, desc, count, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  agents,
  promptVersions,
  agentExecutions,
  feedback,
  promptTemplates,
  storyGeneratorSplitTests,
  generatedArtifacts,
  generationFeedback,
} from '../db/schema.js';
import { openrouter } from './openrouter.js';
import { feedbackService } from './feedback.js';
import { storyGeneratorFeedbackService } from './storyGeneratorFeedback.js';
import { storyGeneratorSplitTestService } from './storyGeneratorSplitTest.js';
import { splitTestService } from './splitTest.js';

// Flow types that can be optimized
export type FlowType = 'agent' | 'story_generator_epic' | 'story_generator_feature' | 'story_generator_user_story';

export interface FlowItem {
  id: string; // Composite ID: "agent:1" or "story_generator:epic"
  type: FlowType;
  name: string;
  description: string | null;
  feedbackStats: {
    positive: number;
    negative: number;
    total: number;
    positivePercent: number;
    negativePercent: number;
  };
}

export interface FlowOptimizationDetails {
  id: string;
  type: FlowType;
  name: string;
  description: string | null;
  currentPrompt: string;
  draftPrompt: string | null;
  draftVersionId: number | null;
  feedbackStats: {
    positive: number;
    negative: number;
    total: number;
    positivePercent: number;
    negativePercent: number;
  };
  versions: {
    id: number;
    version: number;
    status: string;
    createdAt: Date;
  }[];
  splitTest: {
    id: number;
    name: string;
    status: string;
    significance: {
      reached: boolean;
      confidence: number;
      winner: number | null;
      message: string;
    };
  } | null;
}

const FEEDBACK_SUMMARY_PROMPT = `You are analyzing user feedback for an AI-powered generation system to identify patterns and areas for improvement.

Here is the negative feedback from users:

{{FEEDBACK}}

Please provide a concise summary of the main issues and concerns. Structure your response as:

1. **Key Concerns**: List the top 3-5 main issues mentioned in the feedback
2. **Common Patterns**: Identify any recurring themes or patterns
3. **Suggested Focus Areas**: Based on the feedback, what should be the priority areas for improvement?

Keep your response clear and actionable.`;

const PROMPT_OPTIMIZATION_PROMPT = `You are an expert prompt engineer. Your task is to improve a system prompt based on user feedback.

## Current System Prompt:
{{CURRENT_PROMPT}}

## User Feedback Summary:
{{FEEDBACK_SUMMARY}}

## Specific Negative Feedback Examples:
{{FEEDBACK_EXAMPLES}}

## Instructions:
Create an improved version of the system prompt that addresses the issues raised in the feedback. Make sure to:
1. Keep the core functionality and purpose
2. Address the specific concerns raised in feedback
3. Be more precise and clear where users reported confusion
4. Add guardrails or clarifications where users reported incorrect information

Respond with ONLY the new system prompt text. Do not include any explanation or commentary.`;

export class FlowOptimizeService {
  /**
   * Get all optimizable flows with their feedback statistics
   */
  async getAllFlowsWithStats(): Promise<FlowItem[]> {
    const flows: FlowItem[] = [];

    // Get agents
    const allAgents = await db.select().from(agents).orderBy(desc(agents.updatedAt));
    for (const agent of allAgents) {
      const stats = await feedbackService.getAgentFeedbackStats(agent.id);
      flows.push({
        id: `agent:${agent.id}`,
        type: 'agent',
        name: agent.name,
        description: agent.description,
        feedbackStats: stats,
      });
    }

    // Get Story Generator flows (grouped by artifact type)
    const storyGeneratorTypes: Array<{ type: FlowType; label: string; artifactType: 'epic' | 'feature' | 'user_story' }> = [
      { type: 'story_generator_epic', label: 'Story Generator: Epic', artifactType: 'epic' },
      { type: 'story_generator_feature', label: 'Story Generator: Feature', artifactType: 'feature' },
      { type: 'story_generator_user_story', label: 'Story Generator: User Story', artifactType: 'user_story' },
    ];

    for (const sg of storyGeneratorTypes) {
      const stats = await this.getStoryGeneratorStats(sg.artifactType);
      flows.push({
        id: `story_generator:${sg.artifactType}`,
        type: sg.type,
        name: sg.label,
        description: `Generated ${sg.artifactType.replace('_', ' ')}s with A/B testing`,
        feedbackStats: stats,
      });
    }

    return flows;
  }

  /**
   * Get feedback stats for a Story Generator artifact type
   */
  private async getStoryGeneratorStats(artifactType: 'epic' | 'feature' | 'user_story') {
    // Get all artifacts of this type
    const artifacts = await db
      .select({ id: generatedArtifacts.id })
      .from(generatedArtifacts)
      .where(eq(generatedArtifacts.type, artifactType));

    const artifactIds = artifacts.map((a) => a.id);

    if (artifactIds.length === 0) {
      return { positive: 0, negative: 0, total: 0, positivePercent: 0, negativePercent: 0 };
    }

    // Get feedback for these artifacts
    const feedbackRecords = await db
      .select({
        sentiment: generationFeedback.sentiment,
        count: count(),
      })
      .from(generationFeedback)
      .where(inArray(generationFeedback.artifactId, artifactIds))
      .groupBy(generationFeedback.sentiment);

    const positive = feedbackRecords.find((r) => r.sentiment === 'positive')?.count || 0;
    const negative = feedbackRecords.find((r) => r.sentiment === 'negative')?.count || 0;
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
   * Get optimization details for a specific flow
   */
  async getFlowDetails(flowId: string): Promise<FlowOptimizationDetails> {
    const [flowType, id] = flowId.split(':');

    if (flowType === 'agent') {
      return this.getAgentDetails(parseInt(id));
    } else if (flowType === 'story_generator') {
      return this.getStoryGeneratorDetails(id as 'epic' | 'feature' | 'user_story');
    }

    throw new Error(`Unknown flow type: ${flowType}`);
  }

  /**
   * Get agent optimization details
   */
  private async getAgentDetails(agentId: number): Promise<FlowOptimizationDetails> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));

    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }

    let versions = await splitTestService.listPromptVersions(agentId);
    const feedbackStats = await feedbackService.getAgentFeedbackStats(agentId);

    // If no versions exist, create v1 with the agent's current prompt
    if (versions.length === 0) {
      const v1 = await splitTestService.createPromptVersion({
        agentId,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        status: 'active',
      });
      versions = [v1];
    }

    const draftVersion = versions.find((v) => v.status === 'draft');
    const activeVersion = versions.find((v) => v.status === 'active');

    return {
      id: `agent:${agentId}`,
      type: 'agent',
      name: agent.name,
      description: agent.description,
      currentPrompt: activeVersion?.systemPrompt || agent.systemPrompt,
      draftPrompt: draftVersion?.systemPrompt || null,
      draftVersionId: draftVersion?.id || null,
      feedbackStats,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        createdAt: v.createdAt,
      })),
      splitTest: null, // TODO: Add split test info for agents
    };
  }

  /**
   * Get Story Generator optimization details
   */
  private async getStoryGeneratorDetails(artifactType: 'epic' | 'feature' | 'user_story'): Promise<FlowOptimizationDetails> {
    const typeLabel = artifactType.replace('_', ' ');
    const flowType = `story_generator_${artifactType}` as FlowType;

    // Get templates for this type
    let templates = await storyGeneratorSplitTestService.listPromptTemplates(artifactType);
    const feedbackStats = await this.getStoryGeneratorStats(artifactType);

    // Default prompt
    const defaultPrompt = this.getDefaultStoryGeneratorPrompt(artifactType);

    // If no templates exist, create v1 with the default prompt
    if (templates.length === 0) {
      const v1 = await storyGeneratorSplitTestService.createPromptTemplate({
        name: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} Prompt v1`,
        type: artifactType,
        systemPrompt: defaultPrompt,
        status: 'active',
      });
      templates = [v1];
    }

    // Get active split test
    const activeSplitTest = await storyGeneratorSplitTestService.getActiveSplitTest(artifactType);
    let splitTestInfo = null;

    if (activeSplitTest) {
      const testWithStats = await storyGeneratorSplitTestService.getSplitTest(activeSplitTest.id);
      if (testWithStats) {
        splitTestInfo = {
          id: testWithStats.test.id,
          name: testWithStats.test.name,
          status: testWithStats.test.status,
          significance: testWithStats.significance,
        };
      }
    }

    // Get the active template (or first one)
    const activeTemplate = templates.find((t) => t.status === 'active');
    const draftTemplate = templates.find((t) => t.status === 'draft');

    return {
      id: `story_generator:${artifactType}`,
      type: flowType,
      name: `Story Generator: ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}`,
      description: `Generates ${typeLabel}s from user descriptions`,
      currentPrompt: activeTemplate?.systemPrompt || defaultPrompt,
      draftPrompt: draftTemplate?.systemPrompt || null,
      draftVersionId: draftTemplate?.id || null,
      feedbackStats,
      versions: templates.map((t) => ({
        id: t.id,
        version: t.version,
        status: t.status,
        createdAt: t.createdAt,
      })),
      splitTest: splitTestInfo,
    };
  }

  /**
   * Get negative feedback text for a flow
   */
  private async getNegativeFeedbackText(flowId: string): Promise<string[]> {
    const [flowType, id] = flowId.split(':');

    if (flowType === 'agent') {
      return feedbackService.getNegativeFeedbackText(parseInt(id));
    } else if (flowType === 'story_generator') {
      return this.getStoryGeneratorNegativeFeedback(id as 'epic' | 'feature' | 'user_story');
    }

    return [];
  }

  /**
   * Get negative feedback text for Story Generator
   */
  private async getStoryGeneratorNegativeFeedback(artifactType: 'epic' | 'feature' | 'user_story'): Promise<string[]> {
    const artifacts = await db
      .select({ id: generatedArtifacts.id })
      .from(generatedArtifacts)
      .where(eq(generatedArtifacts.type, artifactType));

    const artifactIds = artifacts.map((a) => a.id);

    if (artifactIds.length === 0) {
      return [];
    }

    const feedbackRecords = await db
      .select({ text: generationFeedback.text })
      .from(generationFeedback)
      .where(
        and(
          inArray(generationFeedback.artifactId, artifactIds),
          eq(generationFeedback.sentiment, 'negative')
        )
      )
      .orderBy(desc(generationFeedback.createdAt))
      .limit(100);

    return feedbackRecords
      .filter((f) => f.text)
      .map((f) => f.text as string);
  }

  /**
   * Generate feedback summary for a flow
   */
  async generateFeedbackSummary(flowId: string): Promise<string> {
    const negativeFeedback = await this.getNegativeFeedbackText(flowId);

    if (negativeFeedback.length === 0) {
      return 'No negative feedback found for this flow.';
    }

    const feedbackText = negativeFeedback
      .slice(0, 50)
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
   * Generate an optimized prompt for a flow
   */
  async generateOptimizedPrompt(flowId: string): Promise<{
    currentPrompt: string;
    newPrompt: string;
    feedbackSummary: string;
  }> {
    const details = await this.getFlowDetails(flowId);
    const feedbackSummary = await this.generateFeedbackSummary(flowId);

    const negativeFeedback = await this.getNegativeFeedbackText(flowId);
    const feedbackExamples = negativeFeedback
      .slice(0, 10)
      .map((text, i) => `${i + 1}. "${text}"`)
      .join('\n');

    const optimizationPrompt = PROMPT_OPTIMIZATION_PROMPT
      .replace('{{CURRENT_PROMPT}}', details.currentPrompt)
      .replace('{{FEEDBACK_SUMMARY}}', feedbackSummary)
      .replace('{{FEEDBACK_EXAMPLES}}', feedbackExamples || 'No specific examples available.');

    const response = await openrouter.chat(
      [{ role: 'user', content: optimizationPrompt }],
      { temperature: 0.4, maxTokens: 4000 }
    );

    return {
      currentPrompt: details.currentPrompt,
      newPrompt: response.content,
      feedbackSummary,
    };
  }

  /**
   * Save an optimized prompt as a new draft version
   */
  async saveOptimizedPrompt(flowId: string, optimizedPrompt: string) {
    const [flowType, id] = flowId.split(':');

    if (flowType === 'agent') {
      const agentId = parseInt(id);
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));

      if (!agent) {
        throw new Error(`Agent with id ${agentId} not found`);
      }

      return splitTestService.createPromptVersion({
        agentId,
        systemPrompt: optimizedPrompt,
        model: agent.model,
        status: 'draft',
      });
    } else if (flowType === 'story_generator') {
      const artifactType = id as 'epic' | 'feature' | 'user_story';

      return storyGeneratorSplitTestService.createPromptTemplate({
        name: `Optimized ${artifactType} prompt`,
        type: artifactType,
        systemPrompt: optimizedPrompt,
        status: 'draft',
      });
    }

    throw new Error(`Unknown flow type: ${flowType}`);
  }

  /**
   * Activate a prompt version
   */
  async activateVersion(flowId: string, versionId: number) {
    const [flowType] = flowId.split(':');

    if (flowType === 'agent') {
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

      // Update agent's default prompt
      await db
        .update(agents)
        .set({
          systemPrompt: version.systemPrompt,
          model: version.model,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, version.agentId));

      return version;
    } else if (flowType === 'story_generator') {
      const template = await storyGeneratorSplitTestService.getPromptTemplate(versionId);

      if (!template) {
        throw new Error(`Template with id ${versionId} not found`);
      }

      // Archive all other active templates of this type
      const allTemplates = await storyGeneratorSplitTestService.listPromptTemplates(template.type as 'epic' | 'feature' | 'user_story');
      for (const t of allTemplates) {
        if (t.status === 'active') {
          await storyGeneratorSplitTestService.updatePromptTemplate(t.id, { status: 'archived' });
        }
      }

      // Activate this template
      await storyGeneratorSplitTestService.updatePromptTemplate(versionId, { status: 'active' });

      return template;
    }

    throw new Error(`Unknown flow type: ${flowType}`);
  }

  /**
   * Create an A/B test for a flow
   */
  async createSplitTest(flowId: string, name: string, versionIds: number[]) {
    const [flowType, id] = flowId.split(':');

    if (flowType === 'agent') {
      return splitTestService.createSplitTest({
        agentId: parseInt(id),
        name,
        promptVersionIds: versionIds,
      });
    } else if (flowType === 'story_generator') {
      return storyGeneratorSplitTestService.createSplitTest({
        name,
        artifactType: id as 'epic' | 'feature' | 'user_story',
        promptTemplateIds: versionIds,
      });
    }

    throw new Error(`Unknown flow type: ${flowType}`);
  }

  /**
   * Get all feedback for a flow
   */
  async getFlowFeedback(flowId: string): Promise<{
    id: number;
    sentiment: 'positive' | 'negative';
    text: string | null;
    createdAt: Date;
    artifactTitle?: string;
  }[]> {
    const [flowType, id] = flowId.split(':');

    if (flowType === 'agent') {
      return feedbackService.getAgentFeedback(parseInt(id));
    } else if (flowType === 'story_generator') {
      return this.getStoryGeneratorFeedback(id as 'epic' | 'feature' | 'user_story');
    }

    return [];
  }

  /**
   * Get all feedback for Story Generator type
   */
  private async getStoryGeneratorFeedback(artifactType: 'epic' | 'feature' | 'user_story') {
    const artifacts = await db
      .select({ id: generatedArtifacts.id, title: generatedArtifacts.title })
      .from(generatedArtifacts)
      .where(eq(generatedArtifacts.type, artifactType));

    const artifactIds = artifacts.map((a) => a.id);
    const artifactMap = new Map(artifacts.map((a) => [a.id, a.title]));

    if (artifactIds.length === 0) {
      return [];
    }

    const feedbackRecords = await db
      .select({
        id: generationFeedback.id,
        artifactId: generationFeedback.artifactId,
        sentiment: generationFeedback.sentiment,
        text: generationFeedback.text,
        createdAt: generationFeedback.createdAt,
      })
      .from(generationFeedback)
      .where(inArray(generationFeedback.artifactId, artifactIds))
      .orderBy(desc(generationFeedback.createdAt))
      .limit(100);

    return feedbackRecords.map((f) => ({
      id: f.id,
      sentiment: f.sentiment as 'positive' | 'negative',
      text: f.text,
      createdAt: f.createdAt,
      artifactTitle: artifactMap.get(f.artifactId) || undefined,
    }));
  }

  /**
   * Get default Story Generator prompt for a type
   */
  private getDefaultStoryGeneratorPrompt(type: 'epic' | 'feature' | 'user_story'): string {
    // These match the prompts in storyGenerator.ts
    const base = `You are a JSON API that outputs product documentation.

CRITICAL RULES:
1. Output ONLY valid JSON - your entire response must be parseable JSON
2. NO markdown formatting, NO code fences, NO explanatory text
3. NO text before the opening { or after the closing }
4. NO comments or notes like "---" or "*All user stories...*"
5. Start your response with { and end with }

You create professional, specific, actionable product documentation.`;

    switch (type) {
      case 'epic':
        return `${base}

An epic represents a large initiative containing multiple features, each with their own user stories.

REQUIREMENTS:
- Generate 2-3 Features for this epic
- Each Feature should have 2-4 User Stories nested within it
- All content should be specific and detailed, not placeholder text
- Acceptance criteria should be in Gherkin format (Given/When/Then)`;

      case 'feature':
        return `${base}

A feature represents a specific capability or functionality with its related user stories.

REQUIREMENTS:
- Generate complete feature documentation
- Include 3-5 User Stories that implement this feature
- All content should be specific and detailed, not placeholder text
- Acceptance criteria should be in Gherkin format (Given/When/Then)`;

      case 'user_story':
        return `${base}

User stories describe functionality from an end-user perspective.

REQUIREMENTS:
- Generate 3-5 user stories
- Each story should be self-contained and testable
- Include 2-4 acceptance criteria scenarios per story
- Use the AS a/I WANT/SO THAT format for userStory field`;
    }
  }
}

export const flowOptimizeService = new FlowOptimizeService();
