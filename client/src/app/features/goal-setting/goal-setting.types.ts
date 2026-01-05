/**
 * Goal Setting Types
 */

export interface GoalSettingSession {
  id: number;
  domain: string;  // PM Role / Domain
  strategy?: string;  // Company Strategy (optional)
  teamCharter?: string;  // Team Charter
  problemStatements?: string;  // Customer Problem Statements
  baselines?: string;  // Product-Specific Responsibilities (Baselines)
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  executiveSummary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Goal {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  category: 'strategic' | 'operational' | 'tactical';
  timeframe?: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  successCriteria?: string[];
  dependencies?: string[];
  risks?: string[];
  priority: 'high' | 'medium' | 'low';
  displayOrder: number;
}

export interface GoalSettingSessionCreate {
  domain: string;  // PM Role / Domain
  strategy?: string;  // Company Strategy (optional)
  teamCharter?: string;
  problemStatements?: string;
  baselines?: string;
}

export interface GoalSettingFullResponse {
  session: GoalSettingSession;
  goals: Goal[];
}
