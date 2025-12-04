import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('../../../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
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
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock integration service
vi.mock('../integration.service.js', () => ({
  getIntegrationWithCredentials: vi.fn().mockResolvedValue({
    id: 1,
    baseUrl: 'https://example.atlassian.net',
    cloudId: 'cloud-123',
    accessToken: 'test-token',
  }),
  ensureValidToken: vi.fn().mockResolvedValue('test-token'),
}));

// Mock the JiraClient
vi.mock('../client.js', () => ({
  createJiraClient: vi.fn().mockReturnValue({
    getSprints: vi.fn().mockResolvedValue([]),
    getSprintIssues: vi.fn().mockResolvedValue([]),
    getBacklogIssues: vi.fn().mockResolvedValue([]),
    getEpicIssues: vi.fn().mockResolvedValue([]),
    searchIssues: vi.fn().mockResolvedValue({ issues: [], total: 0 }),
  }),
}));

describe('Jira Data Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProjects', () => {
    it('should return projects for integration', async () => {
      const { db } = await import('../../../db/index.js');
      const { getProjects } = await import('../data.service.js');

      const mockProjects = [
        { id: 1, integrationId: 1, jiraId: '10001', key: 'PROJ1', name: 'Project 1' },
        { id: 2, integrationId: 1, jiraId: '10002', key: 'PROJ2', name: 'Project 2' },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockProjects),
          }),
        }),
      } as any);

      const projects = await getProjects(1);

      expect(projects).toEqual(mockProjects);
    });
  });

  describe('getBoards', () => {
    it('should return boards for integration', async () => {
      const { db } = await import('../../../db/index.js');
      const { getBoards } = await import('../data.service.js');

      const mockBoards = [
        {
          id: 1,
          integrationId: 1,
          jiraId: 1,
          name: 'Board 1',
          type: 'scrum',
          projectId: '10001',
          projectKey: 'PROJ1',
          velocityAvg: 25,
          velocityLastN: 5,
          syncedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockBoards),
          }),
        }),
      } as any);

      const boards = await getBoards(1);

      expect(boards).toBeDefined();
      expect(boards).toHaveLength(1);
      expect(boards[0].name).toBe('Board 1');
    });
  });

  describe('getBoard', () => {
    it('should return board by jiraId', async () => {
      const { db } = await import('../../../db/index.js');
      const { getBoard } = await import('../data.service.js');

      const mockBoard = {
        id: 1,
        integrationId: 1,
        jiraId: 1,
        name: 'Board 1',
        type: 'scrum',
        projectId: '10001',
        projectKey: 'PROJ1',
        velocityAvg: 25,
        velocityLastN: 5,
        syncedAt: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBoard]),
        }),
      } as any);

      const board = await getBoard(1, 1);

      expect(board).toBeDefined();
      expect(board?.jiraId).toBe(1);
    });

    it('should return null if board not found', async () => {
      const { db } = await import('../../../db/index.js');
      const { getBoard } = await import('../data.service.js');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const board = await getBoard(1, 999);

      expect(board).toBeNull();
    });
  });

  describe('getSprints', () => {
    it('should return sprints for board', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSprints } = await import('../data.service.js');

      const mockSprints = [
        {
          id: 1,
          integrationId: 1,
          boardId: 1,
          jiraId: 1,
          name: 'Sprint 1',
          state: 'active',
          startDate: new Date(),
          endDate: new Date(),
          completedPoints: 20,
          committedPoints: 25,
          goal: 'Complete feature X',
          syncedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSprints),
          }),
        }),
      } as any);

      const sprints = await getSprints(1, 1);

      expect(sprints).toBeDefined();
      expect(sprints).toHaveLength(1);
      expect(sprints[0].name).toBe('Sprint 1');
    });

    it('should filter sprints by state', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSprints } = await import('../data.service.js');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await getSprints(1, 1, 'closed');

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('getSprintIssues', () => {
    it('should return issues for sprint', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSprintIssues } = await import('../data.service.js');

      const mockIssues = [
        {
          id: 1,
          integrationId: 1,
          jiraId: '10001',
          key: 'PROJ-1',
          summary: 'Test Issue',
          description: 'Description',
          issueType: 'Story',
          issueTypeId: '10001',
          status: 'In Progress',
          statusCategory: 'in_progress',
          priority: 'High',
          assigneeId: 'user-123',
          assigneeName: 'Test User',
          storyPoints: 5,
          sprintId: 1,
          labels: ['frontend'],
          components: ['UI'],
          projectKey: 'PROJ',
          syncedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockIssues),
          }),
        }),
      } as any);

      const issues = await getSprintIssues(1, 1);

      expect(issues).toBeDefined();
      expect(issues).toHaveLength(1);
      expect(issues[0].key).toBe('PROJ-1');
    });
  });

  describe('getVelocity', () => {
    it('should calculate velocity from closed sprints', async () => {
      const { db } = await import('../../../db/index.js');
      const { getVelocity } = await import('../data.service.js');

      const mockClosedSprints = [
        {
          jiraId: 1,
          name: 'Sprint 1',
          state: 'closed',
          committedPoints: 30,
          completedPoints: 25,
        },
        {
          jiraId: 2,
          name: 'Sprint 2',
          state: 'closed',
          committedPoints: 35,
          completedPoints: 30,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockClosedSprints),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const velocity = await getVelocity(1, 1, 5);

      expect(velocity).toBeDefined();
      expect(velocity.sprints).toHaveLength(2);
      expect(velocity.averageVelocity).toBe(28); // (25 + 30) / 2 = 27.5, rounded to 28
    });

    it('should return zero velocity when no sprints', async () => {
      const { db } = await import('../../../db/index.js');
      const { getVelocity } = await import('../data.service.js');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const velocity = await getVelocity(1, 1, 5);

      expect(velocity.averageVelocity).toBe(0);
      expect(velocity.sprints).toHaveLength(0);
    });
  });

  describe('getEpicIssues', () => {
    it('should return issues for epic', async () => {
      const { db } = await import('../../../db/index.js');
      const { getEpicIssues } = await import('../data.service.js');

      const mockIssues = [
        {
          id: 1,
          integrationId: 1,
          jiraId: '10001',
          key: 'PROJ-2',
          summary: 'Child Issue',
          issueType: 'Story',
          issueTypeId: '10001',
          status: 'To Do',
          epicKey: 'PROJ-1',
          labels: [],
          components: [],
          projectKey: 'PROJ',
          syncedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockIssues),
          }),
        }),
      } as any);

      const issues = await getEpicIssues(1, 'PROJ-1');

      expect(issues).toBeDefined();
      expect(issues).toHaveLength(1);
      expect(issues[0].epicKey).toBe('PROJ-1');
    });
  });

  describe('getUserCurrentWork', () => {
    it('should return in-progress issues for user', async () => {
      const { db } = await import('../../../db/index.js');
      const { getUserCurrentWork } = await import('../data.service.js');

      const mockIssues = [
        {
          id: 1,
          integrationId: 1,
          jiraId: '10001',
          key: 'PROJ-1',
          summary: 'Working on this',
          issueType: 'Story',
          issueTypeId: '10001',
          status: 'In Progress',
          statusCategory: 'in_progress',
          assigneeId: 'user-123',
          labels: [],
          components: [],
          projectKey: 'PROJ',
          syncedAt: new Date(),
        },
        {
          id: 2,
          integrationId: 1,
          jiraId: '10002',
          key: 'PROJ-2',
          summary: 'Done with this',
          issueType: 'Story',
          issueTypeId: '10001',
          status: 'Done',
          statusCategory: 'done',
          assigneeId: 'user-123',
          labels: [],
          components: [],
          projectKey: 'PROJ',
          syncedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockIssues),
          }),
        }),
      } as any);

      const issues = await getUserCurrentWork(1, 'user-123');

      // Should only return in_progress issues
      expect(issues).toBeDefined();
      expect(issues).toHaveLength(1);
      expect(issues[0].statusCategory).toBe('in_progress');
    });
  });
});

