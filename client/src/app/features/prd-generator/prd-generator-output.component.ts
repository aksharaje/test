import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { MarkdownModule } from 'ngx-markdown';
import {
  lucideFileText,
  lucideChevronLeft,
  lucideChevronRight,
  lucideChevronDown,
  lucideChevronUp,
  lucideRefreshCw,
  lucideCopy,
  lucideDownload,
  lucideEdit,
  lucideLoader2,
  lucideAlertCircle,
  lucideInfo,
  lucideX,
  lucideSparkles,
  lucideBookOpen,
  lucideExternalLink,
  lucideCheck,
} from '@ng-icons/lucide';
import { PrdGeneratorService } from './prd-generator.service';
import type {
  GeneratedPrd,
  StructuredPrdContent,
  PrdSection,
  PrdCitation,
  PrdContext,
} from './prd-generator.types';

@Component({
  selector: 'app-prd-generator-output',
  standalone: true,
  imports: [FormsModule, NgIcon, MarkdownModule],
  viewProviders: [
    provideIcons({
      lucideFileText,
      lucideChevronLeft,
      lucideChevronRight,
      lucideChevronDown,
      lucideChevronUp,
      lucideRefreshCw,
      lucideCopy,
      lucideDownload,
      lucideEdit,
      lucideLoader2,
      lucideAlertCircle,
      lucideInfo,
      lucideX,
      lucideSparkles,
      lucideBookOpen,
      lucideExternalLink,
      lucideCheck,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background">
      @if (loading()) {
        <div class="flex h-screen items-center justify-center">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-primary" />
        </div>
      } @else if (error()) {
        <div class="flex h-screen items-center justify-center">
          <div class="text-center">
            <ng-icon name="lucideAlertCircle" class="mx-auto h-12 w-12 text-destructive" />
            <h2 class="mt-4 text-lg font-medium text-foreground">Failed to load PRD</h2>
            <p class="text-muted-foreground">{{ error() }}</p>
            <button
              (click)="goBack()"
              class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <ng-icon name="lucideChevronLeft" class="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      } @else if (isProcessing()) {
        <div class="flex h-screen items-center justify-center">
          <div class="w-full max-w-md space-y-6 p-6">
            <div class="text-center">
              <ng-icon name="lucideLoader2" class="h-12 w-12 animate-spin text-primary" />
              <h2 class="mt-4 text-xl font-semibold text-foreground">Generating PRD...</h2>
              <p class="text-muted-foreground">{{ prd()?.progressMessage || 'Processing...' }}</p>
            </div>
            
            <!-- Progress Steps -->
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full border-2"
                  [class.border-primary]="(prd()?.progressStep || 0) >= 1"
                  [class.bg-primary]="(prd()?.progressStep || 0) >= 1"
                  [class.text-primary-foreground]="(prd()?.progressStep || 0) >= 1"
                >
                  @if ((prd()?.progressStep || 0) > 1) { <ng-icon name="lucideCheck" class="h-4 w-4" /> } @else { 1 }
                </div>
                <div class="flex-1">
                  <p class="font-medium">Analyzing Input</p>
                  <p class="text-xs text-muted-foreground">Understanding requirements and context</p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full border-2"
                  [class.border-primary]="(prd()?.progressStep || 0) >= 2"
                  [class.bg-primary]="(prd()?.progressStep || 0) >= 2"
                  [class.text-primary-foreground]="(prd()?.progressStep || 0) >= 2"
                >
                  @if ((prd()?.progressStep || 0) > 2) { <ng-icon name="lucideCheck" class="h-4 w-4" /> } @else { 2 }
                </div>
                <div class="flex-1">
                  <p class="font-medium">Searching Knowledge Base</p>
                  <p class="text-xs text-muted-foreground">Retrieving relevant context</p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full border-2"
                  [class.border-primary]="(prd()?.progressStep || 0) >= 3"
                  [class.bg-primary]="(prd()?.progressStep || 0) >= 3"
                  [class.text-primary-foreground]="(prd()?.progressStep || 0) >= 3"
                >
                  @if ((prd()?.progressStep || 0) > 3) { <ng-icon name="lucideCheck" class="h-4 w-4" /> } @else { 3 }
                </div>
                <div class="flex-1">
                  <p class="font-medium">Generating Content</p>
                  <p class="text-xs text-muted-foreground">Drafting comprehensive PRD</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      } @else if (isFailed()) {
        <div class="flex h-screen items-center justify-center">
          <div class="text-center">
            <ng-icon name="lucideAlertCircle" class="mx-auto h-12 w-12 text-destructive" />
            <h2 class="mt-4 text-lg font-medium text-foreground">Generation Failed</h2>
            <p class="mt-2 text-muted-foreground">{{ prd()?.errorMessage || 'An error occurred during generation' }}</p>
            <div class="mt-6 flex justify-center gap-3">
              <button
                (click)="goBack()"
                class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Go Back
              </button>
              <button
                (click)="retryPrd()"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
                Retry Generation
              </button>
            </div>
          </div>
        </div>
      } @else if (prd()) {
        <div class="flex">
          <!-- Main Content -->
          <div class="flex-1 p-6" [class.pr-80]="contextPanelOpen()">
            <!-- Header -->
            <div class="mb-6 flex items-start justify-between">
              <div>
                <button
                  (click)="goBack()"
                  class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ng-icon name="lucideChevronLeft" class="h-4 w-4" />
                  Back to Generator
                </button>
                <div class="flex items-center gap-3">
                  <h1 class="text-2xl font-bold text-foreground">{{ parsedContent()?.title }}</h1>
                  <span class="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    AI DRAFT
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  (click)="toggleContextPanel()"
                  class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
                  [class.bg-accent]="contextPanelOpen()"
                >
                  <ng-icon name="lucideInfo" class="h-4 w-4" />
                  Context
                </button>
                <button
                  (click)="openRefineModal()"
                  class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
                  Refine Draft
                </button>
                <button
                  (click)="copyToClipboard()"
                  class="rounded-md border border-input bg-background p-2 hover:bg-accent"
                  title="Copy to clipboard"
                >
                  <ng-icon name="lucideCopy" class="h-4 w-4" />
                </button>
                <button
                  (click)="downloadPrd()"
                  class="rounded-md border border-input bg-background p-2 hover:bg-accent"
                  title="Download as Markdown"
                >
                  <ng-icon name="lucideDownload" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- PRD Content -->
            <div class="mx-auto max-w-3xl space-y-6">
              @for (section of parsedContent()?.sections; track section.key) {
                <div class="rounded-lg border border-border bg-card">
                  <button
                    (click)="toggleSection(section.key)"
                    class="flex w-full items-center justify-between p-4 text-left"
                  >
                    <h2 class="text-lg font-semibold text-foreground">{{ section.title }}</h2>
                    <ng-icon
                      [name]="expandedSections().has(section.key) ? 'lucideChevronUp' : 'lucideChevronDown'"
                      class="h-5 w-5 text-muted-foreground"
                    />
                  </button>
                  @if (expandedSections().has(section.key)) {
                    <div class="border-t border-border px-4 pb-4 pt-2">
                      <div class="prose prose-sm max-w-none dark:prose-invert" [innerHTML]="renderSectionContent(section)"></div>
                    </div>
                  }
                </div>
              }

              <!-- Citations Section -->
              @if (prd()?.citations && prd()!.citations.length > 0) {
                <div class="rounded-lg border border-border bg-card p-4">
                  <h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <ng-icon name="lucideBookOpen" class="h-5 w-5" />
                    Sources
                  </h2>
                  <div class="space-y-3">
                    @for (citation of prd()!.citations; track citation.id) {
                      <div
                        class="rounded-md border border-border bg-background p-3"
                        [id]="'citation-' + citation.id"
                      >
                        <div class="flex items-start justify-between">
                          <div class="flex items-start gap-2">
                            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {{ citation.id }}
                            </span>
                            <div>
                              <span class="font-medium text-foreground">{{ citation.source }}</span>
                              @if (citation.documentName) {
                                <span class="text-sm text-muted-foreground"> - {{ citation.documentName }}</span>
                              }
                            </div>
                          </div>
                          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {{ citation.type }}
                          </span>
                        </div>
                        <p class="mt-2 text-sm text-muted-foreground line-clamp-3">{{ citation.content }}</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Context Panel (Slide-in from right) -->
          @if (contextPanelOpen()) {
            <div class="fixed right-0 top-0 h-full w-80 border-l border-border bg-card shadow-lg">
              <div class="flex h-full flex-col">
                <div class="flex items-center justify-between border-b border-border p-4">
                  <h3 class="font-semibold text-foreground">Generation Context</h3>
                  <button
                    (click)="toggleContextPanel()"
                    class="rounded-md p-1 hover:bg-accent"
                  >
                    <ng-icon name="lucideX" class="h-4 w-4" />
                  </button>
                </div>
                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                  <!-- Concept -->
                  <div>
                    <h4 class="mb-1 text-sm font-medium text-muted-foreground">Concept</h4>
                    <p class="text-sm text-foreground">{{ prd()?.concept }}</p>
                  </div>

                  <!-- Project Context -->
                  @if (prd()?.targetProject) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Target Project/Team</h4>
                      <p class="text-sm text-foreground">{{ prd()?.targetProject }}</p>
                    </div>
                  }
                  @if (prd()?.targetPersona) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Target Persona</h4>
                      <p class="text-sm text-foreground">{{ prd()?.targetPersona }}</p>
                    </div>
                  }
                  @if (prd()?.industryContext) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Industry Context</h4>
                      <p class="text-sm text-foreground">{{ prd()?.industryContext }}</p>
                    </div>
                  }
                  @if (prd()?.primaryMetric) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Primary Metric</h4>
                      <p class="text-sm text-foreground">{{ prd()?.primaryMetric }}</p>
                    </div>
                  }

                  <!-- User Story -->
                  @if (prd()?.userStoryRole) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">User Story</h4>
                      <p class="text-sm text-foreground">
                        As a {{ prd()?.userStoryRole }}, I want {{ prd()?.userStoryGoal }}, so that {{ prd()?.userStoryBenefit }}
                      </p>
                    </div>
                  }

                  <!-- Knowledge Bases Used -->
                  @if (prd()?.knowledgeBaseIds && prd()!.knowledgeBaseIds.length > 0) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Knowledge Bases</h4>
                      <div class="flex flex-wrap gap-1">
                        @for (kbId of prd()!.knowledgeBaseIds; track kbId) {
                          <span class="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            KB #{{ kbId }}
                          </span>
                        }
                      </div>
                    </div>
                  }

                  <!-- Template Used -->
                  @if (prd()?.templateId) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Template</h4>
                      <p class="text-sm text-foreground">Template #{{ prd()?.templateId }}</p>
                    </div>
                  }

                  <!-- Generation Metadata -->
                  @if (prd()?.generationMetadata) {
                    <div>
                      <h4 class="mb-1 text-sm font-medium text-muted-foreground">Generation Info</h4>
                      <div class="space-y-1 text-xs text-muted-foreground">
                        <p>Model: {{ prd()?.generationMetadata?.model }}</p>
                        @if (prd()?.generationMetadata?.generationTimeMs) {
                          <p>Time: {{ (prd()?.generationMetadata?.generationTimeMs || 0) / 1000 }}s</p>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Refine Modal -->
      @if (refineModalOpen()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold text-foreground">Refine Draft</h3>
              <button
                (click)="closeRefineModal()"
                class="rounded-md p-1 hover:bg-accent"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>
            <p class="mb-4 text-sm text-muted-foreground">
              Describe the changes you'd like to make to this PRD. Be specific about what should be added, removed, or modified.
            </p>
            <textarea
              [(ngModel)]="refinePrompt"
              placeholder="e.g., Add more detail to the functional requirements section, focusing on authentication flows..."
              rows="4"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ></textarea>
            <div class="mt-4 flex justify-end gap-2">
              <button
                (click)="closeRefineModal()"
                class="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                (click)="submitRefine()"
                [disabled]="!refinePrompt.trim() || service.generating()"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                @if (service.generating()) {
                  <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                  Refining...
                } @else {
                  <ng-icon name="lucideSparkles" class="h-4 w-4" />
                  Refine
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    :host ::ng-deep .prose {
      max-width: 100%;
      line-height: 1.7;
      font-size: 0.9375rem;
    }

    :host ::ng-deep .prose h1,
    :host ::ng-deep .prose h2,
    :host ::ng-deep .prose h3,
    :host ::ng-deep .prose h4 {
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      line-height: 1.3;
    }

    :host ::ng-deep .prose h1 {
      font-size: 1.5rem;
    }

    :host ::ng-deep .prose h2 {
      font-size: 1.25rem;
    }

    :host ::ng-deep .prose h3 {
      font-size: 1.125rem;
    }

    :host ::ng-deep .prose p {
      margin-bottom: 1rem;
    }

    :host ::ng-deep .prose ul,
    :host ::ng-deep .prose ol {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }

    :host ::ng-deep .prose li {
      margin-bottom: 0.5rem;
    }

    :host ::ng-deep .prose ul {
      list-style-type: disc;
    }

    :host ::ng-deep .prose ol {
      list-style-type: decimal;
    }

    :host ::ng-deep .prose pre {
      background: hsl(var(--muted));
      border-radius: 0.375rem;
      padding: 1rem;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    :host ::ng-deep .prose code {
      background: hsl(var(--muted));
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
    }

    :host ::ng-deep .prose pre code {
      background: transparent;
      padding: 0;
    }

    :host ::ng-deep .prose blockquote {
      border-left: 3px solid hsl(var(--border));
      padding-left: 1rem;
      margin-left: 0;
      margin-bottom: 1rem;
      color: hsl(var(--muted-foreground));
      font-style: italic;
    }

    :host ::ng-deep .prose table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }

    :host ::ng-deep .prose th,
    :host ::ng-deep .prose td {
      border: 1px solid hsl(var(--border));
      padding: 0.5rem;
      text-align: left;
    }

    :host ::ng-deep .prose th {
      background: hsl(var(--muted));
      font-weight: 600;
    }

    /* Citation links */
    :host ::ng-deep .citation-link {
      color: hsl(var(--primary));
      cursor: pointer;
      font-size: 0.75rem;
      vertical-align: super;
    }

    :host ::ng-deep .citation-link:hover {
      text-decoration: underline;
    }
  `,
})
export class PrdGeneratorOutputComponent implements OnInit {
  protected service = inject(PrdGeneratorService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected prd = signal<GeneratedPrd | null>(null);
  protected expandedSections = signal<Set<string>>(new Set());
  protected contextPanelOpen = signal(false);
  protected refineModalOpen = signal(false);
  protected refinePrompt = '';
  private pollInterval: any;

  // Computed
  protected isProcessing = computed(() => {
    const status = this.prd()?.status;
    return status === 'pending' || status === 'processing';
  });

  protected isFailed = computed(() => {
    return this.prd()?.status === 'failed';
  });
  protected parsedContent = computed<StructuredPrdContent | null>(() => {
    const prd = this.prd();
    if (!prd) return null;
    try {
      return JSON.parse(prd.content);
    } catch {
      return null;
    }
  });

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (isNaN(id)) {
      this.error.set('Invalid PRD ID');
      this.loading.set(false);
      return;
    }

    await this.loadPrd(id);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async loadPrd(id: number): Promise<void> {
    try {
      const prd = await this.service.getPrd(id);
      if (prd) {
        this.prd.set(prd);

        // Handle different states
        if (prd.status === 'pending' || prd.status === 'processing') {
          this.startPolling(id);
        } else if (prd.status === 'draft' || prd.status === 'final') {
          this.initializeContent(prd);
        }
      } else {
        this.error.set('PRD not found');
      }
    } catch (err) {
      this.error.set('Failed to load PRD');
    } finally {
      this.loading.set(false);
    }
  }

  private startPolling(id: number): void {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      const prd = await this.service.pollSessionStatus(id);
      if (prd) {
        this.prd.set(prd);

        if (prd.status === 'draft' || prd.status === 'final') {
          clearInterval(this.pollInterval);
          this.initializeContent(prd);
        } else if (prd.status === 'failed') {
          clearInterval(this.pollInterval);
        }
      }
    }, 2000);
  }

  private initializeContent(prd: GeneratedPrd): void {
    const content = JSON.parse(prd.content) as StructuredPrdContent;
    const allKeys = new Set(content.sections.map(s => s.key));
    this.expandedSections.set(allKeys);
  }

  async retryPrd(): Promise<void> {
    const prd = this.prd();
    if (!prd) return;

    this.loading.set(true);
    const updated = await this.service.retryPrd(prd.id);
    if (updated) {
      this.prd.set(updated);
      this.loading.set(false);
      this.startPolling(updated.id);
    }
  }

  toggleSection(key: string): void {
    this.expandedSections.update(set => {
      const newSet = new Set(set);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }

  toggleContextPanel(): void {
    this.contextPanelOpen.update(v => !v);
  }

  openRefineModal(): void {
    this.refineModalOpen.set(true);
    this.refinePrompt = '';
  }

  closeRefineModal(): void {
    this.refineModalOpen.set(false);
    this.refinePrompt = '';
  }

  async submitRefine(): Promise<void> {
    const prd = this.prd();
    if (!prd || !this.refinePrompt.trim()) return;

    const refined = await this.service.refine(prd.id, this.refinePrompt.trim());
    if (refined) {
      this.prd.set(refined);
      // Re-expand all sections
      const content = JSON.parse(refined.content) as StructuredPrdContent;
      const allKeys = new Set(content.sections.map(s => s.key));
      this.expandedSections.set(allKeys);
      this.closeRefineModal();
    }
  }

  renderSectionContent(section: PrdSection): string {
    // Convert markdown to HTML and add citation links
    let content = section.content;

    // Replace citation markers [1], [2] etc with links
    content = content.replace(/\[(\d+)\]/g, (match, num) => {
      return `<a href="#citation-${num}" class="citation-link">[${num}]</a>`;
    });

    // Simple markdown to HTML conversion for display
    // In a real app, you might use a proper markdown library
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, (line) => {
        if (!line.startsWith('<')) return `<p>${line}</p>`;
        return line;
      });
  }

  async copyToClipboard(): Promise<void> {
    const content = this.parsedContent();
    if (!content) return;

    let markdown = `# ${content.title}\n\n`;
    for (const section of content.sections) {
      markdown += `## ${section.title}\n\n${section.content}\n\n`;
    }

    await navigator.clipboard.writeText(markdown);
    // Could show a toast notification here
  }

  downloadPrd(): void {
    const content = this.parsedContent();
    if (!content) return;

    let markdown = `# ${content.title}\n\n`;
    for (const section of content.sections) {
      markdown += `## ${section.title}\n\n${section.content}\n\n`;
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/prd-generator']);
  }
}
