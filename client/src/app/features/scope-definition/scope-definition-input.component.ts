import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClipboardList, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw } from '@ng-icons/lucide';
import { ScopeDefinitionService } from './scope-definition.service';
import type { ScopeDefinitionSession } from './scope-definition.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-scope-definition-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideClipboardList, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideChevronDown, lucideRotateCw })],
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

          <form class="space-y-6" (submit)="onSubmit($event)">
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

  projectName = signal('');
  productVision = signal('');
  initialRequirements = signal('');
  knownConstraints = signal('');
  stakeholderNeeds = signal('');
  targetUsers = signal('');
  optionalFieldsOpen = signal(false);

  visionLength = computed(() => this.productVision().length);
  canSubmit = computed(() => this.projectName().length > 0 && this.visionLength() >= 50);

  async ngOnInit() { await this.service.loadSessions(); }

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
    });
    if (session) this.router.navigate(['/scoping/definition/results', session.id]);
  }

  viewSession(session: ScopeDefinitionSession) { this.router.navigate(['/scoping/definition/results', session.id]); }
  async deleteSession(e: Event, session: ScopeDefinitionSession) { e.stopPropagation(); if (confirm('Delete?')) await this.service.deleteSession(session.id); }
  async retrySession(e: Event, session: ScopeDefinitionSession) { e.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/scoping/definition/results', session.id]); }
}
