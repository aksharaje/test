import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideRefreshCw,
  lucideAlertCircle,
  lucideAlertTriangle,
  lucideCheckCircle2,
  lucideCircleDot,
  lucideExternalLink,
  lucideClock,
  lucideUser,
  lucideFlag,
  lucideLink2,
  lucideTag,
  lucideFileText,
  lucideTrendingDown,
  lucideSettings,
} from '@ng-icons/lucide';
import { ProgressTrackerService } from './progress-tracker.service';
import type { BlockerSummary, TrackedWorkItem } from './progress-tracker.types';

@Component({
  selector: 'app-progress-tracker-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucideAlertCircle,
      lucideAlertTriangle,
      lucideCheckCircle2,
      lucideCircleDot,
      lucideExternalLink,
      lucideClock,
      lucideUser,
      lucideFlag,
      lucideLink2,
      lucideTag,
      lucideFileText,
      lucideTrendingDown,
      lucideSettings,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-7xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <button hlmBtn variant="ghost" size="sm" routerLink="/progress-tracker">
            <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          </button>
          <div>
            <h1 class="text-2xl font-bold">{{ service.currentSession()?.name || 'Sprint Tracker' }}</h1>
            <p class="text-muted-foreground">
              {{ service.currentSession()?.integrationName }} &middot;
              Last synced: {{ formatSyncTime(service.currentSession()?.lastSyncAt) }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            hlmBtn
            variant="outline"
            (click)="refreshData()"
            [disabled]="service.syncing()"
          >
            <ng-icon
              hlmIcon
              name="lucideRefreshCw"
              class="mr-2 h-4 w-4"
              [class.animate-spin]="service.syncing()"
            />
            {{ service.syncing() ? 'Syncing...' : 'Sync Now' }}
          </button>
        </div>
      </div>

      <!-- Error message -->
      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <!-- Syncing progress -->
      @if (service.isSyncing()) {
        <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex items-center gap-3">
            <ng-icon hlmIcon name="lucideRefreshCw" class="h-5 w-5 text-blue-600 animate-spin" />
            <div class="flex-1">
              <div class="font-medium text-blue-800">
                {{ service.currentSession()?.progressMessage || 'Syncing...' }}
              </div>
              @if (service.currentSession()?.progressTotal) {
                <div class="text-sm text-blue-600">
                  Step {{ service.currentSession()?.progressStep }} of {{ service.currentSession()?.progressTotal }}
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Loading state -->
      @if (service.loading() && !initialized()) {
        <div class="flex items-center justify-center py-12">
          <ng-icon hlmIcon name="lucideRefreshCw" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (service.isReady()) {
        <!-- Metrics Summary -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <!-- Total Items -->
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Total Items</div>
            <div class="text-2xl font-bold">{{ service.metrics()?.totalItems || 0 }}</div>
          </div>

          <!-- To Do -->
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">To Do</div>
            <div class="text-2xl font-bold text-gray-600">{{ service.metrics()?.itemsTodo || 0 }}</div>
          </div>

          <!-- In Progress -->
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">In Progress</div>
            <div class="text-2xl font-bold text-blue-600">{{ service.metrics()?.itemsInProgress || 0 }}</div>
          </div>

          <!-- Done -->
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Done</div>
            <div class="text-2xl font-bold text-green-600">{{ service.metrics()?.itemsDone || 0 }}</div>
          </div>

          <!-- Blocked -->
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Blocked</div>
            <div class="text-2xl font-bold text-red-600">{{ service.metrics()?.blockedItems || 0 }}</div>
          </div>

          <!-- Completion -->
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Completion</div>
            <div class="text-2xl font-bold text-primary">
              {{ (service.metrics()?.completionPercentageItems || 0) | number:'1.0-0' }}%
            </div>
          </div>
        </div>

        <!-- Story Points (if available) -->
        @if (service.metrics()?.totalPoints) {
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-card rounded-lg border p-4">
              <div class="text-sm text-muted-foreground mb-1">Total Points</div>
              <div class="text-xl font-bold">{{ service.metrics()?.totalPoints }}</div>
            </div>
            <div class="bg-card rounded-lg border p-4">
              <div class="text-sm text-muted-foreground mb-1">Points To Do</div>
              <div class="text-xl font-bold text-gray-600">{{ service.metrics()?.pointsTodo || 0 }}</div>
            </div>
            <div class="bg-card rounded-lg border p-4">
              <div class="text-sm text-muted-foreground mb-1">Points In Progress</div>
              <div class="text-xl font-bold text-blue-600">{{ service.metrics()?.pointsInProgress || 0 }}</div>
            </div>
            <div class="bg-card rounded-lg border p-4">
              <div class="text-sm text-muted-foreground mb-1">Points Done</div>
              <div class="text-xl font-bold text-green-600">{{ service.metrics()?.pointsDone || 0 }}</div>
            </div>
          </div>
        }

        <!-- Blockers Section -->
        <div class="bg-card rounded-lg border mb-6">
          <div class="p-4 border-b flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ng-icon hlmIcon name="lucideAlertTriangle" class="h-5 w-5 text-red-600" />
              <h2 class="font-semibold">Detected Blockers</h2>
              <span class="text-sm text-muted-foreground">
                ({{ service.blockers()?.totalBlockers || 0 }} total)
              </span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <span class="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                {{ service.blockers()?.highConfidenceBlockers || 0 }} High
              </span>
              <span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                {{ service.blockers()?.mediumConfidenceBlockers || 0 }} Medium
              </span>
              <span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                {{ service.blockers()?.lowConfidenceBlockers || 0 }} Low
              </span>
            </div>
          </div>

          @if (service.blockers()?.blockers?.length) {
            <div class="divide-y max-h-96 overflow-y-auto">
              @for (blocker of service.blockers()?.blockers; track blocker.itemId) {
                <div class="p-4 hover:bg-muted/30">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-mono text-sm text-muted-foreground">{{ blocker.externalId }}</span>
                        <span class="text-xs px-1.5 py-0.5 bg-muted rounded">{{ blocker.itemType }}</span>
                        <span
                          class="text-xs px-1.5 py-0.5 rounded"
                          [class.bg-red-100]="blocker.blockerConfidence >= 0.8"
                          [class.text-red-700]="blocker.blockerConfidence >= 0.8"
                          [class.bg-yellow-100]="blocker.blockerConfidence >= 0.5 && blocker.blockerConfidence < 0.8"
                          [class.text-yellow-700]="blocker.blockerConfidence >= 0.5 && blocker.blockerConfidence < 0.8"
                          [class.bg-gray-100]="blocker.blockerConfidence < 0.5"
                          [class.text-gray-700]="blocker.blockerConfidence < 0.5"
                        >
                          {{ (blocker.blockerConfidence * 100) | number:'1.0-0' }}% confidence
                        </span>
                      </div>
                      <div class="font-medium truncate">{{ blocker.title }}</div>
                      @if (blocker.blockerReason) {
                        <div class="text-sm text-muted-foreground mt-1">{{ blocker.blockerReason }}</div>
                      }
                      <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        @if (blocker.assignee) {
                          <span class="flex items-center gap-1">
                            <ng-icon hlmIcon name="lucideUser" class="h-3 w-3" />
                            {{ blocker.assignee }}
                          </span>
                        }
                        <span>{{ blocker.status }}</span>
                        @if (blocker.daysInStatus) {
                          <span class="flex items-center gap-1">
                            <ng-icon hlmIcon name="lucideClock" class="h-3 w-3" />
                            {{ blocker.daysInStatus }}d in status
                          </span>
                        }
                        @if (blocker.storyPoints) {
                          <span>{{ blocker.storyPoints }} pts</span>
                        }
                      </div>
                      <!-- Signal indicators -->
                      <div class="flex items-center gap-2 mt-2">
                        @for (signal of getSignalIcons(blocker); track signal.name) {
                          <span
                            class="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                            [class.bg-red-50]="signal.weight > 0.7"
                            [class.text-red-600]="signal.weight > 0.7"
                            [class.bg-yellow-50]="signal.weight <= 0.7 && signal.weight > 0.4"
                            [class.text-yellow-600]="signal.weight <= 0.7 && signal.weight > 0.4"
                            [class.bg-gray-50]="signal.weight <= 0.4"
                            [class.text-gray-600]="signal.weight <= 0.4"
                          >
                            <ng-icon hlmIcon [name]="signal.icon" class="h-3 w-3" />
                            {{ signal.label }}
                          </span>
                        }
                      </div>
                    </div>
                    @if (blocker.externalUrl) {
                      <a
                        [href]="blocker.externalUrl"
                        target="_blank"
                        class="text-muted-foreground hover:text-foreground"
                      >
                        <ng-icon hlmIcon name="lucideExternalLink" class="h-4 w-4" />
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="p-8 text-center text-muted-foreground">
              <ng-icon hlmIcon name="lucideCheckCircle2" class="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p class="font-medium">No blockers detected</p>
              <p class="text-sm">All items are progressing normally</p>
            </div>
          }
        </div>

        <!-- Work Items Section -->
        <div class="bg-card rounded-lg border">
          <div class="p-4 border-b flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ng-icon hlmIcon name="lucideCircleDot" class="h-5 w-5" />
              <h2 class="font-semibold">Work Items</h2>
              <span class="text-sm text-muted-foreground">
                ({{ service.items().length }} items)
              </span>
            </div>
            <div class="flex items-center gap-2">
              <select
                [(ngModel)]="statusFilter"
                (ngModelChange)="filterItems()"
                class="text-sm px-2 py-1 border rounded bg-background"
              >
                <option value="">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <label class="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  [(ngModel)]="blockedOnly"
                  (ngModelChange)="filterItems()"
                  class="rounded"
                />
                Blocked only
              </label>
            </div>
          </div>

          @if (service.items().length > 0) {
            <div class="divide-y max-h-[600px] overflow-y-auto">
              @for (item of service.items(); track item.id) {
                <div class="p-3 hover:bg-muted/30 flex items-center gap-3">
                  <!-- Status indicator -->
                  <div
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    [class.bg-gray-400]="item.statusCategory === 'todo'"
                    [class.bg-blue-500]="item.statusCategory === 'in_progress'"
                    [class.bg-green-500]="item.statusCategory === 'done'"
                  ></div>

                  <!-- Item info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs text-muted-foreground">{{ item.externalId }}</span>
                      <span class="text-xs px-1 py-0.5 bg-muted rounded">{{ item.itemType }}</span>
                      @if (item.isBlocked) {
                        <span class="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1">
                          <ng-icon hlmIcon name="lucideAlertTriangle" class="h-3 w-3" />
                          Blocked
                        </span>
                      }
                    </div>
                    <div class="text-sm font-medium truncate">{{ item.title }}</div>
                  </div>

                  <!-- Assignee -->
                  <div class="text-xs text-muted-foreground w-24 truncate text-right">
                    {{ item.assignee || 'Unassigned' }}
                  </div>

                  <!-- Status -->
                  <div class="text-xs px-2 py-0.5 bg-muted rounded w-24 text-center truncate">
                    {{ item.status }}
                  </div>

                  <!-- Points -->
                  @if (item.storyPoints !== null) {
                    <div class="text-xs font-medium w-8 text-center">{{ item.storyPoints }}p</div>
                  }

                  <!-- External link -->
                  @if (item.externalUrl) {
                    <a
                      [href]="item.externalUrl"
                      target="_blank"
                      class="text-muted-foreground hover:text-foreground"
                    >
                      <ng-icon hlmIcon name="lucideExternalLink" class="h-4 w-4" />
                    </a>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="p-8 text-center text-muted-foreground">
              <p>No items match the current filter</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ProgressTrackerDashboardComponent implements OnInit, OnDestroy {
  protected service = inject(ProgressTrackerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  initialized = signal(false);
  statusFilter = '';
  blockedOnly = false;

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) {
      this.router.navigate(['/progress-tracker']);
      return;
    }

    // Load session and data
    const session = await this.service.getSession(sessionId);
    if (!session) {
      this.router.navigate(['/progress-tracker']);
      return;
    }

    // If syncing, start polling
    if (session.status === 'syncing') {
      this.service.startPolling(sessionId);
    }

    // Load data if ready
    if (session.status === 'ready') {
      await Promise.all([
        this.service.loadMetrics(sessionId),
        this.service.loadBlockers(sessionId),
        this.service.loadItems(sessionId),
      ]);
    }

    this.initialized.set(true);
  }

  ngOnDestroy() {
    this.service.stopPolling();
  }

  async refreshData() {
    const sessionId = this.service.currentSession()?.id;
    if (!sessionId) return;

    await this.service.syncSession(sessionId);
  }

  async filterItems() {
    const sessionId = this.service.currentSession()?.id;
    if (!sessionId) return;

    await this.service.loadItems(sessionId, {
      statusCategory: this.statusFilter || undefined,
      isBlocked: this.blockedOnly || undefined,
    });
  }

  formatSyncTime(dateString: string | null | undefined): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  }

  getSignalIcons(blocker: BlockerSummary): Array<{ name: string; icon: string; label: string; weight: number }> {
    const signals = blocker.blockerSignals || {};
    const icons: Array<{ name: string; icon: string; label: string; weight: number }> = [];

    const signalConfig: Record<string, { icon: string; label: string }> = {
      explicit_flag: { icon: 'lucideFlag', label: 'Flagged' },
      status_based: { icon: 'lucideCircleDot', label: 'Status' },
      label_based: { icon: 'lucideTag', label: 'Label' },
      link_analysis: { icon: 'lucideLink2', label: 'Linked' },
      keyword_analysis: { icon: 'lucideFileText', label: 'Keywords' },
      velocity_anomaly: { icon: 'lucideTrendingDown', label: 'Stale' },
    };

    for (const [key, weight] of Object.entries(signals)) {
      if (weight > 0 && signalConfig[key]) {
        icons.push({
          name: key,
          icon: signalConfig[key].icon,
          label: signalConfig[key].label,
          weight: weight as number,
        });
      }
    }

    return icons.sort((a, b) => b.weight - a.weight);
  }
}
