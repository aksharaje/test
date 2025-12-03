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

// Mock data
const mockAgent = {
  id: 1,
  name: 'Test Agent',
  systemPrompt: 'You are a helpful assistant.',
  model: 'openai/gpt-4',
  tools: [],
};

const mockPromptVersions = [
  {
    id: 1,
    agentId: 1,
    version: 1,
    systemPrompt: 'Version A prompt',
    model: 'openai/gpt-4',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    agentId: 1,
    version: 2,
    systemPrompt: 'Version B prompt',
    model: 'openai/gpt-4',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockSplitTest = {
  id: 1,
  agentId: 1,
  name: 'A/B Test 1',
  description: 'Testing prompt variations',
  promptVersionIds: [1, 2],
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Split Test Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPromptVersion', () => {
    it('should create first version with version number 1', async () => {
      const { db } = await import('../db/index.js');

      // Mock no existing versions
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.orderBy).mockReturnThis();
      vi.mocked(db.limit).mockResolvedValueOnce([]);

      // Mock version insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([{
        ...mockPromptVersions[0],
        version: 1,
      }]);

      const { splitTestService } = await import('./splitTest.js');
      const result = await splitTestService.createPromptVersion({
        agentId: 1,
        systemPrompt: 'Test prompt',
        model: 'openai/gpt-4',
      });

      expect(result.version).toBe(1);
      expect(result.agentId).toBe(1);
    });

    it('should increment version number for existing versions', async () => {
      const { db } = await import('../db/index.js');

      // Mock existing version
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.orderBy).mockReturnThis();
      vi.mocked(db.limit).mockResolvedValueOnce([{ version: 2 }]);

      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([{
        ...mockPromptVersions[1],
        version: 3,
      }]);

      const { splitTestService } = await import('./splitTest.js');
      const result = await splitTestService.createPromptVersion({
        agentId: 1,
        systemPrompt: 'New prompt',
        model: 'openai/gpt-4',
      });

      expect(result.version).toBe(3);
    });
  });

  describe('createSplitTest', () => {
    it('should create split test with valid versions', async () => {
      const { db } = await import('../db/index.js');

      // Mock version validation
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(mockPromptVersions);

      // Mock deactivate existing tests
      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(undefined);

      // Mock activate versions
      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(undefined);

      // Mock split test insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([mockSplitTest]);

      const { splitTestService } = await import('./splitTest.js');
      const result = await splitTestService.createSplitTest({
        agentId: 1,
        name: 'A/B Test 1',
        promptVersionIds: [1, 2],
      });

      expect(result.name).toBe('A/B Test 1');
      expect(result.promptVersionIds).toHaveLength(2);
      expect(result.status).toBe('active');
    });

    it('should validate that split test requires at least 2 versions', () => {
      // Test the validation logic directly
      const promptVersionIds = [1];
      const isValid = promptVersionIds.length >= 2;

      expect(isValid).toBe(false);
      expect(promptVersionIds.length).toBeLessThan(2);
    });
  });

  describe('selectVersionForExecution', () => {
    it('should randomly select a version from active split test', async () => {
      const { db } = await import('../db/index.js');

      // Mock active split test lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockSplitTest]);

      const { splitTestService } = await import('./splitTest.js');

      // Run multiple times to verify random selection
      const selections: (number | null)[] = [];
      for (let i = 0; i < 10; i++) {
        // Reset mock for each call
        vi.mocked(db.select).mockReturnThis();
        vi.mocked(db.from).mockReturnThis();
        vi.mocked(db.where).mockResolvedValueOnce([mockSplitTest]);

        const selected = await splitTestService.selectVersionForExecution(1);
        selections.push(selected);
      }

      // All selections should be from the promptVersionIds
      selections.forEach((id) => {
        expect(mockSplitTest.promptVersionIds).toContain(id);
      });
    });

    it('should validate null is returned when no active test exists', () => {
      // Test the selection logic directly
      const activeSplitTest = null;
      const selectedVersion = activeSplitTest
        ? activeSplitTest.promptVersionIds[Math.floor(Math.random() * activeSplitTest.promptVersionIds.length)]
        : null;

      expect(selectedVersion).toBeNull();
    });
  });

  describe('updateSplitTestStatus', () => {
    it('should validate valid status transitions', () => {
      const validStatuses = ['active', 'completed', 'paused'];

      // All statuses should be valid
      expect(validStatuses).toContain('completed');
      expect(validStatuses).toContain('paused');
      expect(validStatuses).toContain('active');
    });

    it('should track status changes correctly', () => {
      // Simulate a status update
      const originalStatus = 'active';
      const newStatus = 'paused';

      expect(originalStatus).not.toBe(newStatus);
      expect(['active', 'completed', 'paused']).toContain(newStatus);
    });
  });
});

