/**
 * Release Readiness Types
 */

export interface ReleaseReadinessSession {
  id: number;
  name: string;
  integrationId: number;
  integrationName: string | null;
  integrationProvider: string | null;
  releaseIdentifier: string;
  releaseType: string;
  projectKey: string | null;
  status: 'draft' | 'assessing' | 'ready' | 'error';
  progressStep: number;
  progressTotal: number;
  progressMessage: string | null;
  errorMessage: string | null;
  readinessScore: number | null;
  maxPossibleScore: number;
  confidenceLevel: 'high' | 'moderate' | 'low' | 'unknown';
  recommendation: 'go' | 'no_go' | 'conditional_go' | 'pending';
  recommendationDetails: RecommendationDetails | null;
  componentScores: Record<string, ComponentScore> | null;
  targetReleaseDate: string | null;
  lastAssessmentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentScore {
  name: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'warn' | 'fail';
  details?: string;
}

export interface RecommendationDetails {
  summary: string;
  risks: Risk[];
  mitigations: string[];
}

export interface Risk {
  level: 'critical' | 'high' | 'medium' | 'low';
  area: string;
  description: string;
}

export interface CreateSessionRequest {
  name?: string;
  integrationId: number;
  releaseIdentifier: string;
  releaseType?: string;
  projectKey?: string;
  targetReleaseDate?: string;
}

export interface DefectStatusReport {
  sessionId: number;
  totalDefects: number;
  openCritical: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
  resolved: number;
  blockingDefects: number;
  defects: ReleaseWorkItem[];
}

export interface WorkCompletionReport {
  sessionId: number;
  totalItems: number;
  completed: number;
  inProgress: number;
  todo: number;
  completionPercent: number;
  totalPoints: number | null;
  completedPoints: number | null;
  pointsCompletionPercent: number | null;
  itemsWithAC: number;
  itemsWithACPercent: number;
}

export interface ReleaseWorkItem {
  id: number;
  sessionId: number;
  externalId: string;
  externalUrl: string | null;
  title: string;
  itemType: string;
  status: string;
  statusCategory: 'todo' | 'in_progress' | 'done';
  severity: string | null;
  isBlocking: boolean;
  hasAC: boolean;
  acSource: string | null;
  acCount: number;
  acVerified: boolean;
  linkedTests: number;
  testsPassed: number;
  testsFailed: number;
  testCoveragePercent: number | null;
  assignee: string | null;
  storyPoints: number | null;
  component: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  syncedAt: string;
}

export interface AssessmentResult {
  sessionId: number;
  readinessScore: number;
  maxPossibleScore: number;
  confidenceLevel: string;
  recommendation: string;
  recommendationDetails: RecommendationDetails;
  componentScores: Record<string, ComponentScore>;
  lastAssessmentAt: string;
}

export interface AssessmentStatusResponse {
  sessionId: number;
  status: string;
  progressStep: number;
  progressTotal: number;
  progressMessage: string | null;
  errorMessage: string | null;
}

export interface IntegrationCheckResponse {
  hasValidIntegration: boolean;
  integrations: Array<{
    id: number;
    name: string;
    provider: string;
    status: string;
  }>;
  message: string;
}
