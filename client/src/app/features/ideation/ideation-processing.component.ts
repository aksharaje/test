import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IdeationService } from './ideation.service';
import type { IdeationSession } from './ideation.types';

@Component({
  selector: 'app-ideation-processing',
  standalone: true,
  template: `
    <div class="max-w-4xl mx-auto p-6">
      @if (session()?.status === 'completed') {
        <div class="text-center">
          <div class="text-6xl">✅</div>
          <h1 class="mt-4 text-2xl font-bold text-foreground">Ideas Generated!</h1>
          <p class="mt-2 text-muted-foreground">Redirecting to results...</p>
        </div>
      } @else if (session()?.status === 'failed') {
        <div class="text-center">
          <div class="text-6xl">❌</div>
          <h1 class="mt-4 text-2xl font-bold text-foreground">Generation Failed</h1>
          <p class="mt-2 text-destructive">{{ session()?.errorMessage }}</p>
        </div>
      } @else {
        <!-- Skeleton Loader -->
        <div class="space-y-6">
          <!-- Header -->
          <div>
            <div class="h-8 w-64 bg-muted rounded animate-pulse"></div>
            <div class="h-4 w-96 bg-muted rounded mt-2 animate-pulse"></div>
          </div>

          <!-- Progress Steps -->
          <div class="space-y-3 mt-8">
            @for (step of steps; track step.num) {
              <div class="flex items-start gap-3">
                <div
                  class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  [class.bg-primary]="session() && session()!.progressStep > step.num"
                  [class.text-primary-foreground]="session() && session()!.progressStep > step.num"
                  [class.bg-primary/20]="session() && session()!.progressStep === step.num"
                  [class.text-primary]="session() && session()!.progressStep === step.num"
                  [class.bg-muted]="!session() || session()!.progressStep < step.num"
                  [class.animate-pulse]="session() && session()!.progressStep === step.num"
                >
                  @if (session() && session()!.progressStep > step.num) {
                    ✓
                  } @else {
                    {{ step.num }}
                  }
                </div>
                <div class="flex-1">
                  <p class="text-sm font-medium" [class.text-muted-foreground]="!session() || session()!.progressStep < step.num">
                    {{ step.label }}
                  </p>
                  @if (session() && session()!.progressStep === step.num) {
                    <p class="text-xs text-muted-foreground mt-1">{{ session()!.progressMessage }}</p>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Skeleton Cards for Results Preview -->
          <div class="mt-8 space-y-4">
            <p class="text-sm text-muted-foreground">Processing ideas...</p>
            @for (item of [1,2,3]; track item) {
              <div class="rounded-lg border bg-card p-4 space-y-3">
                <div class="h-5 w-3/4 bg-muted rounded animate-pulse"></div>
                <div class="h-4 w-full bg-muted rounded animate-pulse"></div>
                <div class="h-4 w-5/6 bg-muted rounded animate-pulse"></div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class IdeationProcessingComponent implements OnInit, OnDestroy {
  private service = inject(IdeationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  session = signal<IdeationSession | null>(null);
  private pollInterval: any;

  steps = [
    { num: 1, label: 'Analyzing problem statement' },
    { num: 2, label: 'Generating ideas across categories' },
    { num: 3, label: 'Clustering ideas into themes' },
    { num: 4, label: 'Enriching with use cases' },
    { num: 5, label: 'Scoring ideas' },
    { num: 6, label: 'Removing duplicates' },
    { num: 7, label: 'Finalizing results' },
  ];

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (!sessionId) {
      this.router.navigate(['/ideation']);
      return;
    }

    this.pollInterval = setInterval(() => this.poll(sessionId), 3000);
    await this.poll(sessionId);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async poll(sessionId: number) {
    const status = await this.service.pollSessionStatus(sessionId);
    if (!status) return;

    this.session.set(status);

    if (status.status === 'completed') {
      clearInterval(this.pollInterval);
      setTimeout(() => {
        this.router.navigate(['/ideation/results', sessionId]);
      }, 1500);
    } else if (status.status === 'failed') {
      clearInterval(this.pollInterval);
    }
  }
}
