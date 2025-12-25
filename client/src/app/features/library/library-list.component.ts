import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideBook,
  lucideLoader2,
  lucideTrash2,
  lucideSearch,
  lucideLibrary,
} from '@ng-icons/lucide';
import { LibraryService, LibraryBook } from './library.service';
import { KnowledgeBaseService } from '../knowledge-bases/knowledge-base.service';
import { HlmButtonDirective } from '../../ui/button';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-library-list',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, DatePipe],
  viewProviders: [
    provideIcons({
      lucidePlus,
      lucideBook,
      lucideLoader2,
      lucideTrash2,
      lucideSearch,
      lucideLibrary,
    }),
  ],
  template: `
    <div class="p-6 lg:p-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Library</h1>
          <p class="mt-1 text-muted-foreground">
            AI-generated technical documentation from your code.
          </p>
        </div>
        <button hlmBtn (click)="openCreateDialog()">
          <ng-icon name="lucidePlus" class="mr-2 h-4 w-4" />
          New Book
        </button>
      </div>

      @if (loading()) {
        <div class="mt-8 flex items-center justify-center py-12">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (books().length === 0) {
        <div class="mt-8 rounded-lg border border-dashed bg-muted/50 p-12 text-center">
          <ng-icon name="lucideLibrary" class="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 class="mt-4 text-lg font-semibold">No books yet</h3>
          <p class="mt-2 text-muted-foreground">
            Generate your first documentation book from a knowledge base.
          </p>
          <button hlmBtn class="mt-4" (click)="openCreateDialog()">
            <ng-icon name="lucidePlus" class="mr-2 h-4 w-4" />
            Create Book
          </button>
        </div>
      } @else {
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (book of books(); track book.id) {
            <div
              class="group relative rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
              (click)="navigateToBook(book)"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="rounded-lg bg-primary/10 p-2">
                    <ng-icon name="lucideBook" class="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-card-foreground">{{ book.title }}</h3>
                    <p class="text-sm text-muted-foreground">
                      Created {{ book.createdAt | date }}
                    </p>
                  </div>
                </div>
                <span [class]="getStatusClasses(book.status)">
                  {{ book.status }}
                </span>
              </div>

              @if (book.description) {
                <p class="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {{ book.description }}
                </p>
              }

              <!-- Actions (shown on hover) -->
              <div class="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  (click)="deleteBook(book, $event)"
                  title="Delete"
                >
                  <ng-icon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Create Dialog -->
      @if (showCreateDialog()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="closeCreateDialog()">
          <div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold">Create New Book</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Select a Knowledge Base to generate documentation from.
            </p>

            <div class="mt-4 space-y-4">
              <div>
                <label class="text-sm font-medium">Knowledge Base</label>
                <select
                  class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  (change)="onKbSelect($event)"
                >
                  <option value="" disabled selected>Select a Knowledge Base...</option>
                  @for (kb of availableKnowledgeBases(); track kb.id) {
                    <option [value]="kb.id">{{ kb.name }} ({{ kb.documentCount }} docs)</option>
                  }
                </select>
                @if (knowledgeBases().length === 0) {
                  <p class="mt-1 text-xs text-destructive">
                    No Knowledge Bases found. Please create one first.
                  </p>
                } @else if (availableKnowledgeBases().length === 0) {
                   <p class="mt-1 text-xs text-amber-600">
                    All Knowledge Bases already have books associated with them.
                  </p>
                }
              </div>
            </div>

            <div class="mt-6 flex justify-end gap-2">
              <button hlmBtn variant="outline" type="button" (click)="closeCreateDialog()">Cancel</button>
              <button
                hlmBtn
                type="button"
                [disabled]="!selectedKbId() || creating()"
                (click)="createBook()"
              >
                @if (creating()) {
                  <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                }
                Generate
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class LibraryListComponent implements OnInit, OnDestroy {
  private libraryService = inject(LibraryService);
  private kbService = inject(KnowledgeBaseService);
  private router = inject(Router);

  protected books = signal<LibraryBook[]>([]);
  protected knowledgeBases = this.kbService.knowledgeBases;

  // Computed signal to filter out KBs that already have books
  protected availableKnowledgeBases = computed(() => {
    const existingKbIds = new Set(this.books().map(b => b.knowledgeBaseId));
    return this.knowledgeBases().filter(kb => !existingKbIds.has(kb.id));
  });

  protected loading = signal(true);
  protected showCreateDialog = signal(false);
  protected selectedKbId = signal<number | null>(null);
  protected creating = signal(false);

  private pollInterval: any;

  ngOnInit(): void {
    this.loadBooks();
    this.kbService.loadKnowledgeBases();

    // Poll every 5 seconds to check for status updates
    this.pollInterval = setInterval(() => {
      if (this.books().some(b => b.status === 'generating')) {
        this.loadBooks(true); // silent reload
      }
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private loadBooks(silent = false): void {
    if (!silent) this.loading.set(true);
    this.libraryService.listBooks().subscribe({
      next: (books) => {
        this.books.set(books);
        if (!silent) this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading books:', err);
        if (!silent) this.loading.set(false);
      },
    });
  }

  protected openCreateDialog(): void {
    this.selectedKbId.set(null);
    this.showCreateDialog.set(true);
  }

  protected closeCreateDialog(): void {
    this.showCreateDialog.set(false);
  }

  protected onKbSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedKbId.set(parseInt(select.value));
  }

  protected createBook(): void {
    const kbId = this.selectedKbId();
    if (!kbId) return;

    this.creating.set(true);
    this.libraryService.createBook(kbId).subscribe({
      next: (book) => {
        this.books.update((current) => [book, ...current]);
        this.closeCreateDialog();
        this.creating.set(false);
      },
      error: (err) => {
        console.error('Error creating book:', err);
        this.creating.set(false);
      },
    });
  }

  protected navigateToBook(book: LibraryBook): void {
    this.router.navigate(['/library', book.id]);
  }

  protected deleteBook(book: LibraryBook, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${book.title}"?`)) {
      this.libraryService.deleteBook(book.id).subscribe(() => {
        this.books.update((current) => current.filter((b) => b.id !== book.id));
      });
    }
  }

  protected getStatusClasses(status: string): string {
    const base = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium';
    switch (status) {
      case 'ready':
        return `${base} bg-green-100 text-green-700`;
      case 'generating':
        return `${base} bg-blue-100 text-blue-700 animate-pulse`;
      case 'error':
        return `${base} bg-red-100 text-red-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  }
}
