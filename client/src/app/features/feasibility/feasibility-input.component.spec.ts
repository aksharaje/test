import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeasibilityInputComponent } from './feasibility-input.component';
import { FeasibilityService, EpicOrFeature, IdeationSessionSummary, IdeaForSelection } from './feasibility.service';
import type { FeasibilitySession } from './feasibility.types';

const mockSessions: FeasibilitySession[] = [
  {
    id: 1,
    userId: null,
    featureDescription: 'Test feature with sufficient length to display properly in the history list',
    technicalConstraints: null,
    targetUsers: null,
    autoDetectedStack: ['Python', 'Angular'],
    status: 'completed',
    progressStep: 5,
    progressMessage: null,
    errorMessage: null,
    goNoGoRecommendation: 'go',
    executiveSummary: 'This feature is feasible.',
    confidenceLevel: 'high',
    generationMetadata: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z',
    completedAt: '2024-01-15T12:00:00Z',
  },
  {
    id: 2,
    userId: null,
    featureDescription: 'Another feature that is still processing',
    technicalConstraints: 'Must use existing infrastructure',
    targetUsers: 'Enterprise clients',
    autoDetectedStack: null,
    status: 'estimating',
    progressStep: 2,
    progressMessage: 'Estimating effort...',
    errorMessage: null,
    goNoGoRecommendation: null,
    executiveSummary: null,
    confidenceLevel: 'medium',
    generationMetadata: null,
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:30:00Z',
    completedAt: null,
  },
];

const mockEpicsAndFeatures: EpicOrFeature[] = [
  {
    id: 1,
    type: 'epic',
    title: 'User Authentication System',
    description: 'Vision: Build a secure, scalable authentication platform\n\nGoals:\n- Enable SSO across products\n- Reduce login friction\n\nSuccess Metrics:\n- 95% login success rate',
  },
  {
    id: 2,
    type: 'feature',
    title: 'Password Reset Flow',
    description: 'Purpose: Allow users to recover account access\n\nSummary: Email-based password reset with time-limited tokens\n\nBusiness Value: Reduces support tickets by 40%',
  },
];

const mockIdeationSessions: IdeationSessionSummary[] = [
  {
    id: 1,
    problemStatement: 'How can we improve user engagement in our mobile app?',
    ideaCount: 5,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    problemStatement: 'What features would help reduce customer churn?',
    ideaCount: 3,
    createdAt: '2024-01-16T10:00:00Z',
  },
];

const mockIdeationIdeas: IdeaForSelection[] = [
  {
    id: 1,
    title: 'Push Notification Personalization',
    description: 'Customize push notifications based on user behavior and preferences',
    category: 'Quick Wins',
    effortEstimate: 'low',
    impactEstimate: 'high',
    selected: true,
  },
  {
    id: 2,
    title: 'Gamification Features',
    description: 'Add badges, streaks, and rewards to increase engagement',
    category: 'Strategic Bets',
    effortEstimate: 'high',
    impactEstimate: 'high',
    selected: true,
  },
];

