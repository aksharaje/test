import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader2,
  lucideRefreshCw,
  lucideCheckCircle2,
  lucideAlertCircle,
  lucideTarget,
  lucideTrendingUp,
  lucideAlertTriangle,
  lucideLightbulb,
  lucideFlag,
} from '@ng-icons/lucide';
import { CompetitiveAnalysisService } from './competitive-analysis.service';
import type { Opportunity } from './competitive-analysis.types';
import { HlmButtonDirective } from '../../ui/button';

type TabId = 'summary' | 'standards' | 'practices' | 'pitfalls' | 'gaps' | 'opportunities';

interface Tab {
  id: TabId;
  label: string;
}

@Component({
  selector: 'app-competitive-analysis-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, UpperCasePipe],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideLoader2,
      lucideRefreshCw,
      lucideCheckCircle2,
      lucideAlertCircle,
      lucideTarget,
      lucideTrendingUp,
      lucideAlertTriangle,
      lucideLightbulb,
      lucideFlag,
    }),
  ],
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="border-b bg-background p-4">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="p-2 rounded-lg hover:bg-muted transition-colors"
              (click)="goBack()"
            >
              <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
            </button>
            <div>
              <h1 class="text-xl font-bold text-foreground">Competitive Analysis Results</h1>
              <p class="text-sm text-muted-foreground">
                {{ getProblemAreaLabel() }}
                @if (session()?.referenceCompetitors?.length) {
                  <span class="text-muted-foreground/70">
                    &bull; {{ session()?.referenceCompetitors?.join(', ') }}
                  </span>
                }
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (session()?.status === 'completed') {
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                <ng-icon name="lucideCheckCircle2" class="h-4 w-4" />
                Completed
              </span>
            } @else if (session()?.status === 'analyzing') {
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
                <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                Analyzing...
              </span>
            } @else if (session()?.status === 'failed') {
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                <ng-icon name="lucideAlertCircle" class="h-4 w-4" />
                Failed
              </span>
              <button
                hlmBtn
                variant="outline"
                size="sm"
                (click)="retryAnalysis()"
              >
                <ng-icon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
                Retry
              </button>
            }
          </div>
        </div>
      </div>

      @if (session()?.status === 'analyzing') {
        <!-- Processing State -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <ng-icon name="lucideLoader2" class="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 class="mt-4 text-lg font-semibold">Analyzing competitive landscape...</h2>
            <p class="mt-2 text-muted-foreground max-w-md">
              We're researching industry standards, best practices, and opportunities for your problem area.
            </p>
          </div>
        </div>
      } @else if (session()?.status === 'failed') {
        <!-- Error State -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <ng-icon name="lucideAlertCircle" class="mx-auto h-12 w-12 text-destructive" />
            <h2 class="mt-4 text-lg font-semibold">Analysis Failed</h2>
            <p class="mt-2 text-muted-foreground max-w-md">
              {{ session()?.errorMessage || 'An error occurred during analysis. Please try again.' }}
            </p>
            <button
              hlmBtn
              class="mt-4"
              (click)="retryAnalysis()"
            >
              <ng-icon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
              Retry Analysis
            </button>
          </div>
        </div>
      } @else if (session()?.status === 'completed') {
        <!-- Tabs -->
        <div class="border-b bg-background">
          <div class="max-w-6xl mx-auto">
            <div class="flex gap-1 p-1">
              @for (tab of tabs; track tab.id) {
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                  [class.bg-primary]="activeTab() === tab.id"
                  [class.text-primary-foreground]="activeTab() === tab.id"
                  [class.text-muted-foreground]="activeTab() !== tab.id"
                  [class.hover:bg-muted]="activeTab() !== tab.id"
                  (click)="setActiveTab(tab.id)"
                >
                  {{ tab.label }}
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="max-w-6xl mx-auto">
            @if (service.loading()) {
              <div class="flex items-center justify-center h-64">
                <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-primary" />
              </div>
            } @else {
              @switch (activeTab()) {
                @case ('summary') {
                  <!-- Executive Summary Tab -->
                  <div class="space-y-6">
                    <!-- Executive Summary Card -->
                    <div class="rounded-lg border bg-card p-6">
                      <h2 class="text-lg font-semibold mb-3">Executive Summary</h2>
                      <p class="text-muted-foreground whitespace-pre-line">{{ session()?.executiveSummary }}</p>
                    </div>

                    <!-- Quick Stats -->
                    <div class="grid grid-cols-4 gap-4">
                      <div class="rounded-lg border bg-card p-4 text-center">
                        <p class="text-3xl font-bold text-primary">{{ session()?.industryStandards?.length || 0 }}</p>
                        <p class="text-sm text-muted-foreground">Industry Standards</p>
                      </div>
                      <div class="rounded-lg border bg-card p-4 text-center">
                        <p class="text-3xl font-bold text-primary">{{ session()?.bestPractices?.length || 0 }}</p>
                        <p class="text-sm text-muted-foreground">Best Practices</p>
                      </div>
                      <div class="rounded-lg border bg-card p-4 text-center">
                        <p class="text-3xl font-bold text-primary">{{ session()?.commonPitfalls?.length || 0 }}</p>
                        <p class="text-sm text-muted-foreground">Common Pitfalls</p>
                      </div>
                      <div class="rounded-lg border bg-card p-4 text-center">
                        <p class="text-3xl font-bold text-primary">{{ session()?.opportunities?.length || 0 }}</p>
                        <p class="text-sm text-muted-foreground">Opportunities</p>
                      </div>
                    </div>

                    <!-- Top Opportunities Preview -->
                    @if (topOpportunities().length > 0) {
                      <div class="rounded-lg border bg-card p-6">
                        <div class="flex items-center justify-between mb-4">
                          <h2 class="text-lg font-semibold">Top Opportunities</h2>
                          <button
                            type="button"
                            class="text-sm text-primary hover:underline"
                            (click)="setActiveTab('opportunities')"
                          >
                            View all
                          </button>
                        </div>
                        <div class="space-y-3">
                          @for (opp of topOpportunities(); track opp.text) {
                            <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                              <ng-icon
                                name="lucideLightbulb"
                                class="h-5 w-5 mt-0.5"
                                [class.text-red-500]="opp.priority === 'high'"
                                [class.text-yellow-500]="opp.priority === 'medium'"
                                [class.text-green-500]="opp.priority === 'low'"
                              />
                              <div class="flex-1">
                                <p class="text-sm">{{ opp.text }}</p>
                                <div class="flex items-center gap-2 mt-1">
                                  <span
                                    class="px-2 py-0.5 rounded-full text-xs"
                                    [class.bg-red-100]="opp.priority === 'high'"
                                    [class.text-red-700]="opp.priority === 'high'"
                                    [class.bg-yellow-100]="opp.priority === 'medium'"
                                    [class.text-yellow-700]="opp.priority === 'medium'"
                                    [class.bg-green-100]="opp.priority === 'low'"
                                    [class.text-green-700]="opp.priority === 'low'"
                                  >
                                    {{ opp.priority | uppercase }} Priority
                                  </span>
                                  @if (opp.tag) {
                                    <span class="px-2 py-0.5 rounded-full bg-muted text-xs">
                                      {{ opp.tag }}
                                    </span>
                                  }
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }

                @case ('standards') {
                  <!-- Industry Standards Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideTarget" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Industry Standards</h2>
                        <p class="text-sm text-muted-foreground">
                          Established norms and expectations in this problem area
                        </p>
                      </div>
                    </div>

                    @if (session()?.industryStandards?.length) {
                      <div class="grid gap-3">
                        @for (standard of session()?.industryStandards; track standard; let i = $index) {
                          <div class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                {{ i + 1 }}
                              </span>
                              <p class="flex-1 text-sm">{{ standard }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        No industry standards identified
                      </div>
                    }
                  </div>
                }

                @case ('practices') {
                  <!-- Best Practices Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideTrendingUp" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Best Practices</h2>
                        <p class="text-sm text-muted-foreground">
                          Proven approaches that lead to success
                        </p>
                      </div>
                    </div>

                    @if (session()?.bestPractices?.length) {
                      <div class="grid gap-3">
                        @for (practice of session()?.bestPractices; track practice; let i = $index) {
                          <div class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                <ng-icon name="lucideCheckCircle2" class="h-4 w-4" />
                              </span>
                              <p class="flex-1 text-sm">{{ practice }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        No best practices identified
                      </div>
                    }
                  </div>
                }

                @case ('pitfalls') {
                  <!-- Common Pitfalls Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideAlertTriangle" class="h-6 w-6 text-yellow-500" />
                      <div>
                        <h2 class="text-lg font-semibold">Common Pitfalls</h2>
                        <p class="text-sm text-muted-foreground">
                          Mistakes to avoid based on industry experience
                        </p>
                      </div>
                    </div>

                    @if (session()?.commonPitfalls?.length) {
                      <div class="grid gap-3">
                        @for (pitfall of session()?.commonPitfalls; track pitfall; let i = $index) {
                          <div class="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                                !
                              </span>
                              <p class="flex-1 text-sm">{{ pitfall }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        No common pitfalls identified
                      </div>
                    }
                  </div>
                }

                @case ('gaps') {
                  <!-- Product Gaps Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideFlag" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Product Gaps</h2>
                        <p class="text-sm text-muted-foreground">
                          Areas where existing solutions fall short
                        </p>
                      </div>
                    </div>

                    @if (session()?.productGaps?.length) {
                      <div class="grid gap-3">
                        @for (gap of session()?.productGaps; track gap; let i = $index) {
                          <div class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                                {{ i + 1 }}
                              </span>
                              <p class="flex-1 text-sm">{{ gap }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        No product gaps identified
                      </div>
                    }
                  </div>
                }

                @case ('opportunities') {
                  <!-- Opportunities Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideLightbulb" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Opportunities</h2>
                        <p class="text-sm text-muted-foreground">
                          Actionable opportunities to differentiate and improve
                        </p>
                      </div>
                    </div>

                    @if (session()?.opportunities?.length) {
                      <!-- Priority Filter -->
                      <div class="flex gap-2 mb-4">
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-primary]="priorityFilter() === 'all'"
                          [class.text-primary-foreground]="priorityFilter() === 'all'"
                          [class.bg-muted]="priorityFilter() !== 'all'"
                          (click)="setPriorityFilter('all')"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-red-100]="priorityFilter() === 'high'"
                          [class.text-red-700]="priorityFilter() === 'high'"
                          [class.bg-muted]="priorityFilter() !== 'high'"
                          (click)="setPriorityFilter('high')"
                        >
                          High Priority
                        </button>
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-yellow-100]="priorityFilter() === 'medium'"
                          [class.text-yellow-700]="priorityFilter() === 'medium'"
                          [class.bg-muted]="priorityFilter() !== 'medium'"
                          (click)="setPriorityFilter('medium')"
                        >
                          Medium Priority
                        </button>
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-green-100]="priorityFilter() === 'low'"
                          [class.text-green-700]="priorityFilter() === 'low'"
                          [class.bg-muted]="priorityFilter() !== 'low'"
                          (click)="setPriorityFilter('low')"
                        >
                          Low Priority
                        </button>
                      </div>

                      <div class="grid gap-3">
                        @for (opp of filteredOpportunities(); track opp.text) {
                          <div
                            class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
                            [class.border-l-4]="true"
                            [class.border-l-red-500]="opp.priority === 'high'"
                            [class.border-l-yellow-500]="opp.priority === 'medium'"
                            [class.border-l-green-500]="opp.priority === 'low'"
                          >
                            <div class="flex items-start gap-3">
                              <ng-icon
                                name="lucideLightbulb"
                                class="h-5 w-5 mt-0.5 flex-shrink-0"
                                [class.text-red-500]="opp.priority === 'high'"
                                [class.text-yellow-500]="opp.priority === 'medium'"
                                [class.text-green-500]="opp.priority === 'low'"
                              />
                              <div class="flex-1">
                                <p class="text-sm">{{ opp.text }}</p>
                                <div class="flex items-center gap-2 mt-2">
                                  <span
                                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                                    [class.bg-red-100]="opp.priority === 'high'"
                                    [class.text-red-700]="opp.priority === 'high'"
                                    [class.bg-yellow-100]="opp.priority === 'medium'"
                                    [class.text-yellow-700]="opp.priority === 'medium'"
                                    [class.bg-green-100]="opp.priority === 'low'"
                                    [class.text-green-700]="opp.priority === 'low'"
                                  >
                                    {{ opp.priority | uppercase }}
                                  </span>
                                  @if (opp.tag) {
                                    <span class="px-2 py-0.5 rounded-full bg-muted text-xs">
                                      {{ opp.tag }}
                                    </span>
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                      </div>

                      @if (filteredOpportunities().length === 0) {
                        <div class="text-center py-12 text-muted-foreground">
                          No opportunities match this filter
                        </div>
                      }
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        No opportunities identified
                      </div>
                    }
                  </div>
                }
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class CompetitiveAnalysisResultsComponent implements OnInit, OnDestroy {
  service = inject(CompetitiveAnalysisService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  tabs: Tab[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'standards', label: 'Industry Standards' },
    { id: 'practices', label: 'Best Practices' },
    { id: 'pitfalls', label: 'Pitfalls' },
    { id: 'gaps', label: 'Product Gaps' },
    { id: 'opportunities', label: 'Opportunities' },
  ];

  activeTab = signal<TabId>('summary');
  priorityFilter = signal<'all' | 'high' | 'medium' | 'low'>('all');

  session = this.service.currentSession;

  topOpportunities(): Opportunity[] {
    const opps = this.session()?.opportunities || [];
    // Sort by priority (high first) and take top 3
    const sorted = [...opps].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
    return sorted.slice(0, 3);
  }

  filteredOpportunities(): Opportunity[] {
    const opps = this.session()?.opportunities || [];
    if (this.priorityFilter() === 'all') {
      return opps;
    }
    return opps.filter(o => o.priority === this.priorityFilter());
  }

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (sessionId) {
      await this.service.getSession(sessionId);
      this.startPollingIfNeeded();
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private startPollingIfNeeded() {
    const session = this.session();
    if (session?.status === 'pending' || session?.status === 'analyzing') {
      this.pollingInterval = setInterval(async () => {
        const sessionId = this.session()?.id;
        if (sessionId) {
          const status = await this.service.getSessionStatus(sessionId);
          if (status?.status === 'completed' || status?.status === 'failed') {
            this.stopPolling();
            await this.service.getSession(sessionId);
          }
        }
      }, 3000);
    }
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  setActiveTab(tabId: TabId) {
    this.activeTab.set(tabId);
  }

  setPriorityFilter(filter: 'all' | 'high' | 'medium' | 'low') {
    this.priorityFilter.set(filter);
  }

  goBack() {
    this.router.navigate(['/research/competitive-analysis']);
  }

  async retryAnalysis() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      await this.service.retrySession(sessionId);
      this.startPollingIfNeeded();
    }
  }

  getProblemAreaLabel(): string {
    const session = this.session();
    if (!session) return '';
    if (session.problemArea === 'other' && session.customProblemArea) {
      return session.customProblemArea;
    }
    return this.service.getProblemAreaLabel(session.problemArea);
  }
}
