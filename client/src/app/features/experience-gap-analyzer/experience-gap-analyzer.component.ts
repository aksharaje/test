/**
 * Experience Gap Analyzer Component
 *
 * Simplified input form for creating a gap analysis session.
 * Analyzes a journey against best practices to identify improvement opportunities.
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
} from '@ng-icons/lucide';

import { ExperienceGapAnalyzerService } from './experience-gap-analyzer.service';
import {
  AvailableJourneyMap,
  CreateGapAnalysisRequest,
  GapAnalysisSession,
} from './experience-gap-analyzer.types';

@Component({
  selector: 'app-experience-gap-analyzer',
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
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Experience Gap Analyzer</h1>
          <p class="mt-1 text-muted-foreground">
            Analyze your customer journey to identify gaps and improvement opportunities.
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

          <form class="mt-6 space-y-6" (submit)="startAnalysis(); $event.preventDefault()">
            <!-- Journey Selection -->
            <div class="space-y-4">
              <h2 class="text-lg font-semibold">Select a Journey to Analyze</h2>

              @if (loadingContextSources()) {
                <div class="flex items-center justify-center py-8">
                  <ng-icon name="lucideLoader2" class="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              } @else if (journeyMaps().length === 0) {
                <div class="rounded-lg border border-dashed p-8 text-center">
                  <ng-icon name="lucideRoute" class="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p class="text-muted-foreground">
                    No completed journey maps found. Create a journey map first.
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
                <div class="space-y-2">
                  <div class="relative">
                    <select
                      [(ngModel)]="selectedJourneyId"
                      name="journeyId"
                      class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                    >
                      <option [ngValue]="null">Select a journey map...</option>
                      @for (journey of journeyMaps(); track journey.id) {
                        <option [ngValue]="journey.id">
                          {{ journey.description | slice:0:60 }}{{ journey.description.length > 60 ? '...' : '' }}
                          ({{ journey.stageCount }} stages)
                        </option>
                      }
                    </select>
                    <ng-icon name="lucideChevronDown" class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <p class="text-xs text-muted-foreground">
                    We'll analyze this journey against best practices to find improvement opportunities.
                  </p>
                </div>
              }
            </div>

            <!-- Analysis Name -->
            @if (selectedJourneyId()) {
              <div class="space-y-2">
                <label class="block text-sm font-medium">Analysis Name (Optional)</label>
                <input
                  type="text"
                  [(ngModel)]="analysisName"
                  name="analysisName"
                  placeholder="e.g., Q4 2024 CX Improvement Analysis"
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            }

            <!-- Submit Button -->
            @if (selectedJourneyId()) {
              <div class="pt-4">
                <button
                  type="submit"
                  [disabled]="submitting()"
                  class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  @if (submitting()) {
                    <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                    Starting Analysis...
                  } @else {
                    Analyze Journey
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
            <h2 class="font-semibold">Analysis History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past gap analyses
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
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your gap analyses will appear here.
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
                        {{ session.analysisName || 'Gap Analysis' }}
                      </p>
                      @if (session.overallAssessment?.totalGapsIdentified) {
                        <p class="mt-1 text-xs text-muted-foreground">
                          {{ session.overallAssessment?.totalGapsIdentified }} gaps identified
                        </p>
                      }
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry Analysis"
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
})
export class ExperienceGapAnalyzerComponent implements OnInit {
  private service = inject(ExperienceGapAnalyzerService);
  private router = inject(Router);

  // Form state
  selectedJourneyId = signal<number | null>(null);
  analysisName = signal<string>('');

  // UI state
  loadingContextSources = signal(false);
  loadingHistory = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);

  // Data
  journeyMaps = signal<AvailableJourneyMap[]>([]);
  sessions = signal<GapAnalysisSession[]>([]);

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
    } catch (err) {
      this.error.set('Failed to load available journey maps');
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

  navigateToJourneyMapper(): void {
    this.router.navigate(['/journey-mapper']);
  }

  async startAnalysis(): Promise<void> {
    const journeyId = this.selectedJourneyId();
    if (!journeyId) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      const request: CreateGapAnalysisRequest = {
        analysisType: 'best_practice',
        yourJourneyId: journeyId,
        analysisName: this.analysisName() || undefined,
      };

      const session = await this.service.createSession(request);
      this.router.navigate(['/gap-analyzer', 'processing', session.id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      this.submitting.set(false);
    }
  }

  viewSession(session: GapAnalysisSession): void {
    if (session.status === 'completed') {
      this.router.navigate(['/gap-analyzer', 'results', session.id]);
    } else if (session.status === 'failed') {
      // Stay on this page, show error
    } else {
      this.router.navigate(['/gap-analyzer', 'processing', session.id]);
    }
  }

  async retrySession(event: Event, session: GapAnalysisSession): Promise<void> {
    event.stopPropagation();

    try {
      await this.service.retrySession(session.id);
      this.router.navigate(['/gap-analyzer', 'processing', session.id]);
    } catch (err) {
      this.error.set('Failed to retry analysis');
    }
  }

  async deleteSession(event: Event, session: GapAnalysisSession): Promise<void> {
    event.stopPropagation();

    if (!confirm('Delete this analysis?')) return;

    try {
      await this.service.deleteSession(session.id);
      this.sessions.set(this.sessions().filter(s => s.id !== session.id));
    } catch (err) {
      this.error.set('Failed to delete analysis');
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
