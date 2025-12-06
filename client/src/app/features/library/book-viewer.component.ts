import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideChevronDown,
  lucideBook,
  lucideFileText,
  lucideSettings,
  lucideMenu,
  lucideArrowLeft,
} from '@ng-icons/lucide';
import { LibraryService, LibraryBook, LibraryPage } from './library.service';
import { MarkdownModule } from 'ngx-markdown';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-book-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIcon, MarkdownModule, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideChevronRight,
      lucideChevronDown,
      lucideBook,
      lucideFileText,
      lucideSettings,
      lucideMenu,
      lucideArrowLeft,
    }),
  ],
  template: `
    <div class="flex h-[calc(100vh-4rem)] overflow-hidden">
      <!-- Sidebar -->
      <aside
        class="w-64 flex-shrink-0 border-r bg-muted/10 transition-all duration-300"
        [class.-ml-64]="!sidebarOpen()"
      >
        <div class="flex h-full flex-col">
          <div class="border-b p-4">
            <button
              hlmBtn
              variant="ghost"
              size="sm"
              class="-ml-2 mb-2 text-muted-foreground"
              (click)="goBack()"
            >
              <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
              Back to Library
            </button>
            <h2 class="font-semibold line-clamp-1" [title]="book()?.title">
              {{ book()?.title || 'Loading...' }}
            </h2>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <nav class="space-y-1">
              @for (page of pages(); track page.id) {
                <div class="space-y-1">
                  <!-- Parent Page Item -->
                  <button
                    class="flex w-full items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    [class.bg-accent]="selectedPage()?.id === page.id"
                    [class.text-accent-foreground]="selectedPage()?.id === page.id"
                    (click)="selectPage(page)"
                  >
                    <ng-icon
                      [name]="getPageIcon(page)"
                      class="mr-2 h-4 w-4 text-muted-foreground"
                    />
                    <span class="truncate">{{ page.title }}</span>
                  </button>

                  <!-- Children -->
                  @if (page.children?.length) {
                    <div class="ml-4 space-y-1 border-l pl-2">
                      @for (child of page.children; track child.id) {
                        <button
                          class="flex w-full items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                          [class.bg-accent]="selectedPage()?.id === child.id"
                          [class.text-accent-foreground]="selectedPage()?.id === child.id"
                          (click)="selectPage(child)"
                        >
                          <span class="truncate">{{ child.title }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </nav>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto bg-background">
        <div class="container max-w-4xl py-8 pl-12">
          <!-- Mobile Sidebar Toggle -->
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            class="mb-4 lg:hidden"
            (click)="toggleSidebar()"
          >
            <ng-icon name="lucideMenu" class="h-5 w-5" />
          </button>

          @if (selectedPage(); as page) {
            <div class="mb-8 border-b pb-4">
              <div class="mb-2 flex items-center text-sm text-muted-foreground">
                <span>{{ book()?.title }}</span>
                <ng-icon name="lucideChevronRight" class="mx-2 h-4 w-4" />
                <span class="font-medium text-foreground">{{ page.title }}</span>
              </div>
              <h1 class="text-3xl font-bold tracking-tight">{{ page.title }}</h1>
            </div>

            <article class="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none">
              <markdown [data]="page.content"></markdown>
            </article>
          } @else {
            <div class="flex h-full flex-col items-center justify-center text-muted-foreground">
              <div class="rounded-full bg-muted p-6">
                <ng-icon name="lucideBook" class="h-12 w-12 opacity-50" />
              </div>
              <h3 class="mt-4 text-lg font-semibold text-foreground">Select a page</h3>
              <p class="text-sm">Choose a section from the sidebar to start reading.</p>
            </div>
          }
        </div>
      </main>
    </div>
  `,
  styles: `
    :host ::ng-deep .prose pre {
      background-color: #1e293b !important;
      color: #f8fafc !important;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
    }
    :host ::ng-deep .prose code {
      color: #f8fafc;
    }
    /* Keep inline code distinct if not in pre */
    :host ::ng-deep .prose :not(pre) > code {
      background-color: hsl(var(--muted));
      color: hsl(var(--foreground));
    }
  `
})
export class BookViewerComponent implements OnInit {
  private libraryService = inject(LibraryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected book = signal<LibraryBook | null>(null);
  protected pages = signal<LibraryPage[]>([]);
  protected selectedPage = signal<LibraryPage | null>(null);
  protected sidebarOpen = signal(true);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = parseInt(params['id']);
      if (id) {
        this.loadBook(id);
      }
    });
  }

  private loadBook(id: number): void {
    this.libraryService.getBook(id).subscribe((book) => {
      this.book.set(book);
    });

    this.libraryService.getBookPages(id).subscribe((pages) => {
      this.pages.set(pages);
      // Select first page by default if none selected
      if (pages.length > 0 && !this.selectedPage()) {
        this.selectPage(pages[0]);
      }
    });
  }

  protected selectPage(page: LibraryPage): void {
    this.selectedPage.set(page);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 1024) {
      this.sidebarOpen.set(false);
    }
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  protected goBack(): void {
    this.router.navigate(['/library']);
  }

  protected getPageIcon(page: LibraryPage): string {
    switch (page.type) {
      case 'integration_index':
      case 'integration_detail':
        return 'lucideSettings';
      default:
        return 'lucideFileText';
    }
  }
}
