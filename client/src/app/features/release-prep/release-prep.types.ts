/**
 * Release Prep Agent Types
 *
 * TypeScript types for the Release Prep feature that generates
 * Release Notes, Decision Log, and Technical Debt Inventory.
 */

// --- Available Stories (from Story Generator, Epic Creator, Feature Creator) ---

export interface AvailableStory {
  id: number;
  title: string;
  type: 'epic' | 'feature' | 'user_story';
  status: string;
  createdAt: string;
  preview: string;
  storyCount: number;   // Number of user stories contained
  featureCount: number; // Number of features (for epics)
}

// --- Session ---

export interface ReleasePrepSession {
  id: number;
  userId?: number;
  releaseName: string;
  storyArtifactIds: number[];
  manualStories: ManualStory[];
  knowledgeBaseIds: number[];
  status: ReleasePrepStatus;
  progressStep: number;
  progressTotal: number;
  progressMessage?: string;
  errorMessage?: string;
  releaseNotesCompleteness?: number;
  releaseNotesClarity?: number;
  decisionLogCompleteness?: number;
  debtInventoryCompleteness?: number;
  totalStoriesProcessed: number;
  totalReleaseNotes: number;
  totalDecisions: number;
  totalDebtItems: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type ReleasePrepStatus =
  | 'draft'
  | 'processing'
  | 'extracting'
  | 'generating_notes'
  | 'generating_decisions'
  | 'generating_debt'
  | 'validating'
  | 'completed'
  | 'failed';

export interface ManualStory {
  title: string;
  content: string;
  storyType: 'epic' | 'feature' | 'user_story';
}

// --- Release Story ---

export interface ReleaseStory {
  id: number;
  sessionId: number;
  artifactId?: number;
  title: string;
  storyType: string;
  content: string;
  isManual: boolean;
  acceptanceCriteria: AcceptanceCriterion[];
  processed: boolean;
  extractionNotes?: string;
  createdAt: string;
}

export interface AcceptanceCriterion {
  scenario: string;
  given: string;
  when: string;
  then: string;
}

// --- Release Note ---

export interface ReleaseNote {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  category: ReleaseNoteCategory;
  userImpact?: string;
  audience: string;
  sourceStoryIds: number[];
  displayOrder: number;
  isHighlighted: boolean;
  isUserEdited: boolean;
  isExcluded: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReleaseNoteCategory =
  | 'feature'
  | 'improvement'
  | 'fix'
  | 'security'
  | 'performance'
  | 'breaking_change';

// --- Decision ---

export interface Decision {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  decisionType: DecisionType;
  context?: string;
  rationale?: string;
  alternativesConsidered: string[];
  impactLevel: ImpactLevel;
  impactAreas: string[];
  consequences?: string;
  reversibility: 'reversible' | 'partially' | 'irreversible';
  sourceStoryIds: number[];
  relatedDecisionIds: number[];
  status: 'documented' | 'needs_review' | 'approved';
  reviewerNotes?: string;
  isUserEdited: boolean;
  isExcluded: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DecisionType =
  | 'technical'
  | 'architectural'
  | 'product'
  | 'process'
  | 'security';

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

// --- Technical Debt Item ---

export interface TechnicalDebtItem {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  debtType: DebtType;
  affectedArea?: string;
  affectedFiles: string[];
  impactLevel: ImpactLevel;
  riskIfUnaddressed?: string;
  effortEstimate?: string;
  effortDays?: number;
  status: DebtStatus;
  introducedInRelease?: string;
  resolvedInRelease?: string;
  targetResolution?: string;
  sourceStoryIds: number[];
  relatedDebtIds: number[];
  isUserEdited: boolean;
  isUserAdded: boolean;
  isExcluded: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DebtType =
  | 'code'
  | 'design'
  | 'architecture'
  | 'testing'
  | 'documentation'
  | 'infrastructure';

export type DebtStatus =
  | 'identified'
  | 'acknowledged'
  | 'planned'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix';

// --- Session Detail Response ---

export interface ReleasePrepSessionDetail {
  session: ReleasePrepSession;
  stories: ReleaseStory[];
  releaseNotes: ReleaseNote[];
  decisions: Decision[];
  debtItems: TechnicalDebtItem[];
}

// --- Status Response ---

export interface PipelineStatusResponse {
  status: string;
  progressStep: number;
  progressTotal: number;
  progressMessage?: string;
  errorMessage?: string;
}

// --- Requests ---

export interface CreateSessionRequest {
  releaseName?: string;
  storyArtifactIds?: number[];
  manualStories?: ManualStory[];
  knowledgeBaseIds?: number[];
}

export interface UpdateReleaseNoteRequest {
  title?: string;
  description?: string;
  category?: ReleaseNoteCategory;
  userImpact?: string;
  audience?: string;
  isHighlighted?: boolean;
  isExcluded?: boolean;
}

export interface UpdateDecisionRequest {
  title?: string;
  description?: string;
  decisionType?: DecisionType;
  context?: string;
  rationale?: string;
  alternativesConsidered?: string[];
  impactLevel?: ImpactLevel;
  impactAreas?: string[];
  consequences?: string;
  status?: string;
  isExcluded?: boolean;
}

export interface UpdateDebtItemRequest {
  title?: string;
  description?: string;
  debtType?: DebtType;
  affectedArea?: string;
  impactLevel?: ImpactLevel;
  riskIfUnaddressed?: string;
  effortEstimate?: string;
  effortDays?: number;
  status?: DebtStatus;
  targetResolution?: string;
  isExcluded?: boolean;
}

export interface CreateDebtItemRequest {
  title: string;
  description: string;
  debtType?: DebtType;
  affectedArea?: string;
  impactLevel?: ImpactLevel;
  riskIfUnaddressed?: string;
  effortEstimate?: string;
  effortDays?: number;
  targetResolution?: string;
}

// --- Export Response ---

export interface ExportResponse {
  format: 'markdown' | 'html';
  content: string;
}
