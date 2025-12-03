import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideSearch,
  lucideLoader2,
  lucideFileText,
  lucideInfo,
} from '@ng-icons/lucide';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { KnowledgeBase, SearchResult } from './knowledge-base.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-knowledge-base-search',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideSearch,
      lucideLoader2,
      lucideFileText,
      lucideInfo,
    }),
  ],
  template: `
    <div class="p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button hlmBtn variant="ghost" size="icon" (click)="goBack()">
          <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
        </button>
        <div class="flex-1">
          @if (kb()) {
            <h1 class="text-2xl font-bold text-foreground">Search: {{ kb()!.name }}</h1>
            <p class="mt-1 text-muted-foreground">
              Find relevant content using semantic search.
            </p>
          }
        </div>
      </div>

      @if (kb()) {
        <!-- Search Input -->
        <div class="mt-6">
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Ask a question or search for information..."
              class="w-full rounded-lg border bg-background py-3 pl-10 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              [value]="query()"
              (input)="onQueryInput($event)"
              (keyup.enter)="search()"
            />
          </div>
          <div class="mt-4 flex items-center gap-4">
            <button
              hlmBtn
              [disabled]="!query() || searching()"
              (click)="search()"
            >
              @if (searching()) {
                <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
              } @else {
                <ng-icon name="lucideSearch" class="mr-2 h-4 w-4" />
              }
              Search
            </button>
            <div class="flex items-center gap-2">
              <label class="text-sm text-muted-foreground">Results:</label>
              <select
                class="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                [value]="resultLimit()"
                (change)="onResultLimitChange($event)"
              >
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="mt-8">
          @if (hasSearched() && results().length === 0) {
            <div class="rounded-lg border border-dashed bg-muted/50 p-8 text-center">
              <ng-icon name="lucideInfo" class="mx-auto h-10 w-10 text-muted-foreground" />
              <p class="mt-2 text-muted-foreground">
                No results found for "{{ lastQuery() }}". Try a different search term.
              </p>
            </div>
          } @else if (results().length > 0) {
            <div class="space-y-4">
              <p class="text-sm text-muted-foreground">
                Found {{ results().length }} result{{ results().length !== 1 ? 's' : '' }} for "{{ lastQuery() }}"
              </p>
              @for (result of results(); track result.chunkId) {
                <div class="rounded-lg border bg-card p-4">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <ng-icon name="lucideFileText" class="h-4 w-4 text-muted-foreground" />
                      <span class="text-sm font-medium">{{ result.documentName }}</span>
                    </div>
                    <span class="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {{ (result.similarity * 100).toFixed(1) }}% match
                    </span>
                  </div>
                  <div class="mt-3 rounded-md bg-muted/50 p-3">
                    <p class="whitespace-pre-wrap text-sm">{{ result.content }}</p>
                  </div>
                  <p class="mt-2 text-xs text-muted-foreground">
                    Chunk #{{ result.metadata.position + 1 }}
                  </p>
                </div>
              }
            </div>
          } @else {
            <div class="rounded-lg border border-dashed bg-muted/50 p-8 text-center">
              <ng-icon name="lucideSearch" class="mx-auto h-10 w-10 text-muted-foreground" />
              <p class="mt-2 text-muted-foreground">
                Enter a query to search the knowledge base.
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class KnowledgeBaseSearchComponent implements OnInit {
  protected service = inject(KnowledgeBaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected kb = signal<KnowledgeBase | null>(null);
  protected query = signal('');
  protected lastQuery = signal('');
  protected results = signal<SearchResult[]>([]);
  protected searching = signal(false);
  protected hasSearched = signal(false);
  protected resultLimit = signal(5);

  ngOnInit(): void {
    const id = parseInt(this.route.snapshot.params['id']);
    this.loadKnowledgeBase(id);
  }

  private async loadKnowledgeBase(id: number): Promise<void> {
    const kb = await this.service.getKnowledgeBase(id);
    this.kb.set(kb);
  }

  protected goBack(): void {
    if (this.kb()) {
      this.router.navigate(['/knowledge-bases', this.kb()!.id]);
    } else {
      this.router.navigate(['/knowledge-bases']);
    }
  }

  protected async search(): Promise<void> {
    if (!this.kb() || !this.query()) return;

    this.searching.set(true);
    this.hasSearched.set(true);
    this.lastQuery.set(this.query());

    try {
      const response = await this.service.search(
        this.kb()!.id,
        this.query(),
        this.resultLimit()
      );
      this.results.set(response?.results || []);
    } finally {
      this.searching.set(false);
    }
  }

  protected onQueryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.query.set(input.value);
  }

  protected onResultLimitChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.resultLimit.set(+select.value);
  }
}
