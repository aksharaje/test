import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideAlertCircle,
  lucideLink2,
  lucideArrowRight,
  lucideTrash2,
  lucideClock,
  lucideAlertTriangle,
  lucideCheckCircle2,
  lucideCircleDot,
  lucideHistory,
  lucideSparkles,
  lucideChevronRight,
  lucideChevronDown,
} from '@ng-icons/lucide';
import { ProgressTrackerService } from './progress-tracker.service';
import type { TrackerSession, TemplateInfo, SprintOption } from './progress-tracker.types';

@Component({
  selector: 'app-progress-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucideAlertCircle,
      lucideLink2,
      lucideArrowRight,
      lucideTrash2,
      lucideClock,
      lucideAlertTriangle,
      lucideCheckCircle2,
      lucideCircleDot,
      lucideHistory,
      lucideSparkles,
      lucideChevronRight,
      lucideChevronDown,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Progress & Blocker Tracker</h1>
          <p class="mt-1 text-muted-foreground">
            Track sprint progress and detect blockers across your team
          </p>

          <!-- Error message -->
          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <!-- No integration warning -->
          @if (initialized() && !service.hasValidIntegration()) {
            <div class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <ng-icon hlmIcon name="lucideLink2" class="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h2 class="text-lg font-semibold text-yellow-800 mb-2">Integration Required</h2>
              <p class="text-yellow-700 mb-4">
                Connect your Jira or Azure DevOps account to track progress.
              </p>
              <a hlmBtn variant="default" routerLink="/settings/integrations">
                <ng-icon hlmIcon name="lucideArrowRight" class="mr-2 h-4 w-4" />
                Go to Integrations
              </a>
            </div>
          } @else if (initialized()) {
            <!-- Input Form -->
            <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
              <!-- Session Name -->
              <div class="rounded-lg border bg-card p-4">
                <div class="flex items-center gap-2 mb-3">
                  <ng-icon hlmIcon name="lucideCircleDot" class="h-5 w-5 text-primary" />
                  <h2 class="font-semibold">Tracker Configuration</h2>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="text-sm font-medium block mb-1.5">Tracker Name</label>
                    <input
                      type="text"
                      [(ngModel)]="sessionName"
                      name="sessionName"
                      placeholder="e.g., Sprint 42 Tracker, Q4 Release Progress"
                      class="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    />
                  </div>

                  <!-- Integration Selection -->
                  <div>
                    <label class="text-sm font-medium block mb-1.5">Integration</label>
                    <div class="space-y-2">
                      @for (integration of integrations(); track integration.id) {
                        <button
                          type="button"
                          class="w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left"
                          [class.border-primary]="selectedIntegrationId === integration.id"
                          [class.bg-primary/5]="selectedIntegrationId === integration.id"
                          (click)="onIntegrationChange(integration.id)"
                        >
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              <ng-icon hlmIcon name="lucideCircleDot" class="h-4 w-4" />
                            </div>
                            <div>
                              <div class="font-medium text-sm">{{ integration.name }}</div>
                              <div class="text-xs text-muted-foreground capitalize">{{ integration.provider }}</div>
                            </div>
                          </div>
                          @if (selectedIntegrationId === integration.id) {
                            <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </div>
                          }
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Template Selection -->
                  @if (selectedIntegrationId) {
                    <div>
                      <label class="text-sm font-medium block mb-1.5">Configuration Template</label>
                      <div class="relative">
                        <button
                          type="button"
                          class="w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-background text-sm text-left"
                          (click)="templateDropdownOpen.set(!templateDropdownOpen())"
                        >
                          <span>{{ getSelectedTemplateName() }}</span>
                          <ng-icon hlmIcon name="lucideChevronDown" class="h-4 w-4 text-muted-foreground" />
                        </button>
                        @if (templateDropdownOpen()) {
                          <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg max-h-64 overflow-y-auto">
                            @for (template of filteredTemplates(); track template.id) {
                              <button
                                type="button"
                                class="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                (click)="selectTemplate(template)"
                              >
                                <div class="font-medium">{{ template.name }}</div>
                                <div class="text-xs text-muted-foreground">{{ template.description }}</div>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Sprint Selection -->
                  @if (selectedIntegrationId && sprints().length > 0) {
                    <div>
                      <label class="text-sm font-medium block mb-1.5">Sprint/Iteration</label>
                      <div class="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                        @for (sprint of sprints(); track sprint.id) {
                          <label
                            class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50"
                            [class.bg-primary/5]="selectedSprintIds.includes(sprint.id)"
                          >
                            <input
                              type="checkbox"
                              [checked]="selectedSprintIds.includes(sprint.id)"
                              (change)="toggleSprint(sprint.id)"
                              class="rounded"
                            />
                            <div class="flex-1 flex items-center justify-between">
                              <span class="text-sm">{{ sprint.name }}</span>
                              @if (sprint.state === 'active') {
                                <span class="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                              } @else if (sprint.state === 'closed') {
                                <span class="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Closed</span>
                              }
                            </div>
                          </label>
                        }
                      </div>
                    </div>
                  } @else if (selectedIntegrationId && !service.loading()) {
                    <div class="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                      No sprints found. The tracker will sync all items in the project.
                    </div>
                  }

                  @if (service.loading() && selectedIntegrationId) {
                    <div class="flex items-center justify-center py-4">
                      <ng-icon hlmIcon name="lucideRefreshCw" class="h-5 w-5 animate-spin text-muted-foreground" />
                      <span class="ml-2 text-sm text-muted-foreground">Loading sprints...</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Submit Button -->
              <button
                hlmBtn
                type="submit"
                class="w-full"
                [disabled]="!canSubmit() || creating()"
              >
                @if (creating()) {
                  <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                } @else {
                  <ng-icon hlmIcon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Create & Sync
                }
              </button>
            </form>

            <!-- Info Box -->
            <div class="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 class="font-medium text-sm mb-2">What gets tracked?</h3>
              <ul class="text-xs text-muted-foreground space-y-1">
                <li>1. <strong>Sprint Progress</strong> - Items completed vs remaining</li>
                <li>2. <strong>Story Points</strong> - Velocity and burn-down metrics</li>
                <li>3. <strong>Blockers</strong> - Automatically detected impediments</li>
                <li>4. <strong>Team Status</strong> - Work distribution and assignments</li>
              </ul>
            </div>
          }
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon hlmIcon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Tracker History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your sprint trackers
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto">
          @if (service.loading() && service.sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3]; track i) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="h-4 bg-muted rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (service.sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full min-h-[300px]">
              <div class="text-center">
                <ng-icon hlmIcon name="lucideCircleDot" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your sprint trackers will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        @if (session.status === 'ready') {
                          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                            <ng-icon hlmIcon name="lucideCheckCircle2" class="h-3 w-3" />
                            Ready
                          </span>
                        } @else if (session.status === 'syncing') {
                          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                            <ng-icon hlmIcon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                            Syncing
                          </span>
                        } @else if (session.status === 'error') {
                          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                            <ng-icon hlmIcon name="lucideAlertCircle" class="h-3 w-3" />
                            Error
                          </span>
                        } @else {
                          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                            Draft
                          </span>
                        }
                      </div>
                      <h3 class="mt-2 font-medium text-sm truncate">{{ session.name }}</h3>
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ session.integrationName || 'Unknown' }} &middot; {{ session.templateId }}
                      </p>
                      @if (session.status === 'ready' && hasMetrics(session)) {
                        <div class="flex items-center gap-3 mt-2 text-xs">
                          <span class="text-muted-foreground">
                            {{ session.itemsSynced }} items
                          </span>
                          @if (session.blockersDetected > 0) {
                            <span class="text-red-600 font-medium">
                              {{ session.blockersDetected }} blocked
                            </span>
                          }
                          <span class="text-green-600 font-medium">
                            {{ getCompletionPercent(session) }}% done
                          </span>
                        </div>
                      }
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        hlmBtn
                        variant="ghost"
                        size="sm"
                        class="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        (click)="confirmDelete(session, $event)"
                      >
                        <ng-icon hlmIcon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                      </button>
                      <ng-icon hlmIcon name="lucideChevronRight" class="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                    <ng-icon hlmIcon name="lucideClock" class="h-3 w-3" />
                    {{ session.lastSyncAt ? formatRelativeTime(session.lastSyncAt) : 'Never synced' }}
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Delete confirmation dialog -->
      @if (deleteCandidate()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="deleteCandidate.set(null)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-2">Delete Tracker</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{{ deleteCandidate()?.name }}</strong>?
              This will remove all tracked data.
            </p>
            <div class="flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="deleteCandidate.set(null)">Cancel</button>
              <button hlmBtn variant="destructive" (click)="doDelete()">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProgressTrackerComponent implements OnInit {
  protected service = inject(ProgressTrackerService);
  private router = inject(Router);

  initialized = signal(false);
  deleteCandidate = signal<TrackerSession | null>(null);
  creating = signal(false);

  // Form fields
  sessionName = '';
  selectedIntegrationId: number | null = null;
  selectedTemplateId = 'basic';
  selectedSprintIds: string[] = [];

  // Dropdown states
  templateDropdownOpen = signal(false);

  // Data
  integrations = signal<Array<{ id: number; name: string; provider: string }>>([]);
  sprints = signal<SprintOption[]>([]);
  filteredTemplates = signal<TemplateInfo[]>([]);

  async ngOnInit() {
    const check = await this.service.checkIntegrations();
    if (check?.has_valid_integration) {
      this.integrations.set(check.integrations);
      await Promise.all([
        this.service.loadSessions(),
        this.service.loadTemplates(),
      ]);
      this.updateFilteredTemplates();

      // Auto-select first integration if only one
      if (check.integrations.length === 1) {
        await this.onIntegrationChange(check.integrations[0].id);
      }
    }
    this.initialized.set(true);
  }

  // =========================================================================
  // TEMPLATE HELPERS
  // =========================================================================

  updateFilteredTemplates(provider?: string) {
    const allTemplates = this.service.templates();
    if (!provider) {
      this.filteredTemplates.set(allTemplates);
    } else {
      this.filteredTemplates.set(
        allTemplates.filter((t) => t.provider === provider || t.provider === 'any')
      );
    }

    // Auto-select first matching template
    if (this.filteredTemplates().length > 0) {
      const providerSpecific = this.filteredTemplates().find((t) => t.provider === provider);
      this.selectedTemplateId = providerSpecific?.id || this.filteredTemplates()[0].id;
    }
  }

  getSelectedTemplateName(): string {
    const template = this.filteredTemplates().find((t) => t.id === this.selectedTemplateId);
    return template?.name || 'Select a template';
  }

  selectTemplate(template: TemplateInfo) {
    this.selectedTemplateId = template.id;
    this.templateDropdownOpen.set(false);
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  async onIntegrationChange(integrationId: number) {
    this.selectedIntegrationId = integrationId;
    this.selectedSprintIds = [];

    // Determine provider and filter templates
    const integration = this.integrations().find((i) => i.id === integrationId);
    this.updateFilteredTemplates(integration?.provider);

    // Load sprints for this integration
    const sprints = await this.service.loadSprints(integrationId);
    this.sprints.set(sprints);

    // Auto-select active sprint if available
    const activeSprint = sprints.find((s) => s.state === 'active');
    if (activeSprint) {
      this.selectedSprintIds = [activeSprint.id];
    }
  }

  toggleSprint(sprintId: string) {
    if (this.selectedSprintIds.includes(sprintId)) {
      this.selectedSprintIds = this.selectedSprintIds.filter((id) => id !== sprintId);
    } else {
      this.selectedSprintIds = [...this.selectedSprintIds, sprintId];
    }
  }

  canSubmit(): boolean {
    return !!this.selectedIntegrationId && !!this.selectedTemplateId;
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit() || !this.selectedIntegrationId) return;

    this.creating.set(true);

    try {
      const session = await this.service.createSession({
        name: this.sessionName || 'Sprint Tracker',
        integrationId: this.selectedIntegrationId,
        templateId: this.selectedTemplateId,
        sprintFilter:
          this.selectedSprintIds.length > 0
            ? { sprint_ids: this.selectedSprintIds }
            : { active_sprint: true },
      });

      if (session) {
        // Start sync and navigate to dashboard
        await this.service.syncSession(session.id);
        this.router.navigate(['/progress-tracker', session.id]);
      }
    } finally {
      this.creating.set(false);
    }
  }

  viewSession(session: TrackerSession) {
    this.router.navigate(['/progress-tracker', session.id]);
  }

  confirmDelete(session: TrackerSession, event: Event) {
    event.stopPropagation();
    this.deleteCandidate.set(session);
  }

  async doDelete() {
    const session = this.deleteCandidate();
    if (!session) return;

    await this.service.deleteSession(session.id);
    this.deleteCandidate.set(null);
  }

  hasMetrics(session: TrackerSession): boolean {
    const snapshot = session.metricsSnapshot;
    return !!snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0;
  }

  getCompletionPercent(session: TrackerSession): number {
    const snapshot = session.metricsSnapshot;
    if (!snapshot || typeof snapshot !== 'object') return 0;
    return Math.round((snapshot as { completionPercentageItems?: number }).completionPercentageItems || 0);
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}
