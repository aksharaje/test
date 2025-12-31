import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideRefreshCw,
  lucideAlertCircle,
  lucideCheck,
  lucideLink2,
  lucideArrowRight,
  lucideTrash2,
  lucideClock,
  lucideAlertTriangle,
  lucideCheckCircle2,
  lucideCircleDot,
  lucideExternalLink,
} from '@ng-icons/lucide';
import { ProgressTrackerService } from './progress-tracker.service';
import type { TrackerSession } from './progress-tracker.types';

@Component({
  selector: 'app-progress-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucidePlus,
      lucideRefreshCw,
      lucideAlertCircle,
      lucideCheck,
      lucideLink2,
      lucideArrowRight,
      lucideTrash2,
      lucideClock,
      lucideAlertTriangle,
      lucideCheckCircle2,
      lucideCircleDot,
      lucideExternalLink,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-6xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Progress & Blocker Tracker</h1>
          <p class="text-muted-foreground mt-1">
            Track sprint progress and detect blockers across your team
          </p>
        </div>
        @if (service.hasValidIntegration()) {
          <button hlmBtn variant="default" (click)="createNewSession()">
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            New Tracker
          </button>
        }
      </div>

      <!-- Error message -->
      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <!-- Loading state -->
      @if (service.loading() && !initialized()) {
        <div class="flex items-center justify-center py-12">
          <ng-icon hlmIcon name="lucideRefreshCw" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else {
        <!-- No integration warning -->
        @if (!service.hasValidIntegration()) {
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <ng-icon hlmIcon name="lucideLink2" class="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 class="text-lg font-semibold text-yellow-800 mb-2">Integration Required</h2>
            <p class="text-yellow-700 mb-4 max-w-md mx-auto">
              {{ service.integrationCheck()?.message || 'Connect your Jira or Azure DevOps account to start tracking progress and blockers.' }}
            </p>
            <a hlmBtn variant="default" routerLink="/settings/integrations">
              <ng-icon hlmIcon name="lucideArrowRight" class="mr-2 h-4 w-4" />
              Go to Integrations
            </a>
          </div>
        } @else {
          <!-- Sessions list -->
          @if (service.sessions().length === 0) {
            <div class="bg-muted/30 border-2 border-dashed rounded-lg p-12 text-center">
              <ng-icon hlmIcon name="lucideCircleDot" class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 class="text-lg font-semibold mb-2">No Trackers Yet</h2>
              <p class="text-muted-foreground mb-4 max-w-md mx-auto">
                Create a tracker to monitor sprint progress and automatically detect blockers.
              </p>
              <button hlmBtn variant="default" (click)="createNewSession()">
                <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
                Create Your First Tracker
              </button>
            </div>
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="bg-card rounded-lg border p-5 hover:border-primary/50 transition-colors cursor-pointer"
                  (click)="openSession(session)"
                >
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <h3 class="font-semibold">{{ session.name }}</h3>
                      <p class="text-sm text-muted-foreground">
                        {{ session.integrationName || 'Unknown' }} &middot; {{ session.templateId }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1">
                      @if (session.status === 'ready') {
                        <span class="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <ng-icon hlmIcon name="lucideCheckCircle2" class="h-3 w-3" />
                          Ready
                        </span>
                      } @else if (session.status === 'syncing') {
                        <span class="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <ng-icon hlmIcon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                          Syncing
                        </span>
                      } @else if (session.status === 'error') {
                        <span class="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <ng-icon hlmIcon name="lucideAlertCircle" class="h-3 w-3" />
                          Error
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      }
                    </div>
                  </div>

                  @if (session.status === 'ready' && hasMetrics(session)) {
                    <div class="grid grid-cols-3 gap-2 mb-3">
                      <div class="text-center p-2 bg-muted/50 rounded">
                        <div class="text-lg font-bold">{{ session.itemsSynced }}</div>
                        <div class="text-xs text-muted-foreground">Items</div>
                      </div>
                      <div class="text-center p-2 bg-muted/50 rounded">
                        <div class="text-lg font-bold text-red-600">{{ session.blockersDetected }}</div>
                        <div class="text-xs text-muted-foreground">Blocked</div>
                      </div>
                      <div class="text-center p-2 bg-muted/50 rounded">
                        <div class="text-lg font-bold text-green-600">
                          {{ getCompletionPercent(session) }}%
                        </div>
                        <div class="text-xs text-muted-foreground">Complete</div>
                      </div>
                    </div>
                  }

                  <div class="flex items-center justify-between text-xs text-muted-foreground">
                    @if (session.lastSyncAt) {
                      <span class="flex items-center gap-1">
                        <ng-icon hlmIcon name="lucideClock" class="h-3 w-3" />
                        {{ formatRelativeTime(session.lastSyncAt) }}
                      </span>
                    } @else {
                      <span>Never synced</span>
                    }
                    <button
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      class="h-6 w-6 p-0"
                      (click)="confirmDelete(session, $event)"
                    >
                      <ng-icon hlmIcon name="lucideTrash2" class="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        }
      }

      <!-- Delete confirmation dialog -->
      @if (deleteCandidate()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="deleteCandidate.set(null)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-2">Delete Tracker</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{{ deleteCandidate()?.name }}</strong>?
              This will remove all tracked data.
            </p>
            <div class="flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="deleteCandidate.set(null)">Cancel</button>
              <button hlmBtn variant="destructive" (click)="doDelete()">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProgressTrackerComponent implements OnInit {
  protected service = inject(ProgressTrackerService);
  private router = inject(Router);

  initialized = signal(false);
  deleteCandidate = signal<TrackerSession | null>(null);

  async ngOnInit() {
    await this.service.checkIntegrations();
    if (this.service.hasValidIntegration()) {
      await this.service.loadSessions();
    }
    this.initialized.set(true);
  }

  createNewSession() {
    this.router.navigate(['/progress-tracker/new']);
  }

  openSession(session: TrackerSession) {
    this.router.navigate(['/progress-tracker', session.id]);
  }

  confirmDelete(session: TrackerSession, event: Event) {
    event.stopPropagation();
    this.deleteCandidate.set(session);
  }

  async doDelete() {
    const session = this.deleteCandidate();
    if (!session) return;

    await this.service.deleteSession(session.id);
    this.deleteCandidate.set(null);
  }

  hasMetrics(session: TrackerSession): boolean {
    const snapshot = session.metricsSnapshot;
    return !!snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0;
  }

  getCompletionPercent(session: TrackerSession): number {
    const snapshot = session.metricsSnapshot;
    if (!snapshot || typeof snapshot !== 'object') return 0;
    return Math.round((snapshot as { completionPercentageItems?: number }).completionPercentageItems || 0);
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}
