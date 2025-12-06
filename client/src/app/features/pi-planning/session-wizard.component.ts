import { Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideCalendar,
  lucideUsers,
  lucideSettings,
  lucidePackage,
  lucideAlertCircle,
  lucideLoader2,
} from '@ng-icons/lucide';
import { PiPlanningService } from './pi-planning.service';
import { IntegrationService } from '../settings/integration.service';
import type {
  PiSession,
  CreateSessionRequest,
  HolidayConfig,
  PlannableIssueType
} from './pi-planning.types';
import type { JiraProject, JiraBoard } from '../settings/integration.types';

interface WizardStep {
  id: number;
  title: string;
  icon: string;
  completed: boolean;
}

@Component({
  selector: 'app-session-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideCalendar,
      lucideUsers,
      lucideSettings,
      lucidePackage,
      lucideAlertCircle,
      lucideLoader2,
    }),
  ],
  template: `
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      (click)="onClose.emit()"
    >
      <div
        class="bg-card rounded-lg border shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        (click)="$event.stopPropagation()"
      >
        <!-- Header with Steps -->
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold mb-4">Create PI Planning Session</h2>
          <div class="flex items-center justify-between">
            @for (step of steps; track step.id) {
              <div class="flex items-center">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
                  [class.bg-primary]="currentStep() >= step.id"
                  [class.text-primary-foreground]="currentStep() >= step.id"
                  [class.bg-muted]="currentStep() < step.id"
                  [class.text-muted-foreground]="currentStep() < step.id"
                >
                  @if (step.completed && currentStep() > step.id) {
                    <ng-icon hlmIcon name="lucideCheck" class="h-4 w-4" />
                  } @else {
                    {{ step.id }}
                  }
                </div>
                <span
                  class="ml-2 text-sm font-medium hidden sm:block"
                  [class.text-foreground]="currentStep() >= step.id"
                  [class.text-muted-foreground]="currentStep() < step.id"
                >
                  {{ step.title }}
                </span>
                @if (step.id < steps.length) {
                  <div
                    class="w-8 sm:w-16 h-0.5 mx-2"
                    [class.bg-primary]="currentStep() > step.id"
                    [class.bg-muted]="currentStep() <= step.id"
                  ></div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          @if (loading()) {
            <div class="flex items-center justify-center py-12">
              <ng-icon hlmIcon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          } @else {
            @switch (currentStep()) {
              @case (1) {
                <!-- Step 1: Basic Setup -->
                <div class="space-y-6">
                  <div>
                    <label class="block text-sm font-medium mb-1">Session Name *</label>
                    <input
                      type="text"
                      [(ngModel)]="form.name"
                      placeholder="PI 2024.1 - Q1 Planning"
                      class="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium mb-1">Projects * (select one or more)</label>
                    <div class="max-h-48 overflow-y-auto border rounded-md bg-background p-2 space-y-1">
                      @if (projects().length === 0) {
                        <p class="text-sm text-muted-foreground py-2 px-2">Loading projects...</p>
                      } @else {
                        @for (project of projects(); track project.key) {
                          <label
                            class="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer"
                            [class.bg-primary/10]="form.projectKeys.includes(project.key)"
                          >
                            <input
                              type="checkbox"
                              [checked]="form.projectKeys.includes(project.key)"
                              (change)="toggleProject(project.key)"
                              class="rounded"
                            />
                            <span class="text-sm">{{ project.name }} ({{ project.key }})</span>
                          </label>
                        }
                      }
                    </div>
                    @if (form.projectKeys.length > 0) {
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ form.projectKeys.length }} project(s) selected: {{ form.projectKeys.join(', ') }}
                      </p>
                    }
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium mb-1">Start Date *</label>
                      <input
                        type="date"
                        [(ngModel)]="form.startDate"
                        class="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-1">Number of Sprints *</label>
                      <input
                        type="number"
                        [(ngModel)]="form.numberOfSprints"
                        min="1"
                        max="12"
                        class="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium mb-1">Sprint Length</label>
                      <select
                        [(ngModel)]="form.sprintLengthWeeks"
                        class="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        <option [value]="1">1 week</option>
                        <option [value]="2">2 weeks</option>
                        <option [value]="3">3 weeks</option>
                        <option [value]="4">4 weeks</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-1">Holiday Calendar</label>
                      <select
                        [(ngModel)]="form.holidayConfigId"
                        class="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        <option [value]="null">None</option>
                        @for (config of holidayConfigs(); track config.id) {
                          <option [value]="config.id">{{ config.name }}</option>
                        }
                      </select>
                    </div>
                  </div>

                  <div>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        [(ngModel)]="form.includeIpSprint"
                        class="rounded"
                      />
                      <span class="text-sm">Include IP (Innovation & Planning) Sprint</span>
                    </label>
                    <p class="text-xs text-muted-foreground mt-1 ml-6">
                      Adds a final sprint for innovation work and next PI planning
                    </p>
                  </div>
                </div>
              }

              @case (2) {
                <!-- Step 2: Plannable Issue Type -->
                <div class="space-y-6">
                  <div>
                    <h3 class="font-medium mb-2">What do you want to plan?</h3>
                    <p class="text-sm text-muted-foreground mb-4">
                      Select the type of issues you'll be planning in this PI session.
                    </p>
                  </div>

                  <div class="grid gap-3">
                    @for (option of issueTypeOptions; track option.value) {
                      <label
                        class="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        [class.border-primary]="form.plannableIssueType === option.value"
                        [class.bg-primary/5]="form.plannableIssueType === option.value"
                      >
                        <input
                          type="radio"
                          name="plannableIssueType"
                          [value]="option.value"
                          [(ngModel)]="form.plannableIssueType"
                          class="mt-1"
                        />
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <ng-icon hlmIcon name="lucidePackage" class="h-5 w-5 text-primary" />
                            <span class="font-medium">{{ option.label }}</span>
                          </div>
                          <p class="text-sm text-muted-foreground mt-1">
                            {{ option.description }}
                          </p>
                        </div>
                      </label>
                    }
                  </div>

                  @if (form.plannableIssueType === 'custom') {
                    <div>
                      <label class="block text-sm font-medium mb-1">Custom Issue Type Name *</label>
                      <input
                        type="text"
                        [(ngModel)]="form.customIssueTypeName"
                        placeholder="e.g., Initiative, Capability"
                        class="w-full px-3 py-2 border rounded-md bg-background"
                      />
                    </div>
                  }
                </div>
              }

              @case (3) {
                <!-- Step 3: Summary & Create -->
                <div class="space-y-6">
                  <div>
                    <h3 class="font-medium mb-2">Review your session</h3>
                    <p class="text-sm text-muted-foreground mb-4">
                      Confirm the details before creating the session.
                    </p>
                  </div>

                  <div class="bg-muted/30 rounded-lg p-4 space-y-3">
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Session Name</span>
                      <span class="font-medium">{{ form.name }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Projects</span>
                      <span class="font-medium">{{ form.projectKeys.join(', ') }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Start Date</span>
                      <span class="font-medium">{{ formatDate(form.startDate) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Sprints</span>
                      <span class="font-medium">
                        {{ form.numberOfSprints }} x {{ form.sprintLengthWeeks }} week(s)
                        @if (form.includeIpSprint) {
                          + IP Sprint
                        }
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted-foreground">Planning</span>
                      <span class="font-medium">{{ getIssueTypeLabel() }}</span>
                    </div>
                    @if (getSelectedHolidayConfig()) {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Holiday Calendar</span>
                        <span class="font-medium">{{ getSelectedHolidayConfig()?.name }}</span>
                      </div>
                    }
                  </div>

                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex gap-3">
                      <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div class="text-sm text-blue-800">
                        <p class="font-medium">What happens next?</p>
                        <p class="mt-1">
                          After creating the session, you'll be able to add teams (boards) and
                          import features from Jira to start planning.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              }
            }
          }
        </div>

        <!-- Footer -->
        <div class="p-6 border-t flex justify-between">
          <button
            hlmBtn
            variant="ghost"
            (click)="currentStep() === 1 ? onClose.emit() : previousStep()"
          >
            @if (currentStep() === 1) {
              Cancel
            } @else {
              <ng-icon hlmIcon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
              Back
            }
          </button>

          @if (currentStep() < 3) {
            <button
              hlmBtn
              variant="default"
              (click)="nextStep()"
              [disabled]="!canProceed()"
            >
              Next
              <ng-icon hlmIcon name="lucideArrowRight" class="ml-2 h-4 w-4" />
            </button>
          } @else {
            <button
              hlmBtn
              variant="default"
              (click)="createSession()"
              [disabled]="!canProceed() || creating()"
            >
              @if (creating()) {
                <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                Creating...
              } @else {
                <ng-icon hlmIcon name="lucideCheck" class="mr-2 h-4 w-4" />
                Create Session
              }
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class SessionWizardComponent implements OnInit {
  @Input() integrationId!: number;
  @Output() onClose = new EventEmitter<void>();
  @Output() onCreated = new EventEmitter<PiSession>();

  private piService = inject(PiPlanningService);
  private integrationService = inject(IntegrationService);

  currentStep = signal(1);
  loading = signal(false);
  creating = signal(false);

  projects = signal<JiraProject[]>([]);
  holidayConfigs = signal<HolidayConfig[]>([]);

  steps: WizardStep[] = [
    { id: 1, title: 'Setup', icon: 'lucideSettings', completed: false },
    { id: 2, title: 'Issue Type', icon: 'lucidePackage', completed: false },
    { id: 3, title: 'Review', icon: 'lucideCheck', completed: false },
  ];

  issueTypeOptions = [
    {
      value: 'epic' as PlannableIssueType,
      label: 'Epics',
      description: 'Large bodies of work that span multiple sprints. Best for traditional SAFe PI Planning.',
    },
    {
      value: 'feature' as PlannableIssueType,
      label: 'Features',
      description: 'Medium-sized deliverables. Good for teams using Features as their primary planning unit.',
    },
    {
      value: 'story' as PlannableIssueType,
      label: 'Stories',
      description: 'User stories or tasks. Best for smaller teams or sprint-level planning.',
    },
    {
      value: 'custom' as PlannableIssueType,
      label: 'Custom Issue Type',
      description: 'Use a custom Jira issue type specific to your organization.',
    },
  ];

  form = {
    name: '',
    projectKeys: [] as string[], // Array of selected project keys (supports multiple)
    startDate: this.getDefaultStartDate(),
    numberOfSprints: 5,
    sprintLengthWeeks: 2,
    holidayConfigId: null as number | null,
    includeIpSprint: true,
    plannableIssueType: 'epic' as PlannableIssueType,
    customIssueTypeName: '',
  };

  async ngOnInit() {
    this.loading.set(true);
    try {
      await Promise.all([
        this.loadProjects(),
        this.loadHolidayConfigs(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadProjects(): Promise<void> {
    await this.integrationService.loadProjects(this.integrationId);
    this.projects.set(this.integrationService.projects());
  }

  private async loadHolidayConfigs(): Promise<void> {
    await this.piService.loadHolidayConfigs();
    const configs = this.piService.holidayConfigs();
    this.holidayConfigs.set(configs);

    // If no configs, try to seed them
    if (configs.length === 0) {
      await this.piService.seedHolidayConfigs();
      this.holidayConfigs.set(this.piService.holidayConfigs());
    }
  }

  private getDefaultStartDate(): string {
    const today = new Date();
    // Find next Monday
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }

  toggleProject(projectKey: string): void {
    const index = this.form.projectKeys.indexOf(projectKey);
    if (index === -1) {
      this.form.projectKeys.push(projectKey);
    } else {
      this.form.projectKeys.splice(index, 1);
    }
  }

  onProjectChange(): void {
    // Could load project-specific data here if needed
  }

  canProceed(): boolean {
    switch (this.currentStep()) {
      case 1:
        return !!(
          this.form.name.trim() &&
          this.form.projectKeys.length > 0 && // At least one project selected
          this.form.startDate &&
          this.form.numberOfSprints >= 1
        );
      case 2:
        if (this.form.plannableIssueType === 'custom') {
          return !!this.form.customIssueTypeName.trim();
        }
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  }

  nextStep(): void {
    if (this.canProceed() && this.currentStep() < 3) {
      this.steps[this.currentStep() - 1].completed = true;
      this.currentStep.update(s => s + 1);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  async createSession(): Promise<void> {
    if (!this.canProceed()) return;

    this.creating.set(true);
    try {
      const request: CreateSessionRequest = {
        name: this.form.name,
        projectKeys: this.form.projectKeys, // Array of selected project keys
        startDate: this.form.startDate,
        numberOfSprints: this.form.numberOfSprints,
        sprintLengthWeeks: this.form.sprintLengthWeeks,
        plannableIssueType: this.form.plannableIssueType,
        customIssueTypeName: this.form.plannableIssueType === 'custom'
          ? this.form.customIssueTypeName
          : undefined,
        holidayConfigId: this.form.holidayConfigId || undefined,
        includeIpSprint: this.form.includeIpSprint,
      };

      const session = await this.piService.createSession(this.integrationId, request);
      if (session) {
        this.onCreated.emit(session);
      }
    } finally {
      this.creating.set(false);
    }
  }

  getSelectedHolidayConfig(): HolidayConfig | undefined {
    return this.holidayConfigs().find(c => c.id === this.form.holidayConfigId);
  }

  getIssueTypeLabel(): string {
    if (this.form.plannableIssueType === 'custom') {
      return this.form.customIssueTypeName || 'Custom';
    }
    const option = this.issueTypeOptions.find(o => o.value === this.form.plannableIssueType);
    return option?.label || this.form.plannableIssueType;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
