/**
 * CX Improvement Recommender Types
 *
 * TypeScript types for the CX Improvement Recommender feature.
 */

// --- Context Sources ---

export interface AvailableJourneyMap {
  id: number;
  journeyDescription: string;
  mode: string;
  painPointCount: number;
  stageCount: number;
  createdAt: string;
}

export interface AvailableGapAnalysis {
  id: number;
  analysisName: string;
  analysisType: string;
  gapCount: number;
  createdAt: string;
}

export interface ContextSources {
  journeyMaps: AvailableJourneyMap[];
  gapAnalyses: AvailableGapAnalysis[];
}

// --- Session ---

export interface RecommenderSession {
  id: number;
  userId?: number;
  sessionName?: string;
  journeyMapIds: number[];
  gapAnalysisIds: number[];
  ideaBacklogIds: number[];
  timeline: string;
  budget: string;
  teamCapacity?: string;
  recommendationType: string;
  status: 'pending' | 'extracting' | 'clustering' | 'generating' | 'scoring' | 'completed' | 'failed';
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
  totalRecommendations: number;
  quickWinsCount: number;
  highImpactCount: number;
  strategicCount: number;
  clusters?: Cluster[];
  sprintPlan?: SprintPlan;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Cluster {
  id: string;
  name: string;
  theme: string;
  painPointIds: number[];
  gapIds: number[];
  combinedSeverity: number;
}

export interface SprintPlan {
  sprint1_2: SprintItem[];
  sprint3_4: SprintItem[];
  q2Plus: SprintItem[];
  totalEffortDays: number;
  capacityWarning?: string;
}

export interface SprintItem {
  recId: number;
  title: string;
  effortDays: number;
}

// --- Recommendations ---

export interface Recommendation {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  clusterId?: string;
  solutionApproaches?: SolutionApproach[];
  addressesPainPoints?: AddressedPainPoint[];
  addressesGaps?: AddressedGap[];
  impactScore: number;
  effortScore: number;
  urgencyScore: number;
  opportunityScore: number;
  priorityTier: number;
  quickWin: boolean;
  displayCategory: 'quick_wins' | 'high_impact' | 'strategic';
  painReductionPercent?: number;
  usersAffectedPercent?: number;
  businessMetrics?: BusinessMetrics;
  designDays?: number;
  engineeringDays?: number;
  testingDays?: number;
  totalEffortDays?: number;
  riskLevel: 'low' | 'medium' | 'high';
  implementationApproach?: string;
  successMetrics?: string[];
  competitiveContext?: string;
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'dismissed';
  epicId?: number;
  isUserEdited: boolean;
  isCustom: boolean;
  isDismissed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SolutionApproach {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
}

export interface AddressedPainPoint {
  painPointId: number;
  description: string;
  severity: number;
  stageName: string;
}

export interface AddressedGap {
  gapId: number;
  title: string;
  opportunityScore: number;
}

export interface BusinessMetrics {
  timeSavings?: string;
  conversionLift?: string;
  npsImpact?: string;
  retentionImpact?: string;
}

// --- Session Detail Response ---

export interface RecommenderSessionDetail {
  session: RecommenderSession;
  recommendations: {
    quickWins: Recommendation[];
    highImpact: Recommendation[];
    strategic: Recommendation[];
  };
  totals: {
    quickWins: number;
    highImpact: number;
    strategic: number;
    total: number;
  };
}

// --- Status Response ---

export interface SessionStatusResponse {
  id: number;
  status: string;
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
}

// --- Requests ---

export interface CreateSessionRequest {
  sessionName?: string;
  journeyMapIds: number[];
  gapAnalysisIds?: number[];
  ideaBacklogIds?: number[];
  timeline?: string;
  budget?: string;
  teamCapacity?: string;
  recommendationType?: string;
  userId?: number;
}

export interface UpdateRecommendationRequest {
  title?: string;
  description?: string;
  impactScore?: number;
  effortScore?: number;
  urgencyScore?: number;
  implementationApproach?: string;
  successMetrics?: string[];
  status?: string;
}

export interface AddCustomRecommendationRequest {
  title: string;
  description: string;
  impactScore?: number;
  effortScore?: number;
  urgencyScore?: number;
  implementationApproach?: string;
  successMetrics?: string[];
}
