// PI Planning Service - manages PI planning sessions across multiple boards/teams

import { db } from '../../db/index.js';
import {
  piPlanningSessions,
  piSessionBoards,
  piPlannedItems,
  jiraBoards,
  jiraSprints,
  jiraIssues,
  type PiSessionStatus,
} from '../../db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { jiraDataService } from './data.service.js';

// ==================
// Types
// ==================

export interface PiSession {
  id: number;
  integrationId: number;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  sprintCount: number;
  status: PiSessionStatus;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  boards?: PiSessionBoard[];
}

export interface PiSessionBoard {
  id: number;
  sessionId: number;
  boardId: number;
  boardName: string;
  velocityOverride: number | null;
  capacityAdjustment: number;
  velocity?: number; // Computed from board or override
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
  dependencies: string[]; // Array of Jira issue keys
  notes: string | null;
  aiSuggested: boolean;
}

export interface PiPlanningView {
  session: PiSession;
  boards: Array<PiSessionBoard & {
    sprints: Array<{
      jiraId: number;
      name: string;
      state: string;
      capacity: number; // Points capacity for this sprint
      plannedPoints: number; // Sum of planned items
      items: PiPlannedItem[];
    }>;
    backlog: PiPlannedItem[];
  }>;
}

export interface CreateSessionRequest {
  integrationId: number;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  sprintCount?: number;
  boardIds: number[]; // Jira board IDs to include
  createdBy?: number;
}

export interface AddItemRequest {
  sessionId: number;
  jiraIssueId?: string;
  jiraIssueKey?: string;
  title: string;
  assignedBoardId?: number;
  targetSprintId?: number;
  estimatedPoints?: number;
  confidence?: number;
  dependencies?: string[]; // Array of Jira issue keys
  notes?: string;
}

// ==================
// Session CRUD
// ==================

export async function createSession(request: CreateSessionRequest): Promise<PiSession> {
  // Create the session
  const [session] = await db
    .insert(piPlanningSessions)
    .values({
      integrationId: request.integrationId,
      name: request.name,
      description: request.description,
      startDate: request.startDate,
      endDate: request.endDate,
      sprintCount: request.sprintCount || 5,
      status: 'draft',
      createdBy: request.createdBy,
    })
    .returning();

  // Get board details and add them to the session
  const boards = await db
    .select()
    .from(jiraBoards)
    .where(
      and(
        eq(jiraBoards.integrationId, request.integrationId),
        inArray(jiraBoards.jiraId, request.boardIds)
      )
    );

  for (const board of boards) {
    await db.insert(piSessionBoards).values({
      sessionId: session.id,
      boardId: board.jiraId,
      boardName: board.name,
      velocityOverride: null,
      capacityAdjustment: 100,
    });
  }

  return mapSession(session);
}

export async function getSessions(integrationId: number): Promise<PiSession[]> {
  const sessions = await db
    .select()
    .from(piPlanningSessions)
    .where(eq(piPlanningSessions.integrationId, integrationId))
    .orderBy(desc(piPlanningSessions.createdAt));

  return sessions.map(mapSession);
}

export async function getSession(sessionId: number): Promise<PiSession | null> {
  const [session] = await db
    .select()
    .from(piPlanningSessions)
    .where(eq(piPlanningSessions.id, sessionId));

  if (!session) return null;

  // Get boards for this session
  const boards = await db
    .select()
    .from(piSessionBoards)
    .where(eq(piSessionBoards.sessionId, sessionId));

  const result = mapSession(session);
  result.boards = boards.map(mapSessionBoard);

  return result;
}

export async function updateSession(
  sessionId: number,
  updates: Partial<{
    name: string;
    description: string;
    startDate: Date;
    endDate: Date;
    sprintCount: number;
    status: PiSessionStatus;
  }>
): Promise<PiSession | null> {
  const [updated] = await db
    .update(piPlanningSessions)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(piPlanningSessions.id, sessionId))
    .returning();

  return updated ? mapSession(updated) : null;
}

export async function deleteSession(sessionId: number): Promise<boolean> {
  const result = await db
    .delete(piPlanningSessions)
    .where(eq(piPlanningSessions.id, sessionId))
    .returning();

  return result.length > 0;
}

