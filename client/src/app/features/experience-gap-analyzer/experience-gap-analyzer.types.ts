/**
 * Experience Gap Analyzer Types
 *
 * TypeScript interfaces for the Experience Gap Analyzer feature in Customer Experience section.
 * Compares customer journeys to identify gaps and generate prioritized improvement roadmaps.
 */

export type AnalysisType = 'competitive' | 'best_practice' | 'temporal';
export type GapAnalysisStatus = 'pending' | 'analyzing' | 'generating_roadmap' | 'completed' | 'failed';
export type GapCategory = 'capability' | 'experience' | 'quality' | 'process';
export type PriorityTier = 1 | 2 | 3;

// --- Gap Item ---

export interface RoiProjection {
  estimatedValue: string;
  timeToValue: string;
  confidenceLevel: string;
}

export interface GapItem {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  category: GapCategory;
  stageId?: string;
  stageName?: string;
  impactScore: number;
  urgencyScore: number;
  effortScore: number;
  opportunityScore: number;
  priorityTier: PriorityTier;
  evidence?: string;
  comparisonNotes?: string;
  roiProjection?: RoiProjection;
  isUserEdited: boolean;
  userPriorityOverride?: number;
  createdAt: string;
  updatedAt: string;
}

// --- Capability Matrix ---

export interface CapabilityMatrixItem {
  id: number;
  sessionId: number;
  capabilityName: string;
  category: string;
  yourScore: number;
  comparisonScore: number;
  gapScore: number;
  yourEvidence?: string;
  comparisonEvidence?: string;
  improvementSuggestion?: string;
  displayOrder: number;
  createdAt: string;
}

// --- Stage Alignment ---

export type AlignmentType = 'aligned' | 'missing_in_comparison' | 'missing_in_yours' | 'different' | 'no_comparison';

export interface StageAlignment {
  id: number;
  sessionId: number;
  yourStageId: string;
  yourStageName: string;
  comparisonStageId?: string;
  comparisonStageName?: string;
  alignmentType: AlignmentType;
  gapsCount: number;
  criticalGapsCount: number;
  advantagesCount: number;
  displayOrder: number;
  createdAt: string;
}

// --- Competitive Advantage ---

export interface CompetitiveAdvantage {
  stageId: string;
  title: string;
  description: string;
  evidence?: string;
}

// --- Overall Assessment ---

export interface OverallAssessment {
  summary: string;
  totalGapsIdentified: number;
  criticalGapsCount: number;
  competitiveAdvantagesCount: number;
  overallHealthScore: number;
  recommendedFocusAreas: string[];
}

// --- Capability Matrix Summary ---

export interface CapabilityMatrixSummary {
  categories: string[];
  totalCapabilities: number;
}

// --- Roadmap ---

export interface RoadmapItem {
  gapId: number;
  title: string;
  opportunityScore: number;
  rationale?: string;
  userOverride?: boolean;
}

export interface Roadmap {
  tier1: RoadmapItem[];
  tier2: RoadmapItem[];
  tier3: RoadmapItem[];
}

// --- Analysis Parameters ---

export interface AnalysisParameters {
  impactWeight: number;
  urgencyWeight: number;
  effortWeight: number;
}

// --- Session ---

