import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSparkles, lucideArrowLeft, lucideDownload } from '@ng-icons/lucide';
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
            <button hlmBtn (click)="exportResults()">
              <ng-icon name="lucideDownload" class="mr-2 h-4 w-4" />
              Export
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
}
