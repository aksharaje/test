import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTarget,
  lucideLoader2,
  lucideArrowLeft,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideChevronDown,
  lucideChevronRight,
  lucideRotateCw,
  lucideFlag,
  lucideClock,
  lucideAlertTriangle,
  lucidePencil,
  lucideX,
  lucideSave,
  lucideDownload,
  lucideFileText,
} from '@ng-icons/lucide';
import { GoalSettingService } from './goal-setting.service';
import type { GoalSettingSession, Goal } from './goal-setting.types';
import { HlmButtonDirective } from '../../ui/button';

const CURRENT_YEAR = new Date().getFullYear();
const TIMEFRAME_OPTIONS = [
  { value: `Q1 ${CURRENT_YEAR}`, label: `Q1 ${CURRENT_YEAR}` },
  { value: `Q2 ${CURRENT_YEAR}`, label: `Q2 ${CURRENT_YEAR}` },
  { value: `Q3 ${CURRENT_YEAR}`, label: `Q3 ${CURRENT_YEAR}` },
  { value: `Q4 ${CURRENT_YEAR}`, label: `Q4 ${CURRENT_YEAR}` },
  { value: `Q1 ${CURRENT_YEAR + 1}`, label: `Q1 ${CURRENT_YEAR + 1}` },
  { value: `Q2 ${CURRENT_YEAR + 1}`, label: `Q2 ${CURRENT_YEAR + 1}` },
];

interface EditFormData {
  id: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'strategic' | 'operational' | 'tactical';
  timeframe: string | undefined;
}

