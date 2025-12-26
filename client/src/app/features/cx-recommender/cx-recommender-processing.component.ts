/**
 * CX Improvement Recommender Processing Component
 *
 * Shows progress while the AI generates recommendations.
 * Polls for status updates and redirects to results when complete.
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideAlertCircle,
  lucideArrowLeft,
  lucideRefreshCw,
  lucideCheckCircle,
  lucideDatabase,
  lucideGitMerge,
  lucideLightbulb,
  lucideCalculator,
  lucideListOrdered,
  lucideCalendar,
} from '@ng-icons/lucide';

import { CxRecommenderService } from './cx-recommender.service';
import { SessionStatusResponse } from './cx-recommender.types';

const PROGRESS_MESSAGES: Record<number, string> = {
  0: 'Initializing...',
  1: 'Extracting pain points and gaps...',
  2: 'Clustering related issues...',
  3: 'Generating improvement recommendations...',
  4: 'Scoring impact and effort...',
  5: 'Applying constraints and categorizing...',
  6: 'Creating sprint plan suggestion...',
};

@Component({
  selector: 'app-cx-recommender-processing',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideAlertCircle,
      lucideArrowLeft,
      lucideRefreshCw,
      lucideCheckCircle,
      lucideDatabase,
      lucideGitMerge,
      lucideLightbulb,
      lucideCalculator,
      lucideListOrdered,
      lucideCalendar,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background flex items-center justify-center p-6">
      <div class="w-full max-w-lg space-y-8">

        <!-- Header -->
        <div class="text-center">
          <h1 class="text-2xl font-bold tracking-tight text-foreground">Generating Recommendations</h1>
          <p class="mt-2 text-muted-foreground">
            Our AI is analyzing your pain points and gaps to create prioritized improvement recommendations.
          </p>
        </div>

        <!-- Progress Card -->
        <div class="rounded-xl border bg-card p-8 space-y-6">

          <!-- Status Icon -->
          <div class="flex justify-center">
            @if (status()?.status === 'failed') {
              <div class="rounded-full bg-destructive/10 p-4">
                <ng-icon name="lucideAlertCircle" class="h-10 w-10 text-destructive" />
              </div>
            } @else if (status()?.status === 'completed') {
              <div class="rounded-full bg-green-100 p-4">
                <ng-icon name="lucideCheckCircle" class="h-10 w-10 text-green-600" />
              </div>
            } @else {
              <div class="rounded-full bg-primary/10 p-4">
                <ng-icon name="lucideLoader2" class="h-10 w-10 text-primary animate-spin" />
              </div>
            }
          </div>

          <!-- Progress Message -->
          <div class="text-center space-y-2">
            <p class="font-medium text-foreground">
              {{ progressMessage() }}
            </p>
            @if (status()?.status === 'failed' && status()?.errorMessage) {
              <p class="text-sm text-destructive">{{ status()?.errorMessage }}</p>
            }
          </div>

          <!-- Progress Steps -->
          @if (status()?.status !== 'failed') {
            <div class="space-y-3">
              @for (step of progressStepsList; track step.index; let i = $index) {
                <div class="flex items-center gap-3">
                  <div
                    [class]="getStepIconClass(step.index)"
                    class="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  >
                    @if ((status()?.progressStep ?? 0) > step.index) {
                      <ng-icon name="lucideCheckCircle" class="h-4 w-4" />
                    } @else if ((status()?.progressStep ?? 0) === step.index) {
                      <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                    } @else {
                      <ng-icon [name]="step.icon" class="h-4 w-4" />
                    }
                  </div>
                  <span [class.text-foreground]="(status()?.progressStep ?? 0) >= step.index"
                        [class.text-muted-foreground]="(status()?.progressStep ?? 0) < step.index"
                        [class.font-medium]="(status()?.progressStep ?? 0) === step.index"
                        class="text-sm">
                    {{ step.label }}
                  </span>
                </div>
              }
            </div>
          }

          <!-- Actions -->
          <div class="flex justify-center gap-3 pt-4">
            @if (status()?.status === 'failed') {
              <button
                type="button"
                (click)="retry()"
                [disabled]="retrying()"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                @if (retrying()) {
                  <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                  Retrying...
                } @else {
                  <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
                  Retry
                }
              </button>
              <button
                type="button"
                (click)="goBack()"
                class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
                Start Over
              </button>
            }
          </div>
        </div>

        <!-- Tip -->
        @if (status()?.status !== 'failed') {
          <p class="text-center text-xs text-muted-foreground">
            This usually takes 1-2 minutes depending on the number of inputs.
          </p>
        }
      </div>
    </div>
  `,
})
export class CxRecommenderProcessingComponent implements OnInit, OnDestroy {
  private service = inject(CxRecommenderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  status = signal<SessionStatusResponse | null>(null);
  retrying = signal(false);

  // Polling
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: number | null = null;

  // Progress steps configuration
  progressStepsList = [
    { index: 1, label: 'Extracting pain points and gaps', icon: 'lucideDatabase' },
    { index: 2, label: 'Clustering related issues', icon: 'lucideGitMerge' },
    { index: 3, label: 'Generating recommendations', icon: 'lucideLightbulb' },
    { index: 4, label: 'Scoring impact and effort', icon: 'lucideCalculator' },
    { index: 5, label: 'Categorizing and prioritizing', icon: 'lucideListOrdered' },
    { index: 6, label: 'Creating sprint plan', icon: 'lucideCalendar' },
  ];

  progressMessage = () => {
    const step = this.status()?.progressStep ?? 0;
    return this.status()?.progressMessage || PROGRESS_MESSAGES[step] || 'Processing...';
  };

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.sessionId = idParam ? parseInt(idParam, 10) : null;

    if (this.sessionId) {
      this.startPolling();
    } else {
      this.router.navigate(['/cx-recommender']);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (!this.sessionId) return;

    // Initial fetch
    this.fetchStatus();

    // Poll every 2 seconds
    this.pollingInterval = setInterval(() => {
      this.fetchStatus();
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async fetchStatus(): Promise<void> {
    if (!this.sessionId) return;

    try {
      const status = await this.service.getSessionStatus(this.sessionId);
      this.status.set(status);

      if (status.status === 'completed') {
        this.stopPolling();
        this.router.navigate(['/cx-recommender', 'results', this.sessionId]);
      } else if (status.status === 'failed') {
        this.stopPolling();
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }

  getStepIconClass(stepIndex: number): string {
    const currentStep = this.status()?.progressStep ?? 0;

    if (currentStep > stepIndex) {
      return 'bg-green-100 text-green-600';
    } else if (currentStep === stepIndex) {
      return 'bg-primary/10 text-primary';
    } else {
      return 'bg-muted text-muted-foreground';
    }
  }

  async retry(): Promise<void> {
    if (!this.sessionId) return;

    this.retrying.set(true);

    try {
      await this.service.retrySession(this.sessionId);
      this.status.set({
        id: this.sessionId,
        status: 'pending',
        progressStep: 0,
        progressMessage: 'Retrying...',
      });
      this.startPolling();
    } catch (err) {
      console.error('Failed to retry:', err);
    } finally {
      this.retrying.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/cx-recommender']);
  }
}
