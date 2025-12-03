import { Router } from 'express';
import { codeChatService } from '../services/codeChat.js';

const router = Router();

// Get available code-related knowledge bases
router.get('/knowledge-bases', async (req, res) => {
  try {
    const knowledgeBases = await codeChatService.getCodeKnowledgeBases();
    res.json(knowledgeBases);
  } catch (error) {
    console.error('Error fetching code knowledge bases:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge bases' });
  }
});

// List all chat sessions
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const sessions = await codeChatService.listSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Error listing chat sessions:', error);
    res.status(500).json({ error: 'Failed to list chat sessions' });
  }
});

// Create a new chat session
router.post('/sessions', async (req, res) => {
  try {
    const { userId, knowledgeBaseIds, title } = req.body;

    if (!knowledgeBaseIds || !Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
      return res.status(400).json({ error: 'At least one knowledge base must be selected' });
    }

    const session = await codeChatService.createSession({
      userId,
      knowledgeBaseIds,
      title,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating chat session:', error);
    const message = error instanceof Error ? error.message : 'Failed to create chat session';
    res.status(500).json({ error: message });
  }
});

// Get a specific chat session with messages
router.get('/sessions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await codeChatService.getSession(id);

    if (!result) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting chat session:', error);
    res.status(500).json({ error: 'Failed to get chat session' });
  }
});

// Delete a chat session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await codeChatService.deleteSession(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ error: 'Failed to delete chat session' });
  }
});

// Update session knowledge bases
router.patch('/sessions/:id/knowledge-bases', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { knowledgeBaseIds } = req.body;

    if (!knowledgeBaseIds || !Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
      return res.status(400).json({ error: 'At least one knowledge base must be selected' });
    }

    const session = await codeChatService.updateSessionKnowledgeBases(id, knowledgeBaseIds);

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error updating session knowledge bases:', error);
    const message = error instanceof Error ? error.message : 'Failed to update session';
    res.status(500).json({ error: message });
  }
});

// Send a message to the chat session
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const result = await codeChatService.sendMessage(id, content.trim());

    res.status(201).json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    const message = error instanceof Error ? error.message : 'Failed to send message';
    res.status(500).json({ error: message });
  }
});

export default router;
