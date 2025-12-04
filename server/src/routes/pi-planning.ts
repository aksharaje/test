import { Router } from 'express';
import { piPlanningService, integrationService } from '../services/jira/index.js';
import type { PiSessionStatus } from '../db/schema.js';

const router = Router();

// ==================
// Sessions
// ==================

// Get all PI planning sessions for an integration
router.get('/:integrationId/sessions', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const sessions = await piPlanningService.getSessions(integrationId);
    res.json(sessions);
  } catch (error) {
    console.error('Error getting PI sessions:', error);
    res.status(500).json({ error: 'Failed to get PI sessions' });
  }
});

// Create a new PI planning session
router.post('/:integrationId/sessions', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { name, description, startDate, endDate, sprintCount, boardIds, createdBy } = req.body;

    if (!name || !boardIds?.length) {
      return res.status(400).json({ error: 'name and boardIds are required' });
    }

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const session = await piPlanningService.createSession({
      integrationId,
      name,
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sprintCount,
      boardIds,
      createdBy,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating PI session:', error);
    res.status(500).json({ error: 'Failed to create PI session' });
  }
});

// Get a specific PI planning session
router.get('/:integrationId/sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    const session = await piPlanningService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error getting PI session:', error);
    res.status(500).json({ error: 'Failed to get PI session' });
  }
});

// Update a PI planning session
router.patch('/:integrationId/sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { name, description, startDate, endDate, sprintCount, status } = req.body;

    const session = await piPlanningService.updateSession(sessionId, {
      name,
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sprintCount,
      status: status as PiSessionStatus,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error updating PI session:', error);
    res.status(500).json({ error: 'Failed to update PI session' });
  }
});

// Delete a PI planning session
router.delete('/:integrationId/sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    const deleted = await piPlanningService.deleteSession(sessionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting PI session:', error);
    res.status(500).json({ error: 'Failed to delete PI session' });
  }
});

// ==================
// Planning View
// ==================

// Get the full planning view for a session
router.get('/:integrationId/sessions/:sessionId/view', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const sessionId = parseInt(req.params.sessionId);

    const view = await piPlanningService.getPlanningView(sessionId, integrationId);
    if (!view) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(view);
  } catch (error) {
    console.error('Error getting planning view:', error);
    res.status(500).json({ error: 'Failed to get planning view' });
  }
});

// ==================
// Session Boards
// ==================

// Update a board in the session
router.patch('/:integrationId/sessions/:sessionId/boards/:boardId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const boardId = parseInt(req.params.boardId);
    const { velocityOverride, capacityAdjustment } = req.body;

    const board = await piPlanningService.updateSessionBoard(sessionId, boardId, {
      velocityOverride,
      capacityAdjustment,
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found in session' });
    }

    res.json(board);
  } catch (error) {
    console.error('Error updating session board:', error);
    res.status(500).json({ error: 'Failed to update session board' });
  }
});

// Add a board to the session
router.post('/:integrationId/sessions/:sessionId/boards', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const sessionId = parseInt(req.params.sessionId);
    const { boardId } = req.body;

    if (!boardId) {
      return res.status(400).json({ error: 'boardId is required' });
    }

    const board = await piPlanningService.addBoardToSession(sessionId, integrationId, boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.status(201).json(board);
  } catch (error) {
    console.error('Error adding board to session:', error);
    res.status(500).json({ error: 'Failed to add board to session' });
  }
});

// Remove a board from the session
router.delete('/:integrationId/sessions/:sessionId/boards/:boardId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const boardId = parseInt(req.params.boardId);

    const deleted = await piPlanningService.removeBoardFromSession(sessionId, boardId);
    if (!deleted) {
      return res.status(404).json({ error: 'Board not found in session' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error removing board from session:', error);
    res.status(500).json({ error: 'Failed to remove board from session' });
  }
});

// ==================
// Planned Items
// ==================

// Get all items for a session
router.get('/:integrationId/sessions/:sessionId/items', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    const items = await piPlanningService.getSessionItems(sessionId);
    res.json(items);
  } catch (error) {
    console.error('Error getting session items:', error);
    res.status(500).json({ error: 'Failed to get session items' });
  }
});

// Add a planned item
router.post('/:integrationId/sessions/:sessionId/items', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const {
      jiraIssueId,
      jiraIssueKey,
      title,
      assignedBoardId,
      targetSprintId,
      estimatedPoints,
      confidence,
      dependencies,
      notes,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const item = await piPlanningService.addPlannedItem({
      sessionId,
      jiraIssueId,
      jiraIssueKey,
      title,
      assignedBoardId,
      targetSprintId,
      estimatedPoints,
      confidence,
      dependencies,
      notes,
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding planned item:', error);
    res.status(500).json({ error: 'Failed to add planned item' });
  }
});

// Update a planned item
router.patch('/:integrationId/sessions/:sessionId/items/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const {
      title,
      assignedBoardId,
      targetSprintId,
      sequenceOrder,
      estimatedPoints,
      confidence,
      dependencies,
      notes,
    } = req.body;

    const item = await piPlanningService.updatePlannedItem(itemId, {
      title,
      assignedBoardId,
      targetSprintId,
      sequenceOrder,
      estimatedPoints,
      confidence,
      dependencies,
      notes,
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error updating planned item:', error);
    res.status(500).json({ error: 'Failed to update planned item' });
  }
});

// Delete a planned item
router.delete('/:integrationId/sessions/:sessionId/items/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);

    const deleted = await piPlanningService.deletePlannedItem(itemId);
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting planned item:', error);
    res.status(500).json({ error: 'Failed to delete planned item' });
  }
});

// ==================
// Import
// ==================

// Import items from Jira backlog
router.post('/:integrationId/sessions/:sessionId/import-backlog', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const sessionId = parseInt(req.params.sessionId);
    const { boardId, issueKeys } = req.body;

    if (!boardId) {
      return res.status(400).json({ error: 'boardId is required' });
    }

    const items = await piPlanningService.importFromBacklog(
      sessionId,
      integrationId,
      boardId,
      issueKeys
    );

    res.status(201).json(items);
  } catch (error) {
    console.error('Error importing from backlog:', error);
    res.status(500).json({ error: 'Failed to import from backlog' });
  }
});

export default router;
