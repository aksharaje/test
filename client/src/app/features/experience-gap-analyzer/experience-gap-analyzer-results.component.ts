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
  lucideFileText,
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
      lucideFileText,
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
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="exportToPdf()"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                <ng-icon name="lucideFileText" class="h-4 w-4" />
                Export PDF
              </button>
              <button
                type="button"
                (click)="exportAnalysis()"
                class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                <ng-icon name="lucideDownload" class="h-4 w-4" />
                Export JSON
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
      } @else if (session()) {
        <div class="max-w-7xl mx-auto p-6 space-y-8">

          <!-- Data Disclaimer -->
          <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div class="flex gap-3">
              <ng-icon name="lucideAlertCircle" class="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div class="text-sm text-amber-800">
                <span class="font-medium">Analysis based on journey map data.</span>
                Gaps and scores are inferred from your journey stages, pain points, and emotion scores.
                For comprehensive competitive analysis, supplement with real customer research data.
              </div>
            </div>
          </div>

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

              <!-- Strengths -->
              <div class="rounded-xl border bg-card p-5">
                <div class="text-sm text-muted-foreground mb-2">Strengths Found</div>
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

          <!-- Relative Strengths (data-supported only) -->
          @if (advantages().length > 0) {
            <section class="space-y-4">
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <ng-icon name="lucideStar" class="h-5 w-5 text-green-600" />
                Relative Strengths
              </h2>
              <p class="text-sm text-muted-foreground -mt-2">
                Based on evidence in your journey data (emotion scores, pain points)
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (adv of advantages(); track adv.title) {
                  <div class="rounded-lg border border-green-200 bg-green-50/50 p-4">
                    <div class="font-medium text-green-800">{{ adv.title }}</div>
                    <div class="text-sm text-green-700 mt-1">{{ adv.description }}</div>
                    @if (adv.evidence) {
                      <div class="text-xs text-green-600 mt-2 font-medium">Evidence: {{ adv.evidence }}</div>
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

  exportToPdf(): void {
    const sessionData = this.session();
    if (!sessionData) return;

    const { session, gaps, capabilityMatrix } = sessionData;
    const assessment = session.overallAssessment;
    const advantages = session.competitiveAdvantages || [];

    // Build HTML document
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Experience Gap Analysis - ${this.escapeHtml(session.analysisName || 'Report')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: #ffffff;
      padding: 40px;
    }
    .header {
      border-bottom: 3px solid #006450;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #006450;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #6b7280;
    }
    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #006450;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 700;
    }
    .metric-sub {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .health-excellent { color: #22c55e; }
    .health-good { color: #84cc16; }
    .health-moderate { color: #eab308; }
    .health-warning { color: #f97316; }
    .health-critical { color: #ef4444; }
    .summary-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }
    .summary-box p {
      color: #166534;
      font-size: 13px;
    }
    .tier-section {
      margin-bottom: 24px;
    }
    .tier-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .tier-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .tier-1 { background: #fee2e2; color: #991b1b; border-left: 4px solid #ef4444; }
    .tier-2 { background: #ffedd5; color: #9a3412; border-left: 4px solid #f97316; }
    .tier-3 { background: #dbeafe; color: #1e40af; border-left: 4px solid #3b82f6; }
    .gap-list {
      list-style: none;
    }
    .gap-item {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 10px;
    }
    .gap-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .gap-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .cat-capability { background: #8b5cf6; }
    .cat-experience { background: #3b82f6; }
    .cat-quality { background: #22c55e; }
    .cat-process { background: #f97316; }
    .gap-title {
      font-weight: 600;
      font-size: 13px;
      color: #1f2937;
    }
    .gap-meta {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 11px;
      color: #6b7280;
    }
    .gap-description {
      margin-top: 10px;
      font-size: 12px;
      color: #4b5563;
    }
    .gap-scores {
      display: flex;
      gap: 16px;
      margin-top: 12px;
    }
    .score-item {
      background: #f3f4f6;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 11px;
    }
    .score-label {
      color: #6b7280;
    }
    .score-value {
      font-weight: 600;
      margin-left: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 10px 12px;
      text-align: left;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-weight: 600;
      font-size: 12px;
    }
    .score-your { background: #dbeafe; color: #1e40af; }
    .score-comp { background: #f3e8ff; color: #6b21a8; }
    .gap-positive { background: #dcfce7; color: #166534; }
    .gap-negative { background: #fee2e2; color: #991b1b; }
    .gap-neutral { background: #f3f4f6; color: #374151; }
    .strength-card {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .strength-title {
      font-weight: 600;
      color: #166534;
      margin-bottom: 6px;
    }
    .strength-desc {
      color: #15803d;
      font-size: 12px;
    }
    .strength-evidence {
      margin-top: 8px;
      font-size: 11px;
      color: #059669;
      font-style: italic;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }
    .focus-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .focus-tag {
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
      .tier-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(session.analysisName || 'Experience Gap Analysis Report')}</h1>
    <p class="subtitle">${this.escapeHtml(this.analysisTypeLabel())} | Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <!-- Overall Assessment Section -->
  <div class="section">
    <h2 class="section-title">Overall Assessment</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Health Score</div>
        <div class="metric-value ${this.getHealthScoreClass(assessment?.overallHealthScore || 0)}">${assessment?.overallHealthScore ?? 0}</div>
        <div class="metric-sub">out of 100</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Gaps</div>
        <div class="metric-value">${assessment?.totalGapsIdentified ?? 0}</div>
        <div class="metric-sub"><span style="color: #ef4444; font-weight: 600;">${assessment?.criticalGapsCount ?? 0}</span> critical</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Strengths Found</div>
        <div class="metric-value health-excellent">${assessment?.competitiveAdvantagesCount ?? 0}</div>
        <div class="metric-sub">areas you excel</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Focus Areas</div>
        <div class="focus-tags">
          ${(assessment?.recommendedFocusAreas || []).slice(0, 3).map(area => `<span class="focus-tag">${this.escapeHtml(area)}</span>`).join('')}
        </div>
      </div>
    </div>
    ${assessment?.summary ? `
    <div class="summary-box">
      <p>${this.escapeHtml(assessment.summary)}</p>
    </div>
    ` : ''}
  </div>

  <!-- Prioritized Roadmap Section -->
  <div class="section">
    <h2 class="section-title">Prioritized Roadmap</h2>
    ${this.buildTierSection(1, 'Critical', 'Address immediately - high impact, high urgency', gaps)}
    ${this.buildTierSection(2, 'Important', 'Schedule for next quarter - moderate priority', gaps)}
    ${this.buildTierSection(3, 'Nice-to-have', 'Consider when resources allow', gaps)}
  </div>

  <!-- Capability Comparison Section -->
  ${capabilityMatrix && capabilityMatrix.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Capability Comparison</h2>
    <table>
      <thead>
        <tr>
          <th>Capability</th>
          <th style="text-align: center;">Your Score</th>
          <th style="text-align: center;">Comparison</th>
          <th style="text-align: center;">Gap</th>
          <th>Suggestion</th>
        </tr>
      </thead>
      <tbody>
        ${capabilityMatrix.map(item => `
        <tr>
          <td>
            <div style="font-weight: 500;">${this.escapeHtml(item.capabilityName)}</div>
            <div style="font-size: 10px; color: #6b7280;">${this.escapeHtml(item.category)}</div>
          </td>
          <td style="text-align: center;">
            <span class="score-badge score-your">${item.yourScore}</span>
          </td>
          <td style="text-align: center;">
            <span class="score-badge score-comp">${item.comparisonScore}</span>
          </td>
          <td style="text-align: center;">
            <span class="score-badge ${item.gapScore > 0 ? 'gap-negative' : item.gapScore < 0 ? 'gap-positive' : 'gap-neutral'}">
              ${item.gapScore > 0 ? '-' + item.gapScore : item.gapScore < 0 ? '+' + Math.abs(item.gapScore) : '0'}
            </span>
          </td>
          <td style="font-size: 11px; color: #6b7280;">${this.escapeHtml(item.improvementSuggestion || '-')}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Relative Strengths Section -->
  ${advantages.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Relative Strengths</h2>
    <p style="color: #6b7280; font-size: 12px; margin-bottom: 16px;">Based on evidence in your journey data (emotion scores, pain points)</p>
    ${advantages.map(adv => `
    <div class="strength-card">
      <div class="strength-title">${this.escapeHtml(adv.title)}</div>
      <div class="strength-desc">${this.escapeHtml(adv.description)}</div>
      ${adv.evidence ? `<div class="strength-evidence">Evidence: ${this.escapeHtml(adv.evidence)}</div>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by Product Studio</p>
    <p style="margin-top: 4px;">${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      // Small delay to ensure content is loaded before print dialog
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getHealthScoreClass(score: number): string {
    if (score >= 80) return 'health-excellent';
    if (score >= 60) return 'health-good';
    if (score >= 40) return 'health-moderate';
    if (score >= 20) return 'health-warning';
    return 'health-critical';
  }

  private buildTierSection(tier: PriorityTier, label: string, description: string, gaps: GapItem[]): string {
    const tierGaps = gaps.filter(g => g.priorityTier === tier).sort((a, b) => b.opportunityScore - a.opportunityScore);

    if (tierGaps.length === 0) {
      return `
      <div class="tier-section">
        <div class="tier-header">
          <span class="tier-badge tier-${tier}">Tier ${tier}: ${label}</span>
          <span style="color: #6b7280; font-size: 11px;">${description}</span>
        </div>
        <p style="color: #9ca3af; font-size: 12px; font-style: italic; padding: 12px;">No gaps in this tier</p>
      </div>
      `;
    }

    return `
    <div class="tier-section">
      <div class="tier-header">
        <span class="tier-badge tier-${tier}">Tier ${tier}: ${label} (${tierGaps.length})</span>
        <span style="color: #6b7280; font-size: 11px;">${description}</span>
      </div>
      <ul class="gap-list">
        ${tierGaps.map(gap => `
        <li class="gap-item">
          <div class="gap-header">
            <div class="gap-indicator cat-${gap.category}"></div>
            <div>
              <div class="gap-title">${this.escapeHtml(gap.title)}</div>
              <div class="gap-meta">
                <span>Score: ${gap.opportunityScore}</span>
                ${gap.stageName ? `<span>| ${this.escapeHtml(gap.stageName)}</span>` : ''}
                <span>| Category: ${gap.category}</span>
              </div>
            </div>
          </div>
          ${gap.description ? `<p class="gap-description">${this.escapeHtml(gap.description)}</p>` : ''}
          <div class="gap-scores">
            <span class="score-item"><span class="score-label">Impact:</span><span class="score-value">${gap.impactScore}</span></span>
            <span class="score-item"><span class="score-label">Urgency:</span><span class="score-value">${gap.urgencyScore}</span></span>
            <span class="score-item"><span class="score-label">Effort:</span><span class="score-value">${gap.effortScore}</span></span>
          </div>
          ${gap.evidence ? `<p style="margin-top: 10px; font-size: 11px; color: #6b7280;"><strong>Evidence:</strong> ${this.escapeHtml(gap.evidence)}</p>` : ''}
        </li>
        `).join('')}
      </ul>
    </div>
    `;
  }

  goBack(): void {
    this.router.navigate(['/gap-analyzer']);
  }
}
