/**
 * Roadmap Planner Types
 *
 * TypeScript interfaces for the Roadmap Planner feature.
 */

export interface RoadmapSession {
  id: number;
  userId?: number;
  projectId?: number;
  name: string;
  description?: string;
  // Multi-source inputs
  artifactIds: number[];  // IDs of epics/features from Story Generator
  feasibilityIds: number[];  // IDs from Feasibility Analysis
  ideationIds: number[];  // IDs from Ideation ideas
  customItems: CustomRoadmapItem[];  // Custom entries
  // Capacity config
  sprintLengthWeeks: number;
  teamVelocity: number;  // Points per sprint per team
  teamCount: number;  // Number of teams
  bufferPercentage: number;
  startDate?: string;
  status: RoadmapStatus;
  progressStep: number;
  progressTotal: number;
  progressMessage?: string;
  errorMessage?: string;
  totalItems: number;
  totalSprints: number;
  totalThemes: number;
  totalMilestones: number;
  totalDependencies: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CustomRoadmapItem {
  title: string;
  description?: string;
  effortEstimate?: number;
}

export type RoadmapStatus =
  | 'draft'
  | 'processing'
  | 'sequencing'
  | 'analyzing_dependencies'
  | 'clustering_themes'
  | 'matching_capacity'
  | 'generating_milestones'
  | 'completed'
  | 'failed';

export type SourceType = 'artifact' | 'feasibility' | 'ideation' | 'custom';

export interface RoadmapItem {
  id: number;
  sessionId: number;
  sourceArtifactId?: number;
  sourceType: SourceType;
  title: string;
  description?: string;
  itemType: 'epic' | 'feature' | 'story' | 'task';
  priority: number;
  effortPoints: number;
  riskLevel: 'low' | 'medium' | 'high';
  valueScore?: number;
  sequenceOrder: number;
  assignedSprint?: number;
  sprintSpan: number;  // Number of sprints this item spans (1 = single sprint)
  assignedTeam?: number;
  sprintPosition: number;
  themeId?: number;
  status: 'planned' | 'in_progress' | 'completed' | 'deferred';
  jiraIssueKey?: string;
  jiraSyncedAt?: string;
  isManuallyPositioned: boolean;
  isExcluded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapDependency {
  id: number;
  sessionId: number;
  fromItemId: number;
  toItemId: number | null;  // null = external prerequisite
  dependencyType: string;  // blocks, depends_on, related_to, enables, or requires_* for external
  confidence: number;
  rationale?: string;
  isManual: boolean;
  isValidated: boolean;
  jiraLinkId?: string;
  jiraSyncedAt?: string;
  createdAt: string;
}

export interface RoadmapTheme {
  id: number;
  sessionId: number;
  name: string;
  description?: string;
  color: string;
  businessObjective?: string;
  successMetrics: string[];
  totalEffortPoints: number;
  totalItems: number;
  jiraEpicKey?: string;
  jiraSyncedAt?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapMilestone {
  id: number;
  sessionId: number;
  name: string;
  description?: string;
  targetSprint?: number;
  targetDate?: string;
  themeId?: number;
  status: 'planned' | 'on_track' | 'at_risk' | 'completed' | 'missed';
  criteria: string[];
  completionPercentage: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export type SegmentStatus = 'planned' | 'in_progress' | 'completed';

export interface RoadmapItemSegment {
  id: number;
  itemId: number;
  assignedTeam: number;
  startSprint: number;
  sprintCount: number;
  effortPoints: number;
  sequenceOrder: number;
  rowIndex: number;
  status: SegmentStatus;
  isManuallyPositioned: boolean;
  label?: string;
  colorOverride?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapSessionResponse {
  session: RoadmapSession;
  items: RoadmapItem[];
  segments: RoadmapItemSegment[];
  dependencies: RoadmapDependency[];
  themes: RoadmapTheme[];
  milestones: RoadmapMilestone[];
}

export interface SprintSummary {
  sprintNumber: number;
  totalPoints: number;
  capacity: number;
  utilizationPercentage: number;
  itemCount: number;
  items: RoadmapItem[];
  startDate?: string;
  endDate?: string;
}

export interface DependencyGraphNode {
  id: number;
  title: string;
  sprint?: number;
  themeId?: number;
  themeColor?: string;
}

export interface DependencyGraphEdge {
  fromId: number;
  toId: number;
  dependencyType: string;
  isBlocking: boolean;
}

export interface DependencyGraph {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  hasCycles: boolean;
  cycleItems: number[];
}

export interface AvailableArtifactForRoadmap {
  id: number;
  title: string;
  type: 'epic' | 'feature';
  status: string;
  createdAt: string;
  preview: string;
  effortEstimate?: number;
  priority?: number;
  childCount: number;  // Number of child stories/features
}

export interface AvailableFeasibilityForRoadmap {
  id: number;
  featureDescription: string;
  title: string;  // First 100 chars of feature description
  goNoGo?: 'go' | 'no_go' | 'conditional';
  confidence: 'low' | 'medium' | 'high';
  status: string;
  createdAt: string;
  totalHours?: number;  // Aggregated effort estimate
  totalWeeks?: number;  // From realistic timeline
}

export interface AvailableIdeaForRoadmap {
  id: number;
  title: string;
  description: string;
  category: 'quick_wins' | 'strategic_bets' | 'incremental' | 'moonshots';
  effortEstimate: 'low' | 'medium' | 'high';
  impactEstimate: 'low' | 'medium' | 'high';
  compositeScore?: number;
  sessionId: number;
  createdAt: string;
}

export interface AllAvailableSourcesResponse {
  artifacts: AvailableArtifactForRoadmap[];
  feasibilityAnalyses: AvailableFeasibilityForRoadmap[];
  ideationIdeas: AvailableIdeaForRoadmap[];
}

// Request types
export interface RoadmapSessionCreate {
  name?: string;
  description?: string;
  // Multi-source inputs
  artifactIds?: number[];  // IDs of epics/features from Story Generator
  feasibilityIds?: number[];  // IDs from Feasibility Analysis
  ideationIds?: number[];  // IDs of ideation ideas
  customItems?: CustomRoadmapItem[];  // Custom entries
  // Capacity config
  sprintLengthWeeks?: number;
  teamVelocity?: number;  // Points per sprint per team
  teamCount?: number;  // Number of teams (default 1)
  bufferPercentage?: number;
  startDate?: string;
}

export interface RoadmapItemUpdate {
  title?: string;
  description?: string;
  priority?: number;
  effortPoints?: number;
  riskLevel?: string;
  assignedSprint?: number;
  sprintSpan?: number;
  assignedTeam?: number;
  sprintPosition?: number;
  themeId?: number;
  status?: string;
  isExcluded?: boolean;
}

export interface RoadmapDependencyCreate {
  fromItemId: number;
  toItemId: number;
  dependencyType?: string;
  rationale?: string;
}

export interface RoadmapMilestoneCreate {
  name: string;
  description?: string;
  targetSprint?: number;
  targetDate?: string;
  themeId?: number;
  criteria?: string[];
  color?: string;
}

export interface RoadmapMilestoneUpdate {
  name?: string;
  description?: string;
  targetSprint?: number;
  targetDate?: string;
  themeId?: number;
  status?: string;
  criteria?: string[];
  color?: string;
}

export interface PipelineStatus {
  status: RoadmapStatus;
  progressStep: number;
  progressTotal: number;
  progressMessage?: string;
  errorMessage?: string;
}

// Segment request types
export interface RoadmapSegmentCreate {
  itemId: number;
  assignedTeam?: number;
  startSprint?: number;
  sprintCount?: number;
  effortPoints?: number;
  rowIndex?: number;
  label?: string;
  colorOverride?: string;
}

export interface RoadmapSegmentUpdate {
  assignedTeam?: number;
  startSprint?: number;
  sprintCount?: number;
  effortPoints?: number;
  rowIndex?: number;
  sequenceOrder?: number;
  status?: SegmentStatus;
  isManuallyPositioned?: boolean;
  label?: string;
  colorOverride?: string;
}

export interface RoadmapSegmentBulkUpdate {
  segments: Array<{ id: number } & Partial<RoadmapSegmentUpdate>>;
}

// UI helper types for Gantt display
export interface GanttSegment extends RoadmapItemSegment {
  item: RoadmapItem;
  theme?: RoadmapTheme;
  endSprint: number;  // Computed: startSprint + sprintCount - 1
  displayColor: string;  // colorOverride || theme.color || default
}
