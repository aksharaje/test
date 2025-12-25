import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { FeasibilityProcessingComponent } from './feasibility-processing.component';
import { FeasibilityService } from './feasibility.service';
import type { SessionStatusResponse } from './feasibility.types';

// Dummy components for routing
@Component({ template: '', standalone: true })
class DummyComponent {}

describe('FeasibilityProcessingComponent', () => {
  let component: FeasibilityProcessingComponent;
  let fixture: ComponentFixture<FeasibilityProcessingComponent>;
  let mockFeasibilityService: Partial<FeasibilityService>;

  const createMockStatus = (overrides: Partial<SessionStatusResponse> = {}): SessionStatusResponse => ({
    id: 1,
    status: 'decomposing',
    progressStep: 1,
    progressMessage: 'Breaking down into components...',
    errorMessage: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockFeasibilityService = {
      pollSessionStatus: vi.fn().mockResolvedValue(createMockStatus()),
    };

    await TestBed.configureTestingModule({
      imports: [FeasibilityProcessingComponent],
      providers: [
        provideRouter([
          { path: 'feasibility', component: DummyComponent },
          { path: 'feasibility/results/:sessionId', component: DummyComponent },
        ]),
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

    fixture = TestBed.createComponent(FeasibilityProcessingComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Clean up any polling intervals
    component.ngOnDestroy();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should poll session status on init', async () => {
      await component.ngOnInit();
      expect(mockFeasibilityService.pollSessionStatus).toHaveBeenCalledWith(1);
    });

    it('should have correct progress steps', () => {
      expect(component.steps.length).toBe(5);
      expect(component.steps[0].label).toBe('Decomposing into components');
      expect(component.steps[1].label).toBe('Estimating effort');
      expect(component.steps[2].label).toBe('Projecting timelines');
      expect(component.steps[3].label).toBe('Identifying risks');
      expect(component.steps[4].label).toBe('Complete');
    });
  });

  describe('Progress Step States', () => {
    it('should identify current step correctly', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({ status: 'estimating' })
      );
      await component.ngOnInit();

      const estimatingStep = component.steps.find(s => s.status === 'estimating')!;
      expect(component.isCurrentStep(estimatingStep)).toBe(true);
    });

    it('should identify completed steps correctly', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({ status: 'scheduling' })
      );
      await component.ngOnInit();

      const decomposingStep = component.steps.find(s => s.status === 'decomposing')!;
      const estimatingStep = component.steps.find(s => s.status === 'estimating')!;
      expect(component.isStepComplete(decomposingStep)).toBe(true);
      expect(component.isStepComplete(estimatingStep)).toBe(true);
    });

    it('should identify pending steps correctly', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({ status: 'decomposing' })
      );
      await component.ngOnInit();

      const riskStep = component.steps.find(s => s.status === 'risk_analyzing')!;
      expect(component.isStepPending(riskStep)).toBe(true);
    });
  });

  describe('Completion Handling', () => {
    it('should update session status when completed', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({ status: 'completed', progressStep: 5 })
      );
      await component.ngOnInit();

      expect(component.sessionStatus()?.status).toBe('completed');
    });

    it('should display completion message when completed', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({ status: 'completed', progressStep: 5 })
      );
      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Analysis Complete');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when failed', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({
          status: 'failed',
          errorMessage: 'AI service unavailable',
        })
      );
      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Analysis Failed');
      expect(content).toContain('AI service unavailable');
    });

    it('should show Try Again button when failed', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({
          status: 'failed',
          errorMessage: 'Error occurred',
        })
      );
      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Try Again');
    });
  });

  describe('Navigation', () => {
    it('should have goBack method', () => {
      expect(typeof component.goBack).toBe('function');
    });
  });

  describe('Progress Message Display', () => {
    it('should display progress message for current step', async () => {
      (mockFeasibilityService.pollSessionStatus as any).mockResolvedValue(
        createMockStatus({
          status: 'estimating',
          progressMessage: 'Analyzing component complexity...',
        })
      );
      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Analyzing component complexity');
    });
  });

  describe('UI Elements', () => {
    it('should display header when processing', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Analyzing Feasibility');
    });

    it('should show skeleton cards while processing', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      const skeletons = fixture.nativeElement.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on destroy', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      await component.ngOnInit();

      // Verify component has interval set
      expect(component['pollInterval']).toBeTruthy();

      component.ngOnDestroy();

      // Verify clearInterval was called
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Status Order', () => {
    it('should have correct status order for step tracking', () => {
      expect(component['statusOrder']).toEqual([
        'pending', 'decomposing', 'estimating', 'scheduling', 'risk_analyzing', 'completed'
      ]);
    });
  });
});
