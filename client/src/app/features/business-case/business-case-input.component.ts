import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { SlicePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideHistory,
  lucideLoader2,
  lucideSparkles,
  lucideTrash2,
  lucideLink,
  lucideCalculator,
  lucideDollarSign,
  lucideTrendingUp,
  lucideFileText,
  lucideLayers,
  lucideX,
  lucideLightbulb,
  lucideCheckCircle,
} from '@ng-icons/lucide';
import { BusinessCaseService, FeasibilitySessionSummary, EpicOrFeature } from './business-case.service';
import type { BusinessCaseSession } from './business-case.types';
import { HlmButtonDirective } from '../../ui/button';

type SourceType = 'feasibility' | 'artifact' | 'ideation' | 'custom';

@Component({
  selector: 'app-business-case-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe, DecimalPipe, UpperCasePipe],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucideLink,
      lucideCalculator,
      lucideDollarSign,
      lucideTrendingUp,
      lucideFileText,
      lucideLayers,
      lucideX,
      lucideLightbulb,
      lucideCheckCircle,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Business Case Builder</h1>
          <p class="mt-1 text-muted-foreground">
            Build a comprehensive business case with AI-powered cost/benefit analysis, financial projections, and ROI calculations.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Source Selection -->
            <div class="rounded-lg border bg-muted/30 p-4">
              <p class="text-sm font-medium mb-3">Select Feature Source</p>

              <!-- Source Type Tabs -->
              <div class="flex gap-2 mb-4 flex-wrap">
                @if (service.feasibilitySessions().length > 0) {
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="sourceType() === 'feasibility'"
                    [class.text-primary-foreground]="sourceType() === 'feasibility'"
                    [class.bg-muted]="sourceType() !== 'feasibility'"
                    [class.hover:bg-muted/80]="sourceType() !== 'feasibility'"
                    (click)="setSourceType('feasibility')"
                  >
                    <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5" />
                    Feasibility Analysis
                  </button>
                }
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

              <!-- Feasibility Selection -->
              @if (sourceType() === 'feasibility') {
                @if (selectedFeasibility()) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                          <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-green-600" />
                          <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Feasibility Analysis
                          </span>
                          @if (selectedFeasibility()!.goNoGoRecommendation) {
                            <span
                              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                              [class.bg-green-100]="selectedFeasibility()!.goNoGoRecommendation === 'go'"
                              [class.text-green-700]="selectedFeasibility()!.goNoGoRecommendation === 'go'"
                              [class.bg-red-100]="selectedFeasibility()!.goNoGoRecommendation === 'no_go'"
                              [class.text-red-700]="selectedFeasibility()!.goNoGoRecommendation === 'no_go'"
                              [class.bg-yellow-100]="selectedFeasibility()!.goNoGoRecommendation === 'conditional'"
                              [class.text-yellow-700]="selectedFeasibility()!.goNoGoRecommendation === 'conditional'"
                            >
                              {{ formatRecommendation(selectedFeasibility()!.goNoGoRecommendation!) }}
                            </span>
                          }
                        </div>
                        <p class="text-sm text-foreground">{{ selectedFeasibility()!.featureDescription }}</p>
                        <p class="text-xs text-muted-foreground mt-2">
                          Created {{ formatDate(selectedFeasibility()!.createdAt) }}
                        </p>
                      </div>
                      <button
                        type="button"
                        class="p-1 hover:bg-muted rounded flex-shrink-0"
                        (click)="clearFeasibilitySelection()"
                        title="Clear selection"
                      >
                        <ng-icon name="lucideX" class="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                } @else {
                  <select
                    class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    (change)="onFeasibilitySelect($event)"
                  >
                    <option value="">Select a completed feasibility analysis...</option>
                    @for (session of service.feasibilitySessions(); track session.id) {
                      <option [value]="session.id">
                        {{ session.featureDescription }}
                        @if (session.goNoGoRecommendation) {
                          ({{ formatRecommendation(session.goNoGoRecommendation) }})
                        }
                      </option>
                    }
                  </select>
                  <p class="text-xs text-muted-foreground mt-2">
                    Development estimates will be imported from the feasibility analysis.
                  </p>
                }
              }

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
                  Enter a custom feature name and description below.
                </p>
              }
            </div>

            <!-- Feature Name & Description (only show when NOT using feasibility) -->
            @if (sourceType() !== 'feasibility') {
              <!-- Feature Name -->
              <div>
                <label class="text-sm font-medium">
                  Feature Name <span class="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., AI-Powered Recommendation Engine"
                  [value]="featureName()"
                  (input)="onFeatureNameInput($event)"
                  required
                  minlength="3"
                  maxlength="200"
                />
                <p class="text-xs mt-1 text-muted-foreground">
                  A short, descriptive name for the feature (3-200 characters)
                </p>
              </div>

              <!-- Feature Description -->
              <div>
                <label class="text-sm font-medium">
                  Feature Description <span class="text-destructive">*</span>
                </label>
                <p class="text-xs text-muted-foreground mt-1">
                  Describe the feature and its business value (minimum 50 characters)
                </p>
                <textarea
                  class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                  placeholder="Describe the feature, its purpose, and the business problem it solves..."
                  [value]="featureDescription()"
                  (input)="onFeatureDescriptionInput($event)"
                  required
                ></textarea>
                <p class="text-xs mt-1" [class.text-muted-foreground]="descCharCount() === 0 || descCharCount() >= 50" [class.text-destructive]="descCharCount() > 0 && descCharCount() < 50">
                  {{ descCharCount() }} characters (min 50)
                </p>
              </div>
            }

            <!-- Optional Fields Collapsible -->
            <div class="border rounded-lg">
              <button
                type="button"
                class="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                (click)="toggleOptionalFields()"
              >
                <span>Business Context (Optional)</span>
                <ng-icon
                  [name]="optionalFieldsOpen() ? 'lucideChevronDown' : 'lucideChevronRight'"
                  class="h-4 w-4"
                />
              </button>

              @if (optionalFieldsOpen()) {
                <div class="p-3 pt-0 space-y-4">
                  <!-- Business Context -->
                  <div>
                    <label class="text-sm font-medium">
                      Business Context
                    </label>
                    <textarea
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                      placeholder="e.g., Mid-size e-commerce company, 50 employees, $10M annual revenue, looking to improve customer retention..."
                      [value]="businessContext()"
                      (input)="onBusinessContextInput($event)"
                    ></textarea>
                    <p class="text-xs mt-1 text-muted-foreground">
                      Helps calibrate cost and benefit estimates to your situation
                    </p>
                  </div>

                  <!-- Target Market -->
                  <div>
                    <label class="text-sm font-medium">
                      Target Market
                    </label>
                    <textarea
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                      placeholder="e.g., Enterprise B2B customers in financial services, SMB e-commerce businesses..."
                      [value]="targetMarket()"
                      (input)="onTargetMarketInput($event)"
                    ></textarea>
                  </div>
                </div>
              }
            </div>

            <!-- What You'll Get -->
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-sm font-medium mb-3">What you'll get:</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <ng-icon name="lucideDollarSign" class="h-4 w-4 text-green-600" />
                  <span>Cost breakdown</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <ng-icon name="lucideTrendingUp" class="h-4 w-4 text-blue-600" />
                  <span>Benefit projections</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <ng-icon name="lucideCalculator" class="h-4 w-4 text-purple-600" />
                  <span>NPV, IRR, Payback</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <ng-icon name="lucideSparkles" class="h-4 w-4 text-amber-600" />
                  <span>Sensitivity analysis</span>
                </div>
              </div>
            </div>

            <!-- Build Button -->
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
                  <ng-icon name="lucideCalculator" class="mr-2 h-4 w-4" />
                  Build Business Case
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
            <h2 class="font-semibold">Business Case History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past business case analyses
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
                  Your business case analyses will appear here.
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
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium text-sm">{{ session.featureName }}</span>
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
                        @if (session.recommendation) {
                          <span
                            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                            [class.bg-green-100]="session.recommendation === 'invest'"
                            [class.text-green-700]="session.recommendation === 'invest'"
                            [class.bg-red-100]="session.recommendation === 'reject' || session.recommendation === 'defer'"
                            [class.text-red-700]="session.recommendation === 'reject' || session.recommendation === 'defer'"
                            [class.bg-yellow-100]="session.recommendation === 'conditional'"
                            [class.text-yellow-700]="session.recommendation === 'conditional'"
                          >
                            {{ formatSessionRecommendation(session.recommendation) }}
                          </span>
                        }
                      </div>
                      <div class="flex items-center gap-3 mt-1.5">
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                        @if (session.netPresentValue !== null) {
                          <span class="text-xs font-medium" [class.text-green-600]="session.netPresentValue > 0" [class.text-red-600]="session.netPresentValue <= 0">
                            NPV: {{ formatCurrency(session.netPresentValue) }}
                          </span>
                        }
                        @if (session.roiPercentage !== null) {
                          <span class="text-xs text-muted-foreground">
                            ROI: {{ session.roiPercentage | number:'1.0-0' }}%
                          </span>
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
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
export class BusinessCaseInputComponent implements OnInit {
  service = inject(BusinessCaseService);
  private router = inject(Router);

  // Form state
  sourceType = signal<SourceType>('custom');
  featureName = signal('');
  featureDescription = signal('');
  businessContext = signal('');
  targetMarket = signal('');
  optionalFieldsOpen = signal(false);

  // Selection state
  selectedFeasibility = signal<FeasibilitySessionSummary | null>(null);
  selectedArtifact = signal<EpicOrFeature | null>(null);
  selectedIdeationSessionId = signal<number | null>(null);

  // Computed
  descCharCount = computed(() => this.featureDescription().length);
  selectedIdeaCount = computed(() =>
    this.service.selectedIdeationIdeas().filter((i) => i.selected).length
  );

  canSubmit = computed(() => {
    if (this.sourceType() === 'feasibility') {
      return this.selectedFeasibility() !== null;
    }
    return this.featureName().length >= 3 && this.featureDescription().length >= 50;
  });

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
    await Promise.all([
      this.service.loadSessions(),
      this.service.loadFeasibilitySessions(),
      this.service.loadEpicsAndFeatures(),
      this.service.loadIdeationSessions(),
    ]);

    // Default to feasibility if available
    if (this.service.feasibilitySessions().length > 0) {
      this.sourceType.set('feasibility');
    }
  }

  setSourceType(type: SourceType) {
    this.sourceType.set(type);

    // Clear selections when switching types
    if (type !== 'feasibility') {
      this.selectedFeasibility.set(null);
    }
    if (type !== 'artifact') {
      this.selectedArtifact.set(null);
    }
    if (type !== 'ideation') {
      this.selectedIdeationSessionId.set(null);
      this.service.clearIdeationSelection();
    }
    if (type === 'custom') {
      this.featureName.set('');
      this.featureDescription.set('');
    }
  }

  onFeasibilitySelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = parseInt(select.value, 10);
    if (!id) {
      this.selectedFeasibility.set(null);
      return;
    }

    const session = this.service.feasibilitySessions().find((s) => s.id === id);
    if (session) {
      this.selectedFeasibility.set(session);
    }
  }

  clearFeasibilitySelection() {
    this.selectedFeasibility.set(null);
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
      // Populate the description from the artifact
      this.featureName.set(artifact.title);
      this.featureDescription.set(`${artifact.title}\n\n${artifact.description}`);
    }
  }

  clearArtifactSelection() {
    this.selectedArtifact.set(null);
    this.featureName.set('');
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

  onFeatureNameInput(event: Event) {
    this.featureName.set((event.target as HTMLInputElement).value);
  }

  onFeatureDescriptionInput(event: Event) {
    this.featureDescription.set((event.target as HTMLTextAreaElement).value);
  }

  onBusinessContextInput(event: Event) {
    this.businessContext.set((event.target as HTMLTextAreaElement).value);
  }

  onTargetMarketInput(event: Event) {
    this.targetMarket.set((event.target as HTMLTextAreaElement).value);
  }

  toggleOptionalFields() {
    this.optionalFieldsOpen.update((v) => !v);
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    let session;

    if (this.sourceType() === 'feasibility' && this.selectedFeasibility()) {
      // Submit with just the feasibility session ID
      session = await this.service.createSession({
        feasibilitySessionId: this.selectedFeasibility()!.id,
        businessContext: this.businessContext() || undefined,
        targetMarket: this.targetMarket() || undefined,
      });
    } else {
      // Submit with feature name and description
      session = await this.service.createSession({
        featureName: this.featureName(),
        featureDescription: this.featureDescription(),
        businessContext: this.businessContext() || undefined,
        targetMarket: this.targetMarket() || undefined,
      });
    }

    if (session) {
      this.router.navigate(['/business-case/processing', session.id]);
    }
  }

  viewSession(session: BusinessCaseSession) {
    if (session.status === 'completed') {
      this.router.navigate(['/business-case/results', session.id]);
    } else if (session.status !== 'failed') {
      this.router.navigate(['/business-case/processing', session.id]);
    }
  }

  async deleteSession(event: Event, session: BusinessCaseSession) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this business case?')) {
      await this.service.deleteSession(session.id);
    }
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

  formatRecommendation(recommendation: string): string {
    const labels: Record<string, string> = {
      go: 'Go',
      no_go: 'No-Go',
      conditional: 'Conditional',
    };
    return labels[recommendation] || recommendation;
  }

  formatSessionRecommendation(recommendation: string): string {
    const labels: Record<string, string> = {
      invest: 'Invest',
      conditional: 'Conditional',
      defer: 'Defer',
      reject: 'Reject',
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

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
