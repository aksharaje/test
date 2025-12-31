import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClipboardList, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideClock, lucideAlertTriangle, lucideShield, lucidePackage, lucideChevronRight, lucideActivity } from '@ng-icons/lucide';
import { ScopeDefinitionService } from './scope-definition.service';
import type { ScopeDefinitionSession, ScopeItem, ScopeAssumption, ScopeConstraint, ScopeDeliverable } from './scope-definition.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-scope-definition-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideClipboardList, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideClock, lucideAlertTriangle, lucideShield, lucidePackage, lucideChevronRight, lucideActivity })],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-5xl mx-auto p-6">
        <div class="flex items-center gap-4 mb-6">
          <button hlmBtn variant="ghost" size="icon" (click)="goBack()"><ng-icon name="lucideArrowLeft" class="h-5 w-5" /></button>
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ng-icon name="lucideClipboardList" class="h-5 w-5 text-primary" /></div>
            <div>
              <h1 class="text-2xl font-bold">{{ session()?.projectName || 'Scope Definition' }}</h1>
              <p class="text-sm text-muted-foreground">Scope Definition Results</p>
            </div>
          </div>
        </div>

        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-16">
            <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
            <p class="mt-4 text-lg font-medium text-muted-foreground">{{ session()?.progressMessage || 'Defining scope...' }}</p>
          </div>
        }

        @if (session()?.status === 'failed') {
          <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
            <div class="flex items-start gap-4">
              <ng-icon name="lucideAlertCircle" class="h-6 w-6 text-destructive" />
              <div>
                <h3 class="font-semibold text-destructive">Generation Failed</h3>
                <p class="mt-1 text-sm">{{ session()?.errorMessage }}</p>
                <button hlmBtn variant="outline" size="sm" class="mt-4" (click)="retry()"><ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" /> Retry</button>
              </div>
            </div>
          </div>
        }

        @if (session()?.status === 'completed') {
          @if (session()?.scopeStatement) {
            <div class="rounded-lg border bg-primary/5 p-4 mb-6">
              <h2 class="font-semibold mb-2">Scope Statement</h2>
              <p class="text-sm text-muted-foreground">{{ session()?.scopeStatement }}</p>
            </div>
          }

          <!-- In Scope -->
          <div class="mb-8">
            <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideCheckCircle" class="h-5 w-5 text-green-600" /> In Scope ({{ inScopeItems().length }})</h2>
            <div class="space-y-3">
              @for (item of inScopeItems(); track item.id) {
                <div class="rounded-lg border p-4 border-l-4 border-l-green-500">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ item.category }}</span>
                    @if (item.priority) { <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" [class.bg-red-100]="item.priority === 'must_have'" [class.text-red-700]="item.priority === 'must_have'" [class.bg-yellow-100]="item.priority === 'should_have'" [class.text-yellow-700]="item.priority === 'should_have'" [class.bg-blue-100]="item.priority === 'could_have'" [class.text-blue-700]="item.priority === 'could_have'">{{ item.priority.replace('_', ' ') }}</span> }
                    <h3 class="font-medium text-sm">{{ item.title }}</h3>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ item.description }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Out of Scope -->
          @if (outOfScopeItems().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideXCircle" class="h-5 w-5 text-red-600" /> Out of Scope ({{ outOfScopeItems().length }})</h2>
              <div class="space-y-3">
                @for (item of outOfScopeItems(); track item.id) {
                  <div class="rounded-lg border p-4 border-l-4 border-l-red-500">
                    <h3 class="font-medium text-sm">{{ item.title }}</h3>
                    <p class="text-xs text-muted-foreground">{{ item.description }}</p>
                    @if (item.rationale) { <p class="text-xs mt-1"><strong>Rationale:</strong> {{ item.rationale }}</p> }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Deferred -->
          @if (deferredItems().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideClock" class="h-5 w-5 text-amber-600" /> Deferred ({{ deferredItems().length }})</h2>
              <div class="space-y-3">
                @for (item of deferredItems(); track item.id) {
                  <div class="rounded-lg border p-4 border-l-4 border-l-amber-500">
                    <h3 class="font-medium text-sm">{{ item.title }}</h3>
                    <p class="text-xs text-muted-foreground">{{ item.description }}</p>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Assumptions & Constraints -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            @if (assumptions().length > 0) {
              <div>
                <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideAlertTriangle" class="h-5 w-5" /> Assumptions ({{ assumptions().length }})</h2>
                <div class="space-y-2">
                  @for (a of assumptions(); track a.id) {
                    <div class="rounded border p-3">
                      <p class="text-sm">{{ a.assumption }}</p>
                      <p class="text-xs text-muted-foreground mt-1"><strong>Risk if wrong:</strong> {{ a.riskIfWrong }}</p>
                    </div>
                  }
                </div>
              </div>
            }
            @if (constraints().length > 0) {
              <div>
                <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucideShield" class="h-5 w-5" /> Constraints ({{ constraints().length }})</h2>
                <div class="space-y-2">
                  @for (c of constraints(); track c.id) {
                    <div class="rounded border p-3">
                      <div class="flex items-center gap-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ c.category }}</span></div>
                      <p class="text-sm mt-1">{{ c.constraint }}</p>
                      <p class="text-xs text-muted-foreground mt-1"><strong>Impact:</strong> {{ c.impact }}</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Deliverables -->
          @if (deliverables().length > 0) {
            <div class="mb-8">
              <h2 class="text-lg font-semibold mb-4 flex items-center gap-2"><ng-icon name="lucidePackage" class="h-5 w-5" /> Deliverables ({{ deliverables().length }})</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (d of deliverables(); track d.id) {
                  <div class="rounded-lg border p-4">
                    <div class="flex items-center gap-2 mb-1"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">{{ d.type }}</span><h3 class="font-medium text-sm">{{ d.name }}</h3></div>
                    <p class="text-xs text-muted-foreground">{{ d.description }}</p>
                    @if (d.acceptanceCriteria && d.acceptanceCriteria.length > 0) {
                      <div class="mt-2"><strong class="text-xs">Acceptance:</strong><ul class="text-xs list-disc list-inside">@for (ac of d.acceptanceCriteria; track ac) { <li>{{ ac }}</li> }</ul></div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Next Steps CTA -->
          <div class="mt-8 pt-6 border-t">
            <h3 class="text-lg font-semibold mb-4">Continue Your Workflow</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button hlmBtn class="w-full justify-start" (click)="continueToScopeMonitor()">
                <ng-icon name="lucideActivity" class="mr-3 h-5 w-5" />
                <div class="text-left">
                  <div class="font-medium">Monitor Scope Changes</div>
                  <div class="text-xs text-primary-foreground/70">Track scope creep and manage change requests</div>
                </div>
                <ng-icon name="lucideChevronRight" class="ml-auto h-5 w-5" />
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class ScopeDefinitionResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ScopeDefinitionService);

  session = signal<ScopeDefinitionSession | null>(null);
  inScopeItems = signal<ScopeItem[]>([]);
  outOfScopeItems = signal<ScopeItem[]>([]);
  deferredItems = signal<ScopeItem[]>([]);
  assumptions = signal<ScopeAssumption[]>([]);
  constraints = signal<ScopeConstraint[]>([]);
  deliverables = signal<ScopeDeliverable[]>([]);
  isLoading = signal(true);

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) { this.router.navigate(['/scoping/definition']); return; }
    await this.loadSession(sessionId);
  }

  async loadSession(sessionId: number) {
    this.isLoading.set(true);
    let session = await this.service.getSession(sessionId);
    while (session && (session.status === 'pending' || session.status === 'generating')) {
      this.session.set(session);
      await new Promise((r) => setTimeout(r, 2000));
      session = await this.service.getSession(sessionId);
    }
    if (session) {
      this.session.set(session);
      if (session.status === 'completed') {
        const fullData = await this.service.getSessionFull(sessionId);
        if (fullData) {
          this.inScopeItems.set(fullData.in_scope_items);
          this.outOfScopeItems.set(fullData.out_of_scope_items);
          this.deferredItems.set(fullData.deferred_items);
          this.assumptions.set(fullData.assumptions);
          this.constraints.set(fullData.constraints);
          this.deliverables.set(fullData.deliverables);
        }
      }
    }
    this.isLoading.set(false);
  }

  async retry() { const id = this.session()?.id; if (id) { this.isLoading.set(true); await this.service.retrySession(id); await this.loadSession(id); } }
  goBack() { this.router.navigate(['/scoping/definition']); }

  continueToScopeMonitor() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.router.navigate(['/scoping/monitor'], { queryParams: { scopeDefinitionId: sessionId } });
    }
  }
}
