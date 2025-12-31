import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideHistory,
  lucideLoader2,
  lucideSparkles,
  lucideTrash2,
  lucidePlus,
  lucideRotateCw,
  lucideCheck,
  lucideFileText,
  lucideTestTube2,
  lucideClipboardList,
  lucideShield,
  lucideAccessibility,
  lucideBarChart,
  lucideZap,
  lucideGlobe,
  lucideAlertCircle,
  lucideUsers,
  lucideDatabase,
  lucideMonitor,
} from '@ng-icons/lucide';
import { TestScriptWriterService } from './test-script-writer.service';
import type { TestScriptWriterSession, StoryInput, ArtifactSummary } from './test-script-writer.types';
import { HlmButtonDirective } from '../../ui/button';

type SourceType = 'manual' | 'epic' | 'feature' | 'user_story';

@Component({
  selector: 'app-test-script-writer-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucidePlus,
      lucideRotateCw,
      lucideCheck,
      lucideFileText,
      lucideTestTube2,
      lucideClipboardList,
      lucideShield,
      lucideAccessibility,
      lucideBarChart,
      lucideZap,
      lucideGlobe,
      lucideAlertCircle,
      lucideUsers,
      lucideDatabase,
      lucideMonitor,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Test Script Writer</h1>
          <p class="mt-1 text-muted-foreground">
            Generate comprehensive test scripts from user stories with edge cases and negative testing.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Step 1: Story Source -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideFileText" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 1: Story Source</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Select stories from existing artifacts or enter manually
              </p>

              <!-- Source Type Tabs -->
              <div class="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                  [class.bg-primary]="sourceType() === 'manual'"
                  [class.text-primary-foreground]="sourceType() === 'manual'"
                  [class.bg-muted]="sourceType() !== 'manual'"
                  [class.hover:bg-muted/80]="sourceType() !== 'manual'"
                  (click)="setSourceType('manual')"
                >
                  Manual Entry
                </button>
                @if (service.epics().length > 0) {
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="sourceType() === 'epic'"
                    [class.text-primary-foreground]="sourceType() === 'epic'"
                    [class.bg-muted]="sourceType() !== 'epic'"
                    [class.hover:bg-muted/80]="sourceType() !== 'epic'"
                    (click)="setSourceType('epic')"
                  >
                    Epic
                  </button>
                }
                @if (service.features().length > 0) {
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="sourceType() === 'feature'"
                    [class.text-primary-foreground]="sourceType() === 'feature'"
                    [class.bg-muted]="sourceType() !== 'feature'"
                    [class.hover:bg-muted/80]="sourceType() !== 'feature'"
                    (click)="setSourceType('feature')"
                  >
                    Feature
                  </button>
                }
                @if (service.userStories().length > 0) {
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="sourceType() === 'user_story'"
                    [class.text-primary-foreground]="sourceType() === 'user_story'"
                    [class.bg-muted]="sourceType() !== 'user_story'"
                    [class.hover:bg-muted/80]="sourceType() !== 'user_story'"
                    (click)="setSourceType('user_story')"
                  >
                    User Story
                  </button>
                }
              </div>

              @if (sourceType() === 'manual') {
                <!-- Manual Story Entry -->
                <div class="space-y-3">
                  @for (story of manualStories(); track story.id) {
                    <div class="rounded-lg border bg-background p-3">
                      <div class="flex justify-between items-start mb-2">
                        <span class="text-xs text-muted-foreground">Story {{ $index + 1 }}</span>
                        @if (manualStories().length > 1) {
                          <button
                            type="button"
                            class="text-muted-foreground hover:text-destructive"
                            (click)="removeStory(story.id)"
                          >
                            <ng-icon name="lucideTrash2" class="h-4 w-4" />
                          </button>
                        }
                      </div>
                      <input
                        type="text"
                        class="w-full px-3 py-2 rounded-md border bg-background text-sm mb-2"
                        placeholder="Story title"
                        [value]="story.title"
                        (input)="updateStory(story.id, 'title', $event)"
                      />
                      <textarea
                        class="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none"
                        rows="2"
                        placeholder="As a [user], I want [feature] so that [benefit]"
                        [value]="story.description"
                        (input)="updateStory(story.id, 'description', $event)"
                      ></textarea>
                    </div>
                  }
                  <button
                    type="button"
                    hlmBtn
                    variant="outline"
                    size="sm"
                    class="w-full"
                    (click)="addStory()"
                  >
                    <ng-icon name="lucidePlus" class="h-4 w-4 mr-1" />
                    Add Another Story
                  </button>
                </div>
              } @else {
                <!-- Artifact Selection -->
                <div class="relative">
                  <button
                    type="button"
                    class="w-full flex items-center justify-between px-3 py-2 rounded-md border bg-background text-sm"
                    (click)="toggleArtifactDropdown()"
                  >
                    <span [class.text-muted-foreground]="!selectedArtifact()">
                      {{ selectedArtifact()?.title || 'Select an artifact...' }}
                    </span>
                    <ng-icon name="lucideChevronDown" class="h-4 w-4" />
                  </button>
                  @if (showArtifactDropdown()) {
                    <div class="absolute z-10 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
                      @for (artifact of availableArtifacts(); track artifact.id) {
                        <button
                          type="button"
                          class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                          (click)="selectArtifact(artifact)"
                        >
                          <span class="flex-1 truncate">{{ artifact.title }}</span>
                          @if (selectedArtifact()?.id === artifact.id) {
                            <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
                          }
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (loadingArtifact()) {
                  <div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                    Loading stories...
                  </div>
                }
                @if (selectedStories().length > 0) {
                  <div class="mt-2 text-sm text-muted-foreground">
                    {{ selectedStories().length }} stories found
                  </div>
                }
              }
            </div>

            <!-- Step 2: NFR Selection -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideClipboardList" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 2: Non-Functional Requirements (Optional)</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Select NFRs to include additional test scenarios
              </p>

              <div class="grid grid-cols-2 gap-2">
                @for (nfr of service.nfrOptions(); track nfr.value) {
                  <label
                    class="flex items-start gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                    [class.border-primary]="isNfrSelected(nfr.value)"
                    [class.bg-primary/5]="isNfrSelected(nfr.value)"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      [checked]="isNfrSelected(nfr.value)"
                      (change)="toggleNfr(nfr.value)"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <ng-icon [name]="getNfrIcon(nfr.value)" class="h-4 w-4 text-primary" />
                        <span class="text-sm font-medium">{{ nfr.label }}</span>
                      </div>
                      <p class="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {{ nfr.description }}
                      </p>
                    </div>
                  </label>
                }
              </div>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              hlmBtn
              class="w-full"
              [disabled]="!canSubmit() || service.loading()"
            >
              @if (service.loading()) {
                <ng-icon name="lucideLoader2" class="h-4 w-4 mr-2 animate-spin" />
                Generating...
              } @else {
                <ng-icon name="lucideTestTube2" class="h-4 w-4 mr-2" />
                Generate Test Scripts
              }
            </button>
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 bg-muted/30 p-6 overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">History</h2>
          </div>
          @if (service.sessions().length > 0) {
            <button
              type="button"
              hlmBtn
              variant="ghost"
              size="sm"
              (click)="refreshHistory()"
            >
              <ng-icon name="lucideRotateCw" class="h-4 w-4" />
            </button>
          }
        </div>

        @if (service.sessions().length === 0) {
          <div class="text-center py-12 text-muted-foreground">
            <ng-icon name="lucideTestTube2" class="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No test scripts generated yet</p>
            <p class="text-sm">Your history will appear here</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (session of service.sessions(); track session.id) {
              <div
                class="rounded-lg border bg-card p-4 cursor-pointer hover:border-primary transition-colors"
                (click)="viewSession(session)"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      @if (session.status === 'completed') {
                        <span class="flex h-2 w-2 rounded-full bg-green-500"></span>
                      } @else if (session.status === 'failed') {
                        <span class="flex h-2 w-2 rounded-full bg-destructive"></span>
                      } @else {
                        <ng-icon name="lucideLoader2" class="h-3 w-3 animate-spin text-muted-foreground" />
                      }
                      <span class="text-sm font-medium truncate">
                        {{ session.sourceTitle || (session.sourceType === 'manual' ? 'Manual Stories' : 'Unknown Source') }}
                      </span>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {{ session.stories.length }} stories
                      @if (session.selectedNfrs.length > 0) {
                        · {{ session.selectedNfrs.length }} NFRs
                      }
                    </p>
                    @if (session.status === 'completed') {
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ session.totalTestCases }} test cases generated
                      </p>
                    }
                    @if (session.status === 'failed') {
                      <p class="text-xs text-destructive mt-1">
                        {{ session.errorMessage || 'Generation failed' }}
                      </p>
                    }
                  </div>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive p-1"
                    (click)="deleteSession($event, session.id)"
                  >
                    <ng-icon name="lucideTrash2" class="h-4 w-4" />
                  </button>
                </div>
                <p class="text-xs text-muted-foreground mt-2">
                  {{ formatDate(session.createdAt) }}
                </p>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class TestScriptWriterInputComponent implements OnInit {
  service = inject(TestScriptWriterService);
  private router = inject(Router);

  // State
  sourceType = signal<SourceType>('manual');
  manualStories = signal<StoryInput[]>([{ id: '1', title: '', description: '' }]);
  selectedArtifact = signal<ArtifactSummary | null>(null);
  selectedStories = signal<StoryInput[]>([]);
  selectedNfrs = signal<string[]>([]);
  showArtifactDropdown = signal(false);
  loadingArtifact = signal(false);

  availableArtifacts = computed(() => {
    switch (this.sourceType()) {
      case 'epic':
        return this.service.epics();
      case 'feature':
        return this.service.features();
      case 'user_story':
        return this.service.userStories();
      default:
        return [];
    }
  });

  canSubmit = computed(() => {
    if (this.sourceType() === 'manual') {
      return this.manualStories().some(s => s.title.trim() || s.description.trim());
    }
    return this.selectedStories().length > 0;
  });

  ngOnInit(): void {
    Promise.all([
      this.service.loadSourceTypes(),
      this.service.loadNfrOptions(),
      this.service.loadEpics(),
      this.service.loadFeatures(),
      this.service.loadUserStories(),
      this.service.loadSessions(true),
    ]);
  }

  setSourceType(type: SourceType): void {
    this.sourceType.set(type);
    this.selectedArtifact.set(null);
    this.selectedStories.set([]);
    this.showArtifactDropdown.set(false);
  }

  toggleArtifactDropdown(): void {
    this.showArtifactDropdown.update(v => !v);
  }

  async selectArtifact(artifact: ArtifactSummary): Promise<void> {
    this.selectedArtifact.set(artifact);
    this.showArtifactDropdown.set(false);
    this.loadingArtifact.set(true);

    const details = await this.service.loadArtifactDetails(artifact.id);
    if (details) {
      this.selectedStories.set(details.stories);
    }
    this.loadingArtifact.set(false);
  }

  addStory(): void {
    const newId = String(Date.now());
    this.manualStories.update(stories => [...stories, { id: newId, title: '', description: '' }]);
  }

  removeStory(id: string): void {
    this.manualStories.update(stories => stories.filter(s => s.id !== id));
  }

  updateStory(id: string, field: 'title' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.manualStories.update(stories =>
      stories.map(s => s.id === id ? { ...s, [field]: value } : s)
    );
  }

  isNfrSelected(value: string): boolean {
    return this.selectedNfrs().includes(value);
  }

  toggleNfr(value: string): void {
    this.selectedNfrs.update(nfrs =>
      nfrs.includes(value)
        ? nfrs.filter(n => n !== value)
        : [...nfrs, value]
    );
  }

  getNfrIcon(value: string): string {
    const icons: Record<string, string> = {
      accessibility: 'lucideAccessibility',
      security: 'lucideShield',
      analytics: 'lucideBarChart',
      performance: 'lucideZap',
      localization: 'lucideGlobe',
      error_handling: 'lucideAlertCircle',
      usability: 'lucideUsers',
      data_integrity: 'lucideDatabase',
      compatibility: 'lucideMonitor',
    };
    return icons[value] || 'lucideCheck';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const stories = this.sourceType() === 'manual'
      ? this.manualStories().filter(s => s.title.trim() || s.description.trim())
      : this.selectedStories();

    const session = await this.service.createSession({
      sourceType: this.sourceType(),
      sourceId: this.selectedArtifact()?.id,
      sourceTitle: this.selectedArtifact()?.title || (this.sourceType() === 'manual' ? 'Manual Stories' : undefined),
      stories,
      selectedNfrs: this.selectedNfrs(),
    });

    if (session) {
      this.router.navigate(['/test-script-writer', 'results', session.id]);
    }
  }

  viewSession(session: TestScriptWriterSession): void {
    this.router.navigate(['/test-script-writer', 'results', session.id]);
  }

  async deleteSession(event: Event, id: number): Promise<void> {
    event.stopPropagation();
    if (confirm('Delete this session?')) {
      await this.service.deleteSession(id);
    }
  }

  async refreshHistory(): Promise<void> {
    await this.service.loadSessions(true);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
