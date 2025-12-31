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
  lucideUpload,
  lucideImage,
  lucideX,
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
      lucideUpload,
      lucideImage,
      lucideX,
    }),
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
  `,
  template: `
    <div class="flex flex-1 min-h-0 overflow-hidden">
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

          <form class="mt-6 space-y-6 pb-6" (submit)="onSubmit($event)">
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
                <h2 class="font-semibold">Step 2: NFRs (Optional)</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Include non-functional requirement test scenarios
              </p>

              <div class="flex flex-wrap gap-2">
                @for (nfr of service.nfrOptions(); track nfr.value) {
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    [class.bg-primary]="isNfrSelected(nfr.value)"
                    [class.text-primary-foreground]="isNfrSelected(nfr.value)"
                    [class.bg-muted]="!isNfrSelected(nfr.value)"
                    [class.hover:bg-muted/80]="!isNfrSelected(nfr.value)"
                    (click)="toggleNfr(nfr.value)"
                  >
                    {{ nfr.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Step 3: UX Screenshots (Optional) -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideImage" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 3: UX Screenshots (Optional)</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Upload UI mockups to generate more accurate test scenarios
              </p>

              <!-- Upload Area -->
              <div
                class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors"
                [class.border-primary]="isDragging()"
                [class.bg-muted/50]="isDragging()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
              >
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  class="absolute inset-0 opacity-0 cursor-pointer"
                  (change)="onFileSelect($event)"
                />
                <ng-icon name="lucideUpload" class="mx-auto h-6 w-6 text-muted-foreground" />
                <p class="mt-1 text-xs text-muted-foreground">
                  Drag & drop or click to upload images
                </p>
              </div>

              <!-- Selected Files -->
              @if (selectedFiles().length > 0) {
                <div class="mt-3 space-y-2">
                  @for (file of selectedFiles(); track file.name) {
                    <div class="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <div class="flex items-center gap-2">
                        <ng-icon name="lucideImage" class="h-4 w-4 text-muted-foreground" />
                        <span class="text-sm truncate max-w-[200px]">{{ file.name }}</span>
                        <span class="text-xs text-muted-foreground">
                          ({{ formatFileSize(file.size) }})
                        </span>
                      </div>
                      <button
                        type="button"
                        class="text-muted-foreground hover:text-destructive"
                        (click)="removeFile(file)"
                      >
                        <ng-icon name="lucideX" class="h-4 w-4" />
                      </button>
                    </div>
                  }
                </div>
              }
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
      <div class="w-1/2 flex flex-col bg-muted/30">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Test Script History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your generated test scripts
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto">
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
                <ng-icon name="lucideTestTube2" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your generated test scripts will appear here.
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
                          [class.bg-yellow-100]="session.status === 'generating'"
                          [class.text-yellow-700]="session.status === 'generating'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-gray-100]="session.status === 'pending'"
                          [class.text-gray-700]="session.status === 'pending'"
                        >
                          {{ session.status === 'completed' ? 'Complete' : session.status === 'generating' ? 'Generating' : session.status === 'failed' ? 'Failed' : 'Pending' }}
                        </span>
                      </div>
                      <h3 class="mt-2 font-medium text-sm truncate">
                        {{ session.sourceTitle || (session.sourceType === 'manual' ? 'Manual Stories' : 'Unknown Source') }}
                      </h3>
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ session.stories.length }} {{ session.stories.length === 1 ? 'story' : 'stories' }}
                        @if (session.selectedNfrs.length > 0) {
                          · {{ session.selectedNfrs.length }} NFRs
                        }
                        @if (session.status === 'completed') {
                          · {{ session.totalTestCases }} test cases
                        }
                      </p>
                      @if (session.status === 'failed' && session.errorMessage) {
                        <p class="text-xs text-destructive mt-1 truncate">
                          {{ session.errorMessage }}
                        </p>
                      }
                      <p class="text-xs text-muted-foreground mt-2">
                        {{ formatDate(session.createdAt) }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                      (click)="deleteSession($event, session.id)"
                    >
                      <ng-icon name="lucideTrash2" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
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
  selectedFiles = signal<File[]>([]);
  isDragging = signal(false);

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

  // File handling
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const files = Array.from(event.dataTransfer?.files || []);
    this.addFiles(files);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.addFiles(files);
    input.value = '';
  }

  private addFiles(files: File[]): void {
    const validFiles = files.filter((file) => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      return validTypes.includes(file.type) && file.size <= 20 * 1024 * 1024;
    });
    this.selectedFiles.update((current) => [...current, ...validFiles]);
  }

  removeFile(file: File): void {
    this.selectedFiles.update((files) => files.filter((f) => f !== file));
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const stories = this.sourceType() === 'manual'
      ? this.manualStories().filter(s => s.title.trim() || s.description.trim())
      : this.selectedStories();

    const session = await this.service.createSession(
      {
        sourceType: this.sourceType(),
        sourceId: this.selectedArtifact()?.id,
        sourceTitle: this.selectedArtifact()?.title || (this.sourceType() === 'manual' ? 'Manual Stories' : undefined),
        stories,
        selectedNfrs: this.selectedNfrs(),
      },
      this.selectedFiles()
    );

    if (session) {
      this.router.navigate(['/testing/test-script-writer', 'results', session.id]);
    }
  }

  viewSession(session: TestScriptWriterSession): void {
    this.router.navigate(['/testing/test-script-writer', 'results', session.id]);
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
