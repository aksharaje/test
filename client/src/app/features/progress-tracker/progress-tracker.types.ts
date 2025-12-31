/**
 * Progress & Blocker Tracker Types
 */

export interface TrackerSession {
  id: number;
  name: string;
  integrationId: number;
  integrationName: string | null;
  integrationProvider: string | null;
  templateId: string;
  sprintFilter: Record<string, unknown>;
  blockerConfig: Record<string, unknown>;
  syncConfig: Record<string, unknown>;
  status: 'draft' | 'syncing' | 'ready' | 'error';
  progressStep: number;
  progressTotal: number;
  progressMessage: string | null;
  errorMessage: string | null;
  metricsSnapshot: MetricsData | Record<string, never>;
  lastSyncAt: string | null;
  itemsSynced: number;
  blockersDetected: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionRequest {
  name?: string;
  integrationId: number;
  templateId?: string;
  sprintFilter?: Record<string, unknown>;
  blockerConfig?: Record<string, unknown>;
}

export interface UpdateSessionRequest {
  name?: string;
  templateId?: string;
  sprintFilter?: Record<string, unknown>;
  blockerConfig?: Record<string, unknown>;
  syncConfig?: Record<string, unknown>;
}

export interface MetricsData {
  sessionId: number;
  sprintName: string | null;
  totalItems: number;
  itemsTodo: number;
  itemsInProgress: number;
  itemsDone: number;
  totalPoints: number | null;
  pointsTodo: number | null;
  pointsInProgress: number | null;
  pointsDone: number | null;
  completionPercentageItems: number;
  completionPercentagePoints: number | null;
  blockedItems: number;
  blockedPoints: number | null;
  byType: Record<string, Record<string, number>>;
  byAssignee: Record<string, Record<string, number>>;
  staleItems: number;
  lastSyncAt: string | null;
  dataFreshness: 'fresh' | 'recent' | 'stale' | 'unknown';
}

export interface BlockerSummary {
  itemId: number;
  externalId: string;
  externalUrl: string | null;
  title: string;
  itemType: string;
  status: string;
  assignee: string | null;
  storyPoints: number | null;
  blockerConfidence: number;
  blockerReason: string | null;
  blockerSignals: Record<string, number>;
  daysInStatus: number | null;
  sprintName: string | null;
}

export interface BlockersResponse {
  sessionId: number;
  totalBlockers: number;
  highConfidenceBlockers: number;
  mediumConfidenceBlockers: number;
  lowConfidenceBlockers: number;
  blockedPoints: number | null;
  blockers: BlockerSummary[];
}

export interface TrackedWorkItem {
  id: number;
  sessionId: number;
  externalId: string;
  externalUrl: string | null;
  itemType: string;
  title: string;
  description: string | null;
  status: string;
  statusCategory: 'todo' | 'in_progress' | 'done';
  assignee: string | null;
  assigneeEmail: string | null;
  sprintName: string | null;
  sprintId: string | null;
  storyPoints: number | null;
  originalEstimate: number | null;
  timeSpent: number | null;
  priority: string | null;
  priorityOrder: number | null;
  labels: string[];
  components: string[];
  parentId: string | null;
  parentTitle: string | null;
  blockerSignals: Record<string, number>;
  blockerConfidence: number;
  isBlocked: boolean;
  blockerReason: string | null;
  links: Array<{ type: string; targetId: string; targetStatus: string | null }>;
  lastUpdatedExternal: string | null;
  daysInStatus: number | null;
  syncedAt: string;
}

export interface SyncStatusResponse {
  sessionId: number;
  status: string;
  progressStep: number;
  progressTotal: number;
  progressMessage: string | null;
  errorMessage: string | null;
  itemsSynced: number;
  lastSyncAt: string | null;
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

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  provider: string;
  estimationField: string | null;
  blockerSignals: string[];
}

export interface SprintOption {
  id: string;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate: string | null;
  endDate: string | null;
}
