import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideAlertCircle,
  lucideX,
  lucideSave,
  lucideRefreshCw,
  lucideWand2,
} from '@ng-icons/lucide';
import { IntegrationService } from './integration.service';
import {
  MAPPABLE_FIELD_LABELS,
  type MappableField,
  type JiraField,
  type FieldMapping,
} from './integration.types';

@Component({
  selector: 'app-field-mappings',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideAlertCircle,
      lucideX,
      lucideSave,
      lucideRefreshCw,
      lucideWand2,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-4xl">
      <div class="flex items-center gap-4 mb-6">
        <button hlmBtn variant="ghost" size="sm" (click)="goBack()">
          <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <div>
          <h1 class="text-2xl font-bold">Field Mappings</h1>
          <p class="text-muted-foreground">
            @if (service.selectedIntegration()) {
              Configure field mappings for {{ service.selectedIntegration()?.name }}
            }
          </p>
        </div>
      </div>

      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      @if (service.loading() && !hasData()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="bg-card rounded-lg border p-4 animate-pulse">
              <div class="h-5 bg-muted rounded w-1/4 mb-2"></div>
              <div class="h-10 bg-muted rounded w-full"></div>
            </div>
          }
        </div>
      } @else {
        <div class="bg-card rounded-lg border">
          <div class="p-4 border-b flex items-center justify-between">
            <div>
              <h2 class="font-medium">Jira Field Mappings</h2>
              <p class="text-sm text-muted-foreground">
                Map your fields to the corresponding Jira custom fields
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                hlmBtn
                variant="default"
                size="sm"
                (click)="autoDetect()"
                [disabled]="service.loading() || autoDetecting()"
              >
                <ng-icon
                  hlmIcon
                  name="lucideWand2"
                  class="mr-2 h-4 w-4"
                  [class.animate-pulse]="autoDetecting()"
                />
                {{ autoDetecting() ? 'Detecting...' : 'Auto-detect' }}
              </button>
              <button
                hlmBtn
                variant="outline"
                size="sm"
                (click)="refreshFields()"
                [disabled]="service.loading()"
              >
                <ng-icon
                  hlmIcon
                  name="lucideRefreshCw"
                  class="mr-2 h-4 w-4"
                  [class.animate-spin]="service.loading()"
                />
                Refresh Fields
              </button>
            </div>
          </div>

          <div class="divide-y">
            @for (field of mappableFields; track field) {
              <div class="p-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <label class="font-medium">{{ fieldLabels[field] }}</label>
                      @if (getMapping(field); as mapping) {
                        @if (mapping.adminConfirmed) {
                          <span
                            class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                          >
                            Confirmed
                          </span>
                        } @else if (mapping.confidence >= 90) {
                          <span
                            class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
                          >
                            Auto-detected ({{ mapping.confidence }}%)
                          </span>
                        } @else if (mapping.confidence >= 70) {
                          <span
                            class="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full"
                          >
                            Suggested ({{ mapping.confidence }}%)
                          </span>
                        }
                      }
                    </div>
                    <p class="text-sm text-muted-foreground mt-1">
                      {{ getFieldDescription(field) }}
                    </p>
                  </div>
                  <div class="w-64">
                    <select
                      [ngModel]="getMapping(field)?.providerFieldId || ''"
                      (ngModelChange)="onFieldChange(field, $event)"
                      class="w-full px-3 py-2 border rounded-md bg-background text-sm"
                      [disabled]="service.loading()"
                    >
                      <option value="">-- Not Mapped --</option>
                      @for (jiraField of filteredFields(field); track jiraField.id) {
                        <option [value]="jiraField.id">
                          {{ jiraField.name }}
                          @if (jiraField.custom) {
                            (custom)
                          }
                        </option>
                      }
                    </select>
                    @if (getMapping(field)) {
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ getMapping(field)?.providerFieldName }}
                        @if (getMapping(field)?.providerFieldType) {
                          ({{ getMapping(field)?.providerFieldType }})
                        }
                      </p>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="mt-6 flex justify-between">
          <button hlmBtn variant="ghost" (click)="goBack()">Cancel</button>
          <button
            hlmBtn
            variant="default"
            (click)="saveAllMappings()"
            [disabled]="!hasChanges() || service.loading()"
          >
            <ng-icon hlmIcon name="lucideSave" class="mr-2 h-4 w-4" />
            Save Mappings
          </button>
        </div>
      }
    </div>
  `,
})
export class FieldMappingsComponent implements OnInit {
  protected service = inject(IntegrationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  integrationId = signal<number | null>(null);
  pendingChanges = signal<Map<MappableField, string>>(new Map());
  autoDetecting = signal(false);

  mappableFields: MappableField[] = [
    'story_points',
    'sprint',
    'parent',
    'team',
    'priority',
    'labels',
    'components',
  ];

  fieldLabels = MAPPABLE_FIELD_LABELS;

  hasData = computed(
    () =>
      this.service.fieldMappings().length > 0 ||
      this.service.availableFields().length > 0
  );

  async ngOnInit() {
    const id = parseInt(this.route.snapshot.params['id']);
    if (!isNaN(id)) {
      this.integrationId.set(id);

      // Load integration details if not already loaded
      if (this.service.selectedIntegration()?.id !== id) {
        await this.service.getIntegration(id);
      }

      // Load mappings and available fields
      await Promise.all([
        this.service.loadFieldMappings(id),
        this.service.loadAvailableFields(id),
      ]);
    }
  }

  getMapping(field: MappableField): FieldMapping | undefined {
    return this.service.getFieldMappingForField(field);
  }

  getFieldDescription(field: MappableField): string {
    const descriptions: Record<MappableField, string> = {
      story_points: 'The field used to track story point estimates',
      sprint: 'The field that associates issues with sprints',
      parent: 'The field that links issues to their parent (epic or feature)',
      team: 'The field that identifies which team owns the issue',
      priority: 'The priority field for the issue',
      labels: 'Labels/tags attached to issues',
      components: 'The component the issue belongs to',
    };
    return descriptions[field];
  }

  filteredFields(field: MappableField): JiraField[] {
    // Filter fields based on expected type
    const allFields = this.service.availableFields();

    switch (field) {
      case 'story_points':
        return allFields.filter(
          (f) => f.schema?.type === 'number' || f.name.toLowerCase().includes('point')
        );
      case 'sprint':
        return allFields.filter(
          (f) =>
            f.schema?.custom?.includes('sprint') ||
            f.name.toLowerCase().includes('sprint')
        );
      case 'parent':
        return allFields.filter(
          (f) =>
            f.id === 'parent' ||
            f.schema?.custom?.includes('epic') ||
            f.name.toLowerCase().includes('epic') ||
            f.name.toLowerCase().includes('parent')
        );
      case 'team':
        return allFields.filter(
          (f) =>
            f.name.toLowerCase().includes('team') ||
            f.name.toLowerCase().includes('squad')
        );
      case 'priority':
        return allFields.filter(
          (f) =>
            f.key === 'priority' || f.name.toLowerCase().includes('priority')
        );
      case 'labels':
        return allFields.filter(
          (f) => f.key === 'labels' || f.schema?.type === 'array'
        );
      case 'components':
        return allFields.filter(
          (f) =>
            f.key === 'components' || f.name.toLowerCase().includes('component')
        );
      default:
        return allFields;
    }
  }

  onFieldChange(ourField: MappableField, providerFieldId: string) {
    const changes = new Map(this.pendingChanges());

    if (providerFieldId) {
      changes.set(ourField, providerFieldId);
    } else {
      changes.delete(ourField);
    }

    this.pendingChanges.set(changes);
  }

  hasChanges(): boolean {
    return this.pendingChanges().size > 0;
  }

  async saveAllMappings() {
    const integrationId = this.integrationId();
    if (!integrationId) return;

    const changes = this.pendingChanges();
    const allFields = this.service.availableFields();

    for (const [ourField, providerFieldId] of changes.entries()) {
      if (providerFieldId) {
        const jiraField = allFields.find((f) => f.id === providerFieldId);
        if (jiraField) {
          await this.service.updateFieldMapping(
            integrationId,
            ourField,
            jiraField.id,
            jiraField.name,
            jiraField.schema?.type
          );
        }
      } else {
        await this.service.deleteFieldMapping(integrationId, ourField);
      }
    }

    this.pendingChanges.set(new Map());
  }

  async refreshFields() {
    const integrationId = this.integrationId();
    if (!integrationId) return;

    await this.service.loadAvailableFields(integrationId);
  }

  async autoDetect() {
    const integrationId = this.integrationId();
    if (!integrationId) return;

    this.autoDetecting.set(true);
    try {
      await this.service.autoDetectMappings(integrationId);
    } finally {
      this.autoDetecting.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/settings/integrations']);
  }
}