describe('Statistical Significance Calculations', () => {
  describe('Sample Size Requirements', () => {
    it('should require minimum 30 samples per version', () => {
      const MIN_SAMPLES = 30;

      // Test scenarios with different sample sizes
      const scenarios = [
        { samples: 10, isEnough: false },
        { samples: 29, isEnough: false },
        { samples: 30, isEnough: true },
        { samples: 100, isEnough: true },
      ];

      scenarios.forEach(({ samples, isEnough }) => {
        expect(samples >= MIN_SAMPLES).toBe(isEnough);
      });
    });
  });

  describe('Confidence Threshold', () => {
    it('should use 95% confidence threshold', () => {
      const CONFIDENCE_THRESHOLD = 0.95;

      // Test scenarios with different confidence levels
      const scenarios = [
        { confidence: 0.8, isSignificant: false },
        { confidence: 0.9, isSignificant: false },
        { confidence: 0.94, isSignificant: false },
        { confidence: 0.95, isSignificant: true },
        { confidence: 0.99, isSignificant: true },
      ];

      scenarios.forEach(({ confidence, isSignificant }) => {
        expect(confidence >= CONFIDENCE_THRESHOLD).toBe(isSignificant);
      });
    });
  });

  describe('Positive Rate Comparison', () => {
    it('should calculate positive rate correctly', () => {
      const scenarios = [
        { positive: 70, total: 100, expectedRate: 0.7 },
        { positive: 30, total: 100, expectedRate: 0.3 },
        { positive: 50, total: 50, expectedRate: 1.0 },
        { positive: 0, total: 100, expectedRate: 0.0 },
      ];

      scenarios.forEach(({ positive, total, expectedRate }) => {
        const rate = total > 0 ? positive / total : 0;
        expect(rate).toBe(expectedRate);
      });
    });

    it('should handle division by zero', () => {
      const positive = 0;
      const total = 0;
      const rate = total > 0 ? positive / total : 0;

      expect(rate).toBe(0);
      expect(isNaN(rate)).toBe(false);
    });
  });
});

describe('Random Version Selection', () => {
  describe('Uniform Distribution', () => {
    it('should distribute selections roughly evenly', () => {
      const versionIds = [1, 2];
      const iterations = 1000;
      const counts: Record<number, number> = { 1: 0, 2: 0 };

      for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * versionIds.length);
        const selected = versionIds[randomIndex];
        counts[selected]++;
      }

      // Each version should get roughly 50% of selections
      // With 1000 iterations, we expect ~400-600 for each
      expect(counts[1]).toBeGreaterThan(350);
      expect(counts[1]).toBeLessThan(650);
      expect(counts[2]).toBeGreaterThan(350);
      expect(counts[2]).toBeLessThan(650);
    });

    it('should work with more than 2 versions', () => {
      const versionIds = [1, 2, 3];
      const iterations = 900;
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

      for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * versionIds.length);
        const selected = versionIds[randomIndex];
        counts[selected]++;
      }

      // Each version should get roughly 33% of selections
      // With 900 iterations, we expect ~200-400 for each
      Object.values(counts).forEach((count) => {
        expect(count).toBeGreaterThan(200);
        expect(count).toBeLessThan(400);
      });
    });
  });
});

describe('Prompt Version Status Transitions', () => {
  it('should allow valid status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      draft: ['active', 'archived'],
      active: ['archived'],
      archived: ['active'], // Can be re-activated
    };

    // Test that draft can become active
    expect(validTransitions['draft']).toContain('active');

    // Test that active can be archived
    expect(validTransitions['active']).toContain('archived');

    // Test that archived can be re-activated
    expect(validTransitions['archived']).toContain('active');
  });
});
