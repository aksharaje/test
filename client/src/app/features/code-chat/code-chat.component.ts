import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideMessageSquare,
  lucideLoader2,
  lucideSend,
  lucideDatabase,
  lucideX,
  lucidePlus,
  lucideTrash2,
  lucideChevronRight,
  lucideChevronLeft,
  lucideCode,
  lucideFileCode,
  lucideInfo,
  lucideExternalLink,
  lucideCopy,
  lucideCheck,
  lucideChevronDown,
  lucideSearch,
} from '@ng-icons/lucide';
import { MarkdownComponent } from 'ngx-markdown';
import { CodeChatService } from './code-chat.service';
import type { CodeChatMessage, CodeChatCitation } from './code-chat.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-code-chat',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, MarkdownComponent],
  viewProviders: [
    provideIcons({
      lucideMessageSquare,
      lucideLoader2,
      lucideSend,
      lucideDatabase,
      lucideX,
      lucidePlus,
      lucideTrash2,
      lucideChevronRight,
      lucideChevronLeft,
      lucideCode,
      lucideFileCode,
      lucideInfo,
      lucideExternalLink,
      lucideCopy,
      lucideCheck,
      lucideChevronDown,
      lucideSearch,
    }),
  ],
  template: `
    <div class="flex flex-1 overflow-hidden">
      <!-- Main Chat Area -->
      <div class="flex-1 flex flex-col min-w-0">
        @if (!service.currentSession() && !showWelcome()) {
          <!-- Welcome Screen -->
          <div class="flex-1 flex items-center justify-center p-6">
            <div class="max-w-lg text-center">
              <ng-icon name="lucideCode" class="mx-auto h-16 w-16 text-primary/50" />
              <h2 class="mt-4 text-2xl font-bold text-foreground">
                AI-Powered Codebase Query Agent
              </h2>
              <p class="mt-2 text-muted-foreground">
                Ask questions about your codebase. Get explanations of business logic,
                flow diagrams, integration analysis, and effort estimates.
              </p>
              <div class="mt-6 grid grid-cols-2 gap-4 text-left">
                <div class="rounded-lg border p-4">
                  <h3 class="font-medium flex items-center gap-2">
                    <ng-icon name="lucideFileCode" class="h-4 w-4 text-primary" />
                    Logic Extraction
                  </h3>
                  <p class="mt-1 text-sm text-muted-foreground">
                    "How do we check if a customer is eligible for a discount?"
                  </p>
                </div>
                <div class="rounded-lg border p-4">
                  <h3 class="font-medium flex items-center gap-2">
                    <ng-icon name="lucideChevronRight" class="h-4 w-4 text-primary" />
                    Flow Explanation
                  </h3>
                  <p class="mt-1 text-sm text-muted-foreground">
                    "Explain the checkout flow step by step"
                  </p>
                </div>
                <div class="rounded-lg border p-4">
                  <h3 class="font-medium flex items-center gap-2">
                    <ng-icon name="lucideExternalLink" class="h-4 w-4 text-primary" />
                    Integration Analysis
                  </h3>
                  <p class="mt-1 text-sm text-muted-foreground">
                    "What data do we send to the payment API?"
                  </p>
                </div>
                <div class="rounded-lg border p-4">
                  <h3 class="font-medium flex items-center gap-2">
                    <ng-icon name="lucideInfo" class="h-4 w-4 text-primary" />
                    Effort Estimation
                  </h3>
                  <p class="mt-1 text-sm text-muted-foreground">
                    "How much effort to add a review summary feature?"
                  </p>
                </div>
              </div>
              <p class="mt-6 text-sm text-muted-foreground">
                Select a code repository from the right panel and click "New Chat" to begin.
              </p>
            </div>
          </div>
        } @else {
          <!-- Chat Header -->
          <div class="border-b p-4 bg-background">
            <div class="flex items-center justify-between">
              <div>
                <h1 class="text-lg font-semibold">
                  {{ service.currentSession()?.title || 'New Chat' }}
                </h1>
                <div class="flex items-center gap-2 mt-1">
                  @for (kb of service.selectedKnowledgeBases(); track kb.id) {
                    <span class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {{ kb.name }}
                    </span>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Messages Area -->
          <div class="flex-1 overflow-y-auto p-4" #messagesContainer>
            @if (service.messages().length === 0 && !service.sending()) {
              <div class="flex items-center justify-center h-full">
                <div class="text-center max-w-md">
                  <ng-icon name="lucideMessageSquare" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 class="mt-4 text-lg font-medium">What would you like to know?</h3>
                  <p class="mt-2 text-muted-foreground">
                    Ask questions about the selected codebase. I can explain logic,
                    trace flows, analyze integrations, and estimate effort.
                  </p>
                </div>
              </div>
            } @else {
              <div class="space-y-4 max-w-3xl mx-auto">
                @for (message of service.messages(); track message.id) {
                  <div
                    class="flex gap-3"
                    [class.flex-row-reverse]="message.role === 'user'"
                  >
                    <!-- Avatar -->
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      [class.bg-primary]="message.role === 'user'"
                      [class.bg-muted]="message.role === 'assistant'"
                    >
                      @if (message.role === 'user') {
                        <span class="text-xs font-medium text-primary-foreground">You</span>
                      } @else {
                        <ng-icon name="lucideCode" class="h-4 w-4 text-foreground" />
                      }
                    </div>

                    <!-- Message Content -->
                    <div
                      class="flex-1 min-w-0 max-w-[80%]"
                      [class.text-right]="message.role === 'user'"
                    >
                      <div
                        class="inline-block rounded-lg p-3 text-left overflow-hidden"
                        [class.bg-primary]="message.role === 'user'"
                        [class.text-primary-foreground]="message.role === 'user'"
                        [class.bg-muted]="message.role === 'assistant'"
                        [class.w-full]="message.role === 'assistant'"
                      >
                        @if (message.role === 'assistant') {
                          <markdown
                            [data]="message.content"
                            class="prose prose-sm max-w-full dark:prose-invert overflow-hidden"
                          />
                        } @else {
                          <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
                        }
                      </div>

                      <!-- Copy Button for Assistant Messages -->
                      @if (message.role === 'assistant') {
                        <div class="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            class="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            (click)="copyToClipboard(message.id, message.content)"
                          >
                            @if (copiedMessageId() === message.id) {
                              <ng-icon name="lucideCheck" class="h-3 w-3 text-green-500" />
                              <span class="text-green-500">Copied!</span>
                            } @else {
                              <ng-icon name="lucideCopy" class="h-3 w-3" />
                              <span>Copy</span>
                            }
                          </button>
                        </div>
                      }

                      <!-- Citations -->
                      @if (message.citations && message.citations.length > 0) {
                        <div class="mt-2 space-y-1">
                          <p class="text-xs text-muted-foreground">Sources:</p>
                          @for (citation of message.citations; track $index) {
                            <button
                              type="button"
                              class="block w-full text-left rounded border px-2 py-1 text-xs hover:bg-muted transition-colors"
                              (click)="toggleCitation(message.id, $index)"
                            >
                              <span class="font-medium">{{ citation.filePath || citation.documentName }}</span>
                              <span class="text-muted-foreground ml-2">
                                ({{ (citation.similarity * 100).toFixed(0) }}% match)
                              </span>
                            </button>
                            @if (expandedCitations()[message.id + '-' + $index]) {
                              <div class="mt-1 rounded bg-muted/50 p-2 text-xs font-mono overflow-x-auto">
                                <pre class="whitespace-pre-wrap">{{ citation.content }}</pre>
                              </div>
                            }
                          }
                        </div>
                      }

                      <!-- Metadata -->
                      @if (message.metadata) {
                        <p class="mt-1 text-xs text-muted-foreground">
                          {{ message.metadata.responseTimeMs }}ms
                          @if (message.metadata.chunksSearched) {
                            &bull; {{ message.metadata.chunksSearched }} sources searched
                          }
                        </p>
                      }
                    </div>
                  </div>
                }

                <!-- Sending indicator -->
                @if (service.sending()) {
                  <div class="flex gap-3">
                    <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                    </div>
                    <div class="flex-1">
                      <div class="inline-block rounded-lg bg-muted p-3">
                        <div class="flex items-center gap-2">
                          <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                          <span class="text-sm text-muted-foreground">Analyzing codebase...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Input Area -->
          <div class="border-t p-4 bg-background">
            @if (service.error()) {
              <div class="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-destructive text-sm flex items-center justify-between">
                <span>{{ service.error() }}</span>
                <button type="button" (click)="service.clearError()">
                  <ng-icon name="lucideX" class="h-4 w-4" />
                </button>
              </div>
            }
            <div class="flex gap-2 max-w-3xl mx-auto">
              <textarea
                #messageInput
                class="flex-1 rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows="1"
                placeholder="Ask about the codebase..."
                [value]="messageText()"
                (input)="onMessageInput($event)"
                (keydown.enter)="onEnterKey($event)"
                [disabled]="service.sending()"
              ></textarea>
              <button
                hlmBtn
                [disabled]="!messageText().trim() || service.sending()"
                (click)="sendMessage()"
              >
                @if (service.sending()) {
                  <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                } @else {
                  <ng-icon name="lucideSend" class="h-4 w-4" />
                }
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Right Sidebar: Sessions List & Controls -->
      <div class="w-72 border-l flex flex-col bg-muted/30">
        <!-- Knowledge Base Selection Dropdown -->
        <div class="p-4 border-b">
          <div class="flex items-center gap-2 mb-2">
            <ng-icon name="lucideDatabase" class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">Code Repositories</span>
          </div>

          <!-- Dropdown trigger -->
          <div class="relative">
            <button
              type="button"
              class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
              (click)="toggleKbDropdown()"
            >
              <span class="truncate text-left">
                @if (service.selectedKbIds().length === 0) {
                  <span class="text-muted-foreground">Select repositories...</span>
                } @else if (service.selectedKbIds().length === 1) {
                  {{ service.selectedKnowledgeBases()[0]?.name }}
                } @else {
                  {{ service.selectedKbIds().length }} repositories selected
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
                      placeholder="Filter repositories..."
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
                      [class.bg-primary/10]="service.selectedKbIds().includes(kb.id)"
                      (click)="service.toggleKnowledgeBase(kb.id); $event.stopPropagation()"
                    >
                      <div
                        class="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                        [class.bg-primary]="service.selectedKbIds().includes(kb.id)"
                        [class.border-primary]="service.selectedKbIds().includes(kb.id)"
                      >
                        @if (service.selectedKbIds().includes(kb.id)) {
                          <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                        }
                      </div>
                      <span class="truncate">{{ kb.name }}</span>
                    </button>
                  } @empty {
                    <p class="px-2 py-4 text-sm text-muted-foreground text-center">
                      @if (kbSearchFilter()) {
                        No repositories match "{{ kbSearchFilter() }}"
                      } @else {
                        No code repositories available
                      }
                    </p>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Selected tags -->
          @if (service.selectedKbIds().length > 0) {
            <div class="flex flex-wrap gap-1 mt-2">
              @for (kb of service.selectedKnowledgeBases(); track kb.id) {
                <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {{ kb.name }}
                  <button
                    type="button"
                    class="hover:text-primary/70"
                    (click)="service.toggleKnowledgeBase(kb.id)"
                  >
                    <ng-icon name="lucideX" class="h-3 w-3" />
                  </button>
                </span>
              }
            </div>
          }
        </div>

        <!-- New Chat Button -->
        <div class="p-4 border-b">
          <button
            hlmBtn
            class="w-full"
            [disabled]="!service.hasSelectedKbs()"
            [title]="!service.hasSelectedKbs() ? 'Please select at least one code repository first' : ''"
            (click)="startNewChat()"
          >
            <ng-icon name="lucidePlus" class="mr-2 h-4 w-4" />
            New Chat
          </button>
        </div>

        <!-- Sessions List -->
        <div class="flex-1 overflow-y-auto">
          <div class="p-2">
            <p class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Chat History
            </p>
            @if (service.loading()) {
              <div class="p-4 text-center">
                <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            } @else if (!service.hasSessions()) {
              <p class="px-2 py-4 text-sm text-muted-foreground text-center">
                No chat history yet
              </p>
            } @else {
              @for (session of paginatedSessions(); track session.id) {
                <div
                  class="group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors"
                  [class.bg-primary/10]="service.currentSession()?.id === session.id"
                  [class.hover:bg-muted]="service.currentSession()?.id !== session.id"
                  (click)="loadSession(session.id)"
                >
                  <ng-icon name="lucideMessageSquare" class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span class="flex-1 text-sm truncate">
                    {{ session.title || 'New Chat' }}
                  </span>
                  <button
                    type="button"
                    class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    (click)="deleteSession($event, session.id)"
                    title="Delete"
                  >
                    <ng-icon name="lucideTrash2" class="h-3 w-3" />
                  </button>
                </div>
              }
            }
          </div>
        </div>

        <!-- Pagination controls -->
        <div class="p-2 border-t flex items-center justify-between bg-muted/30">
          <button
              type="button"
              class="p-1 rounded hover:bg-muted disabled:opacity-50 text-muted-foreground hover:text-foreground transition-colors"
              [disabled]="currentPage() === 1"
              (click)="prevPage()"
              title="Previous Page"
            >
              <ng-icon name="lucideChevronLeft" class="h-4 w-4" />
            </button>
            <span class="text-xs text-muted-foreground">
              Page {{ currentPage() }} of {{ totalPages() }}
            </span>
            <button
              type="button"
              class="p-1 rounded hover:bg-muted disabled:opacity-50 text-muted-foreground hover:text-foreground transition-colors"
              [disabled]="currentPage() === totalPages()"
              (click)="nextPage()"
              title="Next Page"
            >
              <ng-icon name="lucideChevronRight" class="h-4 w-4" />
            </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0; /* Important for nested flex scrolling */
    }

    /* Base prose styling for better readability */
    /* Use ::ng-deep to pierce view encapsulation for markdown-rendered content */
    :host ::ng-deep .prose {
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
      line-height: 1.7;
      font-size: 0.9375rem;
    }

    /* Paragraph spacing */
    :host ::ng-deep .prose p {
      margin-bottom: 1rem;
    }

    :host ::ng-deep .prose p:last-child {
      margin-bottom: 0;
    }

    /* Headers */
    :host ::ng-deep .prose h1,
    :host ::ng-deep .prose h2,
    :host ::ng-deep .prose h3,
    :host ::ng-deep .prose h4,
    :host ::ng-deep .prose h5,
    :host ::ng-deep .prose h6 {
      font-weight: 600;
      line-height: 1.3;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }

    :host ::ng-deep .prose h1:first-child,
    :host ::ng-deep .prose h2:first-child,
    :host ::ng-deep .prose h3:first-child {
      margin-top: 0;
    }

    :host ::ng-deep .prose h1 {
      font-size: 1.5rem;
      border-bottom: 1px solid hsl(var(--border));
      padding-bottom: 0.5rem;
    }

    :host ::ng-deep .prose h2 {
      font-size: 1.25rem;
      border-bottom: 1px solid hsl(var(--border));
      padding-bottom: 0.375rem;
    }

    :host ::ng-deep .prose h3 {
      font-size: 1.125rem;
    }

    :host ::ng-deep .prose h4 {
      font-size: 1rem;
    }

    /* Lists */
    :host ::ng-deep .prose ul,
    :host ::ng-deep .prose ol {
      margin-top: 0.75rem;
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }

    :host ::ng-deep .prose ul {
      list-style-type: disc;
    }

    :host ::ng-deep .prose ol {
      list-style-type: decimal;
    }

    :host ::ng-deep .prose li {
      margin-bottom: 0.375rem;
      padding-left: 0.25rem;
    }

    :host ::ng-deep .prose li::marker {
      color: hsl(var(--muted-foreground));
    }

    :host ::ng-deep .prose li > ul,
    :host ::ng-deep .prose li > ol {
      margin-top: 0.375rem;
      margin-bottom: 0.375rem;
    }

    /* Code blocks */
    :host ::ng-deep .prose pre {
      background-color: #1e293b !important;
      color: #f8fafc !important;
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-size: 0.8125rem;
      line-height: 1.6;
      border: 1px solid #334155;
    }

    /* Inline code */
    :host ::ng-deep .prose code {
      background-color: hsl(var(--muted));
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      word-break: break-all;
      font-weight: 500;
      color: hsl(var(--primary));
    }

    :host ::ng-deep .prose pre code {
      background-color: transparent;
      padding: 0;
      color: inherit;
      font-weight: normal;
    }

    /* Tables */
    :host ::ng-deep .prose table {
      width: 100%;
      font-size: 0.875rem;
      display: block;
      overflow-x: auto;
      margin: 1rem 0;
      border-collapse: collapse;
    }

    :host ::ng-deep .prose thead {
      background-color: hsl(var(--muted));
    }

    :host ::ng-deep .prose th {
      border: 1px solid hsl(var(--border));
      padding: 0.5rem 0.75rem;
      font-weight: 600;
      text-align: left;
    }

    :host ::ng-deep .prose td {
      border: 1px solid hsl(var(--border));
      padding: 0.5rem 0.75rem;
    }

    :host ::ng-deep .prose tbody tr:nth-child(even) {
      background-color: hsl(var(--muted) / 0.3);
    }

    /* Blockquotes */
    :host ::ng-deep .prose blockquote {
      border-left: 4px solid hsl(var(--primary));
      padding-left: 1rem;
      margin: 1rem 0;
      font-style: italic;
      color: hsl(var(--muted-foreground));
    }

    /* Horizontal rules */
    :host ::ng-deep .prose hr {
      border: none;
      border-top: 1px solid hsl(var(--border));
      margin: 1.5rem 0;
    }

    /* Strong and emphasis */
    :host ::ng-deep .prose strong {
      font-weight: 600;
    }

    :host ::ng-deep .prose em {
      font-style: italic;
    }

    /* Links */
    :host ::ng-deep .prose a {
      color: hsl(var(--primary));
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    :host ::ng-deep .prose a:hover {
      opacity: 0.8;
    }
  `,
})
export class CodeChatComponent implements OnInit, AfterViewChecked {
  private router = inject(Router);
  protected service = inject(CodeChatService);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

