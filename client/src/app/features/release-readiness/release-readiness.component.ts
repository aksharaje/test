import { Component, OnInit, inject, signal } from '@angular/core';
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
  lucidePackageCheck,
  lucideXCircle,
} from '@ng-icons/lucide';
import { ReleaseReadinessService } from './release-readiness.service';
import type { ReleaseReadinessSession } from './release-readiness.types';

@Component({
  selector: 'app-release-readiness',
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
      lucidePackageCheck,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-6xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Release Readiness Checker</h1>
          <p class="text-muted-foreground mt-1">
            Assess release readiness with adaptive scoring
          </p>
        </div>
        @if (service.hasValidIntegration()) {
          <button hlmBtn variant="default" (click)="createNewSession()">
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            New Assessment
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
              {{ service.integrationCheck()?.message || 'Connect your Jira or Azure DevOps account to assess release readiness.' }}
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
              <ng-icon hlmIcon name="lucidePackageCheck" class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 class="text-lg font-semibold mb-2">No Release Assessments Yet</h2>
              <p class="text-muted-foreground mb-4 max-w-md mx-auto">
                Create an assessment to check if your release is ready to ship.
              </p>
              <button hlmBtn variant="default" (click)="createNewSession()">
                <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
                Start First Assessment
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
                        {{ session.releaseIdentifier }} &middot; {{ session.releaseType }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1">
                      @if (session.status === 'ready') {
                        @if (session.recommendation === 'go') {
                          <span class="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            <ng-icon hlmIcon name="lucideCheckCircle2" class="h-3 w-3" />
                            GO
                          </span>
                        } @else if (session.recommendation === 'no_go') {
                          <span class="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            <ng-icon hlmIcon name="lucideXCircle" class="h-3 w-3" />
                            NO-GO
                          </span>
                        } @else if (session.recommendation === 'conditional_go') {
                          <span class="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                            <ng-icon hlmIcon name="lucideAlertTriangle" class="h-3 w-3" />
                            Conditional
                          </span>
                        }
                      } @else if (session.status === 'assessing') {
                        <span class="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <ng-icon hlmIcon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                          Assessing
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

                  @if (session.status === 'ready' && session.readinessScore !== null) {
                    <div class="mb-3">
                      <div class="flex items-center justify-between text-sm mb-1">
                        <span class="text-muted-foreground">Readiness Score</span>
                        <span class="font-bold" [class]="getScoreColor(session.readinessScore)">
                          {{ session.readinessScore }}%
                        </span>
                      </div>
                      <div class="w-full bg-muted rounded-full h-2">
                        <div
                          class="h-2 rounded-full transition-all"
                          [class]="getScoreBgClass(session.readinessScore)"
                          [style.width.%]="session.readinessScore"
                        ></div>
                      </div>
                    </div>
                  }

                  <div class="flex items-center justify-between text-xs text-muted-foreground">
                    @if (session.lastAssessmentAt) {
                      <span class="flex items-center gap-1">
                        <ng-icon hlmIcon name="lucideClock" class="h-3 w-3" />
                        {{ formatRelativeTime(session.lastAssessmentAt) }}
                      </span>
                    } @else {
                      <span>Never assessed</span>
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
            <h2 class="text-xl font-semibold mb-2">Delete Assessment</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{{ deleteCandidate()?.name }}</strong>?
              This will remove all assessment data.
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
export class ReleaseReadinessComponent implements OnInit {
  protected service = inject(ReleaseReadinessService);
  private router = inject(Router);

  initialized = signal(false);
  deleteCandidate = signal<ReleaseReadinessSession | null>(null);

  async ngOnInit() {
    await this.service.checkIntegrations();
    if (this.service.hasValidIntegration()) {
      await this.service.loadSessions();
    }
    this.initialized.set(true);
  }

  createNewSession() {
    this.router.navigate(['/testing/release-readiness/new']);
  }

  openSession(session: ReleaseReadinessSession) {
    this.router.navigate(['/testing/release-readiness', session.id]);
  }

  confirmDelete(session: ReleaseReadinessSession, event: Event) {
    event.stopPropagation();
    this.deleteCandidate.set(session);
  }

  async doDelete() {
    const session = this.deleteCandidate();
    if (!session) return;

    await this.service.deleteSession(session.id);
    this.deleteCandidate.set(null);
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  getScoreBgClass(score: number): string {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
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
