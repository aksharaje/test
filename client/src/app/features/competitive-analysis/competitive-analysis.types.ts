/**
 * Competitive Analysis Types
 */

export interface ProblemAreaOption {
  value: string;
  label: string;
}

export interface Opportunity {
  text: string;
  tag: string;
  priority: 'high' | 'medium' | 'low';
  icon?: string;
}

export interface CompetitiveAnalysisSession {
  id: number;
  problemArea: string;
  customProblemArea?: string;
  referenceCompetitors: string[];
  includeDirectCompetitors: boolean;
  includeBestInClass: boolean;
  includeAdjacentIndustries: boolean;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  errorMessage?: string;
  executiveSummary?: string;
  industryStandards: string[];
  bestPractices: string[];
  commonPitfalls: string[];
  productGaps: string[];
  opportunities: Opportunity[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompetitiveAnalysisRequest {
  problemArea: string;
  customProblemArea?: string;
  referenceCompetitors?: string[];
  includeDirectCompetitors?: boolean;
  includeBestInClass?: boolean;
  includeAdjacentIndustries?: boolean;
}

export interface SessionStatus {
  id: number;
  status: string;
  errorMessage?: string;
}
