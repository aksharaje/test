import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTarget,
  lucideLoader2,
  lucideCheck,
  lucideSave,
  lucideChevronRight,
  lucideSparkles,
  lucideArrowLeft,
} from '@ng-icons/lucide';
import { KpiAssignmentService } from './kpi-assignment.service';
import type { KeyResultWithAssignment } from './kpi-assignment.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-kpi-assignment-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideTarget,
      lucideLoader2,
      lucideCheck,
      lucideSave,
      lucideChevronRight,
      lucideSparkles,
      lucideArrowLeft,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-4xl mx-auto">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <button hlmBtn variant="ghost" size="icon" (click)="goBack()">
                  <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
                </button>
                <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                </div>
                <h1 class="text-2xl font-bold text-foreground">KPI Assignment</h1>
              </div>
              <p class="text-muted-foreground ml-14">
                Assign KPIs to each Key Result to measure success.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                [class.bg-yellow-100]="service.currentSession()?.status === 'draft'"
                [class.text-yellow-700]="service.currentSession()?.status === 'draft'"
                [class.bg-green-100]="service.currentSession()?.status === 'completed'"
                [class.text-green-700]="service.currentSession()?.status === 'completed'"
              >
                {{ service.currentSession()?.status || 'loading' }}
              </span>
            </div>
          </div>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          @if (service.isLoading()) {
            <div class="flex items-center justify-center p-16">
              <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-primary" />
            </div>
          } @else {
            <!-- KPI Cards -->
            <div class="space-y-6">
              @for (item of service.items(); track item.keyResult.id) {
                <div class="rounded-lg border bg-background p-6">
                  <!-- Key Result Header -->
                  <div class="mb-4">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-2"
                      [class.bg-blue-100]="item.objective.category === 'company'"
                      [class.text-blue-700]="item.objective.category === 'company'"
                      [class.bg-purple-100]="item.objective.category === 'team'"
                      [class.text-purple-700]="item.objective.category === 'team'"
                      [class.bg-green-100]="item.objective.category === 'individual'"
                      [class.text-green-700]="item.objective.category === 'individual'"
                    >
                      {{ item.objective.category }}
                    </span>
                    <h3 class="font-semibold text-lg">{{ item.keyResult.title }}</h3>
                    @if (item.keyResult.baselineValue || item.keyResult.targetValue) {
                      <p class="text-sm text-muted-foreground mt-1">
                        @if (item.keyResult.baselineValue) {
                          Baseline: <strong>{{ item.keyResult.baselineValue }}</strong> →
                        }
                        Target: <strong>{{ item.keyResult.targetValue }}</strong>
                      </p>
                    }
                  </div>

                  <!-- KPI Form -->
                  <div class="grid grid-cols-2 gap-6">
                    <div>
                      <label class="text-sm font-medium">Primary KPI</label>
                      <input
                        type="text"
                        class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        [value]="getFieldValue(item, 'primaryKpi')"
                        (input)="onFieldChange(item.keyResult.id, 'primaryKpi', $event)"
                        placeholder="e.g., Login Success Rate"
                      />
                      <!-- Suggestions -->
                      @if (getSuggestions(item.keyResult.id).length > 0) {
                        <div class="flex flex-wrap gap-1 mt-2">
                          @for (suggestion of getSuggestions(item.keyResult.id); track suggestion) {
                            <button
                              type="button"
                              class="text-xs px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                              (click)="applySuggestion(item.keyResult.id, 'primaryKpi', suggestion)"
                            >
                              {{ suggestion }}
                            </button>
                          }
                        </div>
                      }
                    </div>

                    <div>
                      <label class="text-sm font-medium">Measurement Unit</label>
                      <input
                        type="text"
                        class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        [value]="getFieldValue(item, 'measurementUnit')"
                        (input)="onFieldChange(item.keyResult.id, 'measurementUnit', $event)"
                        placeholder="e.g., Percentage (%)"
                      />
                    </div>

                    <div>
                      <label class="text-sm font-medium">Secondary KPI (Health Metric)</label>
                      <input
                        type="text"
                        class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        [value]="getFieldValue(item, 'secondaryKpi')"
                        (input)="onFieldChange(item.keyResult.id, 'secondaryKpi', $event)"
                        placeholder="e.g., Support Ticket Volume"
                      />
                    </div>

                    <div>
                      <label class="text-sm font-medium">Check Frequency</label>
                      <select
                        class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        [value]="getFieldValue(item, 'checkFrequency') || 'weekly'"
                        (change)="onFieldChange(item.keyResult.id, 'checkFrequency', $event)"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                  </div>

                  <!-- Save Button -->
                  <div class="flex justify-end mt-4">
                    <button
                      hlmBtn
                      variant="outline"
                      size="sm"
                      [disabled]="isSaving(item.keyResult.id)"
                      (click)="saveAssignment(item.keyResult.id)"
                    >
                      @if (isSaving(item.keyResult.id)) {
                        <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                      } @else if (item.assignment) {
                        <ng-icon name="lucideCheck" class="mr-2 h-4 w-4" />
                      } @else {
                        <ng-icon name="lucideSave" class="mr-2 h-4 w-4" />
                      }
                      {{ item.assignment ? 'Saved' : 'Save' }}
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Actions -->
            <div class="flex justify-between mt-8 pt-6 border-t">
              <button hlmBtn variant="outline" (click)="goBack()">
                <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
                Back to OKRs
              </button>
              <button hlmBtn (click)="completeAndContinue()">
                Continue to Measurement Framework
                <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Sidebar -->
      <div class="w-72 border-l bg-muted/30 p-4">
        <div class="rounded-lg border bg-background p-4 mb-4">
          <h3 class="font-semibold flex items-center gap-2 mb-3">
            <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
            Progress
          </h3>
          <ul class="text-sm space-y-2">
            <li class="text-muted-foreground line-through">Define Goals</li>
            <li class="text-muted-foreground line-through">Generate OKRs</li>
            <li class="font-semibold text-primary">Assign KPIs</li>
            <li class="text-muted-foreground">Build Measurement Framework</li>
          </ul>
        </div>

        <div class="rounded-lg border bg-background p-4">
          <h3 class="font-semibold mb-2">Assignment Status</h3>
          <p class="text-sm text-muted-foreground">
            {{ getAssignedCount() }} of {{ service.items().length }} Key Results assigned
          </p>
          <div class="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all"
              [style.width.%]="getCompletionPercentage()"
            ></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class KpiAssignmentResultsComponent implements OnInit {
  service = inject(KpiAssignmentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Local form state for unsaved changes
  private formState = signal<Record<number, Record<string, string>>>({});
  private savingIds = signal<Set<number>>(new Set());
  private suggestions = signal<Record<number, string[]>>({});

  async ngOnInit() {
    const sessionId = +this.route.snapshot.params['id'];
    if (sessionId) {
      await this.service.getSessionFull(sessionId);
      // Load suggestions for each key result
      for (const item of this.service.items()) {
        this.loadSuggestions(item.keyResult.id);
      }
    }
  }

  getFieldValue(item: KeyResultWithAssignment, field: string): string {
    const formValues = this.formState()[item.keyResult.id];
    if (formValues?.[field] !== undefined) return formValues[field];
    if (item.assignment) return (item.assignment as any)[field] || '';
    return '';
  }

  onFieldChange(keyResultId: number, field: string, event: Event) {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.formState.update((state) => ({
      ...state,
      [keyResultId]: {
        ...state[keyResultId],
        [field]: value,
      },
    }));
  }

  applySuggestion(keyResultId: number, field: string, value: string) {
    this.formState.update((state) => ({
      ...state,
      [keyResultId]: {
        ...state[keyResultId],
        [field]: value,
      },
    }));
  }

  isSaving(keyResultId: number): boolean {
    return this.savingIds().has(keyResultId);
  }

  getSuggestions(keyResultId: number): string[] {
    return this.suggestions()[keyResultId] || [];
  }

  async loadSuggestions(keyResultId: number) {
    const suggestions = await this.service.getKpiSuggestions(keyResultId);
    this.suggestions.update((s) => ({ ...s, [keyResultId]: suggestions }));
  }

  async saveAssignment(keyResultId: number) {
    const sessionId = this.service.currentSession()?.id;
    if (!sessionId) return;

    const item = this.service.items().find((i) => i.keyResult.id === keyResultId);
    if (!item) return;

    const formValues = this.formState()[keyResultId] || {};
    const data = {
      keyResultId,
      primaryKpi: formValues['primaryKpi'] ?? item.assignment?.primaryKpi ?? '',
      measurementUnit: formValues['measurementUnit'] ?? item.assignment?.measurementUnit ?? '',
      secondaryKpi: formValues['secondaryKpi'] ?? item.assignment?.secondaryKpi,
      checkFrequency: formValues['checkFrequency'] ?? item.assignment?.checkFrequency ?? 'weekly',
    };

    if (!data.primaryKpi || !data.measurementUnit) {
      return; // Don't save incomplete assignments
    }

    this.savingIds.update((s) => new Set([...s, keyResultId]));
    await this.service.saveAssignment(sessionId, data);
    this.savingIds.update((s) => {
      const newSet = new Set(s);
      newSet.delete(keyResultId);
      return newSet;
    });
  }

  getAssignedCount(): number {
    return this.service.items().filter((i) => i.assignment !== null).length;
  }

  getCompletionPercentage(): number {
    const total = this.service.items().length;
    if (total === 0) return 0;
    return (this.getAssignedCount() / total) * 100;
  }

  goBack() {
    // Go back to OKR results
    const okrSessionId = this.service.currentSession()?.okrSessionId;
    if (okrSessionId) {
      this.router.navigate(['/measurements/okr-generator/results', okrSessionId]);
    } else {
      this.router.navigate(['/measurements/kpi-assignment']);
    }
  }

  async completeAndContinue() {
    const sessionId = this.service.currentSession()?.id;
    if (sessionId) {
      await this.service.completeSession(sessionId);
    }
    this.router.navigate(['/measurements/framework']);
  }
}
