import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JiraClient, JiraApiError, createJiraClient } from '../client.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('JiraClient', () => {
  let client: JiraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new JiraClient({
      baseUrl: 'https://example.atlassian.net',
      cloudId: 'cloud-123',
      accessToken: 'test-token',
      isCloud: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should build cloud API URL when cloudId is provided', () => {
      const cloudClient = new JiraClient({
        baseUrl: 'https://example.atlassian.net',
        cloudId: 'cloud-123',
        accessToken: 'token',
        isCloud: true,
      });
      // Accessing private property for testing
      expect((cloudClient as any).baseUrl).toBe('https://api.atlassian.com/ex/jira/cloud-123');
    });

    it('should use baseUrl directly for server/data center', () => {
      const serverClient = new JiraClient({
        baseUrl: 'https://jira.company.com/',
        accessToken: 'token',
        isCloud: false,
      });
      expect((serverClient as any).baseUrl).toBe('https://jira.company.com');
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user successfully', async () => {
      const mockUser = {
        accountId: 'user-123',
        displayName: 'Test User',
        emailAddress: 'test@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUser),
      });

      const user = await client.getCurrentUser();

      expect(user).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/myself',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw JiraApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({
            errorMessages: ['Authentication failed'],
          }),
      });

      await expect(client.getCurrentUser()).rejects.toThrow(JiraApiError);
    });
  });

  describe('getProjects', () => {
    it('should fetch projects successfully', async () => {
      const mockProjects = {
        values: [
          { id: '1', key: 'PROJ1', name: 'Project 1' },
          { id: '2', key: 'PROJ2', name: 'Project 2' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockProjects),
      });

      const projects = await client.getProjects();

      expect(projects).toEqual(mockProjects.values);
    });
  });

  describe('getFields', () => {
    it('should fetch fields successfully', async () => {
      const mockFields = [
        { id: 'summary', name: 'Summary', schema: { type: 'string' } },
        { id: 'customfield_10001', name: 'Story Points', schema: { type: 'number' } },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockFields),
      });

      const fields = await client.getFields();

      expect(fields).toEqual(mockFields);
    });
  });

  describe('getBoards', () => {
    it('should fetch boards successfully', async () => {
      const mockBoards = {
        values: [
          { id: 1, name: 'Board 1', type: 'scrum' },
          { id: 2, name: 'Board 2', type: 'kanban' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockBoards),
      });

      const boards = await client.getBoards();

      expect(boards).toEqual(mockBoards.values);
    });

    it('should filter by project when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ values: [] }),
      });

      await client.getBoards('PROJ1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('projectKeyOrId=PROJ1'),
        expect.any(Object)
      );
    });
  });

  describe('getSprints', () => {
    it('should fetch sprints for a board', async () => {
      const mockSprints = {
        values: [
          { id: 1, name: 'Sprint 1', state: 'closed' },
          { id: 2, name: 'Sprint 2', state: 'active' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSprints),
      });

      const sprints = await client.getSprints(1);

      expect(sprints).toEqual(mockSprints.values);
    });

    it('should filter by state when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ values: [] }),
      });

      await client.getSprints(1, 'active');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('state=active'),
        expect.any(Object)
      );
    });
  });

  describe('searchIssues', () => {
    it('should search issues with JQL', async () => {
      const mockResult = {
        total: 2,
        issues: [
          { id: '1', key: 'PROJ-1', fields: { summary: 'Issue 1' } },
          { id: '2', key: 'PROJ-2', fields: { summary: 'Issue 2' } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResult),
      });

      const result = await client.searchIssues('project = PROJ');

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/search'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('project = PROJ'),
        })
      );
    });
  });

  describe('createIssue', () => {
    it('should create an issue successfully', async () => {
      const createResponse = { id: '10001', key: 'PROJ-1' };
      const fullIssue = {
        id: '10001',
        key: 'PROJ-1',
        fields: { summary: 'New Issue' },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve(createResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(fullIssue),
        });

      const issue = await client.createIssue('PROJ', '10001', {
        summary: 'New Issue',
      });

      expect(issue).toEqual(fullIssue);
    });
  });

  describe('updateIssue', () => {
    it('should update an issue successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      });

      await client.updateIssue('PROJ-1', { summary: 'Updated Summary' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/issue/PROJ-1'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  describe('moveIssueToSprint', () => {
    it('should move issues to sprint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      });

      await client.moveIssueToSprint(['PROJ-1', 'PROJ-2'], 5);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/agile/1.0/sprint/5/issue'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ issues: ['PROJ-1', 'PROJ-2'] }),
        })
      );
    });
  });

  describe('static methods', () => {
    describe('getAccessibleResources', () => {
      it('should fetch accessible resources', async () => {
        const mockResources = [
          { id: 'cloud-123', name: 'Example Site', url: 'https://example.atlassian.net' },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResources),
        });

        const resources = await JiraClient.getAccessibleResources('token');

        expect(resources).toEqual(mockResources);
      });
    });

    describe('exchangeCodeForTokens', () => {
      it('should exchange code for tokens', async () => {
        const mockTokens = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockTokens),
        });

        const tokens = await JiraClient.exchangeCodeForTokens(
          'auth-code',
          'client-id',
          'client-secret',
          'http://localhost/callback'
        );

        expect(tokens).toEqual(mockTokens);
      });
    });

    describe('refreshAccessToken', () => {
      it('should refresh access token', async () => {
        const mockTokens = {
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockTokens),
        });

        const tokens = await JiraClient.refreshAccessToken(
          'old-refresh-token',
          'client-id',
          'client-secret'
        );

        expect(tokens).toEqual(mockTokens);
      });
    });
  });
});

describe('createJiraClient', () => {
  it('should create a cloud client when cloudId is present', () => {
    const client = createJiraClient({
      baseUrl: 'https://example.atlassian.net',
      cloudId: 'cloud-123',
      accessToken: 'token',
    });

    expect(client).toBeInstanceOf(JiraClient);
    expect((client as any).isCloud).toBe(true);
  });

  it('should create a server client when cloudId is null', () => {
    const client = createJiraClient({
      baseUrl: 'https://jira.company.com',
      cloudId: null,
      accessToken: 'token',
    });

    expect(client).toBeInstanceOf(JiraClient);
    expect((client as any).isCloud).toBe(false);
  });
});

describe('JiraApiError', () => {
  it('should create error with status code and jira errors', () => {
    const jiraErrors = {
      errorMessages: ['Field required'],
      errors: { summary: 'Required' },
    };

    const error = new JiraApiError('Validation failed', 400, jiraErrors);

    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(400);
    expect(error.jiraErrors).toEqual(jiraErrors);
    expect(error.name).toBe('JiraApiError');
  });
});
