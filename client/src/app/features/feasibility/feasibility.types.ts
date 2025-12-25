/**
 * TypeScript types for Feasibility Analyzer feature
 */

export type SessionStatus =
  | 'pending'
  | 'decomposing'
  | 'estimating'
  | 'scheduling'
  | 'risk_analyzing'
  | 'completed'
  | 'failed';

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type GoNoGoRecommendation = 'go' | 'no_go' | 'conditional';
export type TechnicalCategory = 'backend' | 'frontend' | 'infrastructure' | 'data' | 'integration';
export type ScenarioType = 'optimistic' | 'realistic' | 'pessimistic';
export type RiskCategory = 'technical' | 'resource' | 'schedule' | 'dependency' | 'integration';
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface FeasibilitySession {
  id: number;
  userId: number | null;
  featureDescription: string;
  technicalConstraints: string | null;
  targetUsers: string | null;
  autoDetectedStack: string[] | null;
  status: SessionStatus;
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
  goNoGoRecommendation: GoNoGoRecommendation | null;
  executiveSummary: string | null;
  confidenceLevel: ConfidenceLevel;
  generationMetadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TechnicalComponent {
  id: number;
  sessionId: number;
  componentName: string;
  componentDescription: string;
  technicalCategory: TechnicalCategory;
  optimisticHours: number;
  realisticHours: number;
  pessimisticHours: number;
  confidenceLevel: ConfidenceLevel;
  estimatedByAgent: boolean;
  isEditable: boolean;
  dependencies: number[] | null;
  canParallelize: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineScenario {
  id: number;
  sessionId: number;
  scenarioType: ScenarioType;
  totalWeeks: number;
  sprintCount: number;
  parallelizationFactor: number;
  overheadPercentage: number;
  teamSizeAssumed: number;
  confidenceLevel: ConfidenceLevel;
  rationale: string;
  createdAt: string;
}

export interface RiskAssessment {
  id: number;
  sessionId: number;
  riskCategory: RiskCategory;
  riskDescription: string;
  probability: number; // 0.0-1.0
  impact: number; // 0.0-1.0
  riskScore: number; // probability * impact
  mitigationStrategy: string;
  displayOrder: number;
  createdAt: string;
}

export interface SkillRequirement {
  id: number;
  sessionId: number;
  skillName: string;
  proficiencyLevel: ProficiencyLevel;
  estimatedPersonWeeks: number;
  isGap: boolean;
  gapMitigation: string | null;
  displayOrder: number;
  createdAt: string;
}

export interface ActualResult {
  id: number;
  sessionId: number;
  componentId: number | null;
  actualHoursSpent: number;
  actualCompletionDate: string;
  variancePercentage: number;
  lessonsLearned: string | null;
  recordedByUserId: number | null;
  createdAt: string;
}

export interface SessionDetail {
  session: FeasibilitySession;
  components: TechnicalComponent[];
  scenarios: TimelineScenario[];
  risks: RiskAssessment[];
  skills: SkillRequirement[];
}

export interface CreateSessionRequest {
  featureDescription: string;
  technicalConstraints?: string;
  targetUsers?: string;
  userId?: number;
}

export interface UpdateComponentRequest {
  optimisticHours?: number;
  realisticHours?: number;
  pessimisticHours?: number;
}

export interface ActualResultInput {
  componentId: number;
  actualHoursSpent: number;
  lessonsLearned?: string;
}

export interface CaptureActualsRequest {
  actuals: ActualResultInput[];
  recordedByUserId?: number;
}

export interface SessionStatusResponse {
  id: number;
  status: SessionStatus;
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
}
