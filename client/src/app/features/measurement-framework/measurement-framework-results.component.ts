import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBarChart3, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideDatabase, lucideLayoutDashboard, lucideFileText } from '@ng-icons/lucide';
import { MeasurementFrameworkService } from './measurement-framework.service';
import type { MeasurementFrameworkSession, FrameworkMetric, FrameworkDataSource, FrameworkDashboard } from './measurement-framework.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-measurement-framework-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideBarChart3, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideDatabase, lucideLayoutDashboard, lucideFileText })],
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
          @if (session()?.status === 'completed') {
            <div class="ml-auto">
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

  exportToPdf() {
    const session = this.session();
    const metrics = this.metrics();
    const dataSources = this.dataSources();
    const dashboards = this.dashboards();
    if (!session) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${session.name || 'Measurement Framework'}</title>
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

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .tag {
      font-size: 11px;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 12px;
      background: #f1f5f9;
      color: #475569;
    }

    .tag-metric { background: #dbeafe; color: #1d4ed8; }
    .tag-source { background: #dcfce7; color: #166534; }
    .tag-dashboard { background: #f3e8ff; color: #7c3aed; }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .card-desc {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 8px;
    }

    .card-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: 12px;
      color: #475569;
    }

    .card-meta strong {
      color: #1a1a2e;
    }

    .metric-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .metric-tag {
      font-size: 11px;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      color: #475569;
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
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.name || 'Measurement Framework'}</h1>
    <div class="subtitle">${metrics.length} Metrics • ${dataSources.length} Data Sources • ${dashboards.length} Dashboards</div>
  </div>

  ${session.executiveSummary ? `
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${session.executiveSummary}</p>
  </div>
  ` : ''}

  ${metrics.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Metrics</h2>
    ${metrics.map(m => `
    <div class="card">
      <div class="card-header">
        <span class="tag tag-metric">${m.category}</span>
        <span class="card-title">${m.name}</span>
      </div>
      <p class="card-desc">${m.description}</p>
      <div class="card-meta">
        ${m.target ? `<div><strong>Target:</strong> ${m.target}${m.unit ? ' ' + m.unit : ''}</div>` : ''}
        ${m.baseline ? `<div><strong>Baseline:</strong> ${m.baseline}</div>` : ''}
        <div><strong>Collection:</strong> ${m.collectionFrequency}</div>
        <div><strong>Method:</strong> ${m.collectionMethod}</div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${dataSources.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Data Sources</h2>
    ${dataSources.map(s => `
    <div class="card">
      <div class="card-header">
        <span class="tag tag-source">${s.sourceType}</span>
        <span class="card-title">${s.name}</span>
      </div>
      <p class="card-desc">${s.description}</p>
      <div class="card-meta">
        <div><strong>Refresh:</strong> ${s.refreshFrequency}</div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${dashboards.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Dashboards</h2>
    ${dashboards.map(d => `
    <div class="card">
      <div class="card-header">
        <span class="tag tag-dashboard">${d.audience}</span>
        <span class="card-title">${d.name}</span>
      </div>
      <p class="card-desc">${d.description}</p>
      ${d.keyMetrics && d.keyMetrics.length > 0 ? `
      <div class="metric-tags">
        ${d.keyMetrics.map(m => `<span class="metric-tag">${m}</span>`).join('')}
      </div>
      ` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

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
