/**
 * Journey Mapper Processing Component
 *
 * Shows progress while journey map is being generated.
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideCheckCircle,
  lucideXCircle,
  lucideRefreshCw,
  lucideArrowLeft,
  lucideRoute,
} from '@ng-icons/lucide';

import { JourneyMapperService } from './journey-mapper.service';
import { SessionStatusResponse, PROGRESS_STEPS, JourneyStatus } from './journey-mapper.types';

@Component({
  selector: 'app-journey-mapper-processing',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideLoader2,
      lucideCheckCircle,
      lucideXCircle,
      lucideRefreshCw,
      lucideArrowLeft,
      lucideRoute,
    }),
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div class="max-w-md w-full">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <!-- Icon -->
          <div class="mb-6">
            @if (status() === 'failed') {
              <div class="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <ng-icon name="lucideXCircle" class="text-red-500" size="32" />
              </div>
            } @else if (status() === 'completed') {
              <div class="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <ng-icon name="lucideCheckCircle" class="text-green-500" size="32" />
              </div>
            } @else {
              <div class="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <ng-icon name="lucideLoader2" class="text-primary animate-spin" size="32" />
              </div>
            }
          </div>

          <!-- Title -->
          <h2 class="text-xl font-semibold text-gray-900 mb-2">
            @if (status() === 'failed') {
              Generation Failed
            } @else if (status() === 'completed') {
              Journey Map Ready!
            } @else {
              Generating Journey Map
            }
          </h2>

          <!-- Message -->
          <p class="text-gray-600 mb-6">
            {{ progressMessage() || PROGRESS_STEPS[status()] || 'Processing...' }}
          </p>

          <!-- Progress Bar -->
          @if (status() !== 'failed' && status() !== 'completed') {
            <div class="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div
                class="bg-primary h-2 rounded-full transition-all duration-500"
                [style.width.%]="getProgressPercent()"
              ></div>
            </div>
          }

          <!-- Data Quality Warning -->
          @if (dataQualityWarning()) {
            <div class="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-left">
              {{ dataQualityWarning() }}
            </div>
          }

          <!-- Error Message -->
          @if (status() === 'failed' && errorMessage()) {
            <div class="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-left">
              {{ errorMessage() }}
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-3 justify-center">
            @if (status() === 'failed') {
              <button
                (click)="goBack()"
                class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <ng-icon name="lucideArrowLeft" size="18" />
                Go Back
              </button>
              <button
                (click)="retry()"
                [disabled]="service.loading()"
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                <ng-icon name="lucideRefreshCw" size="18" />
                Retry
              </button>
            } @else if (status() === 'completed') {
              <button
                (click)="viewResults()"
                class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <ng-icon name="lucideRoute" size="18" />
                View Journey Map
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class JourneyMapperProcessingComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  service = inject(JourneyMapperService);

  PROGRESS_STEPS = PROGRESS_STEPS;

  sessionId = signal<number | null>(null);
  status = signal<JourneyStatus>('pending');
  progressStep = signal(0);
  progressMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  dataQualityWarning = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('sessionId');
    if (id) {
      this.sessionId.set(parseInt(id, 10));
      this.startPolling();
    } else {
      this.router.navigate(['/journey-mapper']);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    this.pollStatus();
    this.pollInterval = setInterval(() => this.pollStatus(), 2000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async pollStatus(): Promise<void> {
    const id = this.sessionId();
    if (!id) return;

    try {
      const response: SessionStatusResponse = await this.service.pollSessionStatus(id);

      this.status.set(response.status);
      this.progressStep.set(response.progressStep);
      this.progressMessage.set(response.progressMessage || null);
      this.errorMessage.set(response.errorMessage || null);
      this.dataQualityWarning.set(response.dataQualityWarning || null);

      // Stop polling when complete or failed
      if (response.status === 'completed' || response.status === 'failed') {
        this.stopPolling();

        // Auto-navigate on completion after a short delay
        if (response.status === 'completed') {
          setTimeout(() => this.viewResults(), 1000);
        }
      }
    } catch (err) {
      console.error('Failed to poll status:', err);
    }
  }

  getProgressPercent(): number {
    const step = this.progressStep();
    // Assume 4 steps max: 1=init, 2=analyzing, 3=saving, 4=complete
    return Math.min((step / 4) * 100, 90);
  }

  goBack(): void {
    this.router.navigate(['/journey-mapper']);
  }

  async retry(): Promise<void> {
    const id = this.sessionId();
    if (!id) return;

    try {
      await this.service.retrySession(id);
      this.status.set('pending');
      this.errorMessage.set(null);
      this.startPolling();
    } catch (err) {
      console.error('Failed to retry:', err);
    }
  }

  viewResults(): void {
    const id = this.sessionId();
    if (id) {
      this.router.navigate(['/journey-mapper/results', id]);
    }
  }
}
