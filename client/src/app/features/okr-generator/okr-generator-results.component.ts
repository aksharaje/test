import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTarget, lucideLoader2, lucideArrowLeft, lucideChevronDown, lucideChevronRight, lucideRotateCw, lucideAlertCircle, lucideCheck, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { OkrGeneratorService } from './okr-generator.service';
import type { OkrSession, Objective } from './okr-generator.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-okr-generator-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideTarget, lucideLoader2, lucideArrowLeft, lucideChevronDown, lucideChevronRight, lucideRotateCw, lucideAlertCircle, lucideCheck, lucidePencil, lucidePlus, lucideTrash2 })],
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
                <h1 class="text-2xl font-bold">OKR Generator</h1>
                <p class="text-sm text-muted-foreground">Your goals have been converted into Objectives and measurable Key Results.</p>
              </div>
            </div>
          </div>

          @if (isLoading()) {
            <div class="flex flex-col items-center justify-center py-16">
              <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
              <p class="mt-4 text-lg font-medium text-muted-foreground">{{ session()?.progressMessage || 'Generating OKRs...' }}</p>
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
              @for (obj of objectives(); track obj.id; let idx = $index) {
                <div class="rounded-lg border bg-background overflow-hidden">
                  <!-- Objective Header -->
                  <div class="p-4 flex items-start justify-between">
                    <div>
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-2"
                        [class.bg-blue-100]="idx === 0"
                        [class.text-blue-700]="idx === 0"
                        [class.bg-purple-100]="idx === 1"
                        [class.text-purple-700]="idx === 1"
                        [class.bg-green-100]="idx > 1"
                        [class.text-green-700]="idx > 1"
                      >
                        Objective {{ idx + 1 }}
                      </span>
                      <h3 class="font-medium text-lg">{{ obj.title }}</h3>
                    </div>
                    <div class="flex items-center gap-1">
                      <button hlmBtn variant="outline" size="sm">
                        <ng-icon name="lucidePencil" class="h-4 w-4 mr-1" /> Edit
                      </button>
                      <button hlmBtn variant="outline" size="sm">
                        <ng-icon name="lucidePlus" class="h-4 w-4 mr-1" /> Add KR
                      </button>
                      <button hlmBtn variant="ghost" size="icon" class="text-destructive">
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Key Results -->
                  @if (obj.keyResults && obj.keyResults.length > 0) {
                    <div class="border-t px-4 pb-4">
                      @for (kr of obj.keyResults; track kr.id) {
                        <div class="mt-4 rounded-lg border p-4 bg-muted/20">
                          <div class="flex items-start gap-3">
                            <ng-icon name="lucideCheck" class="h-5 w-5 text-primary mt-0.5" />
                            <div class="flex-1">
                              <p class="font-medium">{{ kr.title }}</p>
                              <div class="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                                @if (kr.baselineValue) {
                                  <span>Baseline: <strong>{{ kr.baselineValue }}</strong></span>
                                }
                                @if (kr.owner) {
                                  <span>Owner: <strong>{{ kr.owner }}</strong></span>
                                }
                                <span>KPI: <strong>{{ kr.kpiName || 'Not assigned' }}</strong></span>
                              </div>
                            </div>
                            <div class="flex items-center gap-1 text-sm">
                              <button class="text-muted-foreground hover:text-primary">
                                <ng-icon name="lucidePencil" class="h-4 w-4" /> Edit
                              </button>
                              <button class="text-muted-foreground hover:text-destructive">
                                <ng-icon name="lucideTrash2" class="h-4 w-4" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  }

                  <!-- Add Key Result Button -->
                  <div class="px-4 pb-4">
                    <button hlmBtn variant="outline" class="w-full border-dashed">
                      <ng-icon name="lucidePlus" class="h-4 w-4 mr-2" /> Add Key Result
                    </button>
                  </div>
                </div>
              }

              <!-- Add Objective Button -->
              <button hlmBtn variant="outline" class="w-full border-dashed py-4">
                <ng-icon name="lucidePlus" class="h-4 w-4 mr-2" /> Add New Objective
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
            <li class="font-semibold text-primary">Generate OKRs</li>
            <li class="text-muted-foreground">Assign KPIs</li>
            <li class="text-muted-foreground">Benchmark Data</li>
            <li class="text-muted-foreground">Measurement Plan</li>
          </ul>
        </div>

        <div class="rounded-lg border bg-background p-4">
          <h3 class="font-semibold flex items-center gap-2 mb-3">
            <ng-icon name="lucideChevronRight" class="h-4 w-4" />
            Next Steps
          </h3>
          <div class="space-y-2">
            <button hlmBtn class="w-full" (click)="continueToKpiAssignment()">
              Assign KPIs
              <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
            </button>
            <button hlmBtn variant="outline" class="w-full" (click)="continueToMeasurementFramework()">
              Build Measurement Framework
              <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

        <button hlmBtn variant="ghost" class="w-full mt-3" (click)="goToGoals()">
          Back to Goals
        </button>
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class OkrGeneratorResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(OkrGeneratorService);

  session = signal<OkrSession | null>(null);
  objectives = signal<Objective[]>([]);
  isLoading = signal(true);

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) { this.router.navigate(['/measurements/okr-generator']); return; }
    await this.loadSession(sessionId);
  }

  async loadSession(sessionId: number) {
    this.isLoading.set(true);
    let session = await this.service.getSession(sessionId);
    while (session && (session.status === 'pending' || session.status === 'generating')) {
      this.session.set(session);
      await new Promise((r) => setTimeout(r, 2000));
      session = await this.service.getSession(sessionId);
    }
    if (session) {
      this.session.set(session);
      if (session.status === 'completed') {
        const fullData = await this.service.getSessionFull(sessionId);
        if (fullData) {
          this.objectives.set(fullData.objectives);
        }
      }
    }
    this.isLoading.set(false);
  }

  async retry() { const id = this.session()?.id; if (id) { this.isLoading.set(true); await this.service.retrySession(id); await this.loadSession(id); } }
  goBack() { this.router.navigate(['/measurements/okr-generator']); }
  goToGoals() { this.router.navigate(['/goals/setting']); }
  continueToKpiAssignment() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.router.navigate(['/measurements/kpi-assignment'], { queryParams: { okrSessionId: sessionId } });
    }
  }

  continueToMeasurementFramework() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.router.navigate(['/measurements/framework'], { queryParams: { okrSessionId: sessionId } });
    }
  }
}
