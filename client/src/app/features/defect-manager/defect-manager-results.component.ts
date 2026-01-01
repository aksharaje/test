import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
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
  lucideBug,
  lucideExternalLink,
  lucideCopy,
  lucideChevronDown,
  lucideChevronUp,
  lucideLightbulb,
  lucideShield,
  lucideTestTube,
  lucideUsers,
  lucideSettings,
} from '@ng-icons/lucide';
import { DefectManagerService } from './defect-manager.service';
import type { AnalyzedDefect, PreventionRecommendation } from './defect-manager.types';

@Component({
  selector: 'app-defect-manager-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucideAlertCircle,
      lucideAlertTriangle,
      lucideCheckCircle2,
      lucideBug,
      lucideExternalLink,
      lucideCopy,
      lucideChevronDown,
      lucideChevronUp,
      lucideLightbulb,
      lucideShield,
      lucideTestTube,
      lucideUsers,
      lucideSettings,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-7xl">
      <!-- Header -->
      <div class="mb-6">
        <a routerLink="/testing/defect-manager" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          Back to Defect Manager
        </a>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{{ service.currentSession()?.name || 'Defect Analysis' }}</h1>
            <p class="text-muted-foreground mt-1">
              {{ service.currentSession()?.integrationName }} &middot;
              Data Level {{ service.currentSession()?.dataLevel }}
            </p>
          </div>
          @if (service.isReady()) {
            <button hlmBtn variant="outline" (click)="reanalyze()">
              <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
              Re-analyze
            </button>
          }
        </div>
      </div>

      <!-- Error message -->
      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <!-- Analyzing state -->
      @if (service.isAnalyzing()) {
        <div class="bg-card rounded-lg border p-8 text-center">
          <ng-icon hlmIcon name="lucideRefreshCw" class="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 class="text-xl font-semibold mb-2">Analyzing Defects...</h2>
          <p class="text-muted-foreground mb-4">
            {{ service.currentSession()?.progressMessage || 'Fetching and analyzing defect data' }}
          </p>
          <div class="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
            <div
              class="bg-primary h-2 rounded-full transition-all"
              [style.width.%]="progressPercent()"
            ></div>
          </div>
          <p class="text-sm text-muted-foreground mt-2">
            Step {{ service.currentSession()?.progressStep || 0 }} of {{ service.currentSession()?.progressTotal || 5 }}
          </p>
        </div>
      } @else if (service.currentSession()?.status === 'error') {
        <div class="bg-card rounded-lg border p-8 text-center">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 class="text-xl font-semibold mb-2">Analysis Failed</h2>
          <p class="text-muted-foreground mb-4">
            {{ service.currentSession()?.errorMessage || 'An error occurred during analysis' }}
          </p>
          <button hlmBtn variant="default" (click)="reanalyze()">
            <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
            Try Again
          </button>
        </div>
      } @else if (service.isReady()) {
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Total Defects</div>
            <div class="text-3xl font-bold">{{ service.triageResult()?.totalDefects || 0 }}</div>
          </div>
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Critical Open</div>
            <div class="text-3xl font-bold text-red-600">{{ service.triageResult()?.criticalOpen || 0 }}</div>
          </div>
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Potential Duplicates</div>
            <div class="text-3xl font-bold text-orange-600">{{ service.triageResult()?.potentialDuplicates || 0 }}</div>
          </div>
          <div class="bg-card rounded-lg border p-4">
            <div class="text-sm text-muted-foreground mb-1">Aging (>14 days)</div>
            <div class="text-3xl font-bold text-yellow-600">{{ service.triageResult()?.agingDefects || 0 }}</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b mb-6">
          <button
            class="px-4 py-2 font-medium border-b-2 -mb-px transition-colors"
            [class.border-primary]="activeTab() === 'triage'"
            [class.text-foreground]="activeTab() === 'triage'"
            [class.border-transparent]="activeTab() !== 'triage'"
            [class.text-muted-foreground]="activeTab() !== 'triage'"
            (click)="activeTab.set('triage')"
          >
            Defect Triage
          </button>
          <button
            class="px-4 py-2 font-medium border-b-2 -mb-px transition-colors"
            [class.border-primary]="activeTab() === 'insights'"
            [class.text-foreground]="activeTab() === 'insights'"
            [class.border-transparent]="activeTab() !== 'insights'"
            [class.text-muted-foreground]="activeTab() !== 'insights'"
            (click)="activeTab.set('insights')"
          >
            Insights & Patterns
          </button>
          <button
            class="px-4 py-2 font-medium border-b-2 -mb-px transition-colors"
            [class.border-primary]="activeTab() === 'recommendations'"
            [class.text-foreground]="activeTab() === 'recommendations'"
            [class.border-transparent]="activeTab() !== 'recommendations'"
            [class.text-muted-foreground]="activeTab() !== 'recommendations'"
            (click)="activeTab.set('recommendations')"
          >
            Prevention Recommendations
          </button>
        </div>

        <!-- Triage Tab -->
        @if (activeTab() === 'triage') {
          <div class="space-y-4">
            <!-- Filters -->
            <div class="flex gap-4 mb-4">
              <select
                class="px-3 py-2 border rounded-lg bg-background"
                [(ngModel)]="severityFilter"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                class="px-3 py-2 border rounded-lg bg-background"
                [(ngModel)]="statusFilter"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <!-- Defect List -->
            @for (defect of filteredDefects(); track defect.id) {
              <div class="bg-card rounded-lg border p-4 hover:border-primary/30 transition-colors">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span [class]="getSeverityClass(defect.severity)" class="text-xs px-2 py-0.5 rounded-full font-medium">
                        {{ defect.severity | uppercase }}
                      </span>
                      <span class="text-xs text-muted-foreground">{{ defect.externalId }}</span>
                      @if (defect.duplicateOf) {
                        <span class="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          Potential duplicate of {{ defect.duplicateOf }}
                        </span>
                      }
                    </div>
                    <h3 class="font-medium mb-1">{{ defect.title }}</h3>
                    <div class="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>Status: {{ defect.status }}</span>
                      @if (defect.component) {
                        <span>Component: {{ defect.component }}</span>
                      }
                      @if (defect.assignee) {
                        <span>Assignee: {{ defect.assignee }}</span>
                      }
                      @if (defect.daysOpen !== null) {
                        <span [class.text-red-600]="defect.daysOpen > 14">
                          Open: {{ defect.daysOpen }} days
                        </span>
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    @if (defect.externalUrl) {
                      <a
                        [href]="defect.externalUrl"
                        target="_blank"
                        hlmBtn
                        variant="ghost"
                        size="sm"
                        class="h-8 w-8 p-0"
                      >
                        <ng-icon hlmIcon name="lucideExternalLink" class="h-4 w-4" />
                      </a>
                    }
                  </div>
                </div>

                @if (defect.suggestedPriority !== null) {
                  <div class="mt-3 pt-3 border-t">
                    <div class="text-sm">
                      <span class="font-medium">Suggested Priority:</span>
                      <span class="ml-2">{{ defect.suggestedPriority }}</span>
                      @if (defect.priorityReasoning) {
                        <span class="text-muted-foreground ml-2">- {{ defect.priorityReasoning }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            } @empty {
              <div class="text-center py-8 text-muted-foreground">
                No defects match the current filters
              </div>
            }
          </div>
        }

        <!-- Insights Tab -->
        @if (activeTab() === 'insights') {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- By Severity -->
            <div class="bg-card rounded-lg border p-4">
              <h3 class="font-semibold mb-4">By Severity</h3>
              @for (item of severityBreakdown(); track item.severity) {
                <div class="flex items-center justify-between py-2 border-b last:border-0">
                  <span [class]="getSeverityTextClass(item.severity)" class="font-medium capitalize">
                    {{ item.severity }}
                  </span>
                  <div class="flex items-center gap-2">
                    <div class="w-24 bg-muted rounded-full h-2">
                      <div
                        [class]="getSeverityBgClass(item.severity)"
                        class="h-2 rounded-full"
                        [style.width.%]="item.percent"
                      ></div>
                    </div>
                    <span class="text-sm font-medium w-8 text-right">{{ item.count }}</span>
                  </div>
                </div>
              }
            </div>

            <!-- By Component -->
            <div class="bg-card rounded-lg border p-4">
              <h3 class="font-semibold mb-4">By Component</h3>
              @for (item of componentBreakdown(); track item.component) {
                <div class="flex items-center justify-between py-2 border-b last:border-0">
                  <span class="font-medium">{{ item.component || 'Unassigned' }}</span>
                  <div class="flex items-center gap-2">
                    <div class="w-24 bg-muted rounded-full h-2">
                      <div class="bg-primary h-2 rounded-full" [style.width.%]="item.percent"></div>
                    </div>
                    <span class="text-sm font-medium w-8 text-right">{{ item.count }}</span>
                  </div>
                </div>
              }
            </div>

            <!-- By Status -->
            <div class="bg-card rounded-lg border p-4">
              <h3 class="font-semibold mb-4">By Status</h3>
              @for (item of statusBreakdown(); track item.status) {
                <div class="flex items-center justify-between py-2 border-b last:border-0">
                  <span class="font-medium capitalize">{{ item.status }}</span>
                  <div class="flex items-center gap-2">
                    <div class="w-24 bg-muted rounded-full h-2">
                      <div class="bg-blue-500 h-2 rounded-full" [style.width.%]="item.percent"></div>
                    </div>
                    <span class="text-sm font-medium w-8 text-right">{{ item.count }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Recommendations Tab -->
        @if (activeTab() === 'recommendations') {
          <div class="space-y-4">
            @for (rec of service.recommendations(); track rec.id) {
              <div class="bg-card rounded-lg border p-5">
                <div class="flex items-start gap-4">
                  <div class="w-10 h-10 rounded-lg flex items-center justify-center" [class]="getRecCategoryBg(rec.category)">
                    <ng-icon hlmIcon [name]="getRecCategoryIcon(rec.category)" class="h-5 w-5" [class]="getRecCategoryColor(rec.category)" />
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span [class]="getRecPriorityClass(rec.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium uppercase">
                        {{ rec.priority }}
                      </span>
                      <span class="text-xs text-muted-foreground capitalize">{{ rec.category }}</span>
                    </div>
                    <h3 class="font-semibold mb-2">{{ rec.title }}</h3>
                    <p class="text-muted-foreground text-sm mb-3">{{ rec.description }}</p>
                    <div class="text-xs text-muted-foreground mb-3">
                      Based on: {{ rec.basedOn }}
                    </div>
                    @if (rec.actions.length > 0) {
                      <div class="space-y-1">
                        <div class="text-sm font-medium">Recommended Actions:</div>
                        <ul class="text-sm text-muted-foreground space-y-1">
                          @for (action of rec.actions; track action) {
                            <li class="flex items-start gap-2">
                              <span class="text-primary mt-1">•</span>
                              {{ action }}
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="text-center py-8 text-muted-foreground">
                <ng-icon hlmIcon name="lucideLightbulb" class="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No prevention recommendations available yet.</p>
                <p class="text-sm">Run a full analysis to generate insights.</p>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class DefectManagerResultsComponent implements OnInit, OnDestroy {
  protected service = inject(DefectManagerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab = signal<'triage' | 'insights' | 'recommendations'>('triage');
  severityFilter = '';
  statusFilter = '';

  progressPercent = computed(() => {
    const session = this.service.currentSession();
    if (!session) return 0;
    return Math.round((session.progressStep / session.progressTotal) * 100);
  });

  filteredDefects = computed(() => {
    const defects = this.service.triageResult()?.defects || [];
    return defects.filter((d) => {
      if (this.severityFilter && d.severity !== this.severityFilter) return false;
      if (this.statusFilter && d.statusCategory !== this.statusFilter) return false;
      return true;
    });
  });

  severityBreakdown = computed(() => {
    const bySeverity = this.service.triageResult()?.bySeverity || {};
    const total = this.service.triageResult()?.totalDefects || 1;
    return Object.entries(bySeverity).map(([severity, count]) => ({
      severity,
      count,
      percent: Math.round((count / total) * 100),
    }));
  });

  componentBreakdown = computed(() => {
    const byComponent = this.service.triageResult()?.byComponent || {};
    const total = this.service.triageResult()?.totalDefects || 1;
    return Object.entries(byComponent)
      .map(([component, count]) => ({
        component,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  statusBreakdown = computed(() => {
    const byStatus = this.service.triageResult()?.byStatus || {};
    const total = this.service.triageResult()?.totalDefects || 1;
    return Object.entries(byStatus).map(([status, count]) => ({
      status,
      count,
      percent: Math.round((count / total) * 100),
    }));
  });

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) {
      this.router.navigate(['/testing/defect-manager']);
      return;
    }

    await this.service.getSession(sessionId);
    const session = this.service.currentSession();

    if (session?.status === 'analyzing') {
      this.service.startPolling(sessionId);
    } else if (session?.status === 'ready') {
      await Promise.all([
        this.service.loadTriageResult(sessionId),
        this.service.loadRecommendations(sessionId),
      ]);
    }
  }

  ngOnDestroy() {
    this.service.stopPolling();
  }

  async reanalyze() {
    const sessionId = this.service.currentSession()?.id;
    if (sessionId) {
      await this.service.analyzeSession(sessionId);
    }
  }

  getSeverityClass(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getSeverityTextClass(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  }

  getSeverityBgClass(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  }

  getRecCategoryIcon(category: string): string {
    switch (category) {
      case 'testing':
        return 'lucideTestTube';
      case 'process':
        return 'lucideSettings';
      case 'training':
        return 'lucideUsers';
      case 'tooling':
        return 'lucideSettings';
      default:
        return 'lucideLightbulb';
    }
  }

  getRecCategoryBg(category: string): string {
    switch (category) {
      case 'testing':
        return 'bg-blue-100';
      case 'process':
        return 'bg-purple-100';
      case 'training':
        return 'bg-green-100';
      case 'tooling':
        return 'bg-orange-100';
      default:
        return 'bg-gray-100';
    }
  }

  getRecCategoryColor(category: string): string {
    switch (category) {
      case 'testing':
        return 'text-blue-600';
      case 'process':
        return 'text-purple-600';
      case 'training':
        return 'text-green-600';
      case 'tooling':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }

  getRecPriorityClass(priority: string): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
