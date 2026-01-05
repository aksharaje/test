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
  lucideFileText,
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
      lucideFileText,
    }),
  ],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-4xl mx-auto p-6">
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
          @if (session()?.status === 'completed') {
            <div class="ml-auto flex gap-2">
              <button hlmBtn size="sm" (click)="continueToMeasurementFramework()">
                Define Measurement Framework
                <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
              </button>
              <button hlmBtn variant="ghost" size="sm" (click)="exportToPdf()">
                <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
                Export PDF
              </button>
            </div>
          }
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

          }
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
    const kpiSessionId = this.session()?.id;
    const goalSessionId = this.session()?.goalSessionId;
    if (goalSessionId) {
      // If KPIs were generated from a Goal session, use goalSessionId (which loads goals + KPIs)
      this.router.navigate(['/measurements/framework'], { queryParams: { goalSessionId } });
    } else if (kpiSessionId) {
      // Otherwise use the KPI session directly
      this.router.navigate(['/measurements/framework'], { queryParams: { kpiSessionId } });
    } else {
      this.router.navigate(['/measurements/framework']);
    }
  }

  exportToPdf() {
    const session = this.session();
    const assignments = this.assignments();
    if (!session || assignments.length === 0) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KPI Assignments</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 48px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid #6366f1;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #64748b;
    }

    .summary {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      padding: 20px 24px;
      border-radius: 12px;
      margin-bottom: 32px;
      border-left: 4px solid #0ea5e9;
    }

    .summary h2 {
      font-size: 14px;
      font-weight: 600;
      color: #0369a1;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .summary p {
      font-size: 14px;
      color: #334155;
    }

    .assignment {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    .assignment-header {
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
    }

    .assignment-header .tag {
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 8px;
      background: #dbeafe;
      color: #1d4ed8;
    }

    .assignment-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .assignment-body {
      padding: 20px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .kpi-item label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-item p {
      font-size: 14px;
      font-weight: 500;
      color: #1a1a2e;
      margin-top: 4px;
    }

    .alternatives {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #e2e8f0;
    }

    .alternatives label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .alt-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .alt-tag {
      font-size: 12px;
      padding: 4px 12px;
      background: #f1f5f9;
      border-radius: 20px;
      color: #475569;
    }

    .rationale {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #e2e8f0;
    }

    .rationale label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .rationale p {
      font-size: 13px;
      color: #475569;
      margin-top: 4px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }

    @media print {
      body { padding: 24px; }
      .assignment { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>KPI Assignments</h1>
    <div class="subtitle">${assignments.length} Goal${assignments.length !== 1 ? 's' : ''} with KPIs Assigned</div>
  </div>

  ${session.executiveSummary ? `
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${session.executiveSummary}</p>
  </div>
  ` : ''}

  ${assignments.map((a, idx) => `
  <div class="assignment">
    <div class="assignment-header">
      <span class="tag">${a.goalCategory || 'Goal'}</span>
      <h3>${idx + 1}. ${a.goalTitle}</h3>
    </div>
    <div class="assignment-body">
      <div class="kpi-grid">
        <div class="kpi-item">
          <label>Primary KPI</label>
          <p>${a.primaryKpi}</p>
        </div>
        <div class="kpi-item">
          <label>Measurement Unit</label>
          <p>${a.measurementUnit}</p>
        </div>
        ${a.secondaryKpi ? `
        <div class="kpi-item">
          <label>Secondary KPI (Health Metric)</label>
          <p>${a.secondaryKpi}</p>
        </div>
        ` : ''}
        <div class="kpi-item">
          <label>Check Frequency</label>
          <p style="text-transform: capitalize;">${a.checkFrequency}</p>
        </div>
      </div>

      ${a.alternativeKpis && a.alternativeKpis.length > 0 ? `
      <div class="alternatives">
        <label>Alternative KPIs</label>
        <div class="alt-tags">
          ${a.alternativeKpis.map(alt => `<span class="alt-tag">${alt}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      ${a.rationale ? `
      <div class="rationale">
        <label>Rationale</label>
        <p>${a.rationale}</p>
      </div>
      ` : ''}
    </div>
  </div>
  `).join('')}

  <div class="footer">
    Generated by Product Studio • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}
