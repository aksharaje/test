// Jira Data Service - handles fetching and caching Jira data (boards, sprints, issues, velocity)

import { db } from '../../db/index.js';
import {
  jiraProjects,
  jiraBoards,
  jiraSprints,
  jiraIssues,
  fieldMappings,
} from '../../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { createJiraClient, JiraClient } from './client.js';
import { getIntegrationWithCredentials, ensureValidToken } from './integration.service.js';
import type { JiraSprint as JiraApiSprint, JiraIssue as JiraApiIssue } from './types.js';

// ==================
// Types
// ==================

export interface Board {
  id: number;
  jiraId: number;
  name: string;
  type: 'scrum' | 'kanban';
  projectId?: string;
  projectKey?: string;
  velocityAvg?: number;
  velocityLastN?: number;
  syncedAt: Date;
}

export interface Sprint {
  id: number;
  jiraId: number;
  boardId: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: Date;
  endDate?: Date;
  completedPoints?: number;
  committedPoints?: number;
  goal?: string;
  syncedAt: Date;
}

export interface Issue {
  id: number;
  jiraId: string;
  key: string;
  summary: string;
  description?: string;
  issueType: string;
  issueTypeId: string;
  status: string;
  statusCategory?: 'todo' | 'in_progress' | 'done';
  priority?: string;
  assigneeId?: string;
  assigneeName?: string;
  reporterId?: string;
  reporterName?: string;
  storyPoints?: number;
  sprintId?: number;
  epicKey?: string;
  parentKey?: string;
  labels: string[];
  components: string[];
  projectKey: string;
  createdDate?: Date;
  updatedDate?: Date;
  syncedAt: Date;
}

export interface VelocityData {
  sprints: Array<{
    sprintId: number;
    name: string;
    state: string;
    committed: number;
    completed: number;
  }>;
  averageVelocity: number;
}

// ==================
// Projects
// ==================

export async function getProjects(integrationId: number) {
  const results = await db
    .select()
    .from(jiraProjects)
    .where(eq(jiraProjects.integrationId, integrationId))
    .orderBy(jiraProjects.name);

  return results;
}

// ==================
// Boards
// ==================

export async function getBoards(integrationId: number): Promise<Board[]> {
  const results = await db
    .select()
    .from(jiraBoards)
    .where(eq(jiraBoards.integrationId, integrationId))
    .orderBy(jiraBoards.name);

  return results.map(mapBoard);
}

export async function getBoard(integrationId: number, boardJiraId: number): Promise<Board | null> {
  const [result] = await db
    .select()
    .from(jiraBoards)
    .where(
      and(
        eq(jiraBoards.integrationId, integrationId),
        eq(jiraBoards.jiraId, boardJiraId)
      )
    );

  return result ? mapBoard(result) : null;
}

export async function syncBoardSprints(integrationId: number, boardJiraId: number): Promise<Sprint[]> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Ensure token is valid
  await ensureValidToken(integrationId);
  const updatedIntegration = await getIntegrationWithCredentials(integrationId);
  const client = createJiraClient(updatedIntegration!);

  // Get all sprints for this board
  const [futureSprints, activeSprints, closedSprints] = await Promise.all([
    client.getSprints(boardJiraId, 'future'),
    client.getSprints(boardJiraId, 'active'),
    client.getSprints(boardJiraId, 'closed'),
  ]);

  const allSprints = [...futureSprints, ...activeSprints, ...closedSprints];

  // Upsert sprints
  for (const sprint of allSprints) {
    await db
      .insert(jiraSprints)
      .values({
        integrationId,
        boardId: boardJiraId,
        jiraId: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate ? new Date(sprint.startDate) : null,
        endDate: sprint.endDate ? new Date(sprint.endDate) : null,
        goal: sprint.goal,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [jiraSprints.integrationId, jiraSprints.jiraId],
        set: {
          boardId: boardJiraId,
          name: sprint.name,
          state: sprint.state,
          startDate: sprint.startDate ? new Date(sprint.startDate) : null,
          endDate: sprint.endDate ? new Date(sprint.endDate) : null,
          goal: sprint.goal,
          syncedAt: new Date(),
        },
      });
  }

  return getSprints(integrationId, boardJiraId);
}

// ==================
// Sprints
// ==================

