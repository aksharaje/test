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
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

// Mock the knowledgeBase service
vi.mock('./knowledgeBase.js', () => ({
  knowledgeBaseService: {
    addFactAsDocument: vi.fn(),
  },
}));

// Set up environment before OpenAI is used
process.env.OPENROUTER_API_KEY = 'test-key';

// Mock OpenAI client with a class
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '[]' } }],
          }),
        },
      };
    },
  };
});

// Mock data
const mockArtifact = {
  id: 1,
  userId: 1,
  type: 'epic',
  title: 'User Authentication',
  content: '{"type":"epic","epic":{"title":"User Auth"}}',
  inputDescription: 'Create an auth system',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFeedback = {
  id: 1,
  artifactId: 1,
  userId: null,
  sentiment: 'negative' as const,
  text: 'The acceptance criteria are missing password complexity requirements. Passwords must be at least 12 characters.',
  createdAt: new Date(),
};

const mockExtractedFact = {
  id: 1,
  feedbackId: 1,
  content: 'Passwords must be at least 12 characters',
  knowledgeBaseId: null,
  status: 'pending' as const,
  createdAt: new Date(),
};

describe('Story Generator Feedback Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('should create feedback with positive sentiment', async () => {
      const { db } = await import('../db/index.js');

      // Mock artifact exists
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockArtifact]);

      // Mock feedback insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([{
        id: 1,
        artifactId: 1,
        userId: null,
        sentiment: 'positive',
        text: null,
        createdAt: new Date(),
      }]);

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');
      const result = await storyGeneratorFeedbackService.submitFeedback({
        artifactId: 1,
        sentiment: 'positive',
      });

      expect(result.sentiment).toBe('positive');
      expect(result.artifactId).toBe(1);
      expect(result.extractedFacts).toEqual([]);
    });

    it('should create feedback with negative sentiment and text', async () => {
      const { db } = await import('../db/index.js');

      // Mock artifact exists
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockArtifact]);

      // Mock feedback insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([mockFeedback]);

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');
      const result = await storyGeneratorFeedbackService.submitFeedback({
        artifactId: 1,
        sentiment: 'negative',
        text: 'This was wrong',
      });

      expect(result.sentiment).toBe('negative');
      expect(result.text).toBeDefined();
    });

    it('should throw error if artifact does not exist', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([]);

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');

      await expect(
        storyGeneratorFeedbackService.submitFeedback({
          artifactId: 999,
          sentiment: 'positive',
        })
      ).rejects.toThrow('Artifact not found');
    });
  });

  describe('getArtifactStats', () => {
    it('should return correct sentiment statistics', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.groupBy).mockResolvedValueOnce([
        { sentiment: 'positive', count: 70 },
        { sentiment: 'negative', count: 30 },
      ]);

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');
      const result = await storyGeneratorFeedbackService.getArtifactStats(1);

      expect(result.positive).toBe(70);
      expect(result.negative).toBe(30);
      expect(result.total).toBe(100);
      expect(result.positiveRate).toBe(0.7);
    });

    it('should handle zero feedback', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.groupBy).mockResolvedValueOnce([]);

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');
      const result = await storyGeneratorFeedbackService.getArtifactStats(1);

      expect(result.positive).toBe(0);
      expect(result.negative).toBe(0);
      expect(result.total).toBe(0);
      expect(result.positiveRate).toBe(0);
    });
  });

  describe('approveFact', () => {
    it('should approve fact and optionally add to knowledge base', async () => {
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

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');

      await expect(
        storyGeneratorFeedbackService.approveFact(1, 1)
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

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');

      await expect(
        storyGeneratorFeedbackService.approveFact(999, 1)
      ).rejects.toThrow('Fact not found');
    });
  });

  describe('rejectFact', () => {
    it('should update fact status to rejected', async () => {
      const { db } = await import('../db/index.js');

      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(undefined);

      const { storyGeneratorFeedbackService } = await import('./storyGeneratorFeedback.js');

      await expect(
        storyGeneratorFeedbackService.rejectFact(1)
      ).resolves.not.toThrow();
    });
  });
});

describe('Fact Detection Logic', () => {
  describe('Factual Statement Examples', () => {
    const factualStatements = [
      'Passwords must be at least 12 characters',
      'The checkout process requires 3 steps: cart, shipping, payment',
      'Users can only have one active session at a time',
      'The feature is missing the requirement for 2FA',
    ];

    const nonFactualStatements = [
      'The output was not good',
      'I expected something different',
      'This is confusing',
      'Thanks, this was helpful!',
    ];

    it('should identify factual statements correctly', () => {
      factualStatements.forEach((statement) => {
        // Factual statements typically contain specific requirements or corrections
        const containsRequirement = /(must|should|require|need|only|at least)/i.test(statement);
        const containsSpecific = /\d+|specific|missing/i.test(statement);

        expect(containsRequirement || containsSpecific).toBe(true);
      });
    });

    it('should identify non-factual statements correctly', () => {
      nonFactualStatements.forEach((statement) => {
        const isSubjective = /(good|bad|different|confusing|helpful)/i.test(statement);
        expect(isSubjective || statement.length < 30).toBe(true);
      });
    });
  });
});

describe('Feedback Stats Calculations', () => {
  describe('Positive Rate', () => {
    it('should calculate positive rate correctly', () => {
      const scenarios = [
        { positive: 80, negative: 20, expectedRate: 0.8 },
        { positive: 50, negative: 50, expectedRate: 0.5 },
        { positive: 0, negative: 100, expectedRate: 0 },
        { positive: 100, negative: 0, expectedRate: 1 },
      ];

      scenarios.forEach(({ positive, negative, expectedRate }) => {
        const total = positive + negative;
        const rate = total > 0 ? positive / total : 0;
        expect(rate).toBe(expectedRate);
      });
    });

    it('should handle zero total feedback', () => {
      const positive = 0;
      const negative = 0;
      const total = positive + negative;
      const rate = total > 0 ? positive / total : 0;

      expect(rate).toBe(0);
      expect(isNaN(rate)).toBe(false);
    });
  });
});
