import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRadar, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideAlertTriangle, lucideBell, lucideGitBranch, lucideShieldAlert } from '@ng-icons/lucide';
import { ScopeMonitorService } from './scope-monitor.service';
import type { ScopeMonitorSession, ScopeChange, ImpactAssessment, ScopeAlert } from './scope-monitor.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-scope-monitor-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideRadar, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideAlertTriangle, lucideBell, lucideGitBranch, lucideShieldAlert })],
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
          <!-- Health Score & Risk Level -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="rounded-lg border p-4 text-center" [class.bg-green-50]="(session()?.scopeHealthScore ?? 0) >= 80" [class.border-green-200]="(session()?.scopeHealthScore ?? 0) >= 80" [class.bg-yellow-50]="(session()?.scopeHealthScore ?? 0) >= 50 && (session()?.scopeHealthScore ?? 0) < 80" [class.border-yellow-200]="(session()?.scopeHealthScore ?? 0) >= 50 && (session()?.scopeHealthScore ?? 0) < 80" [class.bg-red-50]="(session()?.scopeHealthScore ?? 0) < 50" [class.border-red-200]="(session()?.scopeHealthScore ?? 0) < 50">
              <p class="text-3xl font-bold" [class.text-green-700]="(session()?.scopeHealthScore ?? 0) >= 80" [class.text-yellow-700]="(session()?.scopeHealthScore ?? 0) >= 50 && (session()?.scopeHealthScore ?? 0) < 80" [class.text-red-700]="(session()?.scopeHealthScore ?? 0) < 50">{{ session()?.scopeHealthScore ?? 0 }}%</p>
              <p class="text-sm text-muted-foreground">Scope Health</p>
            </div>
            <div class="rounded-lg border p-4 text-center" [class.bg-red-50]="session()?.creepRiskLevel === 'critical'" [class.border-red-200]="session()?.creepRiskLevel === 'critical'" [class.bg-orange-50]="session()?.creepRiskLevel === 'high'" [class.border-orange-200]="session()?.creepRiskLevel === 'high'" [class.bg-yellow-50]="session()?.creepRiskLevel === 'medium'" [class.border-yellow-200]="session()?.creepRiskLevel === 'medium'" [class.bg-green-50]="session()?.creepRiskLevel === 'low'" [class.border-green-200]="session()?.creepRiskLevel === 'low'">
              <p class="text-xl font-bold capitalize" [class.text-red-700]="session()?.creepRiskLevel === 'critical'" [class.text-orange-700]="session()?.creepRiskLevel === 'high'" [class.text-yellow-700]="session()?.creepRiskLevel === 'medium'" [class.text-green-700]="session()?.creepRiskLevel === 'low'">{{ session()?.creepRiskLevel || 'Unknown' }}</p>
              <p class="text-sm text-muted-foreground">Creep Risk Level</p>
            </div>
            <div class="rounded-lg border p-4 text-center">
              <p class="text-3xl font-bold">{{ scopeCreepChanges().length + otherChanges().length }}</p>
              <p class="text-sm text-muted-foreground">Total Changes</p>
            </div>
          </div>

          @if (session()?.executiveSummary) {
            <div class="rounded-lg border bg-primary/5 p-4 mb-6">
              <h2 class="font-semibold mb-2">Executive Summary</h2>
              <p class="text-sm text-muted-foreground whitespace-pre-line">{{ session()?.executiveSummary }}</p>
            </div>
          }

          @if (session()?.recommendations && session()!.recommendations!.length > 0) {
            <div class="rounded-lg border p-4 mb-6">
              <h2 class="font-semibold mb-2">Recommendations</h2>
              <ul class="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                @for (rec of session()!.recommendations!; track rec) {
                  <li>{{ rec }}</li>
                }
              </ul>
            </div>
          }

          <!-- Alerts -->
          @if (alerts().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideBell" class="h-5 w-5 text-orange-600" /> Alerts ({{ alerts().length }})</h2>
              <div class="space-y-3">
                @for (alert of alerts(); track alert.id) {
                  <div class="rounded-lg border p-4" [class.border-l-4]="true" [class.border-l-red-500]="alert.severity === 'critical'" [class.border-l-orange-500]="alert.severity === 'warning'" [class.border-l-blue-500]="alert.severity === 'info'">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="alert.severity === 'critical'" [class.text-red-700]="alert.severity === 'critical'" [class.bg-orange-100]="alert.severity === 'warning'" [class.text-orange-700]="alert.severity === 'warning'" [class.bg-blue-100]="alert.severity === 'info'" [class.text-blue-700]="alert.severity === 'info'">{{ alert.severity }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ alert.alertType }}</span>
                      <h3 class="font-medium text-sm">{{ alert.title }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ alert.description }}</p>
                    @if (alert.suggestedAction) { <p class="text-xs mt-2"><strong>Suggested Action:</strong> {{ alert.suggestedAction }}</p> }
                    @if (alert.escalationNeeded) { <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 mt-2">Escalation Needed</span> }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Scope Creep Changes -->
          @if (scopeCreepChanges().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideShieldAlert" class="h-5 w-5 text-red-600" /> Scope Creep Detected ({{ scopeCreepChanges().length }})</h2>
              <div class="space-y-3">
                @for (change of scopeCreepChanges(); track change.id) {
                  <div class="rounded-lg border border-l-4 border-l-red-500 p-4">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">{{ change.creepType || 'scope_creep' }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ change.changeType }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="change.impactLevel === 'critical'" [class.text-red-700]="change.impactLevel === 'critical'" [class.bg-orange-100]="change.impactLevel === 'high'" [class.text-orange-700]="change.impactLevel === 'high'" [class.bg-yellow-100]="change.impactLevel === 'medium'" [class.text-yellow-700]="change.impactLevel === 'medium'" [class.bg-green-100]="change.impactLevel === 'low'" [class.text-green-700]="change.impactLevel === 'low'">{{ change.impactLevel }} impact</span>
                      <h3 class="font-medium text-sm">{{ change.title }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ change.description }}</p>
                    @if (change.justification) { <p class="text-xs mt-1 text-orange-700"><strong>Why it's creep:</strong> {{ change.justification }}</p> }
                    <div class="mt-2 p-2 bg-muted/50 rounded">
                      <p class="text-xs"><strong>Recommendation:</strong> <span class="capitalize">{{ change.recommendation }}</span></p>
                      @if (change.recommendationRationale) { <p class="text-xs text-muted-foreground">{{ change.recommendationRationale }}</p> }
                    </div>
                    @if (change.effortImpact || change.timelineImpact || change.budgetImpact) {
                      <div class="flex gap-4 mt-2 text-xs">
                        @if (change.effortImpact) { <span><strong>Effort:</strong> {{ change.effortImpact }}</span> }
                        @if (change.timelineImpact) { <span><strong>Timeline:</strong> {{ change.timelineImpact }}</span> }
                        @if (change.budgetImpact) { <span><strong>Budget:</strong> {{ change.budgetImpact }}</span> }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Other Changes -->
          @if (otherChanges().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideGitBranch" class="h-5 w-5" /> Other Changes ({{ otherChanges().length }})</h2>
              <div class="space-y-3">
                @for (change of otherChanges(); track change.id) {
                  <div class="rounded-lg border p-4">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ change.changeType }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ change.category }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="change.impactLevel === 'critical'" [class.text-red-700]="change.impactLevel === 'critical'" [class.bg-orange-100]="change.impactLevel === 'high'" [class.text-orange-700]="change.impactLevel === 'high'" [class.bg-yellow-100]="change.impactLevel === 'medium'" [class.text-yellow-700]="change.impactLevel === 'medium'" [class.bg-green-100]="change.impactLevel === 'low'" [class.text-green-700]="change.impactLevel === 'low'">{{ change.impactLevel }} impact</span>
                      <h3 class="font-medium text-sm">{{ change.title }}</h3>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ change.description }}</p>
                    <div class="mt-2 p-2 bg-muted/50 rounded">
                      <p class="text-xs"><strong>Recommendation:</strong> <span class="capitalize">{{ change.recommendation }}</span></p>
                      @if (change.recommendationRationale) { <p class="text-xs text-muted-foreground">{{ change.recommendationRationale }}</p> }
                    </div>
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
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted capitalize">{{ impact.area }}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="impact.impactSeverity === 'critical' || impact.impactSeverity === 'major_negative'" [class.text-red-700]="impact.impactSeverity === 'critical' || impact.impactSeverity === 'major_negative'" [class.bg-orange-100]="impact.impactSeverity === 'minor_negative'" [class.text-orange-700]="impact.impactSeverity === 'minor_negative'" [class.bg-gray-100]="impact.impactSeverity === 'neutral'" [class.text-gray-700]="impact.impactSeverity === 'neutral'" [class.bg-green-100]="impact.impactSeverity === 'positive'" [class.text-green-700]="impact.impactSeverity === 'positive'">{{ impact.impactSeverity }}</span>
                    </div>
                    <p class="text-sm">{{ impact.impactDescription }}</p>
                    @if (impact.baselineValue || impact.projectedValue) {
                      <div class="mt-2 text-xs">
                        @if (impact.baselineValue) { <p><strong>Baseline:</strong> {{ impact.baselineValue }}</p> }
                        @if (impact.currentValue) { <p><strong>Current:</strong> {{ impact.currentValue }}</p> }
                        @if (impact.projectedValue) { <p><strong>Projected:</strong> {{ impact.projectedValue }}</p> }
                      </div>
                    }
                    @if (impact.mitigationOptions && impact.mitigationOptions.length > 0) {
                      <div class="mt-2 p-2 bg-muted/50 rounded">
                        <strong class="text-xs">Mitigation Options:</strong>
                        <ul class="text-xs list-disc list-inside">
                          @for (opt of impact.mitigationOptions; track opt) { <li>{{ opt }}</li> }
                        </ul>
                      </div>
                    }
                    @if (impact.recommendedAction) { <p class="text-xs mt-2"><strong>Recommended:</strong> {{ impact.recommendedAction }}</p> }
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
  scopeCreepChanges = signal<ScopeChange[]>([]);
  otherChanges = signal<ScopeChange[]>([]);
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
    while (session && (session.status === 'pending' || session.status === 'analyzing')) {
      this.session.set(session);
      await new Promise((r) => setTimeout(r, 2000));
      session = await this.service.getSession(sessionId);
    }
    if (session) {
      this.session.set(session);
      if (session.status === 'completed') {
        const fullData = await this.service.getSessionFull(sessionId);
        if (fullData) {
          this.scopeCreepChanges.set(fullData.scope_creep_changes || []);
          this.otherChanges.set(fullData.other_changes || []);
          this.impactAssessments.set(fullData.impact_assessments || []);
          this.alerts.set(fullData.alerts || []);
        }
      }
    }
    this.isLoading.set(false);
  }

  async retry() { const id = this.session()?.id; if (id) { this.isLoading.set(true); await this.service.retrySession(id); await this.loadSession(id); } }
  goBack() { this.router.navigate(['/scoping/monitor']); }
}
