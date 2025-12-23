/**
 * Ideation Engine Types
 *
 * TypeScript interfaces for ideation workflow.
 */

export interface IdeationSession {
  id: number;
  userId: number | null;
  problemStatement: string;
  constraints: string | null;
  goals: string | null;
  researchInsights: string | null;
  knowledgeBaseIds: number[] | null;
  structuredProblem: StructuredProblem | null;
  status: SessionStatus;
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
  confidence: 'low' | 'medium' | 'high';
  generationMetadata: GenerationMetadata | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StructuredProblem {
  who: string;
  what: string;
  why: string;
  impact: string;
  affects: string;
  constraints_parsed: string[];
  goals_parsed: string[];
  insights_parsed: string[];
}

export type SessionStatus =
  | 'pending'
  | 'parsing'
  | 'generating'
  | 'clustering'
  | 'enriching'
  | 'scoring'
  | 'deduplicating'
  | 'prioritizing'
  | 'completed'
  | 'failed';

export interface GeneratedIdea {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  category: IdeaCategory;
  effortEstimate: 'low' | 'medium' | 'high';
  impactEstimate: 'low' | 'medium' | 'high';
  clusterId: number | null;
  useCases: string[];
  edgeCases: string[];
  implementationNotes: string[];
  impactScore: number | null;
  impactRationale: string | null;
  feasibilityScore: number | null;
  feasibilityRationale: string | null;
  effortScore: number | null;
  effortRationale: string | null;
  strategicFitScore: number | null;
  strategicFitRationale: string | null;
  riskScore: number | null;
  riskRationale: string | null;
  compositeScore: number | null;
  displayOrder: number;
}

export type IdeaCategory = 'quick_wins' | 'strategic_bets' | 'incremental' | 'moonshots';

export interface IdeaCluster {
  id: number;
  sessionId: number;
  clusterNumber: number;
  themeName: string;
  themeDescription: string | null;
  ideaCount: number;
  ideas: GeneratedIdea[];
}

export interface SessionDetail {
  session: IdeationSession;
  clusters: IdeaCluster[];
  ideas: GeneratedIdea[];
  prioritizedBacklog?: any; // From opportunity linker
}

export interface GenerationMetadata {
  generation_time_ms: number;
  final_idea_count: number;
}

export interface CreateSessionRequest {
  problemStatement: string;
  constraints?: string;
  goals?: string;
  researchInsights?: string;
  knowledgeBaseIds?: number[];
}
