/**
 * Research Planner Service Tests
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ResearchPlannerService } from './research-planner.service';
import {
  ResearchPlanSession,
  SessionDetail,
  SessionStatusResponse,
  AvailableContextSources,
} from './research-planner.types';

describe('ResearchPlannerService', () => {
  let service: ResearchPlannerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ResearchPlannerService],
    });
    service = TestBed.inject(ResearchPlannerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const mockSession: ResearchPlanSession = {
        id: 1,
        objective: 'Test research objective',
        status: 'pending',
        progressStep: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const promise = service.createSession({
        objective: 'Test research objective',
      });

      const req = httpMock.expectOne('/api/cx/research-planner/sessions');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.objective).toBe('Test research objective');
      req.flush(mockSession);

      const result = await promise;
      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');
    });

    it('should include context sources when provided', async () => {
      const mockSession: ResearchPlanSession = {
        id: 1,
        objective: 'Test with context',
        status: 'pending',
        progressStep: 0,
        knowledgeBaseIds: [1, 2],
        ideationSessionId: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const promise = service.createSession({
        objective: 'Test with context',
        knowledgeBaseIds: [1, 2],
        ideationSessionId: 5,
      });

      const req = httpMock.expectOne('/api/cx/research-planner/sessions');
      expect(req.request.body.knowledgeBaseIds).toEqual([1, 2]);
      expect(req.request.body.ideationSessionId).toBe(5);
      req.flush(mockSession);

      const result = await promise;
      expect(result.knowledgeBaseIds).toEqual([1, 2]);
    });
  });

  describe('loadContextSources', () => {
    it('should load available context sources', async () => {
      const mockSources: AvailableContextSources = {
        knowledgeBases: [
          { id: 1, name: 'KB 1', documentCount: 5 },
          { id: 2, name: 'KB 2', documentCount: 10 },
        ],
        ideationSessions: [
          { id: 1, problemStatement: 'Problem 1' },
        ],
        feasibilitySessions: [
          { id: 1, featureDescription: 'Feature 1', goDecision: 'go' },
        ],
        businessCaseSessions: [
          { id: 1, featureName: 'Feature 1', recommendation: 'invest' },
        ],
      };

      const promise = service.loadContextSources();

      const req = httpMock.expectOne('/api/cx/research-planner/context-sources');
      expect(req.request.method).toBe('GET');
      req.flush(mockSources);

      const result = await promise;
      expect(result.knowledgeBases.length).toBe(2);
      expect(result.ideationSessions.length).toBe(1);
      expect(service.contextSources()).toEqual(mockSources);
    });
  });

  describe('pollSessionStatus', () => {
    it('should poll for session status', async () => {
      const mockStatus: SessionStatusResponse = {
        id: 1,
        status: 'recommending',
        progressStep: 1,
        progressMessage: 'Analyzing...',
      };

      const promise = service.pollSessionStatus(1);

      const req = httpMock.expectOne('/api/cx/research-planner/sessions/1/status');
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);

      const result = await promise;
      expect(result.status).toBe('recommending');
      expect(result.progressStep).toBe(1);
    });
  });

  describe('getSessionDetail', () => {
    it('should get full session detail', async () => {
      const mockDetail: SessionDetail = {
        session: {
          id: 1,
          objective: 'Test objective',
          status: 'completed',
          progressStep: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        recommendedMethods: [
          {
            id: 1,
            sessionId: 1,
            methodName: 'user_interviews',
            methodLabel: 'User Interviews',
            rationale: 'Deep insights',
            effort: 'medium',
            costEstimate: '$2000',
            timeline: '2 weeks',
            participantCount: '10',
            confidenceScore: 0.9,
            isSelected: true,
            displayOrder: 0,
            createdAt: new Date().toISOString(),
          },
        ],
        interviewGuides: [],
        surveys: [],
        recruitingPlans: [],
      };

      const promise = service.getSessionDetail(1);

      const req = httpMock.expectOne('/api/cx/research-planner/sessions/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);

      const result = await promise;
      expect(result.session.id).toBe(1);
      expect(result.recommendedMethods.length).toBe(1);
      expect(service.currentSession()).toEqual(mockDetail);
    });
  });

  describe('selectMethods', () => {
    it('should select methods for a session', async () => {
      const mockSession: ResearchPlanSession = {
        id: 1,
        objective: 'Test',
        status: 'selecting',
        progressStep: 2,
        selectedMethods: ['user_interviews', 'surveys'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const promise = service.selectMethods(1, ['user_interviews', 'surveys']);

      const req = httpMock.expectOne('/api/cx/research-planner/sessions/1/select-methods');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.methodNames).toEqual(['user_interviews', 'surveys']);
      req.flush(mockSession);

      const result = await promise;
      expect(result.selectedMethods).toEqual(['user_interviews', 'surveys']);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const promise = service.deleteSession(1);

      const req = httpMock.expectOne('/api/cx/research-planner/sessions/1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear the error signal', () => {
      // Set an error first (internally)
      service.clearError();
      expect(service.error()).toBeNull();
    });
  });

  describe('clearCurrentSession', () => {
    it('should clear the current session signal', () => {
      service.clearCurrentSession();
      expect(service.currentSession()).toBeNull();
    });
  });
});
