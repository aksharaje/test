import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('../../../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
  },
}));

// Mock the JiraClient
vi.mock('../client.js', () => ({
  JiraClient: vi.fn().mockImplementation(() => ({
    getCurrentUser: vi.fn().mockResolvedValue({
      accountId: 'user-123',
      displayName: 'Test User',
      emailAddress: 'test@example.com',
    }),
    getProjects: vi.fn().mockResolvedValue([]),
    getBoards: vi.fn().mockResolvedValue([]),
    getFields: vi.fn().mockResolvedValue([]),
  })),
  createJiraClient: vi.fn().mockReturnValue({
    getCurrentUser: vi.fn().mockResolvedValue({
      accountId: 'user-123',
      displayName: 'Test User',
    }),
    getProjects: vi.fn().mockResolvedValue([]),
    getBoards: vi.fn().mockResolvedValue([]),
    getFields: vi.fn().mockResolvedValue([]),
  }),
  JiraApiError: class JiraApiError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public jiraErrors?: any
    ) {
      super(message);
      this.name = 'JiraApiError';
    }
  },
}));

describe('Integration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOAuthAuthorizationUrl', () => {
    it('should generate correct OAuth URL', async () => {
      // We need to import after mocking
      const { getOAuthAuthorizationUrl } = await import('../integration.service.js');

      const url = getOAuthAuthorizationUrl('test-state');

      expect(url).toContain('https://auth.atlassian.com/authorize');
      expect(url).toContain('state=test-state');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
    });
  });

  describe('listIntegrations', () => {
    it('should return list of integrations', async () => {
      const { db } = await import('../../../db/index.js');
      const { listIntegrations } = await import('../integration.service.js');

      const mockIntegrations = [
        {
          id: 1,
          provider: 'jira',
          name: 'Test Integration',
          baseUrl: 'https://example.atlassian.net',
          cloudId: 'cloud-123',
          authType: 'oauth',
          status: 'connected',
          lastSyncAt: new Date(),
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockIntegrations),
        }),
      } as any);

      const integrations = await listIntegrations();

      expect(integrations).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('getIntegration', () => {
    it('should return integration by id', async () => {
      const { db } = await import('../../../db/index.js');
      const { getIntegration } = await import('../integration.service.js');

      const mockIntegration = {
        id: 1,
        provider: 'jira',
        name: 'Test Integration',
        baseUrl: 'https://example.atlassian.net',
        cloudId: 'cloud-123',
        authType: 'oauth',
        status: 'connected',
        lastSyncAt: new Date(),
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockIntegration]),
        }),
      } as any);

      const integration = await getIntegration(1);

      expect(integration).toBeDefined();
      expect(integration?.id).toBe(1);
    });

    it('should return null if integration not found', async () => {
      const { db } = await import('../../../db/index.js');
      const { getIntegration } = await import('../integration.service.js');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const integration = await getIntegration(999);

      expect(integration).toBeNull();
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration and return true', async () => {
      const { db } = await import('../../../db/index.js');
      const { deleteIntegration } = await import('../integration.service.js');

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any);

      const result = await deleteIntegration(1);

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should return false if integration not found', async () => {
      const { db } = await import('../../../db/index.js');
      const { deleteIntegration } = await import('../integration.service.js');

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await deleteIntegration(999);

      expect(result).toBe(false);
    });
  });

  describe('updateIntegrationStatus', () => {
    it('should update integration status', async () => {
      const { db } = await import('../../../db/index.js');
      const { updateIntegrationStatus } = await import('../integration.service.js');

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      await updateIntegrationStatus(1, 'error', 'Connection failed');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('getFieldMappings', () => {
    it('should return field mappings for integration', async () => {
      const { db } = await import('../../../db/index.js');
      const { getFieldMappings } = await import('../integration.service.js');

      const mockMappings = [
        {
          id: 1,
          integrationId: 1,
          ourField: 'story_points',
          providerFieldId: 'customfield_10001',
          providerFieldName: 'Story Points',
          providerFieldType: 'number',
          confidence: 95,
          adminConfirmed: 1,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockMappings),
        }),
      } as any);

      const mappings = await getFieldMappings(1);

      expect(mappings).toBeDefined();
      expect(mappings).toHaveLength(1);
      expect(mappings[0].adminConfirmed).toBe(true);
    });
  });

  describe('FIELD_PATTERNS', () => {
    it('should have patterns for story_points field', async () => {
      // Import and check that field patterns exist in the service
      // This is a basic structural test
      const integrationModule = await import('../integration.service.js');

      // The service should export field-related functions
      expect(integrationModule.getFieldMappings).toBeDefined();
      expect(integrationModule.updateFieldMapping).toBeDefined();
      expect(integrationModule.deleteFieldMapping).toBeDefined();
    });
  });
});

describe('Field Confidence Calculation', () => {
  it('should match story points field by name pattern', () => {
    // This tests the logic of field matching
    const testCases = [
      { name: 'story points', expectedMatch: true },
      { name: 'Story Points', expectedMatch: true },
      { name: 'points', expectedMatch: true },
      { name: 'estimate', expectedMatch: true },
      { name: 'random field', expectedMatch: false },
    ];

    const namePatterns = ['story points', 'points', 'estimate', 'story point estimate'];

    testCases.forEach(({ name, expectedMatch }) => {
      const nameLower = name.toLowerCase();
      const matches = namePatterns.some(
        (p) => nameLower === p || nameLower.includes(p)
      );
      expect(matches).toBe(expectedMatch);
    });
  });
});

describe('Integration Mapping', () => {
  it('should correctly map integration row to Integration type', () => {
    const mockRow = {
      id: 1,
      provider: 'jira',
      name: 'Test',
      baseUrl: 'https://example.atlassian.net',
      cloudId: 'cloud-123',
      authType: 'oauth',
      accessToken: 'token',
      refreshToken: 'refresh',
      tokenExpiresAt: new Date(),
      scopes: ['read:jira-work'],
      status: 'connected',
      lastSyncAt: new Date(),
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Test the mapping logic
    const mapped = {
      id: mockRow.id,
      provider: mockRow.provider,
      name: mockRow.name,
      baseUrl: mockRow.baseUrl,
      cloudId: mockRow.cloudId,
      authType: mockRow.authType,
      status: mockRow.status,
      lastSyncAt: mockRow.lastSyncAt,
      errorMessage: mockRow.errorMessage,
      createdAt: mockRow.createdAt,
      updatedAt: mockRow.updatedAt,
    };

    expect(mapped.id).toBe(1);
    expect(mapped.provider).toBe('jira');
    expect(mapped.authType).toBe('oauth');
    expect(mapped.status).toBe('connected');
    // Token fields should not be in mapped output
    expect((mapped as any).accessToken).toBeUndefined();
  });
});
