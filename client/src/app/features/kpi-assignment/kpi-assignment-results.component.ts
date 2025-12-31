import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTarget,
  lucideLoader2,
  lucideCheck,
  lucideChevronRight,
  lucideArrowLeft,
  lucideRotateCw,
  lucideAlertCircle,
  lucidePencil,
} from '@ng-icons/lucide';
import { KpiAssignmentService } from './kpi-assignment.service';
import type { KpiAssignmentSession, KpiAssignmentFullItem } from './kpi-assignment.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-kpi-assignment-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideTarget,
      lucideLoader2,
      lucideCheck,
      lucideChevronRight,
      lucideArrowLeft,
      lucideRotateCw,
      lucideAlertCircle,
      lucidePencil,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-4xl mx-auto">
          <!-- Header -->
          <div class="flex items-center gap-4 mb-6">
            <button hlmBtn variant="ghost" size="icon" (click)="goBack()">
              <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
            </button>
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 class="text-2xl font-bold">KPI Assignment</h1>
                <p class="text-sm text-muted-foreground">AI-generated KPIs for your goals.</p>
              </div>
            </div>
          </div>

          @if (isLoading()) {
            <div class="flex flex-col items-center justify-center py-16">
              <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
              <p class="mt-4 text-lg font-medium text-muted-foreground">{{ session()?.progressMessage || 'Generating KPIs...' }}</p>
            </div>
          }

          @if (session()?.status === 'failed') {
            <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
              <div class="flex items-start gap-4">
                <ng-icon name="lucideAlertCircle" class="h-6 w-6 text-destructive" />
                <div>
                  <h3 class="font-semibold text-destructive">Generation Failed</h3>
                  <p class="mt-1 text-sm">{{ session()?.errorMessage }}</p>
                  <button hlmBtn variant="outline" size="sm" class="mt-4" (click)="retry()">
                    <ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" /> Retry
                  </button>
                </div>
              </div>
            </div>
          }

          @if (session()?.status === 'completed') {
            @if (session()?.executiveSummary) {
              <div class="rounded-lg border bg-primary/5 p-4 mb-6">
                <h2 class="font-semibold mb-2">Executive Summary</h2>
                <p class="text-sm text-muted-foreground">{{ session()?.executiveSummary }}</p>
              </div>
            }

            <div class="space-y-6">
              @for (assignment of assignments(); track assignment.id; let idx = $index) {
                <div class="rounded-lg border bg-background overflow-hidden">
                  <!-- Goal Header -->
                  <div class="p-4 border-b bg-muted/30">
                    <div class="flex items-start justify-between">
                      <div>
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-2"
                          [class.bg-blue-100]="assignment.goalCategory === 'strategic'"
                          [class.text-blue-700]="assignment.goalCategory === 'strategic'"
                          [class.bg-purple-100]="assignment.goalCategory === 'operational'"
                          [class.text-purple-700]="assignment.goalCategory === 'operational'"
                          [class.bg-green-100]="assignment.goalCategory === 'tactical'"
                          [class.text-green-700]="assignment.goalCategory === 'tactical'"
                        >
                          {{ assignment.goalCategory || 'Goal' }}
                        </span>
                        <h3 class="font-medium text-lg">{{ assignment.goalTitle }}</h3>
                      </div>
                      <button hlmBtn variant="ghost" size="sm">
                        <ng-icon name="lucidePencil" class="h-4 w-4 mr-1" /> Edit
                      </button>
                    </div>
                  </div>

                  <!-- KPI Details -->
                  <div class="p-4">
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="text-sm font-medium text-muted-foreground">Primary KPI</label>
                        <p class="font-medium mt-1">{{ assignment.primaryKpi }}</p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-muted-foreground">Measurement Unit</label>
                        <p class="font-medium mt-1">{{ assignment.measurementUnit }}</p>
                      </div>
                      @if (assignment.secondaryKpi) {
                        <div>
                          <label class="text-sm font-medium text-muted-foreground">Secondary KPI (Health Metric)</label>
                          <p class="font-medium mt-1">{{ assignment.secondaryKpi }}</p>
                        </div>
                      }
                      <div>
                        <label class="text-sm font-medium text-muted-foreground">Check Frequency</label>
                        <p class="font-medium mt-1 capitalize">{{ assignment.checkFrequency }}</p>
                      </div>
                    </div>

                    @if (assignment.alternativeKpis && assignment.alternativeKpis.length > 0) {
                      <div class="mt-4 pt-4 border-t">
                        <label class="text-sm font-medium text-muted-foreground">Alternative KPIs</label>
                        <div class="flex flex-wrap gap-2 mt-2">
                          @for (alt of assignment.alternativeKpis; track alt) {
                            <span class="inline-flex items-center rounded-full px-3 py-1 text-xs bg-muted">
                              {{ alt }}
                            </span>
                          }
                        </div>
                      </div>
                    }

                    @if (assignment.rationale) {
                      <div class="mt-4 pt-4 border-t">
                        <label class="text-sm font-medium text-muted-foreground">Rationale</label>
                        <p class="text-sm mt-1 text-muted-foreground">{{ assignment.rationale }}</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Actions -->
            <div class="flex justify-between mt-8 pt-6 border-t">
              <button hlmBtn variant="outline" (click)="goBack()">
                <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
                Back
              </button>
              <button hlmBtn (click)="continueToMeasurementFramework()">
                Continue to Measurement Framework
                <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Sidebar -->
      <div class="w-72 border-l bg-muted/30 p-4">
        <div class="rounded-lg border bg-background p-4 mb-4">
          <h3 class="font-semibold flex items-center gap-2 mb-3">
            <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
            Progress
          </h3>
          <ul class="text-sm space-y-2">
            <li class="text-muted-foreground line-through">Define Goals</li>
            <li class="font-semibold text-primary">Assign KPIs</li>
            <li class="text-muted-foreground">Build Measurement Framework</li>
          </ul>
        </div>

        <div class="rounded-lg border bg-background p-4">
          <h3 class="font-semibold flex items-center gap-2 mb-3">
            <ng-icon name="lucideChevronRight" class="h-4 w-4" />
            Next Steps
          </h3>
          <div class="space-y-2">
            <button hlmBtn class="w-full" (click)="continueToMeasurementFramework()">
              Measurement Framework
              <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

        <button hlmBtn variant="ghost" class="w-full mt-3" (click)="goBack()">
          Back to KPI Assignment
        </button>
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class KpiAssignmentResultsComponent implements OnInit {
  private service = inject(KpiAssignmentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  session = signal<KpiAssignmentSession | null>(null);
  assignments = signal<KpiAssignmentFullItem[]>([]);
  isLoading = signal(true);

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) {
      this.router.navigate(['/measurements/kpi-assignment']);
      return;
    }
    await this.loadSession(sessionId);
  }

  async loadSession(sessionId: number) {
    this.isLoading.set(true);

    // Poll for status while pending or generating
    let currentSession = await this.service.getSession(sessionId);
    while (currentSession && (currentSession.status === 'pending' || currentSession.status === 'generating')) {
      this.session.set(currentSession);
      await new Promise((r) => setTimeout(r, 2000));
      currentSession = await this.service.getSession(sessionId);
    }

    if (currentSession) {
      this.session.set(currentSession);
      if (currentSession.status === 'completed') {
        const fullData = await this.service.getSessionFull(sessionId);
        if (fullData) {
          this.assignments.set(fullData.assignments || []);
        }
      }
    }

    this.isLoading.set(false);
  }

  async retry() {
    const id = this.session()?.id;
    if (id) {
      this.isLoading.set(true);
      await this.service.retrySession(id);
      await this.loadSession(id);
    }
  }

  goBack() {
    this.router.navigate(['/measurements/kpi-assignment']);
  }

  continueToMeasurementFramework() {
    const sessionId = this.session()?.goalSessionId;
    if (sessionId) {
      this.router.navigate(['/measurements/framework'], { queryParams: { goalSessionId: sessionId } });
    } else {
      this.router.navigate(['/measurements/framework']);
    }
  }
}
