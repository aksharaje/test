import { Router } from 'express';
import { agentService } from '../services/agent.js';

const router = Router();

// Create a new agent
router.post('/', async (req, res) => {
  try {
    const { name, description, systemPrompt, model, tools } = req.body;

    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'name and systemPrompt are required' });
    }

    const agent = await agentService.createAgent({
      name,
      description,
      systemPrompt,
      model,
      tools,
    });

    res.status(201).json(agent);
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// List all agents
router.get('/', async (req, res) => {
  try {
    const agents = await agentService.listAgents();
    res.json(agents);
  } catch (error) {
    console.error('Error listing agents:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// Get a specific agent
router.get('/:id', async (req, res) => {
  try {
    const agent = await agentService.getAgent(parseInt(req.params.id));
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (error) {
    console.error('Error getting agent:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// Start a new conversation with an agent
router.post('/:id/conversations', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { title } = req.body;

    const conversation = await agentService.startConversation(agentId, title);
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Get a conversation with messages
router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const conversation = await agentService.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Send a message to a conversation
router.post('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await agentService.sendMessage(conversationId, message);
    res.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Execute an agent (with A/B test support)
router.post('/:id/execute', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const result = await agentService.executeAgent(agentId, prompt);
    res.json(result);
  } catch (error) {
    console.error('Error executing agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to execute agent';
    res.status(500).json({ error: message });
  }
});

// Get an execution by ID
router.get('/executions/:executionId', async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId);
    const execution = await agentService.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error) {
    console.error('Error getting execution:', error);
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

export default router;
