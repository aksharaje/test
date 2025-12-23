import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IdeationService } from './ideation.service';
import type { IdeationSession, CreateSessionRequest, SessionDetail, GeneratedIdea } from './ideation.types';

describe('IdeationService', () => {
  let service: IdeationService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/ideation';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IdeationService],
    });

    service = TestBed.inject(IdeationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const request: CreateSessionRequest = {
        problemStatement: 'Test problem statement with enough characters to meet minimum requirements',
        constraints: 'Budget: $50k',
        goals: 'Increase engagement by 30%',
      };

      const mockResponse: IdeationSession = {
        id: 1,
        userId: null,
        problemStatement: request.problemStatement,
        constraints: request.constraints ?? null,
        goals: request.goals ?? null,
        researchInsights: null,
        knowledgeBaseIds: null,
        structuredProblem: null,
        status: 'pending',
        progressStep: 0,
        progressMessage: 'Session created',
        errorMessage: null,
        confidence: 'medium',
        generationMetadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(service.loading()).toBe(false);
    });

    it('should handle errors when creating session', async () => {
      const request: CreateSessionRequest = {
        problemStatement: 'Test',
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      req.flush({ detail: 'Problem statement too short' }, { status: 400, statusText: 'Bad Request' });

      const result = await promise;
      expect(result).toBeNull();
      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
    });

    it('should include knowledge base IDs in request', async () => {
      const request: CreateSessionRequest = {
        problemStatement: 'A'.repeat(120),
        knowledgeBaseIds: [1, 2, 3],
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      expect(req.request.body.knowledgeBaseIds).toEqual([1, 2, 3]);
      req.flush({} as IdeationSession);

      await promise;
    });
  });

  describe('pollSessionStatus', () => {
    it('should poll session status', async () => {
      const mockStatus: IdeationSession = {
        id: 1,
        userId: null,
        problemStatement: 'Test',
        constraints: null,
        goals: null,
        researchInsights: null,
        knowledgeBaseIds: null,
        structuredProblem: null,
        status: 'generating',
        progressStep: 2,
        progressMessage: 'Generating ideas...',
        errorMessage: null,
        confidence: 'medium',
        generationMetadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };

      const promise = service.pollSessionStatus(1);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1/status`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);

      const result = await promise;
      expect(result).toEqual(mockStatus);
    });

    it('should handle polling errors gracefully', async () => {
      const promise = service.pollSessionStatus(1);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1/status`);
      req.error(new ProgressEvent('Network error'));

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('getSessionDetail', () => {
    it('should get session detail with clusters and ideas', async () => {
      const mockDetail: SessionDetail = {
        session: {
          id: 1,
          userId: null,
          problemStatement: 'Test',
          constraints: null,
          goals: null,
          researchInsights: null,
          knowledgeBaseIds: null,
          structuredProblem: null,
          status: 'completed',
          progressStep: 7,
          progressMessage: 'Complete',
          errorMessage: null,
          confidence: 'high',
          generationMetadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        clusters: [
          {
            id: 1,
            sessionId: 1,
            clusterNumber: 1,
            themeName: 'Innovation',
            themeDescription: 'Innovation theme',
            ideaCount: 2,
            ideas: [] as GeneratedIdea[],
          },
        ],
        ideas: [],
      };

      const promise = service.getSessionDetail(1);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);

      const result = await promise;
      expect(result).toEqual(mockDetail);
      expect(service.currentSession()).toEqual(mockDetail);
    });

    it('should handle errors when getting session detail', async () => {
      const promise = service.getSessionDetail(999);

      const req = httpMock.expectOne(`${baseUrl}/sessions/999`);
      req.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });

      const result = await promise;
      expect(result).toBeNull();
      expect(service.error()).toBeTruthy();
    });
  });

  describe('updateIdea', () => {
    it('should update an idea', async () => {
      const updateData = {
        title: 'Updated Title',
        useCases: ['New case 1', 'New case 2'],
      };

      const mockUpdated: GeneratedIdea = {
        id: 1,
        sessionId: 1,
        title: 'Updated Title',
        description: 'Desc',
        category: 'quick_wins',
        effortEstimate: 'medium',
        impactEstimate: 'high',
        clusterId: 1,
        useCases: ['New case 1', 'New case 2'],
        edgeCases: [],
        implementationNotes: [],
        impactScore: null,
        impactRationale: null,
        feasibilityScore: null,
        feasibilityRationale: null,
        effortScore: null,
        effortRationale: null,
        strategicFitScore: null,
        strategicFitRationale: null,
        riskScore: null,
        riskRationale: null,
        compositeScore: null,
        displayOrder: 1,
      };

      const promise = service.updateIdea(1, updateData);

      const req = httpMock.expectOne(`${baseUrl}/ideas/1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(mockUpdated);

      const result = await promise;
      expect(result).toEqual(mockUpdated);
    });

    it('should update currentSession when idea is updated', async () => {
      // Set up current session
      const sessionDetail: SessionDetail = {
        session: {} as IdeationSession,
        clusters: [],
        ideas: [
          {
            id: 1,
            title: 'Original',
            sessionId: 1,
            description: '',
            category: 'quick_wins',
            effortEstimate: 'low',
            impactEstimate: 'high',
            clusterId: null,
            useCases: [],
            edgeCases: [],
            implementationNotes: [],
            impactScore: null,
            impactRationale: null,
            feasibilityScore: null,
            feasibilityRationale: null,
            effortScore: null,
            effortRationale: null,
            strategicFitScore: null,
            strategicFitRationale: null,
            riskScore: null,
            riskRationale: null,
            compositeScore: null,
            displayOrder: 1,
          },
        ],
      };
      service['_currentSession'].set(sessionDetail);

      const promise = service.updateIdea(1, { title: 'Updated' });

      const req = httpMock.expectOne(`${baseUrl}/ideas/1`);
      req.flush({ ...sessionDetail.ideas[0], title: 'Updated' });

      await promise;

      const current = service.currentSession();
      expect(current?.ideas[0].title).toBe('Updated');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const promise = service.deleteSession(1);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Session deleted' });

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should handle deletion errors', async () => {
      const promise = service.deleteSession(999);

      const req = httpMock.expectOne(`${baseUrl}/sessions/999`);
      req.error(new ProgressEvent('Error'));

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('loadKnowledgeBases', () => {
    it('should load knowledge bases', async () => {
      const mockKBs = [
        { id: 1, name: 'KB 1', description: 'First KB' },
        { id: 2, name: 'KB 2', description: 'Second KB' },
      ];

      const promise = service.loadKnowledgeBases();

      const req = httpMock.expectOne('/api/knowledge-bases');
      expect(req.request.method).toBe('GET');
      req.flush(mockKBs);

      await promise;

      expect(service.knowledgeBases().length).toBe(2);
      expect(service.knowledgeBases()[0].name).toBe('KB 1');
    });

    it('should handle errors when loading knowledge bases', async () => {
      const promise = service.loadKnowledgeBases();

      const req = httpMock.expectOne('/api/knowledge-bases');
      req.error(new ProgressEvent('Error'));

      await promise;

      // Should not throw, just log error
      expect(service.knowledgeBases().length).toBe(0);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      service['_error'].set('Some error');
      expect(service.error()).toBe('Some error');

      service.clearError();
      expect(service.error()).toBeNull();
    });
  });
});
