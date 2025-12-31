import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTarget,
  lucideLoader2,
  lucideSparkles,
  lucideChevronRight,
  lucideCheck,
  lucideSave,
  lucideFileText,
  lucidePencil,
} from '@ng-icons/lucide';
import { KpiAssignmentService } from './kpi-assignment.service';
import type { GoalWithKpi, KpiAssignmentCreate } from './kpi-assignment.types';
import { HlmButtonDirective } from '../../ui/button';
import { SlicePipe } from '@angular/common';

type SourceType = 'goal-session' | 'custom';

const CHECK_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

@Component({
  selector: 'app-kpi-assignment-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe],
  viewProviders: [
    provideIcons({
      lucideTarget,
      lucideLoader2,
      lucideSparkles,
      lucideChevronRight,
      lucideCheck,
      lucideSave,
      lucideFileText,
      lucidePencil,
    }),
  ],
  template: `
    <div class="h-full overflow-y-auto p-6">
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-2">
          <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
          </div>
          <h1 class="text-2xl font-bold text-foreground">KPI Assignment</h1>
        </div>
        <p class="text-muted-foreground mb-6">
          Assign KPIs to your Goals to track progress and measure success.
        </p>

        @if (service.error()) {
          <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
            <p class="text-sm text-destructive">{{ service.error() }}</p>
          </div>
        }

        <!-- Source Type Tabs -->
        <div class="flex gap-2 mb-6">
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all"
            [class.border-primary]="sourceType() === 'goal-session'"
            [class.bg-primary/5]="sourceType() === 'goal-session'"
            [class.text-primary]="sourceType() === 'goal-session'"
            [class.border-border]="sourceType() !== 'goal-session'"
            [class.hover:border-primary/50]="sourceType() !== 'goal-session'"
            (click)="setSourceType('goal-session')"
          >
            <ng-icon name="lucideFileText" class="h-4 w-4" />
            Goal Setting Session
          </button>
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all"
            [class.border-primary]="sourceType() === 'custom'"
            [class.bg-primary/5]="sourceType() === 'custom'"
            [class.text-primary]="sourceType() === 'custom'"
            [class.border-border]="sourceType() !== 'custom'"
            [class.hover:border-primary/50]="sourceType() !== 'custom'"
            (click)="setSourceType('custom')"
          >
            <ng-icon name="lucidePencil" class="h-4 w-4" />
            Enter Goals Manually
          </button>
        </div>

        <!-- Goal Session Picker (when goal-session source type) -->
        @if (sourceType() === 'goal-session') {
          <div class="mb-6">
            <label class="text-sm font-medium">
              Select Goal Setting Session <span class="text-destructive">*</span>
            </label>
            <p class="text-xs text-muted-foreground mt-1">
              Choose a completed Goal Setting session to assign KPIs
            </p>
            <select
              class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              [value]="selectedGoalSessionId()"
              (change)="onGoalSessionSelect($event)"
            >
              <option value="">-- Select a session --</option>
              @for (session of service.goalSettingSessions(); track session.id) {
                <option [value]="session.id">
                  {{ session.domain }} - {{ session.strategy | slice:0:50 }}{{ session.strategy.length > 50 ? '...' : '' }}
                </option>
              }
            </select>
            @if (service.goalSettingSessions().length === 0) {
              <p class="text-xs text-muted-foreground mt-2">
                No completed Goal Setting sessions found. <a class="text-primary hover:underline cursor-pointer" (click)="goToGoalSetting()">Create one first</a> or enter goals manually.
              </p>
            }
          </div>
        }

        <!-- Manual Goal Entry (when custom source type) -->
        @if (sourceType() === 'custom') {
          <div class="mb-6">
            <label class="text-sm font-medium">
              Add Goals Manually
            </label>
            <p class="text-xs text-muted-foreground mt-1 mb-3">
              Enter goals one at a time to assign KPIs
            </p>
            <div class="flex gap-2">
              <input
                type="text"
                class="flex-1 rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                [value]="newGoalTitle()"
                (input)="onNewGoalTitleInput($event)"
                placeholder="Goal title (e.g., Improve user activation rate)"
              />
              <button
                hlmBtn
                variant="outline"
                [disabled]="!newGoalTitle().trim()"
                (click)="addManualGoal()"
              >
                Add Goal
              </button>
            </div>
          </div>
        }

        @if (service.isLoading()) {
          <div class="flex items-center justify-center p-16">
            <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-primary" />
          </div>
        } @else if (service.goals().length > 0) {
          <!-- Goals with inline KPI forms -->
          <div class="space-y-6">
            @for (item of service.goals(); track item.goal.id; let idx = $index) {
              <div class="rounded-lg border bg-background p-6">
                <!-- Goal Header -->
                <div class="flex items-start justify-between mb-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        [class.bg-blue-100]="item.goal.priority === 'high'"
                        [class.text-blue-700]="item.goal.priority === 'high'"
                        [class.bg-yellow-100]="item.goal.priority === 'medium'"
                        [class.text-yellow-700]="item.goal.priority === 'medium'"
                        [class.bg-gray-100]="item.goal.priority === 'low'"
                        [class.text-gray-700]="item.goal.priority === 'low'"
                      >
                        {{ item.goal.priority }}
                      </span>
                      <span class="text-xs text-muted-foreground">{{ item.goal.category }}</span>
                    </div>
                    <h3 class="font-semibold text-lg">{{ item.goal.title }}</h3>
                    @if (item.goal.description) {
                      <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ item.goal.description }}</p>
                    }
                  </div>
                  @if (item.assignment) {
                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                      <ng-icon name="lucideCheck" class="h-3 w-3" /> Assigned
                    </span>
                  }
                </div>

                <!-- KPI Form -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="text-sm font-medium">Primary KPI <span class="text-destructive">*</span></label>
                    <input
                      type="text"
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      [value]="getFieldValue(item.goal.id, 'primaryKpi')"
                      (input)="onFieldChange(item.goal.id, 'primaryKpi', $event)"
                      placeholder="e.g., User Activation Rate"
                    />
                    <!-- Suggestion Pills -->
                    @if (getSuggestions(item.goal.id).length > 0) {
                      <div class="flex flex-wrap gap-1 mt-2">
                        @for (suggestion of getSuggestions(item.goal.id); track suggestion) {
                          <button
                            type="button"
                            class="text-xs px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                            (click)="applySuggestion(item.goal.id, 'primaryKpi', suggestion)"
                          >
                            {{ suggestion }}
                          </button>
                        }
                      </div>
                    }
                  </div>

                  <div>
                    <label class="text-sm font-medium">Measurement Unit <span class="text-destructive">*</span></label>
                    <input
                      type="text"
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      [value]="getFieldValue(item.goal.id, 'measurementUnit')"
                      (input)="onFieldChange(item.goal.id, 'measurementUnit', $event)"
                      placeholder="e.g., Percentage (%)"
                    />
                  </div>

                  <div>
                    <label class="text-sm font-medium">Secondary KPI (Health Metric)</label>
                    <input
                      type="text"
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      [value]="getFieldValue(item.goal.id, 'secondaryKpi')"
                      (input)="onFieldChange(item.goal.id, 'secondaryKpi', $event)"
                      placeholder="e.g., Support Ticket Volume"
                    />
                  </div>

                  <div>
                    <label class="text-sm font-medium">Check Frequency</label>
                    <select
                      class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      [value]="getFieldValue(item.goal.id, 'checkFrequency') || 'weekly'"
                      (change)="onFieldChange(item.goal.id, 'checkFrequency', $event)"
                    >
                      @for (opt of checkFrequencyOptions; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  </div>
                </div>

                <!-- Save Button -->
                <div class="flex justify-end mt-4">
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    [disabled]="isSaving(item.goal.id) || !canSaveGoal(item.goal.id)"
                    (click)="saveAssignment(item.goal.id)"
                  >
                    @if (isSaving(item.goal.id)) {
                      <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                    } @else if (item.assignment) {
                      <ng-icon name="lucideCheck" class="mr-2 h-4 w-4" />
                    } @else {
                      <ng-icon name="lucideSave" class="mr-2 h-4 w-4" />
                    }
                    {{ item.assignment ? 'Update' : 'Save' }}
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Continue Button -->
          <div class="flex justify-between mt-8 pt-6 border-t">
            <button hlmBtn variant="outline" (click)="goToGoalSetting()">
              Back to Goals
            </button>
            <button hlmBtn (click)="continueToMeasurementFramework()">
              Continue to Measurement Framework
              <ng-icon name="lucideChevronRight" class="ml-2 h-4 w-4" />
            </button>
          </div>
        } @else {
          <div class="rounded-lg border bg-muted/30 p-8 text-center">
            <ng-icon name="lucideTarget" class="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 class="mt-4 font-medium text-muted-foreground">No Goals Selected</h3>
            <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              @if (sourceType() === 'goal-session') {
                Select a Goal Setting session above to assign KPIs to your goals.
              } @else {
                Add goals manually using the input field above.
              }
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`,
})
export class KpiAssignmentInputComponent implements OnInit {
  service = inject(KpiAssignmentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Form state
  sourceType = signal<SourceType>('goal-session');
  selectedGoalSessionId = signal<string>('');
  newGoalTitle = signal('');
  checkFrequencyOptions = CHECK_FREQUENCY_OPTIONS;

  // Local form state for each goal
  private formState = signal<Record<number, Record<string, string>>>({});
  private savingIds = signal<Set<number>>(new Set());
  private suggestions = signal<Record<number, string[]>>({});

  async ngOnInit() {
    await this.service.loadGoalSettingSessions();

    // Check for goalSessionId query param (from Goal Setting CTA)
    const goalSessionId = this.route.snapshot.queryParams['goalSessionId'];
    if (goalSessionId) {
      this.sourceType.set('goal-session');
      this.selectedGoalSessionId.set(goalSessionId);
      await this.service.loadGoalsForSession(Number(goalSessionId));
      // Pre-fill KPIs for each goal
      for (const item of this.service.goals()) {
        this.generateSuggestionsAndPrefill(item.goal.id, item.goal);
      }
    }
  }

  setSourceType(type: SourceType) {
    this.sourceType.set(type);
    if (type === 'goal-session') {
      this.service.goals.set([]);
      this.formState.set({});
    } else {
      this.service.clearGoalSelection();
      this.selectedGoalSessionId.set('');
    }
  }

  async onGoalSessionSelect(event: Event) {
    const sessionId = (event.target as HTMLSelectElement).value;
    this.selectedGoalSessionId.set(sessionId);
    if (sessionId) {
      await this.service.loadGoalsForSession(Number(sessionId));
      // Pre-fill KPIs for each goal
      for (const item of this.service.goals()) {
        this.generateSuggestionsAndPrefill(item.goal.id, item.goal);
      }
    } else {
      this.service.clearGoalSelection();
    }
  }

  onNewGoalTitleInput(event: Event) {
    this.newGoalTitle.set((event.target as HTMLInputElement).value);
  }

  addManualGoal() {
    const title = this.newGoalTitle().trim();
    if (!title) return;

    const newGoal = {
      goal: {
        id: Date.now(), // Temporary ID for manual goals
        title,
        description: '',
        category: 'operational' as const,
        priority: 'medium' as const,
        timeframe: undefined,
      },
      assignment: null,
    };

    this.service.goals.update((goals) => [...goals, newGoal]);
    this.generateSuggestionsAndPrefill(newGoal.goal.id, newGoal.goal);
    this.newGoalTitle.set('');
  }

  getFieldValue(goalId: number, field: string): string {
    const formValues = this.formState()[goalId];
    if (formValues?.[field] !== undefined) return formValues[field];

    const item = this.service.goals().find((g) => g.goal.id === goalId);
    if (item?.assignment) return (item.assignment as any)[field] || '';
    return '';
  }

  onFieldChange(goalId: number, field: string, event: Event) {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.formState.update((state) => ({
      ...state,
      [goalId]: {
        ...state[goalId],
        [field]: value,
      },
    }));
  }

  applySuggestion(goalId: number, field: string, value: string) {
    this.formState.update((state) => ({
      ...state,
      [goalId]: {
        ...state[goalId],
        [field]: value,
      },
    }));
  }

  isSaving(goalId: number): boolean {
    return this.savingIds().has(goalId);
  }

  canSaveGoal(goalId: number): boolean {
    const formValues = this.formState()[goalId] || {};
    const item = this.service.goals().find((g) => g.goal.id === goalId);
    const primaryKpi = formValues['primaryKpi'] ?? item?.assignment?.primaryKpi ?? '';
    const measurementUnit = formValues['measurementUnit'] ?? item?.assignment?.measurementUnit ?? '';
    return primaryKpi.trim() !== '' && measurementUnit.trim() !== '';
  }

  getSuggestions(goalId: number): string[] {
    return this.suggestions()[goalId] || [];
  }

  generateSuggestionsAndPrefill(goalId: number, goal: { title: string; description?: string }) {
    // Generate KPI suggestions and pre-fill fields based on goal content
    const text = `${goal.title} ${goal.description || ''}`.toLowerCase();

    let primaryKpi = '';
    let measurementUnit = '';
    let secondaryKpi = '';
    const alternativeSuggestions: string[] = [];

    // Smart matching based on goal content
    if (text.includes('login') || text.includes('auth')) {
      primaryKpi = 'Login Success Rate';
      measurementUnit = 'Percentage (%)';
      secondaryKpi = '';
      alternativeSuggestions.push('Auth Latency', 'Password Reset Rate');
    } else if (text.includes('support ticket') || text.includes('ticket volume')) {
      primaryKpi = 'Support Ticket Volume';
      measurementUnit = 'Count';
      alternativeSuggestions.push('CSAT Score', 'Resolution Time');
    } else if (text.includes('activation') || text.includes('onboard')) {
      primaryKpi = 'User Activation Rate';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Time to First Action', 'Onboarding Completion Rate');
    } else if (text.includes('revenue') || text.includes('sales') || text.includes('arpu')) {
      primaryKpi = 'Monthly Revenue';
      measurementUnit = 'Currency ($)';
      alternativeSuggestions.push('Conversion Rate', 'Average Order Value');
    } else if (text.includes('retention') || text.includes('churn')) {
      primaryKpi = 'Retention Rate';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Churn Rate', 'Customer Lifetime Value');
    } else if (text.includes('nps') || text.includes('satisfaction') || text.includes('csat')) {
      primaryKpi = 'NPS Score';
      measurementUnit = 'Score (-100 to 100)';
      alternativeSuggestions.push('CSAT Score', 'Customer Effort Score');
    } else if (text.includes('performance') || text.includes('speed') || text.includes('latency')) {
      primaryKpi = 'Response Time';
      measurementUnit = 'Milliseconds (ms)';
      alternativeSuggestions.push('Page Load Time', 'Uptime Percentage');
    } else if (text.includes('engagement') || text.includes('dau') || text.includes('mau')) {
      primaryKpi = 'DAU/MAU Ratio';
      measurementUnit = 'Ratio';
      alternativeSuggestions.push('Session Duration', 'Feature Adoption Rate');
    } else if (text.includes('security') || text.includes('breach') || text.includes('incident')) {
      primaryKpi = 'Security Incidents';
      measurementUnit = 'Count';
      alternativeSuggestions.push('Mean Time to Detect', 'Vulnerability Count');
    } else if (text.includes('compliance') || text.includes('audit') || text.includes('soc')) {
      primaryKpi = 'Compliance Score';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Audit Findings', 'Control Effectiveness');
    } else if (text.includes('test') || text.includes('coverage') || text.includes('quality')) {
      primaryKpi = 'Test Coverage';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Defect Rate', 'Pass Rate');
    } else if (text.includes('reduce') || text.includes('decrease')) {
      primaryKpi = 'Reduction Rate';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Absolute Change', 'Trend Rate');
    } else if (text.includes('increase') || text.includes('improve') || text.includes('grow')) {
      primaryKpi = 'Growth Rate';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Absolute Growth', 'Rate of Change');
    } else {
      primaryKpi = 'Success Rate';
      measurementUnit = 'Percentage (%)';
      alternativeSuggestions.push('Completion Rate', 'Achievement Rate');
    }

    // Pre-fill the form state with generated values
    this.formState.update((state) => ({
      ...state,
      [goalId]: {
        primaryKpi,
        measurementUnit,
        secondaryKpi,
        checkFrequency: 'weekly',
      },
    }));

    // Store alternative suggestions for the pills
    this.suggestions.update((s) => ({ ...s, [goalId]: alternativeSuggestions }));
  }

  async saveAssignment(goalId: number) {
    const item = this.service.goals().find((g) => g.goal.id === goalId);
    if (!item) return;

    const formValues = this.formState()[goalId] || {};
    const data: KpiAssignmentCreate = {
      goalId,
      primaryKpi: formValues['primaryKpi'] ?? item.assignment?.primaryKpi ?? '',
      measurementUnit: formValues['measurementUnit'] ?? item.assignment?.measurementUnit ?? '',
      secondaryKpi: formValues['secondaryKpi'] ?? item.assignment?.secondaryKpi,
      checkFrequency: formValues['checkFrequency'] ?? item.assignment?.checkFrequency ?? 'weekly',
    };

    if (!data.primaryKpi || !data.measurementUnit) return;

    this.savingIds.update((s) => new Set([...s, goalId]));

    // For demo purposes, update local state directly
    // In production, this would call the API
    this.service.goals.update((goals) =>
      goals.map((g) =>
        g.goal.id === goalId
          ? {
              ...g,
              assignment: {
                id: Date.now(),
                primaryKpi: data.primaryKpi,
                measurementUnit: data.measurementUnit,
                secondaryKpi: data.secondaryKpi,
                checkFrequency: data.checkFrequency || 'weekly',
              },
            }
          : g
      )
    );

    this.savingIds.update((s) => {
      const newSet = new Set(s);
      newSet.delete(goalId);
      return newSet;
    });
  }

  goToGoalSetting() {
    this.router.navigate(['/goals/setting']);
  }

  continueToMeasurementFramework() {
    this.router.navigate(['/measurements/framework']);
  }
}
