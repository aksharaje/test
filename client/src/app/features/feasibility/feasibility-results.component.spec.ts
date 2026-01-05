import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeasibilityResultsComponent } from './feasibility-results.component';
import { FeasibilityService } from './feasibility.service';
import type { SessionDetail, FeasibilitySession, TechnicalComponent, TimelineScenario, RiskAssessment, SkillRequirement } from './feasibility.types';

const createMockSessionDetail = (): SessionDetail => ({
  session: {
    id: 1,
    userId: null,
    featureDescription: 'A comprehensive user authentication system with OAuth support',
    technicalConstraints: 'Must integrate with existing LDAP',
    targetUsers: 'Enterprise clients',
    autoDetectedStack: ['Python', 'FastAPI', 'Angular', 'PostgreSQL'],
    status: 'completed',
    progressStep: 5,
    progressMessage: null,
    errorMessage: null,
    goNoGoRecommendation: 'go',
    executiveSummary: 'This feature is feasible with the current team and infrastructure. Estimated delivery in 4-6 weeks with medium confidence.',
    confidenceLevel: 'medium',
    generationMetadata: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z',
    completedAt: '2024-01-15T12:00:00Z',
  },
  components: [
    {
      id: 1,
      sessionId: 1,
      componentName: 'OAuth Integration',
      componentDescription: 'Implement OAuth 2.0 flow with multiple providers',
      technicalCategory: 'backend',
      optimisticHours: 16,
      realisticHours: 24,
      pessimisticHours: 40,
      confidenceLevel: 'high',
      estimatedByAgent: true,
      isEditable: true,
      dependencies: null,
      canParallelize: false,
      displayOrder: 1,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 2,
      sessionId: 1,
      componentName: 'User Management UI',
      componentDescription: 'Angular components for user profile and settings',
      technicalCategory: 'frontend',
      optimisticHours: 8,
      realisticHours: 16,
      pessimisticHours: 24,
      confidenceLevel: 'high',
      estimatedByAgent: true,
      isEditable: true,
      dependencies: [1],
      canParallelize: true,
      displayOrder: 2,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
  ],
  scenarios: [
    {
      id: 1,
      sessionId: 1,
      scenarioType: 'optimistic',
      totalWeeks: 3,
      sprintCount: 2,
      parallelizationFactor: 0.8,
      overheadPercentage: 0.1,
      teamSizeAssumed: 3,
      confidenceLevel: 'low',
      rationale: 'Best case with experienced team and no blockers.',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 2,
      sessionId: 1,
      scenarioType: 'realistic',
      totalWeeks: 5,
      sprintCount: 3,
      parallelizationFactor: 0.6,
      overheadPercentage: 0.2,
      teamSizeAssumed: 3,
      confidenceLevel: 'medium',
      rationale: 'Standard delivery pace with typical overhead.',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 3,
      sessionId: 1,
      scenarioType: 'pessimistic',
      totalWeeks: 8,
      sprintCount: 4,
      parallelizationFactor: 0.4,
      overheadPercentage: 0.35,
      teamSizeAssumed: 3,
      confidenceLevel: 'high',
      rationale: 'Accounts for learning curve and potential blockers.',
      createdAt: '2024-01-15T10:00:00Z',
    },
  ],
  risks: [
    {
      id: 1,
      sessionId: 1,
      riskCategory: 'technical',
      riskDescription: 'OAuth provider API changes could break integration',
      probability: 0.3,
      impact: 0.7,
      riskScore: 0.21,
      mitigationStrategy: 'Use abstraction layer and monitor provider changelogs',
      displayOrder: 1,
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 2,
      sessionId: 1,
      riskCategory: 'resource',
      riskDescription: 'Team may lack OAuth expertise',
      probability: 0.4,
      impact: 0.5,
      riskScore: 0.2,
      mitigationStrategy: 'Schedule training session or hire consultant',
      displayOrder: 2,
      createdAt: '2024-01-15T10:00:00Z',
    },
  ],
  skills: [
    {
      id: 1,
      sessionId: 1,
      skillName: 'OAuth 2.0',
      proficiencyLevel: 'advanced',
      estimatedPersonWeeks: 3,
      isGap: true,
      gapMitigation: 'Hire contractor with OAuth experience',
      displayOrder: 1,
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 2,
      sessionId: 1,
      skillName: 'Angular',
      proficiencyLevel: 'intermediate',
      estimatedPersonWeeks: 2,
      isGap: false,
      gapMitigation: null,
      displayOrder: 2,
      createdAt: '2024-01-15T10:00:00Z',
    },
  ],
});

describe('FeasibilityResultsComponent', () => {
  let component: FeasibilityResultsComponent;
  let fixture: ComponentFixture<FeasibilityResultsComponent>;
  let mockFeasibilityService: Partial<FeasibilityService>;
  let mockSessionDetail: SessionDetail;

  beforeEach(async () => {
    mockSessionDetail = createMockSessionDetail();

    mockFeasibilityService = {
      currentSession: signal<SessionDetail | null>(mockSessionDetail),
      loading: signal(false),
      error: signal<string | null>(null),
      getSessionDetail: vi.fn().mockResolvedValue(mockSessionDetail),
      updateComponent: vi.fn().mockResolvedValue({} as TechnicalComponent),
    };

    await TestBed.configureTestingModule({
      imports: [FeasibilityResultsComponent],
      providers: [
        provideRouter([]),
        { provide: FeasibilityService, useValue: mockFeasibilityService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'sessionId' ? '1' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeasibilityResultsComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load session detail on init', async () => {
      await component.ngOnInit();
      expect(mockFeasibilityService.getSessionDetail).toHaveBeenCalledWith(1);
    });

    it('should have 5 tabs', () => {
      expect(component.tabs.length).toBe(5);
      expect(component.tabs.map(t => t.id)).toEqual(['summary', 'components', 'timeline', 'risks', 'skills']);
    });

    it('should default to summary tab', () => {
      expect(component.activeTab()).toBe('summary');
    });
  });

  describe('Tab Navigation', () => {
    it('should change active tab', () => {
      component.setActiveTab('components');
      expect(component.activeTab()).toBe('components');

      component.setActiveTab('risks');
      expect(component.activeTab()).toBe('risks');
    });
  });

  describe('Executive Summary Tab', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should display Go recommendation badge', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('GO');
    });

    it('should display executive summary text', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('This feature is feasible');
    });

    it('should display confidence level', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toMatch(/medium/i);
    });

    it('should display key metrics', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('2'); // components count
      expect(content).toContain('40'); // total realistic hours (24 + 16)
    });

    it('should display auto-detected tech stack', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Python');
      expect(content).toContain('FastAPI');
      expect(content).toContain('Angular');
    });
  });

  describe('Components Tab', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      component.setActiveTab('components');
      fixture.detectChanges();
    });

    it('should display component table', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('OAuth Integration');
      expect(content).toContain('User Management UI');
    });

    it('should display hour estimates', () => {
      // Check that input elements have the correct values
      const inputs = fixture.nativeElement.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      const values = Array.from(inputs).map(input => input.value);
      expect(values).toContain('16'); // OAuth optimistic
      expect(values).toContain('24'); // OAuth realistic
      expect(values).toContain('40'); // OAuth pessimistic
    });

    it('should calculate total hours correctly', () => {
      expect(component.totalOptimisticHours()).toBe(24); // 16 + 8
      expect(component.totalRealisticHours()).toBe(40); // 24 + 16
      expect(component.totalPessimisticHours()).toBe(64); // 40 + 24
    });
  });

  describe('Component Editing', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      component.setActiveTab('components');
      fixture.detectChanges();
    });

    it('should track edited components', () => {
      const event = { target: { value: '30' } } as unknown as Event;
      component.onHoursChange(1, 'realisticHours', event);

      expect(component.editedComponents().size).toBe(1);
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should get edited value correctly', () => {
      const event = { target: { value: '30' } } as unknown as Event;
      component.onHoursChange(1, 'realisticHours', event);

      expect(component.getEditedValue(1, 'realisticHours', 24)).toBe(30);
      expect(component.getEditedValue(1, 'optimisticHours', 16)).toBe(16); // not edited
    });

    it('should save all edited components', async () => {
      const event1 = { target: { value: '30' } } as unknown as Event;
      const event2 = { target: { value: '20' } } as unknown as Event;
      component.onHoursChange(1, 'realisticHours', event1);
      component.onHoursChange(2, 'realisticHours', event2);

      await component.saveAllComponents();

      expect(mockFeasibilityService.updateComponent).toHaveBeenCalledTimes(2);
      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Timeline Tab', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      component.setActiveTab('timeline');
      fixture.detectChanges();
    });

    it('should display three scenario cards', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('optimistic');
      expect(content).toContain('realistic');
      expect(content).toContain('pessimistic');
    });

    it('should display scenario details', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('3 weeks'); // optimistic
      expect(content).toContain('5 weeks'); // realistic
      expect(content).toContain('8 weeks'); // pessimistic
    });

    it('should get realistic scenario for summary', () => {
      const realistic = component.realisticScenario();
      expect(realistic?.scenarioType).toBe('realistic');
      expect(realistic?.totalWeeks).toBe(5);
    });
  });

  describe('Risks Tab', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      component.setActiveTab('risks');
      fixture.detectChanges();
    });

    it('should display risks', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('OAuth provider API changes');
      expect(content).toContain('Team may lack OAuth expertise');
    });

    it('should sort risks by score', () => {
      const sorted = component.sortedRisks();
      expect(sorted[0].riskScore).toBeGreaterThanOrEqual(sorted[1].riskScore);
    });

    it('should display mitigation strategies', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('abstraction layer');
      expect(content).toContain('training session');
    });
  });

  describe('Skills Tab', () => {
    beforeEach(async () => {
      await component.ngOnInit();
      component.setActiveTab('skills');
      fixture.detectChanges();
    });

    it('should display skill requirements', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('OAuth 2.0');
      expect(content).toContain('Angular');
    });

    it('should show gap indicators', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Gap');
      expect(content).toContain('Available');
    });

    it('should show gap mitigation for skills with gaps', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Hire contractor');
    });
  });

  describe('Category Formatting', () => {
    it('should format technical categories', () => {
      expect(component.formatCategory('backend')).toBe('Backend');
      expect(component.formatCategory('frontend')).toBe('Frontend');
      expect(component.formatCategory('infrastructure')).toBe('Infrastructure');
      expect(component.formatCategory('data')).toBe('Data');
      expect(component.formatCategory('integration')).toBe('Integration');
    });

    it('should format risk categories', () => {
      expect(component.formatRiskCategory('technical')).toBe('Technical');
      expect(component.formatRiskCategory('resource')).toBe('Resource');
      expect(component.formatRiskCategory('schedule')).toBe('Schedule');
      expect(component.formatRiskCategory('dependency')).toBe('Dependency');
      expect(component.formatRiskCategory('integration')).toBe('Integration');
    });
  });

  describe('Navigation', () => {
    it('should have goBack method', () => {
      expect(typeof component.goBack).toBe('function');
    });
  });

  describe('Business Case Button', () => {
    it('should have buildBusinessCase method', () => {
      expect(typeof component.buildBusinessCase).toBe('function');
    });

    it('should display Build Business Case button', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Build Business Case');
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      (mockFeasibilityService.loading as any).set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });
  });

  describe('No-Go Recommendation', () => {
    it('should display No-Go badge correctly', async () => {
      mockSessionDetail.session.goNoGoRecommendation = 'no_go';
      (mockFeasibilityService.currentSession as any).set(mockSessionDetail);

      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('NO-GO');
    });
  });

  describe('Conditional Recommendation', () => {
    it('should display Conditional badge correctly', async () => {
      mockSessionDetail.session.goNoGoRecommendation = 'conditional';
      (mockFeasibilityService.currentSession as any).set(mockSessionDetail);

      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('CONDITIONAL');
    });
  });

  describe('PDF Export', () => {
    let mockOpen: ReturnType<typeof vi.fn>;
    let mockDocument: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      mockDocument = {
        write: vi.fn(),
        close: vi.fn(),
      };
      mockOpen = vi.fn().mockReturnValue({
        document: mockDocument,
        print: vi.fn(),
      });
      vi.stubGlobal('open', mockOpen);

      await component.ngOnInit();
      fixture.detectChanges();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should have exportToPdf method', () => {
      expect(typeof component.exportToPdf).toBe('function');
    });

    it('should open new window when exporting PDF', () => {
      component.exportToPdf();
      expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    });

    it('should write HTML content to new window', () => {
      component.exportToPdf();
      expect(mockDocument.write).toHaveBeenCalled();
      const htmlContent = mockDocument.write.mock.calls[0][0];
      expect(htmlContent).toContain('<!DOCTYPE html>');
    });

    it('should include session data in PDF', () => {
      component.exportToPdf();
      const htmlContent = mockDocument.write.mock.calls[0][0];

      // Check for executive summary
      expect(htmlContent).toContain('This feature is feasible');

      // Check for GO recommendation
      expect(htmlContent).toContain('GO');

      // Check for components
      expect(htmlContent).toContain('OAuth Integration');
      expect(htmlContent).toContain('User Management UI');

      // Check for timeline scenarios
      expect(htmlContent).toContain('optimistic');
      expect(htmlContent).toContain('realistic');
      expect(htmlContent).toContain('pessimistic');

      // Check for risks
      expect(htmlContent).toContain('OAuth provider API changes');
    });

    it('should include styling in PDF', () => {
      component.exportToPdf();
      const htmlContent = mockDocument.write.mock.calls[0][0];

      // Check for font import
      expect(htmlContent).toContain('fonts.googleapis.com');
      expect(htmlContent).toContain('Inter');

      // Check for primary color
      expect(htmlContent).toContain('#6366f1');
    });

    it('should include footer with Product Studio branding', () => {
      component.exportToPdf();
      const htmlContent = mockDocument.write.mock.calls[0][0];
      expect(htmlContent).toContain('Product Studio');
    });

    it('should close document after writing', () => {
      component.exportToPdf();
      expect(mockDocument.close).toHaveBeenCalled();
    });

    it('should handle null session gracefully', () => {
      (mockFeasibilityService.currentSession as any).set(null);
      fixture.detectChanges();

      // Should not throw
      expect(() => component.exportToPdf()).not.toThrow();
    });

    it('should display Export PDF button when session is completed', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Export PDF');
    });
  });
});