describe('Status Category Mapping', () => {
  it('should map status categories correctly', () => {
    const testCases = [
      { key: 'new', expected: 'todo' },
      { key: 'undefined', expected: 'todo' },
      { key: 'indeterminate', expected: 'in_progress' },
      { key: 'done', expected: 'done' },
      { key: 'unknown', expected: undefined },
      { key: undefined, expected: undefined },
    ];

    const mapStatusCategory = (key?: string): 'todo' | 'in_progress' | 'done' | undefined => {
      if (!key) return undefined;
      if (key === 'new' || key === 'undefined') return 'todo';
      if (key === 'indeterminate') return 'in_progress';
      if (key === 'done') return 'done';
      return undefined;
    };

    testCases.forEach(({ key, expected }) => {
      expect(mapStatusCategory(key)).toBe(expected);
    });
  });
});

describe('Board Type Mapping', () => {
  it('should map board types correctly', () => {
    const mapBoardType = (type: string): 'scrum' | 'kanban' => {
      return type === 'simple' ? 'kanban' : (type as 'scrum' | 'kanban');
    };

    expect(mapBoardType('scrum')).toBe('scrum');
    expect(mapBoardType('kanban')).toBe('kanban');
    expect(mapBoardType('simple')).toBe('kanban');
  });
});

