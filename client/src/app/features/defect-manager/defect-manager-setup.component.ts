import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideRefreshCw,
  lucideAlertCircle,
  lucideBug,
  lucideChevronRight,
} from '@ng-icons/lucide';
import { DefectManagerService } from './defect-manager.service';

@Component({
  selector: 'app-defect-manager-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HlmButtonDirective,
    HlmIconDirective,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucideAlertCircle,
      lucideBug,
      lucideChevronRight,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-2xl">
      <!-- Header -->
      <div class="mb-6">
        <a routerLink="/testing/defect-manager" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          Back to Defect Manager
        </a>
        <h1 class="text-2xl font-bold">New Defect Analysis</h1>
        <p class="text-muted-foreground mt-1">
          Configure your defect analysis session
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
          <label class="text-sm font-medium" for="name">Analysis Name</label>
          <input
            id="name"
            type="text"
            [(ngModel)]="sessionName"
            placeholder="e.g., Sprint 24 Defects, Q4 Bug Analysis"
            class="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>

        <!-- Integration Selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Integration</label>
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
                    <ng-icon hlmIcon name="lucideBug" class="h-5 w-5" />
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

        <!-- Project Filter (optional) -->
        <div class="space-y-2">
          <label class="text-sm font-medium" for="project">Project Filter (optional)</label>
          <input
            id="project"
            type="text"
            [(ngModel)]="projectFilter"
            placeholder="e.g., PROJ, MYAPP"
            class="w-full px-3 py-2 border rounded-lg bg-background"
          />
          <p class="text-xs text-muted-foreground">
            Filter defects to a specific project key. Leave empty to analyze all.
          </p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4 border-t">
          <a hlmBtn variant="ghost" routerLink="/testing/defect-manager">
            Cancel
          </a>
          <button
            hlmBtn
            variant="default"
            [disabled]="!selectedIntegrationId() || service.loading()"
            (click)="createAndAnalyze()"
          >
            @if (service.loading()) {
              <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4 animate-spin" />
              Creating...
            } @else {
              <ng-icon hlmIcon name="lucideChevronRight" class="mr-2 h-4 w-4" />
              Create & Analyze
            }
          </button>
        </div>
      </div>

      <!-- Info Box -->
      <div class="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 class="font-medium mb-2">What happens during analysis?</h3>
        <ul class="text-sm text-muted-foreground space-y-1">
          <li>1. Fetches all bug/defect items from your integration</li>
          <li>2. Normalizes severity levels across different naming conventions</li>
          <li>3. Detects potential duplicate defects using fuzzy matching</li>
          <li>4. Identifies patterns by component, label, and root cause</li>
          <li>5. Generates prevention recommendations based on findings</li>
        </ul>
      </div>
    </div>
  `,
})
export class DefectManagerSetupComponent implements OnInit {
  protected service = inject(DefectManagerService);
  private router = inject(Router);

  sessionName = '';
  projectFilter = '';
  selectedIntegrationId = signal<number | null>(null);

  async ngOnInit() {
    await this.service.checkIntegrations();
    // Auto-select first integration if only one
    const integrations = this.service.integrationCheck()?.integrations || [];
    if (integrations.length === 1) {
      this.selectedIntegrationId.set(integrations[0].id);
    }
  }

  async createAndAnalyze() {
    const integrationId = this.selectedIntegrationId();
    if (!integrationId) return;

    const session = await this.service.createSession({
      name: this.sessionName || 'Defect Analysis',
      integrationId,
      projectFilter: this.projectFilter || undefined,
    });

    if (session) {
      // Start analysis and navigate to results
      await this.service.analyzeSession(session.id);
      this.router.navigate(['/testing/defect-manager', session.id]);
    }
  }
}