export async function getSprints(
  integrationId: number,
  boardJiraId?: number,
  state?: 'future' | 'active' | 'closed'
): Promise<Sprint[]> {
  let query = db.select().from(jiraSprints).where(eq(jiraSprints.integrationId, integrationId));

  const conditions = [eq(jiraSprints.integrationId, integrationId)];

  if (boardJiraId !== undefined) {
    conditions.push(eq(jiraSprints.boardId, boardJiraId));
  }
  if (state) {
    conditions.push(eq(jiraSprints.state, state));
  }

  const results = await db
    .select()
    .from(jiraSprints)
    .where(and(...conditions))
    .orderBy(desc(jiraSprints.startDate));

  return results.map(mapSprint);
}

export async function getSprint(integrationId: number, sprintJiraId: number): Promise<Sprint | null> {
  const [result] = await db
    .select()
    .from(jiraSprints)
    .where(
      and(
        eq(jiraSprints.integrationId, integrationId),
        eq(jiraSprints.jiraId, sprintJiraId)
      )
    );

  return result ? mapSprint(result) : null;
}

// ==================
// Sprint Issues
// ==================

export async function syncSprintIssues(
  integrationId: number,
  sprintJiraId: number
): Promise<Issue[]> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Ensure token is valid
  await ensureValidToken(integrationId);
  const updatedIntegration = await getIntegrationWithCredentials(integrationId);
  const client = createJiraClient(updatedIntegration!);

  // Get story points field mapping
  const [storyPointsMapping] = await db
    .select()
    .from(fieldMappings)
    .where(
      and(
        eq(fieldMappings.integrationId, integrationId),
        eq(fieldMappings.ourField, 'story_points')
      )
    );

  const storyPointsField = storyPointsMapping?.providerFieldId;

  // Get issues for this sprint
  const fields = ['summary', 'description', 'issuetype', 'status', 'priority', 'assignee', 'reporter', 'labels', 'components', 'project', 'parent', 'created', 'updated', 'resolutiondate'];
  if (storyPointsField) {
    fields.push(storyPointsField);
  }

  const issues = await client.getSprintIssues(sprintJiraId, fields);

  // Calculate sprint points
  let completedPoints = 0;
  let committedPoints = 0;

  // Upsert issues
  for (const issue of issues) {
    const storyPoints = storyPointsField ? (issue.fields[storyPointsField] as number | undefined) : undefined;

    if (storyPoints) {
      committedPoints += storyPoints;
      if (issue.fields.status?.statusCategory?.key === 'done') {
        completedPoints += storyPoints;
      }
    }

    await upsertIssue(integrationId, issue, sprintJiraId, storyPoints);
  }

  // Update sprint with points
  await db
    .update(jiraSprints)
    .set({
      completedPoints,
      committedPoints,
      syncedAt: new Date(),
    })
    .where(
      and(
        eq(jiraSprints.integrationId, integrationId),
        eq(jiraSprints.jiraId, sprintJiraId)
      )
    );

  return getSprintIssues(integrationId, sprintJiraId);
}

export async function getSprintIssues(integrationId: number, sprintJiraId: number): Promise<Issue[]> {
  const results = await db
    .select()
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.integrationId, integrationId),
        eq(jiraIssues.sprintId, sprintJiraId)
      )
    )
    .orderBy(jiraIssues.key);

  return results.map(mapIssue);
}

// ==================
// Backlog Issues
// ==================

export async function syncBacklogIssues(
  integrationId: number,
  boardJiraId: number
): Promise<Issue[]> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Ensure token is valid
  await ensureValidToken(integrationId);
  const updatedIntegration = await getIntegrationWithCredentials(integrationId);
  const client = createJiraClient(updatedIntegration!);

  // Get story points field mapping
  const [storyPointsMapping] = await db
    .select()
    .from(fieldMappings)
    .where(
      and(
        eq(fieldMappings.integrationId, integrationId),
        eq(fieldMappings.ourField, 'story_points')
      )
    );

  const storyPointsField = storyPointsMapping?.providerFieldId;

  // Get backlog issues
  const fields = ['summary', 'description', 'issuetype', 'status', 'priority', 'assignee', 'reporter', 'labels', 'components', 'project', 'parent', 'created', 'updated'];
  if (storyPointsField) {
    fields.push(storyPointsField);
  }

  const issues = await client.getBacklogIssues(boardJiraId, fields);

  // Upsert issues
  for (const issue of issues) {
    const storyPoints = storyPointsField ? (issue.fields[storyPointsField] as number | undefined) : undefined;
    await upsertIssue(integrationId, issue, undefined, storyPoints);
  }

  return getBacklogIssues(integrationId, boardJiraId);
}

