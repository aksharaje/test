import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRadar, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideRotateCw, lucideClipboardList, lucidePenLine } from '@ng-icons/lucide';
import { ScopeMonitorService } from './scope-monitor.service';
import type { ScopeMonitorSession } from './scope-monitor.types';
import { HlmButtonDirective } from '../../ui/button';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-scope-monitor-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe],
  viewProviders: [provideIcons({ lucideRadar, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideRotateCw, lucideClipboardList, lucidePenLine })],
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
          <p class="text-muted-foreground mb-6">Evaluate proposed changes against your approved scope to detect scope creep.</p>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="space-y-6" (submit)="onSubmit($event)">
            <div>
              <label class="text-sm font-medium">Project Name <span class="text-destructive">*</span></label>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="projectName()" (input)="onProjectNameInput($event)" placeholder="e.g., Customer Portal V2" required />
            </div>

            <!-- Baseline Scope Source -->
            <div>
              <label class="text-sm font-medium">Approved Scope (Baseline) <span class="text-destructive">*</span></label>
              <p class="text-xs text-muted-foreground mt-1">The scope that was originally approved</p>

              <div class="flex rounded-lg border p-1 mt-2 mb-3">
                <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'scope-definition'" [class.text-primary-foreground]="sourceType() === 'scope-definition'" [class.hover:bg-muted]="sourceType() !== 'scope-definition'" (click)="setSourceType('scope-definition')">
                  <ng-icon name="lucideClipboardList" class="h-4 w-4" /> From Scope Definition
                </button>
                <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors" [class.bg-primary]="sourceType() === 'custom'" [class.text-primary-foreground]="sourceType() === 'custom'" [class.hover:bg-muted]="sourceType() !== 'custom'" (click)="setSourceType('custom')">
                  <ng-icon name="lucidePenLine" class="h-4 w-4" /> Write Custom
                </button>
              </div>

              @if (sourceType() === 'scope-definition') {
                <select class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="selectedScopeDefinitionId()" (change)="onScopeDefinitionChange($event)">
                  <option value="">-- Select a Scope Definition --</option>
                  @for (scopeDef of service.scopeDefinitionSessions(); track scopeDef.id) {
                    <option [value]="scopeDef.id">{{ scopeDef.projectName }} - {{ scopeDef.productVision | slice:0:50 }}{{ scopeDef.productVision.length > 50 ? '...' : '' }}</option>
                  }
                </select>

                @if (selectedScopeDefinitionId() && service.scopeDefinitionItems().length > 0) {
                  <div class="rounded-lg border bg-muted/30 p-4 mt-3">
                    <h4 class="text-sm font-medium mb-2">Imported Scope Items</h4>
                    <ul class="text-sm space-y-1 text-muted-foreground">
                      @for (item of service.scopeDefinitionItems(); track item.id) {
                        <li>• {{ item.title }}</li>
                      }
                    </ul>
                  </div>
                }
              } @else {
                <textarea class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]" [value]="baselineDescription()" (input)="onBaselineDescriptionInput($event)" placeholder="Describe the approved scope: features, requirements, and constraints that were agreed upon..."></textarea>
                <p class="text-xs mt-1" [class.text-destructive]="baselineLength() > 0 && baselineLength() < 50">{{ baselineLength() }} / 50 min</p>
              }
            </div>

            <div>
              <label class="text-sm font-medium">Proposed Change <span class="text-destructive">*</span></label>
              <p class="text-xs text-muted-foreground mt-1">Describe the change request you want to evaluate (min 50 chars)</p>
              <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]" [value]="proposedChange()" (input)="onProposedChangeInput($event)" placeholder="e.g., Stakeholder requested adding 3 additional reporting widgets, a new export feature, and real-time notifications..." required></textarea>
              <p class="text-xs mt-1" [class.text-destructive]="proposedChangeLength() > 0 && proposedChangeLength() < 50">{{ proposedChangeLength() }} / 50 min</p>
            </div>

            <div>
              <label class="text-sm font-medium">Change Threshold</label>
              <p class="text-xs text-muted-foreground mt-1">How strict should the scope creep detection be?</p>
              <div class="flex gap-2 mt-2">
                <button type="button" class="flex-1 rounded-lg border p-3 text-sm font-medium transition-colors" [class.bg-primary]="threshold() === 'low'" [class.text-primary-foreground]="threshold() === 'low'" [class.border-primary]="threshold() === 'low'" (click)="setThreshold('low')">
                  <div class="font-medium">Low</div>
                  <div class="text-xs opacity-70">Only flag major changes</div>
                </button>
                <button type="button" class="flex-1 rounded-lg border p-3 text-sm font-medium transition-colors" [class.bg-primary]="threshold() === 'medium'" [class.text-primary-foreground]="threshold() === 'medium'" [class.border-primary]="threshold() === 'medium'" (click)="setThreshold('medium')">
                  <div class="font-medium">Medium</div>
                  <div class="text-xs opacity-70">Balanced detection</div>
                </button>
                <button type="button" class="flex-1 rounded-lg border p-3 text-sm font-medium transition-colors" [class.bg-primary]="threshold() === 'high'" [class.text-primary-foreground]="threshold() === 'high'" [class.border-primary]="threshold() === 'high'" (click)="setThreshold('high')">
                  <div class="font-medium">High</div>
                  <div class="text-xs opacity-70">Flag any deviation</div>
                </button>
              </div>
            </div>

            <button hlmBtn class="w-full" type="submit" [disabled]="!canSubmit() || service.isLoading()">
              @if (service.isLoading()) { <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" /> Analyzing... }
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
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="session.status === 'completed'" [class.text-green-700]="session.status === 'completed'" [class.bg-yellow-100]="session.status === 'analyzing'" [class.text-yellow-700]="session.status === 'analyzing'" [class.bg-red-100]="session.status === 'failed'" [class.text-red-700]="session.status === 'failed'">{{ session.status }}</span>
                        @if (session.scopeHealthScore !== undefined && session.scopeHealthScore !== null) {
                          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="session.scopeHealthScore >= 80" [class.text-green-700]="session.scopeHealthScore >= 80" [class.bg-yellow-100]="session.scopeHealthScore >= 50 && session.scopeHealthScore < 80" [class.text-yellow-700]="session.scopeHealthScore >= 50 && session.scopeHealthScore < 80" [class.bg-red-100]="session.scopeHealthScore < 50" [class.text-red-700]="session.scopeHealthScore < 50">{{ session.scopeHealthScore }}% health</span>
                        }
                      </div>
                      <p class="mt-1 text-sm font-medium">{{ session.projectName }}</p>
                      <p class="text-xs text-muted-foreground line-clamp-1">{{ session.currentRequirements }}</p>
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
  baselineDescription = signal('');
  proposedChange = signal('');
  threshold = signal<'low' | 'medium' | 'high'>('medium');

  baselineLength = computed(() => this.baselineDescription().length);
  proposedChangeLength = computed(() => this.proposedChange().length);
  canSubmit = computed(() => {
    if (this.projectName().length === 0 || this.proposedChangeLength() < 50) return false;
    if (this.sourceType() === 'scope-definition') {
      return !!this.selectedScopeDefinitionId() && this.service.scopeDefinitionItems().length > 0;
    }
    return this.baselineLength() >= 50;
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

  setThreshold(t: 'low' | 'medium' | 'high') {
    this.threshold.set(t);
  }

  async onScopeDefinitionChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.selectedScopeDefinitionId.set(value);
    if (value) {
      await this.service.loadScopeDefinitionFull(Number(value));
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
  onBaselineDescriptionInput(e: Event) { this.baselineDescription.set((e.target as HTMLTextAreaElement).value); }
  onProposedChangeInput(e: Event) { this.proposedChange.set((e.target as HTMLTextAreaElement).value); }

  async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.canSubmit()) return;

    // Build change context with threshold info
    const changeContext = `Change Threshold: ${this.threshold()} - ${
      this.threshold() === 'low' ? 'Only flag major scope changes' :
      this.threshold() === 'medium' ? 'Balanced scope creep detection' :
      'Flag any deviation from approved scope'
    }`;

    const session = await this.service.createSession({
      projectName: this.projectName(),
      baselineScopeId: this.sourceType() === 'scope-definition' ? Number(this.selectedScopeDefinitionId()) : undefined,
      baselineDescription: this.sourceType() === 'custom' ? this.baselineDescription() : undefined,
      currentRequirements: this.proposedChange(),
      changeContext: changeContext,
    });
    if (session) this.router.navigate(['/scoping/monitor/results', session.id]);
  }

  viewSession(session: ScopeMonitorSession) { this.router.navigate(['/scoping/monitor/results', session.id]); }
  async deleteSession(e: Event, session: ScopeMonitorSession) { e.stopPropagation(); if (confirm('Delete?')) await this.service.deleteSession(session.id); }
  async retrySession(e: Event, session: ScopeMonitorSession) { e.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/scoping/monitor/results', session.id]); }
}
