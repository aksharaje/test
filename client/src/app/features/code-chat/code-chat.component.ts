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
    <div class="flex h-full">
      <!-- Left Sidebar: Sessions List -->
      <div class="w-72 border-r flex flex-col bg-muted/30">
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
              @for (session of service.sessions(); track session.id) {
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
      </div>

      <!-- Main Chat Area -->
      <div class="flex-1 flex flex-col">
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
                Select a code repository from the left panel and click "New Chat" to begin.
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
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .prose {
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
    }

    .prose pre {
      @apply bg-muted rounded-lg p-3 overflow-x-auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .prose code {
      @apply bg-muted px-1 py-0.5 rounded text-sm;
      word-break: break-all;
    }

    .prose pre code {
      @apply bg-transparent p-0;
    }

    .prose table {
      @apply w-full text-sm;
      display: block;
      overflow-x: auto;
    }

    .prose th, .prose td {
      @apply border px-2 py-1;
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
