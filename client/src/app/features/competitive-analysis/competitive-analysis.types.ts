/**
 * Competitive Analysis Types
 */

export interface FocusAreaOption {
  value: string;
  label: string;
}

export interface IndustryOption {
  value: string;
  label: string;
}

export interface InputSourceOption {
  value: string;
  label: string;
}

export interface Opportunity {
  text: string;
  tag: string;
  priority: 'high' | 'medium' | 'low';
  icon?: string;
}

export interface CodeKnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
  repoUrl: string | null;
}

// Input sources from other flows
export interface EpicOrFeature {
  id: number;
  type: 'epic' | 'feature';
  title: string;
  description: string;
}

export interface ScopeDefinitionSummary {
  id: number;
  projectName: string;
  productVision: string;
  createdAt: string;
}

export interface IdeationSessionSummary {
  id: number;
  problemStatement: string;
  ideaCount: number;
  createdAt: string;
}

export interface CompetitiveAnalysisSession {
  id: number;
  focusArea: string;
  customFocusArea?: string;
  referenceCompetitors: string[];
  includeBestInClass: boolean;
  includeAdjacentIndustries: boolean;
  targetIndustry?: string;
  inputSourceType?: string;
  inputSourceId?: number;
  inputSourceDescription?: string;
  knowledgeBaseId?: number;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  errorMessage?: string;
  executiveSummary?: string;
  industryStandards: string[];
  bestPractices: string[];
  commonPitfalls: string[];
  productGaps: string[];
  opportunities: Opportunity[];
  codeComparison?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompetitiveAnalysisRequest {
  focusArea: string;
  customFocusArea?: string;
  referenceCompetitors?: string[];
  includeBestInClass?: boolean;
  includeAdjacentIndustries?: boolean;
  targetIndustry?: string;
  inputSourceType?: string;
  inputSourceId?: number;
  inputSourceDescription?: string;
  knowledgeBaseId?: number;
}

export interface SessionStatus {
  id: number;
  status: string;
  errorMessage?: string;
}
