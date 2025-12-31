/**
 * OKR Generator Types
 */

export interface OkrSession {
  id: number;
  goalDescription: string;
  goalSessionId?: number;
  timeframe: string;
  teamContext?: string;
  measurementPreferences?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  executiveSummary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Objective {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  category: 'company' | 'team' | 'individual';
  timeframe: string;
  strategicAlignment?: string;
  owner?: string;
  displayOrder: number;
  keyResults?: KeyResult[];
}

export interface KeyResult {
  id: number;
  objectiveId: number;
  sessionId: number;
  title: string;
  description: string;
  metricType: string;
  baselineValue?: string;
  targetValue: string;
  stretchTarget?: string;
  owner?: string;
  kpiName?: string;
  measurementMethod: string;
  dataSource?: string;
  trackingFrequency: string;
  displayOrder: number;
}

export interface Kpi {
  id: number;
  keyResultId?: number;
  sessionId: number;
  name: string;
  description: string;
  category: 'leading' | 'lagging';
  metricType: string;
  formula?: string;
  baseline?: string;
  target: string;
  unit?: string;
  dataSource?: string;
  collectionFrequency: string;
  owner?: string;
  displayOrder: number;
}

export interface OkrSessionCreate {
  goalDescription: string;
  goalSessionId?: number;
  timeframe: string;
  teamContext?: string;
  measurementPreferences?: string;
}

export interface OkrFullResponse {
  session: OkrSession;
  objectives: Objective[];
  kpis: Kpi[];
}
