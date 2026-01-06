import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTarget, lucideLoader2, lucideArrowLeft, lucideChevronDown, lucideChevronRight, lucideRotateCw, lucideAlertCircle, lucideCheck, lucidePencil, lucidePlus, lucideTrash2, lucideFileText } from '@ng-icons/lucide';
import { OkrGeneratorService } from './okr-generator.service';
import type { OkrSession, Objective } from './okr-generator.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-okr-generator-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideTarget, lucideLoader2, lucideArrowLeft, lucideChevronDown, lucideChevronRight, lucideRotateCw, lucideAlertCircle, lucideCheck, lucidePencil, lucidePlus, lucideTrash2, lucideFileText })],
  template: `
    <div class="h-full overflow-y-auto p-6">
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
          @if (session()?.status === 'completed') {
            <div class="ml-auto flex gap-2">
              <button hlmBtn (click)="continueToKpiAssignment()">
                Assign KPIs
                <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
              </button>
              <button hlmBtn variant="outline" (click)="exportToPdf()">
                <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
                Export PDF
              </button>
            </div>
          }
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
          <!-- Context & Inputs -->
          @if (session()?.goalDescription || session()?.timeframe) {
            <div class="rounded-lg border bg-muted/30 p-4 mb-6">
              <h2 class="font-semibold mb-3 flex items-center gap-2">
                <ng-icon name="lucideFileText" class="h-4 w-4" />
                Context & Inputs
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                @if (session()?.goalDescription) {
                  <div>
                    <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Goal Description</h3>
                    <p class="text-sm bg-background border rounded-md p-3">{{ session()?.goalDescription }}</p>
                  </div>
                }
                @if (session()?.timeframe) {
                  <div>
                    <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Timeframe</h3>
                    <p class="text-sm bg-background border rounded-md p-3">{{ session()?.timeframe }}</p>
                  </div>
                }
              </div>
            </div>
          }

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

  continueToKpiAssignment() {
    const sessionId = this.session()?.id;
    const goalSessionId = this.session()?.goalSessionId;
    if (goalSessionId) {
      // If OKRs were generated from a goal session, use that for KPI assignment
      this.router.navigate(['/measurements/kpi-assignment'], { queryParams: { goalSessionId, autoRun: 'true' } });
    } else if (sessionId) {
      this.router.navigate(['/measurements/kpi-assignment'], { queryParams: { okrSessionId: sessionId, autoRun: 'true' } });
    }
  }

  exportToPdf() {
    const session = this.session();
    const objectives = this.objectives();
    if (!session || objectives.length === 0) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OKRs - ${session.goalSessionId ? 'Goal-Aligned OKRs' : 'Generated OKRs'}</title>
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
    
    .objective {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .objective-header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 16px 20px;
      color: white;
    }
    
    .objective-header .tag {
      font-size: 11px;
      font-weight: 500;
      background: rgba(255,255,255,0.2);
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 8px;
    }
    
    .objective-header h3 {
      font-size: 18px;
      font-weight: 600;
    }
    
    .key-results {
      padding: 16px 20px;
    }
    
    .kr {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .kr:last-child {
      border-bottom: none;
    }
    
    .kr-icon {
      width: 24px;
      height: 24px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #16a34a;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .kr-content h4 {
      font-size: 14px;
      font-weight: 500;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    
    .kr-meta {
      font-size: 12px;
      color: #64748b;
    }
    
    .kr-meta span {
      margin-right: 16px;
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
      .objective { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Objectives & Key Results</h1>
    <div class="subtitle">${objectives.length} Objective${objectives.length !== 1 ? 's' : ''} with ${objectives.reduce((sum, o) => sum + (o.keyResults?.length || 0), 0)} Key Results</div>
  </div>
  
  ${session.executiveSummary ? `
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${session.executiveSummary}</p>
  </div>
  ` : ''}
  
  ${objectives.map((obj, idx) => `
  <div class="objective">
    <div class="objective-header">
      <span class="tag">Objective ${idx + 1}</span>
      <h3>${obj.title}</h3>
    </div>
    <div class="key-results">
      ${obj.keyResults?.map(kr => `
      <div class="kr">
        <div class="kr-icon">✓</div>
        <div class="kr-content">
          <h4>${kr.title}</h4>
          <div class="kr-meta">
            ${kr.baselineValue ? `<span>Baseline: <strong>${kr.baselineValue}</strong></span>` : ''}
            ${kr.owner ? `<span>Owner: <strong>${kr.owner}</strong></span>` : ''}
            <span>KPI: <strong>${kr.kpiName || 'Not assigned'}</strong></span>
          </div>
        </div>
      </div>
      `).join('') || '<p style="color: #94a3b8; font-size: 13px;">No key results defined</p>'}
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

