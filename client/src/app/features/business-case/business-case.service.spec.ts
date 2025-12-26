import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BusinessCaseService } from './business-case.service';
import type {
  BusinessCaseSession,
  SessionDetail,
  CostItem,
  BenefitItem,
  CreateSessionRequest,
  SessionStatusResponse,
} from './business-case.types';

describe('BusinessCaseService', () => {
  let service: BusinessCaseService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/business-case';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BusinessCaseService],
    });

    service = TestBed.inject(BusinessCaseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const request: CreateSessionRequest = {
        featureName: 'AI Recommendation Engine',
        featureDescription: 'Build an AI-powered recommendation engine for e-commerce',
        businessContext: 'Mid-size e-commerce company',
        targetMarket: 'B2C retail',
      };

      const mockResponse: BusinessCaseSession = {
        id: 1,
        userId: null,
        feasibilitySessionId: null,
        featureName: 'AI Recommendation Engine',
        featureDescription: 'Build an AI-powered recommendation engine for e-commerce',
        businessContext: request.businessContext ?? null,
        targetMarket: request.targetMarket ?? null,
        status: 'pending',
        progressStep: 0,
        progressMessage: 'Session created',
        errorMessage: null,
        executiveSummary: null,
        recommendation: null,
        confidenceLevel: 'medium',
        totalInvestment: null,
        netPresentValue: null,
        internalRateOfReturn: null,
        paybackMonths: null,
        roiPercentage: null,
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
        featureName: 'AB',  // Too short
        featureDescription: 'Too short',
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      req.flush({ detail: 'Feature name too short' }, { status: 422, statusText: 'Unprocessable Entity' });

      const result = await promise;
      expect(result).toBeNull();
      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
    });

    it('should create session with feasibility link', async () => {
      const request: CreateSessionRequest = {
        featureName: 'Linked Feature',
        featureDescription: 'A feature linked to existing feasibility analysis',
        feasibilitySessionId: 123,
      };

      const mockResponse: BusinessCaseSession = {
        id: 1,
        userId: null,
        feasibilitySessionId: 123,
        featureName: 'Linked Feature',
        featureDescription: 'A feature linked to existing feasibility analysis',
        businessContext: null,
        targetMarket: null,
        status: 'pending',
        progressStep: 0,
        progressMessage: null,
        errorMessage: null,
        executiveSummary: null,
        recommendation: null,
        confidenceLevel: 'medium',
        totalInvestment: null,
        netPresentValue: null,
        internalRateOfReturn: null,
        paybackMonths: null,
        roiPercentage: null,
        generationMetadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      expect(req.request.body.feasibilitySessionId).toBe(123);
      req.flush(mockResponse);

      const result = await promise;
      expect(result?.feasibilitySessionId).toBe(123);
    });
  });

  describe('pollSessionStatus', () => {
    it('should poll session status', async () => {
      const mockStatus: SessionStatusResponse = {
        id: 1,
        status: 'analyzing',
        progressStep: 2,
        progressMessage: 'Estimating development costs...',
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
    it('should get session detail with all data', async () => {
      const mockDetail: SessionDetail = {
        session: {
          id: 1,
          userId: null,
          feasibilitySessionId: null,
          featureName: 'Test Feature',
          featureDescription: 'Test description',
          businessContext: null,
          targetMarket: null,
          status: 'completed',
          progressStep: 6,
          progressMessage: 'Complete',
          errorMessage: null,
          executiveSummary: 'This feature is a good investment.',
          recommendation: 'invest',
          confidenceLevel: 'high',
          totalInvestment: 150000,
          netPresentValue: 250000,
          internalRateOfReturn: 35.5,
          paybackMonths: 18,
          roiPercentage: 120,
          generationMetadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        costs: [
          {
            id: 1,
            sessionId: 1,
            costCategory: 'development',
            costType: 'one_time',
            itemName: 'Development Cost',
            itemDescription: 'Initial development',
            optimisticAmount: 80000,
            realisticAmount: 100000,
            pessimisticAmount: 150000,
            dataSource: 'ai_estimate',
            confidenceLevel: 'medium',
            sourceReference: null,
            isUserOverride: false,
            originalEstimate: null,
            displayOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        benefits: [
          {
            id: 1,
            sessionId: 1,
            benefitCategory: 'revenue_increase',
            benefitType: 'quantifiable',
            itemName: 'Revenue Increase',
            itemDescription: 'Additional revenue',
            optimisticAmount: 100000,
            realisticAmount: 75000,
            pessimisticAmount: 50000,
            recurrence: 'annual',
            timeToRealizeMonths: 6,
            dataSource: 'ai_estimate',
            confidenceLevel: 'medium',
            sourceReference: null,
            isUserOverride: false,
            originalEstimate: null,
            displayOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        scenarios: [
          {
            id: 1,
            sessionId: 1,
            scenarioType: 'base',
            totalOneTimeCosts: 100000,
            totalRecurringAnnualCosts: 24000,
            totalInvestmentYear1: 124000,
            totalInvestment5Year: 220000,
            totalAnnualBenefitsYear1: 50000,
            totalAnnualBenefitsYear3: 75000,
            totalBenefits5Year: 350000,
            netPresentValue: 250000,
            internalRateOfReturn: 35.5,
            paybackPeriodMonths: 18,
            roiPercentage: 120,
            discountRate: 0.1,
            projectionYears: 5,
            benefitGrowthRate: 0.05,
            rationale: 'Base scenario with realistic estimates',
            confidenceLevel: 'medium',
            yearlyCashFlows: [
              { year: 1, benefits: 50000, costs: 124000, netCashFlow: -74000, discountedCashFlow: -67273, cumulativeNpv: -67273 },
            ],
            createdAt: new Date().toISOString(),
          },
        ],
        assumptions: [
          {
            id: 1,
            sessionId: 1,
            assumptionCategory: 'market',
            assumptionText: 'Market demand remains stable',
            impactIfWrong: 'high',
            validationStatus: 'unvalidated',
            validationNotes: null,
            dataSource: 'ai_estimate',
            sourceReference: null,
            displayOrder: 0,
            createdAt: new Date().toISOString(),
          },
        ],
        sensitivity: [
          {
            id: 1,
            sessionId: 1,
            variableName: 'Development Cost',
            variableType: 'cost',
            baseValue: 100000,
            lowValue: 80000,
            highValue: 120000,
            npvAtLow: 270000,
            npvAtHigh: 230000,
            npvSensitivity: 2000,
            isCritical: false,
            displayOrder: 0,
            createdAt: new Date().toISOString(),
          },
        ],
        rates: [],
        feasibility: null,
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
      const mockSessions: BusinessCaseSession[] = [
        {
          id: 1,
          userId: null,
          feasibilitySessionId: null,
          featureName: 'Feature 1',
          featureDescription: 'Description 1',
          businessContext: null,
          targetMarket: null,
          status: 'completed',
          progressStep: 6,
          progressMessage: null,
          errorMessage: null,
          executiveSummary: 'Summary 1',
          recommendation: 'invest',
          confidenceLevel: 'high',
          totalInvestment: 100000,
          netPresentValue: 200000,
          internalRateOfReturn: 25,
          paybackMonths: 24,
          roiPercentage: 100,
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
      expect(service.sessions()[0].featureName).toBe('Feature 1');
    });

    it('should load sessions for a specific user', async () => {
      const promise = service.loadSessions(123);

      const req = httpMock.expectOne(`${baseUrl}/sessions?user_id=123`);
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await promise;
    });
  });

  describe('updateCost', () => {
    it('should update a cost item', async () => {
      const updateData = {
        realisticAmount: 120000,
      };

      const mockUpdated: CostItem = {
        id: 1,
        sessionId: 1,
        costCategory: 'development',
        costType: 'one_time',
        itemName: 'Development',
        itemDescription: 'Initial development',
        optimisticAmount: 80000,
        realisticAmount: 120000,
        pessimisticAmount: 150000,
        dataSource: 'user_input',
        confidenceLevel: 'medium',
        sourceReference: null,
        isUserOverride: true,
        originalEstimate: 100000,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const promise = service.updateCost(1, updateData);

      const req = httpMock.expectOne(`${baseUrl}/costs/1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(mockUpdated);

      const result = await promise;
      expect(result).toEqual(mockUpdated);
      expect(result?.isUserOverride).toBe(true);
      expect(result?.originalEstimate).toBe(100000);
    });
  });

  describe('updateBenefit', () => {
    it('should update a benefit item', async () => {
      const updateData = {
        realisticAmount: 90000,
      };

      const mockUpdated: BenefitItem = {
        id: 1,
        sessionId: 1,
        benefitCategory: 'revenue_increase',
        benefitType: 'quantifiable',
        itemName: 'Revenue',
        itemDescription: 'Additional revenue',
        optimisticAmount: 100000,
        realisticAmount: 90000,
        pessimisticAmount: 50000,
        recurrence: 'annual',
        timeToRealizeMonths: 6,
        dataSource: 'user_input',
        confidenceLevel: 'medium',
        sourceReference: null,
        isUserOverride: true,
        originalEstimate: 75000,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const promise = service.updateBenefit(1, updateData);

      const req = httpMock.expectOne(`${baseUrl}/benefits/1`);
      expect(req.request.method).toBe('PATCH');
      req.flush(mockUpdated);

      const result = await promise;
      expect(result?.isUserOverride).toBe(true);
    });
  });

  describe('saveLearning', () => {
    it('should save user learning', async () => {
      const request = {
        learningType: 'cost_correction',
        category: 'development',
        originalValue: 100000,
        correctedValue: 120000,
        context: 'Development costs typically 20% higher',
        userId: 1,
      };

      const promise = service.saveLearning(1, request);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1/learning`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ success: true, learningId: 1 });

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('recalculateFinancials', () => {
    it('should trigger financial recalculation', async () => {
      const promise = service.recalculateFinancials(1);

      const req = httpMock.expectOne(`${baseUrl}/sessions/1/recalculate`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, message: 'Recalculation started' });

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session and refresh list', async () => {
      const deletePromise = service.deleteSession(1);

      // First: DELETE request
      const deleteReq = httpMock.expectOne(`${baseUrl}/sessions/1`);
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush({ success: true });

      // Wait for next tick
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

  describe('loadFeasibilitySessions', () => {
    it('should load completed feasibility sessions', async () => {
      const mockSessions = [
        { id: 1, featureDescription: 'Feature 1', status: 'completed', goNoGoRecommendation: 'go', createdAt: '2024-01-15T10:00:00Z' },
        { id: 2, featureDescription: 'Feature 2', status: 'pending', goNoGoRecommendation: null, createdAt: '2024-01-15T11:00:00Z' },
        { id: 3, featureDescription: 'Feature 3', status: 'completed', goNoGoRecommendation: 'conditional', createdAt: '2024-01-15T12:00:00Z' },
      ];

      const promise = service.loadFeasibilitySessions();

      const req = httpMock.expectOne('/api/feasibility/sessions');
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);

      await promise;

      // Should only have completed sessions
      expect(service.feasibilitySessions().length).toBe(2);
      expect(service.feasibilitySessions()[0].id).toBe(1);
      expect(service.feasibilitySessions()[1].id).toBe(3);
    });

    it('should set empty array on error', async () => {
      const promise = service.loadFeasibilitySessions();

      const req = httpMock.expectOne('/api/feasibility/sessions');
      req.error(new ProgressEvent('Network error'));

      await promise;

      expect(service.feasibilitySessions()).toEqual([]);
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      // Trigger an error
      const errorPromise = service.createSession({ featureName: 'AB', featureDescription: 'test' });
      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      req.flush({ detail: 'Error' }, { status: 422, statusText: 'Unprocessable Entity' });
      await errorPromise;

      expect(service.error()).toBeTruthy();

      service.clearError();
      expect(service.error()).toBeNull();
    });
  });

  describe('createSession with feasibility only', () => {
    it('should create session with only feasibility ID', async () => {
      const request: CreateSessionRequest = {
        feasibilitySessionId: 123,
      };

      const mockResponse: BusinessCaseSession = {
        id: 1,
        userId: null,
        feasibilitySessionId: 123,
        featureName: 'Derived Feature Name',
        featureDescription: 'Description from feasibility analysis that is at least 50 characters long.',
        businessContext: null,
        targetMarket: null,
        status: 'pending',
        progressStep: 0,
        progressMessage: null,
        errorMessage: null,
        executiveSummary: null,
        recommendation: null,
        confidenceLevel: 'medium',
        totalInvestment: null,
        netPresentValue: null,
        internalRateOfReturn: null,
        paybackMonths: null,
        roiPercentage: null,
        generationMetadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };

      const promise = service.createSession(request);

      const req = httpMock.expectOne(`${baseUrl}/sessions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.feasibilitySessionId).toBe(123);
      expect(req.request.body.featureName).toBeUndefined();
      expect(req.request.body.featureDescription).toBeUndefined();
      req.flush(mockResponse);

      const result = await promise;
      expect(result?.feasibilitySessionId).toBe(123);
      expect(result?.featureName).toBe('Derived Feature Name');
    });
  });

  describe('loadEpicsAndFeatures', () => {
    it('should load and filter epics and features', async () => {
      const mockArtifacts = [
        { id: 1, type: 'epic', title: 'Epic 1', content: '{"epic": {"vision": "Test vision"}}', inputDescription: 'Epic input' },
        { id: 2, type: 'feature', title: 'Feature 1', content: '{"feature": {"purpose": "Test purpose"}}', inputDescription: 'Feature input' },
        { id: 3, type: 'user_story', title: 'Story 1', content: '{}', inputDescription: 'Story input' }, // Should be filtered out
      ];

      const promise = service.loadEpicsAndFeatures();

      const req = httpMock.expectOne('/api/story-generator');
      expect(req.request.method).toBe('GET');
      req.flush(mockArtifacts);

      await promise;

      expect(service.epicsAndFeatures().length).toBe(2);
      expect(service.epicsAndFeatures()[0].type).toBe('epic');
      expect(service.epicsAndFeatures()[1].type).toBe('feature');
    });

    it('should set empty array on error', async () => {
      const promise = service.loadEpicsAndFeatures();

      const req = httpMock.expectOne('/api/story-generator');
      req.error(new ProgressEvent('Network error'));

      await promise;

      expect(service.epicsAndFeatures()).toEqual([]);
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
    it('should load ideas for a session', async () => {
      const mockDetail = {
        session: { id: 1 },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'Desc 1', category: 'core', effortEstimate: 'medium', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Desc 2', category: 'growth', effortEstimate: 'low', impactEstimate: 'medium' },
        ],
      };

      const promise = service.loadIdeationSessionIdeas(1);

      const req = httpMock.expectOne('/api/ideation/sessions/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);

      await promise;

      expect(service.selectedIdeationIdeas().length).toBe(2);
      // All ideas should be pre-selected
      expect(service.selectedIdeationIdeas().every(i => i.selected)).toBe(true);
    });

    it('should set empty array on error', async () => {
      const promise = service.loadIdeationSessionIdeas(999);

      const req = httpMock.expectOne('/api/ideation/sessions/999');
      req.error(new ProgressEvent('Network error'));

      await promise;

      expect(service.selectedIdeationIdeas()).toEqual([]);
    });
  });

  describe('idea selection methods', () => {
    beforeEach(async () => {
      const mockDetail = {
        session: { id: 1 },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'Desc 1', category: 'core', effortEstimate: 'medium', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Desc 2', category: 'growth', effortEstimate: 'low', impactEstimate: 'medium' },
        ],
      };

      const promise = service.loadIdeationSessionIdeas(1);
      const req = httpMock.expectOne('/api/ideation/sessions/1');
      req.flush(mockDetail);
      await promise;
    });

    it('should toggle individual idea selection', () => {
      expect(service.selectedIdeationIdeas()[0].selected).toBe(true);

      service.toggleIdeaSelection(1);

      expect(service.selectedIdeationIdeas()[0].selected).toBe(false);
      expect(service.selectedIdeationIdeas()[1].selected).toBe(true);
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
    it('should build description from selected ideas', async () => {
      const mockDetail = {
        session: { id: 1 },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'Desc 1', category: 'core', effortEstimate: 'medium', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Desc 2', category: 'growth', effortEstimate: 'low', impactEstimate: 'medium' },
        ],
      };

      const promise = service.loadIdeationSessionIdeas(1);
      const req = httpMock.expectOne('/api/ideation/sessions/1');
      req.flush(mockDetail);
      await promise;

      const description = service.buildIdeationDescription();

      expect(description).toContain('## Idea 1');
      expect(description).toContain('Desc 1');
      expect(description).toContain('## Idea 2');
      expect(description).toContain('Desc 2');
    });

    it('should only include selected ideas', async () => {
      const mockDetail = {
        session: { id: 1 },
        ideas: [
          { id: 1, title: 'Idea 1', description: 'Desc 1', category: 'core', effortEstimate: 'medium', impactEstimate: 'high' },
          { id: 2, title: 'Idea 2', description: 'Desc 2', category: 'growth', effortEstimate: 'low', impactEstimate: 'medium' },
        ],
      };

      const promise = service.loadIdeationSessionIdeas(1);
      const req = httpMock.expectOne('/api/ideation/sessions/1');
      req.flush(mockDetail);
      await promise;

      service.toggleIdeaSelection(1); // Deselect idea 1

      const description = service.buildIdeationDescription();

      expect(description).not.toContain('## Idea 1');
      expect(description).toContain('## Idea 2');
    });

    it('should return empty string when no ideas selected', () => {
      service.clearIdeationSelection();
      const description = service.buildIdeationDescription();
      expect(description).toBe('');
    });
  });
});
