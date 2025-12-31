export interface ScopeMonitorSession {
  id: number;
  projectName: string;
  baselineScopeId?: number;
  baselineDescription?: string;
  currentRequirements: string;
  changeContext?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  executiveSummary?: string;
  scopeHealthScore?: number;
  creepRiskLevel?: string;
  recommendations?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ScopeChange {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  changeType: string;
  category: string;
  impactLevel: string;
  effortImpact?: string;
  timelineImpact?: string;
  budgetImpact?: string;
  isScopeCreep: boolean;
  creepType?: string;
  justification?: string;
  recommendation: string;
  recommendationRationale?: string;
  displayOrder: number;
}

export interface ImpactAssessment {
  id: number;
  sessionId: number;
  area: string;
  baselineValue?: string;
  currentValue?: string;
  projectedValue?: string;
  impactDescription: string;
  impactSeverity: string;
  mitigationOptions?: string[];
  recommendedAction?: string;
  displayOrder: number;
}

export interface ScopeAlert {
  id: number;
  sessionId: number;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  relatedChangeIds?: number[];
  actionRequired: boolean;
  suggestedAction?: string;
  escalationNeeded: boolean;
  status: string;
  displayOrder: number;
}

export interface ScopeMonitorSessionCreate {
  projectName: string;
  baselineScopeId?: number;
  baselineDescription?: string;
  currentRequirements: string;
  changeContext?: string;
}

export interface ScopeMonitorFullResponse {
  session: ScopeMonitorSession;
  scope_creep_changes: ScopeChange[];
  other_changes: ScopeChange[];
  impact_assessments: ImpactAssessment[];
  alerts: ScopeAlert[];
}