// ==================
// Session Boards
// ==================

export async function updateSessionBoard(
  sessionId: number,
  boardId: number,
  updates: { velocityOverride?: number; capacityAdjustment?: number }
): Promise<PiSessionBoard | null> {
  const [updated] = await db
    .update(piSessionBoards)
    .set(updates)
    .where(
      and(
        eq(piSessionBoards.sessionId, sessionId),
        eq(piSessionBoards.boardId, boardId)
      )
    )
    .returning();

  return updated ? mapSessionBoard(updated) : null;
}

export async function addBoardToSession(
  sessionId: number,
  integrationId: number,
  boardId: number
): Promise<PiSessionBoard | null> {
  // Get board details
  const [board] = await db
    .select()
    .from(jiraBoards)
    .where(
      and(
        eq(jiraBoards.integrationId, integrationId),
        eq(jiraBoards.jiraId, boardId)
      )
    );

  if (!board) return null;

  const [created] = await db
    .insert(piSessionBoards)
    .values({
      sessionId,
      boardId: board.jiraId,
      boardName: board.name,
      velocityOverride: null,
      capacityAdjustment: 100,
    })
    .returning();

  return mapSessionBoard(created);
}

export async function removeBoardFromSession(
  sessionId: number,
  boardId: number
): Promise<boolean> {
  const result = await db
    .delete(piSessionBoards)
    .where(
      and(
        eq(piSessionBoards.sessionId, sessionId),
        eq(piSessionBoards.boardId, boardId)
      )
    )
    .returning();

  return result.length > 0;
}

// ==================
// Planned Items
// ==================

export async function addPlannedItem(request: AddItemRequest): Promise<PiPlannedItem> {
  // Get the next sequence order
  const existingItems = await db
    .select()
    .from(piPlannedItems)
    .where(eq(piPlannedItems.sessionId, request.sessionId));

  const maxSequence = Math.max(0, ...existingItems.map(i => i.sequenceOrder || 0));

  const [item] = await db
    .insert(piPlannedItems)
    .values({
      sessionId: request.sessionId,
      jiraIssueId: request.jiraIssueId,
      jiraIssueKey: request.jiraIssueKey,
      title: request.title,
      assignedBoardId: request.assignedBoardId,
      targetSprintId: request.targetSprintId,
      sequenceOrder: maxSequence + 1,
      estimatedPoints: request.estimatedPoints,
      confidence: request.confidence,
      dependencies: request.dependencies || [],
      notes: request.notes,
      aiSuggested: 0,
    })
    .returning();

  return mapPlannedItem(item);
}

export async function updatePlannedItem(
  itemId: number,
  updates: Partial<{
    title: string;
    assignedBoardId: number | null;
    targetSprintId: number | null;
    sequenceOrder: number;
    estimatedPoints: number;
    confidence: number;
    dependencies: string[]; // Array of Jira issue keys
    notes: string;
  }>
): Promise<PiPlannedItem | null> {
  const [updated] = await db
    .update(piPlannedItems)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(piPlannedItems.id, itemId))
    .returning();

  return updated ? mapPlannedItem(updated) : null;
}

export async function deletePlannedItem(itemId: number): Promise<boolean> {
  const result = await db
    .delete(piPlannedItems)
    .where(eq(piPlannedItems.id, itemId))
    .returning();

  return result.length > 0;
}

export async function getSessionItems(sessionId: number): Promise<PiPlannedItem[]> {
  const items = await db
    .select()
    .from(piPlannedItems)
    .where(eq(piPlannedItems.sessionId, sessionId))
    .orderBy(piPlannedItems.sequenceOrder);

  return items.map(mapPlannedItem);
}

// ==================
// Planning View
// ==================

