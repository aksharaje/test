import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideAlertCircle,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { ProgressTrackerService } from './progress-tracker.service';
import type { TemplateInfo, SprintOption } from './progress-tracker.types';

@Component({
  selector: 'app-progress-tracker-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideAlertCircle,
      lucideRefreshCw,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-2xl">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-6">
        <button hlmBtn variant="ghost" size="sm" routerLink="/progress-tracker">
          <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <div>
          <h1 class="text-2xl font-bold">New Progress Tracker</h1>
          <p class="text-muted-foreground">
            Configure tracking for a sprint or iteration
          </p>
        </div>
      </div>

      <!-- Error message -->
      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <!-- Setup form -->
      <div class="bg-card rounded-lg border p-6 space-y-6">
        <!-- Name -->
        <div>
          <label class="block text-sm font-medium mb-2">Tracker Name</label>
          <input
            type="text"
            [(ngModel)]="name"
            placeholder="e.g., Sprint 42 Tracker"
            class="w-full px-3 py-2 border rounded-md bg-background"
          />
        </div>

        <!-- Integration selection -->
        <div>
          <label class="block text-sm font-medium mb-2">Integration</label>
          <select
            [(ngModel)]="selectedIntegrationId"
            (ngModelChange)="onIntegrationChange($event)"
            class="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option [value]="null" disabled>Select an integration</option>
            @for (integration of integrations(); track integration.id) {
              <option [value]="integration.id">
                {{ integration.name }} ({{ integration.provider | uppercase }})
              </option>
            }
          </select>
        </div>

        <!-- Template selection -->
        @if (selectedIntegrationId) {
          <div>
            <label class="block text-sm font-medium mb-2">Configuration Template</label>
            <div class="grid grid-cols-1 gap-2">
              @for (template of filteredTemplates(); track template.id) {
                <button
                  type="button"
                  (click)="selectedTemplateId = template.id"
                  class="text-left p-3 border rounded-md transition-colors"
                  [class.border-primary]="selectedTemplateId === template.id"
                  [class.bg-primary/5]="selectedTemplateId === template.id"
                >
                  <div class="font-medium">{{ template.name }}</div>
                  <div class="text-sm text-muted-foreground">{{ template.description }}</div>
                </button>
              }
            </div>
          </div>
        }

        <!-- Sprint selection -->
        @if (selectedIntegrationId && sprints().length > 0) {
          <div>
            <label class="block text-sm font-medium mb-2">Sprint/Iteration</label>
            <div class="space-y-2 max-h-48 overflow-y-auto">
              @for (sprint of sprints(); track sprint.id) {
                <label
                  class="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50"
                  [class.border-primary]="selectedSprintIds.includes(sprint.id)"
                  [class.bg-primary/5]="selectedSprintIds.includes(sprint.id)"
                >
                  <input
                    type="checkbox"
                    [checked]="selectedSprintIds.includes(sprint.id)"
                    (change)="toggleSprint(sprint.id)"
                    class="rounded"
                  />
                  <div class="flex-1">
                    <span class="font-medium">{{ sprint.name }}</span>
                    @if (sprint.state === 'active') {
                      <span class="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                    } @else if (sprint.state === 'closed') {
                      <span class="ml-2 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Closed</span>
                    }
                  </div>
                  @if (sprint.startDate && sprint.endDate) {
                    <span class="text-xs text-muted-foreground">
                      {{ formatDate(sprint.startDate) }} - {{ formatDate(sprint.endDate) }}
                    </span>
                  }
                </label>
              }
            </div>
          </div>
        } @else if (selectedIntegrationId && !service.loading()) {
          <div class="text-sm text-muted-foreground p-4 bg-muted/50 rounded-md">
            No sprints found. The tracker will sync all items in the project.
          </div>
        }

        <!-- Loading sprints -->
        @if (service.loading() && selectedIntegrationId) {
          <div class="flex items-center justify-center py-4">
            <ng-icon hlmIcon name="lucideRefreshCw" class="h-5 w-5 animate-spin text-muted-foreground" />
            <span class="ml-2 text-muted-foreground">Loading sprints...</span>
          </div>
        }
      </div>

      <!-- Actions -->
      <div class="flex justify-between mt-6">
        <button hlmBtn variant="ghost" routerLink="/progress-tracker">Cancel</button>
        <button
          hlmBtn
          variant="default"
          (click)="createAndSync()"
          [disabled]="!canCreate() || creating()"
        >
          @if (creating()) {
            <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4 animate-spin" />
            Creating...
          } @else {
            <ng-icon hlmIcon name="lucideArrowRight" class="mr-2 h-4 w-4" />
            Create & Sync
          }
        </button>
      </div>
    </div>
  `,
})
export class ProgressTrackerSetupComponent implements OnInit {
  protected service = inject(ProgressTrackerService);
  private router = inject(Router);

  name = '';
  selectedIntegrationId: number | null = null;
  selectedTemplateId = 'basic';
  selectedSprintIds: string[] = [];
  creating = signal(false);

  integrations = signal<Array<{ id: number; name: string; provider: string }>>([]);
  sprints = signal<SprintOption[]>([]);
  filteredTemplates = signal<TemplateInfo[]>([]);

  async ngOnInit() {
    // Check integrations and load templates
    const check = await this.service.checkIntegrations();
    if (check?.has_valid_integration) {
      this.integrations.set(check.integrations);
    } else {
      // Redirect to integrations page
      this.router.navigate(['/settings/integrations']);
      return;
    }

    await this.service.loadTemplates();
    this.updateFilteredTemplates();
  }

  async onIntegrationChange(integrationId: number) {
    this.selectedSprintIds = [];

    // Determine provider and filter templates
    const integration = this.integrations().find((i) => i.id === integrationId);
    this.updateFilteredTemplates(integration?.provider);

    // Load sprints for this integration
    const sprints = await this.service.loadSprints(integrationId);
    this.sprints.set(sprints);

    // Auto-select active sprint if available
    const activeSprint = sprints.find((s) => s.state === 'active');
    if (activeSprint) {
      this.selectedSprintIds = [activeSprint.id];
    }
  }

  updateFilteredTemplates(provider?: string) {
    const allTemplates = this.service.templates();
    if (!provider) {
      this.filteredTemplates.set(allTemplates);
    } else {
      this.filteredTemplates.set(
        allTemplates.filter((t) => t.provider === provider || t.provider === 'any')
      );
    }

    // Auto-select first matching template
    if (this.filteredTemplates().length > 0) {
      const providerSpecific = this.filteredTemplates().find((t) => t.provider === provider);
      this.selectedTemplateId = providerSpecific?.id || this.filteredTemplates()[0].id;
    }
  }

  toggleSprint(sprintId: string) {
    if (this.selectedSprintIds.includes(sprintId)) {
      this.selectedSprintIds = this.selectedSprintIds.filter((id) => id !== sprintId);
    } else {
      this.selectedSprintIds = [...this.selectedSprintIds, sprintId];
    }
  }

  canCreate(): boolean {
    return !!this.selectedIntegrationId && !!this.selectedTemplateId;
  }

  async createAndSync() {
    if (!this.canCreate() || !this.selectedIntegrationId) return;

    this.creating.set(true);

    try {
      const session = await this.service.createSession({
        name: this.name || 'Sprint Tracker',
        integrationId: this.selectedIntegrationId,
        templateId: this.selectedTemplateId,
        sprintFilter:
          this.selectedSprintIds.length > 0
            ? { sprint_ids: this.selectedSprintIds }
            : { active_sprint: true },
      });

      if (session) {
        // Start sync and navigate to dashboard
        await this.service.syncSession(session.id);
        this.router.navigate(['/progress-tracker', session.id]);
      }
    } finally {
      this.creating.set(false);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}
