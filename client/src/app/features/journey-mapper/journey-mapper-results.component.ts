/**
 * Journey Mapper Results Component
 *
 * Displays the generated journey map with stages, pain points, and evidence.
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideArrowLeft,
  lucideRoute,
  lucideAlertTriangle,
  lucideX,
  lucidePlus,
  lucideEdit,
  lucideTrash2,
  lucideChevronDown,
  lucideChevronUp,
  lucideExternalLink,
  lucideDownload,
  lucideRefreshCw,
  lucideGitBranch,
  lucideUsers,
  lucideSwords,
  lucideInfo,
  lucideMessageSquare,
  lucideZap,
  lucideFileText,
} from '@ng-icons/lucide';

import { JourneyMapperService } from './journey-mapper.service';
import {
  JourneySessionDetail,
  JourneyStage,
  JourneyPainPoint,
  EmotionCurvePoint,
  getSeverityColor,
  getEmotionColor,
  DELTA_STATUS_CONFIG,
} from './journey-mapper.types';

@Component({
  selector: 'app-journey-mapper-results',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideArrowLeft,
      lucideRoute,
      lucideAlertTriangle,
      lucideX,
      lucidePlus,
      lucideEdit,
      lucideTrash2,
      lucideChevronDown,
      lucideChevronUp,
      lucideExternalLink,
      lucideDownload,
      lucideRefreshCw,
      lucideGitBranch,
      lucideUsers,
      lucideSwords,
      lucideInfo,
      lucideMessageSquare,
      lucideZap,
      lucideFileText,
    }),
  ],
  template: `
    <div class="min-h-screen bg-gray-50">
      @if (loading()) {
        <div class="flex items-center justify-center h-64">
          <ng-icon name="lucideLoader2" class="animate-spin text-primary" size="32" />
        </div>
      } @else if (sessionDetail()) {
        <!-- Header -->
        <div class="bg-white border-b border-gray-200 px-6 py-4">
          <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button
                (click)="goBack()"
                class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ng-icon name="lucideArrowLeft" size="20" />
              </button>
              <div>
                <div class="flex items-center gap-2">
                  <ng-icon [name]="getModeIcon()" class="text-primary" size="20" />
                  <h1 class="text-lg font-semibold text-gray-900">
                    {{ sessionDetail()?.session?.journeyDescription }}
                  </h1>
                </div>
                <div class="flex items-center gap-3 text-sm text-gray-500 mt-1">
                  <span>v{{ sessionDetail()?.session?.version }}</span>
                  <span>&bull;</span>
                  <span class="capitalize">{{ sessionDetail()?.session?.mode?.replace('_', ' ') }}</span>
                  @if (sessionDetail()?.session?.confidenceScore) {
                    <span>&bull;</span>
                    <span>{{ (sessionDetail()?.session?.confidenceScore || 0) * 100 | number:'1.0-0' }}% confidence</span>
                  }
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- Version dropdown -->
              @if ((sessionDetail()?.versions?.length || 0) > 1) {
                <select
                  [value]="sessionDetail()?.session?.id"
                  (change)="switchVersion($event)"
                  class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  @for (version of sessionDetail()?.versions; track version.id) {
                    <option [value]="version.id">v{{ version.version }}</option>
                  }
                </select>
              }
              <button
                (click)="createNewVersion()"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
              >
                <ng-icon name="lucideGitBranch" size="16" />
                Update
              </button>
              <button
                (click)="exportJourney()"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
              >
                <ng-icon name="lucideDownload" size="16" />
                Export
              </button>
              <button
                (click)="exportToPdf()"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
              >
                <ng-icon name="lucideFileText" size="16" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        <!-- Data Quality Warning -->
        @if (sessionDetail()?.session?.dataQualityWarning) {
          <div class="bg-amber-50 border-b border-amber-200 px-6 py-3">
            <div class="max-w-7xl mx-auto flex items-center gap-2 text-amber-700 text-sm">
              <ng-icon name="lucideAlertTriangle" size="16" />
              {{ sessionDetail()?.session?.dataQualityWarning }}
            </div>
          </div>
        }

        <!-- Delta Summary (for version updates) -->
        @if (sessionDetail()?.session?.deltaSummary) {
          <div class="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div class="max-w-7xl mx-auto flex items-center gap-4 text-sm">
              <span class="font-medium text-blue-900">Changes from previous version:</span>
              @if (sessionDetail()?.session?.deltaSummary?.improved) {
                <span class="text-green-600">{{ sessionDetail()?.session?.deltaSummary?.improved }} improved</span>
              }
              @if (sessionDetail()?.session?.deltaSummary?.worsened) {
                <span class="text-red-600">{{ sessionDetail()?.session?.deltaSummary?.worsened }} worsened</span>
              }
              @if (sessionDetail()?.session?.deltaSummary?.new) {
                <span class="text-blue-600">{{ sessionDetail()?.session?.deltaSummary?.new }} new</span>
              }
              @if (sessionDetail()?.session?.deltaSummary?.resolved) {
                <span class="text-purple-600">{{ sessionDetail()?.session?.deltaSummary?.resolved }} resolved</span>
              }
            </div>
          </div>
        }

        <!-- Main Content -->
        <div class="p-6">
          <div class="max-w-7xl mx-auto">
            <!-- Journey Canvas -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 overflow-x-auto">
              <div class="min-w-[800px]">
                <!-- Stages Timeline -->
                <div class="relative">
                  <!-- Timeline line -->
                  <div class="absolute top-12 left-0 right-0 h-1 bg-gray-200"></div>

                  <!-- Stages -->
                  <div class="flex gap-4">
                    @for (stage of stages(); track stage.id; let i = $index) {
                      <div
                        class="flex-1 min-w-[200px] relative"
                        [class.cursor-pointer]="true"
                        (click)="selectStage(stage)"
                      >
                        <!-- Stage Header -->
                        <div
                          class="relative z-10 bg-white border-2 rounded-lg p-4 transition-all"
                          [class.border-primary]="selectedStage()?.id === stage.id"
                          [class.border-gray-200]="selectedStage()?.id !== stage.id"
                          [class.shadow-md]="selectedStage()?.id === stage.id"
                        >
                          <!-- Stage Number -->
                          <div
                            class="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded"
                          >
                            Stage {{ i + 1 }}
                          </div>

                          <h3 class="font-semibold text-gray-900 mt-2 mb-1">{{ stage.name }}</h3>
                          <p class="text-sm text-gray-500 line-clamp-2">{{ stage.description }}</p>

                          @if (stage.durationEstimate) {
                            <p class="text-xs text-gray-400 mt-2">{{ stage.durationEstimate }}</p>
                          }

                          <!-- Touchpoints -->
                          @if (stage.touchpoints.length) {
                            <div class="mt-3 flex flex-wrap gap-1">
                              @for (tp of stage.touchpoints.slice(0, 3); track tp.id) {
                                <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                  {{ tp.name }}
                                </span>
                              }
                              @if (stage.touchpoints.length > 3) {
                                <span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                                  +{{ stage.touchpoints.length - 3 }}
                                </span>
                              }
                            </div>
                          }

                          <!-- Pain Points Badge -->
                          @if (getPainPointsForStage(stage.id).length) {
                            <div class="mt-3 flex items-center gap-1">
                              <ng-icon name="lucideZap" class="text-red-500" size="14" />
                              <span class="text-xs text-red-600 font-medium">
                                {{ getPainPointsForStage(stage.id).length }} pain point(s)
                              </span>
                            </div>
                          }

                          <!-- Emotion Score -->
                          <div class="mt-3 flex items-center gap-2">
                            <div
                              class="w-3 h-3 rounded-full"
                              [style.backgroundColor]="getEmotionColor(stage.emotionScore)"
                            ></div>
                            <span class="text-xs text-gray-500">
                              Emotion: {{ stage.emotionScore | number:'1.1-1' }}/10
                            </span>
                          </div>
                        </div>
                      </div>
                    }

                    <!-- Add Stage Button -->
                    <button
                      (click)="addStage()"
                      class="min-w-[100px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-gray-50 transition-all"
                    >
                      <ng-icon name="lucidePlus" class="text-gray-400" size="24" />
                    </button>
                  </div>
                </div>

                <!-- Emotion Curve (SVG line visualization) - matches stage layout -->
                @if (emotionCurve().length > 0) {
                  <div class="mt-8 pt-6 border-t border-gray-200">
                    <h4 class="text-sm font-medium text-gray-700 mb-3">Emotional Journey</h4>
                    <!-- Chart aligned with stages above -->
                    <div class="flex gap-4">
                      @for (point of emotionCurve(); track point.stageId; let i = $index) {
                        <div class="flex-1 min-w-[200px] flex flex-col items-center">
                          <!-- SVG for this segment -->
                          <svg viewBox="0 0 100 80" class="w-full h-20" preserveAspectRatio="none">
                            <!-- Grid line -->
                            <line x1="0" y1="40" x2="100" y2="40" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="2"/>

                            <!-- Gradient background -->
                            <defs>
                              <linearGradient [attr.id]="'grad' + i" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#22c55e;stop-opacity:0.2" />
                                <stop offset="50%" style="stop-color:#eab308;stop-opacity:0.15" />
                                <stop offset="100%" style="stop-color:#ef4444;stop-opacity:0.1" />
                              </linearGradient>
                            </defs>

                            <!-- Area fill for this segment -->
                            <rect x="0" [attr.y]="75 - (point.score * 7)" width="100" [attr.height]="point.score * 7 + 5" [attr.fill]="'url(#grad' + i + ')'" />

                            <!-- Line segment connecting to next point -->
                            @if (i < emotionCurve().length - 1) {
                              <line
                                x1="50" [attr.y1]="75 - (point.score * 7)"
                                x2="100" [attr.y2]="75 - ((point.score + emotionCurve()[i + 1].score) / 2 * 7)"
                                stroke="#6366f1" stroke-width="3" stroke-linecap="round"
                              />
                            }
                            @if (i > 0) {
                              <line
                                x1="0" [attr.y1]="75 - ((emotionCurve()[i - 1].score + point.score) / 2 * 7)"
                                x2="50" [attr.y2]="75 - (point.score * 7)"
                                stroke="#6366f1" stroke-width="3" stroke-linecap="round"
                              />
                            }

                            <!-- Data point -->
                            <circle
                              cx="50"
                              [attr.cy]="75 - (point.score * 7)"
                              r="6"
                              [attr.fill]="getEmotionColor(point.score)"
                              stroke="white"
                              stroke-width="2"
                            />
                          </svg>
                        </div>
                      }
                      <!-- Empty space to match "Add Stage" button -->
                      <div class="min-w-[100px]"></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Two Column Layout: Pain Points + Detail Panel -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Pain Points List -->
              <div class="lg:col-span-2">
                <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="font-semibold text-gray-900">
                      Pain Points
                      <span class="text-gray-400 font-normal">({{ painPoints().length }})</span>
                    </h3>
                    <button
                      (click)="addPainPoint()"
                      class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <ng-icon name="lucidePlus" size="14" />
                      Add
                    </button>
                  </div>
                  <div class="divide-y">
                    @for (pp of painPoints(); track pp.id) {
                      <div
                        class="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        [class.bg-blue-50]="selectedPainPoint()?.id === pp.id"
                        (click)="selectPainPoint(pp)"
                      >
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                              <!-- Severity indicator -->
                              <div
                                class="w-3 h-3 rounded-full"
                                [style.backgroundColor]="getSeverityColor(pp.severity)"
                              ></div>
                              <span class="text-sm font-medium text-gray-900">
                                {{ pp.severity | number:'1.1-1' }}/10 severity
                              </span>
                              <!-- AI Hypothesis badge -->
                              @if (pp.isHypothetical) {
                                <span class="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
                                  AI Hypothesis
                                </span>
                              }
                              <!-- Delta badge -->
                              @if (pp.deltaStatus && pp.deltaStatus !== 'unchanged') {
                                <span
                                  class="px-2 py-0.5 text-xs rounded"
                                  [style.backgroundColor]="DELTA_STATUS_CONFIG[pp.deltaStatus].bgColor"
                                  [style.color]="DELTA_STATUS_CONFIG[pp.deltaStatus].color"
                                >
                                  {{ DELTA_STATUS_CONFIG[pp.deltaStatus].label }}
                                </span>
                              }
                            </div>
                            <p class="text-gray-700">{{ pp.description }}</p>
                            <p class="text-xs text-gray-400 mt-1">
                              Stage: {{ getStageNameById(pp.stageId) }}
                              <!-- Only show frequency if data-backed (not hypothetical) and frequency > 1 -->
                              @if (!pp.isHypothetical && pp.frequency > 1) {
                                &bull; Mentioned {{ pp.frequency }} times
                              }
                            </p>
                          </div>
                          <div class="flex items-center gap-1 ml-4">
                            <!-- Only show source count if data-backed (not hypothetical) -->
                            @if (!pp.isHypothetical && pp.dataSources?.length) {
                              <span class="text-xs text-gray-400">
                                {{ pp.dataSources?.length }} source(s)
                              </span>
                            }
                          </div>
                        </div>
                      </div>
                    } @empty {
                      <div class="p-8 text-center text-gray-500">
                        <ng-icon name="lucideInfo" size="32" class="mx-auto mb-2 text-gray-300" />
                        <p>No pain points identified yet</p>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Detail Panel -->
              <div class="lg:col-span-1">
                @if (selectedPainPoint()) {
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-6">
                    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 class="font-semibold text-gray-900">Pain Point Details</h3>
                      <button
                        (click)="selectedPainPoint.set(null)"
                        class="text-gray-400 hover:text-gray-600"
                      >
                        <ng-icon name="lucideX" size="18" />
                      </button>
                    </div>
                    <div class="p-4 space-y-4">
                      <!-- Severity Slider -->
                      <div>
                        <label class="text-sm font-medium text-gray-700 block mb-2">
                          Severity: {{ editSeverity() | number:'1.1-1' }}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.1"
                          [value]="editSeverity()"
                          (input)="onSeverityChange($event)"
                          class="w-full accent-primary"
                        />
                        <div class="flex justify-between text-xs text-gray-400 mt-1">
                          <span>Low</span>
                          <span>High</span>
                        </div>
                      </div>

                      <!-- Description -->
                      <div>
                        <label class="text-sm font-medium text-gray-700 block mb-1">
                          Description
                        </label>
                        <textarea
                          [value]="editDescription()"
                          (input)="onDescriptionChange($event)"
                          rows="3"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        ></textarea>
                      </div>

                      <!-- Evidence (only for data-backed pain points) -->
                      @if (!selectedPainPoint()?.isHypothetical && selectedPainPoint()?.dataSources?.length) {
                        <div>
                          <label class="text-sm font-medium text-gray-700 block mb-2">
                            Evidence ({{ selectedPainPoint()?.dataSources?.length }})
                          </label>
                          <div class="space-y-2 max-h-48 overflow-y-auto">
                            @for (source of selectedPainPoint()?.dataSources; track $index) {
                              <div class="p-2 bg-gray-50 rounded text-sm">
                                <span class="text-xs text-gray-400 uppercase">{{ source.sourceType }}</span>
                                <p class="text-gray-700 mt-1 italic">"{{ source.excerpt }}"</p>
                              </div>
                            }
                          </div>
                        </div>
                      }
                      <!-- Hypothesis notice for AI-generated pain points -->
                      @if (selectedPainPoint()?.isHypothetical) {
                        <div class="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div class="flex items-start gap-2">
                            <ng-icon name="lucideInfo" class="text-purple-600 flex-shrink-0 mt-0.5" size="16" />
                            <div>
                              <p class="text-sm font-medium text-purple-800">AI-Generated Hypothesis</p>
                              <p class="text-xs text-purple-600 mt-1">
                                This pain point was generated based on typical patterns for this type of journey.
                                Validate with real user research data.
                              </p>
                            </div>
                          </div>
                        </div>
                      }

                      <!-- Actions -->
                      <div class="flex gap-2 pt-4 border-t">
                        <button
                          (click)="savePainPointChanges()"
                          [disabled]="service.loading()"
                          class="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
                        >
                          Save Changes
                        </button>
                        <button
                          (click)="deletePainPoint()"
                          class="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                        >
                          <ng-icon name="lucideTrash2" size="16" />
                        </button>
                      </div>
                    </div>
                  </div>
                } @else if (selectedStage()) {
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-6">
                    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 class="font-semibold text-gray-900">Stage Details</h3>
                      <button
                        (click)="selectedStage.set(null)"
                        class="text-gray-400 hover:text-gray-600"
                      >
                        <ng-icon name="lucideX" size="18" />
                      </button>
                    </div>
                    <div class="p-4 space-y-4">
                      <div>
                        <label class="text-sm font-medium text-gray-700 block mb-1">Name</label>
                        <p class="text-gray-900">{{ selectedStage()?.name }}</p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-gray-700 block mb-1">Description</label>
                        <p class="text-gray-600 text-sm">{{ selectedStage()?.description }}</p>
                      </div>
                      @if (selectedStage()?.touchpoints?.length) {
                        <div>
                          <label class="text-sm font-medium text-gray-700 block mb-2">Touchpoints</label>
                          <div class="space-y-2">
                            @for (tp of selectedStage()?.touchpoints; track tp.id) {
                              <div class="p-2 bg-gray-50 rounded">
                                <span class="font-medium text-sm">{{ tp.name }}</span>
                                <span class="text-xs text-gray-400 ml-2">({{ tp.channel }})</span>
                                @if (tp.description) {
                                  <p class="text-xs text-gray-500 mt-1">{{ tp.description }}</p>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                      @if (getPainPointsForStage(selectedStage()?.id || '').length) {
                        <div>
                          <label class="text-sm font-medium text-gray-700 block mb-2">
                            Pain Points in this Stage
                          </label>
                          <div class="space-y-1">
                            @for (pp of getPainPointsForStage(selectedStage()?.id || ''); track pp.id) {
                              <button
                                (click)="selectPainPoint(pp)"
                                class="w-full text-left p-2 bg-red-50 rounded text-sm hover:bg-red-100 transition-colors"
                              >
                                <div class="flex items-center gap-2">
                                  <div
                                    class="w-2 h-2 rounded-full"
                                    [style.backgroundColor]="getSeverityColor(pp.severity)"
                                  ></div>
                                  <span class="truncate">{{ pp.description }}</span>
                                </div>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    <ng-icon name="lucideMessageSquare" size="32" class="mx-auto mb-2 text-gray-300" />
                    <p>Select a stage or pain point to view details</p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="flex items-center justify-center h-64 text-gray-500">
          Journey not found
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
})
export class JourneyMapperResultsComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  service = inject(JourneyMapperService);

  // State
  sessionDetail = this.service.currentSession;
  loading = this.service.loading;

  selectedStage = signal<JourneyStage | null>(null);
  selectedPainPoint = signal<JourneyPainPoint | null>(null);

  // Edit state for pain point
  editSeverity = signal<number>(5);
  editDescription = signal<string>('');

  // Helper references
  getSeverityColor = getSeverityColor;
  getEmotionColor = getEmotionColor;
  DELTA_STATUS_CONFIG = DELTA_STATUS_CONFIG;

  // Computed values
  stages = computed(() => this.sessionDetail()?.session?.stages || []);
  painPoints = computed(() => this.sessionDetail()?.painPoints || []);
  emotionCurve = computed(() => {
    const curve = this.sessionDetail()?.session?.emotionCurve;
    if (Array.isArray(curve)) {
      // Map snake_case from API to camelCase expected by component
      return curve.map((point: any) => ({
        stageId: point.stageId || point.stage_id || '',
        score: point.score ?? point.emotion_score ?? 5,
        label: point.label || point.stage || ''
      })) as EmotionCurvePoint[];
    }
    return [];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('sessionId');
    if (id) {
      this.loadSession(parseInt(id, 10));
    } else {
      this.router.navigate(['/journey-mapper']);
    }
  }

  async loadSession(sessionId: number): Promise<void> {
    try {
      await this.service.getSessionDetail(sessionId);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  getModeIcon(): string {
    const mode = this.sessionDetail()?.session?.mode;
    switch (mode) {
      case 'multi_persona':
        return 'lucideUsers';
      case 'competitive':
        return 'lucideSwords';
      default:
        return 'lucideRoute';
    }
  }

  goBack(): void {
    this.router.navigate(['/journey-mapper']);
  }

  selectStage(stage: JourneyStage): void {
    this.selectedPainPoint.set(null);
    this.selectedStage.set(stage);
  }

  selectPainPoint(pp: JourneyPainPoint): void {
    this.selectedStage.set(null);
    this.selectedPainPoint.set(pp);
    this.editSeverity.set(pp.severity);
    this.editDescription.set(pp.description);
  }

  getPainPointsForStage(stageId: string): JourneyPainPoint[] {
    return this.painPoints().filter((pp) => pp.stageId === stageId);
  }

  getStageNameById(stageId: string): string {
    const stage = this.stages().find((s) => s.id === stageId);
    return stage?.name || 'Unknown';
  }

  onSeverityChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.editSeverity.set(value);
  }

  onDescriptionChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.editDescription.set(value);
  }

  async savePainPointChanges(): Promise<void> {
    const pp = this.selectedPainPoint();
    if (!pp) return;

    try {
      await this.service.updatePainPoint(pp.id, {
        severity: this.editSeverity(),
        description: this.editDescription(),
      });
      // Refresh to get updated data
      await this.service.getSessionDetail(this.sessionDetail()?.session?.id || 0);
    } catch (err) {
      console.error('Failed to update pain point:', err);
    }
  }

  async deletePainPoint(): Promise<void> {
    const pp = this.selectedPainPoint();
    if (!pp) return;

    if (confirm('Are you sure you want to delete this pain point?')) {
      try {
        await this.service.deletePainPoint(pp.id);
        this.selectedPainPoint.set(null);
      } catch (err) {
        console.error('Failed to delete pain point:', err);
      }
    }
  }

  addStage(): void {
    const name = prompt('Enter stage name:');
    if (name) {
      const sessionId = this.sessionDetail()?.session?.id;
      if (sessionId) {
        this.service.addStage(sessionId, { name }).catch((err) => {
          console.error('Failed to add stage:', err);
        });
      }
    }
  }

  addPainPoint(): void {
    const stages = this.stages();
    if (!stages.length) {
      alert('Please add a stage first');
      return;
    }

    const stageId = this.selectedStage()?.id || stages[0].id;
    const description = prompt('Enter pain point description:');
    if (description) {
      const sessionId = this.sessionDetail()?.session?.id;
      if (sessionId) {
        this.service.addPainPoint(sessionId, { stageId, description }).catch((err) => {
          console.error('Failed to add pain point:', err);
        });
      }
    }
  }

  switchVersion(event: Event): void {
    const versionId = parseInt((event.target as HTMLSelectElement).value, 10);
    this.loadSession(versionId);
  }

  createNewVersion(): void {
    const sessionId = this.sessionDetail()?.session?.id;
    if (sessionId) {
      // For simplicity, just create a refresh version. Could show a modal for options.
      this.service.createNewVersion(sessionId, 'refresh').then((session) => {
        this.router.navigate(['/journey-mapper/processing', session.id]);
      }).catch((err) => {
        console.error('Failed to create new version:', err);
      });
    }
  }

  exportJourney(): void {
    const sessionId = this.sessionDetail()?.session?.id;
    if (sessionId) {
      this.service.exportJourney(sessionId, 'json').then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journey-map-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }).catch((err) => {
        console.error('Failed to export:', err);
      });
    }
  }

  // Generate SVG path for the emotion curve line
  getEmotionCurvePath(): string {
    const curve = this.emotionCurve();
    if (curve.length === 0) return '';

    const points = curve.map((point, i) => ({
      x: 60 + i * 120,
      y: 110 - (point.score * 10)
    }));

    // Create smooth curve using quadratic bezier curves
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + 30} ${prev.y}, ${cpX} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${curr.x - 30} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return path;
  }

  // Generate SVG path for the area fill under the curve
  getEmotionAreaPath(): string {
    const curve = this.emotionCurve();
    if (curve.length === 0) return '';

    const width = curve.length * 120;
    const points = curve.map((point, i) => ({
      x: 60 + i * 120,
      y: 110 - (point.score * 10)
    }));

    // Start from bottom-left, draw curve, then close to bottom-right
    let path = `M 0 110`;
    path += ` L ${points[0].x} 110`;
    path += ` L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + 30} ${prev.y}, ${cpX} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${curr.x - 30} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    path += ` L ${points[points.length - 1].x} 110`;
    path += ` L ${width} 110`;
    path += ` Z`;

    return path;
  }

  exportToPdf(): void {
    const detail = this.sessionDetail();
    if (!detail) return;

    const session = detail.session;
    const stages = this.stages();
    const painPoints = this.painPoints();
    const emotionCurve = this.emotionCurve();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Journey Map - ${session.journeyDescription}</title>
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
      border-bottom: 3px solid #006450;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #64748b;
    }

    .header .meta {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 12px;
      font-size: 13px;
      color: #64748b;
    }

    .header .meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }

    .stage {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .stage-header {
      background: linear-gradient(135deg, #006450 0%, #008060 100%);
      padding: 16px 20px;
      color: white;
    }

    .stage-header .tag {
      font-size: 11px;
      font-weight: 500;
      background: rgba(255,255,255,0.2);
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 8px;
    }

    .stage-header h3 {
      font-size: 18px;
      font-weight: 600;
    }

    .stage-header .description {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 4px;
    }

    .stage-content {
      padding: 16px 20px;
    }

    .stage-meta {
      display: flex;
      gap: 24px;
      font-size: 13px;
      color: #64748b;
      margin-bottom: 12px;
    }

    .stage-meta strong {
      color: #1a1a2e;
    }

    .touchpoints {
      margin-top: 12px;
    }

    .touchpoints-title {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
    }

    .touchpoint {
      display: inline-block;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      color: #475569;
      margin-right: 8px;
      margin-bottom: 6px;
    }

    .touchpoint-channel {
      color: #94a3b8;
      font-size: 11px;
    }

    .pain-point {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 12px;
      background: #fefefe;
    }

    .pain-point:last-child {
      margin-bottom: 0;
    }

    .severity-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .pain-point-content {
      flex: 1;
    }

    .pain-point-content h4 {
      font-size: 14px;
      font-weight: 500;
      color: #1a1a2e;
      margin-bottom: 4px;
    }

    .pain-point-meta {
      font-size: 12px;
      color: #64748b;
    }

    .pain-point-meta span {
      margin-right: 12px;
    }

    .hypothesis-badge {
      display: inline-block;
      background: #f3e8ff;
      color: #7c3aed;
      font-size: 10px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 8px;
    }

    .evidence {
      margin-top: 10px;
      padding: 10px;
      background: #f8fafc;
      border-radius: 6px;
      border-left: 3px solid #cbd5e1;
    }

    .evidence-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .evidence-item {
      font-size: 12px;
      color: #475569;
      font-style: italic;
      margin-bottom: 6px;
    }

    .evidence-item:last-child {
      margin-bottom: 0;
    }

    .evidence-source {
      font-size: 10px;
      color: #94a3b8;
      font-style: normal;
    }

    .emotion-curve {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .emotion-curve-title {
      font-size: 14px;
      font-weight: 600;
      color: #0369a1;
      margin-bottom: 12px;
    }

    .emotion-points {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .emotion-point {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
    }

    .emotion-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .emotion-label {
      color: #475569;
    }

    .emotion-score {
      font-weight: 600;
      color: #1a1a2e;
    }

    .summary-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #006450;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }

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
      .stage { break-inside: avoid; }
      .pain-point { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.journeyDescription}</h1>
    <div class="subtitle">${session.mode === 'multi_persona' ? 'Multi-Persona Journey Map' : session.mode === 'competitive' ? 'Competitive Journey Map' : 'Customer Journey Map'}</div>
    <div class="meta">
      <span>Version ${session.version}</span>
      <span>${session.confidenceScore ? Math.round(session.confidenceScore * 100) + '% Confidence' : ''}</span>
      <span>Generated ${new Date(session.createdAt).toLocaleDateString()}</span>
    </div>
  </div>

  <div class="summary-stats">
    <div class="stat-card">
      <div class="stat-value">${stages.length}</div>
      <div class="stat-label">Journey Stages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${painPoints.length}</div>
      <div class="stat-label">Pain Points</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${painPoints.filter(pp => pp.severity >= 7).length}</div>
      <div class="stat-label">Critical Issues</div>
    </div>
  </div>

  ${emotionCurve.length > 0 ? `
  <div class="emotion-curve">
    <div class="emotion-curve-title">Emotional Journey</div>
    <div class="emotion-points">
      ${emotionCurve.map(point => {
        const stageName = stages.find(s => s.id === point.stageId)?.name || point.label || 'Stage';
        return `
        <div class="emotion-point">
          <div class="emotion-dot" style="background-color: ${this.getEmotionColorForPdf(point.score)};"></div>
          <span class="emotion-label">${stageName}:</span>
          <span class="emotion-score">${point.score.toFixed(1)}/10</span>
        </div>
        `;
      }).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Journey Stages</h2>
    ${stages.map((stage, idx) => {
      const stagePainPoints = painPoints.filter(pp => pp.stageId === stage.id);
      return `
    <div class="stage">
      <div class="stage-header">
        <span class="tag">Stage ${idx + 1}</span>
        <h3>${stage.name}</h3>
        ${stage.description ? `<p class="description">${stage.description}</p>` : ''}
      </div>
      <div class="stage-content">
        <div class="stage-meta">
          ${stage.durationEstimate ? `<span>Duration: <strong>${stage.durationEstimate}</strong></span>` : ''}
          <span>Emotion Score: <strong>${stage.emotionScore.toFixed(1)}/10</strong></span>
          ${stagePainPoints.length > 0 ? `<span>Pain Points: <strong>${stagePainPoints.length}</strong></span>` : ''}
        </div>
        ${stage.touchpoints && stage.touchpoints.length > 0 ? `
        <div class="touchpoints">
          <div class="touchpoints-title">Touchpoints</div>
          ${stage.touchpoints.map(tp => `
            <span class="touchpoint">${tp.name} <span class="touchpoint-channel">(${tp.channel})</span></span>
          `).join('')}
        </div>
        ` : ''}
      </div>
    </div>
      `;
    }).join('')}
  </div>

  ${painPoints.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Pain Points (${painPoints.length})</h2>
    ${painPoints.map(pp => {
      const stageName = stages.find(s => s.id === pp.stageId)?.name || 'Unknown Stage';
      return `
    <div class="pain-point">
      <div class="severity-indicator" style="background-color: ${this.getSeverityColorForPdf(pp.severity)};"></div>
      <div class="pain-point-content">
        <h4>
          ${pp.description}
          ${pp.isHypothetical ? '<span class="hypothesis-badge">AI Hypothesis</span>' : ''}
        </h4>
        <div class="pain-point-meta">
          <span>Severity: <strong>${pp.severity.toFixed(1)}/10</strong></span>
          <span>Stage: <strong>${stageName}</strong></span>
          ${!pp.isHypothetical && pp.frequency > 1 ? `<span>Mentioned: <strong>${pp.frequency} times</strong></span>` : ''}
        </div>
        ${!pp.isHypothetical && pp.dataSources && pp.dataSources.length > 0 ? `
        <div class="evidence">
          <div class="evidence-title">Evidence</div>
          ${pp.dataSources.slice(0, 3).map(source => `
          <div class="evidence-item">
            "${source.excerpt}"
            <div class="evidence-source">${source.sourceType}</div>
          </div>
          `).join('')}
          ${pp.dataSources.length > 3 ? `<div class="evidence-source">+${pp.dataSources.length - 3} more sources</div>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
      `;
    }).join('')}
  </div>
  ` : ''}

  <div class="footer">
    Generated by Product Studio
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }

  private getSeverityColorForPdf(severity: number): string {
    if (severity >= 8) return '#EF4444';
    if (severity >= 6) return '#F97316';
    if (severity >= 4) return '#EAB308';
    if (severity >= 2) return '#22C55E';
    return '#3B82F6';
  }

  private getEmotionColorForPdf(score: number): string {
    if (score >= 8) return '#22C55E';
    if (score >= 6) return '#84CC16';
    if (score >= 4) return '#EAB308';
    if (score >= 2) return '#F97316';
    return '#EF4444';
  }
}
