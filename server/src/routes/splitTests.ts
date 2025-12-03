import { Router } from 'express';
import { splitTestService } from '../services/splitTest.js';

const router = Router();

// ==================
// PROMPT VERSIONS
// ==================

/**
 * Create a new prompt version for an agent
 * POST /api/agents/:agentId/versions
 */
router.post('/agents/:agentId/versions', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { systemPrompt, model, status } = req.body;

    if (!systemPrompt) {
      return res.status(400).json({ error: 'systemPrompt is required' });
    }

    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }

    const version = await splitTestService.createPromptVersion({
      agentId,
      systemPrompt,
      model,
      status,
    });

    res.status(201).json(version);
  } catch (error) {
    console.error('Error creating prompt version:', error);
    res.status(500).json({ error: 'Failed to create prompt version' });
  }
});

/**
 * List all prompt versions for an agent
 * GET /api/agents/:agentId/versions
 */
router.get('/agents/:agentId/versions', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const versions = await splitTestService.listPromptVersions(agentId);
    res.json(versions);
  } catch (error) {
    console.error('Error listing prompt versions:', error);
    res.status(500).json({ error: 'Failed to list prompt versions' });
  }
});

/**
 * Get a specific prompt version
 * GET /api/agents/:agentId/versions/:versionId
 */
router.get('/agents/:agentId/versions/:versionId', async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const version = await splitTestService.getPromptVersion(versionId);

    if (!version) {
      return res.status(404).json({ error: 'Prompt version not found' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error getting prompt version:', error);
    res.status(500).json({ error: 'Failed to get prompt version' });
  }
});

/**
 * Update a prompt version
 * PATCH /api/agents/:agentId/versions/:versionId
 */
router.patch('/agents/:agentId/versions/:versionId', async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const { systemPrompt, model, status } = req.body;

    const version = await splitTestService.updatePromptVersion(versionId, {
      systemPrompt,
      model,
      status,
    });

    if (!version) {
      return res.status(404).json({ error: 'Prompt version not found' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error updating prompt version:', error);
    res.status(500).json({ error: 'Failed to update prompt version' });
  }
});

// ==================
// SPLIT TESTS
// ==================

/**
 * Create a new split test (A/B test)
 * POST /api/agents/:agentId/split-tests
 */
router.post('/agents/:agentId/split-tests', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { name, description, promptVersionIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!promptVersionIds || !Array.isArray(promptVersionIds) || promptVersionIds.length < 2) {
      return res.status(400).json({ error: 'promptVersionIds must be an array with at least 2 versions' });
    }

    const splitTest = await splitTestService.createSplitTest({
      agentId,
      name,
      description,
      promptVersionIds,
    });

    res.status(201).json(splitTest);
  } catch (error) {
    console.error('Error creating split test:', error);
    const message = error instanceof Error ? error.message : 'Failed to create split test';
    res.status(500).json({ error: message });
  }
});

/**
 * List all split tests for an agent
 * GET /api/agents/:agentId/split-tests
 */
router.get('/agents/:agentId/split-tests', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const tests = await splitTestService.listSplitTests(agentId);
    res.json(tests);
  } catch (error) {
    console.error('Error listing split tests:', error);
    res.status(500).json({ error: 'Failed to list split tests' });
  }
});

/**
 * Get a split test with statistics
 * GET /api/agents/:agentId/split-tests/:testId
 */
router.get('/agents/:agentId/split-tests/:testId', async (req, res) => {
  try {
    const testId = parseInt(req.params.testId);
    const test = await splitTestService.getSplitTest(testId);

    if (!test) {
      return res.status(404).json({ error: 'Split test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('Error getting split test:', error);
    res.status(500).json({ error: 'Failed to get split test' });
  }
});

/**
 * Update split test status
 * PATCH /api/agents/:agentId/split-tests/:testId
 */
router.patch('/agents/:agentId/split-tests/:testId', async (req, res) => {
  try {
    const testId = parseInt(req.params.testId);
    const { status } = req.body;

    if (!status || !['active', 'completed', 'paused'].includes(status)) {
      return res.status(400).json({ error: 'status must be "active", "completed", or "paused"' });
    }

    const test = await splitTestService.updateSplitTestStatus(testId, status);

    if (!test) {
      return res.status(404).json({ error: 'Split test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('Error updating split test:', error);
    res.status(500).json({ error: 'Failed to update split test' });
  }
});

/**
 * Get the active split test for an agent
 * GET /api/agents/:agentId/split-tests/active
 */
router.get('/agents/:agentId/split-tests/active', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const test = await splitTestService.getActiveSplitTest(agentId);

    if (!test) {
      return res.status(404).json({ error: 'No active split test found' });
    }

    res.json(test);
  } catch (error) {
    console.error('Error getting active split test:', error);
    res.status(500).json({ error: 'Failed to get active split test' });
  }
});

export default router;