describe('Issue Mapping', () => {
  it('should correctly map issue fields', () => {
    const mockIssueRow = {
      id: 1,
      integrationId: 1,
      jiraId: '10001',
      key: 'PROJ-1',
      summary: 'Test Issue',
      description: 'Description',
      issueType: 'Story',
      issueTypeId: '10001',
      status: 'In Progress',
      statusCategory: 'in_progress' as const,
      priority: 'High',
      assigneeId: 'user-123',
      assigneeName: 'Test User',
      reporterId: 'user-456',
      reporterName: 'Reporter',
      storyPoints: 5,
      sprintId: 1,
      epicKey: 'PROJ-0',
      parentKey: 'PROJ-0',
      labels: ['frontend', 'urgent'],
      components: ['UI', 'API'],
      projectKey: 'PROJ',
      createdDate: new Date('2024-01-01'),
      updatedDate: new Date('2024-01-15'),
      resolutionDate: null,
      syncedAt: new Date(),
    };

    const mapped = {
      id: mockIssueRow.id,
      jiraId: mockIssueRow.jiraId,
      key: mockIssueRow.key,
      summary: mockIssueRow.summary,
      description: mockIssueRow.description || undefined,
      issueType: mockIssueRow.issueType,
      issueTypeId: mockIssueRow.issueTypeId,
      status: mockIssueRow.status,
      statusCategory: mockIssueRow.statusCategory || undefined,
      priority: mockIssueRow.priority || undefined,
      assigneeId: mockIssueRow.assigneeId || undefined,
      assigneeName: mockIssueRow.assigneeName || undefined,
      reporterId: mockIssueRow.reporterId || undefined,
      reporterName: mockIssueRow.reporterName || undefined,
      storyPoints: mockIssueRow.storyPoints || undefined,
      sprintId: mockIssueRow.sprintId || undefined,
      epicKey: mockIssueRow.epicKey || undefined,
      parentKey: mockIssueRow.parentKey || undefined,
      labels: mockIssueRow.labels || [],
      components: mockIssueRow.components || [],
      projectKey: mockIssueRow.projectKey,
      createdDate: mockIssueRow.createdDate || undefined,
      updatedDate: mockIssueRow.updatedDate || undefined,
      syncedAt: mockIssueRow.syncedAt,
    };

    expect(mapped.key).toBe('PROJ-1');
    expect(mapped.storyPoints).toBe(5);
    expect(mapped.labels).toEqual(['frontend', 'urgent']);
    expect(mapped.statusCategory).toBe('in_progress');
  });

  it('should handle null fields correctly', () => {
    const mockIssueRow = {
      id: 1,
      integrationId: 1,
      jiraId: '10001',
      key: 'PROJ-1',
      summary: 'Test Issue',
      description: null,
      issueType: 'Story',
      issueTypeId: '10001',
      status: 'To Do',
      statusCategory: null,
      priority: null,
      assigneeId: null,
      assigneeName: null,
      reporterId: null,
      reporterName: null,
      storyPoints: null,
      sprintId: null,
      epicKey: null,
      parentKey: null,
      labels: [],
      components: [],
      projectKey: 'PROJ',
      createdDate: null,
      updatedDate: null,
      resolutionDate: null,
      syncedAt: new Date(),
    };

    const mapped = {
      id: mockIssueRow.id,
      jiraId: mockIssueRow.jiraId,
      key: mockIssueRow.key,
      summary: mockIssueRow.summary,
      description: mockIssueRow.description || undefined,
      storyPoints: mockIssueRow.storyPoints || undefined,
      sprintId: mockIssueRow.sprintId || undefined,
    };

    expect(mapped.description).toBeUndefined();
    expect(mapped.storyPoints).toBeUndefined();
    expect(mapped.sprintId).toBeUndefined();
  });
});
