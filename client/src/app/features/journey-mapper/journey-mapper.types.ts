/**
 * Journey & Pain Point Mapper Types
 *
 * TypeScript interfaces for the Journey Mapper feature in Customer Experience section.
 */

export type JourneyMode = 'standard' | 'multi_persona' | 'competitive';
export type JourneyStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DeltaStatus = 'improved' | 'worsened' | 'new' | 'resolved' | 'unchanged';

export interface Touchpoint {
  id: string;
  name: string;
  description: string;
  channel: 'web' | 'email' | 'phone' | 'in-person' | string;
  isStrength?: boolean;
}

export interface PersonaExperience {
  emotionScore: number;
  durationEstimate: string;
  specificNotes: string;
}

export interface JourneyStage {
  id: string;
  name: string;
  description: string;
  order: number;
  durationEstimate?: string;
  touchpoints: Touchpoint[];
  emotionScore: number;
  personaExperiences?: Record<string, PersonaExperience>;
}

export interface EmotionCurvePoint {
  stageId: string;
  score: number;
  label: string;
}

export interface EvidenceSource {
  sourceType: 'transcript' | 'ticket' | 'analytics' | 'observation' | string;
  sourceId?: string;
  excerpt: string;
  location?: string;
}

export interface JourneyPainPoint {
  id: number;
  journeyMapId: number;
  stageId: string;
  description: string;
  severity: number;
  frequency: number;
  dataSources?: EvidenceSource[];
  personaId?: number;
  deltaStatus?: DeltaStatus;
  previousSeverity?: number;
  isUserEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyPersona {
  id: number;
  journeyMapId: number;
  name: string;
  description?: string;
  attributes?: Record<string, unknown>;
  color?: string;
  sourcePersonaId?: number;
  createdAt: string;
}

export interface PersonaDifference {
  personaName: string;
  personaId?: number;
  experience: string;
  painSeverity: number;
}

export interface Dependency {
  blockingPersona: string;
  blockedPersona: string;
  description: string;
}

export interface JourneyDivergencePoint {
  id: number;
  journeyMapId: number;
  stageId: string;
  description: string;
  divergenceScore: number;
  personaDifferences?: PersonaDifference[];
  dependencyDescription?: string;
  blockingPersonaId?: number;
  blockedPersonaId?: number;
  createdAt: string;
}

export interface CompetitorObservation {
  id: number;
  journeyMapId: number;
  stageOrder: number;
  stageName: string;
  touchpointsObserved?: string[];
  timeTaken?: string;
  frictionPoints?: string[];
  strengthsObserved?: string[];
  notes?: string;
  screenshotUrl?: string;
  comparisonStatus?: 'better' | 'worse' | 'similar';
  comparisonNotes?: string;
  createdAt: string;
}

export interface DeltaSummary {
  improved: number;
  worsened: number;
  new: number;
  resolved: number;
  totalBefore: number;
  totalAfter: number;
}

export interface VersionInfo {
  id: number;
  version: string;
  createdAt: string;
}

export interface FileMetadata {
  filename: string;
  contentType: string;
  size: number;
  contentPreview?: string;
}

export interface JourneyMapSession {
  id: number;
  userId?: number;
  mode: JourneyMode;
  journeyDescription: string;
  competitorName?: string;
  version: string;
  parentVersionId?: number;
  fileMetadata?: FileMetadata[];
  knowledgeBaseIds?: number[];
  status: JourneyStatus;
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
  stages?: JourneyStage[];
  emotionCurve?: EmotionCurvePoint[] | Record<string, EmotionCurvePoint[]>;
  confidenceScore?: number;
  dataQualityWarning?: string;
  rawLlmResponse?: string;
  deltaSummary?: DeltaSummary;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JourneySessionDetail {
  session: JourneyMapSession;
  painPoints: JourneyPainPoint[];
  personas: JourneyPersona[];
  divergencePoints: JourneyDivergencePoint[];
  competitorObservations: CompetitorObservation[];
  versions: VersionInfo[];
}

export interface SessionStatusResponse {
  id: number;
  status: JourneyStatus;
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
  dataQualityWarning?: string;
}

// Context sources
export interface ContextSourceKnowledgeBase {
  id: number;
  name: string;
  documentCount: number;
}

export interface ContextSourceIdeationSession {
  id: number;
  problemStatement: string;
  createdAt: string;
}

export interface ContextSourceFeasibilitySession {
  id: number;
  featureName: string;
  createdAt: string;
}

export interface ContextSourceBusinessCaseSession {
  id: number;
  featureName: string;
  createdAt: string;
}

export interface AvailableContextSources {
  knowledgeBases: ContextSourceKnowledgeBase[];
  ideationSessions: ContextSourceIdeationSession[];
  feasibilitySessions: ContextSourceFeasibilitySession[];
  businessCaseSessions: ContextSourceBusinessCaseSession[];
}

// Request types
export interface PersonaInput {
  name: string;
  description?: string;
  attributes?: Record<string, unknown>;
}

export interface CreateJourneyRequest {
  mode: JourneyMode;
  journeyDescription: string;
  competitorName?: string;
  userId?: number;
  knowledgeBaseIds?: number[];
  ideationSessionId?: number;
  feasibilitySessionId?: number;
  businessCaseSessionId?: number;
  personas?: PersonaInput[];
  files?: File[];
}

export interface UpdatePainPointRequest {
  description?: string;
  severity?: number;
  stageId?: string;
}

export interface AddPainPointRequest {
  stageId: string;
  description: string;
  severity?: number;
  personaId?: number;
}

export interface UpdateStageRequest {
  name?: string;
  description?: string;
  durationEstimate?: string;
}

export interface AddStageRequest {
  name: string;
  description?: string;
  insertAfterStageId?: string;
}

export interface AddObservationRequest {
  stageOrder: number;
  stageName: string;
  touchpointsObserved?: string[];
  timeTaken?: string;
  frictionPoints?: string[];
  strengthsObserved?: string[];
  notes?: string;
  screenshotUrl?: string;
}

export interface CreateVersionRequest {
  updateType: 'refresh' | 'expand' | 'correct';
  knowledgeBaseIds?: number[];
  files?: File[];
}

// Mode card configuration for landing page
export interface ModeCard {
  mode: JourneyMode;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

export const MODE_CARDS: ModeCard[] = [
  {
    mode: 'standard',
    title: 'Standard Journey',
    description: 'Map a single customer journey from research data',
    icon: 'lucideRoute',
    features: [
      'AI-generated journey stages',
      'Pain point identification with severity scores',
      'Evidence linking to source data',
      'Emotion curve visualization',
    ],
  },
  {
    mode: 'multi_persona',
    title: 'Multi-Persona Journey',
    description: 'Compare how 2-5 personas experience the same journey',
    icon: 'lucideUsers',
    features: [
      'Side-by-side persona comparison',
      'Divergence point detection',
      'Dependency analysis',
      'Persona-specific pain points',
    ],
  },
  {
    mode: 'competitive',
    title: 'Competitive Journey',
    description: 'Map and analyze a competitor\'s customer experience',
    icon: 'lucideSwords',
    features: [
      'Guided walkthrough process',
      'Friction and strength capture',
      'Auto-comparison to your journey',
      'Gap analysis integration',
    ],
  },
];

// Progress step descriptions
export const PROGRESS_STEPS: Record<JourneyStatus, string> = {
  pending: 'Initializing journey mapper...',
  processing: 'Analyzing data and generating journey map...',
  completed: 'Journey map complete!',
  failed: 'An error occurred. Please retry.',
};

// Severity color scale (0-10)
export function getSeverityColor(severity: number): string {
  if (severity >= 8) return '#EF4444'; // Red
  if (severity >= 6) return '#F97316'; // Orange
  if (severity >= 4) return '#EAB308'; // Yellow
  if (severity >= 2) return '#22C55E'; // Green
  return '#3B82F6'; // Blue
}

// Emotion score color scale (0-10)
export function getEmotionColor(score: number): string {
  if (score >= 8) return '#22C55E'; // Green - very positive
  if (score >= 6) return '#84CC16'; // Lime - positive
  if (score >= 4) return '#EAB308'; // Yellow - neutral
  if (score >= 2) return '#F97316'; // Orange - negative
  return '#EF4444'; // Red - very negative
}

// Delta status colors and labels
export const DELTA_STATUS_CONFIG: Record<DeltaStatus, { color: string; bgColor: string; label: string }> = {
  improved: { color: '#22C55E', bgColor: '#DCFCE7', label: 'Improved' },
  worsened: { color: '#EF4444', bgColor: '#FEE2E2', label: 'Worsened' },
  new: { color: '#3B82F6', bgColor: '#DBEAFE', label: 'New' },
  resolved: { color: '#8B5CF6', bgColor: '#EDE9FE', label: 'Resolved' },
  unchanged: { color: '#6B7280', bgColor: '#F3F4F6', label: 'Unchanged' },
};
