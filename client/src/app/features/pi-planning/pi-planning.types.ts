// PI Planning Types

export interface PiSession {
  id: number;
  integrationId: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  sprintCount: number;
  status: 'draft' | 'active' | 'locked' | 'completed';
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  boards?: PiSessionBoard[];
}

export interface PiSessionBoard {
  id: number;
  sessionId: number;
  boardId: number;
  boardName: string;
  velocityOverride: number | null;
  capacityAdjustment: number;
  velocity?: number;
}

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
}

export interface PiPlanningView {
  session: PiSession;
  boards: BoardView[];
}

export interface CreateSessionRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sprintCount?: number;
  boardIds: number[];
}
