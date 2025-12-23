import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSparkles, lucideTrash2, lucideEye } from '@ng-icons/lucide';
import { OpportunityLinkerService } from './opportunity-linker.service';
import { HlmButtonDirective } from '../../ui/button';

/**
 * Opportunity Linker List Component
 *
 * Displays all prioritized backlog sessions with status and quick actions.
 * Entry point for accessing opportunity linker results.
 */
@Component({
  selector: 'app-opportunity-linker-list',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideSparkles,
      lucideTrash2,
      lucideEye,
    }),
  ],
  template: `
    <div class="p-6">
      <div class="max-w-6xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-foreground">Prioritized Backlogs</h1>
          <p class="mt-2 text-muted-foreground">
            View your AI-generated priority backlogs with opportunity mapping and strategic scoring
          </p>
        </div>

        @if (service.loading()) {
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p class="mt-4 text-muted-foreground">Loading sessions...</p>
            </div>
          </div>
        } @else if (service.error()) {
          <div class="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
            <p class="text-destructive">{{ service.error() }}</p>
          </div>
        } @else if (service.sessions().length === 0) {
          <div class="text-center py-12">
            <ng-icon name="lucideSparkles" class="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 class="mt-4 text-lg font-semibold">No backlogs yet</h3>
            <p class="mt-2 text-muted-foreground">
              Generate a prioritized backlog from your ideation results
            </p>
            <button
              hlmBtn
              class="mt-6"
              (click)="goToIdeation()"
            >
              <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
              Go to Ideation Engine
            </button>
          </div>
        } @else {
          <div class="space-y-4">
            @for (session of service.sessions(); track session.id) {
              <div class="border rounded-lg p-6 hover:border-primary/50 transition-colors">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-3">
                      <h3 class="text-lg font-semibold">
                        Backlog Session #{{ session.id }}
                      </h3>
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        [class.bg-green-100]="session.status === 'completed'"
                        [class.text-green-800]="session.status === 'completed'"
                        [class.bg-blue-100]="session.status === 'mapping' || session.status === 'pending'"
                        [class.text-blue-800]="session.status === 'mapping' || session.status === 'pending'"
                        [class.bg-red-100]="session.status === 'failed'"
                        [class.text-red-800]="session.status === 'failed'"
                      >
                        {{ getStatusLabel(session.status) }}
                      </span>
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">
                      Created {{ formatDate(session.createdAt) }}
                    </p>
                    @if (session.status === 'completed' && session.portfolioSummary) {
                      <div class="mt-3 flex gap-4 text-sm">
                        <div>
                          <span class="font-medium text-green-600">{{ session.portfolioSummary.byTier?.p0 || 0 }}</span>
                          <span class="text-muted-foreground"> P0</span>
                        </div>
                        <div>
                          <span class="font-medium text-blue-600">{{ session.portfolioSummary.byTier?.p1 || 0 }}</span>
                          <span class="text-muted-foreground"> P1</span>
                        </div>
                        <div>
                          <span class="font-medium text-gray-600">{{ session.portfolioSummary.byTier?.p2 || 0 }}</span>
                          <span class="text-muted-foreground"> P2</span>
                        </div>
                        <div>
                          <span class="font-medium text-gray-500">{{ session.portfolioSummary.byTier?.p3 || 0 }}</span>
                          <span class="text-muted-foreground"> P3</span>
                        </div>
                      </div>
                    }
                    @if (session.progressMessage && session.status !== 'completed') {
                      <p class="mt-2 text-sm text-muted-foreground">
                        {{ session.progressMessage }}
                      </p>
                    }
                  </div>
                  <div class="ml-4 flex gap-2">
                    @if (session.status === 'completed') {
                      <button
                        hlmBtn
                        variant="outline"
                        size="sm"
                        (click)="viewResults(session.id)"
                      >
                        <ng-icon name="lucideEye" class="mr-2 h-4 w-4" />
                        View Backlog
                      </button>
                    }
                    <button
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      (click)="deleteSession(session.id)"
                    >
                      <ng-icon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class OpportunityLinkerListComponent implements OnInit {
  service = inject(OpportunityLinkerService);
  private router = inject(Router);

  async ngOnInit() {
    await this.service.loadSessions();
  }

  /**
   * Navigate to ideation engine.
   */
  goToIdeation() {
    this.router.navigate(['/ideation']);
  }

  /**
   * View backlog results for a session.
   */
  viewResults(sessionId: number) {
    this.router.navigate(['/opportunity-linker/results', sessionId]);
  }

  /**
   * Delete a backlog session.
   */
  async deleteSession(sessionId: number) {
    if (confirm('Are you sure you want to delete this backlog?')) {
      await this.service.deleteSession(sessionId);
    }
  }

  /**
   * Get user-friendly status label.
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      mapping: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  /**
   * Format date for display.
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}
