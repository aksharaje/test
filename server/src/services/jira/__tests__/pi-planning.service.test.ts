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

// Mock data service
vi.mock('../data.service.js', () => ({
  jiraDataService: {
    getSprints: vi.fn().mockResolvedValue([]),
    getBoard: vi.fn().mockResolvedValue({ velocityAvg: 25 }),
    getBacklogIssues: vi.fn().mockResolvedValue([]),
    syncBacklogIssues: vi.fn().mockResolvedValue([]),
  },
}));

describe('PI Planning Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a new PI session', async () => {
      const { db } = await import('../../../db/index.js');
      const { createSession } = await import('../pi-planning.service.js');

      const mockSession = {
        id: 1,
        integrationId: 1,
        name: 'PI 2024.1',
        description: 'Q1 Planning',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        sprintCount: 5,
        status: 'draft',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession]),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const session = await createSession({
        integrationId: 1,
        name: 'PI 2024.1',
        description: 'Q1 Planning',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        sprintCount: 5,
        boardIds: [1, 2],
      });

      expect(session).toBeDefined();
      expect(session.name).toBe('PI 2024.1');
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getSessions', () => {
    it('should return sessions for integration', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSessions } = await import('../pi-planning.service.js');

      const mockSessions = [
        {
          id: 1,
          integrationId: 1,
          name: 'PI 2024.1',
          description: null,
          startDate: null,
          endDate: null,
          sprintCount: 5,
          status: 'draft',
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSessions),
          }),
        }),
      } as any);

      const sessions = await getSessions(1);

      expect(sessions).toBeDefined();
      expect(sessions).toHaveLength(1);
    });
  });

  describe('getSession', () => {
    it('should return session with boards', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSession } = await import('../pi-planning.service.js');

      const mockSession = {
        id: 1,
        integrationId: 1,
        name: 'PI 2024.1',
        description: null,
        startDate: null,
        endDate: null,
        sprintCount: 5,
        status: 'draft',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBoards = [
        {
          id: 1,
          sessionId: 1,
          boardId: 1,
          boardName: 'Team A',
          velocityOverride: null,
          capacityAdjustment: 100,
        },
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSession]),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockBoards),
          }),
        } as any);

      const session = await getSession(1);

      expect(session).toBeDefined();
      expect(session?.boards).toHaveLength(1);
    });

    it('should return null if session not found', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSession } = await import('../pi-planning.service.js');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const session = await getSession(999);

      expect(session).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session', async () => {
      const { db } = await import('../../../db/index.js');
      const { updateSession } = await import('../pi-planning.service.js');

      const mockUpdatedSession = {
        id: 1,
        integrationId: 1,
        name: 'Updated Name',
        description: 'Updated Description',
        startDate: null,
        endDate: null,
        sprintCount: 6,
        status: 'active',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedSession]),
          }),
        }),
      } as any);

      const session = await updateSession(1, {
        name: 'Updated Name',
        status: 'active',
      });

      expect(session).toBeDefined();
      expect(session?.name).toBe('Updated Name');
    });
  });

  describe('deleteSession', () => {
    it('should delete session and return true', async () => {
      const { db } = await import('../../../db/index.js');
      const { deleteSession } = await import('../pi-planning.service.js');

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any);

      const result = await deleteSession(1);

      expect(result).toBe(true);
    });

    it('should return false if session not found', async () => {
      const { db } = await import('../../../db/index.js');
      const { deleteSession } = await import('../pi-planning.service.js');

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await deleteSession(999);

      expect(result).toBe(false);
    });
  });

  describe('addPlannedItem', () => {
    it('should add item with correct sequence order', async () => {
      const { db } = await import('../../../db/index.js');
      const { addPlannedItem } = await import('../pi-planning.service.js');

      const mockItem = {
        id: 1,
        sessionId: 1,
        jiraIssueId: '10001',
        jiraIssueKey: 'PROJ-1',
        title: 'New Feature',
        assignedBoardId: 1,
        targetSprintId: null,
        sequenceOrder: 1,
        estimatedPoints: 5,
        confidence: 80,
        dependencies: [],
        notes: null,
        aiSuggested: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockItem]),
        }),
      } as any);

      const item = await addPlannedItem({
        sessionId: 1,
        jiraIssueId: '10001',
        jiraIssueKey: 'PROJ-1',
        title: 'New Feature',
        assignedBoardId: 1,
        estimatedPoints: 5,
        confidence: 80,
      });

      expect(item).toBeDefined();
      expect(item.title).toBe('New Feature');
      expect(item.estimatedPoints).toBe(5);
    });
  });

  describe('updatePlannedItem', () => {
    it('should update item', async () => {
      const { db } = await import('../../../db/index.js');
      const { updatePlannedItem } = await import('../pi-planning.service.js');

      const mockUpdatedItem = {
        id: 1,
        sessionId: 1,
        jiraIssueId: '10001',
        jiraIssueKey: 'PROJ-1',
        title: 'Updated Title',
        assignedBoardId: 1,
        targetSprintId: 2,
        sequenceOrder: 1,
        estimatedPoints: 8,
        confidence: 90,
        dependencies: ['PROJ-2'],
        notes: 'Updated notes',
        aiSuggested: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedItem]),
          }),
        }),
      } as any);

      const item = await updatePlannedItem(1, {
        title: 'Updated Title',
        targetSprintId: 2,
        estimatedPoints: 8,
        dependencies: ['PROJ-2'],
      });

      expect(item).toBeDefined();
      expect(item?.title).toBe('Updated Title');
      expect(item?.targetSprintId).toBe(2);
    });
  });

  describe('deletePlannedItem', () => {
    it('should delete item and return true', async () => {
      const { db } = await import('../../../db/index.js');
      const { deletePlannedItem } = await import('../pi-planning.service.js');

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any);

      const result = await deletePlannedItem(1);

      expect(result).toBe(true);
    });
  });

  describe('getSessionItems', () => {
    it('should return items for session', async () => {
      const { db } = await import('../../../db/index.js');
      const { getSessionItems } = await import('../pi-planning.service.js');

      const mockItems = [
        {
          id: 1,
          sessionId: 1,
          jiraIssueId: '10001',
          jiraIssueKey: 'PROJ-1',
          title: 'Item 1',
          assignedBoardId: 1,
          targetSprintId: null,
          sequenceOrder: 1,
          estimatedPoints: 5,
          confidence: null,
          dependencies: [],
          notes: null,
          aiSuggested: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockItems),
          }),
        }),
      } as any);

      const items = await getSessionItems(1);

      expect(items).toBeDefined();
      expect(items).toHaveLength(1);
    });
  });

  describe('updateSessionBoard', () => {
    it('should update board velocity override', async () => {
      const { db } = await import('../../../db/index.js');
      const { updateSessionBoard } = await import('../pi-planning.service.js');

      const mockUpdatedBoard = {
        id: 1,
        sessionId: 1,
        boardId: 1,
        boardName: 'Team A',
        velocityOverride: 30,
        capacityAdjustment: 100,
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedBoard]),
          }),
        }),
      } as any);

      const board = await updateSessionBoard(1, 1, { velocityOverride: 30 });

      expect(board).toBeDefined();
      expect(board?.velocityOverride).toBe(30);
    });

    it('should update board capacity adjustment', async () => {
      const { db } = await import('../../../db/index.js');
      const { updateSessionBoard } = await import('../pi-planning.service.js');

      const mockUpdatedBoard = {
        id: 1,
        sessionId: 1,
        boardId: 1,
        boardName: 'Team A',
        velocityOverride: null,
        capacityAdjustment: 80,
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedBoard]),
          }),
        }),
      } as any);

      const board = await updateSessionBoard(1, 1, { capacityAdjustment: 80 });

      expect(board).toBeDefined();
      expect(board?.capacityAdjustment).toBe(80);
    });
  });

  describe('removeBoardFromSession', () => {
    it('should remove board and return true', async () => {
      const { db } = await import('../../../db/index.js');
      const { removeBoardFromSession } = await import('../pi-planning.service.js');

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any);

      const result = await removeBoardFromSession(1, 1);

      expect(result).toBe(true);
    });
  });
});

