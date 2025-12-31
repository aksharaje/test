import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTarget,
  lucideLoader2,
  lucideSparkles,
  lucideChevronRight,
  lucideCheck,
  lucideFileText,
  lucidePencil,
  lucideHistory,
  lucideTrash2,
  lucideRotateCw,
} from '@ng-icons/lucide';
import { KpiAssignmentService } from './kpi-assignment.service';
import type { KpiAssignmentSession } from './kpi-assignment.types';
import { HlmButtonDirective } from '../../ui/button';
import { SlicePipe } from '@angular/common';

type SourceType = 'goal-session' | 'custom';

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
      lucideFileText,
      lucidePencil,
      lucideHistory,
      lucideTrash2,
      lucideRotateCw,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Side: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold text-foreground">KPI Assignment</h1>
          </div>
          <p class="text-muted-foreground mb-6">
            Generate KPIs for your goals using AI. Select a Goal Setting session to get started.
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

          <!-- Goal Session Picker -->
          @if (sourceType() === 'goal-session') {
            <div class="mb-6">
              <label class="text-sm font-medium">
                Select Goal Setting Session <span class="text-destructive">*</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Choose a completed Goal Setting session to generate KPIs
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
                  No completed Goal Setting sessions found. <a class="text-primary hover:underline cursor-pointer" (click)="goToGoalSetting()">Create one first</a>.
                </p>
              }
            </div>
          }

          <!-- Manual Goal Entry -->
          @if (sourceType() === 'custom') {
            <div class="mb-6">
              <label class="text-sm font-medium">
                Add Goals Manually
              </label>
              <p class="text-xs text-muted-foreground mt-1 mb-3">
                Enter goals one at a time to generate KPIs
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
          } @else if (service.selectedGoals().length > 0 || manualGoals().length > 0) {
            <!-- Goals Preview -->
            <div class="rounded-lg border bg-background p-6 mb-6">
              <h3 class="font-semibold mb-4">Goals to Generate KPIs For</h3>
              <div class="space-y-3">
                @for (goal of service.selectedGoals(); track goal.id) {
                  <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <ng-icon name="lucideCheck" class="h-5 w-5 text-primary mt-0.5" />
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-blue-100]="goal.priority === 'high'"
                          [class.text-blue-700]="goal.priority === 'high'"
                          [class.bg-yellow-100]="goal.priority === 'medium'"
                          [class.text-yellow-700]="goal.priority === 'medium'"
                          [class.bg-gray-100]="goal.priority === 'low'"
                          [class.text-gray-700]="goal.priority === 'low'"
                        >
                          {{ goal.priority }}
                        </span>
                        <span class="text-xs text-muted-foreground">{{ goal.category }}</span>
                      </div>
                      <h4 class="font-medium">{{ goal.title }}</h4>
                      @if (goal.description) {
                        <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ goal.description }}</p>
                      }
                    </div>
                  </div>
                }
                @for (goal of manualGoals(); track goal.id) {
                  <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <ng-icon name="lucideCheck" class="h-5 w-5 text-primary mt-0.5" />
                    <div class="flex-1">
                      <h4 class="font-medium">{{ goal.title }}</h4>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Generate Button -->
            <button
              hlmBtn
              class="w-full"
              [disabled]="isGenerating()"
              (click)="generateKpis()"
            >
              @if (isGenerating()) {
                <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                Generating KPIs...
              } @else {
                <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                Generate KPIs
              }
            </button>
          } @else {
            <div class="rounded-lg border bg-muted/30 p-8 text-center">
              <ng-icon name="lucideTarget" class="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 class="mt-4 font-medium text-muted-foreground">No Goals Selected</h3>
              <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                @if (sourceType() === 'goal-session') {
                  Select a Goal Setting session above to generate KPIs for your goals.
                } @else {
                  Add goals manually using the input field above.
                }
              </p>
            </div>
          }
        </div>
      </div>

      <!-- Right Side: Session History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Session History</h2>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto">
          @if (service.sessions().length === 0) {
            <div class="flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-1 text-sm text-muted-foreground">Generated KPI sessions will appear here</p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 cursor-pointer"
                  (click)="openSession(session.id)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status === 'generating' || session.status === 'pending'"
                          [class.text-yellow-700]="session.status === 'generating' || session.status === 'pending'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                        >
                          {{ session.status }}
                        </span>
                        <span class="text-xs text-muted-foreground">{{ session.createdAt | slice:0:10 }}</span>
                      </div>
                      <p class="mt-1 text-sm font-medium">Session #{{ session.id }}</p>
                      @if (session.executiveSummary) {
                        <p class="text-xs text-muted-foreground line-clamp-1">{{ session.executiveSummary }}</p>
                      }
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') {
                        <button
                          type="button"
                          class="p-1 hover:text-primary"
                          (click)="retrySession($event, session)"
                        >
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
                      <button
                        type="button"
                        class="p-1 hover:text-destructive opacity-0 group-hover:opacity-100"
                        (click)="deleteSession($event, session)"
                      >
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
  styles: `:host { display: block; height: 100%; } .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`,
})
export class KpiAssignmentInputComponent implements OnInit {
  service = inject(KpiAssignmentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  sourceType = signal<SourceType>('goal-session');
  selectedGoalSessionId = signal<string>('');
  newGoalTitle = signal('');
  manualGoals = signal<{ id: number; title: string }[]>([]);
  isGenerating = signal(false);

  async ngOnInit() {
    await Promise.all([
      this.service.loadGoalSettingSessions(),
      this.service.loadSessions(),
    ]);

    // Check for goalSessionId query param (from Goal Setting CTA)
    const goalSessionId = this.route.snapshot.queryParams['goalSessionId'];
    if (goalSessionId) {
      this.sourceType.set('goal-session');
      this.selectedGoalSessionId.set(goalSessionId);
      await this.service.loadGoalsForSession(Number(goalSessionId));
    }
  }

  setSourceType(type: SourceType) {
    this.sourceType.set(type);
    if (type === 'goal-session') {
      this.manualGoals.set([]);
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

    this.manualGoals.update((goals) => [
      ...goals,
      { id: Date.now(), title },
    ]);
    this.newGoalTitle.set('');
  }

  async generateKpis() {
    const goalSessionId = this.selectedGoalSessionId();
    if (!goalSessionId && this.manualGoals().length === 0) return;

    this.isGenerating.set(true);

    try {
      // Create session and start generation
      const session = await this.service.createSession({
        goalSessionId: goalSessionId ? Number(goalSessionId) : undefined,
      });

      if (session) {
        // Navigate to results page
        this.router.navigate(['/measurements/kpi-assignment/results', session.id]);
      }
    } finally {
      this.isGenerating.set(false);
    }
  }

  openSession(sessionId: number) {
    this.router.navigate(['/measurements/kpi-assignment/results', sessionId]);
  }

  goToGoalSetting() {
    this.router.navigate(['/goals/setting']);
  }

  async retrySession(e: Event, session: KpiAssignmentSession) {
    e.stopPropagation();
    await this.service.retrySession(session.id);
    this.router.navigate(['/measurements/kpi-assignment/results', session.id]);
  }

  async deleteSession(e: Event, session: KpiAssignmentSession) {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      await this.service.deleteSession(session.id);
    }
  }
}
