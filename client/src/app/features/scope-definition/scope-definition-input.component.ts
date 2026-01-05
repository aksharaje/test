import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClipboardList, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw, lucideLightbulb, lucideTarget, lucidePenLine, lucideDatabase, lucideCheck, lucideSearch } from '@ng-icons/lucide';
import { ScopeDefinitionService } from './scope-definition.service';
import type { ScopeDefinitionSession } from './scope-definition.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-scope-definition-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, SlicePipe],
  viewProviders: [provideIcons({ lucideClipboardList, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw, lucideLightbulb, lucideTarget, lucidePenLine, lucideDatabase, lucideCheck, lucideSearch })],
  template: `
    <div class="flex h-full">
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideClipboardList" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold">Scope Definition Agent</h1>
          </div>
          <p class="text-muted-foreground mb-6">Define clear project boundaries, deliverables, and constraints.</p>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <!-- Source Type Tabs (only show if there are importable sources) -->
          @if (hasImportableSources()) {
            <div class="mb-6">
              <label class="text-sm font-medium mb-2 block">Context Source</label>
              <div class="flex gap-2">
                @if (hasIdeationSessions()) {
                  <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors" [class.border-primary]="sourceType() === 'ideation'" [class.bg-primary/5]="sourceType() === 'ideation'" [class.text-primary]="sourceType() === 'ideation'" (click)="setSourceType('ideation')">
                    <ng-icon name="lucideLightbulb" class="h-4 w-4" /> From Ideation
                  </button>
                }
                @if (hasOkrSessions()) {
                  <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors" [class.border-primary]="sourceType() === 'okr'" [class.bg-primary/5]="sourceType() === 'okr'" [class.text-primary]="sourceType() === 'okr'" (click)="setSourceType('okr')">
                    <ng-icon name="lucideTarget" class="h-4 w-4" /> From OKRs
                  </button>
                }
                <button type="button" class="flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors" [class.border-primary]="sourceType() === 'custom'" [class.bg-primary/5]="sourceType() === 'custom'" [class.text-primary]="sourceType() === 'custom'" (click)="setSourceType('custom')">
                  <ng-icon name="lucidePenLine" class="h-4 w-4" /> Custom
                </button>
              </div>
            </div>
          }

          <form class="space-y-6" (submit)="onSubmit($event)">
            <!-- Ideation Session Picker -->
            @if (sourceType() === 'ideation') {
              <div>
                <label class="text-sm font-medium">Select Ideation Session <span class="text-destructive">*</span></label>
                <select class="mt-2 w-full rounded-lg border bg-background p-3 text-sm" [value]="selectedIdeationSessionId()" (change)="onIdeationSessionChange($event)">
                  <option value="">Choose an ideation session...</option>
                  @for (session of service.ideationSessions(); track session.id) {
                    <option [value]="session.id">{{ session.problemStatement | slice:0:80 }}{{ session.problemStatement.length > 80 ? '...' : '' }}</option>
                  }
                </select>
                @if (service.selectedIdeationSession()) {
                  <div class="mt-3 rounded-lg border bg-muted/30 p-3">
                    <p class="text-xs font-medium text-muted-foreground mb-1">Problem Statement</p>
                    <p class="text-sm">{{ service.selectedIdeationSession()!.problemStatement }}</p>
                    @if (service.selectedIdeas().length > 0) {
                      <p class="text-xs font-medium text-muted-foreground mt-3 mb-1">Top Ideas ({{ service.selectedIdeas().length }} total)</p>
                      <ul class="text-sm space-y-1">
                        @for (idea of service.selectedIdeas().slice(0, 3); track idea.id) {
                          <li class="flex items-start gap-2"><span class="text-primary">•</span> {{ idea.title }}</li>
                        }
                      </ul>
                    }
                  </div>
                }
              </div>
            }

            <!-- OKR Session Picker -->
            @if (sourceType() === 'okr') {
              <div>
                <label class="text-sm font-medium">Select OKR Session <span class="text-destructive">*</span></label>
                <select class="mt-2 w-full rounded-lg border bg-background p-3 text-sm" [value]="selectedOkrSessionId()" (change)="onOkrSessionChange($event)">
                  <option value="">Choose an OKR session...</option>
                  @for (session of service.okrSessions(); track session.id) {
                    <option [value]="session.id">{{ session.goalDescription | slice:0:80 }}{{ session.goalDescription.length > 80 ? '...' : '' }} ({{ session.timeframe }})</option>
                  }
                </select>
                @if (service.selectedOkrSession()) {
                  <div class="mt-3 rounded-lg border bg-muted/30 p-3">
                    <p class="text-xs font-medium text-muted-foreground mb-1">Goal</p>
                    <p class="text-sm">{{ service.selectedOkrSession()!.goalDescription }}</p>
                    <p class="text-xs text-muted-foreground mt-1">Timeframe: {{ service.selectedOkrSession()!.timeframe }}</p>
                    @if (service.okrObjectives().length > 0) {
                      <p class="text-xs font-medium text-muted-foreground mt-3 mb-1">Objectives ({{ service.okrObjectives().length }})</p>
                      <ul class="text-sm space-y-1">
                        @for (obj of service.okrObjectives().slice(0, 3); track obj.id) {
                          <li class="flex items-start gap-2"><span class="text-primary">•</span> {{ obj.title }}</li>
                        }
                      </ul>
                    }
                  </div>
                }
              </div>
            }

            <div>
              <label class="text-sm font-medium">Project Name <span class="text-destructive">*</span></label>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="projectName()" (input)="onProjectNameInput($event)" placeholder="e.g., Customer Portal V2" required />
            </div>

            <div>
              <label class="text-sm font-medium">Product Vision <span class="text-destructive">*</span></label>
              <p class="text-xs text-muted-foreground mt-1">High-level vision and goals (min 50 chars)</p>
              <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]" [value]="productVision()" (input)="onProductVisionInput($event)" placeholder="e.g., Build a self-service portal that allows customers to manage their accounts, view usage, and resolve issues without contacting support..." required></textarea>
              <p class="text-xs mt-1" [class.text-destructive]="visionLength() > 0 && visionLength() < 50">{{ visionLength() }} / 50 min</p>
            </div>

            <!-- Knowledge Base Picker -->
            <div>
              <label class="text-sm font-medium">Knowledge Bases (Optional)</label>
              <p class="text-xs text-muted-foreground mt-1">Select knowledge bases for additional context</p>
              <div class="relative mt-2">
                <button type="button" class="w-full flex items-center justify-between rounded-lg border bg-background p-3 text-sm" (click)="toggleKbDropdown()">
                  <span class="flex items-center gap-2">
                    <ng-icon name="lucideDatabase" class="h-4 w-4 text-muted-foreground" />
                    @if (selectedKnowledgeBases().length === 0) {
                      <span class="text-muted-foreground">Select knowledge bases...</span>
                    } @else {
                      <span>{{ selectedKnowledgeBases().length }} selected</span>
                    }
                  </span>
                  <ng-icon [name]="kbDropdownOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                </button>
                @if (kbDropdownOpen()) {
                  <div class="absolute z-10 mt-1 w-full rounded-lg border bg-background shadow-lg">
                    <div class="p-2 border-b">
                      <div class="relative">
                        <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="text" class="w-full rounded border bg-muted/30 py-1.5 pl-8 pr-3 text-sm" placeholder="Search..." [value]="kbSearchFilter()" (input)="onKbSearchInput($event)" />
                      </div>
                    </div>
                    <div class="max-h-48 overflow-y-auto p-1">
                      @for (kb of filteredKnowledgeBases(); track kb.id) {
                        <button type="button" class="w-full flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50 text-left" (click)="toggleKnowledgeBase(kb.id)">
                          <div class="h-4 w-4 rounded border flex items-center justify-center" [class.bg-primary]="selectedKbIds().includes(kb.id)" [class.border-primary]="selectedKbIds().includes(kb.id)">
                            @if (selectedKbIds().includes(kb.id)) { <ng-icon name="lucideCheck" class="h-3 w-3 text-white" /> }
                          </div>
                          <span>{{ kb.name }}</span>
                        </button>
                      }
                      @if (filteredKnowledgeBases().length === 0) {
                        <p class="p-2 text-sm text-muted-foreground text-center">No knowledge bases found</p>
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
                    <label class="text-sm font-medium">Initial Requirements</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="initialRequirements()" (input)="onRequirementsInput($event)" placeholder="e.g., User authentication, dashboard, reporting..."></textarea>
                  </div>
                  <div>
                    <label class="text-sm font-medium">Known Constraints</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="knownConstraints()" (input)="onConstraintsInput($event)" placeholder="e.g., Budget: $500K, Timeline: 6 months..."></textarea>
                  </div>
                  <div>
                    <label class="text-sm font-medium">Stakeholder Needs</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="stakeholderNeeds()" (input)="onStakeholderNeedsInput($event)" placeholder="e.g., Sales needs lead tracking, Support needs ticket integration..."></textarea>
                  </div>
                  <div>
                    <label class="text-sm font-medium">Target Users</label>
                    <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm min-h-[80px]" [value]="targetUsers()" (input)="onTargetUsersInput($event)" placeholder="e.g., Enterprise customers, Small businesses..."></textarea>
                  </div>
                </div>
              }
            </div>

            <button hlmBtn class="w-full" type="submit" [disabled]="!canSubmit() || service.isLoading()">
              @if (service.isLoading()) { <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" /> Defining Scope... }
              @else { <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" /> Define Scope }
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
            <div class="flex items-center justify-center p-6 h-full"><div class="text-center"><ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" /><h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3></div></div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div class="group rounded-lg border bg-background p-4 hover:border-primary/50 cursor-pointer" (click)="viewSession(session)">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-green-100]="session.status === 'completed'" [class.text-green-700]="session.status === 'completed'" [class.bg-yellow-100]="session.status === 'generating'" [class.text-yellow-700]="session.status === 'generating'" [class.bg-red-100]="session.status === 'failed'" [class.text-red-700]="session.status === 'failed'">{{ session.status }}</span>
                      </div>
                      <p class="mt-1 text-sm font-medium">{{ session.projectName }}</p>
                      <p class="text-xs text-muted-foreground line-clamp-1">{{ session.productVision }}</p>
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
export class ScopeDefinitionInputComponent implements OnInit {
  service = inject(ScopeDefinitionService);
  private router = inject(Router);

  // Source type selection
  sourceType = signal<'ideation' | 'okr' | 'custom'>('ideation');
  selectedIdeationSessionId = signal<number | null>(null);
  selectedOkrSessionId = signal<number | null>(null);

  // Form fields
  projectName = signal('');
  productVision = signal('');
  initialRequirements = signal('');
  knownConstraints = signal('');
  stakeholderNeeds = signal('');
  targetUsers = signal('');
  optionalFieldsOpen = signal(false);

  // Knowledge base selection
  selectedKbIds = signal<number[]>([]);
  kbDropdownOpen = signal(false);
  kbSearchFilter = signal('');

  selectedKnowledgeBases = computed(() => this.service.knowledgeBases().filter((kb) => this.selectedKbIds().includes(kb.id)));
  filteredKnowledgeBases = computed(() => {
    const filter = this.kbSearchFilter().toLowerCase();
    return this.service.knowledgeBases().filter((kb) => kb.name.toLowerCase().includes(filter));
  });

  visionLength = computed(() => this.productVision().length);

  // Check which importable sources are available
  hasIdeationSessions = computed(() => this.service.ideationSessions().length > 0);
  hasOkrSessions = computed(() => this.service.okrSessions().length > 0);
  hasImportableSources = computed(() => this.hasIdeationSessions() || this.hasOkrSessions());

  canSubmit = computed(() => {
    if (this.sourceType() === 'ideation' && !this.selectedIdeationSessionId()) return false;
    if (this.sourceType() === 'okr' && !this.selectedOkrSessionId()) return false;
    return this.projectName().length > 0 && this.visionLength() >= 50;
  });

  async ngOnInit() {
    await Promise.all([
      this.service.loadSessions(),
      this.service.loadIdeationSessions(),
      this.service.loadOkrSessions(),
      this.service.loadKnowledgeBases(),
    ]);

    // Set default source type based on available import sources
    const hasIdeation = this.service.ideationSessions().length > 0;
    const hasOkr = this.service.okrSessions().length > 0;

    if (!hasIdeation && !hasOkr) {
      // No importable sources, default to custom
      this.sourceType.set('custom');
    } else if (hasIdeation) {
      // Prefer ideation if available
      this.sourceType.set('ideation');
    } else if (hasOkr) {
      // Fall back to OKR
      this.sourceType.set('okr');
    }
  }

  setSourceType(type: 'ideation' | 'okr' | 'custom') {
    this.sourceType.set(type);
    // Clear other selections when switching
    if (type !== 'ideation') {
      this.selectedIdeationSessionId.set(null);
      this.service.clearIdeationSelection();
    }
    if (type !== 'okr') {
      this.selectedOkrSessionId.set(null);
      this.service.clearOkrSelection();
    }
    // Clear auto-populated fields when switching
    this.projectName.set('');
    this.productVision.set('');
  }

  async onIdeationSessionChange(e: Event) {
    const id = parseInt((e.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedIdeationSessionId.set(null);
      this.service.clearIdeationSelection();
      return;
    }
    this.selectedIdeationSessionId.set(id);
    await this.service.loadIdeationSessionFull(id);
    // Auto-populate fields
    const { projectName, vision } = this.service.buildVisionFromIdeation();
    this.projectName.set(projectName);
    this.productVision.set(vision);
  }

  async onOkrSessionChange(e: Event) {
    const id = parseInt((e.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedOkrSessionId.set(null);
      this.service.clearOkrSelection();
      return;
    }
    this.selectedOkrSessionId.set(id);
    await this.service.loadOkrSessionFull(id);
    // Auto-populate fields
    const { projectName, vision } = this.service.buildVisionFromOkr();
    this.projectName.set(projectName);
    this.productVision.set(vision);
  }

  // KB dropdown methods
  toggleKbDropdown() { this.kbDropdownOpen.update((v) => !v); }
  closeKbDropdown() { this.kbDropdownOpen.set(false); this.kbSearchFilter.set(''); }
  onKbSearchInput(e: Event) { this.kbSearchFilter.set((e.target as HTMLInputElement).value); }
  toggleKnowledgeBase(id: number) {
    this.selectedKbIds.update((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.closest('.relative')) this.closeKbDropdown();
  }

  onProjectNameInput(e: Event) { this.projectName.set((e.target as HTMLInputElement).value); }
  onProductVisionInput(e: Event) { this.productVision.set((e.target as HTMLTextAreaElement).value); }
  onRequirementsInput(e: Event) { this.initialRequirements.set((e.target as HTMLTextAreaElement).value); }
  onConstraintsInput(e: Event) { this.knownConstraints.set((e.target as HTMLTextAreaElement).value); }
  onStakeholderNeedsInput(e: Event) { this.stakeholderNeeds.set((e.target as HTMLTextAreaElement).value); }
  onTargetUsersInput(e: Event) { this.targetUsers.set((e.target as HTMLTextAreaElement).value); }
  toggleOptionalFields() { this.optionalFieldsOpen.update((v) => !v); }

  async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.canSubmit()) return;
    const session = await this.service.createSession({
      projectName: this.projectName(),
      productVision: this.productVision(),
      initialRequirements: this.initialRequirements() || undefined,
      knownConstraints: this.knownConstraints() || undefined,
      stakeholderNeeds: this.stakeholderNeeds() || undefined,
      targetUsers: this.targetUsers() || undefined,
      ideationSessionId: this.sourceType() === 'ideation' ? this.selectedIdeationSessionId() || undefined : undefined,
      okrSessionId: this.sourceType() === 'okr' ? this.selectedOkrSessionId() || undefined : undefined,
      knowledgeBaseIds: this.selectedKbIds().length > 0 ? this.selectedKbIds() : undefined,
    });
    if (session) this.router.navigate(['/scoping/definition/results', session.id]);
  }

  viewSession(session: ScopeDefinitionSession) { this.router.navigate(['/scoping/definition/results', session.id]); }
  async deleteSession(e: Event, session: ScopeDefinitionSession) { e.stopPropagation(); if (confirm('Delete?')) await this.service.deleteSession(session.id); }
  async retrySession(e: Event, session: ScopeDefinitionSession) { e.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/scoping/definition/results', session.id]); }
}
