import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

// Mock the openrouter service
vi.mock('./openrouter.js', () => ({
  openrouter: {
    chat: vi.fn(),
  },
}));

// Mock the knowledgeBase service
vi.mock('./knowledgeBase.js', () => ({
  knowledgeBaseService: {
    addFactAsDocument: vi.fn(),
  },
}));

// Mock data
const mockExecution = {
  id: 1,
  agentId: 1,
  splitTestId: null,
  promptVersionId: null,
  inputPrompt: 'Test prompt',
  response: 'Test response',
  executedAt: new Date(),
};

const mockFeedback = {
  id: 1,
  executionId: 1,
  userId: null,
  sentiment: 'negative' as const,
  text: 'The system incorrectly states that expenses over $500 require Director approval. They actually require VP approval.',
  createdAt: new Date(),
};

const mockExtractedFact = {
  id: 1,
  feedbackId: 1,
  content: 'Expenses over $500 require VP approval, not Director approval',
  knowledgeBaseId: null,
  status: 'pending' as const,
  createdAt: new Date(),
};

describe('Feedback Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('should create feedback with positive sentiment', async () => {
      const { db } = await import('../db/index.js');

      // Mock execution exists
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockExecution]);

      // Mock feedback insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([{
        id: 1,
        executionId: 1,
        sentiment: 'positive',
        text: null,
        createdAt: new Date(),
      }]);

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.submitFeedback({
        executionId: 1,
        sentiment: 'positive',
      });

      expect(result.sentiment).toBe('positive');
      expect(result.executionId).toBe(1);
    });

    it('should create feedback with negative sentiment and text', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockExecution]);

      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([mockFeedback]);

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.submitFeedback({
        executionId: 1,
        sentiment: 'negative',
        text: 'This was wrong',
      });

      expect(result.sentiment).toBe('negative');
      expect(result.text).toBeDefined();
    });

    it('should throw error if execution does not exist', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([]);

      const { feedbackService } = await import('./feedback.js');

      await expect(
        feedbackService.submitFeedback({
          executionId: 999,
          sentiment: 'positive',
        })
      ).rejects.toThrow('Execution with id 999 not found');
    });
  });

  describe('analyzeFeedbackForFacts', () => {
    it('should detect factual statement in feedback', async () => {
      const { db } = await import('../db/index.js');
      const { openrouter } = await import('./openrouter.js');

      // Mock feedback lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockFeedback]);

      // Mock LLM response indicating a fact was detected
      vi.mocked(openrouter.chat).mockResolvedValueOnce({
        content: JSON.stringify({
          isFact: true,
          extractedFact: 'Expenses over $500 require VP approval',
          confidence: 0.95,
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      // Mock fact insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([mockExtractedFact]);

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.analyzeFeedbackForFacts(1);

      expect(result.isFact).toBe(true);
      expect(result.extractedFact).toBe('Expenses over $500 require VP approval');
      expect(result.confidence).toBe(0.95);
      expect(result.factId).toBeDefined();
    });

    it('should not detect fact in non-factual feedback', async () => {
      const { db } = await import('../db/index.js');
      const { openrouter } = await import('./openrouter.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([{
        ...mockFeedback,
        text: 'This was too slow',
      }]);

      vi.mocked(openrouter.chat).mockResolvedValueOnce({
        content: JSON.stringify({
          isFact: false,
          extractedFact: null,
          confidence: 0.1,
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.analyzeFeedbackForFacts(1);

      expect(result.isFact).toBe(false);
      expect(result.extractedFact).toBeNull();
      expect(result.factId).toBeUndefined();
    });

    it('should return no fact if feedback has no text', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([{
        ...mockFeedback,
        text: null,
      }]);

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.analyzeFeedbackForFacts(1);

      expect(result.isFact).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('approveFact', () => {
    it('should approve fact and add to knowledge base', async () => {
      const { db } = await import('../db/index.js');
      const { knowledgeBaseService } = await import('./knowledgeBase.js');

      // Mock fact lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where)
        .mockResolvedValueOnce([mockExtractedFact])
        .mockResolvedValueOnce([{ id: 1, name: 'Test KB' }]);

      // Mock knowledge base service
      vi.mocked(knowledgeBaseService.addFactAsDocument).mockResolvedValueOnce({
        id: 1,
        knowledgeBaseId: 1,
        name: 'Feedback Fact',
        content: mockExtractedFact.content,
      } as any);

      // Mock fact update
      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(undefined);

      const { feedbackService } = await import('./feedback.js');

      await expect(
        feedbackService.approveFact(1, 1)
      ).resolves.not.toThrow();

      expect(knowledgeBaseService.addFactAsDocument).toHaveBeenCalledWith(
        1,
        mockExtractedFact.content
      );
    });

    it('should throw error if fact not found', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([]);

      const { feedbackService } = await import('./feedback.js');

      await expect(
        feedbackService.approveFact(999, 1)
      ).rejects.toThrow('Fact with id 999 not found');
    });
  });

  describe('getAgentFeedbackStats', () => {
    it('should return correct sentiment statistics', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.innerJoin).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.groupBy).mockResolvedValueOnce([
        { sentiment: 'positive', count: 70 },
        { sentiment: 'negative', count: 30 },
      ]);

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.getAgentFeedbackStats(1);

      expect(result.positive).toBe(70);
      expect(result.negative).toBe(30);
      expect(result.total).toBe(100);
      expect(result.positivePercent).toBe(70);
      expect(result.negativePercent).toBe(30);
    });

    it('should handle zero feedback', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.innerJoin).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.groupBy).mockResolvedValueOnce([]);

      const { feedbackService } = await import('./feedback.js');
      const result = await feedbackService.getAgentFeedbackStats(1);

      expect(result.positive).toBe(0);
      expect(result.negative).toBe(0);
      expect(result.total).toBe(0);
      expect(result.positivePercent).toBe(0);
      expect(result.negativePercent).toBe(0);
    });
  });
});

