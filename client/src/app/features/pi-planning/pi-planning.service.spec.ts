import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PiPlanningService } from './pi-planning.service';
import type { PiSession, PiPlanningView } from './pi-planning.types';

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
        {
          id: 1,
          integrationId: 1,
          name: 'PI 2024.1',
          description: 'Q1 Planning',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
          sprintCount: 5,
          status: 'draft',
          createdBy: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
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
    it('should create session and update state', async () => {
      const mockSession: PiSession = {
        id: 1,
        integrationId: 1,
        name: 'PI 2024.1',
        description: 'Q1 Planning',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        sprintCount: 5,
        status: 'draft',
        createdBy: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const createPromise = service.createSession(1, {
        name: 'PI 2024.1',
        description: 'Q1 Planning',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        sprintCount: 5,
        boardIds: [1, 2],
      });

      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      expect(req.request.method).toBe('POST');
      req.flush(mockSession);

      const result = await createPromise;

      expect(result).toEqual(mockSession);
      expect(service.sessions()).toContainEqual(mockSession);
    });

    it('should return null on error', async () => {
      const createPromise = service.createSession(1, {
        name: 'PI 2024.1',
        boardIds: [],
      });

      const req = httpMock.expectOne('/api/pi-planning/1/sessions');
      req.flush('Error', { status: 400, statusText: 'Bad Request' });

      const result = await createPromise;

      expect(result).toBeNull();
      expect(service.error()).toBe('Failed to create PI session');
    });
  });

  describe('getSession', () => {
    it('should get single session', async () => {
      const mockSession: PiSession = {
        id: 1,
        integrationId: 1,
        name: 'PI 2024.1',
        description: null,
        startDate: null,
        endDate: null,
        sprintCount: 5,
        status: 'active',
        createdBy: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        boards: [
          {
            id: 1,
            sessionId: 1,
            boardId: 1,
            boardName: 'Team A',
            velocityOverride: null,
            capacityAdjustment: 100,
          },
        ],
      };

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
      // First load sessions
      const initialSession: PiSession = {
        id: 1,
        integrationId: 1,
        name: 'PI 2024.1',
        description: null,
        startDate: null,
        endDate: null,
        sprintCount: 5,
        status: 'draft',
        createdBy: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const loadPromise = service.loadSessions(1);
      const loadReq = httpMock.expectOne('/api/pi-planning/1/sessions');
      loadReq.flush([initialSession]);
      await loadPromise;

      // Now update
      const updatedSession: PiSession = {
        ...initialSession,
        name: 'Updated PI 2024.1',
        status: 'active',
      };

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
      // First load sessions
      const mockSessions: PiSession[] = [
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
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          integrationId: 1,
          name: 'PI 2024.2',
          description: null,
          startDate: null,
          endDate: null,
          sprintCount: 5,
          status: 'draft',
          createdBy: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const loadPromise = service.loadSessions(1);
      const loadReq = httpMock.expectOne('/api/pi-planning/1/sessions');
      loadReq.flush(mockSessions);
      await loadPromise;

      // Now delete
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
        session: {
          id: 1,
          integrationId: 1,
          name: 'PI 2024.1',
          description: null,
          startDate: null,
          endDate: null,
          sprintCount: 5,
          status: 'active',
          createdBy: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        boards: [
          {
            id: 1,
            sessionId: 1,
            boardId: 1,
            boardName: 'Team A',
            velocityOverride: null,
            capacityAdjustment: 100,
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
      req.flush([
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
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);
      await loadPromise;

      expect(service.hasSessions()).toBe(true);
    });
  });

  describe('selectSession', () => {
    it('should select and deselect session', () => {
      const session: PiSession = {
        id: 1,
        integrationId: 1,
        name: 'PI 2024.1',
        description: null,
        startDate: null,
        endDate: null,
        sprintCount: 5,
        status: 'active',
        createdBy: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

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
