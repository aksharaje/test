import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideDatabase,
  lucideFileText,
  lucideGithub,
  lucideLoader2,
  lucideTrash2,
  lucideSettings,
  lucideSearch,
  lucideShare2,
  lucideUsers,
} from '@ng-icons/lucide';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { KnowledgeBase } from './knowledge-base.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-knowledge-bases-list',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucidePlus,
      lucideDatabase,
      lucideFileText,
      lucideGithub,
      lucideLoader2,
      lucideTrash2,
      lucideSettings,
      lucideSearch,
      lucideShare2,
      lucideUsers,
    }),
  ],
  template: `
    <div class="p-6 lg:p-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Knowledge Bases</h1>
          <p class="mt-1 text-muted-foreground">
            Create and manage knowledge bases for AI-powered search and retrieval.
          </p>
        </div>
        <button hlmBtn (click)="openCreateDialog()">
          <ng-icon name="lucidePlus" class="mr-2 h-4 w-4" />
          New Knowledge Base
        </button>
      </div>

      @if (service.loading()) {
        <div class="mt-8 flex items-center justify-center py-12">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (service.knowledgeBases().length === 0) {
        <div class="mt-8 rounded-lg border border-dashed bg-muted/50 p-12 text-center">
          <ng-icon name="lucideDatabase" class="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 class="mt-4 text-lg font-semibold">No knowledge bases yet</h3>
          <p class="mt-2 text-muted-foreground">
            Create your first knowledge base to start organizing your documents.
          </p>
          <button hlmBtn class="mt-4" (click)="openCreateDialog()">
            <ng-icon name="lucidePlus" class="mr-2 h-4 w-4" />
            Create Knowledge Base
          </button>
        </div>
      } @else {
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (kb of service.knowledgeBases(); track kb.id) {
            <div
              class="group relative rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
              (click)="navigateToDetail(kb)"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="rounded-lg bg-primary/10 p-2">
                    <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-card-foreground">{{ kb.name }}</h3>
                    <p class="text-sm text-muted-foreground">
                      {{ kb.documentCount }} document{{ kb.documentCount !== 1 ? 's' : '' }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  @if (kb.isShared) {
                    <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      <ng-icon name="lucideUsers" class="h-3 w-3" />
                      Shared
                    </span>
                  }
                  <span [class]="getStatusClasses(kb.status)">
                    {{ kb.status }}
                  </span>
                </div>
              </div>

              @if (kb.description) {
                <p class="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {{ kb.description }}
                </p>
              }

              <div class="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span class="flex items-center gap-1">
                  <ng-icon name="lucideFileText" class="h-4 w-4" />
                  {{ kb.totalChunks }} chunks
                </span>
              </div>

              <!-- Actions (shown on hover) -->
              <div class="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  (click)="searchKnowledgeBase(kb, $event)"
                  title="Search"
                >
                  <ng-icon name="lucideSearch" class="h-4 w-4" />
                </button>
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  (click)="toggleShared(kb, $event)"
                  [title]="kb.isShared ? 'Make Private' : 'Share with Team'"
                >
                  <ng-icon name="lucideShare2" class="h-4 w-4" [class.text-blue-600]="kb.isShared" />
                </button>
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  (click)="deleteKnowledgeBase(kb, $event)"
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
            <h2 class="text-lg font-semibold">Create Knowledge Base</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Give your knowledge base a name and optional description.
            </p>

            <div class="mt-4 space-y-4">
              <div>
                <label class="text-sm font-medium">Name</label>
                <input
                  type="text"
                  class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="My Knowledge Base"
                  [value]="newKbName()"
                  (input)="onNameInput($event)"
                />
              </div>
              <div>
                <label class="text-sm font-medium">Description (optional)</label>
                <textarea
                  class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows="3"
                  placeholder="A brief description of this knowledge base..."
                  [value]="newKbDescription()"
                  (input)="onDescriptionInput($event)"
                ></textarea>
              </div>
            </div>

            <div class="mt-6 flex justify-end gap-2">
              <button hlmBtn variant="outline" type="button" (click)="closeCreateDialog()">Cancel</button>
              <button
                hlmBtn
                type="button"
                [disabled]="!newKbName() || creating()"
                (click)="createKnowledgeBase()"
              >
                @if (creating()) {
                  <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                }
                Create
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class KnowledgeBasesListComponent implements OnInit {
  protected service = inject(KnowledgeBaseService);
  private router = inject(Router);

  protected showCreateDialog = signal(false);
  protected newKbName = signal('');
  protected newKbDescription = signal('');
  protected creating = signal(false);

  ngOnInit(): void {
    this.service.loadKnowledgeBases();
  }

  protected openCreateDialog(): void {
    this.newKbName.set('');
    this.newKbDescription.set('');
    this.showCreateDialog.set(true);
  }

  protected closeCreateDialog(): void {
    this.showCreateDialog.set(false);
  }

  protected async createKnowledgeBase(): Promise<void> {
    this.creating.set(true);
    try {
      const kb = await this.service.createKnowledgeBase({
        name: this.newKbName(),
        description: this.newKbDescription() || undefined,
      });

      if (kb) {
        this.closeCreateDialog();
        this.navigateToDetail(kb);
      }
    } finally {
      this.creating.set(false);
    }
  }

  protected navigateToDetail(kb: KnowledgeBase): void {
    this.router.navigate(['/knowledge-bases', kb.id]);
  }

  protected searchKnowledgeBase(kb: KnowledgeBase, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/knowledge-bases', kb.id, 'search']);
  }

  protected async deleteKnowledgeBase(kb: KnowledgeBase, event: Event): Promise<void> {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${kb.name}"? This action cannot be undone.`)) {
      await this.service.deleteKnowledgeBase(kb.id);
    }
  }

  protected async toggleShared(kb: KnowledgeBase, event: Event): Promise<void> {
    event.stopPropagation();
    const action = kb.isShared ? 'make private' : 'share with all users';
    if (confirm(`Are you sure you want to ${action} "${kb.name}"?`)) {
      await this.service.toggleShared(kb.id);
    }
  }

  protected onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newKbName.set(input.value);
  }

  protected onDescriptionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.newKbDescription.set(textarea.value);
  }

  protected getStatusClasses(status: string): string {
    const base = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium';
    switch (status) {
      case 'ready':
        return `${base} bg-green-100 text-green-700`;
      case 'processing':
        return `${base} bg-yellow-100 text-yellow-700`;
      case 'error':
        return `${base} bg-red-100 text-red-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  }
}
