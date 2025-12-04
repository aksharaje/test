import { Router } from 'express';
import { jiraDataService, integrationService, issueCreationService } from '../services/jira/index.js';

const router = Router();

// ==================
// Projects
// ==================

// Get projects for an integration
router.get('/:integrationId/projects', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const projects = await jiraDataService.getProjects(integrationId);
    res.json(projects);
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// ==================
// Boards
// ==================

// Get all boards for an integration
router.get('/:integrationId/boards', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const boards = await jiraDataService.getBoards(integrationId);
    res.json(boards);
  } catch (error) {
    console.error('Error getting boards:', error);
    res.status(500).json({ error: 'Failed to get boards' });
  }
});

// Get a specific board
router.get('/:integrationId/boards/:boardId', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const board = await jiraDataService.getBoard(integrationId, boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json(board);
  } catch (error) {
    console.error('Error getting board:', error);
    res.status(500).json({ error: 'Failed to get board' });
  }
});

// ==================
// Sprints
// ==================

// Get sprints for a board
router.get('/:integrationId/boards/:boardId/sprints', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);
    const state = req.query.state as 'future' | 'active' | 'closed' | undefined;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const sprints = await jiraDataService.getSprints(integrationId, boardId, state);
    res.json(sprints);
  } catch (error) {
    console.error('Error getting sprints:', error);
    res.status(500).json({ error: 'Failed to get sprints' });
  }
});

// Sync sprints for a board
router.post('/:integrationId/boards/:boardId/sprints/sync', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const sprints = await jiraDataService.syncBoardSprints(integrationId, boardId);
    res.json(sprints);
  } catch (error) {
    console.error('Error syncing sprints:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// Get a specific sprint
router.get('/:integrationId/sprints/:sprintId', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const sprintId = parseInt(req.params.sprintId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const sprint = await jiraDataService.getSprint(integrationId, sprintId);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    res.json(sprint);
  } catch (error) {
    console.error('Error getting sprint:', error);
    res.status(500).json({ error: 'Failed to get sprint' });
  }
});

// Get issues for a sprint
router.get('/:integrationId/sprints/:sprintId/issues', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const sprintId = parseInt(req.params.sprintId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.getSprintIssues(integrationId, sprintId);
    res.json(issues);
  } catch (error) {
    console.error('Error getting sprint issues:', error);
    res.status(500).json({ error: 'Failed to get sprint issues' });
  }
});

// Sync issues for a sprint
router.post('/:integrationId/sprints/:sprintId/issues/sync', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const sprintId = parseInt(req.params.sprintId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.syncSprintIssues(integrationId, sprintId);
    res.json(issues);
  } catch (error) {
    console.error('Error syncing sprint issues:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// Backlog
// ==================

// Get backlog issues for a board
router.get('/:integrationId/boards/:boardId/backlog', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.getBacklogIssues(integrationId, boardId);
    res.json(issues);
  } catch (error) {
    console.error('Error getting backlog:', error);
    res.status(500).json({ error: 'Failed to get backlog' });
  }
});

// Sync backlog issues for a board
router.post('/:integrationId/boards/:boardId/backlog/sync', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.syncBacklogIssues(integrationId, boardId);
    res.json(issues);
  } catch (error) {
    console.error('Error syncing backlog:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// Velocity
// ==================

// Get velocity for a board
router.get('/:integrationId/boards/:boardId/velocity', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);
    const lastN = req.query.lastN ? parseInt(req.query.lastN as string) : 5;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const velocity = await jiraDataService.getVelocity(integrationId, boardId, lastN);
    res.json(velocity);
  } catch (error) {
    console.error('Error getting velocity:', error);
    res.status(500).json({ error: 'Failed to get velocity' });
  }
});

