/**
 * CX Improvement Recommender Results Component
 *
 * Displays recommendations in a three-column layout:
 * - Quick Wins: High impact, low effort
 * - High Impact: Important improvements
 * - Strategic: Long-term initiatives
 *
 * Features:
 * - Expandable recommendation cards
 * - Score editing
 * - Solution approaches with pros/cons
 * - Sprint plan suggestion
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideAlertCircle,
  lucideArrowLeft,
  lucideDownload,
  lucideZap,
  lucideTrendingUp,
  lucideCompass,
  lucideChevronDown,
  lucideChevronUp,
  lucideCheckCircle2,
  lucideCalendar,
  lucidePlus,
  lucideTrash2,
  lucidePencil,
  lucideX,
  lucideCheck,
  lucideAlertTriangle,
  lucideTarget,
  lucideActivity,
  lucideFileText,
} from '@ng-icons/lucide';

import { CxRecommenderService } from './cx-recommender.service';
import {
  RecommenderSessionDetail,
  Recommendation,
  SprintPlan,
} from './cx-recommender.types';

// Helper functions
function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e'; // green
  if (score >= 6) return '#eab308'; // yellow
  if (score >= 4) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case 'low': return '#22c55e';
    case 'medium': return '#eab308';
    case 'high': return '#ef4444';
    default: return '#6b7280';
  }
}

@Component({
  selector: 'app-cx-recommender-results',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideAlertCircle,
      lucideArrowLeft,
      lucideDownload,
      lucideZap,
      lucideTrendingUp,
      lucideCompass,
      lucideChevronDown,
      lucideChevronUp,
      lucideCheckCircle2,
      lucideCalendar,
      lucidePlus,
      lucideTrash2,
      lucidePencil,
      lucideX,
      lucideCheck,
      lucideAlertTriangle,
      lucideTarget,
      lucideActivity,
      lucideFileText,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Header -->
      <div class="border-b bg-card sticky top-0 z-10">
        <div class="max-w-full mx-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button
                type="button"
                (click)="goBack()"
                class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
                Back
              </button>
              <div class="h-4 w-px bg-border"></div>
              <div>
                <h1 class="font-semibold text-lg">{{ sessionName() }}</h1>
                <p class="text-sm text-muted-foreground">
                  {{ totalRecommendations() }} recommendations generated
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="toggleSprintPlan()"
                class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                <ng-icon name="lucideCalendar" class="h-4 w-4" />
                Sprint Plan
              </button>
              <button
                type="button"
                (click)="exportToPdf()"
                class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                <ng-icon name="lucideFileText" class="h-4 w-4" />
                Export PDF
              </button>
              <button
                type="button"
                (click)="exportResults()"
                class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                <ng-icon name="lucideDownload" class="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (error()) {
        <div class="max-w-2xl mx-auto p-6">
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div class="flex items-center gap-2 text-destructive">
              <ng-icon name="lucideAlertCircle" class="h-4 w-4" />
              <span class="font-medium">{{ error() }}</span>
            </div>
          </div>
        </div>
      } @else if (sessionDetail()) {
        <div class="p-6 space-y-6">

          <!-- Summary Stats -->
          <div class="grid grid-cols-4 gap-4">
            <div class="rounded-xl border bg-card p-4">
              <div class="flex items-center gap-2 text-yellow-600">
                <ng-icon name="lucideZap" class="h-5 w-5" />
                <span class="font-semibold">Quick Wins</span>
              </div>
              <div class="mt-2 text-3xl font-bold">{{ quickWinsCount() }}</div>
              <p class="text-xs text-muted-foreground mt-1">High impact, low effort</p>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="flex items-center gap-2 text-blue-600">
                <ng-icon name="lucideTrendingUp" class="h-5 w-5" />
                <span class="font-semibold">High Impact</span>
              </div>
              <div class="mt-2 text-3xl font-bold">{{ highImpactCount() }}</div>
              <p class="text-xs text-muted-foreground mt-1">Important improvements</p>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="flex items-center gap-2 text-purple-600">
                <ng-icon name="lucideCompass" class="h-5 w-5" />
                <span class="font-semibold">Strategic</span>
              </div>
              <div class="mt-2 text-3xl font-bold">{{ strategicCount() }}</div>
              <p class="text-xs text-muted-foreground mt-1">Long-term initiatives</p>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="flex items-center gap-2 text-muted-foreground">
                <ng-icon name="lucideActivity" class="h-5 w-5" />
                <span class="font-semibold">Total Effort</span>
              </div>
              <div class="mt-2 text-3xl font-bold">{{ totalEffortDays() }}</div>
              <p class="text-xs text-muted-foreground mt-1">days estimated</p>
            </div>
          </div>

          <!-- Sprint Plan Panel (Collapsible) -->
          @if (showSprintPlan() && sprintPlan()) {
            <div class="rounded-xl border bg-card overflow-hidden">
              <div class="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <ng-icon name="lucideCalendar" class="h-5 w-5 text-primary" />
                  <span class="font-semibold">Suggested Sprint Plan</span>
                </div>
                <button
                  type="button"
                  (click)="toggleSprintPlan()"
                  class="text-muted-foreground hover:text-foreground"
                >
                  <ng-icon name="lucideX" class="h-4 w-4" />
                </button>
              </div>
              <div class="p-4">
                @if (sprintPlan()?.capacityWarning) {
                  <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                    <ng-icon name="lucideAlertTriangle" class="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span class="text-sm text-amber-800">{{ sprintPlan()?.capacityWarning }}</span>
                  </div>
                }
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <h4 class="font-medium text-sm mb-2 text-yellow-700">Sprint 1-2 (Quick Wins)</h4>
                    <div class="space-y-2">
                      @for (item of sprintPlan()?.sprint1_2 || []; track item.recId) {
                        <div class="text-sm p-2 rounded bg-yellow-50 border border-yellow-100">
                          <p class="font-medium line-clamp-1">{{ item.title }}</p>
                          <p class="text-xs text-muted-foreground">{{ item.effortDays }} days</p>
                        </div>
                      }
                      @if (!sprintPlan()?.sprint1_2?.length) {
                        <p class="text-xs text-muted-foreground italic">No items</p>
                      }
                    </div>
                  </div>
                  <div>
                    <h4 class="font-medium text-sm mb-2 text-blue-700">Sprint 3-4 (High Impact)</h4>
                    <div class="space-y-2">
                      @for (item of sprintPlan()?.sprint3_4 || []; track item.recId) {
                        <div class="text-sm p-2 rounded bg-blue-50 border border-blue-100">
                          <p class="font-medium line-clamp-1">{{ item.title }}</p>
                          <p class="text-xs text-muted-foreground">{{ item.effortDays }} days</p>
                        </div>
                      }
                      @if (!sprintPlan()?.sprint3_4?.length) {
                        <p class="text-xs text-muted-foreground italic">No items</p>
                      }
                    </div>
                  </div>
                  <div>
                    <h4 class="font-medium text-sm mb-2 text-purple-700">Q2+ (Strategic)</h4>
                    <div class="space-y-2">
                      @for (item of sprintPlan()?.q2Plus || []; track item.recId) {
                        <div class="text-sm p-2 rounded bg-purple-50 border border-purple-100">
                          <p class="font-medium line-clamp-1">{{ item.title }}</p>
                          <p class="text-xs text-muted-foreground">{{ item.effortDays }} days</p>
                        </div>
                      }
                      @if (!sprintPlan()?.q2Plus?.length) {
                        <p class="text-xs text-muted-foreground italic">No items</p>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Three Column Recommendations -->
          <div class="grid grid-cols-3 gap-6">
            <!-- Quick Wins Column -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 px-1">
                <ng-icon name="lucideZap" class="h-5 w-5 text-yellow-600" />
                <h3 class="font-semibold text-yellow-700">Quick Wins</h3>
                <span class="text-sm text-muted-foreground">({{ quickWinsCount() }})</span>
              </div>
              <div class="space-y-3">
                @for (rec of quickWins(); track rec.id) {
                  <ng-container
                    *ngTemplateOutlet="recommendationCard; context: { rec: rec, colorClass: 'yellow' }"
                  ></ng-container>
                }
                @if (quickWins().length === 0) {
                  <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No quick wins identified
                  </div>
                }
              </div>
            </div>

            <!-- High Impact Column -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 px-1">
                <ng-icon name="lucideTrendingUp" class="h-5 w-5 text-blue-600" />
                <h3 class="font-semibold text-blue-700">High Impact</h3>
                <span class="text-sm text-muted-foreground">({{ highImpactCount() }})</span>
              </div>
              <div class="space-y-3">
                @for (rec of highImpact(); track rec.id) {
                  <ng-container
                    *ngTemplateOutlet="recommendationCard; context: { rec: rec, colorClass: 'blue' }"
                  ></ng-container>
                }
                @if (highImpact().length === 0) {
                  <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No high impact items
                  </div>
                }
              </div>
            </div>

            <!-- Strategic Column -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 px-1">
                <ng-icon name="lucideCompass" class="h-5 w-5 text-purple-600" />
                <h3 class="font-semibold text-purple-700">Strategic</h3>
                <span class="text-sm text-muted-foreground">({{ strategicCount() }})</span>
              </div>
              <div class="space-y-3">
                @for (rec of strategic(); track rec.id) {
                  <ng-container
                    *ngTemplateOutlet="recommendationCard; context: { rec: rec, colorClass: 'purple' }"
                  ></ng-container>
                }
                @if (strategic().length === 0) {
                  <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No strategic items
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Recommendation Card Template -->
    <ng-template #recommendationCard let-rec="rec" let-colorClass="colorClass">
      <div
        class="rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
        [class.ring-2]="expandedRecId() === rec.id"
        [class.ring-primary]="expandedRecId() === rec.id"
        (click)="toggleExpand(rec.id)"
      >
        <!-- Header -->
        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-sm line-clamp-2">{{ rec.title }}</h4>
              <p class="text-xs text-muted-foreground mt-1 line-clamp-2">{{ rec.description }}</p>
            </div>
            <ng-icon
              [name]="expandedRecId() === rec.id ? 'lucideChevronUp' : 'lucideChevronDown'"
              class="h-4 w-4 text-muted-foreground flex-shrink-0"
            />
          </div>

          <!-- Score Pills -->
          <div class="flex items-center gap-2 mt-3">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              [style.background-color]="getScoreColor(rec.impactScore) + '20'"
              [style.color]="getScoreColor(rec.impactScore)"
            >
              Impact: {{ rec.impactScore }}
            </span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              [style.background-color]="getScoreColor(11 - rec.effortScore) + '20'"
              [style.color]="getScoreColor(11 - rec.effortScore)"
            >
              Effort: {{ rec.effortScore }}
            </span>
            @if (rec.quickWin) {
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                <ng-icon name="lucideZap" class="h-3 w-3" />
                Quick Win
              </span>
            }
          </div>
        </div>

        <!-- Expanded Content -->
        @if (expandedRecId() === rec.id) {
          <div class="border-t p-4 space-y-4 bg-muted/20" (click)="$event.stopPropagation()">
            <!-- Scores Detail -->
            <div class="grid grid-cols-4 gap-2 text-center">
              <div class="rounded bg-background p-2 border">
                <div class="text-xs text-muted-foreground">Impact</div>
                <div class="font-bold" [style.color]="getScoreColor(rec.impactScore)">{{ rec.impactScore }}</div>
              </div>
              <div class="rounded bg-background p-2 border">
                <div class="text-xs text-muted-foreground">Effort</div>
                <div class="font-bold" [style.color]="getScoreColor(11 - rec.effortScore)">{{ rec.effortScore }}</div>
              </div>
              <div class="rounded bg-background p-2 border">
                <div class="text-xs text-muted-foreground">Urgency</div>
                <div class="font-bold" [style.color]="getScoreColor(rec.urgencyScore)">{{ rec.urgencyScore }}</div>
              </div>
              <div class="rounded bg-background p-2 border">
                <div class="text-xs text-muted-foreground">Opportunity</div>
                <div class="font-bold text-primary">{{ rec.opportunityScore }}</div>
              </div>
            </div>

            <!-- Effort Breakdown -->
            @if (rec.totalEffortDays) {
              <div class="text-sm">
                <span class="font-medium">Estimated Effort:</span>
                <span class="text-muted-foreground ml-1">
                  {{ rec.totalEffortDays }} days total
                  @if (rec.designDays || rec.engineeringDays || rec.testingDays) {
                    ({{ rec.designDays || 0 }}d design, {{ rec.engineeringDays || 0 }}d eng, {{ rec.testingDays || 0 }}d test)
                  }
                </span>
              </div>
            }

            <!-- Risk Level -->
            <div class="text-sm flex items-center gap-2">
              <span class="font-medium">Risk:</span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                [style.background-color]="getRiskColor(rec.riskLevel) + '20'"
                [style.color]="getRiskColor(rec.riskLevel)"
              >
                {{ rec.riskLevel | titlecase }}
              </span>
            </div>

            <!-- Addresses Pain Points -->
            @if (rec.addressesPainPoints?.length) {
              <div>
                <div class="text-sm font-medium mb-2">Addresses Pain Points:</div>
                <div class="space-y-1">
                  @for (pp of rec.addressesPainPoints; track pp.painPointId) {
                    <div class="text-xs p-2 rounded bg-red-50 border border-red-100">
                      <span class="text-red-700">{{ pp.description }}</span>
                      <span class="text-muted-foreground ml-2">(Severity: {{ pp.severity }})</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Addresses Gaps -->
            @if (rec.addressesGaps?.length) {
              <div>
                <div class="text-sm font-medium mb-2">Closes Competitive Gaps:</div>
                <div class="space-y-1">
                  @for (gap of rec.addressesGaps; track gap.gapId) {
                    <div class="text-xs p-2 rounded bg-blue-50 border border-blue-100">
                      <span class="text-blue-700">{{ gap.title }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Solution Approaches -->
            @if (rec.solutionApproaches?.length) {
              <div>
                <div class="text-sm font-medium mb-2">Solution Approaches:</div>
                <div class="space-y-2">
                  @for (approach of rec.solutionApproaches; track approach.title; let i = $index) {
                    <div class="rounded border p-3 bg-background">
                      <div class="font-medium text-sm">{{ i + 1 }}. {{ approach.title }}</div>
                      <p class="text-xs text-muted-foreground mt-1">{{ approach.description }}</p>
                      <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span class="font-medium text-green-700">Pros:</span>
                          <ul class="list-disc list-inside text-muted-foreground mt-1">
                            @for (pro of approach.pros; track pro) {
                              <li>{{ pro }}</li>
                            }
                          </ul>
                        </div>
                        <div>
                          <span class="font-medium text-red-700">Cons:</span>
                          <ul class="list-disc list-inside text-muted-foreground mt-1">
                            @for (con of approach.cons; track con) {
                              <li>{{ con }}</li>
                            }
                          </ul>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Implementation Approach -->
            @if (rec.implementationApproach) {
              <div>
                <div class="text-sm font-medium mb-1">Implementation:</div>
                <p class="text-xs text-muted-foreground">{{ rec.implementationApproach }}</p>
              </div>
            }

            <!-- Success Metrics -->
            @if (rec.successMetrics?.length) {
              <div>
                <div class="text-sm font-medium mb-2">Success Metrics:</div>
                <ul class="list-disc list-inside text-xs text-muted-foreground">
                  @for (metric of rec.successMetrics; track metric) {
                    <li>{{ metric }}</li>
                  }
                </ul>
              </div>
            }

            <!-- Business Metrics -->
            @if (rec.businessMetrics) {
              <div>
                <div class="text-sm font-medium mb-2">Projected Business Impact:</div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  @if (rec.businessMetrics.timeSavings) {
                    <div class="p-2 rounded bg-green-50 border border-green-100">
                      <span class="font-medium text-green-700">Time Savings:</span>
                      <span class="text-green-600 ml-1">{{ rec.businessMetrics.timeSavings }}</span>
                    </div>
                  }
                  @if (rec.businessMetrics.conversionLift) {
                    <div class="p-2 rounded bg-blue-50 border border-blue-100">
                      <span class="font-medium text-blue-700">Conversion:</span>
                      <span class="text-blue-600 ml-1">{{ rec.businessMetrics.conversionLift }}</span>
                    </div>
                  }
                  @if (rec.businessMetrics.npsImpact) {
                    <div class="p-2 rounded bg-purple-50 border border-purple-100">
                      <span class="font-medium text-purple-700">NPS:</span>
                      <span class="text-purple-600 ml-1">{{ rec.businessMetrics.npsImpact }}</span>
                    </div>
                  }
                  @if (rec.businessMetrics.retentionImpact) {
                    <div class="p-2 rounded bg-amber-50 border border-amber-100">
                      <span class="font-medium text-amber-700">Retention:</span>
                      <span class="text-amber-600 ml-1">{{ rec.businessMetrics.retentionImpact }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Actions -->
            <div class="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                (click)="dismissRecommendation(rec.id)"
                class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <ng-icon name="lucideTrash2" class="h-3 w-3" />
                Dismiss
              </button>
              <div class="text-xs text-muted-foreground">
                Priority Tier {{ rec.priorityTier }}
              </div>
            </div>
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class CxRecommenderResultsComponent implements OnInit {
  private service = inject(CxRecommenderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  sessionDetail = signal<RecommenderSessionDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  expandedRecId = signal<number | null>(null);
  showSprintPlan = signal(false);

  // Utility functions for template
  getScoreColor = getScoreColor;
  getRiskColor = getRiskColor;

  // Computed
  sessionName = computed(() => this.sessionDetail()?.session?.sessionName || 'Recommendations');
  totalRecommendations = computed(() => this.sessionDetail()?.totals?.total || 0);
  quickWinsCount = computed(() => this.sessionDetail()?.totals?.quickWins || 0);
  highImpactCount = computed(() => this.sessionDetail()?.totals?.highImpact || 0);
  strategicCount = computed(() => this.sessionDetail()?.totals?.strategic || 0);

  quickWins = computed(() => this.sessionDetail()?.recommendations?.quickWins || []);
  highImpact = computed(() => this.sessionDetail()?.recommendations?.highImpact || []);
  strategic = computed(() => this.sessionDetail()?.recommendations?.strategic || []);

  sprintPlan = computed(() => this.sessionDetail()?.session?.sprintPlan);

  totalEffortDays = computed(() => {
    const allRecs = [
      ...this.quickWins(),
      ...this.highImpact(),
      ...this.strategic(),
    ];
    return allRecs.reduce((sum, r) => sum + (r.totalEffortDays || 0), 0);
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const sessionId = idParam ? parseInt(idParam, 10) : null;

    if (sessionId) {
      this.loadSession(sessionId);
    } else {
      this.error.set('Invalid session ID');
      this.loading.set(false);
    }
  }

  async loadSession(sessionId: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const detail = await this.service.getSession(sessionId);
      this.sessionDetail.set(detail);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      this.loading.set(false);
    }
  }

  toggleExpand(recId: number): void {
    if (this.expandedRecId() === recId) {
      this.expandedRecId.set(null);
    } else {
      this.expandedRecId.set(recId);
    }
  }

  toggleSprintPlan(): void {
    this.showSprintPlan.set(!this.showSprintPlan());
  }

  async dismissRecommendation(recId: number): Promise<void> {
    if (!confirm('Dismiss this recommendation?')) return;

    try {
      await this.service.dismissRecommendation(recId);
      // Reload to update counts
      const sessionId = this.sessionDetail()?.session?.id;
      if (sessionId) {
        await this.loadSession(sessionId);
      }
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  }

  exportResults(): void {
    const data = this.sessionDetail();
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cx-recommendations-${data.session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportToPdf(): void {
    const data = this.sessionDetail();
    if (!data) return;

    const quickWins = this.quickWins();
    const highImpact = this.highImpact();
    const strategic = this.strategic();
    const sprintPlan = this.sprintPlan();

    const getScoreColorPdf = (score: number): string => {
      if (score >= 8) return '#22c55e';
      if (score >= 6) return '#eab308';
      if (score >= 4) return '#f97316';
      return '#ef4444';
    };

    const getRiskColorPdf = (risk: string): string => {
      switch (risk) {
        case 'low': return '#22c55e';
        case 'medium': return '#eab308';
        case 'high': return '#ef4444';
        default: return '#6b7280';
      }
    };

    const renderRecommendation = (rec: Recommendation, colorClass: string): string => {
      const colors: Record<string, { bg: string; border: string; text: string }> = {
        yellow: { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
        blue: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
        purple: { bg: '#f3e8ff', border: '#d8b4fe', text: '#6b21a8' },
      };
      const color = colors[colorClass] || colors['yellow'];

      let painPointsHtml = '';
      if (rec.addressesPainPoints?.length) {
        painPointsHtml = `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #374151;">Addresses Pain Points:</div>
            ${rec.addressesPainPoints.map(pp => `
              <div style="font-size: 11px; padding: 6px 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; margin-bottom: 4px;">
                <span style="color: #b91c1c;">${pp.description}</span>
                <span style="color: #6b7280; margin-left: 8px;">(Severity: ${pp.severity})</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      let gapsHtml = '';
      if (rec.addressesGaps?.length) {
        gapsHtml = `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #374151;">Closes Competitive Gaps:</div>
            ${rec.addressesGaps.map(gap => `
              <div style="font-size: 11px; padding: 6px 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; margin-bottom: 4px;">
                <span style="color: #1d4ed8;">${gap.title}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      let solutionsHtml = '';
      if (rec.solutionApproaches?.length) {
        solutionsHtml = `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #374151;">Solution Approaches:</div>
            ${rec.solutionApproaches.map((approach, i) => `
              <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-bottom: 8px; background: #f9fafb;">
                <div style="font-weight: 600; font-size: 12px; color: #111827;">${i + 1}. ${approach.title}</div>
                <p style="font-size: 11px; color: #6b7280; margin: 6px 0 8px 0;">${approach.description}</p>
                <div style="display: flex; gap: 16px;">
                  <div style="flex: 1;">
                    <span style="font-weight: 600; font-size: 11px; color: #15803d;">Pros:</span>
                    <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px; color: #6b7280;">
                      ${approach.pros?.map(pro => `<li>${pro}</li>`).join('') || ''}
                    </ul>
                  </div>
                  <div style="flex: 1;">
                    <span style="font-weight: 600; font-size: 11px; color: #b91c1c;">Cons:</span>
                    <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px; color: #6b7280;">
                      ${approach.cons?.map(con => `<li>${con}</li>`).join('') || ''}
                    </ul>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      let metricsHtml = '';
      if (rec.successMetrics?.length) {
        metricsHtml = `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #374151;">Success Metrics:</div>
            <ul style="margin: 0 0 0 16px; padding: 0; font-size: 11px; color: #6b7280;">
              ${rec.successMetrics.map(m => `<li>${m}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      let businessMetricsHtml = '';
      if (rec.businessMetrics) {
        const bm = rec.businessMetrics;
        businessMetricsHtml = `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #374151;">Projected Business Impact:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${bm.timeSavings ? `<div style="font-size: 11px; padding: 4px 8px; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 4px;"><span style="font-weight: 600; color: #15803d;">Time Savings:</span> <span style="color: #16a34a;">${bm.timeSavings}</span></div>` : ''}
              ${bm.conversionLift ? `<div style="font-size: 11px; padding: 4px 8px; background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 4px;"><span style="font-weight: 600; color: #1d4ed8;">Conversion:</span> <span style="color: #2563eb;">${bm.conversionLift}</span></div>` : ''}
              ${bm.npsImpact ? `<div style="font-size: 11px; padding: 4px 8px; background: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 4px;"><span style="font-weight: 600; color: #7c3aed;">NPS:</span> <span style="color: #8b5cf6;">${bm.npsImpact}</span></div>` : ''}
              ${bm.retentionImpact ? `<div style="font-size: 11px; padding: 4px 8px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px;"><span style="font-weight: 600; color: #d97706;">Retention:</span> <span style="color: #f59e0b;">${bm.retentionImpact}</span></div>` : ''}
            </div>
          </div>
        `;
      }

      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: white; page-break-inside: avoid;">
          <div style="border-left: 4px solid ${color.border}; padding-left: 12px; margin-bottom: 12px;">
            <h4 style="font-weight: 600; font-size: 14px; margin: 0 0 4px 0; color: #111827;">${rec.title}</h4>
            <p style="font-size: 12px; color: #6b7280; margin: 0;">${rec.description}</p>
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: ${getScoreColorPdf(rec.impactScore)}20; color: ${getScoreColorPdf(rec.impactScore)};">
              Impact: ${rec.impactScore}
            </span>
            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: ${getScoreColorPdf(11 - rec.effortScore)}20; color: ${getScoreColorPdf(11 - rec.effortScore)};">
              Effort: ${rec.effortScore}
            </span>
            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: ${getScoreColorPdf(rec.urgencyScore)}20; color: ${getScoreColorPdf(rec.urgencyScore)};">
              Urgency: ${rec.urgencyScore}
            </span>
            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: #006450; color: white;">
              Opportunity: ${rec.opportunityScore}
            </span>
            ${rec.quickWin ? `<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: #fef9c3; color: #854d0e;">Quick Win</span>` : ''}
          </div>

          <div style="display: flex; gap: 16px; font-size: 12px; margin-bottom: 8px;">
            ${rec.totalEffortDays ? `
              <div>
                <span style="font-weight: 600; color: #374151;">Estimated Effort:</span>
                <span style="color: #6b7280; margin-left: 4px;">
                  ${rec.totalEffortDays} days total
                  ${(rec.designDays || rec.engineeringDays || rec.testingDays) ? `(${rec.designDays || 0}d design, ${rec.engineeringDays || 0}d eng, ${rec.testingDays || 0}d test)` : ''}
                </span>
              </div>
            ` : ''}
          </div>

          <div style="font-size: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; color: #374151;">Risk:</span>
            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: ${getRiskColorPdf(rec.riskLevel)}20; color: ${getRiskColorPdf(rec.riskLevel)};">
              ${rec.riskLevel.charAt(0).toUpperCase() + rec.riskLevel.slice(1)}
            </span>
            <span style="margin-left: auto; font-size: 11px; color: #9ca3af;">Priority Tier ${rec.priorityTier}</span>
          </div>

          ${painPointsHtml}
          ${gapsHtml}
          ${solutionsHtml}

          ${rec.implementationApproach ? `
            <div style="margin-top: 12px;">
              <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px; color: #374151;">Implementation:</div>
              <p style="font-size: 11px; color: #6b7280; margin: 0;">${rec.implementationApproach}</p>
            </div>
          ` : ''}

          ${metricsHtml}
          ${businessMetricsHtml}
        </div>
      `;
    };

    let sprintPlanHtml = '';
    if (sprintPlan) {
      sprintPlanHtml = `
        <div style="margin-bottom: 32px; page-break-inside: avoid;">
          <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <span style="color: #006450;">&#128197;</span> Suggested Sprint Plan
          </h2>
          ${sprintPlan.capacityWarning ? `
            <div style="margin-bottom: 16px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
              <span style="color: #d97706; font-size: 13px;">&#9888; ${sprintPlan.capacityWarning}</span>
            </div>
          ` : ''}
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div>
              <h4 style="font-weight: 600; font-size: 13px; margin: 0 0 8px 0; color: #854d0e;">Sprint 1-2 (Quick Wins)</h4>
              ${sprintPlan.sprint1_2?.length ? sprintPlan.sprint1_2.map(item => `
                <div style="font-size: 12px; padding: 8px; background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; margin-bottom: 6px;">
                  <p style="font-weight: 500; margin: 0 0 2px 0; color: #111827;">${item.title}</p>
                  <p style="font-size: 11px; color: #6b7280; margin: 0;">${item.effortDays} days</p>
                </div>
              `).join('') : '<p style="font-size: 12px; color: #9ca3af; font-style: italic;">No items</p>'}
            </div>
            <div>
              <h4 style="font-weight: 600; font-size: 13px; margin: 0 0 8px 0; color: #1e40af;">Sprint 3-4 (High Impact)</h4>
              ${sprintPlan.sprint3_4?.length ? sprintPlan.sprint3_4.map(item => `
                <div style="font-size: 12px; padding: 8px; background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; margin-bottom: 6px;">
                  <p style="font-weight: 500; margin: 0 0 2px 0; color: #111827;">${item.title}</p>
                  <p style="font-size: 11px; color: #6b7280; margin: 0;">${item.effortDays} days</p>
                </div>
              `).join('') : '<p style="font-size: 12px; color: #9ca3af; font-style: italic;">No items</p>'}
            </div>
            <div>
              <h4 style="font-weight: 600; font-size: 13px; margin: 0 0 8px 0; color: #6b21a8;">Q2+ (Strategic)</h4>
              ${sprintPlan.q2Plus?.length ? sprintPlan.q2Plus.map(item => `
                <div style="font-size: 12px; padding: 8px; background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 6px; margin-bottom: 6px;">
                  <p style="font-weight: 500; margin: 0 0 2px 0; color: #111827;">${item.title}</p>
                  <p style="font-size: 11px; color: #6b7280; margin: 0;">${item.effortDays} days</p>
                </div>
              `).join('') : '<p style="font-size: 12px; color: #9ca3af; font-style: italic;">No items</p>'}
            </div>
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CX Recommendations - ${data.session.sessionName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: white;
            color: #111827;
            font-size: 14px;
            line-height: 1.5;
          }
          @media print {
            body {
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
          }
          @page {
            margin: 0.75in;
            size: A4;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #006450;">
          <h1 style="font-size: 28px; font-weight: 700; color: #006450; margin: 0 0 8px 0;">CX Improvement Recommendations</h1>
          <p style="font-size: 16px; color: #6b7280; margin: 0 0 16px 0;">${data.session.sessionName}</p>
          <div style="display: flex; gap: 24px; font-size: 13px; color: #374151;">
            <span>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>Total Recommendations: ${data.totals.total}</span>
            <span>Total Effort: ${this.totalEffortDays()} days</span>
          </div>
        </div>

        <!-- Summary Stats -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
          <div style="padding: 16px; border: 1px solid #fde047; border-radius: 12px; background: #fefce8;">
            <div style="display: flex; align-items: center; gap: 8px; color: #854d0e; font-weight: 600; font-size: 14px;">
              <span>&#9889;</span> Quick Wins
            </div>
            <div style="font-size: 32px; font-weight: 700; margin-top: 8px; color: #111827;">${data.totals.quickWins}</div>
            <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">High impact, low effort</p>
          </div>
          <div style="padding: 16px; border: 1px solid #93c5fd; border-radius: 12px; background: #eff6ff;">
            <div style="display: flex; align-items: center; gap: 8px; color: #1e40af; font-weight: 600; font-size: 14px;">
              <span>&#128200;</span> High Impact
            </div>
            <div style="font-size: 32px; font-weight: 700; margin-top: 8px; color: #111827;">${data.totals.highImpact}</div>
            <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">Important improvements</p>
          </div>
          <div style="padding: 16px; border: 1px solid #d8b4fe; border-radius: 12px; background: #faf5ff;">
            <div style="display: flex; align-items: center; gap: 8px; color: #6b21a8; font-weight: 600; font-size: 14px;">
              <span>&#129517;</span> Strategic
            </div>
            <div style="font-size: 32px; font-weight: 700; margin-top: 8px; color: #111827;">${data.totals.strategic}</div>
            <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">Long-term initiatives</p>
          </div>
          <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb;">
            <div style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-weight: 600; font-size: 14px;">
              <span>&#128202;</span> Total Effort
            </div>
            <div style="font-size: 32px; font-weight: 700; margin-top: 8px; color: #111827;">${this.totalEffortDays()}</div>
            <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">days estimated</p>
          </div>
        </div>

        ${sprintPlanHtml}

        <!-- Quick Wins Section -->
        ${quickWins.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #854d0e; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 2px solid #fde047;">
              <span>&#9889;</span> Quick Wins (${quickWins.length})
            </h2>
            ${quickWins.map(rec => renderRecommendation(rec, 'yellow')).join('')}
          </div>
        ` : ''}

        <!-- High Impact Section -->
        ${highImpact.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #1e40af; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 2px solid #93c5fd;">
              <span>&#128200;</span> High Impact (${highImpact.length})
            </h2>
            ${highImpact.map(rec => renderRecommendation(rec, 'blue')).join('')}
          </div>
        ` : ''}

        <!-- Strategic Section -->
        ${strategic.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #6b21a8; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 2px solid #d8b4fe;">
              <span>&#129517;</span> Strategic (${strategic.length})
            </h2>
            ${strategic.map(rec => renderRecommendation(rec, 'purple')).join('')}
          </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">Generated by Product Studio</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  goBack(): void {
    this.router.navigate(['/cx-recommender']);
  }
}
