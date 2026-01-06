import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTarget, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideRotateCw } from '@ng-icons/lucide';
import { GoalSettingService } from './goal-setting.service';
import type { GoalSettingSession } from './goal-setting.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-goal-setting-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [provideIcons({ lucideTarget, lucideHistory, lucideLoader2, lucideSparkles, lucideTrash2, lucideChevronRight, lucideRotateCw })],
  template: `
    <div class="flex h-full">
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold">Goal Setting Assistant</h1>
          </div>
          <p class="text-muted-foreground mb-6">Define the context for your goals. The system will generate suggestions based on these inputs.</p>

          @if (service.error()) {
            <div class="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="space-y-5" (submit)="onSubmit($event)">
            <div>
              <label class="text-sm font-medium">PM Role / Domain <span class="text-destructive">*</span></label>
              <p class="text-xs text-muted-foreground mt-1 italic">The product area or problem space you are responsible for (e.g., authentication, payments, user onboarding).</p>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="domain()" (input)="onDomainInput($event)" placeholder="e.g., Checkout Flow, Onboarding + Authentication" required />
            </div>

            <div>
              <label class="text-sm font-medium">Customer Problem Statements</label>
              <p class="text-xs text-muted-foreground mt-1 italic">The customer issues you are trying to solve (e.g., users can't log in, onboarding takes too long).</p>
              <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]" [value]="problemStatements()" (input)="onProblemStatementsInput($event)" placeholder="e.g., Login failures, high drop-off, support tickets"></textarea>
            </div>

            <div>
              <label class="text-sm font-medium">Company Strategy</label>
              <p class="text-xs text-muted-foreground mt-1 italic">The broader business goal this work supports (e.g., increase retention, reduce churn, drive enterprise adoption).</p>
              <textarea class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]" [value]="strategy()" (input)="onStrategyInput($event)" placeholder="e.g., Expand into Enterprise market, Improve activation and reduce operational load"></textarea>
            </div>

            <div>
              <label class="text-sm font-medium">Team Charter</label>
              <p class="text-xs text-muted-foreground mt-1 italic">What this team is expected to own and deliver (e.g., faster checkout, smoother onboarding, reliable login).</p>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="teamCharter()" (input)="onTeamCharterInput($event)" placeholder="e.g., Growth & Onboarding Experience" />
            </div>

            <div>
              <label class="text-sm font-medium">Product-Specific Responsibilities (Baselines)</label>
              <p class="text-xs text-muted-foreground mt-1 italic">The outcomes this product team is accountable for improving (e.g., login success rate, checkout completion).</p>
              <input type="text" class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" [value]="baselines()" (input)="onBaselinesInput($event)" placeholder="e.g., 87% Login Success, 61% Retention, 10% Conversion Rate" />
            </div>

            <button hlmBtn class="w-full" type="submit" [disabled]="!canSubmit() || service.isLoading()">
              @if (service.isLoading()) { <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" /> Generating Goals... }
              @else { <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" /> Generate Goals }
            </button>
          </form>
        </div>
      </div>

      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Goal Setting History</h2>
          </div>
          <p class="text-xs text-muted-foreground mt-1 ml-7">View and manage your past sessions</p>
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
                      <p class="mt-1 text-sm font-medium">{{ session.domain }}</p>
                      <p class="text-xs text-muted-foreground line-clamp-1">
                        {{ session.strategy || session.problemStatements || 'No details provided' }}
                      </p>
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
export class GoalSettingInputComponent implements OnInit {
  service = inject(GoalSettingService);
  private router = inject(Router);

  domain = signal('');
  strategy = signal('');
  teamCharter = signal('');
  problemStatements = signal('');
  baselines = signal('');

  canSubmit = computed(() => this.domain().length > 0);

  async ngOnInit() { await this.service.loadSessions(); }

  onDomainInput(e: Event) { this.domain.set((e.target as HTMLInputElement).value); }
  onStrategyInput(e: Event) { this.strategy.set((e.target as HTMLTextAreaElement).value); }
  onTeamCharterInput(e: Event) { this.teamCharter.set((e.target as HTMLInputElement).value); }
  onProblemStatementsInput(e: Event) { this.problemStatements.set((e.target as HTMLTextAreaElement).value); }
  onBaselinesInput(e: Event) { this.baselines.set((e.target as HTMLInputElement).value); }

  async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.canSubmit()) return;
    const session = await this.service.createSession({
      domain: this.domain(),
      strategy: this.strategy(),
      teamCharter: this.teamCharter() || undefined,
      problemStatements: this.problemStatements() || undefined,
      baselines: this.baselines() || undefined,
    });
    if (session) this.router.navigate(['/goals/setting/results', session.id]);
  }

  viewSession(session: GoalSettingSession) { this.router.navigate(['/goals/setting/results', session.id]); }
  async deleteSession(e: Event, session: GoalSettingSession) { e.stopPropagation(); if (confirm('Delete?')) await this.service.deleteSession(session.id); }
  async retrySession(e: Event, session: GoalSettingSession) { e.stopPropagation(); await this.service.retrySession(session.id); this.router.navigate(['/goals/setting/results', session.id]); }
}
