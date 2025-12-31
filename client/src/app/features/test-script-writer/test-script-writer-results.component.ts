import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader2,
  lucideRotateCw,
  lucideAlertCircle,
  lucideCheck,
  lucideCopy,
  lucideCheckCircle,
  lucideTestTube2,
  lucideChevronDown,
  lucideChevronRight,
  lucideFilter,
  lucideClipboard,
  lucideShield,
  lucideAccessibility,
  lucideBarChart,
  lucideZap,
  lucideGlobe,
  lucideUsers,
  lucideDatabase,
  lucideMonitor,
} from '@ng-icons/lucide';
import { TestScriptWriterService } from './test-script-writer.service';
import type { TestScriptWriterSession, StoryTestScript, TestCase } from './test-script-writer.types';
import { HlmButtonDirective } from '../../ui/button';

type FilterType = 'all' | 'functional' | 'edge_case' | 'negative' | 'nfr';

@Component({
  selector: 'app-test-script-writer-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideLoader2,
      lucideRotateCw,
      lucideAlertCircle,
      lucideCheck,
      lucideCopy,
      lucideCheckCircle,
      lucideTestTube2,
      lucideChevronDown,
      lucideChevronRight,
      lucideFilter,
      lucideClipboard,
      lucideShield,
      lucideAccessibility,
      lucideBarChart,
      lucideZap,
      lucideGlobe,
      lucideUsers,
      lucideDatabase,
      lucideMonitor,
    }),
  ],
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="border-b bg-background p-4">
        <div class="max-w-5xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              hlmBtn
              variant="ghost"
              size="sm"
              (click)="goBack()"
            >
              <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-1" />
              Back
            </button>
            <div>
              <h1 class="text-xl font-bold">
                {{ session()?.sourceTitle || 'Test Scripts' }}
              </h1>
              @if (session()?.summary) {
                <p class="text-sm text-muted-foreground">{{ session()!.summary }}</p>
              }
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (session()?.status === 'completed') {
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-green-500" />
                {{ session()!.totalTestCases }} test cases
              </div>
            }
            @if (session()?.status === 'failed') {
              <button
                hlmBtn
                variant="outline"
                size="sm"
                (click)="retryGeneration()"
                [disabled]="service.loading()"
              >
                <ng-icon name="lucideRotateCw" class="h-4 w-4 mr-1" />
                Retry
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        @if (isPolling()) {
          <div class="flex flex-col items-center justify-center h-full">
            <ng-icon name="lucideLoader2" class="h-12 w-12 animate-spin text-primary mb-4" />
            <p class="text-lg font-medium">Generating test scripts...</p>
            <p class="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        } @else if (session()?.status === 'failed') {
          <div class="flex flex-col items-center justify-center h-full">
            <ng-icon name="lucideAlertCircle" class="h-12 w-12 text-destructive mb-4" />
            <p class="text-lg font-medium">Generation Failed</p>
            <p class="text-sm text-muted-foreground mb-4">{{ session()!.errorMessage }}</p>
            <button hlmBtn (click)="retryGeneration()">
              <ng-icon name="lucideRotateCw" class="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        } @else if (session()?.status === 'completed') {
          <div class="max-w-5xl mx-auto p-6">
            <!-- Test Breakdown -->
            <div class="flex flex-wrap gap-3 mb-6">
              @for (filter of filters; track filter.value) {
                <button
                  class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors"
                  [class.bg-primary]="activeFilter() === filter.value"
                  [class.text-primary-foreground]="activeFilter() === filter.value"
                  [class.bg-muted]="activeFilter() !== filter.value"
                  [class.hover:bg-muted/80]="activeFilter() !== filter.value"
                  (click)="setFilter(filter.value)"
                >
                  <span>{{ filter.label }}</span>
                  <span class="px-1.5 py-0.5 rounded-full text-xs"
                        [class.bg-primary-foreground/20]="activeFilter() === filter.value"
                        [class.bg-foreground/10]="activeFilter() !== filter.value">
                    {{ getFilterCount(filter.value) }}
                  </span>
                </button>
              }
            </div>

            <!-- Stories with Test Cases -->
            @for (script of session()!.storyTestScripts; track script.storyId) {
              <div class="mb-6 rounded-lg border bg-card">
                <!-- Story Header -->
                <button
                  class="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
                  (click)="toggleStory(script.storyId)"
                >
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <ng-icon
                        [name]="isStoryExpanded(script.storyId) ? 'lucideChevronDown' : 'lucideChevronRight'"
                        class="h-4 w-4"
                      />
                      <h3 class="font-semibold">{{ script.storyTitle }}</h3>
                    </div>
                    <p class="text-sm text-muted-foreground mt-1 ml-6">{{ script.storyDescription }}</p>
                  </div>
                  <span class="text-sm text-muted-foreground">
                    {{ getFilteredTestCases(script).length }} test cases
                  </span>
                </button>

                @if (isStoryExpanded(script.storyId)) {
                  <div class="border-t p-4">
                    <!-- Acceptance Criteria -->
                    @if (script.acceptanceCriteria.length > 0) {
                      <div class="mb-4">
                        <h4 class="text-sm font-medium mb-2">Acceptance Criteria</h4>
                        <ul class="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          @for (ac of script.acceptanceCriteria; track $index) {
                            <li>{{ ac }}</li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Test Cases -->
                    <div class="space-y-3">
                      @for (tc of getFilteredTestCases(script); track tc.id) {
                        <div class="rounded-lg border bg-background p-4">
                          <div class="flex items-start justify-between mb-3">
                            <div class="flex-1">
                              <div class="flex items-center gap-2 mb-1">
                                <span class="text-xs font-mono px-1.5 py-0.5 rounded bg-muted">{{ tc.id }}</span>
                                <span class="text-xs px-2 py-0.5 rounded-full" [class]="getTestTypeBadgeClass(tc.testType)">
                                  {{ getTestTypeLabel(tc.testType) }}
                                </span>
                                @if (tc.nfrCategory) {
                                  <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                    {{ tc.nfrCategory }}
                                  </span>
                                }
                                <span class="text-xs px-2 py-0.5 rounded-full" [class]="getPriorityBadgeClass(tc.priority)">
                                  {{ tc.priority }}
                                </span>
                              </div>
                              <h4 class="font-medium">{{ tc.title }}</h4>
                              <p class="text-sm text-muted-foreground mt-1">{{ tc.description }}</p>
                            </div>
                            <button
                              hlmBtn
                              variant="ghost"
                              size="sm"
                              (click)="copyTestCase(tc)"
                              [title]="copiedId() === tc.id ? 'Copied!' : 'Copy test case'"
                            >
                              @if (copiedId() === tc.id) {
                                <ng-icon name="lucideCheck" class="h-4 w-4 text-green-500" />
                              } @else {
                                <ng-icon name="lucideCopy" class="h-4 w-4" />
                              }
                            </button>
                          </div>

                          @if (tc.preconditions.length > 0) {
                            <div class="mb-3">
                              <h5 class="text-xs font-medium text-muted-foreground mb-1">Preconditions</h5>
                              <ul class="text-sm space-y-1">
                                @for (pre of tc.preconditions; track $index) {
                                  <li class="flex items-start gap-2">
                                    <span class="text-muted-foreground">•</span>
                                    <span>{{ pre }}</span>
                                  </li>
                                }
                              </ul>
                            </div>
                          }

                          <div class="mb-3">
                            <h5 class="text-xs font-medium text-muted-foreground mb-1">Steps</h5>
                            <ol class="text-sm space-y-1">
                              @for (step of tc.steps; track $index) {
                                <li class="flex items-start gap-2">
                                  <span class="text-muted-foreground font-mono text-xs">{{ $index + 1 }}.</span>
                                  <span>{{ step }}</span>
                                </li>
                              }
                            </ol>
                          </div>

                          <div class="rounded-md bg-green-50 dark:bg-green-900/20 p-3">
                            <h5 class="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Expected Result</h5>
                            <p class="text-sm text-green-800 dark:text-green-200">{{ tc.expectedResult }}</p>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class TestScriptWriterResultsComponent implements OnInit, OnDestroy {
  service = inject(TestScriptWriterService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private pollingInterval?: ReturnType<typeof setInterval>;

  // State
  session = computed(() => this.service.currentSession());
  isPolling = signal(false);
  expandedStories = signal<Set<string>>(new Set());
  activeFilter = signal<FilterType>('all');
  copiedId = signal<string | null>(null);

  filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'functional', label: 'Functional' },
    { value: 'edge_case', label: 'Edge Cases' },
    { value: 'negative', label: 'Negative' },
    { value: 'nfr', label: 'NFR' },
  ];

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadSession(id);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async loadSession(id: number): Promise<void> {
    const session = await this.service.getSession(id);
    if (session && (session.status === 'pending' || session.status === 'generating')) {
      this.startPolling(id);
    }
    // Expand all stories by default
    if (session?.storyTestScripts) {
      const ids = new Set(session.storyTestScripts.map(s => s.storyId));
      this.expandedStories.set(ids);
    }
  }

  startPolling(id: number): void {
    this.isPolling.set(true);
    this.pollingInterval = setInterval(async () => {
      const status = await this.service.getSessionStatus(id);
      if (status && (status.status === 'completed' || status.status === 'failed')) {
        this.stopPolling();
        await this.service.getSession(id);
        // Expand all stories
        const session = this.session();
        if (session?.storyTestScripts) {
          const ids = new Set(session.storyTestScripts.map(s => s.storyId));
          this.expandedStories.set(ids);
        }
      }
    }, 2000);
  }

  stopPolling(): void {
    this.isPolling.set(false);
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  goBack(): void {
    this.router.navigate(['/test-script-writer']);
  }

  async retryGeneration(): Promise<void> {
    const session = this.session();
    if (session) {
      await this.service.retrySession(session.id);
      this.startPolling(session.id);
    }
  }

  toggleStory(storyId: string): void {
    this.expandedStories.update(set => {
      const newSet = new Set(set);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  }

  isStoryExpanded(storyId: string): boolean {
    return this.expandedStories().has(storyId);
  }

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  getFilterCount(filter: FilterType): number {
    const session = this.session();
    if (!session) return 0;

    if (filter === 'all') {
      return session.totalTestCases;
    }
    return session.testBreakdown[filter] || 0;
  }

  getFilteredTestCases(script: StoryTestScript): TestCase[] {
    const filter = this.activeFilter();
    if (filter === 'all') {
      return script.testCases;
    }
    return script.testCases.filter(tc => tc.testType === filter);
  }

  getTestTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      functional: 'Functional',
      edge_case: 'Edge Case',
      negative: 'Negative',
      nfr: 'NFR',
    };
    return labels[type] || type;
  }

  getTestTypeBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      functional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      edge_case: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      nfr: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return classes[type] || 'bg-muted';
  }

  getPriorityBadgeClass(priority: string): string {
    const classes: Record<string, string> = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return classes[priority] || 'bg-muted';
  }

  async copyTestCase(tc: TestCase): Promise<void> {
    const text = this.formatTestCaseForCopy(tc);
    try {
      await navigator.clipboard.writeText(text);
      this.copiedId.set(tc.id);
      setTimeout(() => this.copiedId.set(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  private formatTestCaseForCopy(tc: TestCase): string {
    const lines: string[] = [
      `Test Case ID: ${tc.id}`,
      `Title: ${tc.title}`,
      `Type: ${this.getTestTypeLabel(tc.testType)}${tc.nfrCategory ? ` (${tc.nfrCategory})` : ''}`,
      `Priority: ${tc.priority}`,
      ``,
      `Description:`,
      tc.description,
      ``,
    ];

    if (tc.preconditions.length > 0) {
      lines.push(`Preconditions:`);
      tc.preconditions.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
      lines.push(``);
    }

    lines.push(`Steps:`);
    tc.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push(``);
    lines.push(`Expected Result:`);
    lines.push(tc.expectedResult);

    return lines.join('\n');
  }
}
