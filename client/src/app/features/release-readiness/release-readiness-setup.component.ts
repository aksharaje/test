import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { HlmInputDirective } from '../../ui/input';
import { HlmLabelDirective } from '../../ui/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideRefreshCw,
  lucideAlertCircle,
  lucidePackageCheck,
  lucideChevronRight,
} from '@ng-icons/lucide';
import { ReleaseReadinessService } from './release-readiness.service';

@Component({
  selector: 'app-release-readiness-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HlmButtonDirective,
    HlmIconDirective,
    HlmInputDirective,
    HlmLabelDirective,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucideAlertCircle,
      lucidePackageCheck,
      lucideChevronRight,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-2xl">
      <!-- Header -->
      <div class="mb-6">
        <a routerLink="/testing/release-readiness" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          Back to Release Readiness
        </a>
        <h1 class="text-2xl font-bold">New Release Assessment</h1>
        <p class="text-muted-foreground mt-1">
          Configure your release readiness assessment
        </p>
      </div>

      <!-- Error message -->
      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <!-- Setup Form -->
      <div class="bg-card rounded-lg border p-6 space-y-6">
        <!-- Session Name -->
        <div class="space-y-2">
          <label hlmLabel for="name">Assessment Name</label>
          <input
            hlmInput
            id="name"
            type="text"
            [(ngModel)]="sessionName"
            placeholder="e.g., Release 2.4 Go/No-Go, Sprint 24 Release Check"
            class="w-full"
          />
        </div>

        <!-- Integration Selection -->
        <div class="space-y-2">
          <label hlmLabel>Integration</label>
          <div class="grid grid-cols-1 gap-2">
            @for (integration of service.integrationCheck()?.integrations || []; track integration.id) {
              <button
                class="flex items-center justify-between p-4 rounded-lg border transition-colors"
                [class.border-primary]="selectedIntegrationId() === integration.id"
                [class.bg-primary/5]="selectedIntegrationId() === integration.id"
                (click)="selectedIntegrationId.set(integration.id)"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <ng-icon hlmIcon name="lucidePackageCheck" class="h-5 w-5" />
                  </div>
                  <div class="text-left">
                    <div class="font-medium">{{ integration.name }}</div>
                    <div class="text-sm text-muted-foreground capitalize">{{ integration.provider }}</div>
                  </div>
                </div>
                @if (selectedIntegrationId() === integration.id) {
                  <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                }
              </button>
            }
          </div>
        </div>

        <!-- Release Identifier -->
        <div class="space-y-2">
          <label hlmLabel for="release">Release Identifier *</label>
          <input
            hlmInput
            id="release"
            type="text"
            [(ngModel)]="releaseIdentifier"
            placeholder="e.g., 2.4.0, Sprint 24, Q4-Release"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            The version number, sprint name, or release label to assess.
          </p>
        </div>

        <!-- Release Type -->
        <div class="space-y-2">
          <label hlmLabel>Release Type</label>
          <div class="grid grid-cols-3 gap-2">
            @for (type of releaseTypes; track type.value) {
              <button
                class="p-3 rounded-lg border text-center transition-colors"
                [class.border-primary]="releaseType === type.value"
                [class.bg-primary/5]="releaseType === type.value"
                (click)="releaseType = type.value"
              >
                <div class="font-medium text-sm">{{ type.label }}</div>
                <div class="text-xs text-muted-foreground">{{ type.description }}</div>
              </button>
            }
          </div>
        </div>

        <!-- Project Key (optional) -->
        <div class="space-y-2">
          <label hlmLabel for="project">Project Key (optional)</label>
          <input
            hlmInput
            id="project"
            type="text"
            [(ngModel)]="projectKey"
            placeholder="e.g., PROJ, MYAPP"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            Filter to a specific project. Leave empty for all projects.
          </p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4 border-t">
          <a hlmBtn variant="ghost" routerLink="/testing/release-readiness">
            Cancel
          </a>
          <button
            hlmBtn
            variant="default"
            [disabled]="!canSubmit() || service.loading()"
            (click)="createAndAssess()"
          >
            @if (service.loading()) {
              <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4 animate-spin" />
              Creating...
            } @else {
              <ng-icon hlmIcon name="lucideChevronRight" class="mr-2 h-4 w-4" />
              Create & Assess
            }
          </button>
        </div>
      </div>

      <!-- Info Box -->
      <div class="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 class="font-medium mb-2">What gets assessed?</h3>
        <ul class="text-sm text-muted-foreground space-y-1">
          <li>1. <strong>Defect Status</strong> - Open bugs and blockers for this release</li>
          <li>2. <strong>Work Completion</strong> - Stories and tasks marked as done</li>
          <li>3. <strong>Acceptance Criteria</strong> - Coverage and verification status</li>
          <li>4. <strong>Test Coverage</strong> - Linked tests and pass rates (if available)</li>
          <li>5. <strong>Recommendation</strong> - Go / No-Go / Conditional based on scores</li>
        </ul>
      </div>
    </div>
  `,
})
export class ReleaseReadinessSetupComponent implements OnInit {
  protected service = inject(ReleaseReadinessService);
  private router = inject(Router);

  sessionName = '';
  releaseIdentifier = '';
  releaseType = 'fixVersion';
  projectKey = '';
  selectedIntegrationId = signal<number | null>(null);

  releaseTypes = [
    { value: 'fixVersion', label: 'Fix Version', description: 'Jira fixVersion' },
    { value: 'sprint', label: 'Sprint', description: 'Sprint/Iteration' },
    { value: 'label', label: 'Label', description: 'Release label' },
  ];

  async ngOnInit() {
    await this.service.checkIntegrations();
    // Auto-select first integration if only one
    const integrations = this.service.integrationCheck()?.integrations || [];
    if (integrations.length === 1) {
      this.selectedIntegrationId.set(integrations[0].id);
    }
  }

  canSubmit(): boolean {
    return !!this.selectedIntegrationId() && !!this.releaseIdentifier.trim();
  }

  async createAndAssess() {
    const integrationId = this.selectedIntegrationId();
    if (!integrationId || !this.releaseIdentifier.trim()) return;

    const session = await this.service.createSession({
      name: this.sessionName || `Release ${this.releaseIdentifier}`,
      integrationId,
      releaseIdentifier: this.releaseIdentifier.trim(),
      releaseType: this.releaseType,
      projectKey: this.projectKey || undefined,
    });

    if (session) {
      // Start assessment and navigate to results
      await this.service.assessRelease(session.id);
      this.router.navigate(['/testing/release-readiness', session.id]);
    }
  }
}