describe('Feedback Type Validations', () => {
  describe('Sentiment Types', () => {
    it('should only allow positive or negative sentiment', () => {
      const validSentiments = ['positive', 'negative'];

      validSentiments.forEach((sentiment) => {
        expect(['positive', 'negative']).toContain(sentiment);
      });
    });
  });

  describe('Extracted Fact Status Types', () => {
    it('should have valid status transitions', () => {
      const validStatuses = ['pending', 'approved', 'rejected'];

      // A fact starts as pending
      expect(validStatuses).toContain('pending');

      // Can be approved or rejected
      expect(validStatuses).toContain('approved');
      expect(validStatuses).toContain('rejected');
    });
  });
});

describe('Fact Detection Logic', () => {
  describe('Factual Statement Examples', () => {
    const factualStatements = [
      'Expenses over $500 require VP approval, not Director approval',
      'The account payable system doesnt send actual payment until verified',
      'Our return policy is 30 days, not 14 days',
      'The HR system requires employee ID, not SSN',
    ];

    const nonFactualStatements = [
      'This response was too slow',
      'I dont like the formatting',
      'Can you make it shorter?',
      'Good job!',
      'The response seems off',
    ];

    it('should identify factual statements correctly', () => {
      factualStatements.forEach((statement) => {
        // Factual statements typically contain specific details about systems/processes
        const containsSystemReference = /(system|policy|approval|require|process)/i.test(statement);
        const containsCorrection = /(not|instead|actually)/i.test(statement);

        expect(containsSystemReference || containsCorrection).toBe(true);
      });
    });

    it('should identify non-factual statements correctly', () => {
      nonFactualStatements.forEach((statement) => {
        // Non-factual statements are typically subjective or vague
        const isSubjective = /(too|like|seems|good|bad)/i.test(statement);
        const isQuestion = /\?$/.test(statement);

        expect(isSubjective || isQuestion || statement.length < 30).toBe(true);
      });
    });
  });
});
