/**
 * Release Prep Processing Component
 *
 * Shows the progress of the release prep pipeline.
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subscription, takeWhile, switchMap, tap } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileText,
  lucideBookOpen,
  lucideAlertCircle,
  lucideCheckCircle,
  lucideLoader,
  lucideXCircle,
} from '@ng-icons/lucide';

import { ReleasePrepService } from './release-prep.service';
import type { PipelineStatusResponse } from './release-prep.types';

interface PipelineStep {
  step: number;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-release-prep-processing',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideFileText,
      lucideBookOpen,
      lucideAlertCircle,
      lucideCheckCircle,
      lucideLoader,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="max-w-2xl mx-auto p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-slate-900">
          @if (status()?.status === 'completed') {
            Release Prep Complete!
          } @else if (status()?.status === 'failed') {
            Processing Failed
          } @else {
            Generating Release Artifacts
          }
        </h1>
        <p class="mt-2 text-slate-600">
          @if (status()?.status === 'completed') {
            Your release notes, decision log, and debt inventory are ready.
          } @else if (status()?.status === 'failed') {
            {{ status()?.errorMessage || 'An error occurred during processing.' }}
          } @else {
            Please wait while we analyze your stories and generate artifacts...
          }
        </p>
      </div>

      <!-- Progress Steps -->
      <div class="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div class="space-y-4">
          @for (step of pipelineSteps; track step.step) {
            <div
              class="flex items-start gap-4"
              [class.opacity-40]="step.step > currentStep()"
            >
              <!-- Step indicator -->
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                [class.bg-green-100]="step.step < currentStep()"
                [class.text-green-600]="step.step < currentStep()"
                [class.bg-primary]="step.step === currentStep() && !isComplete() && !isFailed()"
                [class.text-white]="step.step === currentStep() && !isComplete() && !isFailed()"
                [class.bg-green-100]="step.step === currentStep() && isComplete()"
                [class.text-green-600]="step.step === currentStep() && isComplete()"
                [class.bg-red-100]="step.step === currentStep() && isFailed()"
                [class.text-red-600]="step.step === currentStep() && isFailed()"
                [class.bg-slate-100]="step.step > currentStep()"
                [class.text-slate-400]="step.step > currentStep()"
              >
                @if (step.step < currentStep() || isComplete()) {
                  <ng-icon name="lucideCheckCircle" class="h-5 w-5" />
                } @else if (step.step === currentStep() && isFailed()) {
                  <ng-icon name="lucideXCircle" class="h-5 w-5" />
                } @else if (step.step === currentStep() && !isComplete()) {
                  <div class="animate-spin">
                    <ng-icon name="lucideLoader" class="h-5 w-5" />
                  </div>
                } @else {
                  <span class="text-sm font-medium">{{ step.step }}</span>
                }
              </div>

              <!-- Step content -->
              <div class="flex-1 pt-1">
                <h3
                  class="font-medium"
                  [class.text-slate-900]="step.step <= currentStep()"
                  [class.text-slate-400]="step.step > currentStep()"
                >
                  {{ step.label }}
                </h3>
                <p
                  class="text-sm"
                  [class.text-slate-600]="step.step <= currentStep()"
                  [class.text-slate-400]="step.step > currentStep()"
                >
                  {{ step.description }}
                </p>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Current status message -->
      @if (status()?.progressMessage && !isComplete() && !isFailed()) {
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2 text-blue-700">
            <div class="animate-spin">
              <ng-icon name="lucideLoader" class="h-5 w-5" />
            </div>
            <span>{{ status()?.progressMessage }}</span>
          </div>
        </div>
      }

      <!-- Error message -->
      @if (isFailed() && status()?.errorMessage) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-start gap-2 text-red-700">
            <ng-icon name="lucideXCircle" class="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">Error</p>
              <p class="text-sm mt-1">{{ status()?.errorMessage }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Action buttons -->
      <div class="flex justify-center gap-4">
        @if (isComplete()) {
          <button
            (click)="viewResults()"
            class="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            View Results
          </button>
        } @else if (isFailed()) {
          <button
            (click)="goBack()"
            class="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Go Back
          </button>
          <button
            (click)="retry()"
            class="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        }
      </div>
    </div>
  `,
})
export class ReleasePrepProcessingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ReleasePrepService);

  private pollingSubscription?: Subscription;
  private sessionId = 0;

  readonly status = signal<PipelineStatusResponse | null>(null);

  readonly pipelineSteps: PipelineStep[] = [
    {
      step: 1,
      label: 'Extracting Stories',
      description: 'Loading and parsing story content',
      icon: 'lucideFileText',
    },
    {
      step: 2,
      label: 'Generating Release Notes',
      description: 'Creating user-facing changelog items',
      icon: 'lucideFileText',
    },
    {
      step: 3,
      label: 'Extracting Decisions',
      description: 'Identifying technical and product decisions',
      icon: 'lucideBookOpen',
    },
    {
      step: 4,
      label: 'Identifying Technical Debt',
      description: 'Finding debt items and shortcuts',
      icon: 'lucideAlertCircle',
    },
    {
      step: 5,
      label: 'Validating Quality',
      description: 'Checking completeness and clarity',
      icon: 'lucideCheckCircle',
    },
  ];

  readonly currentStep = () => this.status()?.progressStep || 0;
  readonly isComplete = () => this.status()?.status === 'completed';
  readonly isFailed = () => this.status()?.status === 'failed';

  ngOnInit(): void {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (sessionId) {
      this.sessionId = sessionId;
      this.startPolling(sessionId);
    }
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }

  private startPolling(sessionId: number): void {
    this.pollingSubscription = interval(1500)
      .pipe(
        switchMap(() => this.service.getPipelineStatus(sessionId)),
        tap((status) => this.status.set(status)),
        takeWhile(
          (status) =>
            status.status !== 'completed' && status.status !== 'failed',
          true
        )
      )
      .subscribe();
  }

  viewResults(): void {
    this.router.navigate(['/release-prep', this.sessionId, 'results']);
  }

  goBack(): void {
    this.router.navigate(['/release-prep']);
  }

  retry(): void {
    this.status.set(null);
    this.service.runPipeline(this.sessionId).subscribe({
      next: () => this.startPolling(this.sessionId),
      error: (err) => console.error('Failed to restart pipeline:', err),
    });
  }
}