@Component({
  selector: 'app-goal-setting-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideTarget,
      lucideLoader2,
      lucideArrowLeft,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideChevronDown,
      lucideChevronRight,
      lucideRotateCw,
      lucideFlag,
      lucideClock,
      lucideAlertTriangle,
      lucidePencil,
      lucideX,
      lucideSave,
      lucideDownload,
      lucideFileText,
    }),
  ],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-4xl mx-auto p-6">
        <!-- Header -->
        <div class="flex items-center gap-4 mb-6">
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            (click)="goBack()"
          >
            <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
          </button>
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 class="text-2xl font-bold text-foreground">Goal Setting Results</h1>
              <p class="text-sm text-muted-foreground">
                @if (session()) {
                  {{ formatDate(session()!.createdAt) }}
                }
              </p>
            </div>
          </div>
          @if (session()?.status === 'completed') {
            <div class="ml-auto flex gap-2">
              <button
                hlmBtn
                variant="outline"
                size="sm"
                (click)="exportToPdf()"
                title="Export as PDF"
              >
                <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
                Export PDF
              </button>
            </div>
          }
        </div>

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-16">
            <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
            <p class="mt-4 text-lg font-medium text-muted-foreground">
              {{ session()?.progressMessage || 'Generating goals...' }}
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              This may take a minute
            </p>
          </div>
        }

        <!-- Error State -->
        @if (session()?.status === 'failed') {
          <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
            <div class="flex items-start gap-4">
              <ng-icon name="lucideAlertCircle" class="h-6 w-6 text-destructive flex-shrink-0" />
              <div class="flex-1">
                <h3 class="font-semibold text-destructive">Generation Failed</h3>
                <p class="mt-1 text-sm text-destructive/80">
                  {{ session()?.errorMessage || 'An unexpected error occurred' }}
                </p>
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  class="mt-4"
                  (click)="retry()"
                >
                  <ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Results -->
        @if (session()?.status === 'completed') {
          <!-- Executive Summary -->
          @if (session()?.executiveSummary) {
            <div class="rounded-lg border bg-primary/5 p-4 mb-6">
              <h2 class="font-semibold text-foreground mb-2">Executive Summary</h2>
              <p class="text-sm text-muted-foreground">{{ session()?.executiveSummary }}</p>
            </div>
          }

          <!-- Goals -->
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">Generated Goals ({{ goals().length }})</h2>

            @for (goal of goals(); track goal.id) {
              <div class="rounded-lg border bg-background overflow-hidden">
                <!-- Goal Header -->
                <div class="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <button
                    class="flex items-center gap-3 flex-1"
                    (click)="toggleGoal(goal.id)"
                  >
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      [class.bg-red-100]="goal.priority === 'high'"
                      [class.text-red-700]="goal.priority === 'high'"
                      [class.bg-yellow-100]="goal.priority === 'medium'"
                      [class.text-yellow-700]="goal.priority === 'medium'"
                      [class.bg-green-100]="goal.priority === 'low'"
                      [class.text-green-700]="goal.priority === 'low'"
                    >
                      {{ goal.priority }}
                    </span>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
                    >
                      {{ goal.category }}
                    </span>
                    @if (goal.timeframe) {
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                        {{ goal.timeframe }}
                      </span>
                    }
                    <h3 class="font-medium text-foreground">{{ goal.title }}</h3>
                  </button>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="p-1 text-muted-foreground hover:text-primary"
                      (click)="openEditModal(goal); $event.stopPropagation()"
                    >
                      <ng-icon name="lucidePencil" class="h-4 w-4" />
                    </button>
                    <button
                      class="p-1 text-muted-foreground"
                      (click)="toggleGoal(goal.id)"
                    >
                      <ng-icon
                        [name]="expandedGoals().has(goal.id) ? 'lucideChevronDown' : 'lucideChevronRight'"
                        class="h-5 w-5"
                      />
                    </button>
                  </div>
                </div>

                <!-- Goal Details -->
                @if (expandedGoals().has(goal.id)) {
                  <div class="border-t p-4 space-y-4">
                    <p class="text-sm text-muted-foreground">{{ goal.description }}</p>

                    <!-- SMART Criteria -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="space-y-3">
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specific</h4>
                          <p class="text-sm mt-1">{{ goal.specific }}</p>
                        </div>
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Measurable</h4>
                          <p class="text-sm mt-1">{{ goal.measurable }}</p>
                        </div>
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achievable</h4>
                          <p class="text-sm mt-1">{{ goal.achievable }}</p>
                        </div>
                      </div>
                      <div class="space-y-3">
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Relevant</h4>
                          <p class="text-sm mt-1">{{ goal.relevant }}</p>
                        </div>
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time-Bound</h4>
                          <p class="text-sm mt-1">{{ goal.timeBound }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- Success Criteria -->
                    @if (goal.successCriteria && goal.successCriteria.length > 0) {
                      <div>
                        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <ng-icon name="lucideCheckCircle" class="h-3 w-3" />
                          Success Criteria
                        </h4>
                        <ul class="mt-2 space-y-1">
                          @for (criterion of goal.successCriteria; track criterion) {
                            <li class="text-sm text-muted-foreground flex items-start gap-2">
                              <span class="text-primary">•</span>
                              {{ criterion }}
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Dependencies & Risks -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      @if (goal.dependencies && goal.dependencies.length > 0) {
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <ng-icon name="lucideFlag" class="h-3 w-3" />
                            Dependencies
                          </h4>
                          <ul class="mt-2 space-y-1">
                            @for (dep of goal.dependencies; track dep) {
                              <li class="text-sm text-muted-foreground flex items-start gap-2">
                                <span class="text-blue-500">•</span>
                                {{ dep }}
                              </li>
                            }
                          </ul>
                        </div>
                      }
                      @if (goal.risks && goal.risks.length > 0) {
                        <div>
                          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <ng-icon name="lucideAlertTriangle" class="h-3 w-3" />
                            Risks
                          </h4>
                          <ul class="mt-2 space-y-1">
                            @for (risk of goal.risks; track risk) {
                              <li class="text-sm text-muted-foreground flex items-start gap-2">
                                <span class="text-amber-500">•</span>
                                {{ risk }}
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Next Steps CTAs -->
          <div class="mt-8 pt-6 border-t">
            <h3 class="text-lg font-semibold mb-4">Continue Your Workflow</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                hlmBtn
                class="w-full justify-start"
                (click)="continueToOkrGenerator()"
              >
                <ng-icon name="lucideTarget" class="mr-3 h-5 w-5" />
                <div class="text-left">
                  <div class="font-medium">Generate OKRs</div>
                  <div class="text-xs text-muted-foreground">Create Objectives & Key Results from these goals</div>
                </div>
                <ng-icon name="lucideChevronRight" class="ml-auto h-5 w-5" />
              </button>
              <button
                hlmBtn
                variant="outline"
                class="w-full justify-start"
                (click)="continueToKpiAssignment()"
              >
                <ng-icon name="lucideTarget" class="mr-3 h-5 w-5" />
                <div class="text-left">
                  <div class="font-medium">Assign KPIs</div>
                  <div class="text-xs text-muted-foreground">Assign KPIs directly to these goals</div>
                </div>
                <ng-icon name="lucideChevronRight" class="ml-auto h-5 w-5" />
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Edit Goal Modal -->
    @if (editingGoal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="closeEditModal()">
        <div class="bg-background rounded-lg shadow-lg w-full max-w-lg mx-4" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-4 border-b">
            <h2 class="text-lg font-semibold">Edit Goal</h2>
            <button type="button" class="p-1 text-muted-foreground hover:text-foreground" (click)="closeEditModal()">
              <ng-icon name="lucideX" class="h-5 w-5" />
            </button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="text-sm font-medium">Title</label>
              <input
                type="text"
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                [value]="editForm().title"
                (input)="onEditFormChange('title', $event)"
              />
            </div>
            <div>
              <label class="text-sm font-medium">Description</label>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                [value]="editForm().description"
                (input)="onEditFormChange('description', $event)"
              ></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium">Priority</label>
                <select
                  class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="editForm().priority"
                  (change)="onEditFormChange('priority', $event)"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label class="text-sm font-medium">Timeframe</label>
                <select
                  class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="editForm().timeframe || ''"
                  (change)="onEditFormChange('timeframe', $event)"
                >
                  <option value="">-- Select --</option>
                  @for (tf of timeframeOptions; track tf.value) {
                    <option [value]="tf.value">{{ tf.label }}</option>
                  }
                </select>
              </div>
            </div>
            <div>
              <label class="text-sm font-medium">Category</label>
              <select
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                [value]="editForm().category"
                (change)="onEditFormChange('category', $event)"
              >
                <option value="strategic">Strategic</option>
                <option value="operational">Operational</option>
                <option value="tactical">Tactical</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-2 p-4 border-t">
            <button hlmBtn variant="outline" (click)="closeEditModal()">Cancel</button>
            <button hlmBtn (click)="saveGoalEdit()">
              <ng-icon name="lucideSave" class="mr-2 h-4 w-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class GoalSettingResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(GoalSettingService);

  session = signal<GoalSettingSession | null>(null);
  goals = signal<Goal[]>([]);
  isLoading = signal(true);
  expandedGoals = signal<Set<number>>(new Set());

  // Edit modal state
  editingGoal = signal<Goal | null>(null);
  editForm = signal<EditFormData>({ id: 0, title: '', description: '', priority: 'medium', category: 'operational', timeframe: undefined });
  timeframeOptions = TIMEFRAME_OPTIONS;

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) {
      this.router.navigate(['/goals/setting']);
      return;
    }

    await this.loadSession(sessionId);
  }

  async loadSession(sessionId: number) {
    this.isLoading.set(true);

    // Poll if still processing
    let session = await this.service.getSession(sessionId);
    while (session && (session.status === 'pending' || session.status === 'generating')) {
      this.session.set(session);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      session = await this.service.getSession(sessionId);
    }

    if (session) {
      this.session.set(session);
      if (session.status === 'completed') {
        const fullData = await this.service.getSessionFull(sessionId);
        if (fullData) {
          this.goals.set(fullData.goals);
          // Expand first goal by default
          if (fullData.goals.length > 0) {
            this.expandedGoals.set(new Set([fullData.goals[0].id]));
          }
        }
      }
    }

    this.isLoading.set(false);
  }

  toggleGoal(goalId: number) {
    this.expandedGoals.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(goalId)) {
        newSet.delete(goalId);
      } else {
        newSet.add(goalId);
      }
      return newSet;
    });
  }

  async retry() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.isLoading.set(true);
      await this.service.retrySession(sessionId);
      await this.loadSession(sessionId);
    }
  }

  goBack() {
    this.router.navigate(['/goals/setting']);
  }

  continueToOkrGenerator() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.router.navigate(['/measurements/okr-generator'], { queryParams: { goalSessionId: sessionId } });
    }
  }

  continueToKpiAssignment() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.router.navigate(['/measurements/kpi-assignment'], { queryParams: { goalSessionId: sessionId, autoRun: 'true' } });
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  // Edit modal methods
  openEditModal(goal: Goal) {
    this.editingGoal.set(goal);
    this.editForm.set({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      priority: goal.priority,
      category: goal.category,
      timeframe: goal.timeframe,
    });
  }

  closeEditModal() {
    this.editingGoal.set(null);
  }

  onEditFormChange(field: keyof EditFormData, event: Event) {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.editForm.update((form) => ({
      ...form,
      [field]: value,
    }));
  }

  saveGoalEdit() {
    const form = this.editForm();
    // Update local state (in production, this would call the API)
    this.goals.update((goals) =>
      goals.map((goal) =>
        goal.id === form.id
          ? {
            ...goal,
            title: form.title,
            description: form.description,
            priority: form.priority,
            category: form.category,
            timeframe: form.timeframe || undefined,
          }
          : goal
      )
    );
    this.closeEditModal();
  }

  exportToPdf() {
    const session = this.session();
    const goals = this.goals();
    if (!session || goals.length === 0) return;

    // Build styled HTML document for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Goals - ${session.domain || 'Goal Setting Results'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 48px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid #6366f1;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      font-size: 14px;
      color: #64748b;
    }
    
    .header .date {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
    }
    
    .summary {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      padding: 20px 24px;
      border-radius: 12px;
      margin-bottom: 32px;
      border-left: 4px solid #0ea5e9;
    }
    
    .summary h2 {
      font-size: 14px;
      font-weight: 600;
      color: #0369a1;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .summary p {
      font-size: 14px;
      color: #334155;
    }
    
    .goal {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .goal-header {
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .goal-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    
    .tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .tag {
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 20px;
      text-transform: capitalize;
    }
    
    .tag-high { background: #fee2e2; color: #b91c1c; }
    .tag-medium { background: #fef3c7; color: #b45309; }
    .tag-low { background: #dcfce7; color: #15803d; }
    .tag-category { background: #f1f5f9; color: #475569; }
    .tag-timeframe { background: #dbeafe; color: #1d4ed8; }
    
    .goal-body {
      padding: 20px;
    }
    
    .description {
      font-size: 14px;
      color: #475569;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px dashed #e2e8f0;
    }
    
    .smart-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    
    .smart-item h4 {
      font-size: 11px;
      font-weight: 600;
      color: #6366f1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .smart-item p {
      font-size: 13px;
      color: #334155;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      margin-top: 16px;
    }
    
    .list {
      list-style: none;
      padding: 0;
    }
    
    .list li {
      font-size: 13px;
      color: #475569;
      padding: 4px 0;
      padding-left: 16px;
      position: relative;
    }
    
    .list li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #6366f1;
      font-weight: bold;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    
    @media print {
      body { padding: 24px; }
      .goal { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.domain || 'Strategic Goals'}</h1>
    <div class="subtitle">${goals.length} Goals Generated</div>
    <div class="date">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
  
  ${session.executiveSummary ? `
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${session.executiveSummary}</p>
  </div>
  ` : ''}
  
  ${goals.map((goal, index) => `
  <div class="goal">
    <div class="goal-header">
      <h3>${index + 1}. ${goal.title}</h3>
      <div class="tags">
        <span class="tag tag-${goal.priority}">${goal.priority} Priority</span>
        <span class="tag tag-category">${goal.category}</span>
        ${goal.timeframe ? `<span class="tag tag-timeframe">${goal.timeframe}</span>` : ''}
      </div>
    </div>
    <div class="goal-body">
      <p class="description">${goal.description}</p>
      
      <div class="smart-grid">
        <div class="smart-item">
          <h4>Specific</h4>
          <p>${goal.specific || 'Not specified'}</p>
        </div>
        <div class="smart-item">
          <h4>Measurable</h4>
          <p>${goal.measurable || 'Not specified'}</p>
        </div>
        <div class="smart-item">
          <h4>Achievable</h4>
          <p>${goal.achievable || 'Not specified'}</p>
        </div>
        <div class="smart-item">
          <h4>Relevant</h4>
          <p>${goal.relevant || 'Not specified'}</p>
        </div>
        <div class="smart-item">
          <h4>Time-Bound</h4>
          <p>\${goal.timeBound || 'Not specified'}</p>
        </div>
      </div>
      
      ${goal.successCriteria && goal.successCriteria.length > 0 ? `
      <div class="section-title">Success Criteria</div>
      <ul class="list">
        ${goal.successCriteria.map(c => `<li>${c}</li>`).join('')}
      </ul>
      ` : ''}
      
      ${goal.dependencies && goal.dependencies.length > 0 ? `
      <div class="section-title">Dependencies</div>
      <ul class="list">
        ${goal.dependencies.map(d => `<li>${d}</li>`).join('')}
      </ul>
      ` : ''}
      
      ${goal.risks && goal.risks.length > 0 ? `
      <div class="section-title">Risks</div>
      <ul class="list">
        ${goal.risks.map(r => `<li>${r}</li>`).join('')}
      </ul>
      ` : ''}
    </div>
  </div>
  `).join('')}
  
  <div class="footer">
    Generated by Product Studio • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    // Open in new window and trigger print dialog (Save as PDF)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Delay to let fonts load
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}
