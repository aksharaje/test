import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBarChart3, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw, lucideTarget, lucidePenLine, lucideFileText, lucideDatabase, lucideSearch, lucideCheck } from '@ng-icons/lucide';
import { MeasurementFrameworkService } from './measurement-framework.service';
import type { MeasurementFrameworkSession } from './measurement-framework.types';
import { HlmButtonDirective } from '../../ui/button';
import { SlicePipe } from '@angular/common';

type SourceType = 'goal-session' | 'okr-session' | 'custom';

@Component({
  selector: 'app-measurement-framework-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe],
  viewProviders: [provideIcons({ lucideBarChart3, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw, lucideTarget, lucidePenLine, lucideFileText, lucideDatabase, lucideSearch, lucideCheck })],
  template: `
    <div class="flex h-full">
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideBarChart3" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold">Measurement Framework Builder</h1>
          </div>
          <p class="text-muted-foreground mb-6">Build comprehensive measurement frameworks with metrics, data sources, and dashboards.</p>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <!-- Source Type Tabs -->
          <div class="flex rounded-lg border p-1 mb-6">
            <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'goal-session'" [class.text-primary-foreground]="sourceType() === 'goal-session'" [class.hover:bg-muted]="sourceType() !== 'goal-session'" (click)="setSourceType('goal-session')">
              <ng-icon name="lucideFileText" class="h-4 w-4" /> From Goals
            </button>
            <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'okr-session'" [class.text-primary-foreground]="sourceType() === 'okr-session'" [class.hover:bg-muted]="sourceType() !== 'okr-session'" (click)="setSourceType('okr-session')">
              <ng-icon name="lucideTarget" class="h-4 w-4" /> From OKRs
            </button>
            <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'custom'" [class.text-primary-foreground]="sourceType() === 'custom'" [class.hover:bg-muted]="sourceType() !== 'custom'" (click)="setSourceType('custom')">
              <ng-icon name="lucidePenLine" class="h-4 w-4" /> Custom
            </button>
          </div>

          <form class="space-y-6" (submit)="onSubmit($event)">
            <div>
              <label class="text-sm font-medium">Framework Name <span class="text-destructive">*</span></label>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="name()" (input)="onNameInput($event)" placeholder="e.g., Q1 Product Metrics Framework" required />
            </div>

            @if (sourceType() === 'goal-session') {
              <!-- Goal Session Picker -->
              <div>
                <label class="text-sm font-medium">Select Goal Setting Session <span class="text-destructive">*</span></label>
                <p class="text-xs text-muted-foreground mt-1">Import goals and KPIs from a completed Goal Setting session</p>
                <select class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="selectedGoalSessionId()" (change)="onGoalSessionChange($event)">
                  <option value="">-- Select a Goal Session --</option>
                  @for (goalSession of service.goalSettingSessions(); track goalSession.id) {
                    <option [value]="goalSession.id">{{ goalSession.domain }} - {{ goalSession.strategy | slice:0:50 }}{{ goalSession.strategy.length > 50 ? '...' : '' }}</option>
                  }
                </select>
              </div>

              @if (selectedGoalSessionId() && service.selectedGoals().length > 0) {
                <div class="rounded-lg border bg-muted/30 p-4">
                  <h4 class="text-sm font-medium mb-2">Imported Goals & KPIs</h4>
                  <ul class="text-sm space-y-2">
                    @for (goal of service.selectedGoals(); track goal.id) {
                      <li>
                        <span class="font-medium">{{ goal.title }}</span>
                        <span class="text-xs text-muted-foreground ml-2">({{ goal.category }})</span>
                        @if (getKpiForGoal(goal.id); as kpi) {
                          <div class="ml-4 mt-1 text-muted-foreground text-xs">
                            <div>• Primary: {{ kpi.primaryKpi }} ({{ kpi.measurementUnit }})</div>
                            @if (kpi.secondaryKpi) {
                              <div>• Secondary: {{ kpi.secondaryKpi }}</div>
                            }
                          </div>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }
            } @else if (sourceType() === 'okr-session') {
              <!-- OKR Session Picker -->
              <div>
                <label class="text-sm font-medium">Select OKR Session <span class="text-destructive">*</span></label>
                <p class="text-xs text-muted-foreground mt-1">Import objectives and key results from a completed OKR session</p>
                <select class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="selectedOkrSessionId()" (change)="onOkrSessionChange($event)">
                  <option value="">-- Select an OKR Session --</option>
                  @for (okrSession of service.okrSessions(); track okrSession.id) {
                    <option [value]="okrSession.id">{{ okrSession.timeframe }} - {{ okrSession.goalDescription | slice:0:60 }}{{ okrSession.goalDescription.length > 60 ? '...' : '' }}</option>
                  }
                </select>
              </div>

              @if (selectedOkrSessionId() && service.okrObjectives().length > 0) {
                <div class="rounded-lg border bg-muted/30 p-4">
                  <h4 class="text-sm font-medium mb-2">Imported Objectives & Key Results</h4>
                  <ul class="text-sm space-y-2">
                    @for (obj of service.okrObjectives(); track obj.id) {
                      <li>
                        <span class="font-medium">{{ obj.title }}</span>
                        @if (obj.keyResults && obj.keyResults.length > 0) {
                          <ul class="ml-4 mt-1 text-muted-foreground">
                            @for (kr of obj.keyResults; track kr.id) {
                              <li>• {{ kr.title }}</li>
                            }
                          </ul>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }
            } @else {
              <!-- Custom Description -->
              <div>
                <label class="text-sm font-medium">What to Measure <span class="text-destructive">*</span></label>
                <p class="text-xs text-muted-foreground mt-1">Describe the objectives and outcomes you want to measure (min 50 chars)</p>
                <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]" [value]="objectivesDescription()" (input)="onObjectivesInput($event)" placeholder="e.g., Track user engagement, conversion rates, and customer satisfaction..." required></textarea>
                <p class="text-xs mt-1" [class.text-destructive]="objectivesLength() > 0 && objectivesLength() < 50">{{ objectivesLength() }} / 50 min</p>
              </div>
            }

            <!-- Knowledge Base Selection -->
            <div>
              <label class="text-sm font-medium">
                <ng-icon name="lucideDatabase" class="inline h-4 w-4 mr-1" />
                Knowledge Bases <span class="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Include context about existing analytics infrastructure
              </p>

              <div class="relative mt-2">
                <button
                  type="button"
                  class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                  (click)="toggleKbDropdown()"
                >
                  <span class="truncate text-left">
                    @if (selectedKbIds().length === 0) {
                      <span class="text-muted-foreground">Select knowledge bases...</span>
                    } @else if (selectedKbIds().length === 1) {
                      {{ selectedKnowledgeBases()[0]?.name }}
                    } @else {
                      {{ selectedKbIds().length }} knowledge bases selected
                    }
                  </span>
                  <ng-icon
                    name="lucideChevronDown"
                    class="h-4 w-4 text-muted-foreground transition-transform"
                    [class.rotate-180]="kbDropdownOpen()"
                  />
                </button>

                @if (kbDropdownOpen()) {
                  <div class="fixed inset-0 z-40" (click)="closeKbDropdown()"></div>
                  <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg">
                    <div class="p-2 border-b">
                      <div class="relative">
                        <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Filter knowledge bases..."
                          class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          [value]="kbSearchFilter()"
                          (input)="onKbSearchInput($event)"
                          (click)="$event.stopPropagation()"
                        />
                      </div>
                    </div>
                    <div class="max-h-48 overflow-y-auto p-1">
                      @for (kb of filteredKnowledgeBases(); track kb.id) {
                        <button
                          type="button"
                          class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                          [class.bg-primary/10]="selectedKbIds().includes(kb.id)"
                          (click)="toggleKnowledgeBase(kb.id); $event.stopPropagation()"
                        >
                          <div
                            class="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                            [class.bg-primary]="selectedKbIds().includes(kb.id)"
                            [class.border-primary]="selectedKbIds().includes(kb.id)"
                          >
                            @if (selectedKbIds().includes(kb.id)) {
                              <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                            }
                          </div>
                          <span class="truncate">{{ kb.name }}</span>
                        </button>
                      }
                      @if (filteredKnowledgeBases().length === 0) {
                        <div class="p-3 text-center text-sm text-muted-foreground">
                          No knowledge bases found
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="border rounded-lg">
              <button type="button" class="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50" (click)="toggleOptionalFields()">
                <span>Optional Details</span>
                <ng-icon [name]="optionalFieldsOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
              </button>
              @if (optionalFieldsOpen()) {
                <div class="p-3 pt-0 space-y-4">
                  <div>
                    <label class="text-sm font-medium">Existing Data Sources</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="existingDataSources()" (input)="onDataSourcesInput($event)" placeholder="e.g., Google Analytics, Mixpanel, internal DB..."></textarea>
                  </div>
                  <div>
                    <label class="text-sm font-medium">Reporting Requirements</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="reportingRequirements()" (input)="onReportingInput($event)" placeholder="e.g., Weekly exec reports, monthly board updates..."></textarea>
                  </div>
                  <div>
                    <label class="text-sm font-medium">Stakeholder Audience</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="stakeholderAudience()" (input)="onAudienceInput($event)" placeholder="e.g., Executives, Product team, Engineering..."></textarea>
                  </div>
                </div>
              }
            </div>

            <button hlmBtn class="w-full" type="submit" [disabled]="!canSubmit() || service.isLoading()">
              @if (service.isLoading()) { <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" /> Building... }
              @else { <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" /> Build Framework }
            </button>
          </form>
        </div>
      </div>

      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2"><ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" /><h2 class="font-semibold">Session History</h2></div>
        </div>
        <div class="flex-1 overflow-y-auto">
          @if (service.sessions().length === 0) {
            <div class="flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div class="group rounded-lg border bg-background p-4 hover:border-primary/50 cursor-pointer" (click)="viewSession(session)">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="session.status === 'completed'" [class.text-green-700]="session.status === 'completed'" [class.bg-yellow-100]="session.status === 'generating'" [class.text-yellow-700]="session.status === 'generating'" [class.bg-red-100]="session.status === 'failed'" [class.text-red-700]="session.status === 'failed'">{{ session.status }}</span>
                      </div>
                      <p class="mt-1 text-sm font-medium">{{ session.name }}</p>
                      <p class="text-xs text-muted-foreground line-clamp-1">{{ session.objectivesDescription }}</p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') { <button type="button" class="p-1 hover:text-primary" (click)="retrySession($event, session)"><ng-icon name="lucideRotateCw" class="h-4 w-4" /></button> }
                      <button type="button" class="p-1 hover:text-destructive opacity-0 group-hover:opacity-100" (click)="deleteSession($event, session)"><ng-icon name="lucideTrash2" class="h-4 w-4" /></button>
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
  styles: `:host { display: block; height: 100%; } .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }`,
})
export class MeasurementFrameworkInputComponent implements OnInit {
  service = inject(MeasurementFrameworkService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  sourceType = signal<SourceType>('goal-session');
  selectedGoalSessionId = signal<string>('');
  selectedOkrSessionId = signal<string>('');
  name = signal('');
  objectivesDescription = signal('');
  existingDataSources = signal('');
  reportingRequirements = signal('');
  stakeholderAudience = signal('');
  optionalFieldsOpen = signal(false);

  // Knowledge base selection
  selectedKbIds = signal<number[]>([]);
  kbDropdownOpen = signal(false);
  kbSearchFilter = signal('');

  objectivesLength = computed(() => this.objectivesDescription().length);
  canSubmit = computed(() => {
    if (this.name().length === 0) return false;
    if (this.sourceType() === 'goal-session') {
      return !!this.selectedGoalSessionId() && this.service.selectedGoals().length > 0;
    }
    if (this.sourceType() === 'okr-session') {
      return !!this.selectedOkrSessionId() && this.service.okrObjectives().length > 0;
    }
    return this.objectivesLength() >= 50;
  });

  selectedKnowledgeBases = computed(() => {
    const ids = this.selectedKbIds();
    return this.service.knowledgeBases().filter((kb) => ids.includes(kb.id));
  });

  filteredKnowledgeBases = computed(() => {
    const filter = this.kbSearchFilter().toLowerCase();
    if (!filter) return this.service.knowledgeBases();
    return this.service.knowledgeBases().filter((kb) =>
      kb.name.toLowerCase().includes(filter)
    );
  });

  getKpiForGoal(goalId: number) {
    return this.service.selectedKpiAssignments().find((k) => k.goalId === goalId);
  }

  async ngOnInit() {
    await Promise.all([
      this.service.loadSessions(),
      this.service.loadOkrSessions(),
      this.service.loadGoalSettingSessions(),
      this.service.loadKnowledgeBases(),
    ]);

    // Check for goalSessionId query param (from KPI Assignment CTA)
    const goalSessionId = this.route.snapshot.queryParams['goalSessionId'];
    if (goalSessionId) {
      this.sourceType.set('goal-session');
      this.selectedGoalSessionId.set(goalSessionId);
      await this.service.loadGoalSessionFull(Number(goalSessionId));
      await this.service.loadKpiSessionByGoal(Number(goalSessionId));
      // Auto-generate framework name from Goal session
      const session = this.service.selectedGoalSession();
      if (session) {
        this.name.set(`${session.domain} Measurement Framework`);
      }
      return;
    }

    // Check for okrSessionId query param (from OKR Generator CTA)
    const okrSessionId = this.route.snapshot.queryParams['okrSessionId'];
    if (okrSessionId) {
      this.sourceType.set('okr-session');
      this.selectedOkrSessionId.set(okrSessionId);
      await this.service.loadOkrSessionFull(Number(okrSessionId));
      // Auto-generate framework name from OKR session
      const session = this.service.selectedOkrSession();
      if (session) {
        this.name.set(`${session.timeframe} Measurement Framework`);
      }
    }
  }

  setSourceType(type: SourceType) {
    this.sourceType.set(type);
    if (type === 'goal-session') {
      this.selectedOkrSessionId.set('');
      this.service.selectedOkrSession.set(null);
      this.service.okrObjectives.set([]);
    } else if (type === 'okr-session') {
      this.selectedGoalSessionId.set('');
      this.service.clearGoalSelection();
    } else {
      this.selectedGoalSessionId.set('');
      this.selectedOkrSessionId.set('');
      this.service.clearGoalSelection();
      this.service.selectedOkrSession.set(null);
      this.service.okrObjectives.set([]);
    }
  }

  async onGoalSessionChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.selectedGoalSessionId.set(value);
    if (value) {
      await this.service.loadGoalSessionFull(Number(value));
      await this.service.loadKpiSessionByGoal(Number(value));
      // Auto-generate framework name from Goal session
      const session = this.service.selectedGoalSession();
      if (session && !this.name()) {
        this.name.set(`${session.domain} Measurement Framework`);
      }
    } else {
      this.service.clearGoalSelection();
    }
  }

  async onOkrSessionChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.selectedOkrSessionId.set(value);
    if (value) {
      await this.service.loadOkrSessionFull(Number(value));
      // Auto-generate framework name from OKR session
      const session = this.service.selectedOkrSession();
      if (session && !this.name()) {
        this.name.set(`${session.timeframe} Measurement Framework`);
      }
    } else {
      this.service.selectedOkrSession.set(null);
      this.service.okrObjectives.set([]);
    }
  }

  onNameInput(e: Event) { this.name.set((e.target as HTMLInputElement).value); }
  onObjectivesInput(e: Event) { this.objectivesDescription.set((e.target as HTMLTextAreaElement).value); }
  onDataSourcesInput(e: Event) { this.existingDataSources.set((e.target as HTMLTextAreaElement).value); }
  onReportingInput(e: Event) { this.reportingRequirements.set((e.target as HTMLTextAreaElement).value); }
  onAudienceInput(e: Event) { this.stakeholderAudience.set((e.target as HTMLTextAreaElement).value); }
  toggleOptionalFields() { this.optionalFieldsOpen.update((v) => !v); }

  // Knowledge base methods
  toggleKbDropdown() { this.kbDropdownOpen.update((v) => !v); }
  closeKbDropdown() { this.kbDropdownOpen.set(false); }
  onKbSearchInput(e: Event) { this.kbSearchFilter.set((e.target as HTMLInputElement).value); }
  toggleKnowledgeBase(id: number) {
    this.selectedKbIds.update((ids) => {
      if (ids.includes(id)) {
        return ids.filter((kbId) => kbId !== id);
      } else {
        return [...ids, id];
      }
    });
  }

  async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.canSubmit()) return;

    // Build objectives description from source
    let description = this.objectivesDescription();
    if (this.sourceType() === 'goal-session') {
      description = this.service.buildDescriptionFromGoals();
    } else if (this.sourceType() === 'okr-session') {
      description = this.service.buildDescriptionFromOkr();
    }

    const session = await this.service.createSession({
      name: this.name(),
      objectivesDescription: description,
      existingDataSources: this.existingDataSources() || undefined,
      reportingRequirements: this.reportingRequirements() || undefined,
      stakeholderAudience: this.stakeholderAudience() || undefined,
      knowledgeBaseIds: this.selectedKbIds().length > 0 ? this.selectedKbIds() : undefined,
    });
    if (session) this.router.navigate(['/measurements/framework/results', session.id]);
  }

  viewSession(session: MeasurementFrameworkSession) { this.router.navigate(['/measurements/framework/results', session.id]); }
  async deleteSession(e: Event, session: MeasurementFrameworkSession) { e.stopPropagation(); if (confirm('Delete?')) await this.service.deleteSession(session.id); }
  async retrySession(e: Event, session: MeasurementFrameworkSession) { e.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/measurements/framework/results', session.id]); }
}
