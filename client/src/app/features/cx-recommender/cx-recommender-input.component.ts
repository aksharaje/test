/**
 * CX Improvement Recommender Input Component
 *
 * Input form for creating recommendation sessions.
 * Allows selecting journey maps, gap analyses, and configuration options.
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideLoader2,
  lucideAlertCircle,
  lucideChevronDown,
  lucideRoute,
  lucideHistory,
  lucideTrash2,
  lucideRotateCw,
  lucideCheckCircle,
  lucideXCircle,
  lucideClock,
  lucideLightbulb,
  lucideCheck,
  lucideTarget,
  lucideZap,
} from '@ng-icons/lucide';

import { CxRecommenderService } from './cx-recommender.service';
import {
  AvailableJourneyMap,
  AvailableGapAnalysis,
  CreateSessionRequest,
  RecommenderSession,
} from './cx-recommender.types';

@Component({
  selector: 'app-cx-recommender-input',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideArrowRight,
      lucideLoader2,
      lucideAlertCircle,
      lucideChevronDown,
      lucideRoute,
      lucideHistory,
      lucideTrash2,
      lucideRotateCw,
      lucideCheckCircle,
      lucideXCircle,
      lucideClock,
      lucideLightbulb,
      lucideCheck,
      lucideTarget,
      lucideZap,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">CX Improvement Recommender</h1>
          <p class="mt-1 text-muted-foreground">
            Generate prioritized improvement recommendations from your journey maps and gap analyses.
          </p>

          <!-- Error Alert -->
          @if (error()) {
            <div class="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div class="flex items-center gap-2 text-destructive">
                <ng-icon name="lucideAlertCircle" class="h-4 w-4" />
                <span class="font-medium">{{ error() }}</span>
              </div>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="startGeneration(); $event.preventDefault()">
            <!-- Journey Map Selection -->
            <div class="space-y-4">
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <ng-icon name="lucideRoute" class="h-5 w-5 text-primary" />
                Select Journey Maps
              </h2>

              @if (loadingContextSources()) {
                <div class="flex items-center justify-center py-8">
                  <ng-icon name="lucideLoader2" class="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              } @else if (journeyMaps().length === 0) {
                <div class="rounded-lg border border-dashed p-6 text-center">
                  <ng-icon name="lucideRoute" class="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p class="text-muted-foreground">
                    No completed journey maps found. Create one first.
                  </p>
                  <button
                    type="button"
                    (click)="navigateToJourneyMapper()"
                    class="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    Go to Journey Mapper
                    <ng-icon name="lucideArrowRight" class="h-4 w-4" />
                  </button>
                </div>
              } @else {
                <div class="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  @for (jm of journeyMaps(); track jm.id) {
                    <label
                      class="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      [class.bg-primary/10]="selectedJourneyMapIds().includes(jm.id)"
                    >
                      <input
                        type="checkbox"
                        [checked]="selectedJourneyMapIds().includes(jm.id)"
                        (change)="toggleJourneyMap(jm.id)"
                        class="mt-1 h-4 w-4 rounded border-input"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-foreground line-clamp-1">
                          {{ jm.journeyDescription }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {{ jm.stageCount }} stages, {{ jm.painPointCount }} pain points
                        </p>
                      </div>
                    </label>
                  }
                </div>
                <p class="text-xs text-muted-foreground">
                  Select one or more journey maps to extract pain points from.
                </p>
              }
            </div>

            <!-- Gap Analysis Selection (Optional) -->
            @if (gapAnalyses().length > 0) {
              <div class="space-y-4">
                <h2 class="text-lg font-semibold flex items-center gap-2">
                  <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                  Select Gap Analyses (Optional)
                </h2>

                <div class="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  @for (ga of gapAnalyses(); track ga.id) {
                    <label
                      class="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      [class.bg-primary/10]="selectedGapAnalysisIds().includes(ga.id)"
                    >
                      <input
                        type="checkbox"
                        [checked]="selectedGapAnalysisIds().includes(ga.id)"
                        (change)="toggleGapAnalysis(ga.id)"
                        class="mt-1 h-4 w-4 rounded border-input"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-foreground line-clamp-1">
                          {{ ga.analysisName || 'Gap Analysis' }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {{ ga.gapCount }} gaps identified
                        </p>
                      </div>
                    </label>
                  }
                </div>
                <p class="text-xs text-muted-foreground">
                  Optionally include competitive gaps to inform recommendations.
                </p>
              </div>
            }

            <!-- Configuration Options -->
            @if (selectedJourneyMapIds().length > 0 || selectedGapAnalysisIds().length > 0) {
              <div class="space-y-4">
                <h2 class="text-lg font-semibold">Configuration</h2>

                <!-- Session Name -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium">Session Name (Optional)</label>
                  <input
                    type="text"
                    [(ngModel)]="sessionName"
                    name="sessionName"
                    placeholder="e.g., Q1 2025 CX Improvements"
                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <!-- Recommendation Type -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium">Recommendation Focus</label>
                  <div class="grid grid-cols-2 gap-2">
                    @for (type of recommendationTypes; track type.value) {
                      <button
                        type="button"
                        (click)="recommendationType.set(type.value)"
                        class="flex items-center gap-2 p-3 rounded-lg border text-left transition-colors"
                        [class.border-primary]="recommendationType() === type.value"
                        [class.bg-primary/10]="recommendationType() === type.value"
                      >
                        <ng-icon [name]="type.icon" class="h-4 w-4" [class.text-primary]="recommendationType() === type.value" />
                        <div>
                          <p class="text-sm font-medium">{{ type.label }}</p>
                          <p class="text-xs text-muted-foreground">{{ type.description }}</p>
                        </div>
                      </button>
                    }
                  </div>
                </div>

                <!-- Timeline -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium">Timeline Constraint</label>
                  <div class="relative">
                    <select
                      [(ngModel)]="timeline"
                      name="timeline"
                      class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                    >
                      <option value="flexible">Flexible (No Constraint)</option>
                      <option value="Q1 2025">Q1 2025 (~12 weeks)</option>
                      <option value="Q2 2025">Q2 2025 (~24 weeks)</option>
                      <option value="H1 2025">H1 2025 (~26 weeks)</option>
                      <option value="H2 2025">H2 2025 (~52 weeks)</option>
                    </select>
                    <ng-icon name="lucideChevronDown" class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <!-- Team Capacity -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium">Team Capacity (Optional)</label>
                  <input
                    type="text"
                    [(ngModel)]="teamCapacity"
                    name="teamCapacity"
                    placeholder="e.g., 2 designers, 3 engineers"
                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            }

            <!-- Submit Button -->
            @if (selectedJourneyMapIds().length > 0 || selectedGapAnalysisIds().length > 0) {
              <div class="pt-4">
                <button
                  type="submit"
                  [disabled]="submitting()"
                  class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  @if (submitting()) {
                    <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                    Starting Generation...
                  } @else {
                    Generate Recommendations
                    <ng-icon name="lucideArrowRight" class="h-4 w-4" />
                  }
                </button>
              </div>
            }
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Session History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past recommendation sessions
          </p>
        </div>

        <div class="flex-1 overflow-y-auto">
          @if (loadingHistory() && sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3]; track i) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="h-4 bg-muted rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideLightbulb" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No sessions yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your recommendation sessions will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        @if (session.status === 'completed') {
                          <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-green-600" />
                        } @else if (session.status === 'failed') {
                          <ng-icon name="lucideXCircle" class="h-4 w-4 text-red-600" />
                        } @else {
                          <ng-icon name="lucideClock" class="h-4 w-4 text-yellow-600" />
                        }
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-foreground line-clamp-2">
                        {{ session.sessionName || 'Recommendation Session' }}
                      </p>
                      @if (session.status === 'completed') {
                        <p class="mt-1 text-xs text-muted-foreground">
                          {{ session.totalRecommendations }} recommendations
                          ({{ session.quickWinsCount }} quick wins)
                        </p>
                      }
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry"
                        >
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        (click)="deleteSession($event, session)"
                        title="Delete"
                      >
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class CxRecommenderInputComponent implements OnInit {
  private service = inject(CxRecommenderService);
  private router = inject(Router);

  // Form state
  selectedJourneyMapIds = signal<number[]>([]);
  selectedGapAnalysisIds = signal<number[]>([]);
  sessionName = signal<string>('');
  recommendationType = signal<string>('comprehensive');
  timeline = signal<string>('flexible');
  teamCapacity = signal<string>('');

  // UI state
  loadingContextSources = signal(false);
  loadingHistory = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);

  // Data
  journeyMaps = signal<AvailableJourneyMap[]>([]);
  gapAnalyses = signal<AvailableGapAnalysis[]>([]);
  sessions = signal<RecommenderSession[]>([]);

  // Configuration options
  recommendationTypes = [
    {
      value: 'comprehensive',
      label: 'Comprehensive',
      description: 'All recommendations',
      icon: 'lucideLightbulb',
    },
    {
      value: 'quick_wins',
      label: 'Quick Wins',
      description: 'High impact, low effort',
      icon: 'lucideZap',
    },
    {
      value: 'strategic',
      label: 'Strategic',
      description: 'Long-term improvements',
      icon: 'lucideTarget',
    },
    {
      value: 'parity',
      label: 'Parity',
      description: 'Close competitive gaps',
      icon: 'lucideCheck',
    },
  ];

  ngOnInit(): void {
    this.loadContextSources();
    this.loadHistory();
  }

  async loadContextSources(): Promise<void> {
    this.loadingContextSources.set(true);
    this.error.set(null);

    try {
      const sources = await this.service.loadContextSources();
      this.journeyMaps.set(sources.journeyMaps);
      this.gapAnalyses.set(sources.gapAnalyses);
    } catch (err) {
      this.error.set('Failed to load available sources');
    } finally {
      this.loadingContextSources.set(false);
    }
  }

  async loadHistory(): Promise<void> {
    this.loadingHistory.set(true);

    try {
      const sessions = await this.service.listSessions(undefined, true);
      this.sessions.set(sessions);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      this.loadingHistory.set(false);
    }
  }

  toggleJourneyMap(id: number): void {
    const current = this.selectedJourneyMapIds();
    if (current.includes(id)) {
      this.selectedJourneyMapIds.set(current.filter(x => x !== id));
    } else {
      this.selectedJourneyMapIds.set([...current, id]);
    }
  }

  toggleGapAnalysis(id: number): void {
    const current = this.selectedGapAnalysisIds();
    if (current.includes(id)) {
      this.selectedGapAnalysisIds.set(current.filter(x => x !== id));
    } else {
      this.selectedGapAnalysisIds.set([...current, id]);
    }
  }

  navigateToJourneyMapper(): void {
    this.router.navigate(['/journey-mapper']);
  }

  async startGeneration(): Promise<void> {
    const journeyMapIds = this.selectedJourneyMapIds();
    const gapAnalysisIds = this.selectedGapAnalysisIds();

    if (journeyMapIds.length === 0 && gapAnalysisIds.length === 0) {
      this.error.set('Please select at least one journey map or gap analysis');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    try {
      const request: CreateSessionRequest = {
        journeyMapIds,
        gapAnalysisIds: gapAnalysisIds.length > 0 ? gapAnalysisIds : undefined,
        sessionName: this.sessionName() || undefined,
        recommendationType: this.recommendationType(),
        timeline: this.timeline(),
        teamCapacity: this.teamCapacity() || undefined,
      };

      const session = await this.service.createSession(request);
      this.router.navigate(['/cx-recommender', 'processing', session.id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      this.submitting.set(false);
    }
  }

  viewSession(session: RecommenderSession): void {
    if (session.status === 'completed') {
      this.router.navigate(['/cx-recommender', 'results', session.id]);
    } else if (session.status === 'failed') {
      // Stay on this page
    } else {
      this.router.navigate(['/cx-recommender', 'processing', session.id]);
    }
  }

  async retrySession(event: Event, session: RecommenderSession): Promise<void> {
    event.stopPropagation();

    try {
      await this.service.retrySession(session.id);
      this.router.navigate(['/cx-recommender', 'processing', session.id]);
    } catch (err) {
      this.error.set('Failed to retry session');
    }
  }

  async deleteSession(event: Event, session: RecommenderSession): Promise<void> {
    event.stopPropagation();

    if (!confirm('Delete this session?')) return;

    try {
      await this.service.deleteSession(session.id);
      this.sessions.set(this.sessions().filter(s => s.id !== session.id));
    } catch (err) {
      this.error.set('Failed to delete session');
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
