/**
 * Experience Gap Analyzer Results Component
 *
 * Displays gap analysis results including:
 * - Overall assessment with health score
 * - Prioritized gaps organized by tier
 * - Capability comparison matrix
 * - Interactive roadmap with drag-drop prioritization
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideAlertCircle,
  lucideArrowLeft,
  lucideRefreshCw,
  lucideCheckCircle,
  lucideChevronDown,
  lucideChevronUp,
  lucidePlus,
  lucideTrash2,
  lucidePencil,
  lucideDownload,
  lucideTarget,
  lucideTrendingUp,
  lucideTrendingDown,
  lucideActivity,
  lucideStar,
  lucideFlag,
  lucideCircle,
  lucideCheck,
  lucideX,
  lucideGripVertical,
} from '@ng-icons/lucide';

import { ExperienceGapAnalyzerService } from './experience-gap-analyzer.service';
import {
  GapAnalysisSessionDetail,
  GapItem,
  CapabilityMatrixItem,
  StageAlignment,
  PriorityTier,
  TIER_CONFIGS,
  getTierConfig,
  getCategoryColor,
  getHealthScoreColor,
  getScoreColor,
} from './experience-gap-analyzer.types';

@Component({
  selector: 'app-experience-gap-analyzer-results',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideAlertCircle,
      lucideArrowLeft,
      lucideRefreshCw,
      lucideCheckCircle,
      lucideChevronDown,
      lucideChevronUp,
      lucidePlus,
      lucideTrash2,
      lucidePencil,
      lucideDownload,
      lucideTarget,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideActivity,
      lucideStar,
      lucideFlag,
      lucideCircle,
      lucideCheck,
      lucideX,
      lucideGripVertical,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Header -->
      <div class="border-b bg-card">
        <div class="max-w-7xl mx-auto px-6 py-4">
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
                <h1 class="font-semibold text-lg">{{ analysisName() }}</h1>
                <p class="text-sm text-muted-foreground">
                  {{ analysisTypeLabel() }} | {{ gapsCount() }} gaps identified
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="exportAnalysis()"
              class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
            >
              <ng-icon name="lucideDownload" class="h-4 w-4" />
              Export
            </button>
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
      } @else if (session()) {
        <div class="max-w-7xl mx-auto p-6 space-y-8">

          <!-- Overall Assessment -->
          <section class="space-y-4">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <ng-icon name="lucideActivity" class="h-5 w-5 text-primary" />
              Overall Assessment
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <!-- Health Score -->
              <div class="rounded-xl border bg-card p-5">
                <div class="text-sm text-muted-foreground mb-2">Health Score</div>
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-3xl font-bold"
                    [style.color]="getHealthScoreColor(healthScore())"
                  >
                    {{ healthScore() }}
                  </span>
                  <span class="text-sm text-muted-foreground">/ 100</span>
                </div>
                <div class="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    [style.width.%]="healthScore()"
                    [style.background-color]="getHealthScoreColor(healthScore())"
                  ></div>
                </div>
              </div>

              <!-- Total Gaps -->
              <div class="rounded-xl border bg-card p-5">
                <div class="text-sm text-muted-foreground mb-2">Total Gaps</div>
                <div class="flex items-baseline gap-2">
                  <span class="text-3xl font-bold">{{ totalGaps() }}</span>
                </div>
                <div class="mt-2 text-xs text-muted-foreground">
                  <span class="text-red-500 font-medium">{{ criticalGapsCount() }}</span> critical
                </div>
              </div>

              <!-- Advantages -->
              <div class="rounded-xl border bg-card p-5">
                <div class="text-sm text-muted-foreground mb-2">Your Advantages</div>
                <div class="flex items-baseline gap-2">
                  <span class="text-3xl font-bold text-green-600">
                    {{ advantagesCount() }}
                  </span>
                </div>
                <div class="mt-2 text-xs text-muted-foreground">Areas you excel</div>
              </div>

              <!-- Focus Areas -->
              <div class="rounded-xl border bg-card p-5">
                <div class="text-sm text-muted-foreground mb-2">Recommended Focus</div>
                <div class="flex flex-wrap gap-1 mt-1">
                  @for (area of focusAreas(); track area; let i = $index) {
                    @if (i < 3) {
                      <span class="inline-flex px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{{ area }}</span>
                    }
                  }
                </div>
              </div>
            </div>

            <!-- Summary -->
            @if (summaryText()) {
              <div class="rounded-lg bg-muted/50 p-4 text-sm text-foreground">
                {{ summaryText() }}
              </div>
            }
          </section>

          <!-- Prioritized Roadmap -->
          <section class="space-y-4">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <ng-icon name="lucideFlag" class="h-5 w-5 text-primary" />
              Prioritized Roadmap
            </h2>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              @for (tierConfig of tierConfigs; track tierConfig.tier) {
                <div class="rounded-xl border bg-card">
                  <div
                    class="px-4 py-3 border-b flex items-center justify-between"
                    [style.border-left]="'4px solid ' + tierConfig.color"
                  >
                    <div>
                      <span class="font-semibold">Tier {{ tierConfig.tier }}: {{ tierConfig.label }}</span>
                      <span class="ml-2 text-sm text-muted-foreground">({{ getGapsForTier(tierConfig.tier).length }})</span>
                    </div>
                  </div>
                  <div class="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                    @for (gap of getGapsForTier(tierConfig.tier); track gap.id) {
                      <div
                        class="rounded-lg border p-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer"
                        [class.border-primary]="expandedGapId() === gap.id"
                        (click)="toggleGapExpand(gap.id)"
                      >
                        <div class="flex items-start gap-2">
                          <div
                            class="h-2 w-2 rounded-full mt-2 flex-shrink-0"
                            [style.background-color]="getCategoryColor(gap.category)"
                          ></div>
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-sm">{{ gap.title }}</div>
                            <div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>Score: {{ gap.opportunityScore }}</span>
                              @if (gap.stageName) {
                                <span>| {{ gap.stageName }}</span>
                              }
                            </div>
                          </div>
                          <ng-icon
                            [name]="expandedGapId() === gap.id ? 'lucideChevronUp' : 'lucideChevronDown'"
                            class="h-4 w-4 text-muted-foreground flex-shrink-0"
                          />
                        </div>

                        <!-- Expanded details -->
                        @if (expandedGapId() === gap.id) {
                          <div class="mt-3 pt-3 border-t space-y-3" (click)="$event.stopPropagation()">
                            <p class="text-sm text-muted-foreground">{{ gap.description }}</p>

                            <!-- Scores -->
                            <div class="grid grid-cols-3 gap-2 text-center">
                              <div class="rounded bg-muted/50 p-2">
                                <div class="text-xs text-muted-foreground">Impact</div>
                                <div class="font-semibold" [style.color]="getScoreColor(gap.impactScore)">
                                  {{ gap.impactScore }}
                                </div>
                              </div>
                              <div class="rounded bg-muted/50 p-2">
                                <div class="text-xs text-muted-foreground">Urgency</div>
                                <div class="font-semibold" [style.color]="getScoreColor(gap.urgencyScore)">
                                  {{ gap.urgencyScore }}
                                </div>
                              </div>
                              <div class="rounded bg-muted/50 p-2">
                                <div class="text-xs text-muted-foreground">Effort</div>
                                <div class="font-semibold" [style.color]="getScoreColor(gap.effortScore)">
                                  {{ gap.effortScore }}
                                </div>
                              </div>
                            </div>

                            @if (gap.evidence) {
                              <div class="text-xs">
                                <span class="font-medium">Evidence:</span>
                                <span class="text-muted-foreground ml-1">{{ gap.evidence }}</span>
                              </div>
                            }

                            <!-- Tier change buttons -->
                            <div class="flex gap-2 pt-2">
                              @for (t of tierNumbers; track t) {
                                @if (t !== gap.priorityTier) {
                                  <button
                                    type="button"
                                    (click)="changeGapTier(gap, t)"
                                    class="flex-1 text-xs py-1 px-2 rounded border hover:bg-muted transition-colors"
                                    [style.border-color]="getTierConfig(t).color"
                                    [style.color]="getTierConfig(t).color"
                                  >
                                    Move to Tier {{ t }}
                                  </button>
                                }
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }
                    @if (getGapsForTier(tierConfig.tier).length === 0) {
                      <div class="p-4 text-center text-sm text-muted-foreground">
                        No gaps in this tier
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Capability Matrix -->
          @if (session()?.capabilityMatrix && session()!.capabilityMatrix.length > 0) {
            <section class="space-y-4">
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                Capability Comparison
              </h2>
              <div class="rounded-xl border bg-card overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50">
                      <tr>
                        <th class="text-left px-4 py-3 font-medium">Capability</th>
                        <th class="text-center px-4 py-3 font-medium">Your Score</th>
                        <th class="text-center px-4 py-3 font-medium">Comparison</th>
                        <th class="text-center px-4 py-3 font-medium">Gap</th>
                        <th class="text-left px-4 py-3 font-medium">Suggestion</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      @for (item of session()?.capabilityMatrix || []; track item.id) {
                        <tr class="hover:bg-muted/30">
                          <td class="px-4 py-3">
                            <div class="font-medium">{{ item.capabilityName }}</div>
                            <div class="text-xs text-muted-foreground">{{ item.category }}</div>
                          </td>
                          <td class="px-4 py-3 text-center">
                            <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                              {{ item.yourScore }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-center">
                            <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm">
                              {{ item.comparisonScore }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-center">
                            <span
                              class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                              [class.bg-red-100]="item.gapScore > 0"
                              [class.text-red-700]="item.gapScore > 0"
                              [class.bg-green-100]="item.gapScore <= 0"
                              [class.text-green-700]="item.gapScore <= 0"
                            >
                              @if (item.gapScore > 0) {
                                <ng-icon name="lucideTrendingDown" class="h-3 w-3" />
                                -{{ item.gapScore }}
                              } @else if (item.gapScore < 0) {
                                <ng-icon name="lucideTrendingUp" class="h-3 w-3" />
                                +{{ Math.abs(item.gapScore) }}
                              } @else {
                                <ng-icon name="lucideCheck" class="h-3 w-3" />
                                Equal
                              }
                            </span>
                          </td>
                          <td class="px-4 py-3 text-muted-foreground text-xs max-w-[200px]">
                            {{ item.improvementSuggestion || '-' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          }

          <!-- Competitive Advantages -->
          @if (advantages().length > 0) {
            <section class="space-y-4">
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <ng-icon name="lucideStar" class="h-5 w-5 text-green-600" />
                Your Competitive Advantages
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (adv of advantages(); track adv.title) {
                  <div class="rounded-lg border border-green-200 bg-green-50/50 p-4">
                    <div class="font-medium text-green-800">{{ adv.title }}</div>
                    <div class="text-sm text-green-700 mt-1">{{ adv.description }}</div>
                    @if (adv.evidence) {
                      <div class="text-xs text-green-600 mt-2">{{ adv.evidence }}</div>
                    }
                  </div>
                }
              </div>
            </section>
          }

        </div>
      }
    </div>
  `,
})
export class ExperienceGapAnalyzerResultsComponent implements OnInit {
  private service = inject(ExperienceGapAnalyzerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  session = signal<GapAnalysisSessionDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  expandedGapId = signal<number | null>(null);

  // Config
  tierConfigs = TIER_CONFIGS;
  tierNumbers: PriorityTier[] = [1, 2, 3];

  // Utility references for template
  Math = Math;
  getTierConfig = getTierConfig;
  getCategoryColor = getCategoryColor;
  getHealthScoreColor = getHealthScoreColor;
  getScoreColor = getScoreColor;

  // Computed
  healthScore = computed(() => {
    return this.session()?.session?.overallAssessment?.overallHealthScore ?? 0;
  });

  totalGaps = computed(() => {
    return this.session()?.session?.overallAssessment?.totalGapsIdentified ?? 0;
  });

  advantagesCount = computed(() => {
    return this.session()?.session?.overallAssessment?.competitiveAdvantagesCount ?? 0;
  });

  focusAreas = computed(() => {
    return this.session()?.session?.overallAssessment?.recommendedFocusAreas ?? [];
  });

  summaryText = computed(() => {
    return this.session()?.session?.overallAssessment?.summary ?? '';
  });

  advantages = computed(() => {
    return this.session()?.session?.competitiveAdvantages ?? [];
  });

  analysisName = computed(() => {
    return this.session()?.session?.analysisName ?? 'Gap Analysis Results';
  });

  gapsCount = computed(() => {
    return this.session()?.gaps?.length ?? 0;
  });

  analysisTypeLabel = computed(() => {
    const type = this.session()?.session?.analysisType;
    switch (type) {
      case 'competitive': return 'Competitive Analysis';
      case 'best_practice': return 'Best Practice Analysis';
      case 'temporal': return 'Temporal Analysis';
      default: return 'Gap Analysis';
    }
  });

  criticalGapsCount = computed(() => {
    return this.session()?.gaps?.filter(g => g.priorityTier === 1).length ?? 0;
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
      this.session.set(detail);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load analysis results');
    } finally {
      this.loading.set(false);
    }
  }

  getGapsForTier(tier: PriorityTier): GapItem[] {
    return (this.session()?.gaps || [])
      .filter(g => g.priorityTier === tier)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  toggleGapExpand(gapId: number): void {
    if (this.expandedGapId() === gapId) {
      this.expandedGapId.set(null);
    } else {
      this.expandedGapId.set(gapId);
    }
  }

  async changeGapTier(gap: GapItem, newTier: number): Promise<void> {
    const sessionId = this.session()?.session.id;
    if (!sessionId) return;

    try {
      const updated = await this.service.reorderRoadmap(sessionId, {
        gapId: gap.id,
        newTier: newTier as PriorityTier,
      });
      this.session.set(updated);
    } catch (err) {
      console.error('Failed to change tier:', err);
    }
  }

  exportAnalysis(): void {
    const sessionId = this.session()?.session.id;
    if (!sessionId) return;

    // For now, just download as JSON
    const data = this.session();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gap-analysis-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/gap-analyzer']);
  }
}
