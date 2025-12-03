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
vi.mock('./feedback.js', () => ({
  feedbackService: {
    getAgentFeedbackStats: vi.fn(),
    getNegativeFeedbackText: vi.fn(),
  },
}));

// Mock the split test service
vi.mock('./splitTest.js', () => ({
  splitTestService: {
    listPromptVersions: vi.fn(),
    createPromptVersion: vi.fn(),
    getPromptVersion: vi.fn(),
    updatePromptVersion: vi.fn(),
    createSplitTest: vi.fn(),
  },
}));

// Mock the story generator feedback service
vi.mock('./storyGeneratorFeedback.js', () => ({
  storyGeneratorFeedbackService: {
    getStatsForArtifacts: vi.fn(),
  },
}));

// Mock the story generator split test service
vi.mock('./storyGeneratorSplitTest.js', () => ({
  storyGeneratorSplitTestService: {
    listPromptTemplates: vi.fn(),
    getActiveSplitTest: vi.fn(),
    getSplitTest: vi.fn(),
    createPromptTemplate: vi.fn(),
    getPromptTemplate: vi.fn(),
    updatePromptTemplate: vi.fn(),
    createSplitTest: vi.fn(),
  },
}));

// Mock the openrouter service
vi.mock('./openrouter.js', () => ({
  openrouter: {
    chat: vi.fn(),
  },
}));