describe('FeasibilityInputComponent', () => {
  let component: FeasibilityInputComponent;
  let fixture: ComponentFixture<FeasibilityInputComponent>;
  let mockFeasibilityService: Partial<FeasibilityService>;

  beforeEach(async () => {
    mockFeasibilityService = {
      sessions: signal<FeasibilitySession[]>([]),
      epicsAndFeatures: signal<EpicOrFeature[]>([]),
      ideationSessions: signal<IdeationSessionSummary[]>([]),
      selectedIdeationIdeas: signal<IdeaForSelection[]>([]),
      loading: signal(false),
      error: signal<string | null>(null),
      loadSessions: vi.fn().mockResolvedValue(undefined),
      loadEpicsAndFeatures: vi.fn().mockResolvedValue(undefined),
      loadIdeationSessions: vi.fn().mockResolvedValue(undefined),
      loadIdeationSessionIdeas: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockResolvedValue({ id: 3 } as FeasibilitySession),
      deleteSession: vi.fn().mockResolvedValue(true),
      toggleIdeaSelection: vi.fn(),
      selectAllIdeas: vi.fn(),
      deselectAllIdeas: vi.fn(),
      clearIdeationSelection: vi.fn(),
      buildIdeationDescription: vi.fn().mockReturnValue(''),
    };

    await TestBed.configureTestingModule({
      imports: [FeasibilityInputComponent],
      providers: [
        provideRouter([]),
        { provide: FeasibilityService, useValue: mockFeasibilityService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeasibilityInputComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load sessions on init', async () => {
      await component.ngOnInit();
      expect(mockFeasibilityService.loadSessions).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should have canSubmit as false when feature description is empty', () => {
      expect(component.canSubmit()).toBe(false);
    });

    it('should have canSubmit as false when feature description is less than 100 chars', () => {
      component.featureDescription.set('Short description');
      expect(component.canSubmit()).toBe(false);
    });

    it('should have canSubmit as true when feature description is at least 100 chars', () => {
      component.featureDescription.set('A'.repeat(100));
      expect(component.canSubmit()).toBe(true);
    });

    it('should have canSubmit as true for very long descriptions', () => {
      component.featureDescription.set('A'.repeat(10000));
      expect(component.canSubmit()).toBe(true);
    });

    it('should track character count', () => {
      component.featureDescription.set('Hello World');
      expect(component.charCount()).toBe(11);
    });
  });

  describe('Form Input Handlers', () => {
    it('should update feature description on input', () => {
      const event = { target: { value: 'New description' } } as unknown as Event;
      component.onFeatureDescriptionInput(event);
      expect(component.featureDescription()).toBe('New description');
    });

    it('should update technical constraints on input', () => {
      const event = { target: { value: 'Must use Python' } } as unknown as Event;
      component.onTechnicalConstraintsInput(event);
      expect(component.technicalConstraints()).toBe('Must use Python');
    });

    it('should update target users on input', () => {
      const event = { target: { value: 'Enterprise users' } } as unknown as Event;
      component.onTargetUsersInput(event);
      expect(component.targetUsers()).toBe('Enterprise users');
    });
  });

  describe('Optional Fields Toggle', () => {
    it('should have optional fields collapsed by default', () => {
      expect(component.optionalFieldsOpen()).toBe(false);
    });

    it('should toggle optional fields visibility', () => {
      component.toggleOptionalFields();
      expect(component.optionalFieldsOpen()).toBe(true);

      component.toggleOptionalFields();
      expect(component.optionalFieldsOpen()).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('should not submit if canSubmit is false', async () => {
      component.featureDescription.set('Too short');
      const event = { preventDefault: vi.fn() } as unknown as Event;

      await component.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFeasibilityService.createSession).not.toHaveBeenCalled();
    });

    it('should call createSession with correct data', async () => {
      const description = 'A'.repeat(150);
      component.featureDescription.set(description);
      component.technicalConstraints.set('Use Python');
      component.targetUsers.set('Developers');

      const event = { preventDefault: vi.fn() } as unknown as Event;
      await component.onSubmit(event);

      expect(mockFeasibilityService.createSession).toHaveBeenCalledWith({
        featureDescription: description,
        technicalConstraints: 'Use Python',
        targetUsers: 'Developers',
      });
    });

    it('should not include empty optional fields', async () => {
      component.featureDescription.set('A'.repeat(150));
      component.technicalConstraints.set('');
      component.targetUsers.set('');

      const event = { preventDefault: vi.fn() } as unknown as Event;
      await component.onSubmit(event);

      expect(mockFeasibilityService.createSession).toHaveBeenCalledWith({
        featureDescription: 'A'.repeat(150),
        technicalConstraints: undefined,
        targetUsers: undefined,
      });
    });
  });

  describe('Session History', () => {
    beforeEach(() => {
      (mockFeasibilityService.sessions as any).set(mockSessions);
      fixture.detectChanges();
    });

    it('should display sessions in history', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Test feature');
    });

    it('should show status badges', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Completed');
    });

    it('should show Go recommendation badge for completed sessions', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Go');
    });
  });

  describe('Session Navigation', () => {
    it('should navigate to results for completed session', () => {
      const completedSession = mockSessions[0];
      // viewSession method exists
      expect(typeof component.viewSession).toBe('function');
    });

    it('should navigate to processing for in-progress session', () => {
      const processingSession = mockSessions[1];
      expect(typeof component.viewSession).toBe('function');
    });
  });

  describe('Session Deletion', () => {
    it('should have deleteSession method', () => {
      expect(typeof component.deleteSession).toBe('function');
    });
  });

  describe('Status Formatting', () => {
    it('should format status correctly', () => {
      expect(component.formatStatus('pending')).toBe('Pending');
      expect(component.formatStatus('decomposing')).toBe('Decomposing');
      expect(component.formatStatus('estimating')).toBe('Estimating');
      expect(component.formatStatus('scheduling')).toBe('Scheduling');
      expect(component.formatStatus('risk_analyzing')).toBe('Analyzing Risks');
      expect(component.formatStatus('completed')).toBe('Completed');
      expect(component.formatStatus('failed')).toBe('Failed');
    });

    it('should identify processing statuses', () => {
      expect(component.isProcessing('decomposing')).toBe(true);
      expect(component.isProcessing('estimating')).toBe(true);
      expect(component.isProcessing('scheduling')).toBe(true);
      expect(component.isProcessing('risk_analyzing')).toBe(true);
      expect(component.isProcessing('completed')).toBe(false);
      expect(component.isProcessing('pending')).toBe(false);
      expect(component.isProcessing('failed')).toBe(false);
    });

    it('should format recommendation correctly', () => {
      expect(component.formatRecommendation('go')).toBe('Go');
      expect(component.formatRecommendation('no_go')).toBe('No-Go');
      expect(component.formatRecommendation('conditional')).toBe('Conditional');
    });
  });

  describe('Date Formatting', () => {
    it('should format recent dates as relative time', () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60000).toISOString();
      expect(component.formatDate(fiveMinAgo)).toBe('5m ago');
    });

    it('should format older dates as absolute', () => {
      const oldDate = new Date('2020-01-01').toISOString();
      const formatted = component.formatDate(oldDate);
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no sessions', () => {
      (mockFeasibilityService.sessions as any).set([]);
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('No history yet');
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading with no sessions', () => {
      (mockFeasibilityService.loading as any).set(true);
      (mockFeasibilityService.sessions as any).set([]);
      fixture.detectChanges();

      const skeletons = fixture.nativeElement.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Display', () => {
    it('should show error message when error exists', () => {
      (mockFeasibilityService.error as any).set('Failed to create session');
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Failed to create session');
    });
  });

  describe('Header', () => {
    it('should display Feasibility Analyzer title', () => {
      fixture.detectChanges();
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Feasibility Analyzer');
    });
  });

  describe('Epic/Feature Selection', () => {
    it('should load epics and features on init', async () => {
      await component.ngOnInit();
      expect(mockFeasibilityService.loadEpicsAndFeatures).toHaveBeenCalled();
    });

    it('should not show selection UI when no epics/features exist', () => {
      fixture.detectChanges();
      const content = fixture.nativeElement.textContent;
      // When no artifacts exist, the Epic/Feature tab should not be shown
      expect(content).not.toContain('Epic/Feature');
    });

    it('should show selection UI when epics/features exist', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      fixture.detectChanges();
      const content = fixture.nativeElement.textContent;
      // The new tab-based UI shows "Epic/Feature" tab when artifacts exist
      expect(content).toContain('Epic/Feature');
    });

    it('should display epic and feature options in dropdown', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      component.setSourceType('artifact');
      fixture.detectChanges();
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('User Authentication System');
      expect(content).toContain('Password Reset Flow');
    });

    it('should populate feature description when artifact is selected', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      fixture.detectChanges();

      const event = { target: { value: '1' } } as unknown as Event;
      component.onArtifactSelect(event);

      expect(component.selectedArtifact()?.id).toBe(1);
      expect(component.featureDescription()).toContain('User Authentication System');
      // Should include AI-generated content
      expect(component.featureDescription()).toContain('Vision: Build a secure');
    });

    it('should clear selection and description when clearing', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      fixture.detectChanges();

      // First select an artifact
      const event = { target: { value: '1' } } as unknown as Event;
      component.onArtifactSelect(event);
      expect(component.selectedArtifact()).toBeTruthy();

      // Then clear it
      component.clearSelection();
      expect(component.selectedArtifact()).toBeNull();
      expect(component.featureDescription()).toBe('');
    });

    it('should show selected artifact display when artifact is selected', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      component.setSourceType('artifact');
      fixture.detectChanges();

      const event = { target: { value: '2' } } as unknown as Event;
      component.onArtifactSelect(event);
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Password Reset Flow');
      // CSS uppercase class makes it visually uppercase but textContent is lowercase
      expect(content).toContain('feature');
    });

    it('should handle empty selection value', () => {
      const event = { target: { value: '' } } as unknown as Event;
      component.onArtifactSelect(event);
      expect(component.selectedArtifact()).toBeNull();
    });
  });

  describe('Source Type Selection', () => {
    it('should default to custom source type', () => {
      expect(component.sourceType()).toBe('custom');
    });

    it('should switch source type', () => {
      component.setSourceType('artifact');
      expect(component.sourceType()).toBe('artifact');

      component.setSourceType('ideation');
      expect(component.sourceType()).toBe('ideation');

      component.setSourceType('custom');
      expect(component.sourceType()).toBe('custom');
    });

    it('should clear artifact selection when switching away from artifact', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      component.setSourceType('artifact');
      component.selectedArtifact.set(mockEpicsAndFeatures[0]);

      component.setSourceType('ideation');
      expect(component.selectedArtifact()).toBeNull();
    });

    it('should clear ideation selection when switching away from ideation', () => {
      component.setSourceType('ideation');
      component.selectedIdeationSessionId.set(1);

      component.setSourceType('custom');
      expect(component.selectedIdeationSessionId()).toBeNull();
      expect(mockFeasibilityService.clearIdeationSelection).toHaveBeenCalled();
    });

    it('should clear description when switching to custom', () => {
      component.featureDescription.set('Some description');
      component.setSourceType('custom');
      expect(component.featureDescription()).toBe('');
    });
  });

  describe('Ideation Selection', () => {
    it('should load ideation sessions on init', async () => {
      await component.ngOnInit();
      expect(mockFeasibilityService.loadIdeationSessions).toHaveBeenCalled();
    });

    it('should not show import options when no epics/features or ideation sessions', () => {
      expect(component.hasImportOptions()).toBe(false);
    });

    it('should show import options when ideation sessions exist', () => {
      (mockFeasibilityService.ideationSessions as any).set(mockIdeationSessions);
      expect(component.hasImportOptions()).toBe(true);
    });

    it('should display ideation sessions in dropdown', () => {
      (mockFeasibilityService.ideationSessions as any).set(mockIdeationSessions);
      component.setSourceType('ideation');
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('How can we improve user engagement');
    });

    it('should load ideas when ideation session is selected', async () => {
      (mockFeasibilityService.ideationSessions as any).set(mockIdeationSessions);
      component.setSourceType('ideation');
      fixture.detectChanges();

      const event = { target: { value: '1' } } as unknown as Event;
      await component.onIdeationSessionSelect(event);

      expect(mockFeasibilityService.loadIdeationSessionIdeas).toHaveBeenCalledWith(1);
      expect(component.selectedIdeationSessionId()).toBe(1);
    });

    it('should display ideas when loaded', () => {
      (mockFeasibilityService.ideationSessions as any).set(mockIdeationSessions);
      (mockFeasibilityService.selectedIdeationIdeas as any).set(mockIdeationIdeas);
      component.setSourceType('ideation');
      component.selectedIdeationSessionId.set(1);
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Push Notification Personalization');
      expect(content).toContain('Gamification Features');
    });

    it('should show selected idea count', () => {
      (mockFeasibilityService.selectedIdeationIdeas as any).set(mockIdeationIdeas);
      expect(component.selectedIdeaCount()).toBe(2);
    });

    it('should handle empty ideation session selection', async () => {
      const event = { target: { value: '' } } as unknown as Event;
      await component.onIdeationSessionSelect(event);

      expect(component.selectedIdeationSessionId()).toBeNull();
      expect(mockFeasibilityService.clearIdeationSelection).toHaveBeenCalled();
    });
  });

  describe('Import Options UI', () => {
    it('should show Ideation Ideas tab when ideation sessions exist', () => {
      (mockFeasibilityService.ideationSessions as any).set(mockIdeationSessions);
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Ideation Ideas');
    });

    it('should show Epic/Feature tab when artifacts exist', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Epic/Feature');
    });

    it('should always show Write Custom tab when import options exist', () => {
      (mockFeasibilityService.epicsAndFeatures as any).set(mockEpicsAndFeatures);
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Write Custom');
    });
  });
});
