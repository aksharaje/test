import type { PromptVersionStatus, SplitTestStatus } from '../agent-feedback/feedback.types';

// Flow types that can be optimized
export type FlowType = 'agent' | 'story_generator_epic' | 'story_generator_feature' | 'story_generator_user_story';

export interface FeedbackStats {
  positive: number;
  negative: number;
  total: number;
  positivePercent: number;
  negativePercent: number;
}

// Unified flow item for the list view
export interface FlowItem {
  id: string; // Composite ID: "agent:1" or "story_generator:epic"
  type: FlowType;
  name: string;
  description: string | null;
  feedbackStats: FeedbackStats;
}

// Version info (simplified for list display)
export interface VersionInfo {
  id: number;
  version: number;
  status: string;
  createdAt: string;
}

// Split test significance
export interface SignificanceResult {
  reached: boolean;
  confidence: number;
  winner: number | null;
  message: string;
}

// Split test info for flow details
export interface SplitTestInfo {
  id: number;
  name: string;
  status: string;
  significance: SignificanceResult;
}

// Unified flow optimization details
export interface FlowOptimizationDetails {
  id: string;
  type: FlowType;
  name: string;
  description: string | null;
  currentPrompt: string;
  draftPrompt: string | null;
  draftVersionId: number | null;
  feedbackStats: FeedbackStats;
  versions: VersionInfo[];
  splitTest: SplitTestInfo | null;
}

export interface GeneratedOptimization {
  currentPrompt: string;
  newPrompt: string;
  feedbackSummary: string;
}

export interface FeedbackItem {
  id: number;
  sentiment: 'positive' | 'negative';
  text: string | null;
  createdAt: string;
  artifactTitle?: string;
}

// Legacy types for backward compatibility
export interface AgentWithStats {
  id: number;
  name: string;
  description: string | null;
  systemPrompt: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  feedbackStats: FeedbackStats;
}

export interface PromptVersion {
  id: number;
  agentId: number;
  version: number;
  systemPrompt: string;
  model: string;
  status: PromptVersionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SplitTest {
  id: number;
  agentId: number;
  name: string;
  description: string | null;
  promptVersionIds: number[];
  status: SplitTestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SplitTestWithStats extends SplitTest {
  versionStats: VersionStat[];
  significance: SignificanceResult;
}

export interface VersionStat {
  version: PromptVersion | null;
  stats: {
    executions: number;
    feedback: {
      positive: number;
      negative: number;
      total: number;
      positiveRate: number;
    };
  };
}

export interface OptimizationDetails {
  agent: AgentWithStats;
  versions: PromptVersion[];
  feedbackStats: FeedbackStats;
  currentPrompt: string;
  draftPrompt: string | null;
  draftVersionId: number | null;
}

export interface CreateSplitTestRequest {
  name: string;
  description?: string;
  promptVersionIds: number[];
}

export interface CreateVersionRequest {
  systemPrompt: string;
  model: string;
  status?: PromptVersionStatus;
}
