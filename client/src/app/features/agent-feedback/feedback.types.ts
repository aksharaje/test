export type FeedbackSentiment = 'positive' | 'negative';
export type ExtractedFactStatus = 'pending' | 'approved' | 'rejected';
export type PromptVersionStatus = 'draft' | 'active' | 'archived';
export type SplitTestStatus = 'active' | 'completed' | 'paused';

export interface AgentExecution {
  id: number;
  agentId: number;
  splitTestId: number | null;
  promptVersionId: number | null;
  inputPrompt: string;
  response: string;
  metadata: ExecutionMetadata | null;
  executedAt: string;
}

export interface ExecutionMetadata {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  responseTimeMs?: number;
}

export interface Feedback {
  id: number;
  executionId: number;
  userId: number | null;
  sentiment: FeedbackSentiment;
  text: string | null;
  createdAt: string;
}

export interface ExtractedFact {
  id: number;
  feedbackId: number;
  content: string;
  knowledgeBaseId: number | null;
  status: ExtractedFactStatus;
  createdAt: string;
}

export interface FactAnalysisResult {
  isFact: boolean;
  extractedFact: string | null;
  confidence: number;
  factId?: number;
}

export interface SubmitFeedbackRequest {
  sentiment: FeedbackSentiment;
  text?: string;
  userId?: number;
}

export interface ApprovFactRequest {
  knowledgeBaseId: number;
}