  protected messageText = signal('');
  protected showWelcome = signal(false);
  protected expandedCitations = signal<Record<string, boolean>>({});
  protected copiedMessageId = signal<number | null>(null);
  protected kbDropdownOpen = signal(false);
  protected kbSearchFilter = signal('');

  // Pagination
  protected currentPage = signal(1);
  protected pageSize = 10;

  protected paginatedSessions = computed(() => {
    const sessions = this.service.sessions();
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return sessions.slice(start, end);
  });

  protected totalPages = computed(() => {
    const count = this.service.sessions().length;
    return count === 0 ? 1 : Math.ceil(count / this.pageSize);
  });

  protected filteredKnowledgeBases = computed(() => {
    const filter = this.kbSearchFilter().toLowerCase().trim();
    const kbs = this.service.knowledgeBases();
    if (!filter) return kbs;
    return kbs.filter(kb => kb.name.toLowerCase().includes(filter));
  });

  private shouldScrollToBottom = false;

  ngOnInit(): void {
    this.service.loadKnowledgeBases();
    this.service.loadSessions();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  protected prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected async startNewChat(): Promise<void> {
    const session = await this.service.createSession();
    if (session) {
      this.showWelcome.set(true);
      this.shouldScrollToBottom = true;
      setTimeout(() => this.messageInput?.nativeElement?.focus(), 100);
    }
  }

  protected async loadSession(sessionId: number): Promise<void> {
    await this.service.loadSession(sessionId);
    this.showWelcome.set(true);
    this.shouldScrollToBottom = true;
  }

  protected async deleteSession(event: Event, sessionId: number): Promise<void> {
    event.stopPropagation();
    if (confirm('Delete this chat? This cannot be undone.')) {
      await this.service.deleteSession(sessionId);
    }
  }

  protected onMessageInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.messageText.set(textarea.value);

    // Auto-resize textarea
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }

  protected onEnterKey(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  protected async sendMessage(): Promise<void> {
    const text = this.messageText().trim();
    if (!text || this.service.sending()) return;

    this.messageText.set('');

    // Reset textarea height
    if (this.messageInput?.nativeElement) {
      this.messageInput.nativeElement.style.height = 'auto';
    }

    this.shouldScrollToBottom = true;
    await this.service.sendMessage(text);
    this.shouldScrollToBottom = true;
  }

  protected toggleCitation(messageId: number, index: number): void {
    const key = `${messageId}-${index}`;
    this.expandedCitations.update((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  protected async copyToClipboard(messageId: number, content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      this.copiedMessageId.set(messageId);
      setTimeout(() => {
        this.copiedMessageId.set(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  protected toggleKbDropdown(): void {
    this.kbDropdownOpen.update(v => !v);
    if (!this.kbDropdownOpen()) {
      this.kbSearchFilter.set('');
    }
  }

  protected onKbSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.kbSearchFilter.set(input.value);
  }

  protected closeKbDropdown(): void {
    this.kbDropdownOpen.set(false);
    this.kbSearchFilter.set('');
  }

  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }
}
