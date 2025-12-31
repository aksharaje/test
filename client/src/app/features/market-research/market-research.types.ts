/**
 * Market Research Types
 */

export interface FocusAreaOption {
  value: string;
  label: string;
}

export interface IndustryOption {
  value: string;
  label: string;
}

export interface MarketInsight {
  text: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceCount: number;
  sources: string[];
}

export type ProblemAreaSourceType = 'manual' | 'ideation' | 'okr' | 'scope_definition';

export interface IdeationSessionSummary {
  id: number;
  problemStatement: string;
  ideaCount: number;
  createdAt: string;
}

export interface OkrSessionSummary {
  id: number;
  goalDescription: string;
  objectiveCount: number;
  createdAt: string;
}

export interface ScopeDefinitionSummary {
  id: number;
  projectName: string;
  productVision: string;
  createdAt: string;
}

export interface MarketResearchSession {
  id: number;
  problemArea: string;
  problemAreaSourceType?: ProblemAreaSourceType;
  problemAreaSourceId?: number;
  problemAreaContext?: string;
  industryContext: string;
  focusAreas: string[];
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  errorMessage?: string;
  executiveSummary?: string;
  marketTrends: MarketInsight[];
  expectationShifts: MarketInsight[];
  marketRisks: MarketInsight[];
  implications: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketResearchRequest {
  problemArea: string;
  problemAreaSourceType?: ProblemAreaSourceType;
  problemAreaSourceId?: number;
  problemAreaContext?: string;
  industryContext: string;
  focusAreas: string[];
}

export interface SessionStatus {
  id: number;
  status: string;
  errorMessage?: string;
}