export async function getBacklogIssues(integrationId: number, boardJiraId: number): Promise<Issue[]> {
  // Get the board to find its project
  const board = await getBoard(integrationId, boardJiraId);
  if (!board?.projectKey) {
    return [];
  }

  // Get issues without a sprint for this project
  const results = await db
    .select()
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.integrationId, integrationId),
        eq(jiraIssues.projectKey, board.projectKey)
      )
    )
    .orderBy(jiraIssues.key);

  // Filter to only backlog items (no sprint)
  return results.filter(i => !i.sprintId).map(mapIssue);
}

// ==================
// Velocity
// ==================

export async function getVelocity(
  integrationId: number,
  boardJiraId: number,
  lastNSprints = 5
): Promise<VelocityData> {
  // Get closed sprints with points data
  const results = await db
    .select()
    .from(jiraSprints)
    .where(
      and(
        eq(jiraSprints.integrationId, integrationId),
        eq(jiraSprints.boardId, boardJiraId),
        eq(jiraSprints.state, 'closed')
      )
    )
    .orderBy(desc(jiraSprints.endDate))
    .limit(lastNSprints);

  const sprints = results.map(s => ({
    sprintId: s.jiraId,
    name: s.name,
    state: s.state,
    committed: s.committedPoints || 0,
    completed: s.completedPoints || 0,
  }));

  // Calculate average velocity
  const totalCompleted = sprints.reduce((sum, s) => sum + s.completed, 0);
  const averageVelocity = sprints.length > 0 ? Math.round(totalCompleted / sprints.length) : 0;

  // Update board with velocity
  await db
    .update(jiraBoards)
    .set({
      velocityAvg: averageVelocity,
      velocityLastN: lastNSprints,
      syncedAt: new Date(),
    })
    .where(
      and(
        eq(jiraBoards.integrationId, integrationId),
        eq(jiraBoards.jiraId, boardJiraId)
      )
    );

  return {
    sprints: sprints.reverse(), // Return in chronological order
    averageVelocity,
  };
}

export async function syncVelocity(
  integrationId: number,
  boardJiraId: number,
  lastNSprints = 5
): Promise<VelocityData> {
  // First sync sprints
  await syncBoardSprints(integrationId, boardJiraId);

  // Get closed sprints to sync their issues
  const closedSprints = await getSprints(integrationId, boardJiraId, 'closed');
  const recentClosedSprints = closedSprints.slice(0, lastNSprints);

  // Sync issues for recent closed sprints to get accurate points
  for (const sprint of recentClosedSprints) {
    await syncSprintIssues(integrationId, sprint.jiraId);
  }

  return getVelocity(integrationId, boardJiraId, lastNSprints);
}

// ==================
// Issue Search
// ==================

export async function searchIssues(
  integrationId: number,
  jql: string,
  options?: { startAt?: number; maxResults?: number }
): Promise<{ issues: Issue[]; total: number }> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Ensure token is valid
  await ensureValidToken(integrationId);
  const updatedIntegration = await getIntegrationWithCredentials(integrationId);
  const client = createJiraClient(updatedIntegration!);

  // Get story points field mapping
  const [storyPointsMapping] = await db
    .select()
    .from(fieldMappings)
    .where(
      and(
        eq(fieldMappings.integrationId, integrationId),
        eq(fieldMappings.ourField, 'story_points')
      )
    );

  const storyPointsField = storyPointsMapping?.providerFieldId;

  const fields = ['summary', 'description', 'issuetype', 'status', 'priority', 'assignee', 'reporter', 'labels', 'components', 'project', 'parent', 'created', 'updated'];
  if (storyPointsField) {
    fields.push(storyPointsField);
  }

  const result = await client.searchIssues(
    jql,
    fields,
    options?.startAt || 0,
    options?.maxResults || 50
  );

  // Cache the results
  for (const issue of result.issues) {
    const storyPoints = storyPointsField ? (issue.fields[storyPointsField] as number | undefined) : undefined;
    await upsertIssue(integrationId, issue, undefined, storyPoints);
  }

  return {
    issues: result.issues.map(i => mapApiIssue(i, undefined, storyPointsField ? (i.fields[storyPointsField] as number | undefined) : undefined)),
    total: result.total,
  };
}

// ==================
// Epic Issues
// ==================

