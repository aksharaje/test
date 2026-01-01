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
  lucidePackageCheck,
  lucideXCircle,
  lucideHistory,
  lucideSparkles,
  lucideChevronRight,
  lucideSearch,
  lucideEdit3,
  lucideChevronDown,
} from '@ng-icons/lucide';
import { ReleaseReadinessService } from './release-readiness.service';
import type { ReleaseReadinessSession, ReleaseType, ProjectOption, FixVersionOption, SprintOption, LabelOption } from './release-readiness.types';

@Component({
  selector: 'app-release-readiness',
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
      lucidePackageCheck,
      lucideXCircle,
      lucideHistory,
      lucideSparkles,
      lucideChevronRight,
      lucideSearch,
      lucideEdit3,
      lucideChevronDown,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Release Readiness Checker</h1>
          <p class="mt-1 text-muted-foreground">
            Assess release readiness with adaptive scoring and Go/No-Go recommendations
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
                Connect your Jira or Azure DevOps account to assess release readiness.
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
                  <ng-icon hlmIcon name="lucidePackageCheck" class="h-5 w-5 text-primary" />
                  <h2 class="font-semibold">Assessment Configuration</h2>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="text-sm font-medium block mb-1.5">Assessment Name</label>
                    <input
                      type="text"
                      [(ngModel)]="sessionName"
                      name="sessionName"
                      placeholder="e.g., Release 2.4 Go/No-Go, Sprint 24 Release Check"
                      class="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    />
                  </div>

                  <!-- Integration Selection -->
                  <div>
                    <label class="text-sm font-medium block mb-1.5">Integration</label>
                    <div class="space-y-2">
                      @for (integration of service.integrationCheck()?.integrations || []; track integration.id) {
                        <button
                          type="button"
                          class="w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left"
                          [class.border-primary]="selectedIntegrationId() === integration.id"
                          [class.bg-primary/5]="selectedIntegrationId() === integration.id"
                          (click)="onIntegrationSelected(integration.id)"
                        >
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              <ng-icon hlmIcon name="lucidePackageCheck" class="h-4 w-4" />
                            </div>
                            <div>
                              <div class="font-medium text-sm">{{ integration.name }}</div>
                              <div class="text-xs text-muted-foreground capitalize">{{ integration.provider }}</div>
                            </div>
                          </div>
                          @if (selectedIntegrationId() === integration.id) {
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

                  <!-- Release Type Selection -->
                  @if (selectedIntegrationId()) {
                    <div>
                      <label class="text-sm font-medium block mb-1.5">Release Scope</label>
                      <div class="grid gap-2" [class.grid-cols-3]="selectedProvider() === 'jira'" [class.grid-cols-2]="selectedProvider() === 'ado'">
                        @for (type of availableReleaseTypes(); track type.value) {
                          <button
                            type="button"
                            class="p-2 rounded-lg border text-center transition-colors"
                            [class.border-primary]="releaseType === type.value"
                            [class.bg-primary/5]="releaseType === type.value"
                            (click)="onReleaseTypeChange(type.value)"
                          >
                            <div class="font-medium text-xs">{{ type.label }}</div>
                            <div class="text-xs text-muted-foreground">{{ type.description }}</div>
                          </button>
                        }
                      </div>
                    </div>
                  }

                  <!-- Project Selection (for fixVersion in Jira) -->
                  @if (selectedIntegrationId() && releaseType === 'fixVersion' && selectedProvider() === 'jira') {
                    <div>
                      <label class="text-sm font-medium block mb-1.5">Project *</label>
                      <div class="relative">
                        <button
                          type="button"
                          class="w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-background text-sm text-left"
                          (click)="projectDropdownOpen.set(!projectDropdownOpen())"
                        >
                          <span [class.text-muted-foreground]="!selectedProject()">
                            {{ selectedProject() ? selectedProject()!.name + ' (' + selectedProject()!.key + ')' : 'Select a project...' }}
                          </span>
                          <ng-icon hlmIcon name="lucideChevronDown" class="h-4 w-4 text-muted-foreground" />
                        </button>
                        @if (projectDropdownOpen()) {
                          <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg max-h-64 overflow-y-auto">
                            <input
                              type="text"
                              [(ngModel)]="projectFilter"
                              name="projectFilter"
                              placeholder="Search projects..."
                              class="w-full px-3 py-2 border-b bg-background text-sm"
                              (click)="$event.stopPropagation()"
                            />
                            @if (service.loadingOptions()) {
                              <div class="p-3 text-sm text-muted-foreground text-center">
                                <ng-icon hlmIcon name="lucideRefreshCw" class="h-4 w-4 animate-spin inline mr-2" />
                                Loading projects...
                              </div>
                            } @else if (filteredProjects().length === 0) {
                              <div class="p-3 text-sm text-muted-foreground text-center">No projects found</div>
                            } @else {
                              @for (project of filteredProjects(); track project.key) {
                                <button
                                  type="button"
                                  class="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                                  (click)="selectProject(project)"
                                >
                                  <span>{{ project.name }} ({{ project.key }})</span>
                                  @if (selectedProject()?.key === project.key) {
                                    <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                  }
                                </button>
                              }
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Release Identifier Selection -->
                  @if (selectedIntegrationId() && (releaseType !== 'fixVersion' || selectedProject())) {
                    <div>
                      <label class="text-sm font-medium block mb-1.5">{{ getReleaseTypeLabel() }} *</label>

                      <!-- Fix Version Filter -->
                      @if (releaseType === 'fixVersion') {
                        <div class="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            id="hideReleased"
                            [(ngModel)]="hideReleasedVersions"
                            name="hideReleased"
                            class="rounded"
                          />
                          <label for="hideReleased" class="text-xs text-muted-foreground">Hide released versions</label>
                        </div>
                      }

                      <div class="relative">
                        @if (!manualEntry()) {
                          <button
                            type="button"
                            class="w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-background text-sm text-left"
                            (click)="optionsDropdownOpen.set(!optionsDropdownOpen())"
                          >
                            <span [class.text-muted-foreground]="!releaseIdentifier">
                              {{ releaseIdentifier || 'Select ' + getReleaseTypeLabel().toLowerCase() + '...' }}
                            </span>
                            <ng-icon hlmIcon name="lucideChevronDown" class="h-4 w-4 text-muted-foreground" />
                          </button>
                          @if (optionsDropdownOpen()) {
                            <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg max-h-64 overflow-y-auto">
                              <input
                                type="text"
                                [(ngModel)]="optionsFilter"
                                name="optionsFilter"
                                placeholder="Search..."
                                class="w-full px-3 py-2 border-b bg-background text-sm"
                                (click)="$event.stopPropagation()"
                              />
                              @if (service.loadingOptions()) {
                                <div class="p-3 text-sm text-muted-foreground text-center">
                                  <ng-icon hlmIcon name="lucideRefreshCw" class="h-4 w-4 animate-spin inline mr-2" />
                                  Loading options...
                                </div>
                              } @else if (filteredOptions().length === 0) {
                                <div class="p-3 text-sm text-muted-foreground text-center">No options found</div>
                              } @else {
                                @for (option of filteredOptions(); track option.id || option.name) {
                                  <button
                                    type="button"
                                    class="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                                    (click)="selectOption(option)"
                                  >
                                    <div>
                                      <span>{{ option.name }}</span>
                                      @if (option.state) {
                                        <span
                                          class="ml-2 text-xs px-1.5 py-0.5 rounded"
                                          [class.bg-green-100]="option.state === 'active'"
                                          [class.text-green-700]="option.state === 'active'"
                                          [class.bg-gray-100]="option.state === 'closed'"
                                          [class.text-gray-600]="option.state === 'closed'"
                                          [class.bg-blue-100]="option.state === 'future'"
                                          [class.text-blue-700]="option.state === 'future'"
                                        >{{ option.state }}</span>
                                      }
                                      @if (option.released !== undefined) {
                                        <span
                                          class="ml-2 text-xs px-1.5 py-0.5 rounded"
                                          [class.bg-green-100]="option.released"
                                          [class.text-green-700]="option.released"
                                          [class.bg-yellow-100]="!option.released"
                                          [class.text-yellow-700]="!option.released"
                                        >{{ option.released ? 'Released' : 'Unreleased' }}</span>
                                      }
                                    </div>
                                    @if (releaseIdentifier === option.name) {
                                      <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                      </svg>
                                    }
                                  </button>
                                }
                              }
                              <!-- Manual entry option -->
                              <button
                                type="button"
                                class="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted border-t flex items-center gap-2"
                                (click)="enableManualEntry()"
                              >
                                <ng-icon hlmIcon name="lucideEdit3" class="h-4 w-4" />
                                Enter custom value...
                              </button>
                            </div>
                          }
                        } @else {
                          <div class="flex gap-2">
                            <input
                              type="text"
                              [(ngModel)]="releaseIdentifier"
                              name="releaseIdentifier"
                              placeholder="Enter custom value..."
                              class="flex-1 px-3 py-2 border rounded-lg bg-background text-sm"
                            />
                            <button
                              type="button"
                              hlmBtn
                              variant="ghost"
                              size="sm"
                              (click)="disableManualEntry()"
                              class="px-2"
                            >
                              <ng-icon hlmIcon name="lucideSearch" class="h-4 w-4" />
                            </button>
                          </div>
                        }
                      </div>
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ getReleaseTypeDescription() }}
                      </p>
                    </div>
                  }
                </div>
              </div>

              <!-- Submit Button -->
              <button
                hlmBtn
                type="submit"
                class="w-full"
                [disabled]="!canSubmit() || service.loading()"
              >
                @if (service.loading()) {
                  <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4 animate-spin" />
                  Assessing...
                } @else {
                  <ng-icon hlmIcon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Assess Release
                }
              </button>
            </form>

            <!-- Info Box -->
            <div class="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 class="font-medium text-sm mb-2">What gets assessed?</h3>
              <ul class="text-xs text-muted-foreground space-y-1">
                <li>1. <strong>Defect Status</strong> - Open bugs and blockers for this release</li>
                <li>2. <strong>Work Completion</strong> - Stories and tasks marked as done</li>
                <li>3. <strong>Acceptance Criteria</strong> - Coverage and verification status</li>
                <li>4. <strong>Test Coverage</strong> - Linked tests and pass rates (if available)</li>
                <li>5. <strong>Recommendation</strong> - Go / No-Go / Conditional based on scores</li>
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
            <h2 class="font-semibold">Assessment History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past release assessments
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
                <ng-icon hlmIcon name="lucidePackageCheck" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your release assessments will appear here.
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
                          @if (session.recommendation === 'go') {
                            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                              <ng-icon hlmIcon name="lucideCheckCircle2" class="h-3 w-3" />
                              GO
                            </span>
                          } @else if (session.recommendation === 'no_go') {
                            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                              <ng-icon hlmIcon name="lucideXCircle" class="h-3 w-3" />
                              NO-GO
                            </span>
                          } @else if (session.recommendation === 'conditional_go') {
                            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                              <ng-icon hlmIcon name="lucideAlertTriangle" class="h-3 w-3" />
                              Conditional
                            </span>
                          }
                        } @else if (session.status === 'assessing') {
                          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                            <ng-icon hlmIcon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                            Assessing
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
                        {{ session.releaseIdentifier }} &middot; {{ session.releaseType }}
                      </p>
                      @if (session.status === 'ready' && session.readinessScore !== null) {
                        <div class="mt-2">
                          <div class="flex items-center gap-2">
                            <div class="flex-1 bg-muted rounded-full h-1.5">
                              <div
                                class="h-1.5 rounded-full transition-all"
                                [class.bg-green-500]="session.readinessScore >= 80"
                                [class.bg-yellow-500]="session.readinessScore >= 60 && session.readinessScore < 80"
                                [class.bg-red-500]="session.readinessScore < 60"
                                [style.width.%]="session.readinessScore"
                              ></div>
                            </div>
                            <span class="text-xs font-medium" [class.text-green-600]="session.readinessScore >= 80" [class.text-yellow-600]="session.readinessScore >= 60 && session.readinessScore < 80" [class.text-red-600]="session.readinessScore < 60">
                              {{ session.readinessScore }}%
                            </span>
                          </div>
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
                    {{ session.lastAssessmentAt ? formatRelativeTime(session.lastAssessmentAt) : 'Never assessed' }}
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
            <h2 class="text-xl font-semibold mb-2">Delete Assessment</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{{ deleteCandidate()?.name }}</strong>?
              This will remove all assessment data.
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
export class ReleaseReadinessComponent implements OnInit {
  protected service = inject(ReleaseReadinessService);
  private router = inject(Router);

  initialized = signal(false);
  deleteCandidate = signal<ReleaseReadinessSession | null>(null);

  // Form fields
  sessionName = '';
  releaseIdentifier = '';
  releaseType: ReleaseType = 'fixVersion';
  selectedIntegrationId = signal<number | null>(null);
  selectedProject = signal<ProjectOption | null>(null);

  // Dropdown states
  projectDropdownOpen = signal(false);
  optionsDropdownOpen = signal(false);
  manualEntry = signal(false);

  // Filters
  projectFilter = '';
  optionsFilter = '';
  hideReleasedVersions = false;

  // Release type configurations
  private jiraReleaseTypes = [
    { value: 'fixVersion' as ReleaseType, label: 'Fix Version', description: 'Jira fixVersion' },
    { value: 'sprint' as ReleaseType, label: 'Sprint', description: 'Sprint name' },
    { value: 'label' as ReleaseType, label: 'Label', description: 'Release label' },
  ];

  private adoReleaseTypes = [
    { value: 'sprint' as ReleaseType, label: 'Iteration', description: 'Iteration path' },
    { value: 'label' as ReleaseType, label: 'Tag', description: 'Work item tag' },
  ];

  async ngOnInit() {
    await this.service.checkIntegrations();
    if (this.service.hasValidIntegration()) {
      await this.service.loadSessions();
      // Auto-select first integration if only one
      const integrations = this.service.integrationCheck()?.integrations || [];
      if (integrations.length === 1) {
        this.selectedIntegrationId.set(integrations[0].id);
        await this.onIntegrationSelected(integrations[0].id);
      }
    }
    this.initialized.set(true);
  }

  // =========================================================================
  // COMPUTED PROPERTIES
  // =========================================================================

  selectedProvider(): string | null {
    const integrations = this.service.integrationCheck()?.integrations || [];
    const integration = integrations.find((i) => i.id === this.selectedIntegrationId());
    return integration?.provider || null;
  }

  availableReleaseTypes() {
    const provider = this.selectedProvider();
    if (provider === 'ado') return this.adoReleaseTypes;
    return this.jiraReleaseTypes;
  }

  filteredProjects() {
    const projects = this.service.projects();
    if (!this.projectFilter) return projects;
    const filter = this.projectFilter.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(filter) || p.key.toLowerCase().includes(filter)
    );
  }

  filteredOptions(): Array<{ id?: string; name: string; state?: string; released?: boolean }> {
    const filter = this.optionsFilter.toLowerCase();

    if (this.releaseType === 'fixVersion') {
      let versions = this.service.fixVersions();
      if (this.hideReleasedVersions) {
        versions = versions.filter((v) => !v.released);
      }
      if (filter) {
        versions = versions.filter((v) => v.name.toLowerCase().includes(filter));
      }
      return versions.map((v) => ({ id: v.id, name: v.name, released: v.released }));
    }

    if (this.releaseType === 'sprint') {
      let sprints = this.service.sprints();
      if (filter) {
        sprints = sprints.filter((s) => s.name.toLowerCase().includes(filter));
      }
      return sprints.map((s) => ({ id: s.id, name: s.name, state: s.state }));
    }

    if (this.releaseType === 'label') {
      let labels = this.service.labels();
      if (filter) {
        labels = labels.filter((l) => l.name.toLowerCase().includes(filter));
      }
      return labels.map((l) => ({ name: l.name }));
    }

    return [];
  }

  // =========================================================================
  // LABELS & DESCRIPTIONS
  // =========================================================================

  getReleaseTypeLabel(): string {
    const provider = this.selectedProvider();
    if (this.releaseType === 'sprint') {
      return provider === 'ado' ? 'Iteration' : 'Sprint';
    }
    if (this.releaseType === 'label') {
      return provider === 'ado' ? 'Tag' : 'Label';
    }
    return 'Fix Version';
  }

  getReleaseTypeDescription(): string {
    const provider = this.selectedProvider();
    if (this.releaseType === 'sprint') {
      return provider === 'ado'
        ? 'Select the iteration to assess for release readiness.'
        : 'Select the sprint to assess for release readiness.';
    }
    if (this.releaseType === 'label') {
      return provider === 'ado'
        ? 'Select a tag used to identify release items.'
        : 'Select a label used to identify release items.';
    }
    return 'Select the fix version to assess for release readiness.';
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  async onIntegrationSelected(integrationId: number) {
    this.selectedIntegrationId.set(integrationId);
    this.service.clearOptions();
    this.selectedProject.set(null);
    this.releaseIdentifier = '';
    this.manualEntry.set(false);

    // Set default release type based on provider
    const provider = this.selectedProvider();
    if (provider === 'ado') {
      this.releaseType = 'sprint';
    } else {
      this.releaseType = 'fixVersion';
    }

    // Load projects for the selected integration
    await this.service.loadProjects(integrationId);
    // Pre-load sprints for initial selection
    if (this.releaseType === 'sprint') {
      await this.service.loadSprints(integrationId);
    }
  }

  async onReleaseTypeChange(type: ReleaseType) {
    this.releaseType = type;
    this.releaseIdentifier = '';
    this.manualEntry.set(false);
    this.optionsFilter = '';

    const integrationId = this.selectedIntegrationId();
    if (!integrationId) return;

    // Load options based on type
    if (type === 'sprint') {
      await this.service.loadSprints(integrationId);
    } else if (type === 'label') {
      await this.service.loadLabels(integrationId);
    } else if (type === 'fixVersion' && this.selectedProject()) {
      await this.service.loadFixVersions(integrationId, this.selectedProject()!.key);
    }
  }

  async selectProject(project: ProjectOption) {
    this.selectedProject.set(project);
    this.projectDropdownOpen.set(false);
    this.projectFilter = '';
    this.releaseIdentifier = '';

    // Load fix versions for the selected project
    const integrationId = this.selectedIntegrationId();
    if (integrationId && this.releaseType === 'fixVersion') {
      await this.service.loadFixVersions(integrationId, project.key);
    }
  }

  selectOption(option: { id?: string; name: string }) {
    this.releaseIdentifier = option.name;
    this.optionsDropdownOpen.set(false);
    this.optionsFilter = '';
  }

  enableManualEntry() {
    this.manualEntry.set(true);
    this.optionsDropdownOpen.set(false);
    this.releaseIdentifier = '';
  }

  disableManualEntry() {
    this.manualEntry.set(false);
    this.releaseIdentifier = '';
  }

  canSubmit(): boolean {
    return this.selectedIntegrationId() !== null && this.releaseIdentifier.trim() !== '';
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const integrationId = this.selectedIntegrationId();
    if (!integrationId) return;

    const session = await this.service.createSession({
      name: this.sessionName || `Release ${this.releaseIdentifier}`,
      integrationId,
      releaseIdentifier: this.releaseIdentifier.trim(),
      releaseType: this.releaseType,
      projectKey: this.selectedProject()?.key || undefined,
    });

    if (session) {
      // Start assessment and navigate to results
      await this.service.assessRelease(session.id);
      this.router.navigate(['/testing/release-readiness', session.id]);
    }
  }

  viewSession(session: ReleaseReadinessSession) {
    this.router.navigate(['/testing/release-readiness', session.id]);
  }

  confirmDelete(session: ReleaseReadinessSession, event: Event) {
    event.stopPropagation();
    this.deleteCandidate.set(session);
  }

  async doDelete() {
    const session = this.deleteCandidate();
    if (!session) return;

    await this.service.deleteSession(session.id);
    this.deleteCandidate.set(null);
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
