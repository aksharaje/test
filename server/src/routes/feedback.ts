import { Router } from 'express';
import { feedbackService } from '../services/feedback.js';

const router = Router();

/**
 * Submit feedback for an execution
 * POST /api/executions/:executionId/feedback
 */
router.post('/executions/:executionId/feedback', async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId);
    const { sentiment, text, userId } = req.body;

    if (!sentiment || !['positive', 'negative'].includes(sentiment)) {
      return res.status(400).json({ error: 'sentiment must be "positive" or "negative"' });
    }

    const feedback = await feedbackService.submitFeedback({
      executionId,
      sentiment,
      text,
      userId,
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * Get feedback for an execution
 * GET /api/executions/:executionId/feedback
 */
router.get('/executions/:executionId/feedback', async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId);
    const feedback = await feedbackService.getFeedbackForExecution(executionId);
    res.json(feedback);
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * Analyze feedback for factual content
 * POST /api/feedback/:id/analyze
 */
router.post('/feedback/:id/analyze', async (req, res) => {
  try {
    const feedbackId = parseInt(req.params.id);
    const analysis = await feedbackService.analyzeFeedbackForFacts(feedbackId);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing feedback:', error);
    res.status(500).json({ error: 'Failed to analyze feedback' });
  }
});

/**
 * Approve an extracted fact and add to knowledge base
 * POST /api/facts/:id/approve
 */
router.post('/facts/:id/approve', async (req, res) => {
  try {
    const factId = parseInt(req.params.id);
    const { knowledgeBaseId } = req.body;

    if (!knowledgeBaseId) {
      return res.status(400).json({ error: 'knowledgeBaseId is required' });
    }

    await feedbackService.approveFact(factId, knowledgeBaseId);
    res.json({ success: true, message: 'Fact approved and added to knowledge base' });
  } catch (error) {
    console.error('Error approving fact:', error);
    res.status(500).json({ error: 'Failed to approve fact' });
  }
});

/**
 * Reject an extracted fact
 * POST /api/facts/:id/reject
 */
router.post('/facts/:id/reject', async (req, res) => {
  try {
    const factId = parseInt(req.params.id);
    await feedbackService.rejectFact(factId);
    res.json({ success: true, message: 'Fact rejected' });
  } catch (error) {
    console.error('Error rejecting fact:', error);
    res.status(500).json({ error: 'Failed to reject fact' });
  }
});

/**
 * Get an extracted fact by ID
 * GET /api/facts/:id
 */
router.get('/facts/:id', async (req, res) => {
  try {
    const factId = parseInt(req.params.id);
    const fact = await feedbackService.getExtractedFact(factId);

    if (!fact) {
      return res.status(404).json({ error: 'Fact not found' });
    }

    res.json(fact);
  } catch (error) {
    console.error('Error getting fact:', error);
    res.status(500).json({ error: 'Failed to get fact' });
  }
});

/**
 * Get all pending extracted facts
 * GET /api/facts/pending
 */
router.get('/facts/pending', async (req, res) => {
  try {
    const facts = await feedbackService.getPendingFacts();
    res.json(facts);
  } catch (error) {
    console.error('Error getting pending facts:', error);
    res.status(500).json({ error: 'Failed to get pending facts' });
  }
});

export default router;
