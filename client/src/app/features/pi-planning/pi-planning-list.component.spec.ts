import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PiPlanningListComponent } from './pi-planning-list.component';
import { PiPlanningService } from './pi-planning.service';
import { IntegrationService } from '../settings/integration.service';
import type { PiSession } from './pi-planning.types';

const mockSessions: PiSession[] = [
  {
    id: 1,
    integrationId: 1,
    name: 'PI 2024.1',
    description: null,
    projectKeys: ['TEST'],
    status: 'active',
    currentVersion: '1.0',
    startDate: '2024-01-15',
    endDate: '2024-04-15',
    sprintCount: 5,
    sprintLengthWeeks: 2,
    plannableIssueType: 'epic',
    customIssueTypeName: null,
    holidayConfigId: null,
    includeIpSprint: true,
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 2,
    integrationId: 1,
    name: 'PI 2024.2',
    description: null,
    projectKeys: ['TEST', 'DEMO'],
    status: 'draft',
    currentVersion: '1.0',
    startDate: '2024-04-16',
    endDate: '2024-07-15',
    sprintCount: 5,
    sprintLengthWeeks: 2,
    plannableIssueType: 'epic',
    customIssueTypeName: null,
    holidayConfigId: null,
    includeIpSprint: true,
    createdBy: null,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
];

describe('PiPlanningListComponent', () => {
  let component: PiPlanningListComponent;
  let fixture: ComponentFixture<PiPlanningListComponent>;
  let mockPiPlanningService: Partial<PiPlanningService>;
  let mockIntegrationService: Partial<IntegrationService>;

  beforeEach(async () => {
    mockPiPlanningService = {
      sessions: signal<PiSession[]>([]),
      loading: signal(false),
      error: signal<string | null>(null),
      hasSessions: signal(false),
      loadSessions: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    };

    const mockIntegration = {
      id: 1,
      name: 'Jira Cloud',
      provider: 'jira' as const,
      baseUrl: 'https://test.atlassian.net',
      cloudId: 'test-cloud-id',
      authType: 'oauth' as const,
      status: 'connected' as const,
      lastSyncAt: '2024-01-01T00:00:00Z',
      errorMessage: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockIntegrationService = {
      integrations: signal([mockIntegration]),
      connectedIntegrations: signal([mockIntegration]),
      loadIntegrations: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [PiPlanningListComponent],
      providers: [
        provideRouter([]),
        { provide: PiPlanningService, useValue: mockPiPlanningService },
        { provide: IntegrationService, useValue: mockIntegrationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PiPlanningListComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('Integration Check', () => {
    it('should have hasIntegration method', () => {
      expect(typeof component.hasIntegration).toBe('function');
    });
  });

  describe('Create Session Dialog', () => {
    it('should have showCreateDialog signal', () => {
      expect(component.showCreateDialog).toBeDefined();
      expect(component.showCreateDialog()).toBe(false);
    });

    it('should toggle create dialog', () => {
      component.showCreateDialog.set(true);
      expect(component.showCreateDialog()).toBe(true);
    });
  });

  describe('Session Display', () => {
    beforeEach(async () => {
      // Set integration ID before running ngOnInit
      (mockPiPlanningService.sessions as any).set(mockSessions);
      (mockPiPlanningService.hasSessions as any).set(true);
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should display sessions when available', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('PI 2024.1');
    });

    it('should show session status', () => {
      const content = fixture.nativeElement.textContent;
      // Active or draft status should be visible
      expect(content).toMatch(/(Active|Draft)/i);
    });
  });

  describe('Empty State', () => {
    it('should handle empty sessions', () => {
      (mockPiPlanningService.sessions as any).set([]);
      (mockPiPlanningService.hasSessions as any).set(false);
      fixture.detectChanges();
      // Component should render without errors
      expect(component).toBeTruthy();
    });
  });

  describe('No Integration State', () => {
    it('should show connect Jira prompt when no integration', () => {
      (mockIntegrationService.connectedIntegrations as any).set([]);
      component.ngOnInit();
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Connect Jira');
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading', async () => {
      // Initialize component first to set integrationId
      await component.ngOnInit();
      (mockPiPlanningService.loading as any).set(true);
      (mockPiPlanningService.hasSessions as any).set(false);
      fixture.detectChanges();

      const skeletons = fixture.nativeElement.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Display', () => {
    it('should show error message when error exists', () => {
      (mockPiPlanningService.error as any).set('Failed to load sessions');
      fixture.detectChanges();

      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Failed to load sessions');
    });
  });

  describe('Navigation', () => {
    it('should have openSession method', () => {
      expect(typeof component.openSession).toBe('function');
    });

    it('should have goToIntegrations method', () => {
      expect(typeof component.goToIntegrations).toBe('function');
    });
  });

  describe('Session Actions', () => {
    it('should have deleteSession method', () => {
      expect(typeof component.deleteSession).toBe('function');
    });

    it('should have confirmDelete method', () => {
      expect(typeof component.confirmDelete).toBe('function');
    });
  });

  describe('Header', () => {
    it('should display PI Planning title', () => {
      fixture.detectChanges();
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('PI Planning');
    });
  });

  describe('Date Formatting', () => {
    it('should have formatDate method', () => {
      expect(typeof component.formatDate).toBe('function');
    });

    it('should format date correctly', () => {
      const formatted = component.formatDate('2024-01-15');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Issue Type Formatting', () => {
    it('should have formatIssueType method', () => {
      expect(typeof component.formatIssueType).toBe('function');
    });

    it('should format epic type correctly', () => {
      expect(component.formatIssueType('epic')).toBe('Epics');
    });

    it('should format feature type correctly', () => {
      expect(component.formatIssueType('feature')).toBe('Features');
    });

    it('should format story type correctly', () => {
      expect(component.formatIssueType('story')).toBe('Stories');
    });
  });
});
