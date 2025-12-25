import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideLoader2, lucideAlertCircle } from '@ng-icons/lucide';
import { BusinessCaseService } from './business-case.service';
import type { SessionStatusResponse } from './business-case.types';

interface ProgressStep {
  num: number;
  label: string;
  step: number;
}

@Component({
  selector: 'app-business-case-processing',
  standalone: true,
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideLoader2,
      lucideAlertCircle,
    }),
  ],
  template: `
    <div class="max-w-4xl mx-auto p-6">
      @if (sessionStatus()?.status === 'completed') {
        <div class="text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <ng-icon name="lucideCheck" class="h-8 w-8 text-green-600" />
          </div>
          <h1 class="mt-4 text-2xl font-bold text-foreground">Business Case Complete!</h1>
          <p class="mt-2 text-muted-foreground">Redirecting to results...</p>
        </div>
      } @else if (sessionStatus()?.status === 'failed') {
        <div class="text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
            <ng-icon name="lucideAlertCircle" class="h-8 w-8 text-red-600" />
          </div>
          <h1 class="mt-4 text-2xl font-bold text-foreground">Analysis Could Not Be Completed</h1>
          <p class="mt-2 text-muted-foreground max-w-md mx-auto">
            {{ getUserFriendlyError(sessionStatus()?.errorMessage) }}
          </p>
          <div class="mt-6 flex items-center justify-center gap-3">
            <button
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              (click)="goBack()"
            >
              Try Again
            </button>
            <button
              class="px-4 py-2 border rounded-lg hover:bg-muted"
              (click)="goBack()"
            >
              Go Back
            </button>
          </div>
        </div>
      } @else {
        <!-- Processing State -->
        <div class="space-y-6">
          <!-- Header -->
          <div class="text-center">
            <h1 class="text-2xl font-bold text-foreground">Building Business Case</h1>
            <p class="mt-2 text-muted-foreground">
              Our AI agents are analyzing costs, benefits, and financial projections
            </p>
          </div>

          <!-- Progress Steps -->
          <div class="mt-8 space-y-4">
            @for (step of steps; track step.num) {
              <div class="flex items-center gap-4 p-4 rounded-lg border" [class.bg-muted/50]="isCurrentStep(step)">
                <!-- Step Icon -->
                <div
                  class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  [class.bg-primary]="isStepComplete(step)"
                  [class.text-primary-foreground]="isStepComplete(step)"
                  [class.bg-primary/20]="isCurrentStep(step)"
                  [class.text-primary]="isCurrentStep(step)"
                  [class.bg-muted]="isStepPending(step)"
                  [class.text-muted-foreground]="isStepPending(step)"
                >
                  @if (isStepComplete(step)) {
                    <ng-icon name="lucideCheck" class="h-5 w-5" />
                  } @else if (isCurrentStep(step)) {
                    <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin" />
                  } @else {
                    {{ step.num }}
                  }
                </div>

                <!-- Step Content -->
                <div class="flex-1">
                  <p
                    class="font-medium"
                    [class.text-foreground]="isStepComplete(step) || isCurrentStep(step)"
                    [class.text-muted-foreground]="isStepPending(step)"
                  >
                    {{ step.label }}
                  </p>
                  @if (isCurrentStep(step) && sessionStatus()?.progressMessage) {
                    <p class="text-sm text-muted-foreground mt-1">
                      {{ sessionStatus()?.progressMessage }}
                    </p>
                  }
                </div>

                <!-- Step Status -->
                <div class="flex-shrink-0">
                  @if (isStepComplete(step)) {
                    <span class="text-xs text-green-600 font-medium">Complete</span>
                  } @else if (isCurrentStep(step)) {
                    <span class="text-xs text-primary font-medium">In Progress</span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Skeleton Cards for Preview -->
          <div class="mt-8 space-y-4">
            <p class="text-sm text-muted-foreground text-center">Preparing your business case...</p>
            <div class="grid grid-cols-3 gap-4">
              @for (item of [1, 2, 3]; track item) {
                <div class="rounded-lg border bg-card p-4 space-y-3">
                  <div class="h-4 w-2/3 bg-muted rounded animate-pulse"></div>
                  <div class="h-8 w-1/2 bg-muted rounded animate-pulse"></div>
                  <div class="h-3 w-full bg-muted rounded animate-pulse"></div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class BusinessCaseProcessingComponent implements OnInit, OnDestroy {
  private service = inject(BusinessCaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  sessionStatus = signal<SessionStatusResponse | null>(null);
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  steps: ProgressStep[] = [
    { num: 1, label: 'Analyzing business context', step: 1 },
    { num: 2, label: 'Estimating development costs', step: 2 },
    { num: 3, label: 'Projecting operational costs', step: 3 },
    { num: 4, label: 'Estimating benefits', step: 4 },
    { num: 5, label: 'Calculating financial metrics', step: 5 },
    { num: 6, label: 'Complete', step: 6 },
  ];

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (!sessionId) {
      this.router.navigate(['/business-case']);
      return;
    }

    // Initial poll
    await this.poll(sessionId);

    // Set up polling interval
    this.pollInterval = setInterval(() => this.poll(sessionId), 3000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async poll(sessionId: number) {
    const status = await this.service.pollSessionStatus(sessionId);
    if (!status) return;

    this.sessionStatus.set(status);

    if (status.status === 'completed') {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      setTimeout(() => {
        this.router.navigate(['/business-case/results', sessionId]);
      }, 1500);
    } else if (status.status === 'failed') {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
    }
  }

  isStepComplete(step: ProgressStep): boolean {
    const currentStep = this.sessionStatus()?.progressStep || 0;
    return currentStep > step.step;
  }

  isCurrentStep(step: ProgressStep): boolean {
    const currentStep = this.sessionStatus()?.progressStep || 0;
    return currentStep === step.step;
  }

  isStepPending(step: ProgressStep): boolean {
    return !this.isStepComplete(step) && !this.isCurrentStep(step);
  }

  goBack() {
    this.router.navigate(['/business-case']);
  }

  getUserFriendlyError(errorMessage: string | null | undefined): string {
    if (!errorMessage) {
      return 'An unexpected error occurred while analyzing your business case. Please try again.';
    }

    // Map technical errors to user-friendly messages
    const errorLower = errorMessage.toLowerCase();

    if (errorLower.includes('llm') || errorLower.includes('json') || errorLower.includes('parse')) {
      return 'Our AI service encountered a temporary issue. Please try again in a moment.';
    }

    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'The analysis took longer than expected. Please try again with a simpler description.';
    }

    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return 'Unable to connect to our analysis service. Please check your connection and try again.';
    }

    if (errorLower.includes('session not found')) {
      return 'This analysis session could not be found. Please start a new analysis.';
    }

    if (errorLower.includes('feasibility')) {
      return 'There was an issue linking to the feasibility analysis. Please try again or create a new analysis.';
    }

    // Default user-friendly message
    return 'An error occurred during analysis. Please try again or contact support if the issue persists.';
  }
}
