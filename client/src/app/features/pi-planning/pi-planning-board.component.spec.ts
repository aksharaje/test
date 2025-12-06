import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PiPlanningBoardComponent } from './pi-planning-board.component';
import { PiPlanningService } from './pi-planning.service';
import type { KanbanBoardView } from './pi-planning.types';

const mockKanbanView: KanbanBoardView = {
  session: {
    id: 1,
    name: 'PI 2024.1',
    status: 'active',
    currentVersion: '1.0',
  },
  sprints: [
    {
      id: 1,
      number: 1,
      name: 'Sprint 1',
      startDate: '2024-01-15',
      endDate: '2024-01-28',
      workingDays: 10,
      isIpSprint: false,
      holidays: [],
    },
    {
      id: 2,
      number: 2,
      name: 'Sprint 2',
      startDate: '2024-01-29',
      endDate: '2024-02-11',
      workingDays: 10,
      isIpSprint: false,
      holidays: [],
    },
  ],
  teams: [
    {
      id: 1,
      name: 'Team Alpha',
      jiraBoardId: 101,
      velocity: 20,
      sprintCapacities: [
        { sprintNum: 1, capacityPoints: 20, allocatedPoints: 13, remainingCapacity: 7, isOverCapacity: false },
        { sprintNum: 2, capacityPoints: 20, allocatedPoints: 8, remainingCapacity: 12, isOverCapacity: false },
      ],
    },
  ],
  features: [],
  unassignedFeatures: [
    {
      id: 1,
      jiraKey: 'PROJ-1',
      title: 'Feature 1',
      totalPoints: 8,
      priority: 'High',
      estimatedSprints: 1,
      dependencies: [],
    },
  ],
};

describe('PiPlanningBoardComponent', () => {
  let component: PiPlanningBoardComponent;
  let fixture: ComponentFixture<PiPlanningBoardComponent>;
  let mockService: Partial<PiPlanningService>;

  beforeEach(async () => {
    mockService = {
      kanbanView: signal<KanbanBoardView | null>(null),
      loading: signal(false),
      error: signal<string | null>(null),
      loadKanbanView: vi.fn().mockResolvedValue(undefined),
      getJiraBoards: vi.fn().mockResolvedValue([]),
      getJiraBoardVelocity: vi.fn().mockResolvedValue({ averageVelocity: 20 }),
      addBoard: vi.fn().mockResolvedValue({ id: 1 }),
      updateBoardVelocity: vi.fn().mockResolvedValue(undefined),
      removeBoard: vi.fn().mockResolvedValue(undefined),
      generateAiPlan: vi.fn().mockResolvedValue({
        assignments: [],
        unassignedFeatures: [],
        warnings: [],
        summary: { totalFeatures: 0, assignedFeatures: 0, totalPoints: 0, assignedPoints: 0 },
      }),
      applyAiPlan: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [PiPlanningBoardComponent],
      providers: [
        provideRouter([]),
        { provide: PiPlanningService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PiPlanningBoardComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have showTeamPanel signal', () => {
      expect(component.showTeamPanel).toBeDefined();
      // Initial value is true based on component definition
      expect(component.showTeamPanel()).toBe(true);
    });
  });

  describe('Session Display', () => {
    beforeEach(() => {
      (mockService.kanbanView as any).set(mockKanbanView);
      fixture.detectChanges();
    });

    it('should display session name', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('PI 2024.1');
    });

    it('should display version badge', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('v1.0');
    });
  });

  describe('Team Panel', () => {
    it('should toggle team panel visibility', () => {
      expect(component.showTeamPanel()).toBe(true);
      component.showTeamPanel.set(false);
      expect(component.showTeamPanel()).toBe(false);
    });
  });

  describe('AI Planning Dialog', () => {
    it('should have showAiPlanDialog signal', () => {
      expect(component.showAiPlanDialog).toBeDefined();
      expect(component.showAiPlanDialog()).toBe(false);
    });

    it('should have aiOptions with defaults', () => {
      expect(component.aiOptions).toBeDefined();
      expect(component.aiOptions).toHaveProperty('respectDependencies');
      expect(component.aiOptions).toHaveProperty('balanceLoad');
      expect(component.aiOptions).toHaveProperty('preferEarlierSprints');
    });
  });

  describe('Navigation', () => {
    it('should have goBack method', () => {
      expect(typeof component.goBack).toBe('function');
    });
  });

  describe('Status Text', () => {
    it('should have getSessionStatusText method', () => {
      expect(typeof component.getSessionStatusText).toBe('function');
    });

    it('should return status text', () => {
      (mockService.kanbanView as any).set(mockKanbanView);
      const statusText = component.getSessionStatusText();
      expect(typeof statusText).toBe('string');
    });
  });

  describe('Add Team Dialog', () => {
    it('should have showAddTeamDialog signal', () => {
      expect(component.showAddTeamDialog).toBeDefined();
      expect(component.showAddTeamDialog()).toBe(false);
    });

    it('should have availableBoards signal', () => {
      expect(component.availableBoards).toBeDefined();
      expect(Array.isArray(component.availableBoards())).toBe(true);
    });
  });

  describe('Velocity Editing', () => {
    it('should have editingTeamId signal', () => {
      expect(component.editingTeamId).toBeDefined();
      expect(component.editingTeamId()).toBeNull();
    });

    it('should have editVelocityValue property', () => {
      expect(component.editVelocityValue).toBeDefined();
      expect(typeof component.editVelocityValue).toBe('number');
    });
  });

  describe('Loading States', () => {
    it('should have loadingBoards signal', () => {
      expect(component.loadingBoards).toBeDefined();
      expect(component.loadingBoards()).toBe(false);
    });

    it('should have addingBoard signal', () => {
      expect(component.addingBoard).toBeDefined();
      expect(component.addingBoard()).toBe(false);
    });

    it('should have generatingAiPlan signal', () => {
      expect(component.generatingAiPlan).toBeDefined();
      expect(component.generatingAiPlan()).toBe(false);
    });
  });

  describe('Empty State', () => {
    it('should handle null kanban view', () => {
      (mockService.kanbanView as any).set(null);
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });
  });
});
