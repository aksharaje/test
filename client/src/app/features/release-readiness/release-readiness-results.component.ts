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
  lucideXCircle,
  lucidePackageCheck,
  lucideExternalLink,
  lucideBug,
  lucideListChecks,
  lucideTestTube,
  lucideClipboardCheck,
  lucideShieldAlert,
  lucideFileText,
} from '@ng-icons/lucide';
import { ReleaseReadinessService } from './release-readiness.service';
import type { ComponentScore, Risk } from './release-readiness.types';

@Component({
  selector: 'app-release-readiness-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucideAlertCircle,
      lucideAlertTriangle,
      lucideCheckCircle2,
      lucideXCircle,
      lucidePackageCheck,
      lucideExternalLink,
      lucideBug,
      lucideListChecks,
      lucideTestTube,
      lucideClipboardCheck,
      lucideShieldAlert,
      lucideFileText,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-7xl">
      <!-- Header -->
      <div class="mb-6">
        <a routerLink="/testing/release-readiness" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          Back to Release Readiness
        </a>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{{ service.currentSession()?.name || 'Release Assessment' }}</h1>
            <p class="text-muted-foreground mt-1">
              {{ service.currentSession()?.releaseIdentifier }} &middot;
              {{ service.currentSession()?.releaseType }}
            </p>
          </div>
          @if (service.isReady()) {
            <div class="flex items-center gap-2">
              <button hlmBtn variant="outline" (click)="exportToPdf()">
                <ng-icon hlmIcon name="lucideFileText" class="mr-2 h-4 w-4" />
                Export PDF
              </button>
              <button hlmBtn variant="outline" (click)="reassess()">
                <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
                Re-assess
              </button>
            </div>
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

      <!-- Assessing state -->
      @if (service.isAssessing()) {
        <div class="bg-card rounded-lg border p-8 text-center">
          <ng-icon hlmIcon name="lucideRefreshCw" class="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 class="text-xl font-semibold mb-2">Assessing Release...</h2>
          <p class="text-muted-foreground mb-4">
            {{ service.currentSession()?.progressMessage || 'Fetching and analyzing release data' }}
          </p>
          <div class="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
            <div
              class="bg-primary h-2 rounded-full transition-all"
              [style.width.%]="progressPercent()"
            ></div>
          </div>
          <p class="text-sm text-muted-foreground mt-2">
            Step {{ service.currentSession()?.progressStep || 0 }} of {{ service.currentSession()?.progressTotal || 6 }}
          </p>
        </div>
      } @else if (service.currentSession()?.status === 'error') {
        <div class="bg-card rounded-lg border p-8 text-center">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 class="text-xl font-semibold mb-2">Assessment Failed</h2>
          <p class="text-muted-foreground mb-4">
            {{ service.currentSession()?.errorMessage || 'An error occurred during assessment' }}
          </p>
          <button hlmBtn variant="default" (click)="reassess()">
            <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
            Try Again
          </button>
        </div>
      } @else if (service.isReady()) {
        <!-- Recommendation Banner -->
        <div class="rounded-lg border p-6 mb-6" [class]="getRecommendationBannerClass()">
          <div class="flex items-start gap-4">
            <div class="w-16 h-16 rounded-full flex items-center justify-center" [class]="getRecommendationIconBg()">
              <ng-icon hlmIcon [name]="getRecommendationIcon()" class="h-8 w-8" [class]="getRecommendationIconColor()" />
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h2 class="text-2xl font-bold" [class]="getRecommendationTextColor()">
                  {{ getRecommendationLabel() }}
                </h2>
                <span class="text-sm px-2 py-0.5 rounded-full" [class]="getConfidenceClass()">
                  {{ service.currentSession()?.confidenceLevel | titlecase }} Confidence
                </span>
              </div>
              <p class="text-muted-foreground mb-3">
                {{ service.currentSession()?.recommendationDetails?.summary || 'Assessment complete' }}
              </p>
              <div class="flex items-center gap-6">
                <div>
                  <div class="text-sm text-muted-foreground">Readiness Score</div>
                  <div class="text-3xl font-bold" [class]="getScoreColor()">
                    {{ service.currentSession()?.readinessScore || 0 }}%
                  </div>
                </div>
                <div class="w-48">
                  <div class="w-full bg-muted/50 rounded-full h-3">
                    <div
                      class="h-3 rounded-full transition-all"
                      [class]="getScoreBgClass()"
                      [style.width.%]="service.currentSession()?.readinessScore || 0"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Risks Section -->
        @if ((service.currentSession()?.recommendationDetails?.risks?.length || 0) > 0) {
          <div class="bg-card rounded-lg border p-5 mb-6">
            <h3 class="font-semibold mb-4 flex items-center gap-2">
              <ng-icon hlmIcon name="lucideShieldAlert" class="h-5 w-5 text-orange-500" />
              Identified Risks
            </h3>
            <div class="space-y-3">
              @for (risk of service.currentSession()?.recommendationDetails?.risks || []; track risk.description) {
                <div class="flex items-start gap-3 p-3 rounded-lg" [class]="getRiskBg(risk.level)">
                  <div class="w-2 h-2 rounded-full mt-1.5" [class]="getRiskDot(risk.level)"></div>
                  <div>
                    <div class="font-medium text-sm">{{ risk.area }}</div>
                    <div class="text-sm text-muted-foreground">{{ risk.description }}</div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Component Scores Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          @for (component of componentScoresList(); track component.key) {
            <div class="bg-card rounded-lg border p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon hlmIcon [name]="getComponentIcon(component.key)" class="h-5 w-5 text-primary" />
                <span class="font-medium">{{ component.value.name }}</span>
              </div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-2xl font-bold" [class]="getComponentScoreColor(component.value)">
                  {{ component.value.score }}
                </span>
                <span class="text-sm text-muted-foreground">
                  / {{ component.value.maxScore }}
                </span>
              </div>
              <div class="w-full bg-muted rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  [class]="getComponentScoreBg(component.value)"
                  [style.width.%]="getComponentPercent(component.value)"
                ></div>
              </div>
              @if (component.value.details) {
                <p class="text-xs text-muted-foreground mt-2">{{ component.value.details }}</p>
              }
            </div>
          }
        </div>

        <!-- Tabs -->
        <div class="flex border-b mb-6">
          <button
            class="px-4 py-2 font-medium border-b-2 -mb-px transition-colors"
            [class.border-primary]="activeTab() === 'defects'"
            [class.text-foreground]="activeTab() === 'defects'"
            [class.border-transparent]="activeTab() !== 'defects'"
            [class.text-muted-foreground]="activeTab() !== 'defects'"
            (click)="activeTab.set('defects')"
          >
            Defect Status
          </button>
          <button
            class="px-4 py-2 font-medium border-b-2 -mb-px transition-colors"
            [class.border-primary]="activeTab() === 'completion'"
            [class.text-foreground]="activeTab() === 'completion'"
            [class.border-transparent]="activeTab() !== 'completion'"
            [class.text-muted-foreground]="activeTab() !== 'completion'"
            (click)="activeTab.set('completion')"
          >
            Work Completion
          </button>
          <button
            class="px-4 py-2 font-medium border-b-2 -mb-px transition-colors"
            [class.border-primary]="activeTab() === 'mitigations'"
            [class.text-foreground]="activeTab() === 'mitigations'"
            [class.border-transparent]="activeTab() !== 'mitigations'"
            [class.text-muted-foreground]="activeTab() !== 'mitigations'"
            (click)="activeTab.set('mitigations')"
          >
            Mitigations
          </button>
        </div>

        <!-- Defects Tab -->
        @if (activeTab() === 'defects') {
          <div class="bg-card rounded-lg border p-5">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div class="text-center p-3 bg-muted/50 rounded-lg">
                <div class="text-2xl font-bold">{{ service.defectReport()?.totalDefects || 0 }}</div>
                <div class="text-xs text-muted-foreground">Total Defects</div>
              </div>
              <div class="text-center p-3 bg-red-50 rounded-lg">
                <div class="text-2xl font-bold text-red-600">{{ service.defectReport()?.openCritical || 0 }}</div>
                <div class="text-xs text-muted-foreground">Critical</div>
              </div>
              <div class="text-center p-3 bg-orange-50 rounded-lg">
                <div class="text-2xl font-bold text-orange-600">{{ service.defectReport()?.openHigh || 0 }}</div>
                <div class="text-xs text-muted-foreground">High</div>
              </div>
              <div class="text-center p-3 bg-yellow-50 rounded-lg">
                <div class="text-2xl font-bold text-yellow-600">{{ service.defectReport()?.openMedium || 0 }}</div>
                <div class="text-xs text-muted-foreground">Medium</div>
              </div>
              <div class="text-center p-3 bg-green-50 rounded-lg">
                <div class="text-2xl font-bold text-green-600">{{ service.defectReport()?.resolved || 0 }}</div>
                <div class="text-xs text-muted-foreground">Resolved</div>
              </div>
            </div>

            @if ((service.defectReport()?.blockingDefects || 0) > 0) {
              <div class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div class="flex items-center gap-2 text-red-800">
                  <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5" />
                  <strong>{{ service.defectReport()?.blockingDefects }} blocking defects</strong> must be resolved before release
                </div>
              </div>
            }

            @if ((service.defectReport()?.defects?.length || 0) > 0) {
              <div class="space-y-2">
                @for (defect of service.defectReport()?.defects || []; track defect.id) {
                  <div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-mono text-muted-foreground">{{ defect.externalId }}</span>
                      <span class="font-medium">{{ defect.title }}</span>
                      @if (defect.isBlocking) {
                        <span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Blocking</span>
                      }
                    </div>
                    @if (defect.externalUrl) {
                      <a [href]="defect.externalUrl" target="_blank" hlmBtn variant="ghost" size="sm">
                        <ng-icon hlmIcon name="lucideExternalLink" class="h-4 w-4" />
                      </a>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="text-center py-8 text-muted-foreground">
                No defects found for this release
              </div>
            }
          </div>
        }

        <!-- Completion Tab -->
        @if (activeTab() === 'completion') {
          <div class="bg-card rounded-lg border p-5">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="text-center p-3 bg-muted/50 rounded-lg">
                <div class="text-2xl font-bold">{{ service.completionReport()?.totalItems || 0 }}</div>
                <div class="text-xs text-muted-foreground">Total Items</div>
              </div>
              <div class="text-center p-3 bg-green-50 rounded-lg">
                <div class="text-2xl font-bold text-green-600">{{ service.completionReport()?.completed || 0 }}</div>
                <div class="text-xs text-muted-foreground">Completed</div>
              </div>
              <div class="text-center p-3 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">{{ service.completionReport()?.inProgress || 0 }}</div>
                <div class="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded-lg">
                <div class="text-2xl font-bold text-gray-600">{{ service.completionReport()?.todo || 0 }}</div>
                <div class="text-xs text-muted-foreground">To Do</div>
              </div>
            </div>

            <div class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">Item Completion</span>
                <span class="text-sm font-bold">{{ service.completionReport()?.completionPercent || 0 }}%</span>
              </div>
              <div class="w-full bg-muted rounded-full h-3">
                <div
                  class="bg-primary h-3 rounded-full transition-all"
                  [style.width.%]="service.completionReport()?.completionPercent || 0"
                ></div>
              </div>
            </div>

            @if (service.completionReport()?.totalPoints) {
              <div class="mb-6">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium">Points Completion</span>
                  <span class="text-sm font-bold">{{ service.completionReport()?.pointsCompletionPercent || 0 }}%</span>
                </div>
                <div class="w-full bg-muted rounded-full h-3">
                  <div
                    class="bg-blue-500 h-3 rounded-full transition-all"
                    [style.width.%]="service.completionReport()?.pointsCompletionPercent || 0"
                  ></div>
                </div>
                <div class="text-xs text-muted-foreground mt-1">
                  {{ service.completionReport()?.completedPoints || 0 }} / {{ service.completionReport()?.totalPoints }} points
                </div>
              </div>
            }

            <div class="p-4 bg-muted/30 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <ng-icon hlmIcon name="lucideClipboardCheck" class="h-5 w-5 text-primary" />
                <span class="font-medium">Acceptance Criteria Coverage</span>
              </div>
              <div class="text-2xl font-bold">{{ service.completionReport()?.itemsWithACPercent || 0 }}%</div>
              <div class="text-sm text-muted-foreground">
                {{ service.completionReport()?.itemsWithAC || 0 }} of {{ service.completionReport()?.totalItems || 0 }} items have acceptance criteria
              </div>
            </div>
          </div>
        }

        <!-- Mitigations Tab -->
        @if (activeTab() === 'mitigations') {
          <div class="bg-card rounded-lg border p-5">
            @if ((service.currentSession()?.recommendationDetails?.mitigations?.length || 0) > 0) {
              <div class="space-y-3">
                @for (mitigation of service.currentSession()?.recommendationDetails?.mitigations || []; track mitigation; let i = $index) {
                  <div class="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                    <div class="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {{ i + 1 }}
                    </div>
                    <div class="flex-1">{{ mitigation }}</div>
                  </div>
                }
              </div>
            } @else {
              <div class="text-center py-8 text-muted-foreground">
                <ng-icon hlmIcon name="lucideCheckCircle2" class="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No mitigations required</p>
                <p class="text-sm">Your release appears ready to ship!</p>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ReleaseReadinessResultsComponent implements OnInit, OnDestroy {
  protected service = inject(ReleaseReadinessService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab = signal<'defects' | 'completion' | 'mitigations'>('defects');

  progressPercent = computed(() => {
    const session = this.service.currentSession();
    if (!session) return 0;
    return Math.round((session.progressStep / session.progressTotal) * 100);
  });

  componentScoresList = computed(() => {
    const scores = this.service.currentSession()?.componentScores || {};
    return Object.entries(scores).map(([key, value]) => ({ key, value }));
  });

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) {
      this.router.navigate(['/testing/release-readiness']);
      return;
    }

    await this.service.getSession(sessionId);
    const session = this.service.currentSession();

    if (session?.status === 'assessing') {
      this.service.startPolling(sessionId);
    } else if (session?.status === 'ready') {
      await Promise.all([
        this.service.loadDefectReport(sessionId),
        this.service.loadCompletionReport(sessionId),
        this.service.loadAssessment(sessionId),
      ]);
    }
  }

  ngOnDestroy() {
    this.service.stopPolling();
  }

  async reassess() {
    const sessionId = this.service.currentSession()?.id;
    if (sessionId) {
      await this.service.assessRelease(sessionId);
    }
  }

  getRecommendationLabel(): string {
    switch (this.service.currentSession()?.recommendation) {
      case 'go':
        return 'GO - Ready to Release';
      case 'no_go':
        return 'NO-GO - Not Ready';
      case 'conditional_go':
        return 'CONDITIONAL GO - Proceed with Caution';
      default:
        return 'Pending Assessment';
    }
  }

  getRecommendationIcon(): string {
    switch (this.service.currentSession()?.recommendation) {
      case 'go':
        return 'lucideCheckCircle2';
      case 'no_go':
        return 'lucideXCircle';
      case 'conditional_go':
        return 'lucideAlertTriangle';
      default:
        return 'lucidePackageCheck';
    }
  }

  getRecommendationBannerClass(): string {
    switch (this.service.currentSession()?.recommendation) {
      case 'go':
        return 'bg-green-50 border-green-200';
      case 'no_go':
        return 'bg-red-50 border-red-200';
      case 'conditional_go':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-muted';
    }
  }

  getRecommendationIconBg(): string {
    switch (this.service.currentSession()?.recommendation) {
      case 'go':
        return 'bg-green-100';
      case 'no_go':
        return 'bg-red-100';
      case 'conditional_go':
        return 'bg-yellow-100';
      default:
        return 'bg-muted';
    }
  }

  getRecommendationIconColor(): string {
    switch (this.service.currentSession()?.recommendation) {
      case 'go':
        return 'text-green-600';
      case 'no_go':
        return 'text-red-600';
      case 'conditional_go':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  }

  getRecommendationTextColor(): string {
    switch (this.service.currentSession()?.recommendation) {
      case 'go':
        return 'text-green-700';
      case 'no_go':
        return 'text-red-700';
      case 'conditional_go':
        return 'text-yellow-700';
      default:
        return 'text-foreground';
    }
  }

  getConfidenceClass(): string {
    switch (this.service.currentSession()?.confidenceLevel) {
      case 'high':
        return 'bg-green-100 text-green-700';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getScoreColor(): string {
    const score = this.service.currentSession()?.readinessScore || 0;
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  getScoreBgClass(): string {
    const score = this.service.currentSession()?.readinessScore || 0;
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  getComponentIcon(key: string): string {
    switch (key) {
      case 'defect_status':
        return 'lucideBug';
      case 'work_completion':
        return 'lucideListChecks';
      case 'test_coverage':
        return 'lucideTestTube';
      case 'acceptance_criteria':
        return 'lucideClipboardCheck';
      default:
        return 'lucidePackageCheck';
    }
  }

  getComponentScoreColor(score: ComponentScore): string {
    if (score.status === 'pass') return 'text-green-600';
    if (score.status === 'warn') return 'text-yellow-600';
    return 'text-red-600';
  }

  getComponentScoreBg(score: ComponentScore): string {
    if (score.status === 'pass') return 'bg-green-500';
    if (score.status === 'warn') return 'bg-yellow-500';
    return 'bg-red-500';
  }

  getComponentPercent(score: ComponentScore): number {
    if (score.maxScore === 0) return 0;
    return Math.round((score.score / score.maxScore) * 100);
  }

  getRiskBg(level: string): string {
    switch (level) {
      case 'critical':
        return 'bg-red-50';
      case 'high':
        return 'bg-orange-50';
      case 'medium':
        return 'bg-yellow-50';
      default:
        return 'bg-gray-50';
    }
  }

  getRiskDot(level: string): string {
    switch (level) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  }

  exportToPdf(): void {
    const session = this.service.currentSession();
    const defectReport = this.service.defectReport();
    const completionReport = this.service.completionReport();
    if (!session) return;

    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Helper to escape HTML
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Get recommendation styling
    const getRecommendationColors = () => {
      switch (session.recommendation) {
        case 'go':
          return { bg: '#dcfce7', border: '#16a34a', text: '#166534', label: 'GO - Ready to Release' };
        case 'no_go':
          return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', label: 'NO-GO - Not Ready' };
        case 'conditional_go':
          return { bg: '#fef9c3', border: '#ca8a04', text: '#854d0e', label: 'CONDITIONAL GO - Proceed with Caution' };
        default:
          return { bg: '#f3f4f6', border: '#6b7280', text: '#374151', label: 'Pending Assessment' };
      }
    };

    const recommendationColors = getRecommendationColors();

    // Get score color
    const getScoreColor = (score: number): string => {
      if (score >= 80) return '#16a34a';
      if (score >= 60) return '#ca8a04';
      return '#dc2626';
    };

    // Get risk colors
    const getRiskColors = (level: string) => {
      switch (level) {
        case 'critical':
          return { bg: '#fee2e2', dot: '#dc2626', text: '#991b1b' };
        case 'high':
          return { bg: '#fed7aa', dot: '#ea580c', text: '#c2410c' };
        case 'medium':
          return { bg: '#fef9c3', dot: '#ca8a04', text: '#854d0e' };
        default:
          return { bg: '#f3f4f6', dot: '#6b7280', text: '#374151' };
      }
    };

    // Get component score color
    const getComponentScoreColor = (status: string): string => {
      if (status === 'pass') return '#16a34a';
      if (status === 'warn') return '#ca8a04';
      return '#dc2626';
    };

    // Build risks HTML
    const risks = session.recommendationDetails?.risks || [];
    let risksHtml = '';
    if (risks.length > 0) {
      risksHtml = risks
        .map((risk) => {
          const colors = getRiskColors(risk.level);
          return `
            <div class="risk-item" style="background-color: ${colors.bg}; border-left: 4px solid ${colors.dot};">
              <div class="risk-area" style="color: ${colors.text};">${escapeHtml(risk.area)} (${risk.level.toUpperCase()})</div>
              <div class="risk-description">${escapeHtml(risk.description)}</div>
            </div>
          `;
        })
        .join('');
    } else {
      risksHtml = '<p class="empty-state">No risks identified</p>';
    }

    // Build component scores HTML
    const componentScores = Object.entries(session.componentScores || {});
    let componentScoresHtml = '';
    if (componentScores.length > 0) {
      componentScoresHtml = componentScores
        .map(([key, value]) => {
          const percent = value.maxScore > 0 ? Math.round((value.score / value.maxScore) * 100) : 0;
          const scoreColor = getComponentScoreColor(value.status);
          return `
            <div class="component-card">
              <div class="component-name">${escapeHtml(value.name)}</div>
              <div class="component-score" style="color: ${scoreColor};">
                ${value.score} <span class="component-max">/ ${value.maxScore}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%; background-color: ${scoreColor};"></div>
              </div>
              ${value.details ? `<div class="component-details">${escapeHtml(value.details)}</div>` : ''}
            </div>
          `;
        })
        .join('');
    }

    // Build defect summary HTML
    const defectSummaryHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${defectReport?.totalDefects || 0}</div>
          <div class="stat-label">Total Defects</div>
        </div>
        <div class="stat-card" style="background-color: #fee2e2;">
          <div class="stat-value" style="color: #dc2626;">${defectReport?.openCritical || 0}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-card" style="background-color: #fed7aa;">
          <div class="stat-value" style="color: #ea580c;">${defectReport?.openHigh || 0}</div>
          <div class="stat-label">High</div>
        </div>
        <div class="stat-card" style="background-color: #fef9c3;">
          <div class="stat-value" style="color: #ca8a04;">${defectReport?.openMedium || 0}</div>
          <div class="stat-label">Medium</div>
        </div>
        <div class="stat-card" style="background-color: #dcfce7;">
          <div class="stat-value" style="color: #16a34a;">${defectReport?.resolved || 0}</div>
          <div class="stat-label">Resolved</div>
        </div>
      </div>
    `;

    // Build blocking defects alert
    const blockingDefectsHtml =
      (defectReport?.blockingDefects || 0) > 0
        ? `
      <div class="alert alert-danger">
        <strong>${defectReport?.blockingDefects} blocking defects</strong> must be resolved before release
      </div>
    `
        : '';

    // Build defects list HTML
    const defects = defectReport?.defects || [];
    let defectsListHtml = '';
    if (defects.length > 0) {
      defectsListHtml = defects
        .map(
          (defect) => `
          <div class="defect-item">
            <span class="defect-id">${escapeHtml(defect.externalId)}</span>
            <span class="defect-title">${escapeHtml(defect.title)}</span>
            ${defect.isBlocking ? '<span class="blocking-badge">Blocking</span>' : ''}
          </div>
        `
        )
        .join('');
    } else {
      defectsListHtml = '<p class="empty-state">No defects found for this release</p>';
    }

    // Build work completion HTML
    const workCompletionHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${completionReport?.totalItems || 0}</div>
          <div class="stat-label">Total Items</div>
        </div>
        <div class="stat-card" style="background-color: #dcfce7;">
          <div class="stat-value" style="color: #16a34a;">${completionReport?.completed || 0}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card" style="background-color: #dbeafe;">
          <div class="stat-value" style="color: #2563eb;">${completionReport?.inProgress || 0}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completionReport?.todo || 0}</div>
          <div class="stat-label">To Do</div>
        </div>
      </div>
      <div class="progress-section">
        <div class="progress-header">
          <span>Item Completion</span>
          <span class="progress-percent">${completionReport?.completionPercent || 0}%</span>
        </div>
        <div class="progress-bar-large">
          <div class="progress-fill" style="width: ${completionReport?.completionPercent || 0}%; background-color: #6366f1;"></div>
        </div>
      </div>
      ${
        completionReport?.totalPoints
          ? `
        <div class="progress-section">
          <div class="progress-header">
            <span>Points Completion</span>
            <span class="progress-percent">${completionReport.pointsCompletionPercent || 0}%</span>
          </div>
          <div class="progress-bar-large">
            <div class="progress-fill" style="width: ${completionReport.pointsCompletionPercent || 0}%; background-color: #2563eb;"></div>
          </div>
          <div class="progress-detail">${completionReport.completedPoints || 0} / ${completionReport.totalPoints} points</div>
        </div>
      `
          : ''
      }
      <div class="ac-section">
        <div class="ac-header">Acceptance Criteria Coverage</div>
        <div class="ac-value">${completionReport?.itemsWithACPercent || 0}%</div>
        <div class="ac-detail">${completionReport?.itemsWithAC || 0} of ${completionReport?.totalItems || 0} items have acceptance criteria</div>
      </div>
    `;

    // Build mitigations HTML
    const mitigations = session.recommendationDetails?.mitigations || [];
    let mitigationsHtml = '';
    if (mitigations.length > 0) {
      mitigationsHtml = mitigations
        .map(
          (mitigation, i) => `
          <div class="mitigation-item">
            <span class="mitigation-number">${i + 1}</span>
            <span class="mitigation-text">${escapeHtml(mitigation)}</span>
          </div>
        `
        )
        .join('');
    } else {
      mitigationsHtml = '<p class="empty-state">No mitigations required - your release appears ready to ship!</p>';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Release Readiness Report - ${escapeHtml(session.name || 'Release Assessment')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: #ffffff;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
          }

          .header {
            border-bottom: 3px solid #6366f1;
            padding-bottom: 24px;
            margin-bottom: 32px;
          }

          .header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #6366f1;
            margin-bottom: 8px;
          }

          .header-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
            font-size: 14px;
            color: #6b7280;
          }

          .header-meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .header-meta-label {
            font-weight: 600;
            color: #374151;
          }

          .section {
            margin-bottom: 36px;
            page-break-inside: avoid;
          }

          .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
          }

          .section-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            background-color: #6366f1;
            color: white;
          }

          .section h2 {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }

          .recommendation-banner {
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            border: 2px solid;
          }

          .recommendation-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
          }

          .recommendation-icon {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
          }

          .recommendation-label {
            font-size: 24px;
            font-weight: 700;
          }

          .confidence-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 12px;
          }

          .recommendation-summary {
            color: #4b5563;
            margin-bottom: 16px;
          }

          .score-display {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .score-value {
            font-size: 36px;
            font-weight: 700;
          }

          .score-bar {
            flex: 1;
            max-width: 200px;
            height: 12px;
            background-color: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
          }

          .score-fill {
            height: 100%;
            border-radius: 6px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }

          .stat-card {
            background-color: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }

          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #374151;
          }

          .stat-label {
            font-size: 11px;
            color: #6b7280;
            margin-top: 4px;
          }

          .risk-item {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 8px;
          }

          .risk-area {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 4px;
          }

          .risk-description {
            font-size: 13px;
            color: #4b5563;
          }

          .component-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }

          .component-card {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
          }

          .component-name {
            font-weight: 500;
            font-size: 14px;
            margin-bottom: 8px;
          }

          .component-score {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .component-max {
            font-size: 14px;
            font-weight: 400;
            color: #6b7280;
          }

          .component-details {
            font-size: 12px;
            color: #6b7280;
            margin-top: 8px;
          }

          .progress-bar {
            height: 8px;
            background-color: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            border-radius: 4px;
          }

          .alert {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .alert-danger {
            background-color: #fee2e2;
            border: 1px solid #fecaca;
            color: #991b1b;
          }

          .defect-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background-color: #f3f4f6;
            border-radius: 8px;
            margin-bottom: 8px;
          }

          .defect-id {
            font-family: monospace;
            font-size: 12px;
            color: #6b7280;
          }

          .defect-title {
            flex: 1;
            font-size: 14px;
          }

          .blocking-badge {
            background-color: #fee2e2;
            color: #991b1b;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 9999px;
            font-weight: 500;
          }

          .progress-section {
            margin-bottom: 20px;
          }

          .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
          }

          .progress-percent {
            font-weight: 700;
          }

          .progress-bar-large {
            height: 12px;
            background-color: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
          }

          .progress-detail {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
          }

          .ac-section {
            background-color: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
          }

          .ac-header {
            font-weight: 500;
            font-size: 14px;
            margin-bottom: 8px;
          }

          .ac-value {
            font-size: 28px;
            font-weight: 700;
            color: #6366f1;
          }

          .ac-detail {
            font-size: 13px;
            color: #6b7280;
            margin-top: 4px;
          }

          .mitigation-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            background-color: #f3f4f6;
            border-radius: 8px;
            margin-bottom: 12px;
          }

          .mitigation-number {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #6366f1;
            color: white;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .mitigation-text {
            flex: 1;
            font-size: 14px;
          }

          .empty-state {
            color: #9ca3af;
            font-style: italic;
            padding: 20px;
            text-align: center;
          }

          .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
          }

          .footer strong {
            color: #6366f1;
          }

          @media print {
            body {
              padding: 20px;
            }

            .section {
              page-break-inside: avoid;
            }

            .header {
              page-break-after: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Release Readiness Report</h1>
          <div class="header-meta">
            <div class="header-meta-item">
              <span class="header-meta-label">Session:</span>
              <span>${escapeHtml(session.name || 'Release Assessment')}</span>
            </div>
            <div class="header-meta-item">
              <span class="header-meta-label">Release:</span>
              <span>${escapeHtml(session.releaseIdentifier)}</span>
            </div>
            <div class="header-meta-item">
              <span class="header-meta-label">Type:</span>
              <span>${escapeHtml(session.releaseType)}</span>
            </div>
            <div class="header-meta-item">
              <span class="header-meta-label">Generated:</span>
              <span>${generatedDate}</span>
            </div>
          </div>
        </div>

        <!-- Recommendation Banner -->
        <div class="recommendation-banner" style="background-color: ${recommendationColors.bg}; border-color: ${recommendationColors.border};">
          <div class="recommendation-header">
            <div class="recommendation-icon" style="background-color: ${recommendationColors.border}20;">
              ${session.recommendation === 'go' ? '&#10003;' : session.recommendation === 'no_go' ? '&#10007;' : '&#9888;'}
            </div>
            <div>
              <span class="recommendation-label" style="color: ${recommendationColors.text};">
                ${recommendationColors.label}
              </span>
              <span class="confidence-badge" style="background-color: ${recommendationColors.border}20; color: ${recommendationColors.text};">
                ${(session.confidenceLevel || 'unknown').charAt(0).toUpperCase() + (session.confidenceLevel || 'unknown').slice(1)} Confidence
              </span>
            </div>
          </div>
          <p class="recommendation-summary">${escapeHtml(session.recommendationDetails?.summary || 'Assessment complete')}</p>
          <div class="score-display">
            <div>
              <div style="font-size: 12px; color: #6b7280;">Readiness Score</div>
              <div class="score-value" style="color: ${getScoreColor(session.readinessScore || 0)};">
                ${session.readinessScore || 0}%
              </div>
            </div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${session.readinessScore || 0}%; background-color: ${getScoreColor(session.readinessScore || 0)};"></div>
            </div>
          </div>
        </div>

        <!-- Risks Section -->
        ${
          risks.length > 0
            ? `
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background-color: #f97316;">&#9888;</div>
            <h2>Identified Risks</h2>
          </div>
          ${risksHtml}
        </div>
        `
            : ''
        }

        <!-- Component Scores -->
        ${
          componentScores.length > 0
            ? `
        <div class="section">
          <div class="section-header">
            <div class="section-icon">&#9673;</div>
            <h2>Component Scores</h2>
          </div>
          <div class="component-grid">
            ${componentScoresHtml}
          </div>
        </div>
        `
            : ''
        }

        <!-- Defect Status Section -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background-color: #dc2626;">&#128027;</div>
            <h2>Defect Status</h2>
          </div>
          ${defectSummaryHtml}
          ${blockingDefectsHtml}
          ${defectsListHtml}
        </div>

        <!-- Work Completion Section -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background-color: #16a34a;">&#10003;</div>
            <h2>Work Completion</h2>
          </div>
          ${workCompletionHtml}
        </div>

        <!-- Mitigations Section -->
        <div class="section">
          <div class="section-header">
            <div class="section-icon" style="background-color: #6366f1;">&#128161;</div>
            <h2>Recommended Mitigations</h2>
          </div>
          ${mitigationsHtml}
        </div>

        <div class="footer">
          <p>Generated by <strong>Product Studio</strong></p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      // Delay print to ensure styles are loaded
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}