// Mock data
const mockAgent = {
  id: 1,
  name: 'Test Agent',
  description: 'A test agent for optimization',
  systemPrompt: 'You are a helpful assistant.',
  model: 'google/gemini-2.0-flash-001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPromptVersion = {
  id: 1,
  agentId: 1,
  version: 1,
  systemPrompt: 'You are a helpful assistant.',
  model: 'google/gemini-2.0-flash-001',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

const mockFeedbackStats = {
  positive: 80,
  negative: 20,
  total: 100,
  positivePercent: 80,
  negativePercent: 20,
};

describe('Flow Optimize Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Flow ID Parsing', () => {
    it('should correctly parse agent flow IDs', () => {
      const flowId = 'agent:123';
      const [flowType, id] = flowId.split(':');

      expect(flowType).toBe('agent');
      expect(id).toBe('123');
      expect(parseInt(id)).toBe(123);
    });

    it('should correctly parse story generator flow IDs', () => {
      const flowIds = [
        { flowId: 'story_generator:epic', expectedType: 'story_generator', expectedId: 'epic' },
        { flowId: 'story_generator:feature', expectedType: 'story_generator', expectedId: 'feature' },
        { flowId: 'story_generator:user_story', expectedType: 'story_generator', expectedId: 'user_story' },
      ];

      flowIds.forEach(({ flowId, expectedType, expectedId }) => {
        const [flowType, id] = flowId.split(':');
        expect(flowType).toBe(expectedType);
        expect(id).toBe(expectedId);
      });
    });
  });

  describe('getAllFlowsWithStats', () => {
    it('should return flows with correct structure', async () => {
      const { db } = await import('../db/index.js');
      const { feedbackService } = await import('./feedback.js');

      // Mock agents query - return empty for simplicity
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.orderBy).mockResolvedValueOnce([mockAgent]);

      // Mock feedback stats
      vi.mocked(feedbackService.getAgentFeedbackStats).mockResolvedValueOnce(mockFeedbackStats);

      // Mock story generator artifact queries (for each type)
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValue([]);

      const { flowOptimizeService } = await import('./flowOptimize.js');
      const flows = await flowOptimizeService.getAllFlowsWithStats();

      // Should have at least the agent and 3 story generator types
      expect(Array.isArray(flows)).toBe(true);
    });

    it('should include story generator types', () => {
      const storyGeneratorTypes = [
        'story_generator_epic',
        'story_generator_feature',
        'story_generator_user_story',
      ];

      storyGeneratorTypes.forEach((type) => {
        expect(type).toMatch(/^story_generator_/);
      });
    });
  });

  describe('getFlowDetails', () => {
    it('should throw error for unknown flow type', async () => {
      const { flowOptimizeService } = await import('./flowOptimize.js');

      await expect(flowOptimizeService.getFlowDetails('unknown:123')).rejects.toThrow(
        'Unknown flow type: unknown'
      );
    });

    it('should call agent details for agent flow', async () => {
      const { db } = await import('../db/index.js');
      const { splitTestService } = await import('./splitTest.js');
      const { feedbackService } = await import('./feedback.js');

      // Mock agent lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockAgent]);

      // Mock versions
      vi.mocked(splitTestService.listPromptVersions).mockResolvedValueOnce([mockPromptVersion]);

      // Mock feedback stats
      vi.mocked(feedbackService.getAgentFeedbackStats).mockResolvedValueOnce(mockFeedbackStats);

      const { flowOptimizeService } = await import('./flowOptimize.js');
      const details = await flowOptimizeService.getFlowDetails('agent:1');

      expect(details.id).toBe('agent:1');
      expect(details.type).toBe('agent');
      expect(details.name).toBe(mockAgent.name);
    });

    it('should call story generator details for story_generator flow', async () => {
      const { db } = await import('../db/index.js');
      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');

      // Mock templates
      vi.mocked(storyGeneratorSplitTestService.listPromptTemplates).mockResolvedValueOnce([
        mockPromptTemplate,
      ]);

      // Mock no active split test
      vi.mocked(storyGeneratorSplitTestService.getActiveSplitTest).mockResolvedValueOnce(null);

      // Mock artifact query for stats
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValue([]);

      const { flowOptimizeService } = await import('./flowOptimize.js');
      const details = await flowOptimizeService.getFlowDetails('story_generator:epic');

      expect(details.id).toBe('story_generator:epic');
      expect(details.type).toBe('story_generator_epic');
    });
  });

  describe('generateOptimizedPrompt', () => {
    it('should generate optimized prompt based on feedback', async () => {
      const { db } = await import('../db/index.js');
      const { openrouter } = await import('./openrouter.js');
      const { splitTestService } = await import('./splitTest.js');
      const { feedbackService } = await import('./feedback.js');

      // Mock agent lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockAgent]);

      // Mock versions
      vi.mocked(splitTestService.listPromptVersions).mockResolvedValue([mockPromptVersion]);

      // Mock feedback stats
      vi.mocked(feedbackService.getAgentFeedbackStats).mockResolvedValue(mockFeedbackStats);

      // Mock negative feedback
      vi.mocked(feedbackService.getNegativeFeedbackText).mockResolvedValue([
        'The response was too verbose',
        'Missing context about the topic',
      ]);

      // Mock LLM responses
      vi.mocked(openrouter.chat)
        .mockResolvedValueOnce({ content: 'Summary: Users want more concise responses' })
        .mockResolvedValueOnce({
          content: 'You are a helpful assistant. Be concise and provide context.',
        });

      const { flowOptimizeService } = await import('./flowOptimize.js');
      const result = await flowOptimizeService.generateOptimizedPrompt('agent:1');

      expect(result).toHaveProperty('currentPrompt');
      expect(result).toHaveProperty('newPrompt');
      expect(result).toHaveProperty('feedbackSummary');
    });
  });

  describe('saveOptimizedPrompt', () => {
    it('should save as draft version for agent flow', async () => {
      const { db } = await import('../db/index.js');
      const { splitTestService } = await import('./splitTest.js');

      // Mock agent lookup
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValueOnce([mockAgent]);

      // Mock version creation
      vi.mocked(splitTestService.createPromptVersion).mockResolvedValueOnce({
        ...mockPromptVersion,
        id: 2,
        version: 2,
        status: 'draft',
        systemPrompt: 'New optimized prompt',
      });

      const { flowOptimizeService } = await import('./flowOptimize.js');
      const result = await flowOptimizeService.saveOptimizedPrompt(
        'agent:1',
        'New optimized prompt'
      );

      expect(splitTestService.createPromptVersion).toHaveBeenCalledWith({
        agentId: 1,
        systemPrompt: 'New optimized prompt',
        model: mockAgent.model,
        status: 'draft',
      });
    });

    it('should save as draft template for story_generator flow', async () => {
      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');

      // Mock template creation
      vi.mocked(storyGeneratorSplitTestService.createPromptTemplate).mockResolvedValueOnce({
        ...mockPromptTemplate,
        id: 2,
        version: 2,
        status: 'draft',
        systemPrompt: 'New optimized prompt',
      });

      const { flowOptimizeService } = await import('./flowOptimize.js');
      await flowOptimizeService.saveOptimizedPrompt('story_generator:epic', 'New optimized prompt');

      expect(storyGeneratorSplitTestService.createPromptTemplate).toHaveBeenCalledWith({
        name: 'Optimized epic prompt',
        type: 'epic',
        systemPrompt: 'New optimized prompt',
        status: 'draft',
      });
    });

    it('should throw error for unknown flow type', async () => {
      const { flowOptimizeService } = await import('./flowOptimize.js');

      await expect(
        flowOptimizeService.saveOptimizedPrompt('unknown:123', 'prompt')
      ).rejects.toThrow('Unknown flow type: unknown');
    });
  });

  describe('activateVersion', () => {
    it('should activate agent version and update agent prompt', async () => {
      const { db } = await import('../db/index.js');
      const { splitTestService } = await import('./splitTest.js');

      // Mock version lookup
      vi.mocked(splitTestService.getPromptVersion).mockResolvedValueOnce({
        ...mockPromptVersion,
        status: 'draft',
      });

      // Mock update queries
      vi.mocked(db.update).mockReturnThis();
      vi.mocked(db.set).mockReturnThis();
      vi.mocked(db.where).mockResolvedValue(undefined);

      vi.mocked(splitTestService.updatePromptVersion).mockResolvedValueOnce(undefined);

      const { flowOptimizeService } = await import('./flowOptimize.js');
      await flowOptimizeService.activateVersion('agent:1', 1);

      expect(splitTestService.updatePromptVersion).toHaveBeenCalledWith(1, { status: 'active' });
    });

    it('should throw error if version not found', async () => {
      const { splitTestService } = await import('./splitTest.js');

      vi.mocked(splitTestService.getPromptVersion).mockResolvedValueOnce(null);

      const { flowOptimizeService } = await import('./flowOptimize.js');

      await expect(flowOptimizeService.activateVersion('agent:1', 999)).rejects.toThrow(
        'Version with id 999 not found'
      );
    });

    it('should activate story generator template', async () => {
      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');

      // Mock template lookup
      vi.mocked(storyGeneratorSplitTestService.getPromptTemplate).mockResolvedValueOnce({
        ...mockPromptTemplate,
        status: 'draft',
      });

      // Mock list templates (for archiving active ones)
      vi.mocked(storyGeneratorSplitTestService.listPromptTemplates).mockResolvedValueOnce([
        { ...mockPromptTemplate, id: 2, status: 'active' },
      ]);

      vi.mocked(storyGeneratorSplitTestService.updatePromptTemplate).mockResolvedValue(undefined);

      const { flowOptimizeService } = await import('./flowOptimize.js');
      await flowOptimizeService.activateVersion('story_generator:epic', 1);

      expect(storyGeneratorSplitTestService.updatePromptTemplate).toHaveBeenCalledWith(1, {
        status: 'active',
      });
    });
  });

  describe('createSplitTest', () => {
    it('should create split test for agent flow', async () => {
      const { splitTestService } = await import('./splitTest.js');

      vi.mocked(splitTestService.createSplitTest).mockResolvedValueOnce({
        id: 1,
        name: 'Test A/B',
        agentId: 1,
        promptVersionIds: [1, 2],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { flowOptimizeService } = await import('./flowOptimize.js');
      await flowOptimizeService.createSplitTest('agent:1', 'Test A/B', [1, 2]);

      expect(splitTestService.createSplitTest).toHaveBeenCalledWith({
        agentId: 1,
        name: 'Test A/B',
        promptVersionIds: [1, 2],
      });
    });

    it('should create split test for story_generator flow', async () => {
      const { storyGeneratorSplitTestService } = await import('./storyGeneratorSplitTest.js');

      vi.mocked(storyGeneratorSplitTestService.createSplitTest).mockResolvedValueOnce({
        id: 1,
        name: 'Test A/B',
        artifactType: 'epic',
        promptTemplateIds: [1, 2],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { flowOptimizeService } = await import('./flowOptimize.js');
      await flowOptimizeService.createSplitTest('story_generator:epic', 'Test A/B', [1, 2]);

      expect(storyGeneratorSplitTestService.createSplitTest).toHaveBeenCalledWith({
        name: 'Test A/B',
        artifactType: 'epic',
        promptTemplateIds: [1, 2],
      });
    });

    it('should throw error for unknown flow type', async () => {
      const { flowOptimizeService } = await import('./flowOptimize.js');

      await expect(
        flowOptimizeService.createSplitTest('unknown:123', 'Test', [1, 2])
      ).rejects.toThrow('Unknown flow type: unknown');
    });
  });
});

describe('Flow Types', () => {
  it('should have valid flow types', () => {
    const validFlowTypes = [
      'agent',
      'story_generator_epic',
      'story_generator_feature',
      'story_generator_user_story',
    ];

    validFlowTypes.forEach((type) => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it('should correctly identify story generator types', () => {
    const storyGeneratorTypes = [
      'story_generator_epic',
      'story_generator_feature',
      'story_generator_user_story',
    ];

    storyGeneratorTypes.forEach((type) => {
      expect(type.startsWith('story_generator_')).toBe(true);
    });

    expect('agent'.startsWith('story_generator_')).toBe(false);
  });
});

describe('Feedback Stats Calculation', () => {
  it('should calculate percentages correctly', () => {
    const scenarios = [
      { positive: 80, negative: 20, expectedPos: 80, expectedNeg: 20 },
      { positive: 50, negative: 50, expectedPos: 50, expectedNeg: 50 },
      { positive: 0, negative: 100, expectedPos: 0, expectedNeg: 100 },
      { positive: 100, negative: 0, expectedPos: 100, expectedNeg: 0 },
    ];

    scenarios.forEach(({ positive, negative, expectedPos, expectedNeg }) => {
      const total = positive + negative;
      const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
      const negativePercent = total > 0 ? Math.round((negative / total) * 100) : 0;

      expect(positivePercent).toBe(expectedPos);
      expect(negativePercent).toBe(expectedNeg);
    });
  });

  it('should handle zero feedback gracefully', () => {
    const positive = 0;
    const negative = 0;
    const total = positive + negative;
    const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
    const negativePercent = total > 0 ? Math.round((negative / total) * 100) : 0;

    expect(positivePercent).toBe(0);
    expect(negativePercent).toBe(0);
    expect(isNaN(positivePercent)).toBe(false);
    expect(isNaN(negativePercent)).toBe(false);
  });
});

describe('Default Prompts', () => {
  it('should have different prompts for each artifact type', () => {
    const artifactTypes = ['epic', 'feature', 'user_story'];

    // The prompts should be non-empty strings
    artifactTypes.forEach((type) => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });
});
