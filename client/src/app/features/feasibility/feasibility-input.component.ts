import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { UpperCasePipe, SlicePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideHistory,
  lucideLoader2,
  lucideSparkles,
  lucideTrash2,
  lucideFileText,
  lucideLayers,
  lucideX,
  lucideLightbulb,
  lucideCheck,
  lucideSquare,
  lucideCheckSquare,
  lucideRotateCw,
} from '@ng-icons/lucide';
import { FeasibilityService, EpicOrFeature, IdeaForSelection } from './feasibility.service';
import type { FeasibilitySession } from './feasibility.types';
import { HlmButtonDirective } from '../../ui/button';

type SourceType = 'custom' | 'artifact' | 'ideation';

@Component({
  selector: 'app-feasibility-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, UpperCasePipe, SlicePipe],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucideFileText,
      lucideLayers,
      lucideX,
      lucideLightbulb,
      lucideCheck,
      lucideSquare,
      lucideCheckSquare,
      lucideRotateCw,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Feasibility Analyzer</h1>
          <p class="mt-1 text-muted-foreground">
            Describe your feature and our AI agents will decompose it, estimate effort, project timelines, and assess risks.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Source Selection (only show if there are options) -->
            @if (hasImportOptions()) {
              <div class="rounded-lg border bg-muted/30 p-4">
                <p class="text-sm font-medium mb-3">Import from existing work</p>

                <!-- Source Type Tabs -->
                <div class="flex gap-2 mb-3">
                  @if (service.epicsAndFeatures().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="sourceType() === 'artifact'"
                      [class.text-primary-foreground]="sourceType() === 'artifact'"
                      [class.bg-muted]="sourceType() !== 'artifact'"
                      [class.hover:bg-muted/80]="sourceType() !== 'artifact'"
                      (click)="setSourceType('artifact')"
                    >
                      <ng-icon name="lucideLayers" class="h-3.5 w-3.5" />
                      Epic/Feature
                    </button>
                  }
                  @if (service.ideationSessions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="sourceType() === 'ideation'"
                      [class.text-primary-foreground]="sourceType() === 'ideation'"
                      [class.bg-muted]="sourceType() !== 'ideation'"
                      [class.hover:bg-muted/80]="sourceType() !== 'ideation'"
                      (click)="setSourceType('ideation')"
                    >
                      <ng-icon name="lucideLightbulb" class="h-3.5 w-3.5" />
                      Ideation Ideas
                    </button>
                  }
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="sourceType() === 'custom'"
                    [class.text-primary-foreground]="sourceType() === 'custom'"
                    [class.bg-muted]="sourceType() !== 'custom'"
                    [class.hover:bg-muted/80]="sourceType() !== 'custom'"
                    (click)="setSourceType('custom')"
                  >
                    <ng-icon name="lucideFileText" class="h-3.5 w-3.5" />
                    Write Custom
                  </button>
                </div>

                <!-- Epic/Feature Selection -->
                @if (sourceType() === 'artifact') {
                  @if (selectedArtifact()) {
                    <div class="flex items-center justify-between gap-2 rounded-lg border bg-background p-3">
                      <div class="flex items-center gap-2 min-w-0">
                        <ng-icon
                          [name]="selectedArtifact()!.type === 'epic' ? 'lucideLayers' : 'lucideFileText'"
                          class="h-4 w-4 flex-shrink-0"
                          [class.text-purple-600]="selectedArtifact()!.type === 'epic'"
                          [class.text-blue-600]="selectedArtifact()!.type === 'feature'"
                        />
                        <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {{ selectedArtifact()!.type }}
                        </span>
                        <span class="text-sm font-medium truncate">{{ selectedArtifact()!.title }}</span>
                      </div>
                      <button
                        type="button"
                        class="p-1 hover:bg-muted rounded"
                        (click)="clearArtifactSelection()"
                        title="Clear selection"
                      >
                        <ng-icon name="lucideX" class="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  } @else {
                    <select
                      class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      (change)="onArtifactSelect($event)"
                    >
                      <option value="">Select an epic or feature...</option>
                      @for (item of service.epicsAndFeatures(); track item.id) {
                        <option [value]="item.id">
                          [{{ item.type | uppercase }}] {{ item.title }}
                        </option>
                      }
                    </select>
                  }
                }

                <!-- Ideation Selection -->
                @if (sourceType() === 'ideation') {
                  <!-- Session Dropdown -->
                  <select
                    class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                    [value]="selectedIdeationSessionId()"
                    (change)="onIdeationSessionSelect($event)"
                  >
                    <option value="">Select an ideation session...</option>
                    @for (session of service.ideationSessions(); track session.id) {
                      <option [value]="session.id">
                        {{ session.problemStatement | slice:0:60 }}{{ session.problemStatement.length > 60 ? '...' : '' }}
                      </option>
                    }
                  </select>

                  <!-- Ideas List -->
                  @if (service.selectedIdeationIdeas().length > 0) {
                    <div class="border rounded-lg bg-background">
                      <!-- Header with Select All/None -->
                      <div class="flex items-center justify-between p-2 border-b bg-muted/30">
                        <span class="text-xs font-medium text-muted-foreground">
                          {{ selectedIdeaCount() }} of {{ service.selectedIdeationIdeas().length }} ideas selected
                        </span>
                        <div class="flex gap-2">
                          <button
                            type="button"
                            class="text-xs text-primary hover:underline"
                            (click)="service.selectAllIdeas()"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            class="text-xs text-muted-foreground hover:underline"
                            (click)="service.deselectAllIdeas()"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      <!-- Ideas Checklist -->
                      <div class="max-h-48 overflow-y-auto divide-y">
                        @for (idea of service.selectedIdeationIdeas(); track idea.id) {
                          <label class="flex items-start gap-3 p-2 hover:bg-muted/30 cursor-pointer">
                            <input
                              type="checkbox"
                              class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              [checked]="idea.selected"
                              (change)="service.toggleIdeaSelection(idea.id)"
                            />
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-medium truncate">{{ idea.title }}</p>
                              <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {{ idea.category }}
                                </span>
                                <span class="text-xs text-muted-foreground">
                                  {{ idea.effortEstimate }} effort · {{ idea.impactEstimate }} impact
                                </span>
                              </div>
                            </div>
                          </label>
                        }
                      </div>
                    </div>
                  }
                }

                <!-- Custom hint -->
                @if (sourceType() === 'custom') {
                  <p class="text-xs text-muted-foreground">
                    Write your own feature description below.
                  </p>
                }
              </div>
            }

            <!-- Feature Description -->
            <div>
              <label class="text-sm font-medium">
                Feature Description <span class="text-destructive">*</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Describe the feature in detail (minimum 100 characters)
              </p>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[150px]"
                [value]="featureDescription()"
                (input)="onFeatureDescriptionInput($event)"
                required
              ></textarea>
              <p class="text-xs mt-1" [class.text-muted-foreground]="charCount() >= 100" [class.text-destructive]="charCount() < 100">
                {{ charCount() }} characters (min 100)
              </p>
            </div>

            <!-- Optional Fields Collapsible -->
            <div class="border rounded-lg">
              <button
                type="button"
                class="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                (click)="toggleOptionalFields()"
              >
                <span>Optional Fields</span>
                <ng-icon
                  [name]="optionalFieldsOpen() ? 'lucideChevronDown' : 'lucideChevronRight'"
                  class="h-4 w-4"
                />
              </button>

              @if (optionalFieldsOpen()) {
                <div class="p-3 pt-0 space-y-4">
                  <!-- Technical Constraints -->
                  <div>
                    <label class="text-sm font-medium">
                      Technical Constraints
                    </label>
                    <textarea
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                      placeholder="e.g., Must use existing Python/FastAPI backend, PostgreSQL database, integrate with Springboard API..."
                      [value]="technicalConstraints()"
                      (input)="onTechnicalConstraintsInput($event)"
                    ></textarea>
                  </div>

                  <!-- Target Users -->
                  <div>
                    <label class="text-sm font-medium">
                      Target Users
                    </label>
                    <textarea
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                      placeholder="e.g., Product managers, engineering teams, enterprise clients..."
                      [value]="targetUsers()"
                      (input)="onTargetUsersInput($event)"
                    ></textarea>
                  </div>
                </div>
              }
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
                  Starting Analysis...
                } @else {
                  <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Analyze Feasibility
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
            View and manage your past feasibility analyses
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
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your feasibility analyses will appear here.
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
                          [class.bg-yellow-100]="isProcessing(session.status)"
                          [class.text-yellow-700]="isProcessing(session.status)"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-gray-100]="session.status === 'pending'"
                          [class.text-gray-700]="session.status === 'pending'"
                          [class.text-gray-700]="session.status === 'pending'"
                        >
                          {{ formatStatus(session.status) }}
                        </span>
                        @if (session.goNoGoRecommendation) {
                          <span
                            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                            [class.bg-green-100]="session.goNoGoRecommendation === 'go'"
                            [class.text-green-700]="session.goNoGoRecommendation === 'go'"
                            [class.bg-red-100]="session.goNoGoRecommendation === 'no_go'"
                            [class.text-red-700]="session.goNoGoRecommendation === 'no_go'"
                            [class.bg-yellow-100]="session.goNoGoRecommendation === 'conditional'"
                            [class.text-yellow-700]="session.goNoGoRecommendation === 'conditional'"
                          >
                            {{ formatRecommendation(session.goNoGoRecommendation) }}
                          </span>
                        }
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-foreground line-clamp-2">
                        {{ session.featureDescription }}
                      </p>
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
                    hlmBtn variant="ghost" size="sm" 
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
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class FeasibilityInputComponent implements OnInit {
  service = inject(FeasibilityService);
  private router = inject(Router);

  // Form state
  featureDescription = signal('');
  technicalConstraints = signal('');
  targetUsers = signal('');
  optionalFieldsOpen = signal(false);
  selectedArtifact = signal<EpicOrFeature | null>(null);
  sourceType = signal<SourceType>('custom');
  selectedIdeationSessionId = signal<number | null>(null);

  // Computed
  charCount = computed(() => this.featureDescription().length);
  canSubmit = computed(() => this.charCount() >= 100);
  hasImportOptions = computed(() =>
    this.service.epicsAndFeatures().length > 0 || this.service.ideationSessions().length > 0
  );
  selectedIdeaCount = computed(() =>
    this.service.selectedIdeationIdeas().filter((i) => i.selected).length
  );

  constructor() {
    // Effect to update description when ideation ideas change
    effect(() => {
      if (this.sourceType() === 'ideation') {
        const description = this.service.buildIdeationDescription();
        if (description) {
          this.featureDescription.set(description);
        }
      }
    });
  }

  async ngOnInit() {
    // Load all data sources in parallel
    await Promise.all([
      this.service.loadSessions(true), // reset=true
      this.service.loadEpicsAndFeatures(),
      this.service.loadIdeationSessions(),
    ]);
  }

  setSourceType(type: SourceType) {
    this.sourceType.set(type);
    // Clear selections when switching types
    if (type !== 'artifact') {
      this.selectedArtifact.set(null);
    }
    if (type !== 'ideation') {
      this.selectedIdeationSessionId.set(null);
      this.service.clearIdeationSelection();
    }
    if (type === 'custom') {
      this.featureDescription.set('');
    }
  }

  onArtifactSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = parseInt(select.value, 10);
    if (!id) {
      this.selectedArtifact.set(null);
      return;
    }

    const artifact = this.service.epicsAndFeatures().find((a) => a.id === id);
    if (artifact) {
      this.selectedArtifact.set(artifact);
      // Populate the description from the artifact (full content, no truncation)
      const description = `${artifact.title}\n\n${artifact.description}`;
      this.featureDescription.set(description);
    }
  }

  clearArtifactSelection() {
    this.selectedArtifact.set(null);
    this.featureDescription.set('');
  }

  async onIdeationSessionSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = parseInt(select.value, 10);
    if (!id) {
      this.selectedIdeationSessionId.set(null);
      this.service.clearIdeationSelection();
      this.featureDescription.set('');
      return;
    }

    this.selectedIdeationSessionId.set(id);
    await this.service.loadIdeationSessionIdeas(id);
    // Description will be updated via effect
  }

  // Keep for backwards compatibility with existing code
  clearSelection() {
    this.clearArtifactSelection();
  }

  onFeatureDescriptionInput(event: Event) {
    this.featureDescription.set((event.target as HTMLTextAreaElement).value);
  }

  onTechnicalConstraintsInput(event: Event) {
    this.technicalConstraints.set((event.target as HTMLTextAreaElement).value);
  }

  onTargetUsersInput(event: Event) {
    this.targetUsers.set((event.target as HTMLTextAreaElement).value);
  }

  toggleOptionalFields() {
    this.optionalFieldsOpen.update((v) => !v);
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const session = await this.service.createSession({
      featureDescription: this.featureDescription(),
      technicalConstraints: this.technicalConstraints() || undefined,
      targetUsers: this.targetUsers() || undefined,
    });

    if (session) {
      this.router.navigate(['/feasibility/processing', session.id]);
    }
  }

  viewSession(session: FeasibilitySession) {
    if (session.status === 'completed') {
      this.router.navigate(['/feasibility/results', session.id]);
    } else {
      // Navigate to processing for pending, processing, OR failed states
      this.router.navigate(['/feasibility/processing', session.id]);
    }
  }

  async deleteSession(event: Event, session: FeasibilitySession) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this analysis?')) {
      await this.service.deleteSession(session.id);
    }
  }

  async retrySession(event: Event, session: FeasibilitySession) {
    event.stopPropagation();
    await this.service.retrySession(session.id);
    // Navigate to processing view
    this.router.navigate(['/feasibility/processing', session.id]);
  }

  loadMoreSessions() {
    this.service.loadSessions();
  }

  isProcessing(status: string): boolean {
    return ['decomposing', 'estimating', 'scheduling', 'risk_analyzing'].includes(status);
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      decomposing: 'Decomposing',
      estimating: 'Estimating',
      scheduling: 'Scheduling',
      risk_analyzing: 'Analyzing Risks',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  formatRecommendation(recommendation: string): string {
    const labels: Record<string, string> = {
      go: 'Go',
      no_go: 'No-Go',
      conditional: 'Conditional',
    };
    return labels[recommendation] || recommendation;
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
