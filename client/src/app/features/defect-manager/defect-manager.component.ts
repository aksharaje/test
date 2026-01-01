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
  lucideCheckCircle2,
  lucideBug,
  lucideHistory,
  lucideSparkles,
  lucideChevronRight,
  lucideChevronDown,
  lucideSearch,
} from '@ng-icons/lucide';
import { DefectManagerService } from './defect-manager.service';
import type { DefectManagerSession, ProjectOption } from './defect-manager.types';

@Component({
  selector: 'app-defect-manager',
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
      lucideCheckCircle2,
      lucideBug,
      lucideHistory,
      lucideSparkles,
      lucideChevronRight,
      lucideChevronDown,
      lucideSearch,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Defect Manager</h1>
          <p class="mt-1 text-muted-foreground">
            Triage, analyze, and prevent defects with intelligent insights
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
                Connect your Jira or Azure DevOps account to analyze defects.
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
                  <ng-icon hlmIcon name="lucideBug" class="h-5 w-5 text-primary" />
                  <h2 class="font-semibold">Analysis Configuration</h2>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="text-sm font-medium block mb-1.5">Analysis Name</label>
                    <input
                      type="text"
                      [(ngModel)]="sessionName"
                      name="sessionName"
                      placeholder="e.g., Sprint 24 Defects, Q4 Bug Analysis"
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
                              <ng-icon hlmIcon name="lucideBug" class="h-4 w-4" />
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

                  <!-- Project Filter -->
                  @if (selectedIntegrationId()) {
                    <div>
                      <label class="text-sm font-medium block mb-1.5">Project (optional)</label>
                      <div class="relative">
                        <button
                          type="button"
                          class="w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-background text-sm text-left"
                          (click)="projectDropdownOpen.set(!projectDropdownOpen())"
                        >
                          <span [class.text-muted-foreground]="!selectedProject()">
                            {{ selectedProject() ? selectedProject()!.name + ' (' + selectedProject()!.key + ')' : 'All projects' }}
                          </span>
                          <ng-icon hlmIcon name="lucideChevronDown" class="h-4 w-4 text-muted-foreground" />
                        </button>
                        @if (projectDropdownOpen()) {
                          <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg max-h-64 overflow-y-auto">
                            <input
                              type="text"
                              [(ngModel)]="projectSearchFilter"
                              name="projectSearchFilter"
                              placeholder="Search projects..."
                              class="w-full px-3 py-2 border-b bg-background text-sm"
                              (click)="$event.stopPropagation()"
                            />
                            @if (service.loadingOptions()) {
                              <div class="p-3 text-sm text-muted-foreground text-center">
                                <ng-icon hlmIcon name="lucideRefreshCw" class="h-4 w-4 animate-spin inline mr-2" />
                                Loading projects...
                              </div>
                            } @else {
                              <!-- All projects option -->
                              <button
                                type="button"
                                class="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                                (click)="selectProject(null)"
                              >
                                <span>All projects</span>
                                @if (!selectedProject()) {
                                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                }
                              </button>
                              @if (filteredProjects().length === 0) {
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
                            }
                          </div>
                        }
                      </div>
                      <p class="text-xs text-muted-foreground mt-1">
                        Filter defects to a specific project. Leave as 'All projects' to analyze everything.
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
                  Analyzing...
                } @else {
                  <ng-icon hlmIcon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Analyze Defects
                }
              </button>
            </form>

            <!-- Info Box -->
            <div class="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 class="font-medium text-sm mb-2">What happens during analysis?</h3>
              <ul class="text-xs text-muted-foreground space-y-1">
                <li>1. Fetches all bug/defect items from your integration</li>
                <li>2. Normalizes severity levels across different naming conventions</li>
                <li>3. Detects potential duplicate defects using fuzzy matching</li>
                <li>4. Identifies patterns by component, label, and root cause</li>
                <li>5. Generates prevention recommendations based on findings</li>
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
            <h2 class="font-semibold">Analysis History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past defect analyses
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
                <ng-icon hlmIcon name="lucideBug" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your defect analyses will appear here.
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
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'ready'"
                          [class.text-green-700]="session.status === 'ready'"
                          [class.bg-yellow-100]="session.status === 'analyzing'"
                          [class.text-yellow-700]="session.status === 'analyzing'"
                          [class.bg-red-100]="session.status === 'error'"
                          [class.text-red-700]="session.status === 'error'"
                          [class.bg-gray-100]="session.status === 'draft'"
                          [class.text-gray-700]="session.status === 'draft'"
                        >
                          @if (session.status === 'ready') {
                            <ng-icon hlmIcon name="lucideCheckCircle2" class="h-3 w-3 mr-1" />
                          } @else if (session.status === 'analyzing') {
                            <ng-icon hlmIcon name="lucideRefreshCw" class="h-3 w-3 mr-1 animate-spin" />
                          } @else if (session.status === 'error') {
                            <ng-icon hlmIcon name="lucideAlertCircle" class="h-3 w-3 mr-1" />
                          }
                          {{ session.status === 'ready' ? 'Complete' : session.status === 'analyzing' ? 'Analyzing' : session.status === 'error' ? 'Error' : 'Draft' }}
                        </span>
                      </div>
                      <h3 class="mt-2 font-medium text-sm truncate">{{ session.name }}</h3>
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ session.integrationName || 'Unknown' }} &middot; Level {{ session.dataLevel }}
                      </p>
                      @if (session.status === 'ready' && session.analysisSnapshot) {
                        <div class="flex items-center gap-3 mt-2 text-xs">
                          <span class="text-muted-foreground">
                            {{ session.analysisSnapshot.totalDefects }} defects
                          </span>
                          @if (session.analysisSnapshot.criticalOpen > 0) {
                            <span class="text-red-600 font-medium">
                              {{ session.analysisSnapshot.criticalOpen }} critical
                            </span>
                          }
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
                    {{ session.lastAnalysisAt ? formatRelativeTime(session.lastAnalysisAt) : 'Never analyzed' }}
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
            <h2 class="text-xl font-semibold mb-2">Delete Analysis</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{{ deleteCandidate()?.name }}</strong>?
              This will remove all analyzed defect data.
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
export class DefectManagerComponent implements OnInit {
  protected service = inject(DefectManagerService);
  private router = inject(Router);

  initialized = signal(false);
  deleteCandidate = signal<DefectManagerSession | null>(null);

  // Form fields
  sessionName = '';
  selectedIntegrationId = signal<number | null>(null);
  selectedProject = signal<ProjectOption | null>(null);

  // Dropdown states
  projectDropdownOpen = signal(false);
  projectSearchFilter = '';

  async ngOnInit() {
    await this.service.checkIntegrations();
    if (this.service.hasValidIntegration()) {
      await this.service.loadSessions();
      // Auto-select first integration if only one
      const integrations = this.service.integrationCheck()?.integrations || [];
      if (integrations.length === 1) {
        await this.onIntegrationSelected(integrations[0].id);
      }
    }
    this.initialized.set(true);
  }

  // =========================================================================
  // COMPUTED PROPERTIES
  // =========================================================================

  filteredProjects() {
    const projects = this.service.projects();
    if (!this.projectSearchFilter) return projects;
    const filter = this.projectSearchFilter.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(filter) || p.key.toLowerCase().includes(filter)
    );
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  async onIntegrationSelected(integrationId: number) {
    this.selectedIntegrationId.set(integrationId);
    this.selectedProject.set(null);
    this.service.clearProjects();

    // Load projects for the selected integration
    await this.service.loadProjects(integrationId);
  }

  selectProject(project: ProjectOption | null) {
    this.selectedProject.set(project);
    this.projectDropdownOpen.set(false);
    this.projectSearchFilter = '';
  }

  canSubmit(): boolean {
    return this.selectedIntegrationId() !== null;
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const integrationId = this.selectedIntegrationId();
    if (!integrationId) return;

    const session = await this.service.createSession({
      name: this.sessionName || 'Defect Analysis',
      integrationId,
      projectFilter: this.selectedProject()?.key || undefined,
    });

    if (session) {
      // Start analysis and navigate to results
      await this.service.analyzeSession(session.id);
      this.router.navigate(['/testing/defect-manager', session.id]);
    }
  }

  viewSession(session: DefectManagerSession) {
    this.router.navigate(['/testing/defect-manager', session.id]);
  }

  confirmDelete(session: DefectManagerSession, event: Event) {
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
