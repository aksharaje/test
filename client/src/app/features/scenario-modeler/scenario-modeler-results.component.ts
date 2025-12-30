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
}
