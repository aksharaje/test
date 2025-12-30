import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGitBranch,
  lucideCheck,
  lucideLoader2,
  lucidePlus,
  lucideTrash2,
  lucidePlay,
  lucideInfo,
  lucideHistory,
  lucideChevronRight,
  lucideArrowRight,
  lucideEye,
  lucideTarget,
  lucideUsers,
  lucideClock,
  lucideScale,
  lucideRotateCw,
} from '@ng-icons/lucide';
import { ScenarioModelerService } from './scenario-modeler.service';
import { RoadmapPlannerService } from '../roadmap-planner/roadmap-planner.service';
import type { ScenarioSession, ScenarioTemplate, VariableChange } from './scenario-modeler.types';
import type { RoadmapSession } from '../roadmap-planner/roadmap-planner.types';

@Component({
  selector: 'app-scenario-modeler-input',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideGitBranch,
      lucideCheck,
      lucideLoader2,
      lucidePlus,
      lucideTrash2,
      lucidePlay,
      lucideInfo,
      lucideHistory,
      lucideChevronRight,
      lucideArrowRight,
      lucideEye,
      lucideTarget,
      lucideUsers,
      lucideClock,
      lucideScale,
      lucideRotateCw,
    }),
  ],
  template: `
    <div class="flex min-h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideGitBranch" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold text-foreground">Scenario Modeler</h1>
          </div>
          <p class="text-muted-foreground mb-6">
            Generate and compare "what-if" scenarios to optimize your roadmap decisions.
          </p>

          <!-- Select Roadmap -->
          <div class="mb-6">
            <label class="text-sm font-medium mb-2 block">Select Roadmap</label>
            @if (roadmaps().length === 0) {
              <div class="border border-dashed rounded-lg p-4 text-center text-muted-foreground">
                <p>No roadmaps available.</p>
                <a href="/roadmapping/planner" class="text-primary hover:underline text-sm">
                  Create a roadmap first
                </a>
              </div>
            } @else {
              <select
                [ngModel]="selectedRoadmapId()"
                (ngModelChange)="onRoadmapSelected($event)"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option [value]="null">Select a roadmap...</option>
                @for (roadmap of roadmaps(); track roadmap.id) {
                  <option [value]="roadmap.id">{{ roadmap.name }}</option>
                }
              </select>
            }
          </div>

          @if (selectedRoadmapId()) {
            <!-- Session Name -->
            <div class="mb-6">
              <label class="text-sm font-medium">Scenario Session Name</label>
              <input
                type="text"
                [(ngModel)]="sessionName"
                class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Q1 2025 What-If Analysis"
              />
            </div>

            <!-- Scenario Templates -->
            <div class="mb-6">
              <label class="text-sm font-medium mb-2 block">Quick Scenario Templates</label>
              <div class="grid grid-cols-2 gap-2">
                @for (template of templates(); track template.id) {
                  <button
                    (click)="addFromTemplate(template)"
                    class="flex items-start gap-2 p-3 border-2 rounded-lg text-left transition-colors relative"
                    [class.border-primary]="selectedTemplates().has(template.id)"
                    [class.bg-primary/5]="selectedTemplates().has(template.id)"
                    [class.border-slate-200]="!selectedTemplates().has(template.id)"
                    [class.hover:bg-slate-50]="!selectedTemplates().has(template.id)"
                  >
                    @if (selectedTemplates().has(template.id)) {
                      <div class="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <ng-icon name="lucideCheck" class="h-3 w-3 text-white" />
                      </div>
                    }
                    <ng-icon
                      [name]="getTemplateIcon(template.id)"
                      class="h-4 w-4 mt-0.5"
                      [class.text-primary]="selectedTemplates().has(template.id)"
                      [class.text-muted-foreground]="!selectedTemplates().has(template.id)"
                    />
                    <div>
                      <p class="font-medium text-sm">{{ template.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ template.description }}</p>
                    </div>
                  </button>
                }
              </div>
            </div>

            <!-- Custom Scenario -->
            <div class="mb-6">
              <label class="text-sm font-medium mb-2 block">Or Create Custom Scenario</label>
              <div class="border rounded-lg p-4">
                <div class="mb-3">
                  <label class="text-xs text-muted-foreground">Scenario Name</label>
                  <input
                    type="text"
                    [(ngModel)]="customScenarioName"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Custom scenario name"
                  />
                </div>
                <div class="mb-3">
                  <label class="text-xs text-muted-foreground">Variable Change Type</label>
                  <select
                    [(ngModel)]="customChangeType"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="capacity">Team Capacity</option>
                    <option value="priority">Priority</option>
                    <option value="timeline">Timeline</option>
                    <option value="scope">Scope</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="text-xs text-muted-foreground">Change Value</label>
                  <input
                    type="text"
                    [(ngModel)]="customChangeValue"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g., +25%, -20%, 90"
                  />
                </div>
                <button
                  (click)="addCustomScenario()"
                  class="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  <ng-icon name="lucidePlus" class="h-4 w-4" />
                  Add Custom Scenario
                </button>
              </div>
            </div>

            <!-- Selected Scenarios -->
            @if (selectedScenarios().length > 0) {
              <div class="mb-6">
                <label class="text-sm font-medium mb-2 block">
                  Scenarios to Generate ({{ selectedScenarios().length }})
                </label>
                <div class="space-y-2">
                  @for (scenario of selectedScenarios(); track scenario.name) {
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p class="font-medium text-sm">{{ scenario.name }}</p>
                        <p class="text-xs text-muted-foreground">
                          {{ getChangeDescription(scenario) }}
                        </p>
                      </div>
                      <button
                        (click)="removeScenario(scenario)"
                        class="p-1 hover:bg-slate-200 rounded"
                      >
                        <ng-icon name="lucideTrash2" class="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Generate Button -->
            <button
              (click)="createAndGenerate()"
              [disabled]="!canGenerate() || isLoading()"
              class="w-full px-6 py-3 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              @if (isLoading()) {
                <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin" />
                Creating Session...
              } @else {
                <ng-icon name="lucidePlay" class="h-5 w-5" />
                Generate Scenarios
              }
            </button>
          }
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30 min-h-full">
        <div class="border-b bg-white p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Scenario History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past scenario sessions
          </p>
        </div>

        <div class="flex-1 overflow-y-auto">
          @if (previousSessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-64">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your scenario sessions will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of previousSessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-white p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session.id)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status === 'generating' || session.status === 'comparing'"
                          [class.text-yellow-700]="session.status === 'generating' || session.status === 'comparing'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-slate-100]="session.status === 'draft'"
                          [class.text-slate-700]="session.status === 'draft'"
                        >
                          {{ getStatusLabel(session.status) }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ session.createdAt | date:'MMM d, yyyy' }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-foreground">
                        {{ session.name }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ session.totalVariants }} variants · {{ session.viableVariants }} viable
                      </p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed' || session.status === 'draft') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry"
                        >
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        (click)="deleteSessionClick($event, session)"
                        title="Delete"
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
})
export class ScenarioModelerInputComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private scenarioService = inject(ScenarioModelerService);
  private roadmapService = inject(RoadmapPlannerService);

  // State
  roadmaps = signal<RoadmapSession[]>([]);
  selectedRoadmapId = signal<number | null>(null);
  sessionName = '';
  templates = this.scenarioService.templates;
  previousSessions = signal<ScenarioSession[]>([]);
  isLoading = this.scenarioService.isLoading;

  // Selected scenarios
  selectedTemplates = signal(new Set<string>());
  selectedScenarios = signal<Array<{ name: string; variableChanges: VariableChange[] }>>([]);

  // Custom scenario form
  customScenarioName = '';
  customChangeType: 'capacity' | 'priority' | 'timeline' | 'scope' = 'capacity';
  customChangeValue = '';

  canGenerate = computed(() => {
    return this.selectedRoadmapId() !== null && this.selectedScenarios().length > 0;
  });

  async ngOnInit() {
    // Load roadmaps (returns Observable, need to convert to Promise)
    const roadmaps = await this.roadmapService.loadSessions().toPromise();
    this.roadmaps.set(roadmaps || []);

    // Load templates
    await this.scenarioService.loadTemplates();

    // Load previous sessions
    await this.scenarioService.loadSessions();
    this.previousSessions.set(this.scenarioService.sessions());

    // Check for roadmapId query param
    const roadmapId = this.route.snapshot.queryParams['roadmapId'];
    if (roadmapId) {
      this.selectedRoadmapId.set(Number(roadmapId));
      await this.onRoadmapSelected(Number(roadmapId));
    }
  }

  async onRoadmapSelected(roadmapId: number | null) {
    this.selectedRoadmapId.set(roadmapId);
    if (roadmapId) {
      // Load sessions for this roadmap
      await this.scenarioService.loadSessions(roadmapId);
      this.previousSessions.set(this.scenarioService.sessions());
    }
  }

  getTemplateIcon(templateId: string): string {
    const icons: Record<string, string> = {
      add_team_member: 'lucideUsers',
      remove_team_member: 'lucideUsers',
      accelerate_theme: 'lucideTarget',
      defer_non_critical: 'lucideScale',
      compress_timeline: 'lucideClock',
    };
    return icons[templateId] || 'lucideGitBranch';
  }

  addFromTemplate(template: ScenarioTemplate) {
    const templates = new Set(this.selectedTemplates());
    const scenarios = [...this.selectedScenarios()];

    if (templates.has(template.id)) {
      templates.delete(template.id);
      const idx = scenarios.findIndex((s) => s.name === template.name);
      if (idx >= 0) scenarios.splice(idx, 1);
    } else {
      templates.add(template.id);
      scenarios.push({
        name: template.name,
        variableChanges: template.variableChanges.map((c) => ({
          changeType: c.changeType as any,
          target: c.target,
          value: c.value,
        })),
      });
    }

    this.selectedTemplates.set(templates);
    this.selectedScenarios.set(scenarios);
  }

  addCustomScenario() {
    if (!this.customScenarioName || !this.customChangeValue) return;

    const scenarios = [...this.selectedScenarios()];
    scenarios.push({
      name: this.customScenarioName,
      variableChanges: [
        {
          changeType: this.customChangeType,
          target: this.getDefaultTarget(this.customChangeType),
          value: this.customChangeValue,
        },
      ],
    });
    this.selectedScenarios.set(scenarios);

    // Reset form
    this.customScenarioName = '';
    this.customChangeValue = '';
  }

  getDefaultTarget(changeType: string): string {
    switch (changeType) {
      case 'capacity':
        return 'team_capacity';
      case 'priority':
        return 'theme';
      case 'timeline':
        return 'total_sprints';
      case 'scope':
        return 'low_priority_items';
      default:
        return 'general';
    }
  }

  removeScenario(scenario: { name: string }) {
    const scenarios = this.selectedScenarios().filter((s) => s.name !== scenario.name);
    this.selectedScenarios.set(scenarios);

    // Also remove from templates if applicable
    const templates = new Set(this.selectedTemplates());
    const template = this.templates().find((t) => t.name === scenario.name);
    if (template) {
      templates.delete(template.id);
      this.selectedTemplates.set(templates);
    }
  }

  getChangeDescription(scenario: { variableChanges: VariableChange[] }): string {
    return scenario.variableChanges
      .map((c) => `${c.changeType}: ${c.value}`)
      .join(', ');
  }

  async createAndGenerate() {
    if (!this.selectedRoadmapId()) return;

    try {
      // Create session
      const session = await this.scenarioService.createSession({
        roadmapSessionId: this.selectedRoadmapId()!,
        name: this.sessionName || 'Scenario Analysis',
      });

      // Add variants
      for (const scenario of this.selectedScenarios()) {
        await this.scenarioService.createVariant(session.id, {
          name: scenario.name,
          variableChanges: scenario.variableChanges,
        });
      }

      // Start generation
      await this.scenarioService.generateScenarios(session.id);

      // Navigate to results
      this.router.navigate(['/roadmapping/scenario-modeler/session', session.id]);
    } catch (err) {
      console.error('Failed to create scenario session', err);
    }
  }

  viewSession(sessionId: number) {
    this.router.navigate(['/roadmapping/scenario-modeler/session', sessionId]);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      generating: 'Generating',
      comparing: 'Comparing',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  async retrySession(event: Event, session: ScenarioSession) {
    event.stopPropagation();
    try {
      await this.scenarioService.generateScenarios(session.id);
      this.router.navigate(['/roadmapping/scenario-modeler/session', session.id]);
    } catch (err) {
      console.error('Failed to retry session', err);
    }
  }

  async deleteSessionClick(event: Event, session: ScenarioSession) {
    event.stopPropagation();
    if (confirm(`Delete "${session.name}"? This cannot be undone.`)) {
      try {
        await this.scenarioService.deleteSession(session.id);
        this.previousSessions.update((sessions) =>
          sessions.filter((s) => s.id !== session.id)
        );
      } catch (err) {
        console.error('Failed to delete session', err);
      }
    }
  }
}
