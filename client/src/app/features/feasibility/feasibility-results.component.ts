import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideX,
  lucideAlertTriangle,
  lucideSave,
  lucideLoader2,
  lucideBriefcase,
  lucideFileText,
} from '@ng-icons/lucide';
import { FeasibilityService } from './feasibility.service';
import type {
  TechnicalComponent,
  TimelineScenario,
  RiskAssessment,
  SkillRequirement,
  UpdateComponentRequest,
} from './feasibility.types';
import { HlmButtonDirective } from '../../ui/button';

type TabId = 'summary' | 'components' | 'timeline' | 'risks' | 'skills';

interface Tab {
  id: TabId;
  label: string;
}

@Component({
  selector: 'app-feasibility-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, TitleCasePipe],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideX,
      lucideAlertTriangle,
      lucideSave,
      lucideLoader2,
      lucideBriefcase,
      lucideFileText,
    }),
  ],
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="border-b bg-background p-4">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="p-2 rounded-lg hover:bg-muted transition-colors"
              (click)="goBack()"
            >
              <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
            </button>
            <div>
              <h1 class="text-xl font-bold text-foreground">Feasibility Analysis Results</h1>
              <p class="text-sm text-muted-foreground line-clamp-1 max-w-xl">
                {{ session()?.featureDescription }}
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              hlmBtn
              variant="outline"
              (click)="exportToPdf()"
            >
              <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
              Export PDF
            </button>
            <button
              hlmBtn
              (click)="buildBusinessCase()"
            >
              <ng-icon name="lucideBriefcase" class="mr-2 h-4 w-4" />
              Build Business Case
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="border-b bg-background">
        <div class="max-w-6xl mx-auto">
          <div class="flex gap-1 p-1">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                [class.bg-primary]="activeTab() === tab.id"
                [class.text-primary-foreground]="activeTab() === tab.id"
                [class.text-muted-foreground]="activeTab() !== tab.id"
                [class.hover:bg-muted]="activeTab() !== tab.id"
                (click)="setActiveTab(tab.id)"
              >
                {{ tab.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-6xl mx-auto">
          @if (service.loading()) {
            <div class="flex items-center justify-center h-64">
              <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-primary" />
            </div>
          } @else {
            @switch (activeTab()) {
              @case ('summary') {
                <!-- Executive Summary Tab -->
                <div class="space-y-6">
                  <!-- Go/No-Go Badge -->
                  <div class="flex items-center gap-4">
                    <div
                      class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-semibold"
                      [class.bg-green-100]="session()?.goNoGoRecommendation === 'go'"
                      [class.text-green-700]="session()?.goNoGoRecommendation === 'go'"
                      [class.bg-red-100]="session()?.goNoGoRecommendation === 'no_go'"
                      [class.text-red-700]="session()?.goNoGoRecommendation === 'no_go'"
                      [class.bg-yellow-100]="session()?.goNoGoRecommendation === 'conditional'"
                      [class.text-yellow-700]="session()?.goNoGoRecommendation === 'conditional'"
                    >
                      @if (session()?.goNoGoRecommendation === 'go') {
                        <ng-icon name="lucideCheck" class="h-5 w-5" />
                        Recommended: GO
                      } @else if (session()?.goNoGoRecommendation === 'no_go') {
                        <ng-icon name="lucideX" class="h-5 w-5" />
                        Recommended: NO-GO
                      } @else {
                        <ng-icon name="lucideAlertTriangle" class="h-5 w-5" />
                        Recommended: CONDITIONAL
                      }
                    </div>
                    <span
                      class="px-3 py-1 rounded-full text-sm font-medium"
                      [class.bg-green-50]="session()?.confidenceLevel === 'high'"
                      [class.text-green-600]="session()?.confidenceLevel === 'high'"
                      [class.bg-yellow-50]="session()?.confidenceLevel === 'medium'"
                      [class.text-yellow-600]="session()?.confidenceLevel === 'medium'"
                      [class.bg-red-50]="session()?.confidenceLevel === 'low'"
                      [class.text-red-600]="session()?.confidenceLevel === 'low'"
                    >
                      {{ session()?.confidenceLevel | titlecase }} Confidence
                    </span>
                  </div>

                  <!-- Executive Summary -->
                  <div class="rounded-lg border bg-card p-6">
                    <h2 class="text-lg font-semibold mb-3">Executive Summary</h2>
                    <p class="text-muted-foreground whitespace-pre-line">{{ session()?.executiveSummary }}</p>
                  </div>

                  <!-- Key Metrics -->
                  <div class="grid grid-cols-4 gap-4">
                    <div class="rounded-lg border bg-card p-4 text-center">
                      <p class="text-3xl font-bold text-primary">{{ components().length }}</p>
                      <p class="text-sm text-muted-foreground">Components</p>
                    </div>
                    <div class="rounded-lg border bg-card p-4 text-center">
                      <p class="text-3xl font-bold text-primary">{{ totalRealisticHours() }}</p>
                      <p class="text-sm text-muted-foreground">Est. Hours</p>
                    </div>
                    <div class="rounded-lg border bg-card p-4 text-center">
                      <p class="text-3xl font-bold text-primary">{{ realisticScenario()?.totalWeeks || '-' }}</p>
                      <p class="text-sm text-muted-foreground">Est. Weeks</p>
                    </div>
                    <div class="rounded-lg border bg-card p-4 text-center">
                      <p class="text-3xl font-bold text-primary">{{ risks().length }}</p>
                      <p class="text-sm text-muted-foreground">Risks Identified</p>
                    </div>
                  </div>

                  <!-- Technologies Mentioned -->
                  @if (session()?.autoDetectedStack?.length) {
                    <div class="rounded-lg border bg-card p-6">
                      <h2 class="text-lg font-semibold mb-3">Technologies Mentioned</h2>
                      <p class="text-xs text-muted-foreground mb-3">Based on the feature description</p>
                      <div class="flex flex-wrap gap-2">
                        @for (tech of session()?.autoDetectedStack; track tech) {
                          <span class="px-3 py-1 bg-muted rounded-full text-sm">{{ tech }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              @case ('components') {
                <!-- Components Tab -->
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold">Technical Components</h2>
                    @if (hasUnsavedChanges()) {
                      <button
                        hlmBtn
                        (click)="saveAllComponents()"
                        [disabled]="saving()"
                      >
                        @if (saving()) {
                          <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        } @else {
                          <ng-icon name="lucideSave" class="mr-2 h-4 w-4" />
                          Save Changes
                        }
                      </button>
                    }
                  </div>

                  <div class="rounded-lg border overflow-hidden">
                    <table class="w-full">
                      <thead class="bg-muted/50">
                        <tr>
                          <th class="text-left p-3 text-sm font-medium">Component</th>
                          <th class="text-left p-3 text-sm font-medium">Category</th>
                          <th class="text-center p-3 text-sm font-medium">Optimistic (hrs)</th>
                          <th class="text-center p-3 text-sm font-medium">Realistic (hrs)</th>
                          <th class="text-center p-3 text-sm font-medium">Pessimistic (hrs)</th>
                          <th class="text-center p-3 text-sm font-medium">Confidence</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y">
                        @for (component of components(); track component.id) {
                          <tr class="hover:bg-muted/30">
                            <td class="p-3">
                              <p class="font-medium">{{ component.componentName }}</p>
                              <p class="text-sm text-muted-foreground">{{ component.componentDescription }}</p>
                            </td>
                            <td class="p-3">
                              <span class="px-2 py-1 bg-muted rounded text-xs">
                                {{ formatCategory(component.technicalCategory) }}
                              </span>
                            </td>
                            <td class="p-3 text-center">
                              @if (component.isEditable) {
                                <input
                                  type="number"
                                  class="w-20 text-center border rounded p-1"
                                  [value]="getEditedValue(component.id, 'optimisticHours', component.optimisticHours)"
                                  (input)="onHoursChange(component.id, 'optimisticHours', $event)"
                                  min="0"
                                />
                              } @else {
                                {{ component.optimisticHours }}
                              }
                            </td>
                            <td class="p-3 text-center">
                              @if (component.isEditable) {
                                <input
                                  type="number"
                                  class="w-20 text-center border rounded p-1"
                                  [value]="getEditedValue(component.id, 'realisticHours', component.realisticHours)"
                                  (input)="onHoursChange(component.id, 'realisticHours', $event)"
                                  min="0"
                                />
                              } @else {
                                {{ component.realisticHours }}
                              }
                            </td>
                            <td class="p-3 text-center">
                              @if (component.isEditable) {
                                <input
                                  type="number"
                                  class="w-20 text-center border rounded p-1"
                                  [value]="getEditedValue(component.id, 'pessimisticHours', component.pessimisticHours)"
                                  (input)="onHoursChange(component.id, 'pessimisticHours', $event)"
                                  min="0"
                                />
                              } @else {
                                {{ component.pessimisticHours }}
                              }
                            </td>
                            <td class="p-3 text-center">
                              <span
                                class="px-2 py-1 rounded text-xs"
                                [class.bg-green-100]="component.confidenceLevel === 'high'"
                                [class.text-green-700]="component.confidenceLevel === 'high'"
                                [class.bg-yellow-100]="component.confidenceLevel === 'medium'"
                                [class.text-yellow-700]="component.confidenceLevel === 'medium'"
                                [class.bg-red-100]="component.confidenceLevel === 'low'"
                                [class.text-red-700]="component.confidenceLevel === 'low'"
                              >
                                {{ component.confidenceLevel | titlecase }}
                              </span>
                            </td>
                          </tr>
                        }
                      </tbody>
                      <tfoot class="bg-muted/50 font-medium">
                        <tr>
                          <td class="p-3" colspan="2">Total</td>
                          <td class="p-3 text-center">{{ totalOptimisticHours() }}</td>
                          <td class="p-3 text-center">{{ totalRealisticHours() }}</td>
                          <td class="p-3 text-center">{{ totalPessimisticHours() }}</td>
                          <td class="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              }

              @case ('timeline') {
                <!-- Timeline Tab -->
                <div class="space-y-6">
                  <h2 class="text-lg font-semibold">Timeline Scenarios</h2>

                  <div class="grid grid-cols-3 gap-6">
                    @for (scenario of scenarios(); track scenario.id) {
                      <div
                        class="rounded-lg border p-6"
                        [class.border-green-300]="scenario.scenarioType === 'optimistic'"
                        [class.bg-green-50/50]="scenario.scenarioType === 'optimistic'"
                        [class.border-blue-300]="scenario.scenarioType === 'realistic'"
                        [class.bg-blue-50/50]="scenario.scenarioType === 'realistic'"
                        [class.border-orange-300]="scenario.scenarioType === 'pessimistic'"
                        [class.bg-orange-50/50]="scenario.scenarioType === 'pessimistic'"
                      >
                        <h3 class="text-lg font-semibold capitalize">{{ scenario.scenarioType }}</h3>

                        <div class="mt-4 space-y-3">
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Duration</span>
                            <span class="font-medium">{{ scenario.totalWeeks }} weeks</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Sprints</span>
                            <span class="font-medium">{{ scenario.sprintCount }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Team Size</span>
                            <span class="font-medium">{{ scenario.teamSizeAssumed }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Parallelization</span>
                            <span class="font-medium">{{ (scenario.parallelizationFactor * 100).toFixed(0) }}%</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Overhead</span>
                            <span class="font-medium">{{ (scenario.overheadPercentage * 100).toFixed(0) }}%</span>
                          </div>
                        </div>

                        <div class="mt-4 pt-4 border-t">
                          <p class="text-sm text-muted-foreground">{{ scenario.rationale }}</p>
                        </div>

                        <div class="mt-3">
                          <span
                            class="px-2 py-1 rounded text-xs"
                            [class.bg-green-100]="scenario.confidenceLevel === 'high'"
                            [class.text-green-700]="scenario.confidenceLevel === 'high'"
                            [class.bg-yellow-100]="scenario.confidenceLevel === 'medium'"
                            [class.text-yellow-700]="scenario.confidenceLevel === 'medium'"
                            [class.bg-red-100]="scenario.confidenceLevel === 'low'"
                            [class.text-red-700]="scenario.confidenceLevel === 'low'"
                          >
                            {{ scenario.confidenceLevel | titlecase }} confidence
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              @case ('risks') {
                <!-- Risks Tab -->
                <div class="space-y-6">
                  <h2 class="text-lg font-semibold">Risk Assessment</h2>

                  <div class="space-y-4">
                    @for (risk of sortedRisks(); track risk.id) {
                      <div class="rounded-lg border p-4">
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <span
                                class="px-2 py-1 rounded text-xs font-medium"
                                [class.bg-red-100]="risk.riskScore >= 0.5"
                                [class.text-red-700]="risk.riskScore >= 0.5"
                                [class.bg-yellow-100]="risk.riskScore >= 0.25 && risk.riskScore < 0.5"
                                [class.text-yellow-700]="risk.riskScore >= 0.25 && risk.riskScore < 0.5"
                                [class.bg-green-100]="risk.riskScore < 0.25"
                                [class.text-green-700]="risk.riskScore < 0.25"
                              >
                                Score: {{ (risk.riskScore * 100).toFixed(0) }}%
                              </span>
                              <span class="px-2 py-1 bg-muted rounded text-xs">
                                {{ formatRiskCategory(risk.riskCategory) }}
                              </span>
                            </div>
                            <p class="mt-2 font-medium">{{ risk.riskDescription }}</p>
                          </div>
                          <div class="text-right text-sm">
                            <p class="text-muted-foreground">
                              P: {{ (risk.probability * 100).toFixed(0) }}% × I: {{ (risk.impact * 100).toFixed(0) }}%
                            </p>
                          </div>
                        </div>
                        <div class="mt-3 pt-3 border-t">
                          <p class="text-sm text-muted-foreground">
                            <span class="font-medium">Mitigation:</span> {{ risk.mitigationStrategy }}
                          </p>
                        </div>
                      </div>
                    }

                    @if (risks().length === 0) {
                      <div class="text-center py-8 text-muted-foreground">
                        No risks identified
                      </div>
                    }
                  </div>
                </div>
              }

              @case ('skills') {
                <!-- Skills Tab -->
                <div class="space-y-6">
                  <div>
                    <h2 class="text-lg font-semibold">Skills Required</h2>
                    <p class="text-sm text-muted-foreground mt-1">
                      Skills likely needed based on the feature analysis. Compare against your team's capabilities.
                    </p>
                  </div>

                  <div class="rounded-lg border overflow-hidden">
                    <table class="w-full">
                      <thead class="bg-muted/50">
                        <tr>
                          <th class="text-left p-3 text-sm font-medium">Skill</th>
                          <th class="text-center p-3 text-sm font-medium">Proficiency Level</th>
                          <th class="text-center p-3 text-sm font-medium">Est. Person-Weeks</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y">
                        @for (skill of skills(); track skill.id) {
                          <tr class="hover:bg-muted/30">
                            <td class="p-3 font-medium">{{ skill.skillName }}</td>
                            <td class="p-3 text-center">
                              <span class="px-2 py-1 bg-muted rounded text-xs capitalize">
                                {{ skill.proficiencyLevel }}
                              </span>
                            </td>
                            <td class="p-3 text-center">{{ skill.estimatedPersonWeeks }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  @if (skills().length === 0) {
                    <div class="text-center py-8 text-muted-foreground">
                      No specific skill requirements identified
                    </div>
                  }
                </div>
              }
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class FeasibilityResultsComponent implements OnInit {
  service = inject(FeasibilityService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  tabs: Tab[] = [
    { id: 'summary', label: 'Executive Summary' },
    { id: 'components', label: 'Components' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'risks', label: 'Risks' },
    { id: 'skills', label: 'Skills' },
  ];

  activeTab = signal<TabId>('summary');
  editedComponents = signal<Map<number, UpdateComponentRequest>>(new Map());
  saving = signal(false);

  // Computed values from service
  session = computed(() => this.service.currentSession()?.session);
  components = computed(() => this.service.currentSession()?.components ?? []);
  scenarios = computed(() => this.service.currentSession()?.scenarios ?? []);
  risks = computed(() => this.service.currentSession()?.risks ?? []);
  skills = computed(() => this.service.currentSession()?.skills ?? []);

  // Sorted risks by score
  sortedRisks = computed(() =>
    [...this.risks()].sort((a, b) => b.riskScore - a.riskScore)
  );

  // Get realistic scenario for summary
  realisticScenario = computed(() =>
    this.scenarios().find(s => s.scenarioType === 'realistic')
  );

  // Total hours calculations
  totalOptimisticHours = computed(() =>
    this.components().reduce((sum, c) => sum + c.optimisticHours, 0)
  );

  totalRealisticHours = computed(() =>
    this.components().reduce((sum, c) => sum + c.realisticHours, 0)
  );

  totalPessimisticHours = computed(() =>
    this.components().reduce((sum, c) => sum + c.pessimisticHours, 0)
  );

  hasUnsavedChanges = computed(() => this.editedComponents().size > 0);

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (sessionId) {
      await this.service.getSessionDetail(sessionId);
    }
  }

  setActiveTab(tabId: TabId) {
    this.activeTab.set(tabId);
  }

  goBack() {
    this.router.navigate(['/feasibility']);
  }

  buildBusinessCase() {
    alert('Business Case builder coming soon! This will generate a comprehensive business case document based on the feasibility analysis.');
  }

  getEditedValue(componentId: number, field: keyof UpdateComponentRequest, defaultValue: number): number {
    const edited = this.editedComponents().get(componentId);
    if (edited && edited[field] !== undefined) {
      return edited[field] as number;
    }
    return defaultValue;
  }

  onHoursChange(componentId: number, field: keyof UpdateComponentRequest, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.editedComponents.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(componentId) || {};
      newMap.set(componentId, { ...existing, [field]: value });
      return newMap;
    });
  }

  async saveAllComponents() {
    this.saving.set(true);
    try {
      const entries = Array.from(this.editedComponents().entries());
      for (const [componentId, updates] of entries) {
        await this.service.updateComponent(componentId, updates);
      }
      this.editedComponents.set(new Map());
    } finally {
      this.saving.set(false);
    }
  }

  formatCategory(category: string): string {
    const labels: Record<string, string> = {
      backend: 'Backend',
      frontend: 'Frontend',
      infrastructure: 'Infrastructure',
      data: 'Data',
      integration: 'Integration',
    };
    return labels[category] || category;
  }

  formatRiskCategory(category: string): string {
    const labels: Record<string, string> = {
      technical: 'Technical',
      resource: 'Resource',
      schedule: 'Schedule',
      dependency: 'Dependency',
      integration: 'Integration',
    };
    return labels[category] || category;
  }

  exportToPdf() {
    const session = this.session();
    const components = this.components();
    const scenarios = this.scenarios();
    const risks = this.sortedRisks();
    const skills = this.skills();
    if (!session) return;

    const goNoGoClass = session.goNoGoRecommendation === 'go' ? 'go' : session.goNoGoRecommendation === 'no_go' ? 'no-go' : 'conditional';
    const goNoGoLabel = session.goNoGoRecommendation === 'go' ? 'GO' : session.goNoGoRecommendation === 'no_go' ? 'NO-GO' : 'CONDITIONAL';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Feasibility Analysis</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a2e; padding: 48px; max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #6366f1; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { font-size: 14px; color: #64748b; max-width: 600px; margin: 0 auto; }
    .badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 16px 0; }
    .badge.go { background: #dcfce7; color: #166534; }
    .badge.no-go { background: #fee2e2; color: #b91c1c; }
    .badge.conditional { background: #fef3c7; color: #b45309; }
    .confidence { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-left: 8px; }
    .confidence.high { background: #dcfce7; color: #166534; }
    .confidence.medium { background: #fef3c7; color: #b45309; }
    .confidence.low { background: #fee2e2; color: #b91c1c; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    .summary-box { background: #f0f9ff; padding: 20px; border-radius: 12px; border-left: 4px solid #0ea5e9; margin-bottom: 24px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .metric-value { font-size: 24px; font-weight: 700; color: #6366f1; }
    .metric-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { background: #f8fafc; font-weight: 600; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .tag-green { background: #dcfce7; color: #166534; }
    .tag-yellow { background: #fef3c7; color: #b45309; }
    .tag-red { background: #fee2e2; color: #b91c1c; }
    .tag-gray { background: #f1f5f9; color: #475569; }
    .scenario-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .scenario { padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .scenario.optimistic { background: #f0fdf4; border-color: #86efac; }
    .scenario.realistic { background: #eff6ff; border-color: #93c5fd; }
    .scenario.pessimistic { background: #fff7ed; border-color: #fdba74; }
    .scenario h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; text-transform: capitalize; }
    .scenario-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .risk-card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; }
    .risk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .risk-desc { font-size: 14px; margin-bottom: 8px; }
    .risk-mitigation { font-size: 12px; color: #64748b; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
    .tech-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 24px; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Feasibility Analysis</h1>
    <div class="subtitle">${session.featureDescription}</div>
    <div>
      <span class="badge ${goNoGoClass}">Recommendation: ${goNoGoLabel}</span>
      <span class="confidence ${session.confidenceLevel}">${session.confidenceLevel?.charAt(0).toUpperCase()}${session.confidenceLevel?.slice(1)} Confidence</span>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="summary-box">
      <p>${session.executiveSummary}</p>
    </div>
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${components.length}</div>
        <div class="metric-label">Components</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.totalRealisticHours()}</div>
        <div class="metric-label">Est. Hours</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.realisticScenario()?.totalWeeks || '-'}</div>
        <div class="metric-label">Est. Weeks</div>
      </div>
      <div class="metric">
        <div class="metric-value">${risks.length}</div>
        <div class="metric-label">Risks</div>
      </div>
    </div>
    ${session.autoDetectedStack?.length ? `
    <div>
      <strong style="font-size: 13px;">Technologies Mentioned:</strong>
      <div class="tech-tags">
        ${session.autoDetectedStack.map(tech => `<span class="tag tag-gray">${tech}</span>`).join('')}
      </div>
    </div>
    ` : ''}
  </div>

  <!-- Components -->
  <div class="section">
    <h2 class="section-title">Technical Components</h2>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Category</th>
          <th style="text-align:center">Optimistic</th>
          <th style="text-align:center">Realistic</th>
          <th style="text-align:center">Pessimistic</th>
          <th style="text-align:center">Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${components.map(c => `
        <tr>
          <td><strong>${c.componentName}</strong><br><span style="font-size:11px;color:#64748b;">${c.componentDescription}</span></td>
          <td><span class="tag tag-gray">${this.formatCategory(c.technicalCategory)}</span></td>
          <td style="text-align:center">${c.optimisticHours}h</td>
          <td style="text-align:center">${c.realisticHours}h</td>
          <td style="text-align:center">${c.pessimisticHours}h</td>
          <td style="text-align:center"><span class="tag tag-${c.confidenceLevel === 'high' ? 'green' : c.confidenceLevel === 'medium' ? 'yellow' : 'red'}">${c.confidenceLevel}</span></td>
        </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight:600;background:#f8fafc;">
          <td colspan="2">Total</td>
          <td style="text-align:center">${this.totalOptimisticHours()}h</td>
          <td style="text-align:center">${this.totalRealisticHours()}h</td>
          <td style="text-align:center">${this.totalPessimisticHours()}h</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Timeline Scenarios -->
  <div class="section">
    <h2 class="section-title">Timeline Scenarios</h2>
    <div class="scenario-grid">
      ${scenarios.map(s => `
      <div class="scenario ${s.scenarioType}">
        <h4>${s.scenarioType}</h4>
        <div class="scenario-row"><span>Duration</span><strong>${s.totalWeeks} weeks</strong></div>
        <div class="scenario-row"><span>Sprints</span><strong>${s.sprintCount}</strong></div>
        <div class="scenario-row"><span>Team Size</span><strong>${s.teamSizeAssumed}</strong></div>
        <div class="scenario-row"><span>Parallelization</span><strong>${(s.parallelizationFactor * 100).toFixed(0)}%</strong></div>
        <div class="scenario-row"><span>Overhead</span><strong>${(s.overheadPercentage * 100).toFixed(0)}%</strong></div>
        <p style="font-size:11px;color:#64748b;margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;">${s.rationale}</p>
      </div>
      `).join('')}
    </div>
  </div>

  <!-- Risks -->
  ${risks.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Risk Assessment</h2>
    ${risks.map(r => `
    <div class="risk-card">
      <div class="risk-header">
        <span class="tag tag-${r.riskScore >= 0.5 ? 'red' : r.riskScore >= 0.25 ? 'yellow' : 'green'}">Score: ${(r.riskScore * 100).toFixed(0)}%</span>
        <span class="tag tag-gray">${this.formatRiskCategory(r.riskCategory)}</span>
        <span style="margin-left:auto;font-size:11px;color:#64748b;">P: ${(r.probability * 100).toFixed(0)}% × I: ${(r.impact * 100).toFixed(0)}%</span>
      </div>
      <p class="risk-desc">${r.riskDescription}</p>
      <p class="risk-mitigation"><strong>Mitigation:</strong> ${r.mitigationStrategy}</p>
    </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Skills -->
  ${skills.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Skills Required</h2>
    <table>
      <thead>
        <tr>
          <th>Skill</th>
          <th style="text-align:center">Proficiency Level</th>
          <th style="text-align:center">Est. Person-Weeks</th>
        </tr>
      </thead>
      <tbody>
        ${skills.map(s => `
        <tr>
          <td>${s.skillName}</td>
          <td style="text-align:center"><span class="tag tag-gray" style="text-transform:capitalize;">${s.proficiencyLevel}</span></td>
          <td style="text-align:center">${s.estimatedPersonWeeks}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    Generated by Product Studio • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }
}
