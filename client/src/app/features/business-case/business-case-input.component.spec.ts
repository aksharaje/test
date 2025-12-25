import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { BusinessCaseInputComponent } from './business-case-input.component';
import { BusinessCaseService } from './business-case.service';

describe('BusinessCaseInputComponent', () => {
  let component: BusinessCaseInputComponent;
  let fixture: ComponentFixture<BusinessCaseInputComponent>;
  let service: BusinessCaseService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BusinessCaseInputComponent,
        RouterTestingModule,
        HttpClientTestingModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessCaseInputComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(BusinessCaseService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with custom source type when no feasibility sessions', () => {
    // Default to custom when no feasibility sessions are available
    expect(component.sourceType()).toBe('custom');
  });

  describe('source type switching', () => {
    it('should switch source type and clear selections', () => {
      component.setSourceType('feasibility');
      expect(component.sourceType()).toBe('feasibility');

      component.setSourceType('artifact');
      expect(component.sourceType()).toBe('artifact');
      expect(component.selectedFeasibility()).toBeNull();

      component.setSourceType('ideation');
      expect(component.sourceType()).toBe('ideation');
      expect(component.selectedArtifact()).toBeNull();

      component.setSourceType('custom');
      expect(component.sourceType()).toBe('custom');
      expect(component.featureName()).toBe('');
      expect(component.featureDescription()).toBe('');
    });
  });

  describe('canSubmit computed', () => {
    it('should return true for feasibility source when feasibility is selected', () => {
      component.setSourceType('feasibility');
      expect(component.canSubmit()).toBe(false);

      component.selectedFeasibility.set({
        id: 1,
        featureDescription: 'Test',
        fullDescription: 'Full test description',
        goNoGoRecommendation: 'go',
        createdAt: new Date().toISOString(),
      });
      expect(component.canSubmit()).toBe(true);
    });

    it('should require feature name and description for non-feasibility sources', () => {
      component.setSourceType('custom');
      expect(component.canSubmit()).toBe(false);

      component.featureName.set('Valid Name');
      expect(component.canSubmit()).toBe(false);

      component.featureDescription.set('A'.repeat(50));
      expect(component.canSubmit()).toBe(true);

      component.featureName.set('AB');
      expect(component.canSubmit()).toBe(false);
    });

    it('should require minimum 50 characters for description', () => {
      component.setSourceType('custom');
      component.featureName.set('Valid Name');
      component.featureDescription.set('A'.repeat(49));
      expect(component.canSubmit()).toBe(false);

      component.featureDescription.set('A'.repeat(50));
      expect(component.canSubmit()).toBe(true);
    });
  });

  describe('feasibility selection', () => {
    it('should select feasibility from event', () => {
      const mockSession = {
        id: 1,
        featureDescription: 'Test feature',
        fullDescription: 'Full test feature description',
        goNoGoRecommendation: 'go' as const,
        createdAt: new Date().toISOString(),
      };

      // Mock the feasibilitySessions signal
      vi.spyOn(service, 'feasibilitySessions').mockReturnValue([mockSession]);

      const event = { target: { value: '1' } } as unknown as Event;
      component.onFeasibilitySelect(event);

      expect(component.selectedFeasibility()?.id).toBe(1);
    });

    it('should clear feasibility selection', () => {
      component.selectedFeasibility.set({
        id: 1,
        featureDescription: 'Test',
        fullDescription: 'Full test',
        goNoGoRecommendation: 'go',
        createdAt: new Date().toISOString(),
      });

      component.clearFeasibilitySelection();
      expect(component.selectedFeasibility()).toBeNull();
    });
  });

  describe('artifact selection', () => {
    it('should select artifact and populate fields', () => {
      const mockArtifact = {
        id: 1,
        type: 'epic' as const,
        title: 'Test Epic',
        description: 'Test epic description with more content to make it useful',
      };

      vi.spyOn(service, 'epicsAndFeatures').mockReturnValue([mockArtifact]);
      component.setSourceType('artifact');

      const event = { target: { value: '1' } } as unknown as Event;
      component.onArtifactSelect(event);

      expect(component.selectedArtifact()?.id).toBe(1);
      expect(component.featureName()).toBe('Test Epic');
      expect(component.featureDescription()).toContain('Test Epic');
      expect(component.featureDescription()).toContain('Test epic description');
    });

    it('should clear artifact selection and fields', () => {
      component.selectedArtifact.set({
        id: 1,
        type: 'epic',
        title: 'Test',
        description: 'Test',
      });
      component.featureName.set('Test');
      component.featureDescription.set('Test');

      component.clearArtifactSelection();

      expect(component.selectedArtifact()).toBeNull();
      expect(component.featureName()).toBe('');
      expect(component.featureDescription()).toBe('');
    });
  });

  describe('ideation session selection', () => {
    it('should load ideas when session is selected', async () => {
      const loadIdeasSpy = vi.spyOn(service, 'loadIdeationSessionIdeas').mockResolvedValue();

      const event = { target: { value: '1' } } as unknown as Event;
      await component.onIdeationSessionSelect(event);

      expect(component.selectedIdeationSessionId()).toBe(1);
      expect(loadIdeasSpy).toHaveBeenCalledWith(1);
    });

    it('should clear selection when empty value selected', async () => {
      component.selectedIdeationSessionId.set(1);
      const clearSpy = vi.spyOn(service, 'clearIdeationSelection');

      const event = { target: { value: '' } } as unknown as Event;
      await component.onIdeationSessionSelect(event);

      expect(component.selectedIdeationSessionId()).toBeNull();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('input handlers', () => {
    it('should update feature name on input', () => {
      const event = { target: { value: 'Test Feature' } } as unknown as Event;
      component.onFeatureNameInput(event);
      expect(component.featureName()).toBe('Test Feature');
    });

    it('should update feature description on input', () => {
      const event = { target: { value: 'Test description' } } as unknown as Event;
      component.onFeatureDescriptionInput(event);
      expect(component.featureDescription()).toBe('Test description');
    });

    it('should update business context on input', () => {
      const event = { target: { value: 'Enterprise company' } } as unknown as Event;
      component.onBusinessContextInput(event);
      expect(component.businessContext()).toBe('Enterprise company');
    });

    it('should update target market on input', () => {
      const event = { target: { value: 'B2B SaaS' } } as unknown as Event;
      component.onTargetMarketInput(event);
      expect(component.targetMarket()).toBe('B2B SaaS');
    });
  });

  describe('optional fields', () => {
    it('should toggle optional fields', () => {
      expect(component.optionalFieldsOpen()).toBe(false);

      component.toggleOptionalFields();
      expect(component.optionalFieldsOpen()).toBe(true);

      component.toggleOptionalFields();
      expect(component.optionalFieldsOpen()).toBe(false);
    });
  });

  describe('computed values', () => {
    it('should track description character count', () => {
      expect(component.descCharCount()).toBe(0);

      component.featureDescription.set('Hello World');
      expect(component.descCharCount()).toBe(11);

      component.featureDescription.set('A'.repeat(100));
      expect(component.descCharCount()).toBe(100);
    });

    it('should count selected ideas', () => {
      vi.spyOn(service, 'selectedIdeationIdeas').mockReturnValue([
        { id: 1, title: 'A', description: 'B', category: 'c', effortEstimate: 'm', impactEstimate: 'h', selected: true },
        { id: 2, title: 'A', description: 'B', category: 'c', effortEstimate: 'm', impactEstimate: 'h', selected: false },
        { id: 3, title: 'A', description: 'B', category: 'c', effortEstimate: 'm', impactEstimate: 'h', selected: true },
      ]);

      expect(component.selectedIdeaCount()).toBe(2);
    });
  });

  describe('formatting methods', () => {
    it('should format status correctly', () => {
      expect(component.formatStatus('pending')).toBe('Pending');
      expect(component.formatStatus('analyzing')).toBe('Analyzing');
      expect(component.formatStatus('completed')).toBe('Completed');
      expect(component.formatStatus('failed')).toBe('Failed');
      expect(component.formatStatus('unknown')).toBe('unknown');
    });

    it('should format recommendation correctly', () => {
      expect(component.formatRecommendation('go')).toBe('Go');
      expect(component.formatRecommendation('no_go')).toBe('No-Go');
      expect(component.formatRecommendation('conditional')).toBe('Conditional');
    });

    it('should format session recommendation correctly', () => {
      expect(component.formatSessionRecommendation('invest')).toBe('Invest');
      expect(component.formatSessionRecommendation('conditional')).toBe('Conditional');
      expect(component.formatSessionRecommendation('defer')).toBe('Defer');
      expect(component.formatSessionRecommendation('reject')).toBe('Reject');
    });

    it('should format date correctly', () => {
      const now = new Date();

      // Just now
      expect(component.formatDate(now.toISOString())).toBe('Just now');

      // Minutes ago
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(component.formatDate(fiveMinAgo.toISOString())).toBe('5m ago');

      // Hours ago
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      expect(component.formatDate(threeHoursAgo.toISOString())).toBe('3h ago');

      // Days ago
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      expect(component.formatDate(twoDaysAgo.toISOString())).toBe('2d ago');
    });

    it('should format currency correctly', () => {
      expect(component.formatCurrency(1000)).toBe('$1,000');
      expect(component.formatCurrency(1000000)).toBe('$1,000,000');
      expect(component.formatCurrency(-50000)).toBe('-$50,000');
      expect(component.formatCurrency(0)).toBe('$0');
    });
  });
});
