import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBarChart3, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideDatabase, lucideLayoutDashboard } from '@ng-icons/lucide';
import { MeasurementFrameworkService } from './measurement-framework.service';
import type { MeasurementFrameworkSession, FrameworkMetric, FrameworkDataSource, FrameworkDashboard } from './measurement-framework.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-measurement-framework-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideBarChart3, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideDatabase, lucideLayoutDashboard })],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-5xl mx-auto p-6">
        <div class="flex items-center gap-4 mb-6">
          <button hlmBtn variant="ghost" size="icon" (click)="goBack()"><ng-icon name="lucideArrowLeft" class="h-5 w-5" /></button>
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ng-icon name="lucideBarChart3" class="h-5 w-5 text-primary" /></div>
            <div>
              <h1 class="text-2xl font-bold">{{ session()?.name || 'Framework Results' }}</h1>
              <p class="text-sm text-muted-foreground">Measurement Framework</p>
            </div>
          </div>
        </div>

        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-16">
            <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
            <p class="mt-4 text-lg font-medium text-muted-foreground">{{ session()?.progressMessage || 'Building framework...' }}</p>
          </div>
        }

        @if (session()?.status === 'failed') {
          <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
            <div class="flex items-start gap-4">
              <ng-icon name="lucideAlertCircle" class="h-6 w-6 text-destructive" />
              <div>
                <h3 class="font-semibold text-destructive">Generation Failed</h3>
                <p class="mt-1 text-sm">{{ session()?.errorMessage }}</p>
                <button hlmBtn variant="outline" size="sm" class="mt-4" (click)="retry()"><ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" /> Retry</button>
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

          <!-- Metrics -->
          <div class="mb-8">
            <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideBarChart3" class="h-5 w-5" /> Metrics ({{ metrics().length }})</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (metric of metrics(); track metric.id) {
                <div class="rounded-lg border p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ metric.category }}</span>
                    <h3 class="font-medium text-sm">{{ metric.name }}</h3>
                  </div>
                  <p class="text-xs text-muted-foreground mb-2">{{ metric.description }}</p>
                  <div class="grid grid-cols-2 gap-2 text-xs">
                    @if (metric.target) { <div><strong>Target:</strong> {{ metric.target }}{{ metric.unit ? ' ' + metric.unit : '' }}</div> }
                    @if (metric.baseline) { <div><strong>Baseline:</strong> {{ metric.baseline }}</div> }
                    <div><strong>Collect:</strong> {{ metric.collectionFrequency }}</div>
                    <div><strong>Method:</strong> {{ metric.collectionMethod }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Data Sources -->
          @if (dataSources().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideDatabase" class="h-5 w-5" /> Data Sources ({{ dataSources().length }})</h2>
              <div class="space-y-3">
                @for (source of dataSources(); track source.id) {
                  <div class="rounded-lg border p-4">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">{{ source.sourceType }}</span>
                      <h3 class="font-medium text-sm">{{ source.name }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ source.description }}</p>
                    <div class="mt-2 text-xs"><strong>Refresh:</strong> {{ source.refreshFrequency }}</div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Dashboards -->
          @if (dashboards().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideLayoutDashboard" class="h-5 w-5" /> Dashboards ({{ dashboards().length }})</h2>
              <div class="space-y-3">
                @for (dashboard of dashboards(); track dashboard.id) {
                  <div class="rounded-lg border p-4">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">{{ dashboard.audience }}</span>
                      <h3 class="font-medium text-sm">{{ dashboard.name }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ dashboard.description }}</p>
                    @if (dashboard.keyMetrics && dashboard.keyMetrics.length > 0) {
                      <div class="mt-2 flex flex-wrap gap-1">
                        @for (metric of dashboard.keyMetrics; track metric) {
                          <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted">{{ metric }}</span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class MeasurementFrameworkResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(MeasurementFrameworkService);

  session = signal<MeasurementFrameworkSession | null>(null);
  metrics = signal<FrameworkMetric[]>([]);
  dataSources = signal<FrameworkDataSource[]>([]);
  dashboards = signal<FrameworkDashboard[]>([]);
  isLoading = signal(true);

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) { this.router.navigate(['/measurements/framework']); return; }
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
          this.metrics.set(fullData.metrics);
          this.dataSources.set(fullData.data_sources);
          this.dashboards.set(fullData.dashboards);
        }
      }
    }
    this.isLoading.set(false);
  }

  async retry() { const id = this.session()?.id; if (id) { this.isLoading.set(true); await this.service.retrySession(id); await this.loadSession(id); } }
  goBack() { this.router.navigate(['/measurements/framework']); }
}
