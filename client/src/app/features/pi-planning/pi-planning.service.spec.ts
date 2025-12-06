import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PiPlanningService } from './pi-planning.service';
import type { PiSession, PiPlanningView, CreateSessionRequest } from './pi-planning.types';

// Helper to create a complete PiSession mock
function createMockSession(overrides: Partial<PiSession> = {}): PiSession {
  return {
    id: 1,
    integrationId: 1,
    name: 'PI 2024.1',
    description: null,
    projectKeys: ['TEST'],
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    sprintCount: 5,
    sprintLengthWeeks: 2,
    plannableIssueType: 'epic',
    customIssueTypeName: null,
    holidayConfigId: null,
    includeIpSprint: true,
    currentVersion: '1.0',
    status: 'draft',
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('PiPlanningService', () => {
  let service: PiPlanningService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PiPlanningService],
    });

    service = TestBed.inject(PiPlanningService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('loadSessions', () => {
    it('should load sessions and update state', async () => {
      const mockSessions: PiSession[] = [
        createMockSession({ description: 'Q1 Planning' }),
      ];

      const loadPromise = service.loadSessions(1);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);

      await loadPromise;

      expect(service.sessions()).toEqual(mockSessions);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should handle load error', async () => {
      const loadPromise = service.loadSessions(1);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      await loadPromise;

      expect(service.error()).toBe('Failed to load PI sessions');
      expect(service.loading()).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create session and make POST request', async () => {
      const createRequest: CreateSessionRequest = {
        name: 'PI 2024.1',
        projectKeys: ['TEST'],
        startDate: '2024-01-01',
        numberOfSprints: 5,
        sprintLengthWeeks: 2,
        plannableIssueType: 'epic',
        includeIpSprint: true,
      };

      // Start the create request
      const createPromise = service.createSession(1, createRequest);

      // Verify POST request is made
      const postReq = httpMock.expectOne('/api/pi-planning/1/sessions');
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body.name).toBe('PI 2024.1');
      expect(postReq.request.body.projectKeys).toEqual(['TEST']);

      // Fail the POST to avoid the follow-up GET
      postReq.flush('Error', { status: 500, statusText: 'Server Error' });

      const result = await createPromise;
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const createRequest: CreateSessionRequest = {
        name: 'PI 2024.1',
        projectKeys: ['TEST'],
        startDate: '2024-01-01',
        numberOfSprints: 5,
      };

      const createPromise = service.createSession(1, createRequest);

      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      req.flush('Error', { status: 400, statusText: 'Bad Request' });

      const result = await createPromise;

      expect(result).toBeNull();
      expect(service.error()).toBe('Failed to create PI session');
    });
  });

  describe('getSession', () => {
    it('should get single session', async () => {
      const mockSession = createMockSession({
        status: 'active',
        boards: [
          {
            id: 1,
            boardId: 1,
            jiraBoardId: 101,
            name: 'Team A',
            boardType: 'scrum',
            defaultVelocity: 25,
          },
        ],
      });

      const getPromise = service.getSession(1, 1);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockSession);

      const result = await getPromise;

      expect(result).toEqual(mockSession);
      expect(service.selectedSession()).toEqual(mockSession);
    });

    it('should return null on error', async () => {
      const getPromise = service.getSession(1, 999);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions/999');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      const result = await getPromise;

      expect(result).toBeNull();
      expect(service.error()).toBe('Failed to load PI session');
    });
  });

  describe('updateSession', () => {
    it('should update session', async () => {
      const initialSession = createMockSession();

      const loadPromise = service.loadSessions(1);
      const loadReq = httpMock.expectOne('/api/pi-planning/1/sessions');
      loadReq.flush([initialSession]);
      await loadPromise;

      const updatedSession = createMockSession({
        name: 'Updated PI 2024.1',
        status: 'active',
      });

      const updatePromise = service.updateSession(1, 1, {
        name: 'Updated PI 2024.1',
        status: 'active',
      });

      const updateReq = httpMock.expectOne('/api/pi-planning/1/sessions/1');
      expect(updateReq.request.method).toBe('PATCH');
      updateReq.flush(updatedSession);

      const result = await updatePromise;

      expect(result).toEqual(updatedSession);
      expect(service.sessions()[0].name).toBe('Updated PI 2024.1');
    });
  });

  describe('deleteSession', () => {
    it('should delete session and update state', async () => {
      const mockSessions: PiSession[] = [
        createMockSession({ id: 1 }),
        createMockSession({ id: 2, name: 'PI 2024.2' }),
      ];

      const loadPromise = service.loadSessions(1);
      const loadReq = httpMock.expectOne('/api/pi-planning/1/sessions');
      loadReq.flush(mockSessions);
      await loadPromise;

      const deletePromise = service.deleteSession(1, 1);
      const deleteReq = httpMock.expectOne('/api/pi-planning/1/sessions/1');
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush({});

      const result = await deletePromise;

      expect(result).toBe(true);
      expect(service.sessions().length).toBe(1);
      expect(service.sessions()[0].id).toBe(2);
    });

    it('should return false on error', async () => {
      const deletePromise = service.deleteSession(1, 999);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions/999');
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      const result = await deletePromise;

      expect(result).toBe(false);
      expect(service.error()).toBe('Failed to delete PI session');
    });
  });

  describe('loadPlanningView', () => {
    it('should load planning view', async () => {
      const mockView: PiPlanningView = {
        session: createMockSession({ status: 'active' }),
        boards: [
          {
            id: 1,
            boardId: 1,
            jiraBoardId: 101,
            name: 'Team A',
            boardType: 'scrum',
            defaultVelocity: 25,
            velocity: 25,
            sprints: [
              {
                jiraId: 1,
                name: 'Sprint 1',
                state: 'active',
                capacity: 25,
                plannedPoints: 20,
                items: [],
              },
            ],
            backlog: [],
          },
        ],
      };

      const loadPromise = service.loadPlanningView(1, 1);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions/1/view');
      expect(req.request.method).toBe('GET');
      req.flush(mockView);

      await loadPromise;

      expect(service.planningView()).toEqual(mockView);
      expect(service.selectedSession()).toEqual(mockView.session);
    });
  });

  describe('hasSessions computed', () => {
    it('should compute hasSessions correctly', async () => {
      expect(service.hasSessions()).toBe(false);

      const loadPromise = service.loadSessions(1);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      req.flush([createMockSession()]);
      await loadPromise;

      expect(service.hasSessions()).toBe(true);
    });
  });

  describe('selectSession', () => {
    it('should select and deselect session', () => {
      const session = createMockSession({ status: 'active' });

      service.selectSession(session);
      expect(service.selectedSession()).toEqual(session);

      service.selectSession(null);
      expect(service.selectedSession()).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error', async () => {
      const loadPromise = service.loadSessions(1);
      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      req.flush('Error', { status: 500, statusText: 'Server Error' });
      await loadPromise;

      expect(service.error()).not.toBeNull();

      service.clearError();

      expect(service.error()).toBeNull();
    });
  });
});
