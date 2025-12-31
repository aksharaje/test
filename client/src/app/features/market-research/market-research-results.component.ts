import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader2,
  lucideRefreshCw,
  lucideCheckCircle2,
  lucideAlertCircle,
  lucideTrendingUp,
  lucideAlertTriangle,
  lucideUsers,
  lucideLightbulb,
  lucideInfo,
  lucideExternalLink,
  lucideShield,
} from '@ng-icons/lucide';
import { MarketResearchService } from './market-research.service';
import type { MarketInsight } from './market-research.types';
import { HlmButtonDirective } from '../../ui/button';

type TabId = 'summary' | 'trends' | 'expectations' | 'risks' | 'implications';

interface Tab {
  id: TabId;
  label: string;
}

@Component({
  selector: 'app-market-research-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideLoader2,
      lucideRefreshCw,
      lucideCheckCircle2,
      lucideAlertCircle,
      lucideTrendingUp,
      lucideAlertTriangle,
      lucideUsers,
      lucideLightbulb,
      lucideInfo,
      lucideExternalLink,
      lucideShield,
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
              <h1 class="text-xl font-bold text-foreground">Market Research Results</h1>
              <p class="text-sm text-muted-foreground">
                {{ session()?.problemArea }}
                @if (session()?.industryContext) {
                  <span class="text-muted-foreground/70">
                    &bull; {{ getIndustryLabel() }}
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

      @if (session()?.status === 'analyzing' || session()?.status === 'pending') {
        <!-- Processing State -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <ng-icon name="lucideLoader2" class="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 class="mt-4 text-lg font-semibold">Analyzing market landscape...</h2>
            <p class="mt-2 text-muted-foreground max-w-md">
              We're researching market trends, user expectations, and risks for your focus area.
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
              @for (tab of tabs; track tab.id) {
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

                    <!-- Focus Areas -->
                    @if (session()?.focusAreas?.length) {
                      <div class="rounded-lg border bg-card p-6">
                        <h2 class="text-lg font-semibold mb-3">Focus Areas Analyzed</h2>
                        <div class="flex flex-wrap gap-2">
                          @for (area of session()?.focusAreas; track area) {
                            <span class="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                              {{ getFocusAreaLabel(area) }}
                            </span>
                          }
                        </div>
                      </div>
                    }

                    <!-- Findings Overview -->
                    <div class="rounded-lg border bg-card p-6">
                      <div class="flex items-center gap-2 mb-4">
                        <h2 class="text-lg font-semibold">Findings Overview</h2>
                        <div class="relative group">
                          <ng-icon name="lucideInfo" class="h-4 w-4 text-muted-foreground cursor-help" />
                          <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            These counts show how many insights were identified in each category during the market research.
                          </div>
                        </div>
                      </div>
                      <div class="flex gap-3">
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group cursor-pointer hover:bg-muted transition-colors" (click)="setActiveTab('trends')">
                          <p class="text-2xl font-bold text-primary">{{ session()?.marketTrends?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Market Trends</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Current and emerging trends shaping the market landscape.
                          </div>
                        </div>
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group cursor-pointer hover:bg-muted transition-colors" (click)="setActiveTab('expectations')">
                          <p class="text-2xl font-bold text-primary">{{ session()?.expectationShifts?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Expectation Shifts</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Changes in what users expect from products in this space.
                          </div>
                        </div>
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group cursor-pointer hover:bg-muted transition-colors" (click)="setActiveTab('risks')">
                          <p class="text-2xl font-bold text-primary">{{ session()?.marketRisks?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Market Risks</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Potential threats and challenges in the market.
                          </div>
                        </div>
                        <div class="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center relative group cursor-pointer hover:bg-muted transition-colors" (click)="setActiveTab('implications')">
                          <p class="text-2xl font-bold text-primary">{{ session()?.implications?.length || 0 }}</p>
                          <p class="text-xs text-muted-foreground">Implications</p>
                          <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block w-48 p-2 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                            Strategic implications for your product or business.
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Key Insights Preview -->
                    @if (topInsights().length > 0) {
                      <div class="rounded-lg border bg-card p-6">
                        <div class="flex items-center justify-between mb-4">
                          <h2 class="text-lg font-semibold">Key Insights</h2>
                        </div>
                        <div class="space-y-3">
                          @for (insight of topInsights(); track insight.text) {
                            <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                              <ng-icon
                                name="lucideLightbulb"
                                class="h-5 w-5 mt-0.5"
                                [class.text-green-500]="insight.confidence === 'HIGH'"
                                [class.text-yellow-500]="insight.confidence === 'MEDIUM'"
                                [class.text-gray-400]="insight.confidence === 'LOW'"
                              />
                              <div class="flex-1">
                                <p class="text-sm">{{ insight.text }}</p>
                                <div class="flex items-center gap-2 mt-1">
                                  <span
                                    class="px-2 py-0.5 rounded-full text-xs"
                                    [class.bg-green-100]="insight.confidence === 'HIGH'"
                                    [class.text-green-700]="insight.confidence === 'HIGH'"
                                    [class.bg-yellow-100]="insight.confidence === 'MEDIUM'"
                                    [class.text-yellow-700]="insight.confidence === 'MEDIUM'"
                                    [class.bg-gray-100]="insight.confidence === 'LOW'"
                                    [class.text-gray-700]="insight.confidence === 'LOW'"
                                  >
                                    {{ insight.confidence }} Confidence
                                  </span>
                                  @if (insight.sourceCount > 0) {
                                    <span class="text-xs text-muted-foreground">
                                      {{ insight.sourceCount }} source{{ insight.sourceCount > 1 ? 's' : '' }}
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

                @case ('trends') {
                  <!-- Market Trends Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideTrendingUp" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Market Trends</h2>
                        <p class="text-sm text-muted-foreground">
                          Current and emerging trends shaping the market
                        </p>
                      </div>
                    </div>

                    <!-- Confidence Filter -->
                    <div class="flex gap-2 mb-4">
                      @for (filter of confidenceFilters; track filter.value) {
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-primary]="confidenceFilter() === filter.value"
                          [class.text-primary-foreground]="confidenceFilter() === filter.value"
                          [class.bg-muted]="confidenceFilter() !== filter.value"
                          (click)="setConfidenceFilter(filter.value)"
                        >
                          {{ filter.label }}
                        </button>
                      }
                    </div>

                    @if (filteredTrends().length > 0) {
                      <div class="grid gap-3">
                        @for (trend of filteredTrends(); track trend.text; let i = $index) {
                          <div class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">
                                {{ i + 1 }}
                              </span>
                              <div class="flex-1">
                                <p class="text-sm">{{ trend.text }}</p>
                                <div class="flex items-center gap-2 mt-2">
                                  <span
                                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                                    [class.bg-green-100]="trend.confidence === 'HIGH'"
                                    [class.text-green-700]="trend.confidence === 'HIGH'"
                                    [class.bg-yellow-100]="trend.confidence === 'MEDIUM'"
                                    [class.text-yellow-700]="trend.confidence === 'MEDIUM'"
                                    [class.bg-gray-100]="trend.confidence === 'LOW'"
                                    [class.text-gray-700]="trend.confidence === 'LOW'"
                                  >
                                    {{ trend.confidence }}
                                  </span>
                                  @if (trend.sourceCount > 0) {
                                    <span class="text-xs text-muted-foreground">
                                      {{ trend.sourceCount }} source{{ trend.sourceCount > 1 ? 's' : '' }}
                                    </span>
                                  }
                                </div>
                                @if (trend.sources?.length) {
                                  <div class="mt-2 flex flex-wrap gap-1">
                                    @for (source of trend.sources; track source) {
                                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                                        <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                                        {{ source }}
                                      </span>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        @if (confidenceFilter() === 'all') {
                          No market trends identified
                        } @else {
                          No trends match this filter
                        }
                      </div>
                    }
                  </div>
                }

                @case ('expectations') {
                  <!-- User Expectation Shifts Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideUsers" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">User Expectation Shifts</h2>
                        <p class="text-sm text-muted-foreground">
                          How user expectations are evolving in this space
                        </p>
                      </div>
                    </div>

                    <!-- Confidence Filter -->
                    <div class="flex gap-2 mb-4">
                      @for (filter of confidenceFilters; track filter.value) {
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-primary]="confidenceFilter() === filter.value"
                          [class.text-primary-foreground]="confidenceFilter() === filter.value"
                          [class.bg-muted]="confidenceFilter() !== filter.value"
                          (click)="setConfidenceFilter(filter.value)"
                        >
                          {{ filter.label }}
                        </button>
                      }
                    </div>

                    @if (filteredExpectations().length > 0) {
                      <div class="grid gap-3">
                        @for (shift of filteredExpectations(); track shift.text; let i = $index) {
                          <div class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex-shrink-0">
                                <ng-icon name="lucideUsers" class="h-4 w-4" />
                              </span>
                              <div class="flex-1">
                                <p class="text-sm">{{ shift.text }}</p>
                                <div class="flex items-center gap-2 mt-2">
                                  <span
                                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                                    [class.bg-green-100]="shift.confidence === 'HIGH'"
                                    [class.text-green-700]="shift.confidence === 'HIGH'"
                                    [class.bg-yellow-100]="shift.confidence === 'MEDIUM'"
                                    [class.text-yellow-700]="shift.confidence === 'MEDIUM'"
                                    [class.bg-gray-100]="shift.confidence === 'LOW'"
                                    [class.text-gray-700]="shift.confidence === 'LOW'"
                                  >
                                    {{ shift.confidence }}
                                  </span>
                                  @if (shift.sourceCount > 0) {
                                    <span class="text-xs text-muted-foreground">
                                      {{ shift.sourceCount }} source{{ shift.sourceCount > 1 ? 's' : '' }}
                                    </span>
                                  }
                                </div>
                                @if (shift.sources?.length) {
                                  <div class="mt-2 flex flex-wrap gap-1">
                                    @for (source of shift.sources; track source) {
                                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                                        <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                                        {{ source }}
                                      </span>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        @if (confidenceFilter() === 'all') {
                          No expectation shifts identified
                        } @else {
                          No shifts match this filter
                        }
                      </div>
                    }
                  </div>
                }

                @case ('risks') {
                  <!-- Market Risks Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideAlertTriangle" class="h-6 w-6 text-yellow-500" />
                      <div>
                        <h2 class="text-lg font-semibold">Market Risks</h2>
                        <p class="text-sm text-muted-foreground">
                          Potential threats and challenges to consider
                        </p>
                      </div>
                    </div>

                    <!-- Confidence Filter -->
                    <div class="flex gap-2 mb-4">
                      @for (filter of confidenceFilters; track filter.value) {
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          [class.bg-primary]="confidenceFilter() === filter.value"
                          [class.text-primary-foreground]="confidenceFilter() === filter.value"
                          [class.bg-muted]="confidenceFilter() !== filter.value"
                          (click)="setConfidenceFilter(filter.value)"
                        >
                          {{ filter.label }}
                        </button>
                      }
                    </div>

                    @if (filteredRisks().length > 0) {
                      <div class="grid gap-3">
                        @for (risk of filteredRisks(); track risk.text; let i = $index) {
                          <div class="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium flex-shrink-0">
                                !
                              </span>
                              <div class="flex-1">
                                <p class="text-sm">{{ risk.text }}</p>
                                <div class="flex items-center gap-2 mt-2">
                                  <span
                                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                                    [class.bg-green-100]="risk.confidence === 'HIGH'"
                                    [class.text-green-700]="risk.confidence === 'HIGH'"
                                    [class.bg-yellow-100]="risk.confidence === 'MEDIUM'"
                                    [class.text-yellow-700]="risk.confidence === 'MEDIUM'"
                                    [class.bg-gray-100]="risk.confidence === 'LOW'"
                                    [class.text-gray-700]="risk.confidence === 'LOW'"
                                  >
                                    {{ risk.confidence }}
                                  </span>
                                  @if (risk.sourceCount > 0) {
                                    <span class="text-xs text-muted-foreground">
                                      {{ risk.sourceCount }} source{{ risk.sourceCount > 1 ? 's' : '' }}
                                    </span>
                                  }
                                </div>
                                @if (risk.sources?.length) {
                                  <div class="mt-2 flex flex-wrap gap-1">
                                    @for (source of risk.sources; track source) {
                                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-xs text-muted-foreground">
                                        <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                                        {{ source }}
                                      </span>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        @if (confidenceFilter() === 'all') {
                          No market risks identified
                        } @else {
                          No risks match this filter
                        }
                      </div>
                    }
                  </div>
                }

                @case ('implications') {
                  <!-- Implications Tab -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-6">
                      <ng-icon name="lucideLightbulb" class="h-6 w-6 text-primary" />
                      <div>
                        <h2 class="text-lg font-semibold">Strategic Implications</h2>
                        <p class="text-sm text-muted-foreground">
                          What these findings mean for your product or business
                        </p>
                      </div>
                    </div>

                    @if (session()?.implications?.length) {
                      <div class="grid gap-3">
                        @for (implication of session()?.implications; track implication; let i = $index) {
                          <div class="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div class="flex items-start gap-3">
                              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
                                {{ i + 1 }}
                              </span>
                              <p class="flex-1 text-sm">{{ implication }}</p>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="text-center py-12 text-muted-foreground">
                        No strategic implications identified
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
export class MarketResearchResultsComponent implements OnInit, OnDestroy {
  service = inject(MarketResearchService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  tabs: Tab[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'trends', label: 'Market Trends' },
    { id: 'expectations', label: 'Expectation Shifts' },
    { id: 'risks', label: 'Market Risks' },
    { id: 'implications', label: 'Implications' },
  ];

  confidenceFilters: { value: 'all' | 'HIGH' | 'MEDIUM' | 'LOW'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'HIGH', label: 'High Confidence' },
    { value: 'MEDIUM', label: 'Medium Confidence' },
    { value: 'LOW', label: 'Low Confidence' },
  ];

  activeTab = signal<TabId>('summary');
  confidenceFilter = signal<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');

  session = this.service.currentSession;

  topInsights(): MarketInsight[] {
    const trends = this.session()?.marketTrends || [];
    const expectations = this.session()?.expectationShifts || [];
    const risks = this.session()?.marketRisks || [];

    // Combine and sort by confidence (HIGH first), take top 3
    const all = [...trends, ...expectations, ...risks];
    const sorted = all.sort((a, b) => {
      const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.confidence] || 2) - (order[b.confidence] || 2);
    });
    return sorted.slice(0, 3);
  }

  filteredTrends(): MarketInsight[] {
    const trends = this.session()?.marketTrends || [];
    if (this.confidenceFilter() === 'all') {
      return trends;
    }
    return trends.filter(t => t.confidence === this.confidenceFilter());
  }

  filteredExpectations(): MarketInsight[] {
    const expectations = this.session()?.expectationShifts || [];
    if (this.confidenceFilter() === 'all') {
      return expectations;
    }
    return expectations.filter(e => e.confidence === this.confidenceFilter());
  }

  filteredRisks(): MarketInsight[] {
    const risks = this.session()?.marketRisks || [];
    if (this.confidenceFilter() === 'all') {
      return risks;
    }
    return risks.filter(r => r.confidence === this.confidenceFilter());
  }

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (sessionId) {
      await this.service.loadFocusAreas();
      await this.service.loadIndustries();
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

  setConfidenceFilter(filter: 'all' | 'HIGH' | 'MEDIUM' | 'LOW') {
    this.confidenceFilter.set(filter);
  }

  goBack() {
    this.router.navigate(['/research/market-research']);
  }

  async retryAnalysis() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      await this.service.retrySession(sessionId);
      this.startPollingIfNeeded();
    }
  }

  getIndustryLabel(): string {
    const session = this.session();
    if (!session) return '';
    return this.service.getIndustryLabel(session.industryContext);
  }

  getFocusAreaLabel(value: string): string {
    return this.service.getFocusAreaLabel(value);
  }
}
