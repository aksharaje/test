import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSparkles,
  lucideLoader2,
  lucideUpload,
  lucideX,
  lucideChevronDown,
  lucideDatabase,
  lucideFile,
  lucideImage,
  lucideHistory,
  lucideChevronRight,
  lucideTrash2,
  lucideSearch,
  lucideCheck,
} from '@ng-icons/lucide';
import { StoryGeneratorService } from './story-generator.service';
import type { ArtifactType, InputConfig, GeneratedArtifact } from './story-generator.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-story-generator',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideSparkles,
      lucideLoader2,
      lucideUpload,
      lucideX,
      lucideChevronDown,
      lucideDatabase,
      lucideFile,
      lucideImage,
      lucideHistory,
      lucideChevronRight,
      lucideTrash2,
      lucideSearch,
      lucideCheck,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Epic/Feature/Story Creator</h1>
          <p class="mt-1 text-muted-foreground">
            Generate professional product documentation using AI.
          </p>

          <!-- Artifact Type Selector -->
          <div class="mt-6">
            <label class="text-sm font-medium">What do you want to create?</label>
            <div class="mt-2 grid grid-cols-3 gap-2">
              @for (option of typeOptions; track option.value) {
                <button
                  type="button"
                  class="rounded-lg border p-3 text-center transition-colors"
                  [class.border-primary]="selectedType() === option.value"
                  [class.bg-primary/5]="selectedType() === option.value"
                  [class.border-border]="selectedType() !== option.value"
                  (click)="selectType(option.value)"
                >
                  <span class="font-medium">{{ option.label }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Title Input (Required) -->
          <div class="mt-6">
            <label class="text-sm font-medium">
              Title <span class="text-destructive">*</span>
            </label>
            <input
              type="text"
              class="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., User Authentication System, Shopping Cart Feature"
              [value]="title()"
              (input)="onTitleInput($event)"
            />
          </div>

          <!-- Dynamic Description Input -->
          <div class="mt-6">
            <label class="text-sm font-medium">{{ inputConfig().label }}</label>
            <textarea
              class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
              [placeholder]="inputConfig().placeholder"
              [value]="description()"
              (input)="onDescriptionInput($event)"
            ></textarea>
          </div>

          <!-- Knowledge Base Selection -->
          <div class="mt-6">
            <label class="text-sm font-medium">
              <ng-icon name="lucideDatabase" class="inline h-4 w-4 mr-1" />
              Knowledge Bases (optional)
            </label>
            <p class="text-xs text-muted-foreground mt-1">
              Select knowledge bases to provide context for generation
            </p>

            <!-- Dropdown trigger -->
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

              <!-- Dropdown panel -->
              @if (kbDropdownOpen()) {
                <!-- Backdrop to close on outside click -->
                <div
                  class="fixed inset-0 z-40"
                  (click)="closeKbDropdown()"
                ></div>

                <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg">
                  <!-- Search input -->
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

                  <!-- Options list -->
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
                    } @empty {
                      <p class="px-2 py-4 text-sm text-muted-foreground text-center">
                        @if (kbSearchFilter()) {
                          No knowledge bases match "{{ kbSearchFilter() }}"
                        } @else {
                          No knowledge bases available
                        }
                      </p>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Selected tags -->
            @if (selectedKbIds().length > 0) {
              <div class="flex flex-wrap gap-1 mt-2">
                @for (kb of selectedKnowledgeBases(); track kb.id) {
                  <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {{ kb.name }}
                    <button
                      type="button"
                      class="hover:text-primary/70"
                      (click)="toggleKnowledgeBase(kb.id)"
                    >
                      <ng-icon name="lucideX" class="h-3 w-3" />
                    </button>
                  </span>
                }
              </div>
            }
          </div>

          <!-- File Upload -->
          <div class="mt-6">
            <label class="text-sm font-medium">
              <ng-icon name="lucideUpload" class="inline h-4 w-4 mr-1" />
              Attachments (optional)
            </label>
            <p class="text-xs text-muted-foreground mt-1">
              Upload images (Figma screenshots, wireframes) or documents for context
            </p>
            <div
              class="mt-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:border-primary hover:bg-muted/50 cursor-pointer relative"
              [class.border-primary]="isDragging()"
              [class.bg-muted/50]="isDragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx,.txt,.md"
                class="absolute inset-0 opacity-0 cursor-pointer"
                (change)="onFileSelect($event)"
              />
              <ng-icon name="lucideUpload" class="mx-auto h-8 w-8 text-muted-foreground" />
              <p class="mt-2 text-sm text-muted-foreground">
                Drag & drop or click to upload
              </p>
              <p class="text-xs text-muted-foreground">
                JPG, PNG, PDF, Word, Markdown (max 20MB each)
              </p>
            </div>

            <!-- Selected Files -->
            @if (selectedFiles().length > 0) {
              <div class="mt-3 space-y-2">
                @for (file of selectedFiles(); track file.name) {
                  <div class="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div class="flex items-center gap-2">
                      <ng-icon
                        [name]="file.type.startsWith('image/') ? 'lucideImage' : 'lucideFile'"
                        class="h-4 w-4 text-muted-foreground"
                      />
                      <span class="text-sm">{{ file.name }}</span>
                      <span class="text-xs text-muted-foreground">
                        ({{ formatFileSize(file.size) }})
                      </span>
                    </div>
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground"
                      (click)="removeFile(file)"
                    >
                      <ng-icon name="lucideX" class="h-4 w-4" />
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Generate Button -->
          <div class="mt-8">
            <button
              hlmBtn
              class="w-full"
              type="button"
              [disabled]="!canGenerate() || service.generating()"
              (click)="generate()"
            >
              @if (service.generating()) {
                <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                Generating...
              } @else {
                <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                Generate {{ typeLabels[selectedType()] }}
              }
            </button>
          </div>

          <!-- Error Display -->
          @if (service.error()) {
            <div class="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive text-sm">
              {{ service.error() }}
            </div>
          }
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Generation History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past generations
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto">
          @if (service.loading()) {
            <div class="p-6">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="h-4 bg-muted rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (service.artifacts().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your generated epics, features, and stories will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (artifact of service.artifacts(); track artifact.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewArtifact(artifact)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-purple-100]="artifact.type === 'epic'"
                          [class.text-purple-700]="artifact.type === 'epic'"
                          [class.bg-blue-100]="artifact.type === 'feature'"
                          [class.text-blue-700]="artifact.type === 'feature'"
                          [class.bg-green-100]="artifact.type === 'user_story'"
                          [class.text-green-700]="artifact.type === 'user_story'"
                        >
                          {{ typeLabels[artifact.type] }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(artifact.createdAt) }}
                        </span>
                      </div>
                      <h3 class="mt-1 font-medium text-foreground truncate">
                        {{ artifact.title }}
                      </h3>
                      <p class="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {{ artifact.inputDescription }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        (click)="deleteArtifact($event, artifact)"
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
export class StoryGeneratorComponent implements OnInit {
  private router = inject(Router);
  protected service = inject(StoryGeneratorService);

  // Type options
  protected typeOptions = [
    { value: 'epic' as ArtifactType, label: 'Epic' },
    { value: 'feature' as ArtifactType, label: 'Feature' },
    { value: 'user_story' as ArtifactType, label: 'User Story' },
  ];

  protected typeLabels: Record<ArtifactType, string> = {
    epic: 'Epic',
    feature: 'Feature',
    user_story: 'User Story',
  };

  // State
  protected selectedType = signal<ArtifactType>('feature');
  protected title = signal('');
  protected description = signal('');
  protected selectedFiles = signal<File[]>([]);
  protected selectedKbIds = signal<number[]>([]);
  protected isDragging = signal(false);
  protected kbDropdownOpen = signal(false);
  protected kbSearchFilter = signal('');

  // Input config based on type
  protected inputConfig = signal<InputConfig>({
    label: 'Describe the features you need',
    placeholder: 'What capabilities do you need to add? What should users be able to do?',
  });

  // Computed
  protected canGenerate = computed(() => {
    return this.title().trim().length > 0 && this.description().trim().length > 0;
  });

  protected filteredKnowledgeBases = computed(() => {
    const filter = this.kbSearchFilter().toLowerCase().trim();
    const kbs = this.service.knowledgeBases();
    if (!filter) return kbs;
    return kbs.filter(kb => kb.name.toLowerCase().includes(filter));
  });

  protected selectedKnowledgeBases = computed(() => {
    const selectedIds = this.selectedKbIds();
    return this.service.knowledgeBases().filter(kb => selectedIds.includes(kb.id));
  });

  ngOnInit(): void {
    this.service.loadKnowledgeBases();
    this.service.loadArtifacts();
    this.updateInputConfig();
  }

  protected async selectType(type: ArtifactType): Promise<void> {
    this.selectedType.set(type);
    await this.updateInputConfig();
  }

  private async updateInputConfig(): Promise<void> {
    const config = await this.service.getInputConfig(this.selectedType());
    this.inputConfig.set(config);
  }

  protected onTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.title.set(input.value);
  }

  protected onDescriptionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.description.set(textarea.value);
  }

  protected toggleKnowledgeBase(id: number): void {
    this.selectedKbIds.update((ids) => {
      if (ids.includes(id)) {
        return ids.filter((i) => i !== id);
      } else {
        return [...ids, id];
      }
    });
  }

  protected toggleKbDropdown(): void {
    this.kbDropdownOpen.update(v => !v);
    if (!this.kbDropdownOpen()) {
      this.kbSearchFilter.set('');
    }
  }

  protected closeKbDropdown(): void {
    this.kbDropdownOpen.set(false);
    this.kbSearchFilter.set('');
  }

  protected onKbSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.kbSearchFilter.set(input.value);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    const files = Array.from(event.dataTransfer?.files || []);
    this.addFiles(files);
  }

  protected onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.addFiles(files);
    input.value = '';
  }

  private addFiles(files: File[]): void {
    const validFiles = files.filter((file) => {
      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
      ];
      return validTypes.includes(file.type) && file.size <= 20 * 1024 * 1024;
    });

    this.selectedFiles.update((current) => [...current, ...validFiles]);
  }

  protected removeFile(file: File): void {
    this.selectedFiles.update((files) => files.filter((f) => f !== file));
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  protected async generate(): Promise<void> {
    const artifact = await this.service.generate(
      this.selectedType(),
      this.title(),
      this.description(),
      this.selectedFiles(),
      this.selectedKbIds()
    );

    if (artifact && artifact.id) {
      // Clear form after successful generation
      this.title.set('');
      this.description.set('');
      this.selectedFiles.set([]);
      this.selectedKbIds.set([]);

      // Navigate to the output page
      await this.router.navigate(['/story-generator/output', artifact.id]);
    }
  }

  protected viewArtifact(artifact: GeneratedArtifact): void {
    this.router.navigate(['/story-generator/output', artifact.id]);
  }

  protected async deleteArtifact(event: Event, artifact: GeneratedArtifact): Promise<void> {
    event.stopPropagation();
    if (confirm(`Delete "${artifact.title}"? This cannot be undone.`)) {
      await this.service.deleteArtifact(artifact.id);
    }
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
