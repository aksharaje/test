/**
 * KPI Assignment Types
 *
 * KPI Assignment shows Goals from Goal Setting with inline forms
 * to assign KPIs (Primary, Secondary, Measurement Unit, Check Frequency)
 */

export interface KpiAssignmentSession {
  id: number;
  goalSessionId?: number;
  okrSessionId?: number;
  status: 'draft' | 'completed';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface KpiAssignment {
  id: number;
  sessionId: number;
  goalId?: number;
  keyResultId?: number;
  primaryKpi: string;
  measurementUnit: string;
  secondaryKpi?: string;
  checkFrequency: string;
  metricSuggestions?: string[];
  notes?: string;
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

export interface KpiAssignmentFullResponse {
  session: KpiAssignmentSession;
  goals: GoalWithKpi[];
  items: KeyResultWithAssignment[];  // Legacy
}
