import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideHistory,
  lucideLoader2,
  lucideSparkles,
  lucideTrash2,
  lucideX,
  lucidePlus,
  lucideRotateCw,
  lucideSearch,
  lucideTarget,
  lucideTrendingUp,
  lucideBuilding2,
} from '@ng-icons/lucide';
import { CompetitiveAnalysisService } from './competitive-analysis.service';
import type { CompetitiveAnalysisSession } from './competitive-analysis.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-competitive-analysis-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucideX,
      lucidePlus,
      lucideRotateCw,
      lucideSearch,
      lucideTarget,
      lucideTrendingUp,
      lucideBuilding2,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Competitive Analysis</h1>
          <p class="mt-1 text-muted-foreground">
            Learn how others solve the same problem — without manual research.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Step 1: Problem Area -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 1: Select Problem Area</h2>
              </div>
              <select
                class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                [value]="problemArea()"
                (change)="onProblemAreaChange($event)"
              >
                @for (area of service.problemAreas(); track area.value) {
                  <option [value]="area.value">{{ area.label }}</option>
                }
              </select>

              @if (problemArea() === 'other') {
                <input
                  type="text"
                  class="mt-3 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter custom problem area..."
                  [value]="customProblemArea()"
                  (input)="onCustomProblemAreaInput($event)"
                />
              }
            </div>

            <!-- Step 2: Reference Products -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideBuilding2" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 2: Select Reference Products</h2>
              </div>

              <!-- Checkboxes -->
              <div class="space-y-2 mb-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    [checked]="includeDirectCompetitors()"
                    (change)="toggleDirectCompetitors()"
                  />
                  <span class="text-sm">Direct competitors</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    [checked]="includeBestInClass()"
                    (change)="toggleBestInClass()"
                  />
                  <span class="text-sm">Best-in-class digital products</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    [checked]="includeAdjacentIndustries()"
                    (change)="toggleAdjacentIndustries()"
                  />
                  <span class="text-sm">Adjacent industries</span>
                </label>
              </div>

              <!-- Specific companies -->
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-2">
                  Specific products to analyze (optional)
                </p>
                <div class="flex flex-wrap gap-2 mb-2">
                  @for (company of referenceCompetitors(); track company) {
                    <span class="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm">
                      {{ company }}
                      <button
                        type="button"
                        class="p-0.5 hover:bg-background rounded-full"
                        (click)="removeCompetitor(company)"
                      >
                        <ng-icon name="lucideX" class="h-3 w-3" />
                      </button>
                    </span>
                  }
                </div>
                <div class="flex gap-2">
                  <input
                    type="text"
                    class="flex-1 rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Add company..."
                    [value]="newCompetitor()"
                    (input)="onNewCompetitorInput($event)"
                    (keydown.enter)="addCompetitor($event)"
                  />
                  <button
                    type="button"
                    hlmBtn
                    variant="outline"
                    size="sm"
                    (click)="addCompetitor()"
                    [disabled]="!newCompetitor().trim()"
                  >
                    <ng-icon name="lucidePlus" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Analyze Button -->
            <div class="mt-6">
              <button
                hlmBtn
                class="w-full"
                type="submit"
                [disabled]="!canSubmit() || service.loading()"
              >
                @if (service.loading()) {
                  <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  Running Analysis...
                } @else {
                  <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Run Competitive Analysis
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Analysis History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past competitive analyses
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto">
          @if (service.loading() && service.sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="h-4 bg-muted rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (service.sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideSearch" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your competitive analyses will appear here.
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
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status === 'analyzing'"
                          [class.text-yellow-700]="session.status === 'analyzing'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-gray-100]="session.status === 'pending'"
                          [class.text-gray-700]="session.status === 'pending'"
                        >
                          {{ formatStatus(session.status) }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-foreground">
                        {{ getProblemAreaLabel(session) }}
                      </p>
                      @if (session.referenceCompetitors.length > 0) {
                        <p class="mt-0.5 text-xs text-muted-foreground truncate">
                          {{ session.referenceCompetitors.join(', ') }}
                        </p>
                      }
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry Analysis"
                        >
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        (click)="deleteSession($event, session)"
                        title="Delete"
                      >
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                      <ng-icon name="lucideChevronRight" class="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              }

              @if (service.hasMore()) {
                <div class="pt-2 pb-4 text-center">
                  <button
                    hlmBtn
                    variant="ghost"
                    size="sm"
                    (click)="loadMoreSessions()"
                    [disabled]="service.loading()"
                  >
                    @if (service.loading()) {
                      <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                    }
                    Load More
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class CompetitiveAnalysisInputComponent implements OnInit {
  service = inject(CompetitiveAnalysisService);
  private router = inject(Router);

  // Form state
  problemArea = signal('login_auth');
  customProblemArea = signal('');
  referenceCompetitors = signal<string[]>([]);
  newCompetitor = signal('');
  includeDirectCompetitors = signal(true);
  includeBestInClass = signal(true);
  includeAdjacentIndustries = signal(false);

  // Computed
  canSubmit = computed(() => {
    if (this.problemArea() === 'other') {
      return this.customProblemArea().trim().length > 0;
    }
    return true;
  });

  async ngOnInit() {
    await Promise.all([
      this.service.loadProblemAreas(),
      this.service.loadSessions(true),
    ]);
  }

  onProblemAreaChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.problemArea.set(value);
  }

  onCustomProblemAreaInput(event: Event) {
    this.customProblemArea.set((event.target as HTMLInputElement).value);
  }

  onNewCompetitorInput(event: Event) {
    this.newCompetitor.set((event.target as HTMLInputElement).value);
  }

  toggleDirectCompetitors() {
    this.includeDirectCompetitors.update((v) => !v);
  }

  toggleBestInClass() {
    this.includeBestInClass.update((v) => !v);
  }

  toggleAdjacentIndustries() {
    this.includeAdjacentIndustries.update((v) => !v);
  }

  addCompetitor(event?: Event) {
    event?.preventDefault();
    const name = this.newCompetitor().trim();
    if (name && !this.referenceCompetitors().includes(name)) {
      this.referenceCompetitors.update((list) => [...list, name]);
      this.newCompetitor.set('');
    }
  }

  removeCompetitor(name: string) {
    this.referenceCompetitors.update((list) => list.filter((c) => c !== name));
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const session = await this.service.createSession({
      problemArea: this.problemArea(),
      customProblemArea:
        this.problemArea() === 'other' ? this.customProblemArea() : undefined,
      referenceCompetitors: this.referenceCompetitors(),
      includeDirectCompetitors: this.includeDirectCompetitors(),
      includeBestInClass: this.includeBestInClass(),
      includeAdjacentIndustries: this.includeAdjacentIndustries(),
    });

    if (session) {
      this.router.navigate(['/research/competitive-analysis/results', session.id]);
    }
  }

  viewSession(session: CompetitiveAnalysisSession) {
    this.router.navigate(['/research/competitive-analysis/results', session.id]);
  }

  async deleteSession(event: Event, session: CompetitiveAnalysisSession) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this analysis?')) {
      await this.service.deleteSession(session.id);
    }
  }

  async retrySession(event: Event, session: CompetitiveAnalysisSession) {
    event.stopPropagation();
    await this.service.retrySession(session.id);
    this.router.navigate(['/research/competitive-analysis/results', session.id]);
  }

  loadMoreSessions() {
    this.service.loadSessions();
  }

  getProblemAreaLabel(session: CompetitiveAnalysisSession): string {
    if (session.problemArea === 'other' && session.customProblemArea) {
      return session.customProblemArea;
    }
    return this.service.getProblemAreaLabel(session.problemArea);
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      analyzing: 'Analyzing',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
