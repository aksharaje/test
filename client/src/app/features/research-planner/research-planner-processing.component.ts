/**
 * Research Planner Processing Component
 *
 * Shows processing status with polling while methods are being recommended.
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { ResearchPlannerService } from './research-planner.service';
import { PROGRESS_STEPS } from './research-planner.types';

@Component({
  selector: 'app-research-planner-processing',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideRefreshCw,
    }),
  ],
  template: `
    <div class="container mx-auto max-w-2xl px-4 py-16">
      <div class="rounded-lg border border-border bg-card p-8 text-center">
        <!-- Status Icon -->
        <div class="mb-6 flex justify-center">
          @if (status() === 'failed') {
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            >
              <ng-icon name="lucideAlertCircle" size="32" />
            </div>
          } @else if (status() === 'selecting' || status() === 'completed') {
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"
            >
              <ng-icon name="lucideCheckCircle" size="32" />
            </div>
          } @else {
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <ng-icon name="lucideLoader2" size="32" class="animate-spin" />
            </div>
          }
        </div>

        <!-- Status Text -->
        <h2 class="mb-2 text-xl font-semibold text-foreground">
          @if (status() === 'failed') {
            Analysis Failed
          } @else if (status() === 'selecting') {
            Methods Recommended
          } @else if (status() === 'completed') {
            Research Plan Complete
          } @else {
            Analyzing Your Research Objective
          }
        </h2>

        <p class="text-muted-foreground">
          {{ progressMessage() || getStatusDescription(status()) }}
        </p>

        <!-- Progress Steps -->
        @if (status() !== 'failed') {
          <div class="mt-8 flex justify-center">
            <div class="flex items-center gap-2">
              @for (step of progressSteps; track step.id) {
                <div class="flex items-center">
                  <div
                    [class]="getStepClass(step.id)"
                    class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium"
                  >
                    @if (progressStep() > step.id) {
                      <ng-icon name="lucideCheckCircle" size="16" />
                    } @else {
                      {{ step.id }}
                    }
                  </div>
                  @if (!$last) {
                    <div
                      [class]="progressStep() > step.id ? 'bg-primary' : 'bg-muted'"
                      class="h-0.5 w-8"
                    ></div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="mt-4 text-sm text-muted-foreground">
            @for (step of progressSteps; track step.id) {
              @if (progressStep() === step.id) {
                {{ step.label }}
              }
            }
          </div>
        }

        <!-- Error Message -->
        @if (errorMessage()) {
          <div
            class="mt-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {{ errorMessage() }}
          </div>
        }

        <!-- Actions -->
        <div class="mt-8 flex justify-center gap-4">
          @if (status() === 'failed') {
            <button
              (click)="retry()"
              [disabled]="isRetrying()"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              @if (isRetrying()) {
                <ng-icon name="lucideLoader2" size="16" class="animate-spin" />
                Retrying...
              } @else {
                <ng-icon name="lucideRefreshCw" size="16" />
                Retry Analysis
              }
            </button>
            <button
              (click)="goBack()"
              class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Start Over
            </button>
          } @else if (status() === 'selecting' || status() === 'completed') {
            <button
              (click)="viewResults()"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              @if (status() === 'selecting') {
                Select Methods
              } @else {
                View Results
              }
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class ResearchPlannerProcessingComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private service = inject(ResearchPlannerService);

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: number | null = null;

  status = signal<string>('pending');
  progressStep = signal(0);
  progressMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  isRetrying = signal(false);

  progressSteps = [
    { id: 1, label: 'Analyzing objective' },
    { id: 2, label: 'Methods recommended' },
  ];

  ngOnInit(): void {
    const sessionIdParam = this.route.snapshot.paramMap.get('sessionId');
    if (sessionIdParam) {
      this.sessionId = parseInt(sessionIdParam, 10);
      this.startPolling();
    } else {
      this.router.navigate(['/research-planner']);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (!this.sessionId) return;

    // Initial poll
    this.pollStatus();

    // Poll every 3 seconds
    this.pollInterval = setInterval(() => this.pollStatus(), 3000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async pollStatus(): Promise<void> {
    if (!this.sessionId) return;

    try {
      const response = await this.service.pollSessionStatus(this.sessionId);

      this.status.set(response.status);
      this.progressStep.set(response.progressStep);
      this.progressMessage.set(response.progressMessage || null);
      this.errorMessage.set(response.errorMessage || null);

      // Stop polling on terminal states
      if (
        response.status === 'selecting' ||
        response.status === 'completed' ||
        response.status === 'failed'
      ) {
        this.stopPolling();
      }
    } catch (err) {
      console.error('Error polling status:', err);
      // Don't stop polling on transient errors
    }
  }

  getStatusDescription(status: string): string {
    return PROGRESS_STEPS[status] || 'Processing...';
  }

  getStepClass(stepId: number): string {
    if (this.progressStep() > stepId) {
      return 'bg-primary text-primary-foreground';
    } else if (this.progressStep() === stepId) {
      return 'bg-primary/20 text-primary border-2 border-primary';
    }
    return 'bg-muted text-muted-foreground';
  }

  async retry(): Promise<void> {
    if (!this.sessionId) return;

    this.isRetrying.set(true);
    this.errorMessage.set(null);

    try {
      await this.service.retrySession(this.sessionId);
      this.status.set('pending');
      this.progressStep.set(0);
      this.startPolling();
    } catch (err) {
      this.errorMessage.set('Failed to retry. Please try again.');
    } finally {
      this.isRetrying.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/research-planner']);
  }

  viewResults(): void {
    if (this.sessionId) {
      this.router.navigate(['/research-planner/results', this.sessionId]);
    }
  }
}