export async function getPlanningView(
  sessionId: number,
  integrationId: number
): Promise<PiPlanningView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const sessionBoards = session.boards || [];
  const items = await getSessionItems(sessionId);

  // Build board view with sprints
  const boardViews = await Promise.all(
    sessionBoards.map(async (sessionBoard) => {
      // Get sprints for this board
      const sprints = await jiraDataService.getSprints(integrationId, sessionBoard.boardId);

      // Get board velocity
      const board = await jiraDataService.getBoard(integrationId, sessionBoard.boardId);
      const velocity = sessionBoard.velocityOverride || board?.velocityAvg || 0;
      const adjustedVelocity = Math.round(velocity * (sessionBoard.capacityAdjustment / 100));

      // Organize items by sprint
      const sprintViews = sprints
        .filter(s => s.state !== 'closed')
        .slice(0, session.sprintCount)
        .map(sprint => {
          const sprintItems = items.filter(
            i => i.assignedBoardId === sessionBoard.boardId && i.targetSprintId === sprint.jiraId
          );
          const plannedPoints = sprintItems.reduce((sum, i) => sum + (i.estimatedPoints || 0), 0);

          return {
            jiraId: sprint.jiraId,
            name: sprint.name,
            state: sprint.state,
            capacity: adjustedVelocity,
            plannedPoints,
            items: sprintItems,
          };
        });

      // Get backlog items (assigned to this board but no sprint)
      const backlogItems = items.filter(
        i => i.assignedBoardId === sessionBoard.boardId && !i.targetSprintId
      );

      return {
        ...sessionBoard,
        velocity: adjustedVelocity,
        sprints: sprintViews,
        backlog: backlogItems,
      };
    })
  );

  // Items not assigned to any board
  const unassignedItems = items.filter(i => !i.assignedBoardId);

  return {
    session,
    boards: boardViews,
  };
}

// ==================
// Import from Backlog
// ==================

export async function importFromBacklog(
  sessionId: number,
  integrationId: number,
  boardId: number,
  issueKeys?: string[]
): Promise<PiPlannedItem[]> {
  // Sync backlog first
  await jiraDataService.syncBacklogIssues(integrationId, boardId);

  // Get backlog issues
  const backlogIssues = await jiraDataService.getBacklogIssues(integrationId, boardId);

  // Filter if specific keys provided
  const issuesToImport = issueKeys
    ? backlogIssues.filter(i => issueKeys.includes(i.key))
    : backlogIssues;

  const importedItems: PiPlannedItem[] = [];

  for (const issue of issuesToImport) {
    const item = await addPlannedItem({
      sessionId,
      jiraIssueId: issue.jiraId,
      jiraIssueKey: issue.key,
      title: issue.summary,
      assignedBoardId: boardId,
      estimatedPoints: issue.storyPoints,
    });
    importedItems.push(item);
  }

  return importedItems;
}

// ==================
// Helpers
// ==================

function mapSession(row: typeof piPlanningSessions.$inferSelect): PiSession {
  return {
    id: row.id,
    integrationId: row.integrationId,
    name: row.name,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    sprintCount: row.sprintCount || 5,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSessionBoard(row: typeof piSessionBoards.$inferSelect): PiSessionBoard {
  return {
    id: row.id,
    sessionId: row.sessionId,
    boardId: row.boardId,
    boardName: row.boardName,
    velocityOverride: row.velocityOverride,
    capacityAdjustment: row.capacityAdjustment || 100,
  };
}

function mapPlannedItem(row: typeof piPlannedItems.$inferSelect): PiPlannedItem {
  return {
    id: row.id,
    sessionId: row.sessionId,
    jiraIssueId: row.jiraIssueId,
    jiraIssueKey: row.jiraIssueKey,
    title: row.title,
    assignedBoardId: row.assignedBoardId,
    targetSprintId: row.targetSprintId,
    sequenceOrder: row.sequenceOrder,
    estimatedPoints: row.estimatedPoints,
    confidence: row.confidence,
    dependencies: row.dependencies || [],
    notes: row.notes,
    aiSuggested: row.aiSuggested === 1,
  };
}

export const piPlanningService = {
  // Sessions
  createSession,
  getSessions,
  getSession,
  updateSession,
  deleteSession,

  // Boards
  updateSessionBoard,
  addBoardToSession,
  removeBoardFromSession,

  // Items
  addPlannedItem,
  updatePlannedItem,
  deletePlannedItem,
  getSessionItems,

  // Views
  getPlanningView,

  // Import
  importFromBacklog,
};