export async function getEpicIssues(integrationId: number, epicKey: string): Promise<Issue[]> {
  const results = await db
    .select()
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.integrationId, integrationId),
        eq(jiraIssues.epicKey, epicKey)
      )
    )
    .orderBy(jiraIssues.key);

  return results.map(mapIssue);
}

export async function syncEpicIssues(integrationId: number, epicKey: string): Promise<Issue[]> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Ensure token is valid
  await ensureValidToken(integrationId);
  const updatedIntegration = await getIntegrationWithCredentials(integrationId);
  const client = createJiraClient(updatedIntegration!);

  // Get story points field mapping
  const [storyPointsMapping] = await db
    .select()
    .from(fieldMappings)
    .where(
      and(
        eq(fieldMappings.integrationId, integrationId),
        eq(fieldMappings.ourField, 'story_points')
      )
    );

  const storyPointsField = storyPointsMapping?.providerFieldId;

  const issues = await client.getEpicIssues(epicKey);

  // Upsert issues
  for (const issue of issues) {
    const storyPoints = storyPointsField ? (issue.fields[storyPointsField] as number | undefined) : undefined;
    await upsertIssue(integrationId, issue, undefined, storyPoints);
  }

  return getEpicIssues(integrationId, epicKey);
}

// ==================
// User's Current Work
// ==================

export async function getUserCurrentWork(
  integrationId: number,
  accountId: string
): Promise<Issue[]> {
  const results = await db
    .select()
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.integrationId, integrationId),
        eq(jiraIssues.assigneeId, accountId)
      )
    )
    .orderBy(desc(jiraIssues.updatedDate));

  // Filter to only in-progress items
  return results.filter(i => i.statusCategory === 'in_progress').map(mapIssue);
}

export async function syncUserCurrentWork(
  integrationId: number,
  accountId: string
): Promise<Issue[]> {
  const { issues } = await searchIssues(
    integrationId,
    `assignee = "${accountId}" AND statusCategory = "In Progress" ORDER BY updated DESC`,
    { maxResults: 50 }
  );

  return issues;
}

// ==================
// Helpers
// ==================

async function upsertIssue(
  integrationId: number,
  issue: JiraApiIssue,
  sprintId?: number,
  storyPoints?: number
): Promise<void> {
  const statusCategory = mapStatusCategory(issue.fields.status?.statusCategory?.key);

  await db
    .insert(jiraIssues)
    .values({
      integrationId,
      jiraId: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      description: typeof issue.fields.description === 'string'
        ? issue.fields.description
        : issue.fields.description
          ? JSON.stringify(issue.fields.description)
          : null,
      issueType: issue.fields.issuetype?.name || 'Unknown',
      issueTypeId: issue.fields.issuetype?.id || '',
      status: issue.fields.status?.name || 'Unknown',
      statusCategory,
      priority: issue.fields.priority?.name,
      assigneeId: issue.fields.assignee?.accountId,
      assigneeName: issue.fields.assignee?.displayName,
      reporterId: issue.fields.reporter?.accountId,
      reporterName: issue.fields.reporter?.displayName,
      storyPoints,
      sprintId,
      epicKey: issue.fields.parent?.key,
      parentKey: issue.fields.parent?.key,
      labels: issue.fields.labels || [],
      components: issue.fields.components?.map(c => c.name) || [],
      projectKey: issue.fields.project?.key || '',
      createdDate: issue.fields.created ? new Date(issue.fields.created) : null,
      updatedDate: issue.fields.updated ? new Date(issue.fields.updated) : null,
      resolutionDate: issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [jiraIssues.integrationId, jiraIssues.jiraId],
      set: {
        key: issue.key,
        summary: issue.fields.summary,
        description: typeof issue.fields.description === 'string'
          ? issue.fields.description
          : issue.fields.description
            ? JSON.stringify(issue.fields.description)
            : null,
        issueType: issue.fields.issuetype?.name || 'Unknown',
        issueTypeId: issue.fields.issuetype?.id || '',
        status: issue.fields.status?.name || 'Unknown',
        statusCategory,
        priority: issue.fields.priority?.name,
        assigneeId: issue.fields.assignee?.accountId,
        assigneeName: issue.fields.assignee?.displayName,
        reporterId: issue.fields.reporter?.accountId,
        reporterName: issue.fields.reporter?.displayName,
        storyPoints,
        sprintId,
        epicKey: issue.fields.parent?.key,
        parentKey: issue.fields.parent?.key,
        labels: issue.fields.labels || [],
        components: issue.fields.components?.map(c => c.name) || [],
        projectKey: issue.fields.project?.key || '',
        createdDate: issue.fields.created ? new Date(issue.fields.created) : null,
        updatedDate: issue.fields.updated ? new Date(issue.fields.updated) : null,
        resolutionDate: issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null,
        syncedAt: new Date(),
      },
    });
}