export interface GapAnalysisSession {
  id: number;
  userId?: number;
  analysisType: AnalysisType;
  analysisName?: string;
  yourJourneyId?: number;
  comparisonJourneyId?: number;
  knowledgeBaseIds?: number[];
  analysisParameters?: AnalysisParameters;
  status: GapAnalysisStatus;
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
  overallAssessment?: OverallAssessment;
  competitiveAdvantages?: CompetitiveAdvantage[];
  capabilityMatrixSummary?: CapabilityMatrixSummary;
  roadmap?: Roadmap;
  reportPdfUrl?: string;
  rawLlmResponse?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// --- Session Detail (full response) ---

export interface JourneyMapReference {
  id: number;
  journeyDescription: string;
  mode: string;
  stageCount: number;
  createdAt: string;
  competitorName?: string;
}

export interface GapAnalysisSessionDetail {
  session: GapAnalysisSession;
  gaps: GapItem[];
  capabilityMatrix: CapabilityMatrixItem[];
  stageAlignments: StageAlignment[];
  yourJourney?: JourneyMapReference;
  comparisonJourney?: JourneyMapReference;
}

// --- Status Response ---

export interface SessionStatusResponse {
  id: number;
  status: GapAnalysisStatus;
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
}

// --- Context Sources ---

export interface AvailableJourneyMap {
  id: number;
  description: string;
  mode: string;
  stageCount: number;
  createdAt: string;
  competitorName?: string;
}

export interface ContextSources {
  journeyMaps: AvailableJourneyMap[];
}

// --- Request Types ---

export interface CreateGapAnalysisRequest {
  analysisType: AnalysisType;
  analysisName?: string;
  yourJourneyId: number;
  comparisonJourneyId?: number;
  userId?: number;
  knowledgeBaseIds?: number[];
  analysisParameters?: AnalysisParameters;
}

export interface UpdateGapRequest {
  title?: string;
  description?: string;
  impactScore?: number;
  urgencyScore?: number;
  effortScore?: number;
  userPriorityOverride?: number;
}

export interface AddGapRequest {
  title: string;
  description: string;
  category?: GapCategory;
  impactScore?: number;
  urgencyScore?: number;
  effortScore?: number;
  stageId?: string;
  stageName?: string;
}

export interface ReorderRoadmapRequest {
  gapId: number;
  newTier: PriorityTier;
}

// --- Analysis Type Configuration ---

export interface AnalysisTypeConfig {
  type: AnalysisType;
  title: string;
  description: string;
  icon: string;
  requiresComparison: boolean;
}

export const ANALYSIS_TYPE_CONFIGS: AnalysisTypeConfig[] = [
  {
    type: 'competitive',
    title: 'Competitive Gap Analysis',
    description: 'Compare your journey against a competitor to identify where they excel',
    icon: 'lucideSwords',
    requiresComparison: true,
  },
  {
    type: 'best_practice',
    title: 'Best Practice Analysis',
    description: 'Compare your journey against industry best practices or benchmarks',
    icon: 'lucideTarget',
    requiresComparison: false,
  },
  {
    type: 'temporal',
    title: 'Temporal Analysis',
    description: 'Compare current journey against a previous version to track changes',
    icon: 'lucideClock',
    requiresComparison: true,
  },
];

// --- Priority Tier Configuration ---

export interface TierConfig {
  tier: PriorityTier;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  minScore?: number;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 1,
    label: 'Critical',
    description: 'Address immediately - high impact, high urgency',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    minScore: 15,
  },
  {
    tier: 2,
    label: 'Important',
    description: 'Schedule for next quarter - moderate priority',
    color: '#F97316',
    bgColor: '#FFEDD5',
    minScore: 8,
  },
  {
    tier: 3,
    label: 'Nice-to-have',
    description: 'Consider when resources allow',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
];

// --- Progress Steps ---

export const PROGRESS_STEPS: Record<number, string> = {
  0: 'Initializing analysis...',
  1: 'Loading journey maps...',
  2: 'Aligning journey stages...',
  3: 'Identifying experience gaps...',
  4: 'Building capability matrix...',
  5: 'Creating prioritized roadmap...',
};

// --- Utility Functions ---

export function getOpportunityScore(impact: number, urgency: number, effort: number): number {
  if (effort <= 0) effort = 1;
  return Math.round(((impact * urgency) / effort) * 100) / 100;
}

export function getPriorityTier(opportunityScore: number): PriorityTier {
  if (opportunityScore > 15) return 1;
  if (opportunityScore >= 8) return 2;
  return 3;
}

export function getTierConfig(tier: PriorityTier): TierConfig {
  return TIER_CONFIGS.find(t => t.tier === tier) || TIER_CONFIGS[2];
}

export function getCategoryColor(category: GapCategory): string {
  switch (category) {
    case 'capability': return '#8B5CF6';  // Purple
    case 'experience': return '#3B82F6';  // Blue
    case 'quality': return '#22C55E';     // Green
    case 'process': return '#F97316';     // Orange
    default: return '#6B7280';            // Gray
  }
}

export function getScoreColor(score: number): string {
  if (score >= 8) return '#EF4444';  // Red - high (gap is significant)
  if (score >= 6) return '#F97316';  // Orange
  if (score >= 4) return '#EAB308';  // Yellow
  return '#22C55E';                   // Green - low (gap is minor)
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return '#22C55E';  // Green - healthy
  if (score >= 60) return '#84CC16';  // Lime
  if (score >= 40) return '#EAB308';  // Yellow - moderate issues
  if (score >= 20) return '#F97316';  // Orange - significant issues
  return '#EF4444';                    // Red - critical issues
}
