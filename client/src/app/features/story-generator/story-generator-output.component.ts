import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideClipboard,
  lucideCheck,
  lucideRefreshCw,
  lucidePencil,
  lucideArrowLeft,
  lucideDownload,
  lucideSparkles,
  lucideLoader2,
} from '@ng-icons/lucide';
import { StoryGeneratorService } from './story-generator.service';
import { FormsModule } from '@angular/forms';
import type {
  GeneratedArtifact,
  StructuredContent,
  EpicNode,
  FeatureNode,
  StoryNode,
} from './story-generator.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-story-generator-output',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmButtonDirective, RouterLink, FormsModule],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideClipboard,
      lucideCheck,
      lucideRefreshCw,
      lucidePencil,
      lucideArrowLeft,
      lucideDownload,
      lucideSparkles,
      lucideLoader2,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Header -->
      <header class="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="flex h-14 items-center justify-between px-6">
          <div class="flex items-center gap-4">
            <a
              routerLink="/story-generator"
              class="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
              Back to Generator
            </a>
            @if (artifact()) {
              <span class="text-muted-foreground">|</span>
              <span class="font-medium">{{ artifact()!.title }}</span>
            }
          </div>
          <div class="flex items-center gap-2">
            <button
              hlmBtn
              variant="outline"
              size="sm"
              type="button"
              (click)="copyAll()"
            >
              <ng-icon
                [name]="copiedAll() ? 'lucideCheck' : 'lucideClipboard'"
                class="mr-1.5 h-4 w-4"
              />
              {{ copiedAll() ? 'Copied!' : 'Copy All' }}
            </button>
            <div class="relative">
              <button
                hlmBtn
                variant="outline"
                size="sm"
                type="button"
                (click)="toggleExportMenu()"
              >
                <ng-icon name="lucideDownload" class="mr-1.5 h-4 w-4" />
                Export
                <ng-icon name="lucideChevronDown" class="ml-1 h-3 w-3" />
              </button>
              @if (showExportMenu()) {
                <div class="absolute right-0 top-full mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                  <button
                    class="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
                    (click)="exportAs('markdown')"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    class="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
                    (click)="exportAs('json')"
                  >
                    JSON
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="mx-auto max-w-4xl px-6 py-8">
        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        } @else if (artifact() && structured()) {
          <div class="space-y-4">
            <!-- Epic -->
            @if (structured()!.epic) {
              <div class="rounded-lg border bg-card shadow-sm">
                <div class="border-l-4 border-l-primary rounded-l-lg p-4">
                  <!-- Epic Header -->
                  <button
                    class="flex items-center gap-2 w-full text-left font-bold text-lg hover:text-primary transition-colors"
                    (click)="toggleItem('epic')"
                  >
                    <ng-icon
                      [name]="isExpanded('epic') ? 'lucideChevronDown' : 'lucideChevronRight'"
                      class="h-5 w-5 flex-shrink-0"
                    />
                    <span class="text-primary/70 font-normal text-sm mr-2">EPIC</span>
                    {{ structured()!.epic!.title }}
                  </button>

                  <!-- Epic Content (collapsible) -->
                  @if (isExpanded('epic')) {
                    <div class="mt-4 ml-7 space-y-4 text-sm">
                      <div>
                        <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Vision</h4>
                        <p class="whitespace-pre-wrap">{{ structured()!.epic!.vision }}</p>
                      </div>

                      @if (structured()!.epic!.goals?.length) {
                        <div>
                          <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Goals</h4>
                          <ul class="list-disc list-inside space-y-1">
                            @for (goal of structured()!.epic!.goals; track $index) {
                              <li>{{ goal }}</li>
                            }
                          </ul>
                        </div>
                      }

                      @if (structured()!.epic!.successMetrics?.length) {
                        <div>
                          <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Success Metrics</h4>
                          <ul class="list-disc list-inside space-y-1">
                            @for (metric of structured()!.epic!.successMetrics; track $index) {
                              <li>{{ metric }}</li>
                            }
                          </ul>
                        </div>
                      }

                      @if (structured()!.epic!.risksAndDependencies) {
                        <div>
                          <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Risks & Dependencies</h4>
                          <p class="whitespace-pre-wrap">{{ structured()!.epic!.risksAndDependencies }}</p>
                        </div>
                      }
                    </div>
                  }

                  <!-- Actions -->
                  <div class="mt-4 ml-7 flex items-center gap-2 text-muted-foreground text-xs">
                    <button class="hover:text-foreground transition-colors" (click)="copySection('epic')">[Copy]</button>
                  </div>
                </div>

                <!-- Features nested inside Epic -->
                @if (structured()!.epic!.features?.length) {
                  <div class="ml-6 mr-4 mb-4 space-y-3">
                    @for (feature of structured()!.epic!.features; track $index; let i = $index) {
                      <ng-container *ngTemplateOutlet="featureCard; context: { feature, index: i, prefix: 'epic' }"></ng-container>
                    }
                  </div>
                }
              </div>
            }

            <!-- Standalone Feature (when type is 'feature') -->
            @if (structured()!.feature) {
              <ng-container *ngTemplateOutlet="featureCard; context: { feature: structured()!.feature, index: 0, prefix: 'standalone' }"></ng-container>
            }

            <!-- Standalone Stories (when type is 'user_story') -->
            @if (structured()!.stories?.length) {
              @for (story of structured()!.stories; track $index; let i = $index) {
                <ng-container *ngTemplateOutlet="storyCard; context: { story, index: i, prefix: 'standalone' }"></ng-container>
              }
            }
          </div>

          <!-- Metadata footer -->
          <div class="mt-6 text-center text-xs text-muted-foreground">
            Generated {{ formatDate(artifact()!.createdAt) }}
            @if (artifact()!.generationMetadata?.model) {
              · Model: {{ artifact()!.generationMetadata!.model }}
            }
          </div>
        } @else if (artifact() && !structured()) {
          <!-- Fallback for non-JSON content (legacy) -->
          <div class="rounded-lg border bg-card p-6 shadow-sm">
            <h2 class="text-lg font-semibold mb-4">{{ artifact()!.title }}</h2>
            <pre class="whitespace-pre-wrap text-sm font-mono">{{ artifact()!.content }}</pre>
          </div>
        } @else {
          <div class="flex flex-col items-center justify-center py-20">
            <ng-icon name="lucideSparkles" class="h-12 w-12 text-muted-foreground/50" />
            <h2 class="mt-4 text-lg font-medium text-muted-foreground">No artifact found</h2>
            <p class="mt-2 text-sm text-muted-foreground">
              This artifact may have been deleted or doesn't exist.
            </p>
            <a routerLink="/story-generator" class="mt-4">
              <button hlmBtn variant="outline">
                <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
                Back to Generator
              </button>
            </a>
          </div>
        }
      </main>

      <!-- Feature Card Template -->
      <ng-template #featureCard let-feature="feature" let-index="index" let-prefix="prefix">
        <div class="rounded-lg border bg-card shadow-sm">
          <div class="border-l-4 border-l-blue-500 rounded-l-lg p-4">
            <!-- Feature Header -->
            <button
              class="flex items-center gap-2 w-full text-left font-bold hover:text-blue-600 transition-colors"
              (click)="toggleItem(prefix + '-feature-' + index)"
            >
              <ng-icon
                [name]="isExpanded(prefix + '-feature-' + index) ? 'lucideChevronDown' : 'lucideChevronRight'"
                class="h-4 w-4 flex-shrink-0"
              />
              <span class="text-blue-500/70 font-normal text-xs mr-2">FEATURE {{ index + 1 }}</span>
              {{ feature.title }}
            </button>

            <!-- Feature Content (collapsible) -->
            @if (isExpanded(prefix + '-feature-' + index)) {
              <div class="mt-4 ml-6 space-y-3 text-sm">
                @if (feature.purpose) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Purpose</h4>
                    <p class="whitespace-pre-wrap">{{ feature.purpose }}</p>
                  </div>
                }

                @if (feature.summary) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Summary</h4>
                    <p class="whitespace-pre-wrap">{{ feature.summary }}</p>
                  </div>
                }

                @if (feature.businessValue) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Business Value</h4>
                    <p class="whitespace-pre-wrap">{{ feature.businessValue }}</p>
                  </div>
                }

                @if (feature.functionalRequirements) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Functional Requirements</h4>
                    <p class="whitespace-pre-wrap">{{ feature.functionalRequirements }}</p>
                  </div>
                }

                @if (feature.nonFunctionalRequirements) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Non-Functional Requirements</h4>
                    <p class="whitespace-pre-wrap">{{ feature.nonFunctionalRequirements }}</p>
                  </div>
                }

                @if (feature.dependencies) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Dependencies</h4>
                    <p class="whitespace-pre-wrap">{{ feature.dependencies }}</p>
                  </div>
                }

                @if (feature.assumptions) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-1">Assumptions</h4>
                    <p class="whitespace-pre-wrap">{{ feature.assumptions }}</p>
                  </div>
                }

                @if (feature.acceptanceCriteria?.length) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-2">Acceptance Criteria</h4>
                    @for (ac of feature.acceptanceCriteria; track $index) {
                      <div class="bg-muted/50 rounded p-3 mb-2">
                        <p class="font-medium text-sm mb-1">{{ ac.scenario }}</p>
                        <p class="text-xs"><span class="font-semibold">GIVEN</span> {{ ac.given }}</p>
                        <p class="text-xs"><span class="font-semibold">WHEN</span> {{ ac.when }}</p>
                        <p class="text-xs"><span class="font-semibold">THEN</span> {{ ac.then }}</p>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- Feature Actions -->
            <div class="mt-3 ml-6 flex items-center gap-2 text-muted-foreground text-xs">
              <button class="hover:text-foreground transition-colors" (click)="copyFeature(feature)">[Copy]</button>
            </div>
          </div>

          <!-- Stories nested inside Feature -->
          @if (feature.stories?.length) {
            <div class="ml-6 mr-4 mb-4 space-y-2">
              @for (story of feature.stories; track $index; let j = $index) {
                <ng-container *ngTemplateOutlet="storyCard; context: { story, index: j, prefix: prefix + '-feature-' + index }"></ng-container>
              }
            </div>
          }
        </div>
      </ng-template>

      <!-- Story Card Template -->
      <ng-template #storyCard let-story="story" let-index="index" let-prefix="prefix">
        <div class="rounded-lg border bg-card shadow-sm">
          <div class="border-l-4 border-l-green-500 rounded-l-lg p-3">
            <!-- Story Header -->
            <button
              class="flex items-center gap-2 w-full text-left font-bold text-sm hover:text-green-600 transition-colors"
              (click)="toggleItem(prefix + '-story-' + index)"
            >
              <ng-icon
                [name]="isExpanded(prefix + '-story-' + index) ? 'lucideChevronDown' : 'lucideChevronRight'"
                class="h-3 w-3 flex-shrink-0"
              />
              <span class="text-green-500/70 font-normal text-xs mr-2">STORY {{ index + 1 }}</span>
              {{ story.title }}
            </button>

            <!-- Story Content (collapsible) -->
            @if (isExpanded(prefix + '-story-' + index)) {
              <div class="mt-3 ml-5 space-y-3 text-sm">
                @if (story.userStory) {
                  <div class="bg-green-50 dark:bg-green-950/30 rounded p-3 italic">
                    {{ story.userStory }}
                  </div>
                }

                @if (story.acceptanceCriteria?.length) {
                  <div>
                    <h4 class="font-semibold text-muted-foreground uppercase text-xs mb-2">Acceptance Criteria</h4>
                    @for (ac of story.acceptanceCriteria; track $index) {
                      <div class="bg-muted/50 rounded p-2 mb-2 text-xs">
                        <p class="font-medium mb-1">{{ ac.scenario }}</p>
                        <p><span class="font-semibold">GIVEN</span> {{ ac.given }}</p>
                        <p><span class="font-semibold">WHEN</span> {{ ac.when }}</p>
                        <p><span class="font-semibold">THEN</span> {{ ac.then }}</p>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- Story Actions -->
            <div class="mt-2 ml-5 flex items-center gap-2 text-xs text-muted-foreground">
              <button class="hover:text-foreground transition-colors" (click)="copyStory(story)">[Copy]</button>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class StoryGeneratorOutputComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected service = inject(StoryGeneratorService);

  protected loading = signal(true);
  protected artifact = signal<GeneratedArtifact | null>(null);
  protected expandedItems = signal<Set<string>>(new Set());
  protected copiedAll = signal(false);
  protected showExportMenu = signal(false);

  // Parse the JSON content into structured data
  protected structured = computed<StructuredContent | null>(() => {
    const content = this.artifact()?.content;
    if (!content) return null;

    try {
      return JSON.parse(content) as StructuredContent;
    } catch {
      // Content is not JSON (legacy markdown format)
      return null;
    }
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadArtifact(parseInt(id, 10));
    } else {
      const current = this.service.currentArtifact();
      if (current) {
        this.artifact.set(current);
        this.loading.set(false);
      } else {
        this.loading.set(false);
      }
    }
  }

  private async loadArtifact(id: number): Promise<void> {
    try {
      const artifact = await this.service.getArtifact(id);
      this.artifact.set(artifact);
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleItem(itemKey: string): void {
    this.expandedItems.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  }

  protected isExpanded(itemKey: string): boolean {
    return this.expandedItems().has(itemKey);
  }

  protected async copyAll(): Promise<void> {
    const content = this.artifact()?.content;
    if (!content) return;

    try {
      // Convert to markdown for clipboard
      const markdown = this.toMarkdown();
      await navigator.clipboard.writeText(markdown);
      this.copiedAll.set(true);
      setTimeout(() => this.copiedAll.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  protected copySection(type: string): void {
    const structured = this.structured();
    if (!structured) return;

    let content = '';
    if (type === 'epic' && structured.epic) {
      content = this.epicToMarkdown(structured.epic);
    }

    navigator.clipboard.writeText(content);
  }

  protected copyFeature(feature: FeatureNode): void {
    const markdown = this.featureToMarkdown(feature);
    navigator.clipboard.writeText(markdown);
  }

  protected copyStory(story: StoryNode): void {
    const markdown = this.storyToMarkdown(story);
    navigator.clipboard.writeText(markdown);
  }

  protected toggleExportMenu(): void {
    this.showExportMenu.update((v) => !v);
  }

  protected exportAs(format: 'markdown' | 'json'): void {
    const artifact = this.artifact();
    if (!artifact) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'markdown':
        content = this.toMarkdown();
        filename = `${artifact.title.toLowerCase().replace(/\s+/g, '-')}.md`;
        mimeType = 'text/markdown';
        break;
      case 'json':
        content = artifact.content;
        filename = `${artifact.title.toLowerCase().replace(/\s+/g, '-')}.json`;
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.showExportMenu.set(false);
  }

  // Convert structured content to markdown
  private toMarkdown(): string {
    const structured = this.structured();
    if (!structured) return this.artifact()?.content || '';

    let md = '';

    if (structured.epic) {
      md += this.epicToMarkdown(structured.epic);
    }

    if (structured.feature) {
      md += this.featureToMarkdown(structured.feature);
    }

    if (structured.stories) {
      for (const story of structured.stories) {
        md += this.storyToMarkdown(story);
        md += '\n---\n\n';
      }
    }

    return md.trim();
  }

  private epicToMarkdown(epic: EpicNode): string {
    let md = `# EPIC: ${epic.title}\n\n`;
    md += `## Vision\n${epic.vision}\n\n`;

    if (epic.goals?.length) {
      md += `## Goals\n`;
      for (const goal of epic.goals) {
        md += `- ${goal}\n`;
      }
      md += '\n';
    }

    if (epic.successMetrics?.length) {
      md += `## Success Metrics\n`;
      for (const metric of epic.successMetrics) {
        md += `- ${metric}\n`;
      }
      md += '\n';
    }

    if (epic.risksAndDependencies) {
      md += `## Risks & Dependencies\n${epic.risksAndDependencies}\n\n`;
    }

    md += '---\n\n';

    if (epic.features?.length) {
      for (const feature of epic.features) {
        md += this.featureToMarkdown(feature);
        md += '\n---\n\n';
      }
    }

    return md;
  }

  private featureToMarkdown(feature: FeatureNode): string {
    let md = `## FEATURE: ${feature.title}\n\n`;

    if (feature.purpose) md += `### Purpose\n${feature.purpose}\n\n`;
    if (feature.summary) md += `### Summary\n${feature.summary}\n\n`;
    if (feature.businessValue) md += `### Business Value\n${feature.businessValue}\n\n`;
    if (feature.functionalRequirements) md += `### Functional Requirements\n${feature.functionalRequirements}\n\n`;
    if (feature.nonFunctionalRequirements) md += `### Non-Functional Requirements\n${feature.nonFunctionalRequirements}\n\n`;
    if (feature.dependencies) md += `### Dependencies\n${feature.dependencies}\n\n`;
    if (feature.assumptions) md += `### Assumptions\n${feature.assumptions}\n\n`;

    if (feature.acceptanceCriteria?.length) {
      md += `### Acceptance Criteria\n\n`;
      for (const ac of feature.acceptanceCriteria) {
        md += `#### ${ac.scenario}\n`;
        md += `GIVEN ${ac.given}\n`;
        md += `WHEN ${ac.when}\n`;
        md += `THEN ${ac.then}\n\n`;
      }
    }

    if (feature.stories?.length) {
      for (const story of feature.stories) {
        md += this.storyToMarkdown(story);
        md += '\n';
      }
    }

    return md;
  }

  private storyToMarkdown(story: StoryNode): string {
    let md = `### STORY: ${story.title}\n\n`;
    md += `${story.userStory}\n\n`;

    if (story.acceptanceCriteria?.length) {
      md += `#### Acceptance Criteria\n\n`;
      for (const ac of story.acceptanceCriteria) {
        md += `##### ${ac.scenario}\n`;
        md += `GIVEN ${ac.given}\n`;
        md += `WHEN ${ac.when}\n`;
        md += `THEN ${ac.then}\n\n`;
      }
    }

    return md;
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
