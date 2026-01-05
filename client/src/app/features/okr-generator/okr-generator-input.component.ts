import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTarget,
  lucideHistory,
  lucideLoader2,
  lucideSparkles,
  lucideTrash2,
  lucideChevronRight,
  lucideRotateCw,
  lucideFileText,
  lucidePencil,
} from '@ng-icons/lucide';
import { OkrGeneratorService } from './okr-generator.service';
import type { OkrSession } from './okr-generator.types';
import { HlmButtonDirective } from '../../ui/button';
import { SlicePipe } from '@angular/common';

type SourceType = 'goal-session' | 'custom';

// Generate timeframe options dynamically based on current date
function getTimeframeOptions(): { value: string; label: string }[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4

  const options: { value: string; label: string }[] = [];

  // Add current and future quarters for current year
  for (let q = currentQuarter; q <= 4; q++) {
    options.push({ value: `Q${q} ${currentYear}`, label: `Q${q} ${currentYear}` });
  }

  // Add all quarters for next year
  for (let q = 1; q <= 4; q++) {
    options.push({ value: `Q${q} ${currentYear + 1}`, label: `Q${q} ${currentYear + 1}` });
  }

  // Add annual options (current year only if we're in Q1-Q3, otherwise skip)
  if (currentQuarter <= 3) {
    options.push({ value: `Annual ${currentYear}`, label: `Annual ${currentYear}` });
  }
  options.push({ value: `Annual ${currentYear + 1}`, label: `Annual ${currentYear + 1}` });

  return options;
}

