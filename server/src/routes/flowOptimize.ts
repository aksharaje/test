import { Router, Request, Response } from 'express';
import { flowOptimizeService } from '../services/flowOptimize.js';

const router = Router();

// GET /api/optimize/flows - Get all flows with stats
router.get('/flows', async (_req: Request, res: Response) => {
  try {
    const flows = await flowOptimizeService.getAllFlowsWithStats();
    res.json(flows);
  } catch (error) {
    console.error('Get flows error:', error);
    res.status(500).json({ error: 'Failed to get flows' });
  }
});

// GET /api/optimize/flows/:flowId - Get flow details
router.get('/flows/:flowId', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const details = await flowOptimizeService.getFlowDetails(flowId);
    res.json(details);
  } catch (error) {
    console.error('Get flow details error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get flow details';

    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
});

// POST /api/optimize/flows/:flowId/generate - Generate optimized prompt
router.post('/flows/:flowId/generate', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const optimization = await flowOptimizeService.generateOptimizedPrompt(flowId);
    res.json(optimization);
  } catch (error) {
    console.error('Generate optimization error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate optimization';
    res.status(500).json({ error: message });
  }
});

// POST /api/optimize/flows/:flowId/save - Save optimized prompt as draft
router.post('/flows/:flowId/save', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const version = await flowOptimizeService.saveOptimizedPrompt(flowId, prompt.trim());
    res.status(201).json(version);
  } catch (error) {
    console.error('Save optimization error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save optimization';
    res.status(500).json({ error: message });
  }
});

// POST /api/optimize/flows/:flowId/activate/:versionId - Activate a version
router.post('/flows/:flowId/activate/:versionId', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const versionId = parseInt(req.params.versionId);

    if (isNaN(versionId)) {
      return res.status(400).json({ error: 'Invalid version ID' });
    }

    const version = await flowOptimizeService.activateVersion(flowId, versionId);
    res.json(version);
  } catch (error) {
    console.error('Activate version error:', error);
    const message = error instanceof Error ? error.message : 'Failed to activate version';

    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
});

// POST /api/optimize/flows/:flowId/split-test - Create a split test
router.post('/flows/:flowId/split-test', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const { name, versionIds } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!Array.isArray(versionIds) || versionIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 version IDs are required for A/B testing' });
    }

    const splitTest = await flowOptimizeService.createSplitTest(
      flowId,
      name.trim(),
      versionIds.map(Number)
    );
    res.status(201).json(splitTest);
  } catch (error) {
    console.error('Create split test error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create split test';
    res.status(500).json({ error: message });
  }
});

// GET /api/optimize/flows/:flowId/feedback-summary - Get AI feedback summary
router.get('/flows/:flowId/feedback-summary', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const summary = await flowOptimizeService.generateFeedbackSummary(flowId);
    res.json({ summary });
  } catch (error) {
    console.error('Generate feedback summary error:', error);
    res.status(500).json({ error: 'Failed to generate feedback summary' });
  }
});

// GET /api/optimize/flows/:flowId/feedback - Get all feedback for a flow
router.get('/flows/:flowId/feedback', async (req: Request, res: Response) => {
  try {
    const flowId = decodeURIComponent(req.params.flowId);
    const feedback = await flowOptimizeService.getFlowFeedback(flowId);
    res.json(feedback);
  } catch (error) {
    console.error('Get flow feedback error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

export default router;
