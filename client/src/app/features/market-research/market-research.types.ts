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

export interface MarketResearchSession {
  id: number;
  problemArea: string;
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
  industryContext: string;
  focusAreas: string[];
}

export interface SessionStatus {
  id: number;
  status: string;
  errorMessage?: string;
}
