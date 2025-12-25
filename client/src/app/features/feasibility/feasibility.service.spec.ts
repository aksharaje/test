import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FeasibilityService } from './feasibility.service';
import type {
  FeasibilitySession,
  SessionDetail,
  TechnicalComponent,
  CreateSessionRequest,
  SessionStatusResponse,
} from './feasibility.types';

describe('FeasibilityService', () => {
  let service: FeasibilityService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/feasibility';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FeasibilityService],
    });

    service = TestBed.inject(FeasibilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const request: CreateSessionRequest = {
        featureDescription: 'A'.repeat(150), // Min 100 chars
        technicalConstraints: 'Must use Python/FastAPI',
        targetUsers: 'Product managers',
      };

      const mockResponse: FeasibilitySession = {
        id: 1,
        userId: null,
        featureDescription: request.featureDescription,
        technicalConstraints: request.technicalConstraints ?? null,
        targetUsers: request.targetUsers ?? null,
        autoDetectedStack: ['Python', 'FastAPI'],
        status: 'pending',
        progressStep: 0,
        progressMessage: 'Session created',
        errorMessage: null,
        goNoGoRecommendation: null,
        executiveSummary: null,
        confidenceLevel: 'medium',
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
        featureDescription: 'Too short',
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      req.flush({ detail: 'Feature description too short' }, { status: 400, statusText: 'Bad Request' });

      const result = await promise;
      expect(result).toBeNull();
      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
    });
  });

  describe('pollSessionStatus', () => {
    it('should poll session status', async () => {
      const mockStatus: SessionStatusResponse = {
        id: 1,
        status: 'decomposing',
        progressStep: 1,
        progressMessage: 'Breaking down into components...',
        errorMessage: null,
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
    it('should get session detail with components, scenarios, risks, and skills', async () => {
      const mockDetail: SessionDetail = {
        session: {
          id: 1,
          userId: null,
          featureDescription: 'Test feature',
          technicalConstraints: null,
          targetUsers: null,
          autoDetectedStack: ['Angular', 'Python'],
          status: 'completed',
          progressStep: 5,
          progressMessage: 'Complete',
          errorMessage: null,
          goNoGoRecommendation: 'go',
          executiveSummary: 'This feature is feasible.',
          confidenceLevel: 'high',
          generationMetadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        components: [
          {
            id: 1,
            sessionId: 1,
            componentName: 'API Endpoints',
            componentDescription: 'REST API implementation',
            technicalCategory: 'backend',
            optimisticHours: 8,
            realisticHours: 16,
            pessimisticHours: 24,
            confidenceLevel: 'high',
            estimatedByAgent: true,
            isEditable: true,
            dependencies: null,
            canParallelize: true,
            displayOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        scenarios: [
          {
            id: 1,
            sessionId: 1,
            scenarioType: 'realistic',
            totalWeeks: 4,
            sprintCount: 2,
            parallelizationFactor: 0.7,
            overheadPercentage: 0.2,
            teamSizeAssumed: 3,
            confidenceLevel: 'medium',
            rationale: 'Based on component estimates with standard overhead.',
            createdAt: new Date().toISOString(),
          },
        ],
        risks: [
          {
            id: 1,
            sessionId: 1,
            riskCategory: 'technical',
            riskDescription: 'API complexity may exceed estimates',
            probability: 0.3,
            impact: 0.6,
            riskScore: 0.18,
            mitigationStrategy: 'Conduct early spike to validate approach',
            displayOrder: 1,
            createdAt: new Date().toISOString(),
          },
        ],
        skills: [
          {
            id: 1,
            sessionId: 1,
            skillName: 'Python/FastAPI',
            proficiencyLevel: 'advanced',
            estimatedPersonWeeks: 2,
            isGap: false,
            gapMitigation: null,
            displayOrder: 1,
            createdAt: new Date().toISOString(),
          },
        ],
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

  describe('loadSessions', () => {
    it('should load all sessions', async () => {
      const mockSessions: FeasibilitySession[] = [
        {
          id: 1,
          userId: null,
          featureDescription: 'Feature 1',
          technicalConstraints: null,
          targetUsers: null,
          autoDetectedStack: null,
          status: 'completed',
          progressStep: 5,
          progressMessage: null,
          errorMessage: null,
          goNoGoRecommendation: 'go',
          executiveSummary: 'Summary 1',
          confidenceLevel: 'high',
          generationMetadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ];

      const promise = service.loadSessions();

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);

      await promise;

      expect(service.sessions().length).toBe(1);
      expect(service.sessions()[0].featureDescription).toBe('Feature 1');
    });

    it('should load sessions for a specific user', async () => {
      const promise = service.loadSessions(123);

      const req = httpMock.expectOne(`${baseUrl}/sessions?user_id=123`);
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await promise;
    });
  });

  describe('updateComponent', () => {
    it('should update a component', async () => {
      const updateData = {
        optimisticHours: 10,
        realisticHours: 20,
        pessimisticHours: 30,
      };

      const mockUpdated: TechnicalComponent = {
        id: 1,
        sessionId: 1,
        componentName: 'API Endpoints',
        componentDescription: 'REST API',
        technicalCategory: 'backend',
        optimisticHours: 10,
        realisticHours: 20,
        pessimisticHours: 30,
        confidenceLevel: 'high',
        estimatedByAgent: false,
        isEditable: true,
        dependencies: null,
        canParallelize: true,
        displayOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // No current session set, so no refresh will happen
      const promise = service.updateComponent(1, updateData);

      const req = httpMock.expectOne(`${baseUrl}/components/1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(mockUpdated);

      const result = await promise;
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session and refresh list', async () => {
      const deletePromise = service.deleteSession(1);

      // First: DELETE request
      const deleteReq = httpMock.expectOne(`${baseUrl}/sessions/1`);
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush({ message: 'Session deleted' });

      // Wait for next tick to allow the loadSessions call
      await new Promise(resolve => setTimeout(resolve, 0));

      // Second: GET request to refresh sessions
      const refreshReq = httpMock.expectOne(`${baseUrl}/sessions`);
      expect(refreshReq.request.method).toBe('GET');
      refreshReq.flush([]);

      const result = await deletePromise;
      expect(result).toBe(true);
    });

    it('should return false on deletion error', async () => {
      const promise = service.deleteSession(999);

      const req = httpMock.expectOne(`${baseUrl}/sessions/999`);
      req.error(new ProgressEvent('Error'));

      const result = await promise;
      expect(result).toBe(false);
      expect(service.error()).toBeTruthy();
    });
  });

  describe('captureActuals', () => {
    it('should capture actual results', async () => {
      const request = {
        actuals: [
          { componentId: 1, actualHoursSpent: 18, lessonsLearned: 'Took longer than expected' },
        ],
        recordedByUserId: 123,
      };

      const promise = service.captureActuals(1, request);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1/actuals`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ message: 'Actuals captured' });

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should handle capture actuals errors', async () => {
      const promise = service.captureActuals(1, { actuals: [] });

      const req = httpMock.expectOne(`${baseUrl}/sessions/1/actuals`);
      req.error(new ProgressEvent('Error'));

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      // First trigger an error by making a failed request
      const errorPromise = service.createSession({ featureDescription: 'test' });
      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      req.flush({ detail: 'Error' }, { status: 400, statusText: 'Bad Request' });
      await errorPromise;

      expect(service.error()).toBeTruthy();

      service.clearError();
      expect(service.error()).toBeNull();
    });
  });

  describe('loadEpicsAndFeatures', () => {
    it('should load and filter epics and features from story generator', async () => {
      const mockArtifacts = [
        {
          id: 1,
          type: 'epic',
          title: 'Epic One',
          content: JSON.stringify({
            type: 'epic',
            epic: {
              title: 'Epic One',
              vision: 'Build a comprehensive platform',
              goals: ['Increase engagement', 'Reduce churn'],
              successMetrics: ['10% increase in DAU'],
              risksAndDependencies: 'Requires API team support',
              features: [{ title: 'Feature A' }, { title: 'Feature B' }],
            },
          }),
          inputDescription: 'Input description',
        },
        {
          id: 2,
          type: 'feature',
          title: 'Feature One',
          content: JSON.stringify({
            type: 'feature',
            feature: {
              title: 'Feature One',
              purpose: 'Enable user authentication',
              summary: 'OAuth-based login system',
              businessValue: 'Reduces friction for new users',
              functionalRequirements: 'Support Google and GitHub OAuth',
              nonFunctionalRequirements: 'Response time under 200ms',
              dependencies: 'Auth service must be deployed',
              assumptions: 'Users have existing OAuth accounts',
              acceptanceCriteria: [],
              stories: [],
            },
          }),
          inputDescription: 'Feature input',
        },
        {
          id: 3,
          type: 'user_story',
          title: 'User Story',
          content: '{}',
          inputDescription: 'Story input',
        },
      ];

      const promise = service.loadEpicsAndFeatures();

      const req = httpMock.expectOne('/api/story-generator');
      expect(req.request.method).toBe('GET');
      req.flush(mockArtifacts);

      await promise;

      // Should only have epics and features, not user stories
      expect(service.epicsAndFeatures().length).toBe(2);
      expect(service.epicsAndFeatures()[0].type).toBe('epic');
      expect(service.epicsAndFeatures()[1].type).toBe('feature');

      // Epic should have AI-generated content
      expect(service.epicsAndFeatures()[0].description).toContain('Vision: Build a comprehensive platform');
      expect(service.epicsAndFeatures()[0].description).toContain('Goals:');
      expect(service.epicsAndFeatures()[0].description).toContain('- Increase engagement');

      // Feature should have AI-generated content
      expect(service.epicsAndFeatures()[1].description).toContain('Purpose: Enable user authentication');
      expect(service.epicsAndFeatures()[1].description).toContain('Summary: OAuth-based login system');
    });

    it('should use inputDescription when content parsing fails', async () => {
      const mockArtifacts = [
        {
          id: 1,
          type: 'epic',
          title: 'Epic One',
          content: 'invalid json',
          inputDescription: 'Fallback description',
        },
      ];

      const promise = service.loadEpicsAndFeatures();

      const req = httpMock.expectOne('/api/story-generator');
      req.flush(mockArtifacts);

      await promise;

      expect(service.epicsAndFeatures()[0].description).toBe('Fallback description');
    });

    it('should set empty array on error', async () => {
      const promise = service.loadEpicsAndFeatures();

      const req = httpMock.expectOne('/api/story-generator');
      req.error(new ProgressEvent('Network error'));

      await promise;

      expect(service.epicsAndFeatures()).toEqual([]);
      // Should not set global error for this optional data
      expect(service.error()).toBeNull();
    });
  });

  describe('loadIdeationSessions', () => {
    it('should load and filter completed ideation sessions', async () => {
      const mockSessions = [
        { id: 1, problemStatement: 'Problem 1', status: 'completed', createdAt: '2024-01-15T10:00:00Z' },
        { id: 2, problemStatement: 'Problem 2', status: 'pending', createdAt: '2024-01-15T11:00:00Z' },
        { id: 3, problemStatement: 'Problem 3', status: 'completed', createdAt: '2024-01-15T12:00:00Z' },
      ];

      const promise = service.loadIdeationSessions();

      const req = httpMock.expectOne('/api/ideation/sessions');
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);

      await promise;

      // Should only have completed sessions
      expect(service.ideationSessions().length).toBe(2);
      expect(service.ideationSessions()[0].id).toBe(1);
      expect(service.ideationSessions()[1].id).toBe(3);
    });

    it('should set empty array on error', async () => {
      const promise = service.loadIdeationSessions();

      const req = httpMock.expectOne('/api/ideation/sessions');
      req.error(new ProgressEvent('Network error'));

      await promise;

      expect(service.ideationSessions()).toEqual([]);
    });
  });

  describe('loadIdeationSessionIdeas', () => {
    it('should load ideas from session and select all by default', async () => {
      const mockDetail = {
        session: { id: 1, problemStatement: 'Problem 1', status: 'completed' },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'Desc 1', category: 'quick_wins', effortEstimate: 'low', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Desc 2', category: 'strategic_bets', effortEstimate: 'high', impactEstimate: 'high' },
        ],
        clusters: [],
      };

      const promise = service.loadIdeationSessionIdeas(1);

      const req = httpMock.expectOne('/api/ideation/sessions/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);

      await promise;

      expect(service.selectedIdeationIdeas().length).toBe(2);
      expect(service.selectedIdeationIdeas()[0].selected).toBe(true);
      expect(service.selectedIdeationIdeas()[1].selected).toBe(true);
      expect(service.selectedIdeationIdeas()[0].category).toBe('Quick Wins');
    });
  });

  describe('idea selection management', () => {
    beforeEach(async () => {
      const mockDetail = {
        session: { id: 1, problemStatement: 'Problem 1', status: 'completed' },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'Desc 1', category: 'quick_wins', effortEstimate: 'low', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Desc 2', category: 'strategic_bets', effortEstimate: 'high', impactEstimate: 'high' },
        ],
        clusters: [],
      };

      const promise = service.loadIdeationSessionIdeas(1);
      const req = httpMock.expectOne('/api/ideation/sessions/1');
      req.flush(mockDetail);
      await promise;
    });

    it('should toggle idea selection', () => {
      expect(service.selectedIdeationIdeas()[0].selected).toBe(true);
      service.toggleIdeaSelection(1);
      expect(service.selectedIdeationIdeas()[0].selected).toBe(false);
      service.toggleIdeaSelection(1);
      expect(service.selectedIdeationIdeas()[0].selected).toBe(true);
    });

    it('should select all ideas', () => {
      service.deselectAllIdeas();
      expect(service.selectedIdeationIdeas().every(i => !i.selected)).toBe(true);
      service.selectAllIdeas();
      expect(service.selectedIdeationIdeas().every(i => i.selected)).toBe(true);
    });

    it('should deselect all ideas', () => {
      service.deselectAllIdeas();
      expect(service.selectedIdeationIdeas().every(i => !i.selected)).toBe(true);
    });

    it('should clear ideation selection', () => {
      service.clearIdeationSelection();
      expect(service.selectedIdeationIdeas()).toEqual([]);
    });
  });

  describe('buildIdeationDescription', () => {
    beforeEach(async () => {
      const mockDetail = {
        session: { id: 1, problemStatement: 'Problem 1', status: 'completed' },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'First idea description', category: 'quick_wins', effortEstimate: 'low', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Second idea description', category: 'strategic_bets', effortEstimate: 'high', impactEstimate: 'high' },
        ],
        clusters: [],
      };

      const promise = service.loadIdeationSessionIdeas(1);
      const req = httpMock.expectOne('/api/ideation/sessions/1');
      req.flush(mockDetail);
      await promise;
    });

    it('should build description from selected ideas', () => {
      const description = service.buildIdeationDescription();
      expect(description).toContain('## 1. Idea 1');
      expect(description).toContain('First idea description');
      expect(description).toContain('## 2. Idea 2');
      expect(description).toContain('Second idea description');
    });

    it('should only include selected ideas', () => {
      service.toggleIdeaSelection(1);  // Deselect first idea
      const description = service.buildIdeationDescription();
      expect(description).not.toContain('Idea 1');
      expect(description).toContain('## 1. Idea 2');
    });

    it('should return empty string if no ideas selected', () => {
      service.deselectAllIdeas();
      const description = service.buildIdeationDescription();
      expect(description).toBe('');
    });
  });
});