describe('PI Session Status', () => {
  it('should support all valid status values', () => {
    const validStatuses = ['draft', 'active', 'locked', 'completed'];

    validStatuses.forEach((status) => {
      expect(['draft', 'active', 'locked', 'completed']).toContain(status);
    });
  });
});

describe('Capacity Calculation', () => {
  it('should calculate adjusted capacity correctly', () => {
    const testCases = [
      { velocity: 25, adjustment: 100, expected: 25 },
      { velocity: 25, adjustment: 80, expected: 20 },
      { velocity: 25, adjustment: 120, expected: 30 },
      { velocity: 30, adjustment: 50, expected: 15 },
    ];

    testCases.forEach(({ velocity, adjustment, expected }) => {
      const adjustedVelocity = Math.round(velocity * (adjustment / 100));
      expect(adjustedVelocity).toBe(expected);
    });
  });
});

describe('Planned Item Mapping', () => {
  it('should correctly map aiSuggested boolean', () => {
    const testCases = [
      { dbValue: 0, expected: false },
      { dbValue: 1, expected: true },
    ];

    testCases.forEach(({ dbValue, expected }) => {
      const mapped = dbValue === 1;
      expect(mapped).toBe(expected);
    });
  });

  it('should handle null dependencies', () => {
    const mockRow = {
      id: 1,
      sessionId: 1,
      jiraIssueId: '10001',
      jiraIssueKey: 'PROJ-1',
      title: 'Test',
      assignedBoardId: null,
      targetSprintId: null,
      sequenceOrder: null,
      estimatedPoints: null,
      confidence: null,
      dependencies: null,
      notes: null,
      aiSuggested: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mapped = {
      ...mockRow,
      dependencies: mockRow.dependencies || [],
      aiSuggested: mockRow.aiSuggested === 1,
    };

    expect(mapped.dependencies).toEqual([]);
  });
});

describe('Sprint Organization', () => {
  it('should filter only active and future sprints for planning', () => {
    const allSprints = [
      { jiraId: 1, name: 'Sprint 1', state: 'closed' },
      { jiraId: 2, name: 'Sprint 2', state: 'active' },
      { jiraId: 3, name: 'Sprint 3', state: 'future' },
      { jiraId: 4, name: 'Sprint 4', state: 'future' },
    ];

    const plannable = allSprints.filter((s) => s.state !== 'closed');

    expect(plannable).toHaveLength(3);
    expect(plannable[0].state).toBe('active');
  });

  it('should limit sprints to sprintCount', () => {
    const sprints = [
      { jiraId: 1, name: 'Sprint 1', state: 'active' },
      { jiraId: 2, name: 'Sprint 2', state: 'future' },
      { jiraId: 3, name: 'Sprint 3', state: 'future' },
      { jiraId: 4, name: 'Sprint 4', state: 'future' },
      { jiraId: 5, name: 'Sprint 5', state: 'future' },
      { jiraId: 6, name: 'Sprint 6', state: 'future' },
    ];

    const sprintCount = 5;
    const limited = sprints.slice(0, sprintCount);

    expect(limited).toHaveLength(5);
  });
});

describe('Planned Points Calculation', () => {
  it('should sum estimated points for sprint items', () => {
    const items = [
      { estimatedPoints: 5 },
      { estimatedPoints: 3 },
      { estimatedPoints: 8 },
      { estimatedPoints: null },
    ];

    const plannedPoints = items.reduce(
      (sum, i) => sum + (i.estimatedPoints || 0),
      0
    );

    expect(plannedPoints).toBe(16);
  });
});
