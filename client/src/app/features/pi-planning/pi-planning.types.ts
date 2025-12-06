// PI Planning Types

export type PiSessionStatus = 'draft' | 'planning' | 'active' | 'locked' | 'completed';
export type PlannableIssueType = 'epic' | 'feature' | 'story' | 'custom';

export interface PiSession {
  id: number;
  integrationId: number;
  name: string;
  description: string | null;
  projectKeys: string[]; // Array of Jira project keys (supports multiple projects)
  startDate: string | null;
  endDate: string | null;
  sprintCount: number;
  sprintLengthWeeks: number;
  plannableIssueType: PlannableIssueType;
  customIssueTypeName: string | null;
  holidayConfigId: number | null;
  includeIpSprint: boolean;
  currentVersion: string;
  status: PiSessionStatus;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  boards?: PiSessionBoard[];
  sprints?: PiSprint[];
  features?: PiFeature[];
}

export interface PiSessionBoard {
  id: number;
  boardId: number;
  jiraBoardId: number;
  name: string;
  boardType: 'scrum' | 'kanban';
  defaultVelocity: number | null;
}

export interface PiSprint {
  id: number;
  sprintNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  totalDays: number;
  holidays: Array<{ date: string; name: string }>;
  isIpSprint: boolean;
}

export interface PiDependency {
  issueKey: string;
  type: 'blocked_by' | 'blocks' | 'relates_to';
  summary?: string;
  parsedFrom: 'jira_link' | 'description';
}

export interface PiFeature {
  id: number;
  jiraIssueId?: string;
  jiraIssueKey?: string;
  title: string;
  description?: string;
  issueType?: string;
  priority?: string;
  priorityOrder?: number;
  totalPoints?: number;
  estimatedSprints: number;
  dependencies: PiDependency[];
  labels: string[];
  projectKey?: string;
  status?: string;
  assignment?: PiFeatureAssignment;
}

export interface PiFeatureAssignment {
  boardId: number;
  boardName: string;
  startSprintNum: number;
  endSprintNum: number;
  allocatedPoints?: number;
  aiRationale?: string;
  isManualOverride: boolean;
}

export interface PiPlanVersion {
  id: number;
  versionNumber: string;
  comment?: string;
  createdBy?: number;
  createdAt: string;
}

export interface HolidayConfig {
  id: number;
  name: string;
  calendarType: 'us' | 'india' | 'both' | 'custom';
  countryCodes: string[];
  isDefault: boolean;
}

export interface SprintCapacity {
  sprintNum: number;
  allocatedPoints: number;
  capacityPoints: number;
  remainingCapacity: number;
  isOverCapacity: boolean;
}

export interface TeamView {
  id: number;
  name: string;
  jiraBoardId: number;
  velocity: number;
  sprintCapacities: SprintCapacity[];
}

export interface BoardViewSprint {
  id: number;
  number: number;
  name: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  isIpSprint: boolean;
  holidays: Array<{ date: string; name: string }>;
}

export interface BoardViewFeature {
  id: number;
  jiraKey?: string;
  title: string;
  priority?: string;
  totalPoints?: number;
  estimatedSprints: number;
  dependencies: PiDependency[];
  assignment: {
    boardId: number;
    boardName: string;
    startSprintNum: number;
    endSprintNum: number;
    allocatedPoints?: number;
    aiRationale?: string;
    isManualOverride: boolean;
    spansSprints: boolean;
  } | null;
}

export interface UnassignedFeature {
  id: number;
  jiraKey?: string;
  title: string;
  priority?: string;
  totalPoints?: number;
  estimatedSprints: number;
  dependencies: PiDependency[];
}

export interface KanbanBoardView {
  session: {
    id: number;
    name: string;
    status: PiSessionStatus;
    currentVersion: string;
  };
  sprints: BoardViewSprint[];
  teams: TeamView[];
  features: BoardViewFeature[];
  unassignedFeatures: UnassignedFeature[];
}

// Legacy types for backwards compatibility
export interface PiPlannedItem {
  id: number;
  sessionId: number;
  jiraIssueId: string | null;
  jiraIssueKey: string | null;
  title: string;
  assignedBoardId: number | null;
  targetSprintId: number | null;
  sequenceOrder: number | null;
  estimatedPoints: number | null;
  confidence: number | null;
  dependencies: string[];
  notes: string | null;
  aiSuggested: boolean;
}

export interface SprintView {
  jiraId: number;
  name: string;
  state: string;
  capacity: number;
  plannedPoints: number;
  items: PiPlannedItem[];
}

export interface BoardView extends PiSessionBoard {
  sprints: SprintView[];
  backlog: PiPlannedItem[];
  // Legacy properties for backward compatibility
  boardName?: string;
  velocity?: number;
}

export interface PiPlanningView {
  session: PiSession;
  boards: BoardView[];
}

export interface CreateSessionRequest {
  name: string;
  projectKeys: string[]; // Array of Jira project keys (supports multiple projects)
  projectKey?: string; // Deprecated: single project key (for backwards compatibility)
  startDate: string;
  numberOfSprints: number;
  sprintLengthWeeks?: number;
  plannableIssueType?: PlannableIssueType;
  customIssueTypeName?: string;
  holidayConfigId?: number;
  includeIpSprint?: boolean;
}

export interface AddBoardRequest {
  jiraBoardId: number;
  boardName: string;
  defaultVelocity?: number;
}

export interface AssignFeatureRequest {
  featureId: number;
  boardId: number;
  startSprintNum: number;
  endSprintNum?: number;
  allocatedPoints?: number;
  aiRationale?: string;
  manualOverride?: boolean;
  overrideReason?: string;
}

export interface CreateVersionRequest {
  versionNumber: string;
  comment?: string;
}

// AI Planning Types
export interface PlannedAssignment {
  featureId: number;
  featureTitle: string;
  featureKey?: string;
  boardId: number;
  boardName: string;
  startSprintNum: number;
  endSprintNum: number;
  allocatedPoints: number;
  rationale: string;
}

export interface AiPlanningResult {
  assignments: PlannedAssignment[];
  unassignedFeatures: Array<{
    id: number;
    title: string;
    reason: string;
  }>;
  warnings: string[];
  summary: {
    totalFeatures: number;
    assignedFeatures: number;
    totalPoints: number;
    assignedPoints: number;
  };
  applied?: boolean;
}
