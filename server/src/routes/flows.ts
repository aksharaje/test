import { Router } from 'express';
import { flowService } from '../services/flow.js';

const router = Router();

// Create a new flow
router.post('/', async (req, res) => {
  try {
    const { name, description, initialState, states } = req.body;

    if (!name || !initialState || !states) {
      return res.status(400).json({ error: 'name, initialState, and states are required' });
    }

    const flow = await flowService.createFlow({
      name,
      description,
      initialState,
      states,
    });

    res.status(201).json(flow);
  } catch (error) {
    console.error('Error creating flow:', error);
    const message = error instanceof Error ? error.message : 'Failed to create flow';
    res.status(500).json({ error: message });
  }
});

// List all flows
router.get('/', async (req, res) => {
  try {
    const flowsList = await flowService.listFlows();
    res.json(flowsList);
  } catch (error) {
    console.error('Error listing flows:', error);
    res.status(500).json({ error: 'Failed to list flows' });
  }
});

// Get a specific flow
router.get('/:id', async (req, res) => {
  try {
    const flow = await flowService.getFlow(parseInt(req.params.id));
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' });
    }
    res.json(flow);
  } catch (error) {
    console.error('Error getting flow:', error);
    res.status(500).json({ error: 'Failed to get flow' });
  }
});

// Start a new flow execution (trigger)
router.post('/:id/execute', async (req, res) => {
  try {
    const flowId = parseInt(req.params.id);
    const { context } = req.body;

    const execution = await flowService.startExecution(flowId, context || {});
    res.status(201).json(execution);
  } catch (error) {
    console.error('Error starting execution:', error);
    const message = error instanceof Error ? error.message : 'Failed to start execution';
    res.status(500).json({ error: message });
  }
});

// Get execution status
router.get('/executions/:executionId', async (req, res) => {
  try {
    const execution = await flowService.getExecution(parseInt(req.params.executionId));
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json(execution);
  } catch (error) {
    console.error('Error getting execution:', error);
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

// Send an event to a paused execution
router.post('/executions/:executionId/event', async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId);
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }

    const execution = await flowService.sendEvent(executionId, event, data || {});
    res.json(execution);
  } catch (error) {
    console.error('Error sending event:', error);
    const message = error instanceof Error ? error.message : 'Failed to send event';
    res.status(500).json({ error: message });
  }
});

export default router;
