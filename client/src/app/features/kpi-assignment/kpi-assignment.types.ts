/**
 * KPI Assignment Types
 *
 * AI-powered KPI assignment from Goals
 */

export interface KpiAssignmentSession {
  id: number;
  goalSessionId?: number;
  okrSessionId?: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  executiveSummary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface KpiAssignment {
  id: number;
  sessionId: number;
  goalId?: number;
  keyResultId?: number;
  goalTitle?: string;
  goalCategory?: string;
  primaryKpi: string;
  measurementUnit: string;
  secondaryKpi?: string;
  checkFrequency: string;
  alternativeKpis?: string[];
  rationale?: string;
  metricSuggestions?: string[];
  notes?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Goal with inline KPI assignment
export interface GoalWithKpi {
  goal: {
    id: number;
    title: string;
    description: string;
    category: 'strategic' | 'operational' | 'tactical';
    priority: 'high' | 'medium' | 'low';
    timeframe?: string;
  };
  assignment: {
    id: number;
    primaryKpi: string;
    measurementUnit: string;
    secondaryKpi?: string;
    checkFrequency: string;
  } | null;
}

// Legacy support for Key Results
export interface KeyResultWithAssignment {
  objective: {
    id: number;
    title: string;
    category: string;
  };
  keyResult: {
    id: number;
    title: string;
    description: string;
    baselineValue?: string;
    targetValue: string;
  };
  assignment: {
    id: number;
    primaryKpi: string;
    measurementUnit: string;
    secondaryKpi?: string;
    checkFrequency: string;
  } | null;
}

export interface KpiAssignmentSessionCreate {
  goalSessionId?: number;
  okrSessionId?: number;
}

export interface KpiAssignmentCreate {
  goalId?: number;
  keyResultId?: number;
  primaryKpi: string;
  measurementUnit: string;
  secondaryKpi?: string;
  checkFrequency?: string;
  notes?: string;
}

// Assignment from full response (camelCase from API)
export interface KpiAssignmentFullItem {
  id: number;
  goalId?: number;
  goalTitle?: string;
  goalCategory?: string;
  primaryKpi: string;
  measurementUnit: string;
  secondaryKpi?: string;
  checkFrequency: string;
  alternativeKpis?: string[];
  rationale?: string;
  displayOrder: number;
}

export interface KpiAssignmentFullResponse {
  session: KpiAssignmentSession;
  assignments: KpiAssignmentFullItem[];
}
