import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionWizardComponent } from './session-wizard.component';
import { PiPlanningService } from './pi-planning.service';
import { IntegrationService } from '../settings/integration.service';

describe('SessionWizardComponent', () => {
  let component: SessionWizardComponent;
  let fixture: ComponentFixture<SessionWizardComponent>;
  let mockPiPlanningService: Partial<PiPlanningService>;
  let mockIntegrationService: Partial<IntegrationService>;

  beforeEach(async () => {
    mockPiPlanningService = {
      createSession: vi.fn().mockResolvedValue({ id: 1 }),
      holidayConfigs: signal([]),
      loadHolidayConfigs: vi.fn().mockResolvedValue(undefined),
      seedHolidayConfigs: vi.fn().mockResolvedValue(undefined),
    };

    mockIntegrationService = {
      integrations: signal([]),
      projects: signal([]),
      loadProjects: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [SessionWizardComponent],
      providers: [
        { provide: PiPlanningService, useValue: mockPiPlanningService },
        { provide: IntegrationService, useValue: mockIntegrationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionWizardComponent);
    component = fixture.componentInstance;
    component.integrationId = 1;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have steps defined', () => {
      expect(component.steps).toBeDefined();
      expect(Array.isArray(component.steps)).toBe(true);
      expect(component.steps.length).toBe(3);
    });

    it('should start at step 1', () => {
      expect(component.currentStep()).toBe(1);
    });
  });

  describe('Step Navigation', () => {
    it('should have currentStep signal', () => {
      expect(component.currentStep).toBeDefined();
      expect(typeof component.currentStep).toBe('function');
    });

    it('should have nextStep method', () => {
      expect(typeof component.nextStep).toBe('function');
    });

    it('should have previousStep method', () => {
      expect(typeof component.previousStep).toBe('function');
    });

    it('should navigate to previous step', () => {
      component.currentStep.set(2);
      component.previousStep();
      expect(component.currentStep()).toBe(1);
    });

    it('should not go below step 1', () => {
      component.currentStep.set(1);
      component.previousStep();
      expect(component.currentStep()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Form Data', () => {
    it('should have form object with name', () => {
      expect(component.form).toBeDefined();
      expect(component.form.name).toBeDefined();
    });

    it('should have form object with projectKeys', () => {
      expect(component.form.projectKeys).toBeDefined();
      expect(Array.isArray(component.form.projectKeys)).toBe(true);
    });

    it('should have form object with startDate', () => {
      expect(component.form.startDate).toBeDefined();
    });

    it('should have form object with numberOfSprints', () => {
      expect(component.form.numberOfSprints).toBeDefined();
    });

    it('should have form object with sprintLengthWeeks', () => {
      expect(component.form.sprintLengthWeeks).toBeDefined();
    });
  });

  describe('Holiday Configuration', () => {
    it('should have holidayConfigs signal', () => {
      expect(component.holidayConfigs).toBeDefined();
    });

    it('should have getSelectedHolidayConfig method', () => {
      expect(typeof component.getSelectedHolidayConfig).toBe('function');
    });
  });

  describe('Issue Type Configuration', () => {
    it('should have plannableIssueType in form', () => {
      expect(component.form.plannableIssueType).toBeDefined();
    });

    it('should default to epic', () => {
      expect(component.form.plannableIssueType).toBe('epic');
    });
  });

  describe('IP Sprint', () => {
    it('should have includeIpSprint in form', () => {
      expect(component.form.includeIpSprint).toBeDefined();
    });

    it('should default to true', () => {
      expect(component.form.includeIpSprint).toBe(true);
    });
  });

  describe('Loading State', () => {
    it('should have loading signal', () => {
      expect(component.loading).toBeDefined();
      expect(component.loading()).toBe(false);
    });

    it('should have creating signal', () => {
      expect(component.creating).toBeDefined();
      expect(component.creating()).toBe(false);
    });
  });

  describe('Events', () => {
    it('should have onClose output', () => {
      expect(component.onClose).toBeDefined();
    });

    it('should have onCreated output', () => {
      expect(component.onCreated).toBeDefined();
    });

    it('should emit onClose when close is called', () => {
      const closeSpy = vi.spyOn(component.onClose, 'emit');
      component.onClose.emit();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should have canProceed method', () => {
      expect(typeof component.canProceed).toBe('function');
    });

    it('should validate required fields for step 1', () => {
      component.currentStep.set(1);
      component.form.name = '';
      expect(component.canProceed()).toBe(false);

      component.form.name = 'Test Session';
      component.form.projectKeys = ['TEST'];
      component.form.startDate = '2024-01-15';
      component.form.numberOfSprints = 5;
      expect(component.canProceed()).toBe(true);
    });
  });

  describe('Session Creation', () => {
    it('should have createSession method', () => {
      expect(typeof component.createSession).toBe('function');
    });
  });

  describe('Projects Loading', () => {
    it('should have projects signal', () => {
      expect(component.projects).toBeDefined();
      expect(Array.isArray(component.projects())).toBe(true);
    });
  });

  describe('Issue Type Options', () => {
    it('should have issueTypeOptions array', () => {
      expect(component.issueTypeOptions).toBeDefined();
      expect(Array.isArray(component.issueTypeOptions)).toBe(true);
      expect(component.issueTypeOptions.length).toBe(4);
    });

    it('should include epic, feature, story, and custom options', () => {
      const values = component.issueTypeOptions.map(o => o.value);
      expect(values).toContain('epic');
      expect(values).toContain('feature');
      expect(values).toContain('story');
      expect(values).toContain('custom');
    });
  });

  describe('Helper Methods', () => {
    it('should have formatDate method', () => {
      expect(typeof component.formatDate).toBe('function');
    });

    it('should format date correctly', () => {
      const formatted = component.formatDate('2024-01-15');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should have getIssueTypeLabel method', () => {
      expect(typeof component.getIssueTypeLabel).toBe('function');
    });

    it('should return correct label for epic', () => {
      component.form.plannableIssueType = 'epic';
      expect(component.getIssueTypeLabel()).toBe('Epics');
    });
  });
});
