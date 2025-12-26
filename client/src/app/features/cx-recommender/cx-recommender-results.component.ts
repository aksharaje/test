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

  goBack(): void {
    this.router.navigate(['/cx-recommender']);
  }
}
