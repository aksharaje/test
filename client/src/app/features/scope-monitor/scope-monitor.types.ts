export interface ScopeMonitorSession {
  id: number;
  projectName: string;
  originalScope: string;
  currentStatus: string;
  monitoringPeriod?: string;
  changeThreshold?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  executiveSummary?: string;
  scopeHealthScore?: number;
  totalChanges?: number;
  approvedChanges?: number;
  pendingChanges?: number;
  rejectedChanges?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ScopeChange {
  id: number;
  sessionId: number;
  changeTitle: string;
  changeDescription: string;
  changeType: string;
  requestedBy?: string;
  requestDate?: string;
  priority: string;
  status: string;
  impactLevel: string;
  affectedAreas?: string[];
  justification?: string;
  decisionRationale?: string;
  displayOrder: number;
}

export interface ImpactAssessment {
  id: number;
  sessionId: number;
  changeId?: number;
  assessmentType: string;
  impactArea: string;
  currentState: string;
  projectedImpact: string;
  severity: string;
  probability: string;
  mitigationStrategy?: string;
  costImpact?: string;
  scheduleImpact?: string;
  resourceImpact?: string;
  displayOrder: number;
}

export interface ScopeAlert {
  id: number;
  sessionId: number;
  alertType: string;
  alertTitle: string;
  alertDescription: string;
  severity: string;
  status: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  recommendedAction?: string;
  displayOrder: number;
}

export interface ScopeMonitorSessionCreate {
  projectName: string;
  originalScope: string;
  currentStatus: string;
  monitoringPeriod?: string;
  changeThreshold?: string;
}

export interface ScopeMonitorFullResponse {
  session: ScopeMonitorSession;
  scope_changes: ScopeChange[];
  impact_assessments: ImpactAssessment[];
  alerts: ScopeAlert[];
}
