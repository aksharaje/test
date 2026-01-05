import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGitBranch,
  lucideLoader2,
  lucideCheck,
  lucideX,
  lucideAlertTriangle,
  lucideArrowUp,
  lucideArrowDown,
  lucideMinus,
  lucideTrendingUp,
  lucideTrendingDown,
  lucideScale,
  lucideTarget,
  lucideClock,
  lucideUsers,
  lucideChevronRight,
  lucideArrowRight,
  lucideRefreshCw,
  lucideDownload,
  lucidePresentation,
  lucideFileText,
} from '@ng-icons/lucide';
import { ScenarioModelerService } from './scenario-modeler.service';
import type {
  ScenarioSession,
  ScenarioVariant,
  ScenarioComparisonReport,
} from './scenario-modeler.types';

@Component({
  selector: 'app-scenario-modeler-results',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideGitBranch,
      lucideLoader2,
      lucideCheck,
      lucideX,
      lucideAlertTriangle,
      lucideArrowUp,
      lucideArrowDown,
      lucideMinus,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideScale,
      lucideTarget,
      lucideClock,
      lucideUsers,
      lucideChevronRight,
      lucideArrowRight,
      lucideRefreshCw,
      lucideDownload,
      lucidePresentation,
      lucideFileText,
    }),
  ],
  template: `
    <div class="min-h-full bg-slate-50">
      <!-- Header -->
      <div class="bg-white border-b px-6 py-4">
        <div class="flex items-center justify-between max-w-7xl mx-auto">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideGitBranch" class="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 class="text-xl font-bold">{{ session()?.name || 'Scenario Analysis' }}</h1>
              <p class="text-sm text-muted-foreground">
                {{ variants().length }} scenarios generated
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (session()?.status === 'completed') {
              <button
                (click)="exportToPdf()"
                class="px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50"
              >
                <ng-icon name="lucideFileText" class="h-4 w-4" />
                Export PDF
              </button>
              <button
                (click)="navigateToCommunicator()"
                class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary/90"
              >
                <ng-icon name="lucidePresentation" class="h-4 w-4" />
                Create Presentation
              </button>
            }
            <button
              (click)="refreshData()"
              class="px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50"
            >
              <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Processing State -->
      @if (isProcessing()) {
        <div class="flex flex-col items-center justify-center py-24">
          <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin mb-4" />
          <h2 class="text-lg font-semibold mb-2">Generating Scenarios...</h2>
          <p class="text-muted-foreground mb-4">{{ session()?.progressMessage }}</p>
          <div class="w-64 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-300"
              [style.width.%]="progressPercent()"
            ></div>
          </div>
          <p class="text-sm text-muted-foreground mt-2">
            Step {{ session()?.progressStep }} of {{ session()?.progressTotal }}
          </p>
        </div>
      } @else if (session()?.status === 'failed') {
        <div class="flex flex-col items-center justify-center py-24">
          <ng-icon name="lucideAlertTriangle" class="h-12 w-12 text-red-500 mb-4" />
          <h2 class="text-lg font-semibold text-red-700 mb-2">Generation Failed</h2>
          <p class="text-muted-foreground mb-4">{{ session()?.errorMessage }}</p>
          <button
            (click)="retryGeneration()"
            class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      } @else {
        <div class="max-w-7xl mx-auto p-6">
          <!-- Comparison Overview -->
          @if (comparison()) {
            <div class="bg-white border rounded-lg p-6 mb-6">
              <h2 class="text-lg font-semibold mb-4">Scenario Comparison</h2>

              <!-- Trade-off Matrix -->
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b">
                      <th class="text-left py-3 px-4 font-medium">Scenario</th>
                      <th class="text-center py-3 px-4 font-medium">Timeline</th>
                      <th class="text-center py-3 px-4 font-medium">Capacity</th>
                      <th class="text-center py-3 px-4 font-medium">Risk</th>
                      <th class="text-center py-3 px-4 font-medium">Viable</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (variant of variants(); track variant.id) {
                      <tr
                        class="border-b hover:bg-slate-50 cursor-pointer"
                        [class.bg-primary/5]="selectedVariantId() === variant.id"
                        (click)="selectVariant(variant.id)"
                      >
                        <td class="py-3 px-4">
                          <div class="flex items-center gap-2">
                            @if (variant.isBaseline) {
                              <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                Baseline
                              </span>
                            }
                            <span class="font-medium">{{ variant.name }}</span>
                          </div>
                        </td>
                        <td class="py-3 px-4 text-center">
                          @if (getTimelineComparison(variant.id); as timeline) {
                            <div class="flex items-center justify-center gap-1">
                              @if (timeline.deltaFromBaseline < 0) {
                                <ng-icon name="lucideArrowDown" class="h-4 w-4 text-green-600" />
                                <span class="text-green-600">{{ Math.abs(timeline.deltaFromBaseline) }} sprints</span>
                              } @else if (timeline.deltaFromBaseline > 0) {
                                <ng-icon name="lucideArrowUp" class="h-4 w-4 text-red-600" />
                                <span class="text-red-600">+{{ timeline.deltaFromBaseline }} sprints</span>
                              } @else {
                                <ng-icon name="lucideMinus" class="h-4 w-4 text-slate-400" />
                                <span class="text-slate-600">No change</span>
                              }
                            </div>
                          }
                        </td>
                        <td class="py-3 px-4 text-center">
                          @if (getCapacityComparison(variant.id); as capacity) {
                            <div class="flex items-center justify-center gap-1">
                              @if (capacity.deltaFromBaseline > 0) {
                                <ng-icon name="lucideTrendingUp" class="h-4 w-4 text-green-600" />
                                <span class="text-green-600">+{{ capacity.deltaFromBaseline }}</span>
                              } @else if (capacity.deltaFromBaseline < 0) {
                                <ng-icon name="lucideTrendingDown" class="h-4 w-4 text-red-600" />
                                <span class="text-red-600">{{ capacity.deltaFromBaseline }}</span>
                              } @else {
                                <ng-icon name="lucideMinus" class="h-4 w-4 text-slate-400" />
                                <span class="text-slate-600">No change</span>
                              }
                            </div>
                          }
                        </td>
                        <td class="py-3 px-4 text-center">
                          <div
                            class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                            [class.bg-green-100]="variant.riskScore < 30"
                            [class.text-green-700]="variant.riskScore < 30"
                            [class.bg-amber-100]="variant.riskScore >= 30 && variant.riskScore < 60"
                            [class.text-amber-700]="variant.riskScore >= 30 && variant.riskScore < 60"
                            [class.bg-red-100]="variant.riskScore >= 60"
                            [class.text-red-700]="variant.riskScore >= 60"
                          >
                            {{ variant.riskScore }}
                          </div>
                        </td>
                        <td class="py-3 px-4 text-center">
                          @if (variant.isViable) {
                            <ng-icon name="lucideCheck" class="h-5 w-5 text-green-600 mx-auto" />
                          } @else {
                            <ng-icon name="lucideX" class="h-5 w-5 text-red-600 mx-auto" />
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Recommendations -->
              @if (comparison()?.recommendations?.length) {
                <div class="mt-6 border-t pt-4">
                  <h3 class="font-medium mb-2">Recommendations</h3>
                  <ul class="space-y-2">
                    @for (rec of comparison()?.recommendations; track rec) {
                      <li class="flex items-start gap-2 text-sm text-muted-foreground">
                        <ng-icon name="lucideChevronRight" class="h-4 w-4 text-primary mt-0.5" />
                        {{ rec }}
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          }

          <!-- Selected Variant Details -->
          @if (selectedVariant()) {
            <div class="bg-white border rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold">{{ selectedVariant()?.name }} Details</h2>
                @if (!selectedVariant()?.isBaseline && selectedVariant()?.isViable) {
                  <button
                    (click)="promoteVariant()"
                    class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                  >
                    Promote to Baseline
                  </button>
                }
              </div>

              <div class="grid grid-cols-3 gap-6">
                <!-- Impact Summary -->
                <div>
                  <h3 class="text-sm font-medium text-muted-foreground mb-3">Impact Summary</h3>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm">Items Accelerated</span>
                      <span class="font-medium text-green-600">
                        {{ selectedVariant()?.impactSummary?.itemsAcceleratedCount || 0 }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm">Items Deferred</span>
                      <span class="font-medium text-amber-600">
                        {{ selectedVariant()?.impactSummary?.itemsDeferredCount || 0 }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm">Items Excluded</span>
                      <span class="font-medium text-red-600">
                        {{ selectedVariant()?.impactSummary?.itemsExcludedCount || 0 }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between border-t pt-2 mt-2">
                      <span class="text-sm">Timeline Change</span>
                      <span
                        class="font-medium"
                        [class.text-green-600]="(selectedVariant()?.impactSummary?.timelineDelta || 0) < 0"
                        [class.text-red-600]="(selectedVariant()?.impactSummary?.timelineDelta || 0) > 0"
                      >
                        {{ selectedVariant()?.impactSummary?.timelineDelta || 0 }} sprints
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Risk Factors -->
                <div>
                  <h3 class="text-sm font-medium text-muted-foreground mb-3">Risk Factors</h3>
                  @if ((selectedVariant()?.riskFactors?.length || 0) === 0) {
                    <p class="text-sm text-muted-foreground">No significant risks identified</p>
                  } @else {
                    <div class="space-y-2">
                      @for (risk of selectedVariant()?.riskFactors; track risk.description) {
                        <div
                          class="p-2 rounded text-xs"
                          [class.bg-red-50]="risk.severity === 'high'"
                          [class.text-red-700]="risk.severity === 'high'"
                          [class.bg-amber-50]="risk.severity === 'medium'"
                          [class.text-amber-700]="risk.severity === 'medium'"
                          [class.bg-slate-50]="risk.severity === 'low'"
                          [class.text-slate-700]="risk.severity === 'low'"
                        >
                          {{ risk.description }}
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Trade-offs -->
                <div>
                  <h3 class="text-sm font-medium text-muted-foreground mb-3">Trade-offs</h3>
                  @if ((selectedVariant()?.tradeOffs?.length || 0) === 0) {
                    <p class="text-sm text-muted-foreground">No significant trade-offs</p>
                  } @else {
                    <div class="space-y-3">
                      @for (tradeOff of selectedVariant()?.tradeOffs; track tradeOff.description) {
                        <div class="text-xs">
                          <div class="flex items-start gap-1 text-green-700 mb-1">
                            <ng-icon name="lucideArrowUp" class="h-3 w-3 mt-0.5" />
                            {{ tradeOff.gain }}
                          </div>
                          <div class="flex items-start gap-1 text-red-700">
                            <ng-icon name="lucideArrowDown" class="h-3 w-3 mt-0.5" />
                            {{ tradeOff.cost }}
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ScenarioModelerResultsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private scenarioService = inject(ScenarioModelerService);

  Math = Math;

  session = signal<ScenarioSession | null>(null);
  variants = signal<ScenarioVariant[]>([]);
  comparison = signal<ScenarioComparisonReport | null>(null);
  selectedVariantId = signal<number | null>(null);

  private pollInterval: any;

  isProcessing = computed(() => {
    const status = this.session()?.status;
    return status === 'generating' || status === 'comparing';
  });

  progressPercent = computed(() => {
    const s = this.session();
    if (!s || !s.progressTotal) return 0;
    return (s.progressStep / s.progressTotal) * 100;
  });

  selectedVariant = computed(() => {
    const id = this.selectedVariantId();
    return this.variants().find((v) => v.id === id) || null;
  });

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.params['id']);
    await this.loadData(sessionId);

    // Start polling if processing
    if (this.isProcessing()) {
      this.startPolling(sessionId);
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  async loadData(sessionId: number) {
    try {
      const response = await this.scenarioService.loadSession(sessionId);
      this.session.set(response.session);
      this.variants.set(response.variants);
      this.comparison.set(response.comparison || null);

      // Select baseline by default
      const baseline = response.variants.find((v) => v.isBaseline);
      if (baseline) {
        this.selectedVariantId.set(baseline.id);
      }
    } catch (err) {
      console.error('Failed to load session', err);
    }
  }

  startPolling(sessionId: number) {
    this.pollInterval = setInterval(async () => {
      const status = await this.scenarioService.getSessionStatus(sessionId);
      this.session.update((s) =>
        s
          ? {
              ...s,
              status: status.status as any,
              progressStep: status.progressStep,
              progressMessage: status.progressMessage || s.progressMessage,
              errorMessage: status.errorMessage,
            }
          : null
      );

      if (status.status === 'completed' || status.status === 'failed') {
        this.stopPolling();
        await this.loadData(sessionId);
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async refreshData() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      await this.loadData(sessionId);
    }
  }

  selectVariant(variantId: number) {
    this.selectedVariantId.set(variantId);
  }

  async promoteVariant() {
    const sessionId = this.session()?.id;
    const variantId = this.selectedVariantId();
    if (!sessionId || !variantId) return;

    try {
      await this.scenarioService.promoteVariant(sessionId, variantId);
      await this.loadData(sessionId);
    } catch (err) {
      console.error('Failed to promote variant', err);
    }
  }

  async retryGeneration() {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    try {
      await this.scenarioService.generateScenarios(sessionId);
      this.startPolling(sessionId);
    } catch (err) {
      console.error('Failed to retry generation', err);
    }
  }

  navigateToCommunicator() {
    const sessionId = this.session()?.id;
    const variantId = this.selectedVariantId();
    const roadmapId = this.session()?.roadmapSessionId;

    this.router.navigate(['/roadmapping/communicator'], {
      queryParams: {
        roadmapId,
        scenarioVariantId: variantId,
      },
    });
  }

  getTimelineComparison(variantId: number) {
    return this.comparison()?.timelineComparison?.[variantId];
  }

  getCapacityComparison(variantId: number) {
    return this.comparison()?.capacityComparison?.[variantId];
  }

  exportToPdf() {
    const session = this.session();
    const variants = this.variants();
    const comparison = this.comparison();
    if (!session || variants.length === 0) return;

    const getRiskColor = (score: number) => {
      if (score < 30) return { bg: '#dcfce7', text: '#166534' };
      if (score < 60) return { bg: '#fef9c3', text: '#854d0e' };
      return { bg: '#fee2e2', text: '#b91c1c' };
    };

    const variantsHtml = variants.map(variant => {
      const riskColor = getRiskColor(variant.riskScore || 0);
      const timelineComp = comparison?.timelineComparison?.[variant.id];
      const capacityComp = comparison?.capacityComparison?.[variant.id];

      let timelineDelta = 'N/A';
      if (timelineComp) {
        if (timelineComp.deltaFromBaseline < 0) {
          timelineDelta = `<span style="color: #16a34a;">↓ ${Math.abs(timelineComp.deltaFromBaseline)} sprints</span>`;
        } else if (timelineComp.deltaFromBaseline > 0) {
          timelineDelta = `<span style="color: #dc2626;">↑ +${timelineComp.deltaFromBaseline} sprints</span>`;
        } else {
          timelineDelta = '<span style="color: #6b7280;">No change</span>';
        }
      }

      let capacityDelta = 'N/A';
      if (capacityComp) {
        if (capacityComp.deltaFromBaseline > 0) {
          capacityDelta = `<span style="color: #16a34a;">↑ +${capacityComp.deltaFromBaseline}</span>`;
        } else if (capacityComp.deltaFromBaseline < 0) {
          capacityDelta = `<span style="color: #dc2626;">↓ ${capacityComp.deltaFromBaseline}</span>`;
        } else {
          capacityDelta = '<span style="color: #6b7280;">No change</span>';
        }
      }

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            ${variant.isBaseline ? '<span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 8px;">Baseline</span>' : ''}
            <strong>${variant.name}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${timelineDelta}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${capacityDelta}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span style="background: ${riskColor.bg}; color: ${riskColor.text}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">${variant.riskScore || 0}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            ${variant.isViable ? '✓' : '✗'}
          </td>
        </tr>
      `;
    }).join('');

    const variantDetailsHtml = variants.map(variant => `
      <div class="variant-detail">
        <h3 class="variant-name">${variant.name} ${variant.isBaseline ? '<span class="baseline-tag">Baseline</span>' : ''}</h3>

        <div class="detail-grid">
          <div class="detail-section">
            <h4>Impact Summary</h4>
            <div class="stat-row"><span>Items Accelerated</span><span class="stat-value green">${variant.impactSummary?.itemsAcceleratedCount || 0}</span></div>
            <div class="stat-row"><span>Items Deferred</span><span class="stat-value amber">${variant.impactSummary?.itemsDeferredCount || 0}</span></div>
            <div class="stat-row"><span>Items Excluded</span><span class="stat-value red">${variant.impactSummary?.itemsExcludedCount || 0}</span></div>
            <div class="stat-row border-top"><span>Timeline Change</span><span class="stat-value">${variant.impactSummary?.timelineDelta || 0} sprints</span></div>
          </div>

          <div class="detail-section">
            <h4>Risk Factors</h4>
            ${(variant.riskFactors?.length || 0) === 0 ? '<p class="muted">No significant risks identified</p>' :
              variant.riskFactors?.map(risk => `
                <div class="risk-item ${risk.severity}">${risk.description}</div>
              `).join('') || ''}
          </div>

          <div class="detail-section">
            <h4>Trade-offs</h4>
            ${(variant.tradeOffs?.length || 0) === 0 ? '<p class="muted">No significant trade-offs</p>' :
              variant.tradeOffs?.map(tradeOff => `
                <div class="tradeoff-item">
                  <div class="gain">↑ ${tradeOff.gain}</div>
                  <div class="cost">↓ ${tradeOff.cost}</div>
                </div>
              `).join('') || ''}
          </div>
        </div>
      </div>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${session.name || 'Scenario Analysis'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 48px;
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid #6366f1;
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { font-size: 14px; color: #64748b; }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
    th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; font-size: 13px; border-bottom: 2px solid #e2e8f0; }
    th:not(:first-child) { text-align: center; }
    .variant-detail {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .variant-name {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .baseline-tag {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .detail-section h4 {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 6px 0;
    }
    .stat-row.border-top { border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 12px; }
    .stat-value { font-weight: 600; }
    .stat-value.green { color: #16a34a; }
    .stat-value.amber { color: #d97706; }
    .stat-value.red { color: #dc2626; }
    .muted { color: #94a3b8; font-size: 13px; }
    .risk-item {
      font-size: 12px;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .risk-item.high { background: #fee2e2; color: #b91c1c; }
    .risk-item.medium { background: #fef9c3; color: #854d0e; }
    .risk-item.low { background: #f1f5f9; color: #475569; }
    .tradeoff-item {
      font-size: 12px;
      margin-bottom: 12px;
    }
    .gain { color: #16a34a; margin-bottom: 4px; }
    .cost { color: #dc2626; }
    .recommendations {
      background: #f0f9ff;
      border-left: 4px solid #0ea5e9;
      padding: 16px;
      border-radius: 0 8px 8px 0;
    }
    .recommendations h3 { font-size: 14px; font-weight: 600; color: #0369a1; margin-bottom: 12px; }
    .recommendations ul { margin: 0; padding-left: 20px; }
    .recommendations li { font-size: 13px; color: #334155; margin-bottom: 8px; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 24px; }
      .variant-detail { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.name || 'Scenario Analysis'}</h1>
    <div class="subtitle">${variants.length} scenarios generated</div>
  </div>

  <div class="section">
    <h2 class="section-title">Scenario Comparison</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Timeline</th>
          <th>Capacity</th>
          <th>Risk</th>
          <th>Viable</th>
        </tr>
      </thead>
      <tbody>
        ${variantsHtml}
      </tbody>
    </table>
  </div>

  ${comparison?.recommendations?.length ? `
  <div class="section">
    <div class="recommendations">
      <h3>Recommendations</h3>
      <ul>
        ${comparison.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Scenario Details</h2>
    ${variantDetailsHtml}
  </div>

  <div class="footer">
    Generated by Product Studio • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }
}
