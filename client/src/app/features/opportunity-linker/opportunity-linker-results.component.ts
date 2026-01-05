import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSparkles, lucideArrowLeft, lucideDownload, lucideFileText } from '@ng-icons/lucide';
import { OpportunityLinkerService } from './opportunity-linker.service';
import { HlmButtonDirective } from '../../ui/button';
import type { PrioritizedIdeaWithOriginal } from './opportunity-linker.types';

/**
 * Opportunity Linker Results Component
 *
 * Displays prioritized backlog grouped by priority tiers (P0/P1/P2/P3).
 * Shows portfolio summary with counts by tier and opportunity details
 * for each idea including market opportunity, strategic fit, and size estimation.
 *
 * @example
 * Route: /opportunity-linker/results/:sessionId
 *
 * Features:
 * - Portfolio summary cards (P0, P1, P2/P3 counts)
 * - Ideas grouped by priority tier
 * - Opportunity details (market, strategic, customer)
 * - Export to JSON functionality
 */
@Component({
  selector: 'app-opportunity-linker-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideSparkles,
      lucideArrowLeft,
      lucideDownload,
      lucideFileText,
    }),
  ],
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="border-b bg-background p-6">
        <div class="max-w-7xl mx-auto">
          <button
            hlmBtn
            variant="ghost"
            class="mb-4"
            (click)="goBack()"
          >
            <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
            Back to Ideation
          </button>
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-foreground">Prioritized Backlog</h1>
              <p class="mt-1 text-muted-foreground">
                Strategic prioritization with opportunity mapping
              </p>
            </div>
            <button hlmBtn variant="outline" (click)="exportToPdf()" class="mr-2">
              <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
              Export PDF
            </button>
            <button hlmBtn (click)="exportResults()">
              <ng-icon name="lucideDownload" class="mr-2 h-4 w-4" />
              Export JSON
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-7xl mx-auto">
          @if (service.loading()) {
            <div class="flex items-center justify-center h-64">
              <div class="text-center">
                <div class="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p class="mt-4 text-muted-foreground">Loading prioritization...</p>
              </div>
            </div>
          } @else if (service.error()) {
            <div class="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
              <p class="text-destructive">{{ service.error() }}</p>
            </div>
          } @else if (service.currentSession()) {
            <!-- Portfolio Summary -->
            @if (session()?.portfolioSummary) {
              <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="rounded-lg border p-4">
                  <div class="text-sm text-muted-foreground">P0 Ideas</div>
                  <div class="text-3xl font-bold text-green-600">
                    {{ session()!.portfolioSummary!.byTier.p0 }}
                  </div>
                  <div class="text-xs text-muted-foreground">Do Now</div>
                </div>
                <div class="rounded-lg border p-4">
                  <div class="text-sm text-muted-foreground">P1 Ideas</div>
                  <div class="text-3xl font-bold text-blue-600">
                    {{ session()!.portfolioSummary!.byTier.p1 }}
                  </div>
                  <div class="text-xs text-muted-foreground">Next Quarter</div>
                </div>
                <div class="rounded-lg border p-4">
                  <div class="text-sm text-muted-foreground">P2/P3 Ideas</div>
                  <div class="text-3xl font-bold text-gray-600">
                    {{ session()!.portfolioSummary!.byTier.p2 + session()!.portfolioSummary!.byTier.p3 }}
                  </div>
                  <div class="text-xs text-muted-foreground">Backlog</div>
                </div>
              </div>
            }

            <!-- Prioritized Ideas by Tier -->
            @for (tier of ['P0', 'P1', 'P2', 'P3']; track tier) {
              @if (ideasByTier()[tier] && ideasByTier()[tier]!.length > 0) {
                <div class="mb-8">
                  <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span
                      class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                      [class.bg-green-100]="tier === 'P0'"
                      [class.text-green-700]="tier === 'P0'"
                      [class.bg-blue-100]="tier === 'P1'"
                      [class.text-blue-700]="tier === 'P1'"
                      [class.bg-yellow-100]="tier === 'P2'"
                      [class.text-yellow-700]="tier === 'P2'"
                      [class.bg-gray-100]="tier === 'P3'"
                      [class.text-gray-700]="tier === 'P3'"
                    >
                      {{ tier }}
                    </span>
                    <span class="text-muted-foreground">
                      {{ getTierLabel(tier) }}
                    </span>
                  </h2>

                  <div class="space-y-4">
                    @for (idea of ideasByTier()[tier]!; track idea.id) {
                      <div class="rounded-lg border p-6 hover:border-primary/50 transition-colors">
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <h3 class="text-lg font-semibold">{{ idea.title }}</h3>
                            <p class="mt-1 text-sm text-muted-foreground">{{ idea.description }}</p>
                          </div>
                          <div class="ml-4 flex flex-col items-end gap-2">
                            <div class="text-2xl font-bold text-primary">
                              {{ idea.priorityScore?.toFixed(1) }}
                            </div>
                            <div
                              class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {{ idea.tshirtSize }}
                            </div>
                          </div>
                        </div>

                        <!-- Opportunity Details -->
                        <div class="mt-4 grid grid-cols-3 gap-4 text-sm">
                          @if (idea.marketOpportunity) {
                            <div>
                              <div class="font-medium text-foreground">Market Opportunity</div>
                              <div class="text-muted-foreground">
                                {{ idea.marketOpportunity.estimatedMarketSize }}
                              </div>
                            </div>
                          }
                          @if (idea.strategicFitScore) {
                            <div>
                              <div class="font-medium text-foreground">Strategic Fit</div>
                              <div class="text-muted-foreground">
                                {{ idea.strategicFitScore.toFixed(1) }}/10
                              </div>
                            </div>
                          }
                          @if (idea.customerOpportunity) {
                            <div>
                              <div class="font-medium text-foreground">Customer Value</div>
                              <div class="text-muted-foreground">
                                {{ idea.customerOpportunity.valueDelivered }}
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class OpportunityLinkerResultsComponent implements OnInit {
  service = inject(OpportunityLinkerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Current session metadata */
  session = signal<any>(null);

  /** All prioritized ideas for this session */
  ideas = signal<PrioritizedIdeaWithOriginal[]>([]);

  /** Ideas grouped by priority tier (P0/P1/P2/P3) */
  ideasByTier = signal<Record<string, PrioritizedIdeaWithOriginal[]>>({});

  /**
   * Load session detail and group ideas by tier on component initialization.
   */
  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    const detail = await this.service.getSessionDetail(sessionId);

    if (detail) {
      this.session.set(detail.session);
      this.ideas.set(detail.ideas);

      // Group ideas by tier
      const grouped: Record<string, PrioritizedIdeaWithOriginal[]> = {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      };

      detail.ideas.forEach((idea: PrioritizedIdeaWithOriginal) => {
        const tier = idea.priorityTier || 'P3';
        grouped[tier].push(idea);
      });

      this.ideasByTier.set(grouped);
    }
  }

  /**
   * Get human-readable label for a priority tier.
   *
   * @param tier - Priority tier code (P0/P1/P2/P3)
   * @returns User-friendly tier label
   */
  getTierLabel(tier: string): string {
    const labels: Record<string, string> = {
      P0: 'Execute Immediately',
      P1: 'Next Quarter',
      P2: 'Backlog',
      P3: 'Deprioritize',
    };
    return labels[tier] || '';
  }

  /**
   * Navigate back to ideation results page.
   */
  goBack() {
    this.router.navigate(['/ideation']);
  }

  /**
   * Export prioritized backlog to JSON file.
   *
   * Downloads a JSON file containing session metadata and all prioritized ideas
   * with their opportunity details and scores.
   */
  exportResults() {
    // Export to JSON for now
    const data = {
      session: this.session(),
      ideas: this.ideas(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prioritized-backlog-${this.session()?.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export prioritized backlog to PDF via print dialog.
   */
  exportToPdf() {
    const session = this.session();
    const ideasByTier = this.ideasByTier();
    if (!session) return;

    const getTierColor = (tier: string) => {
      const colors: Record<string, { bg: string; text: string }> = {
        P0: { bg: '#dcfce7', text: '#166534' },
        P1: { bg: '#dbeafe', text: '#1e40af' },
        P2: { bg: '#fef9c3', text: '#854d0e' },
        P3: { bg: '#f3f4f6', text: '#374151' },
      };
      return colors[tier] || colors['P3'];
    };

    let ideasHtml = '';
    for (const tier of ['P0', 'P1', 'P2', 'P3']) {
      const tierIdeas = ideasByTier[tier];
      if (tierIdeas && tierIdeas.length > 0) {
        const tierColor = getTierColor(tier);
        ideasHtml += `
          <div class="section">
            <h2 class="section-title">
              <span class="tier-badge" style="background: ${tierColor.bg}; color: ${tierColor.text};">${tier}</span>
              ${this.getTierLabel(tier)} (${tierIdeas.length})
            </h2>
            ${tierIdeas.map(idea => `
              <div class="card">
                <div class="card-header">
                  <div class="card-title">${idea.title}</div>
                  <div class="score-badge">${idea.priorityScore?.toFixed(1) || 'N/A'}</div>
                </div>
                <p class="card-desc">${idea.description}</p>
                <div class="card-meta">
                  ${idea.marketOpportunity ? `<div><strong>Market:</strong> ${idea.marketOpportunity.estimatedMarketSize}</div>` : ''}
                  ${idea.strategicFitScore ? `<div><strong>Strategic Fit:</strong> ${idea.strategicFitScore.toFixed(1)}/10</div>` : ''}
                  ${idea.customerOpportunity ? `<div><strong>Customer Value:</strong> ${idea.customerOpportunity.valueDelivered}</div>` : ''}
                  ${idea.tshirtSize ? `<div><strong>T-Shirt Size:</strong> ${idea.tshirtSize}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prioritized Backlog</title>
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
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { font-size: 14px; color: #64748b; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .summary-card .label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .summary-card .value { font-size: 32px; font-weight: 700; }
    .summary-card .sublabel { font-size: 11px; color: #94a3b8; }
    .p0-value { color: #16a34a; }
    .p1-value { color: #2563eb; }
    .p23-value { color: #6b7280; }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .tier-badge {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
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
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .card-title { font-size: 14px; font-weight: 600; flex: 1; }
    .score-badge {
      background: #6366f1;
      color: white;
      font-size: 14px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 8px;
      margin-left: 12px;
    }
    .card-desc { font-size: 13px; color: #64748b; margin-bottom: 12px; }
    .card-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: 12px;
      color: #475569;
    }
    .card-meta strong { color: #1a1a2e; }
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
    <h1>Prioritized Backlog</h1>
    <div class="subtitle">Strategic prioritization with opportunity mapping</div>
  </div>

  ${session.portfolioSummary ? `
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">P0 Ideas</div>
      <div class="value p0-value">${session.portfolioSummary.byTier.p0}</div>
      <div class="sublabel">Do Now</div>
    </div>
    <div class="summary-card">
      <div class="label">P1 Ideas</div>
      <div class="value p1-value">${session.portfolioSummary.byTier.p1}</div>
      <div class="sublabel">Next Quarter</div>
    </div>
    <div class="summary-card">
      <div class="label">P2/P3 Ideas</div>
      <div class="value p23-value">${session.portfolioSummary.byTier.p2 + session.portfolioSummary.byTier.p3}</div>
      <div class="sublabel">Backlog</div>
    </div>
  </div>
  ` : ''}

  ${ideasHtml}

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
      setTimeout(() => printWindow.print(), 500);
    }
  }
}
