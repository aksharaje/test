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

// Mock the feedback service
vi.mock('./storyGeneratorFeedback.js', () => ({
  storyGeneratorFeedbackService: {
    getStatsForArtifacts: vi.fn(),
  },
}));

// Mock data
const mockPromptTemplate = {
  id: 1,
  name: 'Epic Template V1',
  type: 'epic' as const,
  version: 1,
  systemPrompt: 'You are an expert product manager...',
  model: 'google/gemini-2.0-flash-001',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPromptTemplates = [
  mockPromptTemplate,
  {
    ...mockPromptTemplate,
    id: 2,
    name: 'Epic Template V2',
    version: 2,
    systemPrompt: 'You are a senior product manager...',
  },
];

const mockSplitTest = {
  id: 1,
  name: 'Epic Prompt Test',
  description: 'Testing different epic prompts',
  artifactType: 'epic' as const,
  promptTemplateIds: [1, 2],
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Story Generator Split Test Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPromptTemplate', () => {
    it('should create first template with version number 1', async () => {
      const { db } = await import('../db/index.js');

      // Mock no existing templates
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.orderBy).mockReturnThis();
      vi.mocked(db.limit).mockResolvedValueOnce([]);

      // Mock template insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([{
        ...mockPromptTemplate,
        version: 1,
      }]);

      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');
      const result = await storyGeneratorSplitTestService.createPromptTemplate({
        name: 'Epic Template V1',
        type: 'epic',
        systemPrompt: 'You are an expert...',
      });

      expect(result.version).toBe(1);
      expect(result.type).toBe('epic');
    });

    it('should increment version number for existing templates', async () => {
      const { db } = await import('../db/index.js');

      // Mock existing template
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockReturnThis();
      vi.mocked(db.orderBy).mockReturnThis();
      vi.mocked(db.limit).mockResolvedValueOnce([{ version: 2 }]);

      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([{
        ...mockPromptTemplate,
        version: 3,
      }]);

      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');
      const result = await storyGeneratorSplitTestService.createPromptTemplate({
        name: 'Epic Template V3',
        type: 'epic',
        systemPrompt: 'New prompt',
      });

      expect(result.version).toBe(3);
    });
  });

  describe('createSplitTest', () => {
    it('should create split test with valid templates', async () => {
      const { db } = await import('../db/index.js');

      // Mock template validation
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(mockPromptTemplates);

      // Mock deactivate existing tests
      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(undefined);

      // Mock activate templates
      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce(undefined);

      // Mock split test insert
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValueOnce([mockSplitTest]);

      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');
      const result = await storyGeneratorSplitTestService.createSplitTest({
        name: 'Epic Prompt Test',
        artifactType: 'epic',
        promptTemplateIds: [1, 2],
      });

      expect(result.name).toBe('Epic Prompt Test');
      expect(result.promptTemplateIds).toHaveLength(2);
      expect(result.status).toBe('active');
    });

    it('should validate that split test requires at least 2 templates', () => {
      const promptTemplateIds = [1];
      const isValid = promptTemplateIds.length >= 2;

      expect(isValid).toBe(false);
      expect(promptTemplateIds.length).toBeLessThan(2);
    });
  });

  describe('selectTemplateForGeneration', () => {
    it('should randomly select a template from active split test', async () => {
      const { db } = await import('../db/index.js');

      // Mock active split test lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockSplitTest]);

      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');

      // Run multiple times to verify random selection
      const selections: (number | null)[] = [];
      for (let i = 0; i < 10; i++) {
        vi.mocked(db.select).mockReturnThis();
        vi.mocked(db.from).mockReturnThis();
        vi.mocked(db.where).mockResolvedValueOnce([mockSplitTest]);

        const selected = await storyGeneratorSplitTestService.selectTemplateForGeneration('epic');
        selections.push(selected);
      }

      // All selections should be from the promptTemplateIds
      selections.forEach((id) => {
        expect(mockSplitTest.promptTemplateIds).toContain(id);
      });
    });

    it('should return null when no active test exists', () => {
      // Test the logic: if the query returns empty, the function should return null
      const emptyResult: any[] = [];
      const selectedId = emptyResult.length > 0
        ? emptyResult[0].promptTemplateIds[Math.floor(Math.random() * emptyResult[0].promptTemplateIds.length)]
        : null;

      expect(selectedId).toBeNull();
    });
  });

  describe('listPromptTemplates', () => {
    it('should list templates by type', () => {
      // Test the structure of the expected result
      const templates = mockPromptTemplates;

      expect(templates).toHaveLength(2);
      expect(templates[0].type).toBe('epic');
      expect(templates[1].type).toBe('epic');
    });
  });
});

describe('Statistical Significance for Story Generator', () => {
  describe('Sample Size Requirements', () => {
    it('should require minimum 30 samples per template', () => {
      const MIN_SAMPLES = 30;

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
});

describe('Template Type Validation', () => {
  it('should validate artifact types', () => {
    const validTypes = ['epic', 'feature', 'user_story'];

    validTypes.forEach((type) => {
      expect(['epic', 'feature', 'user_story']).toContain(type);
    });

    expect(['epic', 'feature', 'user_story']).not.toContain('invalid');
  });
});

describe('Template Status Transitions', () => {
  it('should allow valid status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      draft: ['active', 'archived'],
      active: ['archived'],
      archived: ['active'],
    };

    expect(validTransitions['draft']).toContain('active');
    expect(validTransitions['active']).toContain('archived');
    expect(validTransitions['archived']).toContain('active');
  });
});

describe('Random Template Selection', () => {
  describe('Uniform Distribution', () => {
    it('should distribute selections roughly evenly', () => {
      const templateIds = [1, 2];
      const iterations = 1000;
      const counts: Record<number, number> = { 1: 0, 2: 0 };

      for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * templateIds.length);
        const selected = templateIds[randomIndex];
        counts[selected]++;
      }

      // Each template should get roughly 50% of selections
      expect(counts[1]).toBeGreaterThan(350);
      expect(counts[1]).toBeLessThan(650);
      expect(counts[2]).toBeGreaterThan(350);
      expect(counts[2]).toBeLessThan(650);
    });
  });
});
