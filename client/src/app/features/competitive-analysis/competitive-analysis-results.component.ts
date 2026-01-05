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
  lucideCode,
  lucideInfo,
  lucideFileText,
} from '@ng-icons/lucide';
import { CompetitiveAnalysisService } from './competitive-analysis.service';
import type { Opportunity } from './competitive-analysis.types';
import { HlmButtonDirective } from '../../ui/button';

type TabId = 'summary' | 'standards' | 'practices' | 'pitfalls' | 'gaps' | 'opportunities' | 'code';

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
      lucideCode,
      lucideInfo,
      lucideFileText,
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
                {{ getFocusAreaLabel() }}
                @if (session()?.referenceCompetitors?.length) {
                  <span class="text-muted-foreground/70">
                    &bull; vs. {{ session()?.referenceCompetitors?.join(', ') }}
                  </span>
                }
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (session()?.status === 'completed') {
              <button
                hlmBtn
                variant="outline"
                size="sm"
                (click)="exportToPdf()"
              >
                <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
                Export PDF
              </button>
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
              We're researching industry standards, best practices, and opportunities for your focus area.
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
            <div class="flex gap-1 p-1 overflow-x-auto">
              @for (tab of visibleTabs(); track tab.id) {
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
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

                    <!-- Findings -->
                    <div class="rounded-lg border bg-card p-6">
                      <div class="flex items-center gap-2 mb-4">
                        <h2 class="text-lg font-semibold">Findings</h2>
                        <div class="relative group">
                          <ng-icon name="lucideInfo" class="h-4 w-4 text-muted-foreground cursor-help" />
                          <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            These counts show how many insights were identified in each category during the competitive analysis.
                          </div>
                        </div>
                      </div>
                      <div class="flex gap-3">
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group">
                          <p class="text-2xl font-bold text-primary">{{ session()?.industryStandards?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Standards</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Features or experiences that 70%+ of competitors offer. These are baseline expectations users have.
                          </div>
                        </div>
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group">
                          <p class="text-2xl font-bold text-primary">{{ session()?.bestPractices?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Best Practices</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Approaches used by top performers that delight users and drive better outcomes.
                          </div>
                        </div>
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group">
                          <p class="text-2xl font-bold text-primary">{{ session()?.commonPitfalls?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Pitfalls</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Mistakes that frustrate users or hurt business metrics. Avoid these in your implementation.
                          </div>
                        </div>
                        @if (hasProductContext()) {
                          <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group">
                            <p class="text-2xl font-bold text-primary">{{ session()?.productGaps?.length || 0 }}</p>
                            <p class="text-xs text-muted-foreground">Gaps</p>
                            <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                              Areas where your product may be missing features or experiences that competitors offer.
                            </div>
                          </div>
                        }
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group">
                          <p class="text-2xl font-bold text-primary">{{ session()?.opportunities?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Opportunities</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Actionable improvements that could differentiate your product or improve user experience.
                          </div>
                        </div>
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
                          Established norms and expectations in this focus area
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

                @case ('code') {
                  <!-- Code Comparison Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideCode" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Your Implementation vs. Competitors</h2>
                        <p class="text-sm text-muted-foreground">
                          Analysis of how your code compares to industry best practices
                        </p>
                      </div>
                    </div>

                    @if (session()?.codeComparison) {
                      <div class="rounded-lg border bg-card p-6">
                        <p class="text-sm whitespace-pre-line">{{ session()?.codeComparison }}</p>
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        <ng-icon name="lucideCode" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p class="mt-4">No code comparison available</p>
                        <p class="text-sm mt-1">Connect a code repository when creating the analysis to enable this feature</p>
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
    { id: 'code', label: 'Code Comparison' },
  ];

  activeTab = signal<TabId>('summary');
  priorityFilter = signal<'all' | 'high' | 'medium' | 'low'>('all');

  session = this.service.currentSession;

  visibleTabs(): Tab[] {
    const session = this.session();
    return this.tabs.filter(t => {
      // Only show code tab if there's a code comparison
      if (t.id === 'code' && !session?.codeComparison) {
        return false;
      }
      // Only show product gaps tab if product context was provided
      if (t.id === 'gaps' && !session?.inputSourceDescription && !session?.knowledgeBaseId) {
        return false;
      }
      return true;
    });
  }

  hasProductContext(): boolean {
    const session = this.session();
    return !!(session?.inputSourceDescription || session?.knowledgeBaseId);
  }

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
      await this.service.loadFocusAreas();
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

  getFocusAreaLabel(): string {
    const session = this.session();
    if (!session) return '';
    if (session.focusArea === 'other' && session.customFocusArea) {
      return session.customFocusArea;
    }
    return this.service.getFocusAreaLabel(session.focusArea);
  }

  exportToPdf(): void {
    const session = this.session();
    if (!session) return;

    const focusAreaLabel = this.getFocusAreaLabel();
    const competitors = session.referenceCompetitors?.join(', ') || 'N/A';
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Helper to escape HTML
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Helper to get priority color
    const getPriorityColor = (priority: string): string => {
      switch (priority) {
        case 'high':
          return '#dc2626';
        case 'medium':
          return '#ca8a04';
        case 'low':
          return '#16a34a';
        default:
          return '#6b7280';
      }
    };

    // Build HTML sections
    let industryStandardsHtml = '';
    if (session.industryStandards?.length) {
      industryStandardsHtml = session.industryStandards
        .map(
          (standard, i) => `
          <div class="list-item">
            <span class="item-number">${i + 1}</span>
            <span class="item-text">${escapeHtml(standard)}</span>
          </div>
        `
        )
        .join('');
    } else {
      industryStandardsHtml = '<p class="empty-state">No industry standards identified</p>';
    }

    let bestPracticesHtml = '';
    if (session.bestPractices?.length) {
      bestPracticesHtml = session.bestPractices
        .map(
          practice => `
          <div class="list-item practice-item">
            <span class="checkmark">&#10003;</span>
            <span class="item-text">${escapeHtml(practice)}</span>
          </div>
        `
        )
        .join('');
    } else {
      bestPracticesHtml = '<p class="empty-state">No best practices identified</p>';
    }

    let pitfallsHtml = '';
    if (session.commonPitfalls?.length) {
      pitfallsHtml = session.commonPitfalls
        .map(
          pitfall => `
          <div class="list-item pitfall-item">
            <span class="warning-icon">!</span>
            <span class="item-text">${escapeHtml(pitfall)}</span>
          </div>
        `
        )
        .join('');
    } else {
      pitfallsHtml = '<p class="empty-state">No common pitfalls identified</p>';
    }

    let gapsHtml = '';
    if (this.hasProductContext() && session.productGaps?.length) {
      gapsHtml = session.productGaps
        .map(
          (gap, i) => `
          <div class="list-item gap-item">
            <span class="item-number gap-number">${i + 1}</span>
            <span class="item-text">${escapeHtml(gap)}</span>
          </div>
        `
        )
        .join('');
    } else if (this.hasProductContext()) {
      gapsHtml = '<p class="empty-state">No product gaps identified</p>';
    }

    let opportunitiesHtml = '';
    if (session.opportunities?.length) {
      opportunitiesHtml = session.opportunities
        .map(
          opp => `
          <div class="opportunity-item" style="border-left: 4px solid ${getPriorityColor(opp.priority)};">
            <div class="opportunity-content">
              <p class="opportunity-text">${escapeHtml(opp.text)}</p>
              <div class="opportunity-meta">
                <span class="priority-badge" style="background-color: ${getPriorityColor(opp.priority)}20; color: ${getPriorityColor(opp.priority)};">
                  ${opp.priority.toUpperCase()} PRIORITY
                </span>
                ${opp.tag ? `<span class="tag-badge">${escapeHtml(opp.tag)}</span>` : ''}
              </div>
            </div>
          </div>
        `
        )
        .join('');
    } else {
      opportunitiesHtml = '<p class="empty-state">No opportunities identified</p>';
    }

    let codeComparisonHtml = '';
    if (session.codeComparison) {
      codeComparisonHtml = `<pre class="code-block">${escapeHtml(session.codeComparison)}</pre>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Competitive Analysis - ${escapeHtml(focusAreaLabel)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: #ffffff;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
          }

          .header {
            border-bottom: 3px solid #006450;
            padding-bottom: 24px;
            margin-bottom: 32px;
          }

          .header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #006450;
            margin-bottom: 8px;
          }

          .header-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
            font-size: 14px;
            color: #6b7280;
          }

          .header-meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .header-meta-label {
            font-weight: 600;
            color: #374151;
          }

          .section {
            margin-bottom: 36px;
            page-break-inside: avoid;
          }

          .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
          }

          .section-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
          }

          .section-icon.primary {
            background-color: #006450;
            color: white;
          }

          .section-icon.green {
            background-color: #dcfce7;
            color: #16a34a;
          }

          .section-icon.yellow {
            background-color: #fef9c3;
            color: #ca8a04;
          }

          .section-icon.orange {
            background-color: #fed7aa;
            color: #ea580c;
          }

          .section-icon.blue {
            background-color: #dbeafe;
            color: #2563eb;
          }

          .section h2 {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }

          .section-description {
            font-size: 13px;
            color: #6b7280;
            margin-top: 2px;
          }

          .summary-box {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
          }

          .summary-box p {
            white-space: pre-line;
            color: #4b5563;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-top: 16px;
          }

          .stat-card {
            background-color: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }

          .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #006450;
          }

          .stat-label {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
          }

          .list-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 16px;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 8px;
          }

          .item-number {
            min-width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #006450;
            color: white;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .gap-number {
            background-color: #ea580c;
          }

          .checkmark {
            min-width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #dcfce7;
            color: #16a34a;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .warning-icon {
            min-width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #fef9c3;
            color: #ca8a04;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .pitfall-item {
            background-color: #fffbeb;
            border-color: #fde68a;
          }

          .item-text {
            font-size: 14px;
            color: #374151;
          }

          .opportunity-item {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
          }

          .opportunity-text {
            font-size: 14px;
            color: #374151;
            margin-bottom: 12px;
          }

          .opportunity-meta {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .priority-badge {
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          }

          .tag-badge {
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            background-color: #e5e7eb;
            color: #4b5563;
          }

          .code-block {
            background-color: #1f2937;
            color: #e5e7eb;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
            font-size: 13px;
            white-space: pre-wrap;
            overflow-x: auto;
          }

          .empty-state {
            color: #9ca3af;
            font-style: italic;
            padding: 20px;
            text-align: center;
          }

          .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
          }

          .footer strong {
            color: #006450;
          }

          @media print {
            body {
              padding: 20px;
            }

            .section {
              page-break-inside: avoid;
            }

            .header {
              page-break-after: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Competitive Analysis Report</h1>
          <div class="header-meta">
            <div class="header-meta-item">
              <span class="header-meta-label">Focus Area:</span>
              <span>${escapeHtml(focusAreaLabel)}</span>
            </div>
            ${
              session.referenceCompetitors?.length
                ? `
              <div class="header-meta-item">
                <span class="header-meta-label">Competitors:</span>
                <span>${escapeHtml(competitors)}</span>
              </div>
            `
                : ''
            }
            <div class="header-meta-item">
              <span class="header-meta-label">Generated:</span>
              <span>${generatedDate}</span>
            </div>
          </div>
        </div>

        <!-- Executive Summary -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon primary">S</div>
            <div>
              <h2>Executive Summary</h2>
            </div>
          </div>
          <div class="summary-box">
            <p>${escapeHtml(session.executiveSummary || 'No executive summary available.')}</p>
          </div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${session.industryStandards?.length || 0}</div>
              <div class="stat-label">Standards</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${session.bestPractices?.length || 0}</div>
              <div class="stat-label">Best Practices</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${session.commonPitfalls?.length || 0}</div>
              <div class="stat-label">Pitfalls</div>
            </div>
            ${
              this.hasProductContext()
                ? `
              <div class="stat-card">
                <div class="stat-value">${session.productGaps?.length || 0}</div>
                <div class="stat-label">Gaps</div>
              </div>
            `
                : ''
            }
            <div class="stat-card">
              <div class="stat-value">${session.opportunities?.length || 0}</div>
              <div class="stat-label">Opportunities</div>
            </div>
          </div>
        </div>

        <!-- Industry Standards -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon primary">&#9673;</div>
            <div>
              <h2>Industry Standards</h2>
              <p class="section-description">Established norms and expectations in this focus area</p>
            </div>
          </div>
          ${industryStandardsHtml}
        </div>

        <!-- Best Practices -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon green">&#8593;</div>
            <div>
              <h2>Best Practices</h2>
              <p class="section-description">Proven approaches that lead to success</p>
            </div>
          </div>
          ${bestPracticesHtml}
        </div>

        <!-- Common Pitfalls -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon yellow">&#9888;</div>
            <div>
              <h2>Common Pitfalls</h2>
              <p class="section-description">Mistakes to avoid based on industry experience</p>
            </div>
          </div>
          ${pitfallsHtml}
        </div>

        ${
          this.hasProductContext()
            ? `
          <!-- Product Gaps -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon orange">&#9873;</div>
              <div>
                <h2>Product Gaps</h2>
                <p class="section-description">Areas where existing solutions fall short</p>
              </div>
            </div>
            ${gapsHtml}
          </div>
        `
            : ''
        }

        <!-- Opportunities -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon primary">&#128161;</div>
            <div>
              <h2>Opportunities</h2>
              <p class="section-description">Actionable opportunities to differentiate and improve</p>
            </div>
          </div>
          ${opportunitiesHtml}
        </div>

        ${
          session.codeComparison
            ? `
          <!-- Code Comparison -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon blue">&lt;/&gt;</div>
              <div>
                <h2>Code Comparison</h2>
                <p class="section-description">Analysis of how your code compares to industry best practices</p>
              </div>
            </div>
            ${codeComparisonHtml}
          </div>
        `
            : ''
        }

        <div class="footer">
          <p>Generated by <strong>Product Studio</strong></p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      // Delay print to ensure styles are loaded
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}
