import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
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
} from '@ng-icons/lucide';
import { MarketResearchService } from './market-research.service';
import type { MarketResearchSession } from './market-research.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-market-research-input',
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
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 1: Problem Area</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Describe the problem area you want to research
              </p>
              <input
                type="text"
                class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Login & Onboarding, Checkout Flow, Mobile App Experience..."
                [value]="problemArea()"
                (input)="onProblemAreaInput($event)"
              />
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

              <!-- Industry Dropdown -->
              <div class="relative">
                <button
                  type="button"
                  class="w-full flex items-center justify-between rounded-lg border bg-background p-3 text-sm text-left"
                  [class.text-muted-foreground]="!industryContext()"
                  (click)="toggleIndustryDropdown()"
                >
                  <span>{{ selectedIndustryLabel() || 'Select an industry...' }}</span>
                  <ng-icon [name]="industryDropdownOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                </button>

                @if (industryDropdownOpen()) {
                  <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg">
                    <div class="p-2 border-b">
                      <div class="relative">
                        <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          class="w-full rounded border bg-muted/30 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Type to filter..."
                          [value]="industryFilter()"
                          (input)="onIndustryFilterInput($event)"
                        />
                      </div>
                    </div>
                    <div class="max-h-64 overflow-y-auto p-1">
                      @for (industry of filteredIndustries(); track industry.value) {
                        <button
                          type="button"
                          class="w-full flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50 text-left"
                          [class.bg-primary/10]="industryContext() === industry.value"
                          (click)="selectIndustry(industry.value)"
                        >
                          @if (industryContext() === industry.value) {
                            <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
                          } @else {
                            <div class="h-4 w-4"></div>
                          }
                          <span>{{ industry.label }}</span>
                        </button>
                      }
                      @if (filteredIndustries().length === 0) {
                        <p class="p-2 text-sm text-muted-foreground text-center">No matching industries</p>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Step 3: Focus Areas -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideTrendingUp" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 3: Focus Areas</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Select the aspects you want to analyze
              </p>

              <div class="space-y-2">
                @for (area of service.focusAreas(); track area.value) {
                  <label
                    class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    [class.bg-primary/5]="isFocusAreaSelected(area.value)"
                    [class.border-primary/50]="isFocusAreaSelected(area.value)"
                  >
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      [checked]="isFocusAreaSelected(area.value)"
                      (change)="toggleFocusArea(area.value)"
                    />
                    <div class="flex items-center gap-2 flex-1">
                      <ng-icon [name]="getFocusAreaIcon(area.value)" class="h-4 w-4 text-muted-foreground" />
                      <span class="text-sm font-medium">{{ area.label }}</span>
                    </div>
                  </label>
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
  `,
})
export class MarketResearchInputComponent implements OnInit {
  service = inject(MarketResearchService);
  private router = inject(Router);

  // Problem area
  problemArea = signal('');

  // Industry selection
  industryContext = signal('');
  industryDropdownOpen = signal(false);
  industryFilter = signal('');

  // Focus areas
  selectedFocusAreas = signal<string[]>(['user_expectations', 'adoption_trends', 'market_risks']);

  selectedIndustryLabel = computed(() => {
    const value = this.industryContext();
    if (!value) return '';
    const industry = this.service.industries().find((i) => i.value === value);
    return industry?.label || value;
  });

  filteredIndustries = computed(() => {
    const filter = this.industryFilter().toLowerCase();
    const industries = this.service.industries();
    if (!filter) return industries;
    return industries.filter((i) => i.label.toLowerCase().includes(filter));
  });

  canSubmit = computed(() => {
    return (
      this.problemArea().trim().length > 0 &&
      this.industryContext().length > 0 &&
      this.selectedFocusAreas().length > 0
    );
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.industryDropdownOpen.set(false);
    }
  }

  ngOnInit(): void {
    this.service.loadFocusAreas();
    this.service.loadIndustries();
    this.service.loadSessions(true);
  }

  onProblemAreaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.problemArea.set(input.value);
  }

  toggleIndustryDropdown(): void {
    this.industryDropdownOpen.update((v) => !v);
    if (this.industryDropdownOpen()) {
      this.industryFilter.set('');
    }
  }

  onIndustryFilterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.industryFilter.set(input.value);
  }

  selectIndustry(value: string): void {
    this.industryContext.set(value);
    this.industryDropdownOpen.set(false);
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

    const session = await this.service.createSession({
      problemArea: this.problemArea(),
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
