import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRadar, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideClock, lucideAlertTriangle, lucideTrendingUp, lucideTrendingDown, lucideBell, lucideGitBranch } from '@ng-icons/lucide';
import { ScopeMonitorService } from './scope-monitor.service';
import type { ScopeMonitorSession, ScopeChange, ImpactAssessment, ScopeAlert } from './scope-monitor.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-scope-monitor-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideRadar, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideClock, lucideAlertTriangle, lucideTrendingUp, lucideTrendingDown, lucideBell, lucideGitBranch })],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-5xl mx-auto p-6">
        <div class="flex items-center gap-4 mb-6">
          <button hlmBtn variant="ghost" size="icon" (click)="goBack()"><ng-icon name="lucideArrowLeft" class="h-5 w-5" /></button>
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ng-icon name="lucideRadar" class="h-5 w-5 text-primary" /></div>
            <div>
              <h1 class="text-2xl font-bold">{{ session()?.projectName || 'Scope Monitor' }}</h1>
              <p class="text-sm text-muted-foreground">Scope Analysis Results</p>
            </div>
          </div>
        </div>

        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-16">
            <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
            <p class="mt-4 text-lg font-medium text-muted-foreground">{{ session()?.progressMessage || 'Analyzing scope...' }}</p>
          </div>
        }

        @if (session()?.status === 'failed') {
          <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
            <div class="flex items-start gap-4">
              <ng-icon name="lucideAlertCircle" class="h-6 w-6 text-destructive" />
              <div>
                <h3 class="font-semibold text-destructive">Analysis Failed</h3>
                <p class="mt-1 text-sm">{{ session()?.errorMessage }}</p>
                <button hlmBtn variant="outline" size="sm" class="mt-4" (click)="retry()"><ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" /> Retry</button>
              </div>
            </div>
          </div>
        }

        @if (session()?.status === 'completed') {
          <!-- Health Score & Summary -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="rounded-lg border p-4 text-center" [class.bg-green-50]="(session()?.scopeHealthScore ?? 0) >= 80" [class.border-green-200]="(session()?.scopeHealthScore ?? 0) >= 80" [class.bg-yellow-50]="(session()?.scopeHealthScore ?? 0) >= 50 && (session()?.scopeHealthScore ?? 0) < 80" [class.border-yellow-200]="(session()?.scopeHealthScore ?? 0) >= 50 && (session()?.scopeHealthScore ?? 0) < 80" [class.bg-red-50]="(session()?.scopeHealthScore ?? 0) < 50" [class.border-red-200]="(session()?.scopeHealthScore ?? 0) < 50">
              <p class="text-3xl font-bold" [class.text-green-700]="(session()?.scopeHealthScore ?? 0) >= 80" [class.text-yellow-700]="(session()?.scopeHealthScore ?? 0) >= 50 && (session()?.scopeHealthScore ?? 0) < 80" [class.text-red-700]="(session()?.scopeHealthScore ?? 0) < 50">{{ session()?.scopeHealthScore ?? 0 }}%</p>
              <p class="text-sm text-muted-foreground">Scope Health</p>
            </div>
            <div class="rounded-lg border p-4 text-center">
              <p class="text-3xl font-bold">{{ session()?.totalChanges ?? 0 }}</p>
              <p class="text-sm text-muted-foreground">Total Changes</p>
            </div>
            <div class="rounded-lg border p-4 text-center bg-green-50 border-green-200">
              <p class="text-3xl font-bold text-green-700">{{ session()?.approvedChanges ?? 0 }}</p>
              <p class="text-sm text-muted-foreground">Approved</p>
            </div>
            <div class="rounded-lg border p-4 text-center bg-yellow-50 border-yellow-200">
              <p class="text-3xl font-bold text-yellow-700">{{ session()?.pendingChanges ?? 0 }}</p>
              <p class="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>

          @if (session()?.executiveSummary) {
            <div class="rounded-lg border bg-primary/5 p-4 mb-6">
              <h2 class="font-semibold mb-2">Executive Summary</h2>
              <p class="text-sm text-muted-foreground">{{ session()?.executiveSummary }}</p>
            </div>
          }

          <!-- Alerts -->
          @if (alerts().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideBell" class="h-5 w-5 text-orange-600" /> Alerts ({{ alerts().length }})</h2>
              <div class="space-y-3">
                @for (alert of alerts(); track alert.id) {
                  <div class="rounded-lg border p-4" [class.border-l-4]="true" [class.border-l-red-500]="alert.severity === 'critical'" [class.border-l-orange-500]="alert.severity === 'high'" [class.border-l-yellow-500]="alert.severity === 'medium'" [class.border-l-blue-500]="alert.severity === 'low'">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="alert.severity === 'critical'" [class.text-red-700]="alert.severity === 'critical'" [class.bg-orange-100]="alert.severity === 'high'" [class.text-orange-700]="alert.severity === 'high'" [class.bg-yellow-100]="alert.severity === 'medium'" [class.text-yellow-700]="alert.severity === 'medium'" [class.bg-blue-100]="alert.severity === 'low'" [class.text-blue-700]="alert.severity === 'low'">{{ alert.severity }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ alert.alertType }}</span>
                      <h3 class="font-medium text-sm">{{ alert.alertTitle }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ alert.alertDescription }}</p>
                    @if (alert.recommendedAction) { <p class="text-xs mt-2"><strong>Recommended:</strong> {{ alert.recommendedAction }}</p> }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Scope Changes -->
          @if (scopeChanges().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideGitBranch" class="h-5 w-5" /> Scope Changes ({{ scopeChanges().length }})</h2>
              <div class="space-y-3">
                @for (change of scopeChanges(); track change.id) {
                  <div class="rounded-lg border p-4">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="change.status === 'approved'" [class.text-green-700]="change.status === 'approved'" [class.bg-yellow-100]="change.status === 'pending'" [class.text-yellow-700]="change.status === 'pending'" [class.bg-red-100]="change.status === 'rejected'" [class.text-red-700]="change.status === 'rejected'" [class.bg-blue-100]="change.status === 'under_review'" [class.text-blue-700]="change.status === 'under_review'">{{ change.status }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ change.changeType }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="change.priority === 'critical'" [class.text-red-700]="change.priority === 'critical'" [class.bg-orange-100]="change.priority === 'high'" [class.text-orange-700]="change.priority === 'high'" [class.bg-yellow-100]="change.priority === 'medium'" [class.text-yellow-700]="change.priority === 'medium'" [class.bg-blue-100]="change.priority === 'low'" [class.text-blue-700]="change.priority === 'low'">{{ change.priority }}</span>
                      <h3 class="font-medium text-sm">{{ change.changeTitle }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ change.changeDescription }}</p>
                    @if (change.justification) { <p class="text-xs mt-1"><strong>Justification:</strong> {{ change.justification }}</p> }
                    @if (change.affectedAreas && change.affectedAreas.length > 0) {
                      <div class="flex flex-wrap gap-1 mt-2">
                        @for (area of change.affectedAreas; track area) { <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted">{{ area }}</span> }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Impact Assessments -->
          @if (impactAssessments().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideAlertTriangle" class="h-5 w-5" /> Impact Assessments ({{ impactAssessments().length }})</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (impact of impactAssessments(); track impact.id) {
                  <div class="rounded-lg border p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ impact.assessmentType }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="impact.severity === 'critical'" [class.text-red-700]="impact.severity === 'critical'" [class.bg-orange-100]="impact.severity === 'high'" [class.text-orange-700]="impact.severity === 'high'" [class.bg-yellow-100]="impact.severity === 'medium'" [class.text-yellow-700]="impact.severity === 'medium'" [class.bg-green-100]="impact.severity === 'low'" [class.text-green-700]="impact.severity === 'low'">{{ impact.severity }}</span>
                    </div>
                    <h3 class="font-medium text-sm">{{ impact.impactArea }}</h3>
                    <p class="text-xs text-muted-foreground mt-1">{{ impact.projectedImpact }}</p>
                    @if (impact.costImpact) { <p class="text-xs mt-1"><strong>Cost:</strong> {{ impact.costImpact }}</p> }
                    @if (impact.scheduleImpact) { <p class="text-xs"><strong>Schedule:</strong> {{ impact.scheduleImpact }}</p> }
                    @if (impact.mitigationStrategy) { <p class="text-xs mt-2 p-2 bg-muted/50 rounded"><strong>Mitigation:</strong> {{ impact.mitigationStrategy }}</p> }
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
export class ScopeMonitorResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ScopeMonitorService);

  session = signal<ScopeMonitorSession | null>(null);
  scopeChanges = signal<ScopeChange[]>([]);
  impactAssessments = signal<ImpactAssessment[]>([]);
  alerts = signal<ScopeAlert[]>([]);
  isLoading = signal(true);

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) { this.router.navigate(['/scoping/monitor']); return; }
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
          this.scopeChanges.set(fullData.scope_changes);
          this.impactAssessments.set(fullData.impact_assessments);
          this.alerts.set(fullData.alerts);
        }
      }
    }
    this.isLoading.set(false);
  }

  async retry() { const id = this.session()?.id; if (id) { this.isLoading.set(true); await this.service.retrySession(id); await this.loadSession(id); } }
  goBack() { this.router.navigate(['/scoping/monitor']); }
}
