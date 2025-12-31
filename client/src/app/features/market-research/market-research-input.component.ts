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
  lucideRotateCw,
  lucideSearch,
  lucideTarget,
  lucideTrendingUp,
  lucideBuilding2,
  lucideCheck,
  lucideUsers,
  lucideAlertTriangle,
  lucideShield,
  lucideZap,
  lucideLightbulb,
  lucideFileText,
} from '@ng-icons/lucide';
import { MarketResearchService } from './market-research.service';
import type { MarketResearchSession, ProblemAreaSourceType } from './market-research.types';
import { HlmButtonDirective } from '../../ui/button';
import { IndustrySelectComponent } from '../../shared/components/industry-select/industry-select.component';

@Component({
  selector: 'app-market-research-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, IndustrySelectComponent],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucideRotateCw,
      lucideSearch,
      lucideTarget,
      lucideTrendingUp,
      lucideBuilding2,
      lucideCheck,
      lucideUsers,
      lucideAlertTriangle,
      lucideShield,
      lucideZap,
      lucideLightbulb,
      lucideFileText,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Market Research Synthesizer</h1>
          <p class="mt-1 text-muted-foreground">
            Aggregate trends, risks, and signals from industry sources.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Step 1: Problem Area -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 1: Problem Area</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Choose a problem area from existing work or enter one manually
              </p>

              <!-- Problem Area Source Type Tabs -->
              @if (hasProblemAreaSources()) {
                <div class="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="problemAreaSourceType() === 'manual'"
                    [class.text-primary-foreground]="problemAreaSourceType() === 'manual'"
                    [class.bg-muted]="problemAreaSourceType() !== 'manual'"
                    [class.hover:bg-muted/80]="problemAreaSourceType() !== 'manual'"
                    (click)="setProblemAreaSourceType('manual')"
                  >
                    Manual
                  </button>
                  @if (service.ideationSessions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="problemAreaSourceType() === 'ideation'"
                      [class.text-primary-foreground]="problemAreaSourceType() === 'ideation'"
                      [class.bg-muted]="problemAreaSourceType() !== 'ideation'"
                      [class.hover:bg-muted/80]="problemAreaSourceType() !== 'ideation'"
                      (click)="setProblemAreaSourceType('ideation')"
                    >
                      <ng-icon name="lucideLightbulb" class="h-3.5 w-3.5" />
                      Ideation
                    </button>
                  }
                  @if (service.okrSessions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="problemAreaSourceType() === 'okr'"
                      [class.text-primary-foreground]="problemAreaSourceType() === 'okr'"
                      [class.bg-muted]="problemAreaSourceType() !== 'okr'"
                      [class.hover:bg-muted/80]="problemAreaSourceType() !== 'okr'"
                      (click)="setProblemAreaSourceType('okr')"
                    >
                      <ng-icon name="lucideTarget" class="h-3.5 w-3.5" />
                      OKRs
                    </button>
                  }
                  @if (service.scopeDefinitions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="problemAreaSourceType() === 'scope_definition'"
                      [class.text-primary-foreground]="problemAreaSourceType() === 'scope_definition'"
                      [class.bg-muted]="problemAreaSourceType() !== 'scope_definition'"
                      [class.hover:bg-muted/80]="problemAreaSourceType() !== 'scope_definition'"
                      (click)="setProblemAreaSourceType('scope_definition')"
                    >
                      <ng-icon name="lucideFileText" class="h-3.5 w-3.5" />
                      Scope Definition
                    </button>
                  }
                </div>
              }

              <!-- Manual Problem Area Input -->
              @if (problemAreaSourceType() === 'manual') {
                <input
                  type="text"
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Login & Onboarding, Checkout Flow, Mobile App Experience..."
                  [value]="problemArea()"
                  (input)="onProblemAreaInput($event)"
                />
              }

              <!-- Ideation Session Selection -->
              @if (problemAreaSourceType() === 'ideation') {
                <select
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedProblemAreaSourceId()"
                  (change)="onProblemAreaIdeationSelect($event)"
                >
                  <option value="">Select an ideation session...</option>
                  @for (session of service.ideationSessions(); track session.id) {
                    <option [value]="session.id">
                      {{ truncate(session.problemStatement, 60) }}
                    </option>
                  }
                </select>
              }

              <!-- OKR Session Selection -->
              @if (problemAreaSourceType() === 'okr') {
                <select
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedProblemAreaSourceId()"
                  (change)="onProblemAreaOkrSelect($event)"
                >
                  <option value="">Select an OKR session...</option>
                  @for (session of service.okrSessions(); track session.id) {
                    <option [value]="session.id">
                      {{ truncate(session.goalDescription, 60) }}
                    </option>
                  }
                </select>
              }

              <!-- Scope Definition Selection -->
              @if (problemAreaSourceType() === 'scope_definition') {
                <select
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedProblemAreaSourceId()"
                  (change)="onProblemAreaScopeSelect($event)"
                >
                  <option value="">Select a scope definition...</option>
                  @for (session of service.scopeDefinitions(); track session.id) {
                    <option [value]="session.id">
                      {{ session.projectName }}
                    </option>
                  }
                </select>
              }

              <!-- Problem Area Context Preview -->
              @if (problemAreaSourceType() !== 'manual' && problemAreaContext()) {
                <div class="mt-3 rounded-lg border bg-muted/30 p-3">
                  <p class="text-xs text-muted-foreground mb-1">Problem Area Context:</p>
                  <p class="text-sm whitespace-pre-line line-clamp-3">{{ problemAreaContext() }}</p>
                </div>
              }
            </div>

            <!-- Step 2: Industry Context -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideBuilding2" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 2: Industry Context</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Select the industry context for your research
              </p>

              <app-industry-select
                [industries]="service.industries()"
                [value]="industryContext()"
                (valueChange)="industryContext.set($event)"
              />
            </div>

            <!-- Step 3: Focus Areas -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideTrendingUp" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 3: Focus Areas</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Select the aspects you want to analyze
              </p>

              <div class="flex flex-wrap gap-2">
                @for (area of service.focusAreas(); track area.value) {
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    [class.bg-primary]="isFocusAreaSelected(area.value)"
                    [class.text-primary-foreground]="isFocusAreaSelected(area.value)"
                    [class.bg-muted]="!isFocusAreaSelected(area.value)"
                    [class.hover:bg-muted/80]="!isFocusAreaSelected(area.value)"
                    (click)="toggleFocusArea(area.value)"
                  >
                    {{ area.label }}
                  </button>
                }
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
                  Run Market Research Synthesis
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
            <h2 class="font-semibold">Research History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past market research
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
                  Your market research will appear here.
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
                      <p class="mt-1 text-sm font-medium text-foreground truncate">
                        {{ session.problemArea }}
                      </p>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        {{ service.getIndustryLabel(session.industryContext) }}
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
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class MarketResearchInputComponent implements OnInit {
  service = inject(MarketResearchService);
  private router = inject(Router);

  // Problem area source selection
  problemAreaSourceType = signal<ProblemAreaSourceType>('manual');
  selectedProblemAreaSourceId = signal<number | null>(null);
  problemAreaContext = signal('');

  // Problem area (for manual mode)
  problemArea = signal('');

  // Industry selection
  industryContext = signal('');

  // Focus areas
  selectedFocusAreas = signal<string[]>(['user_expectations', 'adoption_trends', 'market_risks']);

  hasProblemAreaSources = computed(() =>
    this.service.ideationSessions().length > 0 ||
    this.service.okrSessions().length > 0 ||
    this.service.scopeDefinitions().length > 0
  );

  canSubmit = computed(() => {
    const sourceType = this.problemAreaSourceType();

    // Check problem area based on source type
    if (sourceType === 'manual') {
      if (this.problemArea().trim().length === 0) return false;
    } else {
      if (this.selectedProblemAreaSourceId() === null || this.problemAreaContext().trim().length === 0) {
        return false;
      }
    }

    return this.industryContext().length > 0 && this.selectedFocusAreas().length > 0;
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.service.loadFocusAreas(),
      this.service.loadIndustries(),
      this.service.loadIdeationSessions(),
      this.service.loadOkrSessions(),
      this.service.loadScopeDefinitions(),
      this.service.loadSessions(true),
    ]);
  }

  onProblemAreaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.problemArea.set(input.value);
  }

  // Problem area source methods
  setProblemAreaSourceType(type: ProblemAreaSourceType): void {
    this.problemAreaSourceType.set(type);
    this.selectedProblemAreaSourceId.set(null);
    this.problemAreaContext.set('');
    if (type !== 'manual') {
      this.problemArea.set('');
    }
  }

  onProblemAreaIdeationSelect(event: Event): void {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedProblemAreaSourceId.set(null);
      this.problemAreaContext.set('');
      return;
    }

    const session = this.service.ideationSessions().find((s) => s.id === id);
    if (session) {
      this.selectedProblemAreaSourceId.set(id);
      this.problemAreaContext.set(`Problem Statement: ${session.problemStatement}`);
    }
  }

  onProblemAreaOkrSelect(event: Event): void {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedProblemAreaSourceId.set(null);
      this.problemAreaContext.set('');
      return;
    }

    const session = this.service.okrSessions().find((s) => s.id === id);
    if (session) {
      this.selectedProblemAreaSourceId.set(id);
      this.problemAreaContext.set(`Goal: ${session.goalDescription}`);
    }
  }

  onProblemAreaScopeSelect(event: Event): void {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedProblemAreaSourceId.set(null);
      this.problemAreaContext.set('');
      return;
    }

    const session = this.service.scopeDefinitions().find((s) => s.id === id);
    if (session) {
      this.selectedProblemAreaSourceId.set(id);
      this.problemAreaContext.set(`Project: ${session.projectName}\n\nVision: ${session.productVision}`);
    }
  }

  truncate(str: string, len: number): string {
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  isFocusAreaSelected(value: string): boolean {
    return this.selectedFocusAreas().includes(value);
  }

  toggleFocusArea(value: string): void {
    this.selectedFocusAreas.update((areas) => {
      if (areas.includes(value)) {
        return areas.filter((a) => a !== value);
      } else {
        return [...areas, value];
      }
    });
  }

  getFocusAreaIcon(value: string): string {
    const icons: Record<string, string> = {
      user_expectations: 'lucideUsers',
      adoption_trends: 'lucideTrendingUp',
      market_risks: 'lucideAlertTriangle',
      regulation: 'lucideShield',
      technology_shifts: 'lucideZap',
    };
    return icons[value] || 'lucideTarget';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const sourceType = this.problemAreaSourceType();
    const session = await this.service.createSession({
      problemArea: sourceType === 'manual' ? this.problemArea() : this.problemAreaContext(),
      problemAreaSourceType: sourceType !== 'manual' ? sourceType : undefined,
      problemAreaSourceId: this.selectedProblemAreaSourceId() || undefined,
      problemAreaContext: this.problemAreaContext() || undefined,
      industryContext: this.industryContext(),
      focusAreas: this.selectedFocusAreas(),
    });

    if (session) {
      this.router.navigate(['/research/market-research/results', session.id]);
    }
  }

  viewSession(session: MarketResearchSession): void {
    this.router.navigate(['/research/market-research/results', session.id]);
  }

  async retrySession(event: Event, session: MarketResearchSession): Promise<void> {
    event.stopPropagation();
    const updated = await this.service.retrySession(session.id);
    if (updated) {
      this.router.navigate(['/research/market-research/results', session.id]);
    }
  }

  async deleteSession(event: Event, session: MarketResearchSession): Promise<void> {
    event.stopPropagation();
    await this.service.deleteSession(session.id);
  }

  loadMoreSessions(): void {
    this.service.loadSessions();
  }

  formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
