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
            <button hlmBtn variant="outline" (click)="reassess()">
              <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
              Re-assess
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
}
