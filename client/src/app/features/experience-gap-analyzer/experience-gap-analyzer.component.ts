/**
 * Experience Gap Analyzer Component
 *
 * Input form for creating a new gap analysis session.
 * Users select journeys to compare and configure analysis parameters.
 */
import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSwords,
  lucideTarget,
  lucideClock,
  lucideArrowRight,
  lucideLoader2,
  lucideAlertCircle,
  lucideChevronDown,
  lucideCheck,
  lucideRoute,
} from '@ng-icons/lucide';

import { ExperienceGapAnalyzerService } from './experience-gap-analyzer.service';
import {
  AnalysisType,
  AvailableJourneyMap,
  ANALYSIS_TYPE_CONFIGS,
  CreateGapAnalysisRequest,
} from './experience-gap-analyzer.types';

@Component({
  selector: 'app-experience-gap-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideSwords,
      lucideTarget,
      lucideClock,
      lucideArrowRight,
      lucideLoader2,
      lucideAlertCircle,
      lucideChevronDown,
      lucideCheck,
      lucideRoute,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background p-6 lg:p-8">
      <div class="max-w-4xl mx-auto space-y-8">

        <!-- Header -->
        <div class="text-center">
          <h1 class="text-3xl font-bold tracking-tight text-foreground">Experience Gap Analyzer</h1>
          <p class="mt-2 text-muted-foreground max-w-2xl mx-auto">
            Compare customer journeys to identify gaps and generate a prioritized improvement roadmap.
          </p>
        </div>

        <!-- Error Alert -->
        @if (error()) {
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div class="flex items-center gap-2 text-destructive">
              <ng-icon name="lucideAlertCircle" class="h-4 w-4" />
              <span class="font-medium">{{ error() }}</span>
            </div>
          </div>
        }

        <!-- Analysis Type Selection -->
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">1. Choose Analysis Type</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            @for (config of analysisTypes; track config.type) {
              <button
                type="button"
                (click)="selectAnalysisType(config.type)"
                [class.ring-2]="selectedAnalysisType() === config.type"
                [class.ring-primary]="selectedAnalysisType() === config.type"
                class="relative rounded-xl border bg-card p-5 text-left transition-all hover:bg-muted/50"
              >
                <div class="flex items-start gap-3">
                  <div class="rounded-lg bg-primary/10 p-2">
                    <ng-icon [name]="config.icon" class="h-5 w-5 text-primary" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-sm">{{ config.title }}</h3>
                    <p class="text-xs text-muted-foreground mt-1">{{ config.description }}</p>
                  </div>
                </div>
                @if (selectedAnalysisType() === config.type) {
                  <div class="absolute top-2 right-2">
                    <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
                  </div>
                }
              </button>
            }
          </div>
        </div>

        <!-- Journey Selection -->
        @if (selectedAnalysisType()) {
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">2. Select Journeys to Compare</h2>

            <!-- Loading state -->
            @if (loadingContextSources()) {
              <div class="flex items-center justify-center py-8">
                <ng-icon name="lucideLoader2" class="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            } @else if (journeyMaps().length === 0) {
              <div class="rounded-lg border border-dashed p-8 text-center">
                <ng-icon name="lucideRoute" class="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p class="text-muted-foreground">
                  No completed journey maps found. Create journey maps first before running gap analysis.
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
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Your Journey -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium">Your Journey</label>
                  <div class="relative">
                    <select
                      [(ngModel)]="yourJourneyId"
                      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
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
                  <p class="text-xs text-muted-foreground">The journey you want to improve</p>
                </div>

                <!-- Comparison Journey -->
                @if (requiresComparison()) {
                  <div class="space-y-2">
                    <label class="block text-sm font-medium">Comparison Journey</label>
                    <div class="relative">
                      <select
                        [(ngModel)]="comparisonJourneyId"
                        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                      >
                        <option [ngValue]="null">Select a comparison journey...</option>
                        @for (journey of comparisonJourneyOptions(); track journey.id) {
                          <option [ngValue]="journey.id">
                            {{ journey.description | slice:0:60 }}{{ journey.description.length > 60 ? '...' : '' }}
                            @if (journey.competitorName) {
                              ({{ journey.competitorName }})
                            } @else {
                              ({{ journey.stageCount }} stages)
                            }
                          </option>
                        }
                      </select>
                      <ng-icon name="lucideChevronDown" class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p class="text-xs text-muted-foreground">
                      @if (selectedAnalysisType() === 'competitive') {
                        A competitor's journey to compare against
                      } @else if (selectedAnalysisType() === 'temporal') {
                        A previous version of the same journey
                      } @else {
                        An industry benchmark or best practice journey
                      }
                    </p>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Analysis Name (Optional) -->
        @if (yourJourneyId()) {
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">3. Analysis Details</h2>
            <div class="space-y-2">
              <label class="block text-sm font-medium">Analysis Name (Optional)</label>
              <input
                type="text"
                [(ngModel)]="analysisName"
                placeholder="e.g., Q4 2024 Competitive Analysis"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p class="text-xs text-muted-foreground">Give this analysis a descriptive name for easy reference</p>
            </div>
          </div>
        }

        <!-- Submit Button -->
        @if (canSubmit()) {
          <div class="flex justify-end pt-4">
            <button
              type="button"
              (click)="startAnalysis()"
              [disabled]="submitting()"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              @if (submitting()) {
                <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                Starting Analysis...
              } @else {
                Start Gap Analysis
                <ng-icon name="lucideArrowRight" class="h-4 w-4" />
              }
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ExperienceGapAnalyzerComponent implements OnInit {
  private service = inject(ExperienceGapAnalyzerService);
  private router = inject(Router);

  // Configuration
  analysisTypes = ANALYSIS_TYPE_CONFIGS;

  // Form state
  selectedAnalysisType = signal<AnalysisType | null>(null);
  yourJourneyId = signal<number | null>(null);
  comparisonJourneyId = signal<number | null>(null);
  analysisName = signal<string>('');

  // UI state
  loadingContextSources = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);

  // Context sources
  journeyMaps = signal<AvailableJourneyMap[]>([]);

  // Computed
  requiresComparison = computed(() => {
    const type = this.selectedAnalysisType();
    if (!type) return false;
    const config = this.analysisTypes.find(c => c.type === type);
    return config?.requiresComparison ?? false;
  });

  comparisonJourneyOptions = computed(() => {
    const yourId = this.yourJourneyId();
    return this.journeyMaps().filter(j => j.id !== yourId);
  });

  canSubmit = computed(() => {
    const type = this.selectedAnalysisType();
    const yourId = this.yourJourneyId();
    const compId = this.comparisonJourneyId();

    if (!type || !yourId) return false;
    if (this.requiresComparison() && !compId) return false;
    return true;
  });

  ngOnInit(): void {
    this.loadContextSources();
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

  selectAnalysisType(type: AnalysisType): void {
    this.selectedAnalysisType.set(type);
    // Reset comparison if not required
    if (!this.requiresComparison()) {
      this.comparisonJourneyId.set(null);
    }
  }

  navigateToJourneyMapper(): void {
    this.router.navigate(['/journey-mapper']);
  }

  async startAnalysis(): Promise<void> {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      const request: CreateGapAnalysisRequest = {
        analysisType: this.selectedAnalysisType()!,
        yourJourneyId: this.yourJourneyId()!,
        comparisonJourneyId: this.comparisonJourneyId() ?? undefined,
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
}