@Component({
  selector: 'app-okr-generator-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe],
  viewProviders: [
    provideIcons({
      lucideTarget,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucideChevronRight,
      lucideRotateCw,
      lucideFileText,
      lucidePencil,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold text-foreground">OKR Generator</h1>
          </div>
          <p class="text-muted-foreground mb-6">
            Generate Objectives and Key Results from your strategic goals.
          </p>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <!-- Source Type Tabs (only show if there are importable sources) -->
          @if (hasImportableSources()) {
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
                Write Custom
              </button>
            </div>
          }

          <form class="space-y-6" (submit)="onSubmit($event)">
            <!-- Goal Session Picker (when goal-session source type) -->
            @if (sourceType() === 'goal-session') {
              <div>
                <label class="text-sm font-medium">
                  Select Goal Setting Session <span class="text-destructive">*</span>
                </label>
                <p class="text-xs text-muted-foreground mt-1">
                  Choose a completed Goal Setting session to generate OKRs from
                </p>
                <select
                  class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedGoalSessionId()"
                  (change)="onGoalSessionSelect($event)"
                >
                  <option value="">-- Select a session --</option>
                  @for (session of service.goalSettingSessions(); track session.id) {
                    <option [value]="session.id">
                      {{ session.domain }}{{ session.strategy ? ' - ' + (session.strategy | slice:0:50) + (session.strategy.length > 50 ? '...' : '') : '' }}
                    </option>
                  }
                </select>
                @if (service.goalSettingSessions().length === 0) {
                  <p class="text-xs text-muted-foreground mt-2">
                    No completed Goal Setting sessions found. <a class="text-primary hover:underline cursor-pointer" (click)="goToGoalSetting()">Create one first</a> or use "Write Custom".
                  </p>
                }
              </div>

              <!-- Goals List with Checkboxes -->
              @if (service.goalsForSelection().length > 0) {
                <div class="border rounded-lg bg-background">
                  <!-- Header with Select All/None -->
                  <div class="flex items-center justify-between p-2 border-b bg-muted/30">
                    <span class="text-xs font-medium text-muted-foreground">
                      {{ selectedGoalCount() }} of {{ service.goalsForSelection().length }} goals selected
                    </span>
                    <div class="flex gap-2">
                      <button type="button" class="text-xs text-primary hover:underline" (click)="service.selectAllGoals()">
                        Select All
                      </button>
                      <button type="button" class="text-xs text-muted-foreground hover:underline" (click)="service.deselectAllGoals()">
                        None
                      </button>
                    </div>
                  </div>

                  <!-- Goals Checklist -->
                  <div class="max-h-48 overflow-y-auto divide-y">
                    @for (goal of service.goalsForSelection(); track goal.id) {
                      <label class="flex items-start gap-3 p-2 hover:bg-muted/30 cursor-pointer">
                        <input
                          type="checkbox"
                          class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          [checked]="goal.selected"
                          (change)="service.toggleGoalSelection(goal.id)"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium truncate">{{ goal.title }}</p>
                          <div class="flex items-center gap-2 mt-0.5">
                            <span
                              class="text-xs px-1.5 py-0.5 rounded"
                              [class.bg-blue-100]="goal.priority === 'high'"
                              [class.text-blue-700]="goal.priority === 'high'"
                              [class.bg-yellow-100]="goal.priority === 'medium'"
                              [class.text-yellow-700]="goal.priority === 'medium'"
                              [class.bg-gray-100]="goal.priority === 'low'"
                              [class.text-gray-700]="goal.priority === 'low'"
                            >
                              {{ goal.priority }}
                            </span>
                            @if (goal.timeframe) {
                              <span class="text-xs text-muted-foreground">{{ goal.timeframe }}</span>
                            }
                          </div>
                        </div>
                      </label>
                    }
                  </div>
                </div>
              }
            }

            <!-- Goal Description (always shown, pre-filled when session selected) -->
            <div>
              <label class="text-sm font-medium">
                Goals to Measure <span class="text-destructive">*</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                @if (sourceType() === 'goal-session') {
                  Pre-filled from selected session. Edit if needed.
                } @else {
                  Describe the goals you want to create OKRs for (min 50 characters)
                }
              </p>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[150px]"
                [value]="goalDescription()"
                (input)="onGoalDescriptionInput($event)"
                placeholder="e.g., Improve customer satisfaction, increase user engagement, reduce churn rate..."
                required
              ></textarea>
              <p class="text-xs mt-1" [class.text-muted-foreground]="goalLength() >= 50" [class.text-destructive]="goalLength() > 0 && goalLength() < 50">
                {{ goalLength() }} / 50 characters minimum
              </p>
            </div>

            <!-- Timeframe SELECT -->
            <div>
              <label class="text-sm font-medium">
                Timeframe <span class="text-destructive">*</span>
              </label>
              <select
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                [value]="timeframe()"
                (change)="onTimeframeSelect($event)"
                required
              >
                <option value="">-- Select timeframe --</option>
                @for (tf of timeframeOptions; track tf.value) {
                  <option [value]="tf.value">{{ tf.label }}</option>
                }
              </select>
            </div>

            <!-- Submit Button -->
            <button
              hlmBtn
              class="w-full"
              type="submit"
              [disabled]="!canSubmit() || service.isLoading()"
            >
              @if (service.isLoading()) {
                <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                Generating OKRs...
              } @else {
                <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                Generate OKRs
              }
            </button>
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Session History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past OKR sessions
          </p>
        </div>

        <div class="flex-1 overflow-y-auto">
          @if (service.sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your OKR sessions will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status === 'generating'"
                          [class.text-yellow-700]="session.status === 'generating'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                        >
                          {{ session.status }}
                        </span>
                        <span class="text-xs text-muted-foreground">{{ session.timeframe }}</span>
                      </div>
                      <p class="mt-1 text-sm text-foreground line-clamp-2">
                        {{ session.goalDescription }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') {
                        <button type="button" class="p-1 text-muted-foreground hover:text-primary" (click)="retrySession($event, session)">
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
                      <button type="button" class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" (click)="deleteSession($event, session)">
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                      <ng-icon name="lucideChevronRight" class="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`,
})
export class OkrGeneratorInputComponent implements OnInit {
  service = inject(OkrGeneratorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Form state
  sourceType = signal<SourceType>('custom');
  selectedGoalSessionId = signal<string>('');
  goalDescription = signal('');
  timeframe = signal('');

  // Timeframe options
  timeframeOptions = getTimeframeOptions();

  // Computed
  goalLength = computed(() => this.goalDescription().length);
  selectedGoalCount = computed(() => this.service.goalsForSelection().filter(g => g.selected).length);
  hasImportableSources = computed(() => this.service.goalSettingSessions().length > 0);
  canSubmit = computed(() => {
    if (this.sourceType() === 'goal-session') {
      // Must have at least one goal selected
      return this.selectedGoalSessionId() !== '' && this.selectedGoalCount() > 0 && this.goalLength() >= 50 && this.timeframe().length > 0;
    }
    return this.goalLength() >= 50 && this.timeframe().length > 0;
  });

  constructor() {
    // Effect to populate goal description when goals or selection changes
    effect(() => {
      const goals = this.service.goalsForSelection();
      const selectedCount = goals.filter(g => g.selected).length;
      if (selectedCount > 0 && this.sourceType() === 'goal-session') {
        this.goalDescription.set(this.service.buildGoalDescription());
      } else if (this.sourceType() === 'goal-session' && selectedCount === 0) {
        this.goalDescription.set('');
      }
    });
  }

  async ngOnInit() {
    await Promise.all([
      this.service.loadSessions(),
      this.service.loadGoalSettingSessions(),
    ]);

    // Check for goalSessionId query param (from Goal Setting CTA)
    const goalSessionId = this.route.snapshot.queryParams['goalSessionId'];
    if (goalSessionId) {
      this.sourceType.set('goal-session');
      this.selectedGoalSessionId.set(goalSessionId);
      await this.service.loadGoalsForSession(Number(goalSessionId));
    } else if (this.service.goalSettingSessions().length === 0) {
      // No importable sources available, default to custom input
      this.sourceType.set('custom');
    }
  }

  setSourceType(type: SourceType) {
    this.sourceType.set(type);
    if (type === 'custom') {
      this.service.clearGoalSelection();
      this.selectedGoalSessionId.set('');
      this.goalDescription.set('');
    }
  }

  async onGoalSessionSelect(event: Event) {
    const sessionId = (event.target as HTMLSelectElement).value;
    this.selectedGoalSessionId.set(sessionId);
    if (sessionId) {
      await this.service.loadGoalsForSession(Number(sessionId));
    } else {
      this.service.clearGoalSelection();
      this.goalDescription.set('');
    }
  }

  onGoalDescriptionInput(event: Event) { this.goalDescription.set((event.target as HTMLTextAreaElement).value); }
  onTimeframeSelect(event: Event) { this.timeframe.set((event.target as HTMLSelectElement).value); }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;
    const session = await this.service.createSession({
      goalDescription: this.goalDescription(),
      goalSessionId: this.selectedGoalSessionId() ? Number(this.selectedGoalSessionId()) : undefined,
      timeframe: this.timeframe(),
    });
    if (session) this.router.navigate(['/measurements/okr-generator/results', session.id]);
  }

  viewSession(session: OkrSession) { this.router.navigate(['/measurements/okr-generator/results', session.id]); }
  async deleteSession(event: Event, session: OkrSession) { event.stopPropagation(); if (confirm('Delete this session?')) await this.service.deleteSession(session.id); }
  async retrySession(event: Event, session: OkrSession) { event.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/measurements/okr-generator/results', session.id]); }
  goToGoalSetting() { this.router.navigate(['/goals/setting']); }
}
