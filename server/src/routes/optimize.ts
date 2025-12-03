import { Router } from 'express';
import { optimizeService } from '../services/optimize.js';

const router = Router();

/**
 * Get all agents with their feedback statistics
 * GET /api/optimize/agents
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await optimizeService.getAgentsWithStats();
    res.json(agents);
  } catch (error) {
    console.error('Error getting agents with stats:', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

/**
 * Get optimization details for a specific agent
 * GET /api/optimize/agents/:agentId
 */
router.get('/agents/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const details = await optimizeService.getOptimizationDetails(agentId);
    res.json(details);
  } catch (error) {
    console.error('Error getting optimization details:', error);
    const message = error instanceof Error ? error.message : 'Failed to get optimization details';
    res.status(500).json({ error: message });
  }
});

/**
 * Generate AI summary of feedback for an agent
 * GET /api/optimize/agents/:agentId/summary
 */
router.get('/agents/:agentId/summary', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const summary = await optimizeService.generateFeedbackSummary(agentId);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating feedback summary:', error);
    res.status(500).json({ error: 'Failed to generate feedback summary' });
  }
});

/**
 * Generate an optimized prompt based on feedback
 * POST /api/optimize/agents/:agentId/generate
 */
router.post('/agents/:agentId/generate', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const result = await optimizeService.generateOptimizedPrompt(agentId);
    res.json(result);
  } catch (error) {
    console.error('Error generating optimized prompt:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate optimized prompt';
    res.status(500).json({ error: message });
  }
});

/**
 * Save an optimized prompt as a new draft version
 * POST /api/optimize/agents/:agentId/save
 */
router.post('/agents/:agentId/save', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const version = await optimizeService.saveOptimizedPrompt(agentId, prompt);
    res.status(201).json(version);
  } catch (error) {
    console.error('Error saving optimized prompt:', error);
    const message = error instanceof Error ? error.message : 'Failed to save optimized prompt';
    res.status(500).json({ error: message });
  }
});

/**
 * Activate a prompt version (make it the default)
 * POST /api/optimize/versions/:versionId/activate
 */
router.post('/versions/:versionId/activate', async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const version = await optimizeService.activateVersion(versionId);
    res.json(version);
  } catch (error) {
    console.error('Error activating version:', error);
    const message = error instanceof Error ? error.message : 'Failed to activate version';
    res.status(500).json({ error: message });
  }
});

export default router;
