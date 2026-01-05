import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRadar, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideAlertTriangle, lucideBell, lucideGitBranch, lucideShieldAlert, lucideFileText } from '@ng-icons/lucide';
import { ScopeMonitorService } from './scope-monitor.service';
import type { ScopeMonitorSession, ScopeChange, ImpactAssessment, ScopeAlert } from './scope-monitor.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-scope-monitor-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideRadar, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideAlertTriangle, lucideBell, lucideGitBranch, lucideShieldAlert, lucideFileText })],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-5xl mx-auto p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <button hlmBtn variant="ghost" size="icon" (click)="goBack()"><ng-icon name="lucideArrowLeft" class="h-5 w-5" /></button>
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ng-icon name="lucideRadar" class="h-5 w-5 text-primary" /></div>
              <div>
                <h1 class="text-2xl font-bold">{{ session()?.projectName || 'Scope Monitor' }}</h1>
                <p class="text-sm text-muted-foreground">Scope Analysis Results</p>
              </div>
            </div>
          </div>
          @if (session()?.status === 'completed') {
            <button hlmBtn variant="outline" (click)="exportToPdf()"><ng-icon name="lucideFileText" class="mr-2 h-4 w-4" /> Export PDF</button>
          }
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

  exportToPdf() {
    const session = this.session();
    const scopeCreepChanges = this.scopeCreepChanges();
    const otherChanges = this.otherChanges();
    const impactAssessments = this.impactAssessments();
    const alerts = this.alerts();

    if (!session) return;

    const getHealthColor = (score: number) => {
      if (score >= 80) return { bg: '#dcfce7', text: '#15803d', border: '#22c55e' };
      if (score >= 50) return { bg: '#fef9c3', text: '#a16207', border: '#eab308' };
      return { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' };
    };

    const getRiskColor = (level: string) => {
      if (level === 'critical') return { bg: '#fee2e2', text: '#b91c1c' };
      if (level === 'high') return { bg: '#ffedd5', text: '#c2410c' };
      if (level === 'medium') return { bg: '#fef9c3', text: '#a16207' };
      return { bg: '#dcfce7', text: '#15803d' };
    };

    const getSeverityColor = (severity: string) => {
      if (severity === 'critical') return { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' };
      if (severity === 'warning') return { bg: '#ffedd5', text: '#c2410c', border: '#f97316' };
      return { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' };
    };

    const getImpactColor = (level: string) => {
      if (level === 'critical') return { bg: '#fee2e2', text: '#b91c1c' };
      if (level === 'high') return { bg: '#ffedd5', text: '#c2410c' };
      if (level === 'medium') return { bg: '#fef9c3', text: '#a16207' };
      return { bg: '#dcfce7', text: '#15803d' };
    };

    const getImpactSeverityColor = (severity: string) => {
      if (severity === 'critical' || severity === 'major_negative') return { bg: '#fee2e2', text: '#b91c1c' };
      if (severity === 'minor_negative') return { bg: '#ffedd5', text: '#c2410c' };
      if (severity === 'neutral') return { bg: '#f1f5f9', text: '#475569' };
      return { bg: '#dcfce7', text: '#15803d' };
    };

    const healthScore = session.scopeHealthScore ?? 0;
    const healthColor = getHealthColor(healthScore);
    const riskColor = getRiskColor(session.creepRiskLevel || 'low');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scope Analysis - ${session.projectName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a2e; padding: 48px; max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #6366f1; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #6366f1; }
    .header .subtitle { font-size: 14px; color: #64748b; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .section-title .count { font-size: 14px; color: #64748b; font-weight: 400; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-card { padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
    .summary-card .value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
    .summary-card .label { font-size: 13px; color: #64748b; }
    .executive-summary { background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #6366f1; margin-bottom: 24px; }
    .executive-summary h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
    .executive-summary p { color: #374151; font-size: 14px; white-space: pre-line; }
    .recommendations { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 24px; }
    .recommendations h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .recommendations ul { margin-left: 20px; }
    .recommendations li { margin-bottom: 6px; font-size: 14px; color: #374151; }
    .alert-item { padding: 16px; border-radius: 8px; border-left: 4px solid; margin-bottom: 12px; background: #fff; border: 1px solid #e2e8f0; }
    .alert-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .alert-title { font-weight: 600; font-size: 14px; }
    .alert-description { font-size: 13px; color: #64748b; }
    .alert-action { font-size: 12px; margin-top: 8px; }
    .escalation-badge { background: #fee2e2; color: #b91c1c; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-top: 8px; display: inline-block; }
    .change-item { padding: 16px; border-radius: 8px; border-left: 4px solid; margin-bottom: 12px; background: #fff; border: 1px solid #e2e8f0; }
    .change-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .change-title { font-weight: 600; font-size: 14px; }
    .change-description { font-size: 13px; color: #64748b; margin-bottom: 8px; }
    .change-justification { font-size: 12px; color: #c2410c; margin-bottom: 8px; }
    .change-recommendation { background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 12px; }
    .change-recommendation strong { display: block; margin-bottom: 4px; }
    .change-impacts { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; }
    .impact-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .impact-item { padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; }
    .impact-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .impact-description { font-size: 13px; color: #374151; margin-bottom: 10px; }
    .impact-values { font-size: 12px; margin-bottom: 10px; }
    .impact-values p { margin-bottom: 3px; }
    .mitigation { background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 12px; }
    .mitigation strong { display: block; margin-bottom: 6px; }
    .mitigation ul { margin-left: 16px; }
    .mitigation li { margin-bottom: 3px; }
    .recommended-action { font-size: 12px; margin-top: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 24px; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.projectName}</h1>
    <div class="subtitle">Scope Analysis Results</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card" style="background: ${healthColor.bg}; border-color: ${healthColor.border};">
      <div class="value" style="color: ${healthColor.text};">${healthScore}%</div>
      <div class="label">Scope Health</div>
    </div>
    <div class="summary-card" style="background: ${riskColor.bg};">
      <div class="value" style="color: ${riskColor.text}; font-size: 24px; text-transform: capitalize;">${session.creepRiskLevel || 'Unknown'}</div>
      <div class="label">Creep Risk Level</div>
    </div>
    <div class="summary-card">
      <div class="value">${scopeCreepChanges.length + otherChanges.length}</div>
      <div class="label">Total Changes</div>
    </div>
  </div>

  ${session.executiveSummary ? `
  <div class="section">
    <div class="executive-summary">
      <h3>Executive Summary</h3>
      <p>${session.executiveSummary}</p>
    </div>
  </div>
  ` : ''}

  ${session.recommendations && session.recommendations.length > 0 ? `
  <div class="section">
    <div class="recommendations">
      <h3>Recommendations</h3>
      <ul>
        ${session.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
  </div>
  ` : ''}

  ${alerts.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Alerts <span class="count">(${alerts.length})</span></h2>
    ${alerts.map(alert => {
      const sevColor = getSeverityColor(alert.severity);
      return `
      <div class="alert-item" style="border-left-color: ${sevColor.border};">
        <div class="alert-header">
          <span class="badge" style="background: ${sevColor.bg}; color: ${sevColor.text};">${alert.severity}</span>
          <span class="badge" style="background: #f1f5f9; color: #475569;">${alert.alertType}</span>
          <span class="alert-title">${alert.title}</span>
        </div>
        <p class="alert-description">${alert.description}</p>
        ${alert.suggestedAction ? `<p class="alert-action"><strong>Suggested Action:</strong> ${alert.suggestedAction}</p>` : ''}
        ${alert.escalationNeeded ? `<span class="escalation-badge">Escalation Needed</span>` : ''}
      </div>
      `;
    }).join('')}
  </div>
  ` : ''}

  ${scopeCreepChanges.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Scope Creep Detected <span class="count">(${scopeCreepChanges.length})</span></h2>
    ${scopeCreepChanges.map(change => {
      const impactColor = getImpactColor(change.impactLevel);
      return `
      <div class="change-item" style="border-left-color: #ef4444;">
        <div class="change-header">
          <span class="badge" style="background: #fee2e2; color: #b91c1c;">${change.creepType || 'scope_creep'}</span>
          <span class="badge" style="background: #f1f5f9; color: #475569;">${change.changeType}</span>
          <span class="badge" style="background: ${impactColor.bg}; color: ${impactColor.text};">${change.impactLevel} impact</span>
          <span class="change-title">${change.title}</span>
        </div>
        <p class="change-description">${change.description}</p>
        ${change.justification ? `<p class="change-justification"><strong>Why it's creep:</strong> ${change.justification}</p>` : ''}
        <div class="change-recommendation">
          <strong>Recommendation: ${change.recommendation}</strong>
          ${change.recommendationRationale ? `<span>${change.recommendationRationale}</span>` : ''}
        </div>
        ${change.effortImpact || change.timelineImpact || change.budgetImpact ? `
        <div class="change-impacts">
          ${change.effortImpact ? `<span><strong>Effort:</strong> ${change.effortImpact}</span>` : ''}
          ${change.timelineImpact ? `<span><strong>Timeline:</strong> ${change.timelineImpact}</span>` : ''}
          ${change.budgetImpact ? `<span><strong>Budget:</strong> ${change.budgetImpact}</span>` : ''}
        </div>
        ` : ''}
      </div>
      `;
    }).join('')}
  </div>
  ` : ''}

  ${otherChanges.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Other Changes <span class="count">(${otherChanges.length})</span></h2>
    ${otherChanges.map(change => {
      const impactColor = getImpactColor(change.impactLevel);
      return `
      <div class="change-item" style="border-left-color: #94a3b8;">
        <div class="change-header">
          <span class="badge" style="background: #f1f5f9; color: #475569;">${change.changeType}</span>
          <span class="badge" style="background: #f1f5f9; color: #475569;">${change.category}</span>
          <span class="badge" style="background: ${impactColor.bg}; color: ${impactColor.text};">${change.impactLevel} impact</span>
          <span class="change-title">${change.title}</span>
        </div>
        <p class="change-description">${change.description}</p>
        <div class="change-recommendation">
          <strong>Recommendation: ${change.recommendation}</strong>
          ${change.recommendationRationale ? `<span>${change.recommendationRationale}</span>` : ''}
        </div>
      </div>
      `;
    }).join('')}
  </div>
  ` : ''}

  ${impactAssessments.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Impact Assessments <span class="count">(${impactAssessments.length})</span></h2>
    <div class="impact-grid">
      ${impactAssessments.map(impact => {
        const sevColor = getImpactSeverityColor(impact.impactSeverity);
        return `
        <div class="impact-item">
          <div class="impact-header">
            <span class="badge" style="background: #f1f5f9; color: #475569; text-transform: capitalize;">${impact.area}</span>
            <span class="badge" style="background: ${sevColor.bg}; color: ${sevColor.text};">${impact.impactSeverity}</span>
          </div>
          <p class="impact-description">${impact.impactDescription}</p>
          ${impact.baselineValue || impact.currentValue || impact.projectedValue ? `
          <div class="impact-values">
            ${impact.baselineValue ? `<p><strong>Baseline:</strong> ${impact.baselineValue}</p>` : ''}
            ${impact.currentValue ? `<p><strong>Current:</strong> ${impact.currentValue}</p>` : ''}
            ${impact.projectedValue ? `<p><strong>Projected:</strong> ${impact.projectedValue}</p>` : ''}
          </div>
          ` : ''}
          ${impact.mitigationOptions && impact.mitigationOptions.length > 0 ? `
          <div class="mitigation">
            <strong>Mitigation Options:</strong>
            <ul>
              ${impact.mitigationOptions.map(opt => `<li>${opt}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          ${impact.recommendedAction ? `<p class="recommended-action"><strong>Recommended:</strong> ${impact.recommendedAction}</p>` : ''}
        </div>
        `;
      }).join('')}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    Generated by Product Studio &bull; ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }
}