function mapStatusCategory(key?: string): 'todo' | 'in_progress' | 'done' | undefined {
  if (!key) return undefined;
  if (key === 'new' || key === 'undefined') return 'todo';
  if (key === 'indeterminate') return 'in_progress';
  if (key === 'done') return 'done';
  return undefined;
}

function mapBoard(row: typeof jiraBoards.$inferSelect): Board {
  return {
    id: row.id,
    jiraId: row.jiraId,
    name: row.name,
    type: row.type,
    projectId: row.projectId || undefined,
    projectKey: row.projectKey || undefined,
    velocityAvg: row.velocityAvg || undefined,
    velocityLastN: row.velocityLastN || undefined,
    syncedAt: row.syncedAt,
  };
}

function mapSprint(row: typeof jiraSprints.$inferSelect): Sprint {
  return {
    id: row.id,
    jiraId: row.jiraId,
    boardId: row.boardId,
    name: row.name,
    state: row.state,
    startDate: row.startDate || undefined,
    endDate: row.endDate || undefined,
    completedPoints: row.completedPoints || undefined,
    committedPoints: row.committedPoints || undefined,
    goal: row.goal || undefined,
    syncedAt: row.syncedAt,
  };
}

function mapIssue(row: typeof jiraIssues.$inferSelect): Issue {
  return {
    id: row.id,
    jiraId: row.jiraId,
    key: row.key,
    summary: row.summary,
    description: row.description || undefined,
    issueType: row.issueType,
    issueTypeId: row.issueTypeId,
    status: row.status,
    statusCategory: row.statusCategory || undefined,
    priority: row.priority || undefined,
    assigneeId: row.assigneeId || undefined,
    assigneeName: row.assigneeName || undefined,
    reporterId: row.reporterId || undefined,
    reporterName: row.reporterName || undefined,
    storyPoints: row.storyPoints || undefined,
    sprintId: row.sprintId || undefined,
    epicKey: row.epicKey || undefined,
    parentKey: row.parentKey || undefined,
    labels: row.labels || [],
    components: row.components || [],
    projectKey: row.projectKey,
    createdDate: row.createdDate || undefined,
    updatedDate: row.updatedDate || undefined,
    syncedAt: row.syncedAt,
  };
}

function mapApiIssue(issue: JiraApiIssue, sprintId?: number, storyPoints?: number): Issue {
  return {
    id: 0, // Not persisted yet
    jiraId: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    description: typeof issue.fields.description === 'string'
      ? issue.fields.description
      : issue.fields.description
        ? JSON.stringify(issue.fields.description)
        : undefined,
    issueType: issue.fields.issuetype?.name || 'Unknown',
    issueTypeId: issue.fields.issuetype?.id || '',
    status: issue.fields.status?.name || 'Unknown',
    statusCategory: mapStatusCategory(issue.fields.status?.statusCategory?.key),
    priority: issue.fields.priority?.name,
    assigneeId: issue.fields.assignee?.accountId,
    assigneeName: issue.fields.assignee?.displayName,
    reporterId: issue.fields.reporter?.accountId,
    reporterName: issue.fields.reporter?.displayName,
    storyPoints,
    sprintId,
    epicKey: issue.fields.parent?.key,
    parentKey: issue.fields.parent?.key,
    labels: issue.fields.labels || [],
    components: issue.fields.components?.map(c => c.name) || [],
    projectKey: issue.fields.project?.key || '',
    createdDate: issue.fields.created ? new Date(issue.fields.created) : undefined,
    updatedDate: issue.fields.updated ? new Date(issue.fields.updated) : undefined,
    syncedAt: new Date(),
  };
}

export const jiraDataService = {
  // Projects
  getProjects,

  // Boards
  getBoards,
  getBoard,
  syncBoardSprints,

  // Sprints
  getSprints,
  getSprint,
  getSprintIssues,
  syncSprintIssues,

  // Backlog
  getBacklogIssues,
  syncBacklogIssues,

  // Velocity
  getVelocity,
  syncVelocity,

  // Search
  searchIssues,

  // Epic
  getEpicIssues,
  syncEpicIssues,

  // User's work
  getUserCurrentWork,
  syncUserCurrentWork,
};
