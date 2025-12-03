import { Router, Request, Response } from 'express';
import { storyGeneratorFeedbackService } from '../services/storyGeneratorFeedback.js';
import { storyGeneratorSplitTestService } from '../services/storyGeneratorSplitTest.js';

const router = Router();

// ==================
// FEEDBACK ROUTES
// ==================

// POST /api/story-generator/:id/feedback - Submit feedback for an artifact
router.post('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const artifactId = parseInt(req.params.id);
    const { sentiment, text, userId } = req.body;

    if (isNaN(artifactId)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    if (!sentiment || !['positive', 'negative'].includes(sentiment)) {
      return res.status(400).json({ error: 'Sentiment is required and must be positive or negative' });
    }

    const feedback = await storyGeneratorFeedbackService.submitFeedback({
      artifactId,
      sentiment,
      text: text || undefined,
      userId: userId ? parseInt(userId) : undefined,
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error('Submit feedback error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit feedback';

    if (message === 'Artifact not found') {
      return res.status(404).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
});

// GET /api/story-generator/:id/feedback - Get feedback for an artifact
router.get('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const artifactId = parseInt(req.params.id);

    if (isNaN(artifactId)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    const feedback = await storyGeneratorFeedbackService.getArtifactFeedback(artifactId);
    res.json(feedback);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

// GET /api/story-generator/:id/feedback/stats - Get feedback stats for an artifact
router.get('/:id/feedback/stats', async (req: Request, res: Response) => {
  try {
    const artifactId = parseInt(req.params.id);

    if (isNaN(artifactId)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    const stats = await storyGeneratorFeedbackService.getArtifactStats(artifactId);
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

// GET /api/story-generator/:id/feedback/summary - Get AI summary of feedback
router.get('/:id/feedback/summary', async (req: Request, res: Response) => {
  try {
    const artifactId = parseInt(req.params.id);

    if (isNaN(artifactId)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    const summary = await storyGeneratorFeedbackService.generateFeedbackSummary(artifactId);
    res.json({ summary });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// ==================
// EXTRACTED FACTS ROUTES
// ==================

// GET /api/story-generator/facts/pending - Get pending extracted facts
router.get('/facts/pending', async (_req: Request, res: Response) => {
  try {
    const facts = await storyGeneratorFeedbackService.getPendingFacts();
    res.json(facts);
  } catch (error) {
    console.error('Get pending facts error:', error);
    res.status(500).json({ error: 'Failed to get pending facts' });
  }
});

// POST /api/story-generator/facts/:id/approve - Approve a fact
router.post('/facts/:id/approve', async (req: Request, res: Response) => {
  try {
    const factId = parseInt(req.params.id);
    const { knowledgeBaseId } = req.body;

    if (isNaN(factId)) {
      return res.status(400).json({ error: 'Invalid fact ID' });
    }

    await storyGeneratorFeedbackService.approveFact(
      factId,
      knowledgeBaseId ? parseInt(knowledgeBaseId) : undefined
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Approve fact error:', error);
    const message = error instanceof Error ? error.message : 'Failed to approve fact';

    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
});

// POST /api/story-generator/facts/:id/reject - Reject a fact
router.post('/facts/:id/reject', async (req: Request, res: Response) => {
  try {
    const factId = parseInt(req.params.id);

    if (isNaN(factId)) {
      return res.status(400).json({ error: 'Invalid fact ID' });
    }

    await storyGeneratorFeedbackService.rejectFact(factId);
    res.json({ success: true });
  } catch (error) {
    console.error('Reject fact error:', error);
    res.status(500).json({ error: 'Failed to reject fact' });
  }
});

// ==================
// PROMPT TEMPLATE ROUTES
// ==================

// POST /api/story-generator/templates - Create a new prompt template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, type, systemPrompt, model, status } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!type || !['epic', 'feature', 'user_story'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be epic, feature, or user_story' });
    }

    if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
      return res.status(400).json({ error: 'System prompt is required' });
    }

    const template = await storyGeneratorSplitTestService.createPromptTemplate({
      name: name.trim(),
      type,
      systemPrompt: systemPrompt.trim(),
      model,
      status,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// GET /api/story-generator/templates - List prompt templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as 'epic' | 'feature' | 'user_story' | undefined;

    if (type && !['epic', 'feature', 'user_story'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type filter' });
    }

    const templates = await storyGeneratorSplitTestService.listPromptTemplates(type);
    res.json(templates);
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// GET /api/story-generator/templates/:id - Get a prompt template
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const template = await storyGeneratorSplitTestService.getPromptTemplate(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// PATCH /api/story-generator/templates/:id - Update a prompt template
router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, systemPrompt, model, status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const updateData: Parameters<typeof storyGeneratorSplitTestService.updatePromptTemplate>[1] = {};

    if (name !== undefined) updateData.name = name.trim();
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt.trim();
    if (model !== undefined) updateData.model = model;
    if (status !== undefined) {
      if (!['draft', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = status;
    }

    const template = await storyGeneratorSplitTestService.updatePromptTemplate(id, updateData);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ==================
// SPLIT TEST ROUTES
// ==================

// POST /api/story-generator/split-tests - Create a new split test
router.post('/split-tests', async (req: Request, res: Response) => {
  try {
    const { name, description, artifactType, promptTemplateIds } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!artifactType || !['epic', 'feature', 'user_story'].includes(artifactType)) {
      return res.status(400).json({ error: 'Invalid artifact type' });
    }

    if (!Array.isArray(promptTemplateIds) || promptTemplateIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 prompt template IDs are required' });
    }

    const test = await storyGeneratorSplitTestService.createSplitTest({
      name: name.trim(),
      description: description?.trim(),
      artifactType,
      promptTemplateIds: promptTemplateIds.map(Number),
    });

    res.status(201).json(test);
  } catch (error) {
    console.error('Create split test error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create split test';
    res.status(500).json({ error: message });
  }
});

// GET /api/story-generator/split-tests - List split tests
router.get('/split-tests', async (req: Request, res: Response) => {
  try {
    const artifactType = req.query.artifactType as 'epic' | 'feature' | 'user_story' | undefined;

    if (artifactType && !['epic', 'feature', 'user_story'].includes(artifactType)) {
      return res.status(400).json({ error: 'Invalid artifact type filter' });
    }

    const tests = await storyGeneratorSplitTestService.listSplitTests(artifactType);
    res.json(tests);
  } catch (error) {
    console.error('List split tests error:', error);
    res.status(500).json({ error: 'Failed to list split tests' });
  }
});

// GET /api/story-generator/split-tests/:id - Get a split test with stats
router.get('/split-tests/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid split test ID' });
    }

    const test = await storyGeneratorSplitTestService.getSplitTest(id);

    if (!test) {
      return res.status(404).json({ error: 'Split test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('Get split test error:', error);
    res.status(500).json({ error: 'Failed to get split test' });
  }
});

// PATCH /api/story-generator/split-tests/:id/status - Update split test status
router.patch('/split-tests/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid split test ID' });
    }

    if (!status || !['active', 'paused', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const test = await storyGeneratorSplitTestService.updateSplitTestStatus(id, status);

    if (!test) {
      return res.status(404).json({ error: 'Split test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('Update split test status error:', error);
    res.status(500).json({ error: 'Failed to update split test status' });
  }
});

// GET /api/story-generator/split-tests/active/:type - Get active split test for an artifact type
router.get('/split-tests/active/:type', async (req: Request, res: Response) => {
  try {
    const type = req.params.type as 'epic' | 'feature' | 'user_story';

    if (!['epic', 'feature', 'user_story'].includes(type)) {
      return res.status(400).json({ error: 'Invalid artifact type' });
    }

    const test = await storyGeneratorSplitTestService.getActiveSplitTest(type);

    if (!test) {
      return res.status(404).json({ error: 'No active split test for this type' });
    }

    res.json(test);
  } catch (error) {
    console.error('Get active split test error:', error);
    res.status(500).json({ error: 'Failed to get active split test' });
  }
});

export default router;
