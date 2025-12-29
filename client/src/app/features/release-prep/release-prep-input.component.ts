/**
 * Release Prep Input Component
 *
 * Split view with input form on left, session history on right.
 * Follows the Ideation/Feasibility pattern.
 */
import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileText,
  lucideCheck,
  lucidePlus,
  lucideTrash2,
  lucidePlay,
  lucideChevronDown,
  lucideChevronUp,
  lucideAlertCircle,
  lucideBookOpen,
  lucidePackage,
  lucideDatabase,
  lucideSearch,
  lucideHistory,
  lucideChevronRight,
  lucideLoader2,
  lucideRotateCw,
  lucideEye,
  lucideX,
} from '@ng-icons/lucide';

import { ReleasePrepService } from './release-prep.service';
import type { AvailableStory, ManualStory, ReleasePrepSession } from './release-prep.types';

@Component({
  selector: 'app-release-prep-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideFileText,
      lucideCheck,
      lucidePlus,
      lucideTrash2,
      lucidePlay,
      lucideChevronDown,
      lucideChevronUp,
      lucideAlertCircle,
      lucideBookOpen,
      lucidePackage,
      lucideDatabase,
      lucideSearch,
      lucideHistory,
      lucideChevronRight,
      lucideLoader2,
      lucideRotateCw,
      lucideEye,
      lucideX,
    }),
  ],
  template: `
    <div class="flex min-h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Release Prep Agent</h1>
          <p class="mt-1 text-muted-foreground">
            Generate release notes, decision logs, and technical debt inventory from your user stories.
          </p>

          <form class="mt-6 space-y-6" [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Release Name -->
            <div>
              <label class="text-sm font-medium">
                <ng-icon name="lucidePackage" class="inline h-4 w-4 mr-1" />
                Release Name
              </label>
              <input
                type="text"
                formControlName="releaseName"
                placeholder="e.g., Q1 2025 Release, v2.4.0, Sprint 12"
                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <!-- Story Selection -->
            <div>
              <label class="text-sm font-medium">
                <ng-icon name="lucideBookOpen" class="inline h-4 w-4 mr-1" />
                Select Stories <span class="text-destructive">*</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Choose completed epics, features, or stories to include
              </p>

              @if (loading()) {
                <div class="mt-2 text-center py-6 text-muted-foreground border rounded-lg">
                  <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading stories...
                </div>
              } @else if (availableStories().length === 0) {
                <div class="mt-2 text-center py-6 bg-muted/30 rounded-lg">
                  <ng-icon name="lucideAlertCircle" class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground">No stories available for release.</p>
                  <p class="text-xs text-muted-foreground">Create stories first, or previously released stories are filtered out.</p>
                </div>
              } @else {
                <!-- Selected stories chips -->
                @if (selectedStoryIds().length > 0) {
                  <div class="mt-2 flex flex-wrap gap-2">
                    @for (storyId of selectedStoryIds(); track storyId) {
                      @if (getStoryById(storyId); as story) {
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                          {{ story.title }}
                          <button
                            type="button"
                            (click)="toggleStory(storyId)"
                            class="hover:text-primary/70"
                          >
                            <ng-icon name="lucideX" class="h-3 w-3" />
                          </button>
                        </span>
                      }
                    }
                  </div>
                }

                <!-- Search input (autosuggest style) -->
                <div class="mt-2 relative">
                  <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search to add stories..."
                    class="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    [value]="storySearchFilter()"
                    (input)="onStorySearchInput($event)"
                    (focus)="storyDropdownFocused.set(true)"
                    (blur)="onStoryInputBlur()"
                  />

                  <!-- Dropdown suggestions (only show when searching) -->
                  @if (storySearchFilter() && storyDropdownFocused()) {
                    <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-popover shadow-lg max-h-64 overflow-y-auto">
                      @if (filteredStories().length === 0) {
                        <div class="p-3 text-center text-sm text-muted-foreground">
                          No matching stories
                        </div>
                      } @else {
                        @for (story of filteredStories(); track story.id) {
                          <button
                            type="button"
                            class="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                            [class.bg-primary/10]="isStorySelected(story.id)"
                            (mousedown)="toggleStory(story.id); $event.preventDefault()"
                          >
                            <div
                              class="mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                              [class.bg-primary]="isStorySelected(story.id)"
                              [class.border-primary]="isStorySelected(story.id)"
                            >
                              @if (isStorySelected(story.id)) {
                                <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                              }
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-medium text-sm">{{ story.title }}</span>
                                <span
                                  class="px-2 py-0.5 text-xs rounded-full"
                                  [class.bg-purple-100]="story.type === 'epic'"
                                  [class.text-purple-700]="story.type === 'epic'"
                                  [class.bg-blue-100]="story.type === 'feature'"
                                  [class.text-blue-700]="story.type === 'feature'"
                                  [class.bg-green-100]="story.type === 'user_story'"
                                  [class.text-green-700]="story.type === 'user_story'"
                                >
                                  {{ story.type === 'user_story' ? 'Story' : story.type | titlecase }}
                                </span>
                              </div>
                              <p class="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {{ story.preview }}
                              </p>
                            </div>
                          </button>
                        }
                      }
                    </div>
                  }
                </div>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ selectedStoryIds().length }} of {{ availableStories().length }} stories selected
                </p>
              }
            </div>

            <!-- Knowledge Base Selection -->
            <div>
              <label class="text-sm font-medium">
                <ng-icon name="lucideDatabase" class="inline h-4 w-4 mr-1" />
                Knowledge Bases <span class="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <p class="text-xs text-muted-foreground mt-1">
                Add context from your documents
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
                    <div class="p-2 border-b sticky top-0 bg-popover z-10">
                      <div class="relative">
                        <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Filter..."
                          class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          [value]="kbSearchFilter()"
                          (input)="onKbSearchInput($event)"
                          (click)="$event.stopPropagation()"
                        />
                      </div>
                    </div>
                    <div class="p-1">
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

            <!-- Manual Stories (Collapsible) -->
            <div>
              <button
                type="button"
                class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                (click)="showManualStories.set(!showManualStories())"
              >
                <ng-icon
                  name="lucideChevronDown"
                  class="h-4 w-4 transition-transform"
                  [class.rotate-180]="!showManualStories()"
                />
                Add Manual Stories ({{ manualStories.length }})
              </button>

              @if (showManualStories()) {
                <div class="mt-3 space-y-3">
                  @for (story of manualStories.controls; track $index; let i = $index) {
                    <div class="border rounded-lg p-3 bg-muted/20">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-muted-foreground">Story {{ i + 1 }}</span>
                        <button
                          type="button"
                          (click)="removeManualStory(i)"
                          class="text-destructive hover:text-destructive/80"
                        >
                          <ng-icon name="lucideTrash2" class="h-4 w-4" />
                        </button>
                      </div>
                      <div [formGroupName]="i" class="space-y-2">
                        <input
                          type="text"
                          formControlName="title"
                          placeholder="Title"
                          class="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        />
                        <textarea
                          formControlName="content"
                          rows="2"
                          placeholder="Story content..."
                          class="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        ></textarea>
                      </div>
                    </div>
                  }
                  <button
                    type="button"
                    (click)="addManualStory()"
                    class="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                  >
                    <ng-icon name="lucidePlus" class="h-4 w-4" />
                    Add Manual Story
                  </button>
                </div>
              }
            </div>

            <!-- Submit -->
            <button
              type="submit"
              [disabled]="submitting() || totalStories() === 0"
              class="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              @if (submitting()) {
                <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin" />
                Creating...
              } @else {
                <ng-icon name="lucidePlay" class="h-5 w-5" />
                Generate Release Artifacts
              }
            </button>
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30 min-h-full">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Release Prep History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past release prep sessions
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1">
          @if (service.loading() && service.sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3]; track i) {
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
                  Your release prep sessions will appear here.
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
                          [class.bg-yellow-100]="isProcessing(session.status)"
                          [class.text-yellow-700]="isProcessing(session.status)"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-slate-100]="session.status === 'draft'"
                          [class.text-slate-700]="session.status === 'draft'"
                        >
                          {{ getStatusLabel(session.status) }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-foreground">
                        {{ session.releaseName }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ session.totalStoriesProcessed }} stories
                        @if (session.status === 'completed') {
                          · {{ session.totalReleaseNotes }} notes · {{ session.totalDecisions }} decisions
                        }
                      </p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed' || session.status === 'draft') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry"
                        >
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
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
      min-height: 100%;
    }
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class ReleasePrepInputComponent implements OnInit {
  service = inject(ReleasePrepService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly showManualStories = signal(false);
  readonly availableStories = this.service.availableStories;
  readonly selectedStoryIds = signal<number[]>([]);

  // Story search/autosuggest
  readonly storySearchFilter = signal('');
  readonly storyDropdownFocused = signal(false);
  readonly filteredStories = computed(() => {
    const filter = this.storySearchFilter().toLowerCase();
    const stories = this.availableStories();
    if (!filter) return stories;
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(filter) ||
        s.preview.toLowerCase().includes(filter)
    );
  });

  // Knowledge base state
  readonly selectedKbIds = signal<number[]>([]);
  readonly kbDropdownOpen = signal(false);
  readonly kbSearchFilter = signal('');

  readonly selectedKnowledgeBases = computed(() => {
    const ids = this.selectedKbIds();
    return this.service.knowledgeBases().filter((kb) => ids.includes(kb.id));
  });

  readonly filteredKnowledgeBases = computed(() => {
    const filter = this.kbSearchFilter().toLowerCase();
    if (!filter) return this.service.knowledgeBases();
    return this.service.knowledgeBases().filter((kb) =>
      kb.name.toLowerCase().includes(filter)
    );
  });

  form = this.fb.group({
    releaseName: [''],
    manualStories: this.fb.array([]),
  });

  get manualStories() {
    return this.form.get('manualStories') as FormArray;
  }

  readonly totalStories = computed(
    () => this.selectedStoryIds().length + this.manualStories.length
  );

  ngOnInit(): void {
    this.loadAvailableStories();
    this.loadKnowledgeBases();
    this.loadSessions();
  }

  loadAvailableStories(): void {
    this.loading.set(true);
    this.service.loadAvailableStories().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  loadKnowledgeBases(): void {
    this.service.loadKnowledgeBases().subscribe();
  }

  loadSessions(): void {
    this.service.loadSessions().subscribe();
  }

  // Story selection
  isStorySelected(storyId: number): boolean {
    return this.selectedStoryIds().includes(storyId);
  }

  toggleStory(storyId: number): void {
    this.selectedStoryIds.update((ids) =>
      ids.includes(storyId)
        ? ids.filter((id) => id !== storyId)
        : [...ids, storyId]
    );
  }

  onStorySearchInput(event: Event): void {
    this.storySearchFilter.set((event.target as HTMLInputElement).value);
  }

  onStoryInputBlur(): void {
    // Delay to allow click on dropdown item
    setTimeout(() => this.storyDropdownFocused.set(false), 200);
  }

  getStoryById(id: number): AvailableStory | undefined {
    return this.availableStories().find((s) => s.id === id);
  }

  // Knowledge base methods
  toggleKbDropdown(): void {
    this.kbDropdownOpen.update((v) => !v);
  }

  closeKbDropdown(): void {
    this.kbDropdownOpen.set(false);
  }

  onKbSearchInput(event: Event): void {
    this.kbSearchFilter.set((event.target as HTMLInputElement).value);
  }

  toggleKnowledgeBase(id: number): void {
    this.selectedKbIds.update((ids) =>
      ids.includes(id) ? ids.filter((kbId) => kbId !== id) : [...ids, id]
    );
  }

  // Manual stories
  addManualStory(): void {
    const storyGroup = this.fb.group({
      title: ['', Validators.required],
      content: ['', Validators.required],
      storyType: ['user_story'],
    });
    this.manualStories.push(storyGroup);
  }

  removeManualStory(index: number): void {
    this.manualStories.removeAt(index);
  }

  // Form submission
  onSubmit(): void {
    if (this.totalStories() === 0) return;

    this.submitting.set(true);

    const formValue = this.form.value;
    const manualStories: ManualStory[] = (formValue.manualStories || []).map(
      (s: any) => ({
        title: s.title,
        content: s.content,
        storyType: s.storyType,
      })
    );

    this.service
      .createSession({
        releaseName: formValue.releaseName || `Release ${new Date().toLocaleDateString()}`,
        storyArtifactIds: this.selectedStoryIds(),
        manualStories,
        knowledgeBaseIds: this.selectedKbIds().length > 0 ? this.selectedKbIds() : undefined,
      })
      .subscribe({
        next: (session) => {
          this.service.runPipeline(session.id).subscribe({
            next: () => {
              this.router.navigate(['/release-prep', session.id, 'processing']);
            },
            error: (err) => {
              console.error('Failed to start pipeline:', err);
              this.submitting.set(false);
            },
          });
        },
        error: (err) => {
          console.error('Failed to create session:', err);
          this.submitting.set(false);
        },
      });
  }

  // History methods
  viewSession(session: ReleasePrepSession): void {
    if (session.status === 'completed') {
      this.router.navigate(['/release-prep', session.id, 'results']);
    } else if (this.isProcessing(session.status)) {
      this.router.navigate(['/release-prep', session.id, 'processing']);
    }
  }

  retrySession(event: Event, session: ReleasePrepSession): void {
    event.stopPropagation();
    this.service.runPipeline(session.id).subscribe({
      next: () => {
        this.router.navigate(['/release-prep', session.id, 'processing']);
      },
      error: (err) => console.error('Failed to retry:', err),
    });
  }

  deleteSession(event: Event, session: ReleasePrepSession): void {
    event.stopPropagation();
    if (confirm('Delete this release prep session?')) {
      this.service.deleteSession(session.id).subscribe();
    }
  }

  isProcessing(status: string): boolean {
    return ['processing', 'extracting', 'generating_notes', 'generating_decisions', 'generating_debt', 'validating'].includes(status);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      processing: 'Processing',
      extracting: 'Extracting',
      generating_notes: 'Generating',
      generating_decisions: 'Generating',
      generating_debt: 'Generating',
      validating: 'Validating',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
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