// Sync velocity for a board (syncs sprints and their issues)
router.post('/:integrationId/boards/:boardId/velocity/sync', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const boardId = parseInt(req.params.boardId);
    const lastN = req.body.lastN || 5;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const velocity = await jiraDataService.syncVelocity(integrationId, boardId, lastN);
    res.json(velocity);
  } catch (error) {
    console.error('Error syncing velocity:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// Search
// ==================

// Search issues with JQL
router.post('/:integrationId/search', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { jql, startAt, maxResults } = req.body;

    if (!jql) {
      return res.status(400).json({ error: 'JQL query is required' });
    }

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const result = await jiraDataService.searchIssues(integrationId, jql, { startAt, maxResults });
    res.json(result);
  } catch (error) {
    console.error('Error searching issues:', error);
    const message = error instanceof Error ? error.message : 'Search failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// Epic
// ==================

// Get issues for an epic
router.get('/:integrationId/epics/:epicKey/issues', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { epicKey } = req.params;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.getEpicIssues(integrationId, epicKey);
    res.json(issues);
  } catch (error) {
    console.error('Error getting epic issues:', error);
    res.status(500).json({ error: 'Failed to get epic issues' });
  }
});

// Sync issues for an epic
router.post('/:integrationId/epics/:epicKey/issues/sync', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { epicKey } = req.params;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.syncEpicIssues(integrationId, epicKey);
    res.json(issues);
  } catch (error) {
    console.error('Error syncing epic issues:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// User's Current Work
// ==================

// Get user's current work
router.get('/:integrationId/users/:accountId/current-work', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { accountId } = req.params;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.getUserCurrentWork(integrationId, accountId);
    res.json(issues);
  } catch (error) {
    console.error('Error getting user current work:', error);
    res.status(500).json({ error: 'Failed to get user current work' });
  }
});

// Sync user's current work
router.post('/:integrationId/users/:accountId/current-work/sync', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { accountId } = req.params;

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await jiraDataService.syncUserCurrentWork(integrationId, accountId);
    res.json(issues);
  } catch (error) {
    console.error('Error syncing user current work:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// Issue Creation
// ==================

// Create a single issue
router.post('/:integrationId/issues', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const {
      projectKey,
      issueTypeId,
      summary,
      description,
      storyPoints,
      labels,
      components,
      priority,
      parentIssueKey,
      sprintId,
      artifactType,
      artifactId,
    } = req.body;

    if (!projectKey || !issueTypeId || !summary) {
      return res.status(400).json({ error: 'projectKey, issueTypeId, and summary are required' });
    }

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issue = await issueCreationService.createIssue({
      integrationId,
      projectKey,
      issueTypeId,
      summary,
      description,
      storyPoints,
      labels,
      components,
      priority,
      parentIssueKey,
      sprintId,
      artifactType,
      artifactId,
    });

    res.status(201).json(issue);
  } catch (error) {
    console.error('Error creating issue:', error);
    const message = error instanceof Error ? error.message : 'Failed to create issue';
    res.status(500).json({ error: message });
  }
});

// Bulk create issues
router.post('/:integrationId/issues/bulk', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const { projectKey, epicIssueTypeId, storyIssueTypeId, items } = req.body;

    if (!projectKey || !epicIssueTypeId || !storyIssueTypeId || !items?.length) {
      return res.status(400).json({
        error: 'projectKey, epicIssueTypeId, storyIssueTypeId, and items are required',
      });
    }

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await issueCreationService.bulkCreateIssues({
      integrationId,
      projectKey,
      epicIssueTypeId,
      storyIssueTypeId,
      items,
    });

    res.status(201).json(issues);
  } catch (error) {
    console.error('Error bulk creating issues:', error);
    const message = error instanceof Error ? error.message : 'Failed to create issues';
    res.status(500).json({ error: message });
  }
});

// Create issues from a PRD
router.post('/:integrationId/issues/from-prd', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const {
      prdId,
      projectKey,
      epicIssueTypeId,
      storyIssueTypeId,
      includeEpic,
      defaultLabels,
    } = req.body;

    if (!prdId || !projectKey || !epicIssueTypeId || !storyIssueTypeId) {
      return res.status(400).json({
        error: 'prdId, projectKey, epicIssueTypeId, and storyIssueTypeId are required',
      });
    }

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await issueCreationService.createIssuesFromPrd({
      integrationId,
      prdId,
      projectKey,
      epicIssueTypeId,
      storyIssueTypeId,
      includeEpic,
      defaultLabels,
    });

    res.status(201).json(issues);
  } catch (error) {
    console.error('Error creating issues from PRD:', error);
    const message = error instanceof Error ? error.message : 'Failed to create issues from PRD';
    res.status(500).json({ error: message });
  }
});

// Create issues from generated artifacts
router.post('/:integrationId/issues/from-artifacts', async (req, res) => {
  try {
    const integrationId = parseInt(req.params.integrationId);
    const {
      artifactIds,
      projectKey,
      epicIssueTypeId,
      storyIssueTypeId,
      defaultLabels,
      targetSprintId,
    } = req.body;

    if (!artifactIds?.length || !projectKey || !epicIssueTypeId || !storyIssueTypeId) {
      return res.status(400).json({
        error: 'artifactIds, projectKey, epicIssueTypeId, and storyIssueTypeId are required',
      });
    }

    const integration = await integrationService.get(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const issues = await issueCreationService.createIssuesFromArtifacts({
      integrationId,
      artifactIds,
      projectKey,
      epicIssueTypeId,
      storyIssueTypeId,
      defaultLabels,
      targetSprintId,
    });

    res.status(201).json(issues);
  } catch (error) {
    console.error('Error creating issues from artifacts:', error);
    const message = error instanceof Error ? error.message : 'Failed to create issues from artifacts';
    res.status(500).json({ error: message });
  }
});

// Get linked Jira issues for an artifact
router.get('/:integrationId/artifacts/:artifactType/:artifactId/issues', async (req, res) => {
  try {
    const { artifactType, artifactId } = req.params;

    if (artifactType !== 'prd' && artifactType !== 'generated_artifact') {
      return res.status(400).json({ error: 'Invalid artifactType' });
    }

    const links = await issueCreationService.getLinkedIssues(
      artifactType as 'prd' | 'generated_artifact',
      parseInt(artifactId)
    );

    res.json(links);
  } catch (error) {
    console.error('Error getting linked issues:', error);
    res.status(500).json({ error: 'Failed to get linked issues' });
  }
});

export default router;
