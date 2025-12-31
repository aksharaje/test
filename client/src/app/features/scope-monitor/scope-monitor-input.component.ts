import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRadar, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw, lucideClipboardList, lucidePenLine } from '@ng-icons/lucide';
import { ScopeMonitorService } from './scope-monitor.service';
import type { ScopeMonitorSession } from './scope-monitor.types';
import { HlmButtonDirective } from '../../ui/button';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-scope-monitor-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe],
  viewProviders: [provideIcons({ lucideRadar, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw, lucideClipboardList, lucidePenLine })],
  template: `
    <div class="flex h-full">
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideRadar" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold">Scope Monitor</h1>
          </div>
          <p class="text-muted-foreground mb-6">Track scope changes, assess impacts, and manage scope creep.</p>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <!-- Source Type Tabs -->
          <div class="flex rounded-lg border p-1 mb-6">
            <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'scope-definition'" [class.text-primary-foreground]="sourceType() === 'scope-definition'" [class.hover:bg-muted]="sourceType() !== 'scope-definition'" (click)="setSourceType('scope-definition')">
              <ng-icon name="lucideClipboardList" class="h-4 w-4" /> From Scope Definition
            </button>
            <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'custom'" [class.text-primary-foreground]="sourceType() === 'custom'" [class.hover:bg-muted]="sourceType() !== 'custom'" (click)="setSourceType('custom')">
              <ng-icon name="lucidePenLine" class="h-4 w-4" /> Write Custom
            </button>
          </div>

          <form class="space-y-6" (submit)="onSubmit($event)">
            <div>
              <label class="text-sm font-medium">Project Name <span class="text-destructive">*</span></label>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="projectName()" (input)="onProjectNameInput($event)" placeholder="e.g., Customer Portal V2" required />
            </div>

            @if (sourceType() === 'scope-definition') {
              <!-- Scope Definition Picker -->
              <div>
                <label class="text-sm font-medium">Select Scope Definition <span class="text-destructive">*</span></label>
                <p class="text-xs text-muted-foreground mt-1">Import baseline scope from a completed scope definition</p>
                <select class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="selectedScopeDefinitionId()" (change)="onScopeDefinitionChange($event)">
                  <option value="">-- Select a Scope Definition --</option>
                  @for (scopeDef of service.scopeDefinitionSessions(); track scopeDef.id) {
                    <option [value]="scopeDef.id">{{ scopeDef.projectName }} - {{ scopeDef.productVision | slice:0:50 }}{{ scopeDef.productVision.length > 50 ? '...' : '' }}</option>
                  }
                </select>
              </div>

              @if (selectedScopeDefinitionId() && service.scopeDefinitionItems().length > 0) {
                <div class="rounded-lg border bg-muted/30 p-4">
                  <h4 class="text-sm font-medium mb-2">Imported Scope Items</h4>
                  <ul class="text-sm space-y-1 text-muted-foreground">
                    @for (item of service.scopeDefinitionItems(); track item.id) {
                      <li>• {{ item.title }}</li>
                    }
                  </ul>
                </div>
              }
            } @else {
              <!-- Custom Scope Input -->
              <div>
                <label class="text-sm font-medium">Original Scope <span class="text-destructive">*</span></label>
                <p class="text-xs text-muted-foreground mt-1">The baseline scope to monitor against (min 50 chars)</p>
                <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]" [value]="originalScope()" (input)="onOriginalScopeInput($event)" placeholder="e.g., Phase 1 includes user authentication, dashboard, and basic reporting. Phase 2 will add advanced analytics..." required></textarea>
                <p class="text-xs mt-1" [class.text-destructive]="scopeLength() > 0 && scopeLength() < 50">{{ scopeLength() }} / 50 min</p>
              </div>
            }

            <div>
              <label class="text-sm font-medium">Current Status <span class="text-destructive">*</span></label>
              <p class="text-xs text-muted-foreground mt-1">What's the current project situation? Any changes or concerns?</p>
              <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]" [value]="currentStatus()" (input)="onCurrentStatusInput($event)" placeholder="e.g., Sprint 3 completed. Stakeholder requested additional reporting features. Timeline pressure increasing..." required></textarea>
            </div>

            <div class="border rounded-lg">
              <button type="button" class="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50" (click)="toggleOptionalFields()">
                <span>Optional Configuration</span>
                <ng-icon [name]="optionalFieldsOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
              </button>
              @if (optionalFieldsOpen()) {
                <div class="p-3 pt-0 space-y-4">
                  <div>
                    <label class="text-sm font-medium">Monitoring Period</label>
                    <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm" [value]="monitoringPeriod()" (input)="onMonitoringPeriodInput($event)" placeholder="e.g., Last 2 weeks, Current sprint" />
                  </div>
                  <div>
                    <label class="text-sm font-medium">Change Threshold</label>
                    <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm" [value]="changeThreshold()" (input)="onChangeThresholdInput($event)" placeholder="e.g., Medium (5-10% scope increase)" />
                  </div>
                </div>
              }
            </div>

            <button hlmBtn class="w-full" type="submit" [disabled]="!canSubmit() || service.isLoading()">
              @if (service.isLoading()) { <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" /> Analyzing Scope... }
              @else { <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" /> Analyze Scope Health }
            </button>
          </form>
        </div>
      </div>

      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2"><ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" /><h2 class="font-semibold">Monitoring History</h2></div>
        </div>
        <div class="flex-1 overflow-y-auto">
          @if (service.sessions().length === 0) {
            <div class="flex items-center justify-center p-6 h-full"><div class="text-center"><ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" /><h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3></div></div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div class="group rounded-lg border bg-background p-4 hover:border-primary/50 cursor-pointer" (click)="viewSession(session)">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="session.status === 'completed'" [class.text-green-700]="session.status === 'completed'" [class.bg-yellow-100]="session.status === 'generating'" [class.text-yellow-700]="session.status === 'generating'" [class.bg-red-100]="session.status === 'failed'" [class.text-red-700]="session.status === 'failed'">{{ session.status }}</span>
                        @if (session.scopeHealthScore !== undefined && session.scopeHealthScore !== null) {
                          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="session.scopeHealthScore >= 80" [class.text-green-700]="session.scopeHealthScore >= 80" [class.bg-yellow-100]="session.scopeHealthScore >= 50 && session.scopeHealthScore < 80" [class.text-yellow-700]="session.scopeHealthScore >= 50 && session.scopeHealthScore < 80" [class.bg-red-100]="session.scopeHealthScore < 50" [class.text-red-700]="session.scopeHealthScore < 50">{{ session.scopeHealthScore }}% health</span>
                        }
                      </div>
                      <p class="mt-1 text-sm font-medium">{{ session.projectName }}</p>
                      <p class="text-xs text-muted-foreground line-clamp-1">{{ session.currentStatus }}</p>
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
export class ScopeMonitorInputComponent implements OnInit {
  service = inject(ScopeMonitorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  sourceType = signal<'scope-definition' | 'custom'>('custom');
  selectedScopeDefinitionId = signal<string>('');
  projectName = signal('');
  originalScope = signal('');
  currentStatus = signal('');
  monitoringPeriod = signal('');
  changeThreshold = signal('');
  optionalFieldsOpen = signal(false);

  scopeLength = computed(() => this.originalScope().length);
  canSubmit = computed(() => {
    if (this.projectName().length === 0 || this.currentStatus().length === 0) return false;
    if (this.sourceType() === 'scope-definition') {
      return !!this.selectedScopeDefinitionId() && this.service.scopeDefinitionItems().length > 0;
    }
    return this.scopeLength() >= 50;
  });

  async ngOnInit() {
    await Promise.all([
      this.service.loadSessions(),
      this.service.loadScopeDefinitionSessions(),
    ]);

    // Check for scopeDefinitionId query param (from Scope Definition CTA)
    const scopeDefinitionId = this.route.snapshot.queryParams['scopeDefinitionId'];
    if (scopeDefinitionId) {
      this.sourceType.set('scope-definition');
      this.selectedScopeDefinitionId.set(scopeDefinitionId);
      await this.service.loadScopeDefinitionFull(Number(scopeDefinitionId));
      // Auto-fill project name from scope definition
      const scopeDef = this.service.selectedScopeDefinition();
      if (scopeDef) {
        this.projectName.set(scopeDef.projectName);
      }
    }
  }

  setSourceType(type: 'scope-definition' | 'custom') {
    this.sourceType.set(type);
    if (type === 'custom') {
      this.selectedScopeDefinitionId.set('');
      this.service.selectedScopeDefinition.set(null);
      this.service.scopeDefinitionItems.set([]);
    }
  }

  async onScopeDefinitionChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.selectedScopeDefinitionId.set(value);
    if (value) {
      await this.service.loadScopeDefinitionFull(Number(value));
      // Auto-fill project name from scope definition
      const scopeDef = this.service.selectedScopeDefinition();
      if (scopeDef && !this.projectName()) {
        this.projectName.set(scopeDef.projectName);
      }
    } else {
      this.service.selectedScopeDefinition.set(null);
      this.service.scopeDefinitionItems.set([]);
    }
  }

  onProjectNameInput(e: Event) { this.projectName.set((e.target as HTMLInputElement).value); }
  onOriginalScopeInput(e: Event) { this.originalScope.set((e.target as HTMLTextAreaElement).value); }
  onCurrentStatusInput(e: Event) { this.currentStatus.set((e.target as HTMLTextAreaElement).value); }
  onMonitoringPeriodInput(e: Event) { this.monitoringPeriod.set((e.target as HTMLInputElement).value); }
  onChangeThresholdInput(e: Event) { this.changeThreshold.set((e.target as HTMLInputElement).value); }
  toggleOptionalFields() { this.optionalFieldsOpen.update((v) => !v); }

  async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.canSubmit()) return;

    // Build original scope from scope definition if using that source
    let scope = this.originalScope();
    if (this.sourceType() === 'scope-definition') {
      scope = this.service.buildScopeFromDefinition();
    }

    const session = await this.service.createSession({
      projectName: this.projectName(),
      originalScope: scope,
      currentStatus: this.currentStatus(),
      monitoringPeriod: this.monitoringPeriod() || undefined,
      changeThreshold: this.changeThreshold() || undefined,
    });
    if (session) this.router.navigate(['/scoping/monitor/results', session.id]);
  }

  viewSession(session: ScopeMonitorSession) { this.router.navigate(['/scoping/monitor/results', session.id]); }
  async deleteSession(e: Event, session: ScopeMonitorSession) { e.stopPropagation(); if (confirm('Delete?')) await this.service.deleteSession(session.id); }
  async retrySession(e: Event, session: ScopeMonitorSession) { e.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/scoping/monitor/results', session.id]); }
}
