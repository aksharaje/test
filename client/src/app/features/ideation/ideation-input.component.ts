import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDatabase,
  lucideChevronDown,
  lucideSearch,
  lucideCheck,
  lucideSparkles,
  lucideHistory,
  lucideChevronRight,
  lucideTrash2,
  lucideLoader2,
} from '@ng-icons/lucide';
import { IdeationService } from './ideation.service';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-ideation-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideDatabase,
      lucideChevronDown,
      lucideSearch,
      lucideCheck,
      lucideSparkles,
      lucideHistory,
      lucideChevronRight,
      lucideTrash2,
      lucideLoader2,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Ideation Engine</h1>
          <p class="mt-1 text-muted-foreground">
            Describe your problem, and our AI will generate 15-16 unique, scored solution ideas organized into themed clusters.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Problem Statement -->
            <div>
              <label class="text-sm font-medium">
                Problem Statement <span class="text-destructive">*</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Minimum 100 characters
              </p>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                [value]="problemStatement()"
                (input)="onProblemInput($event)"
                required
              ></textarea>
              <p class="text-xs text-muted-foreground mt-1">
                {{ problemStatement().length }} / 100 characters
              </p>
            </div>

            <!-- Knowledge Base Selection -->
            <div>
              <label class="text-sm font-medium">
                <ng-icon name="lucideDatabase" class="inline h-4 w-4 mr-1" />
                Knowledge Bases <span class="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Provide relevant context from your documents
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

            <!-- Constraints -->
            <div>
              <label class="text-sm font-medium">
                Constraints <span class="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                placeholder="e.g., Budget limited to $50k, must be implemented within 3 months..."
                [value]="constraints()"
                (input)="onConstraintsInput($event)"
              ></textarea>
            </div>

            <!-- Goals -->
            <div>
              <label class="text-sm font-medium">
                Goals <span class="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                placeholder="e.g., Increase user engagement by 30%, reduce support tickets..."
                [value]="goals()"
                (input)="onGoalsInput($event)"
              ></textarea>
            </div>

            <!-- Research Insights -->
            <div>
              <label class="text-sm font-medium">
                Research Insights <span class="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                placeholder="e.g., 60% of users abandon the checkout process on mobile..."
                [value]="researchInsights()"
                (input)="onResearchInsightsInput($event)"
              ></textarea>
            </div>

            <!-- Generate Button -->
            <div class="mt-6">
              <button
                hlmBtn
                class="w-full"
                type="submit"
                [disabled]="!canSubmit() || service.loading()"
              >
                @if (service.loading()) {
                  <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  Generating Ideas...
                } @else {
                  <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Generate Ideas
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Ideation History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past ideation sessions
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto">
          @if (service.loading() && service.sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="h-4 bg-muted rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (service.sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your generated ideation sessions will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status !== 'completed' && session.status !== 'failed'"
                          [class.text-yellow-700]="session.status !== 'completed' && session.status !== 'failed'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                        >
                          {{ session.status }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-foreground line-clamp-2">
                        {{ session.problemStatement }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        (click)="deleteSession($event, session)"
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
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class IdeationInputComponent implements OnInit {
  service = inject(IdeationService);
  private router = inject(Router);

  // Form state
  problemStatement = signal('');
  constraints = signal('');
  goals = signal('');
  researchInsights = signal('');
  selectedKbIds = signal<number[]>([]);

  // KB dropdown state
  kbDropdownOpen = signal(false);
  kbSearchFilter = signal('');

  // Computed
  canSubmit = computed(() => this.problemStatement().length >= 100);

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

  async ngOnInit() {
    await this.service.loadKnowledgeBases();
    await this.service.loadSessions();
  }

  onProblemInput(event: Event) {
    this.problemStatement.set((event.target as HTMLTextAreaElement).value);
  }

  onConstraintsInput(event: Event) {
    this.constraints.set((event.target as HTMLTextAreaElement).value);
  }

  onGoalsInput(event: Event) {
    this.goals.set((event.target as HTMLTextAreaElement).value);
  }

  onResearchInsightsInput(event: Event) {
    this.researchInsights.set((event.target as HTMLTextAreaElement).value);
  }

  toggleKbDropdown() {
    this.kbDropdownOpen.update((v) => !v);
  }

  closeKbDropdown() {
    this.kbDropdownOpen.set(false);
  }

  onKbSearchInput(event: Event) {
    this.kbSearchFilter.set((event.target as HTMLInputElement).value);
  }

  toggleKnowledgeBase(id: number) {
    this.selectedKbIds.update((ids) => {
      if (ids.includes(id)) {
        return ids.filter((kbId) => kbId !== id);
      } else {
        return [...ids, id];
      }
    });
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const session = await this.service.createSession({
      problemStatement: this.problemStatement(),
      constraints: this.constraints() || undefined,
      goals: this.goals() || undefined,
      researchInsights: this.researchInsights() || undefined,
      knowledgeBaseIds: this.selectedKbIds().length > 0 ? this.selectedKbIds() : undefined,
    });

    if (session) {
      this.router.navigate(['/ideation/processing', session.id]);
    }
  }

  viewSession(session: any) {
    if (session.status === 'completed') {
      this.router.navigate(['/ideation/results', session.id]);
    } else if (session.status !== 'failed') {
      this.router.navigate(['/ideation/processing', session.id]);
    }
  }

  async deleteSession(event: Event, session: any) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this ideation session?')) {
      await this.service.deleteSession(session.id);
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
