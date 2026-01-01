/**
 * Defect Manager Types
 */

export interface DefectManagerSession {
  id: number;
  name: string;
  integrationId: number;
  integrationName: string | null;
  integrationProvider: string | null;
  dataLevel: number;
  status: 'draft' | 'analyzing' | 'ready' | 'error';
  progressStep: number;
  progressTotal: number;
  progressMessage: string | null;
  errorMessage: string | null;
  analysisSnapshot: AnalysisSnapshot | null;
  lastAnalysisAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSnapshot {
  totalDefects: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byComponent: Record<string, number>;
  potentialDuplicates: number;
  agingDefects: number;
  criticalOpen: number;
}

export interface CreateSessionRequest {
  name?: string;
  integrationId: number;
  projectFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export interface AnalyzedDefect {
  id: number;
  sessionId: number;
  externalId: string;
  externalUrl: string | null;
  title: string;
  description: string | null;
  itemType: string;
  status: string;
  statusCategory: string;
  severity: string;
  severitySource: string;
  severityConfidence: number;
  priority: string | null;
  priorityOrder: number | null;
  component: string | null;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  affectedVersion: string | null;
  fixVersion: string | null;
  environment: string | null;
  rootCause: string | null;
  rootCauseCategory: string | null;
  duplicateOf: string | null;
  duplicateConfidence: number;
  patternGroup: string | null;
  suggestedPriority: number | null;
  priorityReasoning: string | null;
  createdExternal: string | null;
  updatedExternal: string | null;
  resolvedAt: string | null;
  daysOpen: number | null;
  syncedAt: string;
}

export interface TriageResult {
  sessionId: number;
  totalDefects: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byComponent: Record<string, number>;
  potentialDuplicates: number;
  agingDefects: number;
  criticalOpen: number;
  defects: AnalyzedDefect[];
}

export interface PreventionRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  basedOn: string;
  actions: string[];
}

export interface AnalysisStatusResponse {
  sessionId: number;
  status: string;
  progressStep: number;
  progressTotal: number;
  progressMessage: string | null;
  errorMessage: string | null;
}

export interface IntegrationCheckResponse {
  has_valid_integration: boolean;
  integrations: Array<{
    id: number;
    name: string;
    provider: string;
    status: string;
  }>;
  message: string;
}

export interface ProjectOption {
  key: string;
  name: string;
  description?: string;
}
