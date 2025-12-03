import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideUpload,
  lucideGithub,
  lucideFileText,
  lucideLoader2,
  lucideTrash2,
  lucideCheck,
  lucideX,
  lucideAlertCircle,
  lucideClock,
  lucidePencil,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { Document, KnowledgeBase } from './knowledge-base.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-knowledge-base-detail',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideUpload,
      lucideGithub,
      lucideFileText,
      lucideLoader2,
      lucideTrash2,
      lucideCheck,
      lucideX,
      lucideAlertCircle,
      lucideClock,
      lucidePencil,
      lucideRefreshCw,
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
            @if (isEditing()) {
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  [value]="editName()"
                  (input)="onNameInput($event)"
                  (keydown.enter)="saveName()"
                  (keydown.escape)="cancelEdit()"
                  class="text-2xl font-bold bg-background border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                  #nameInput
                />
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  (click)="saveName()"
                  title="Save"
                  [disabled]="saving()"
                >
                  @if (saving()) {
                    <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
                  } @else {
                    <ng-icon name="lucideCheck" class="h-4 w-4 text-green-600" />
                  }
                </button>
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  (click)="cancelEdit()"
                  title="Cancel"
                >
                  <ng-icon name="lucideX" class="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            } @else {
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold text-foreground">{{ kb()!.name }}</h1>
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  (click)="startEdit()"
                  title="Rename"
                >
                  <ng-icon name="lucidePencil" class="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            }
            @if (kb()!.description) {
              <p class="mt-1 text-muted-foreground">{{ kb()!.description }}</p>
            }
          }
        </div>
      </div>

      @if (service.loading() && !kb()) {
        <div class="mt-8 flex items-center justify-center py-12">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (kb()) {
        <!-- Stats -->
        <div class="mt-6 grid gap-4 sm:grid-cols-3">
          <div class="rounded-lg border bg-card p-4">
            <p class="text-sm text-muted-foreground">Documents</p>
            <p class="mt-1 text-2xl font-bold">{{ kb()!.documentCount }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <p class="text-sm text-muted-foreground">Total Chunks</p>
            <p class="mt-1 text-2xl font-bold">{{ kb()!.totalChunks }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <p class="text-sm text-muted-foreground">Status</p>
            <p class="mt-1">
              <span [class]="getStatusClasses(kb()!.status)">
                {{ kb()!.status }}
              </span>
            </p>
          </div>
        </div>

        <!-- Import Actions -->
        <div class="mt-8">
          <h2 class="text-lg font-semibold">Add Documents</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <!-- File Upload -->
            <div
              class="relative rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-muted/50"
              [class.border-primary]="isDragging()"
              [class.bg-muted/50]="isDragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
            >
              <input
                type="file"
                multiple
                accept=".txt,.md,.html,.css,.js,.ts,.json,.yaml,.yml,.xml,.py,.java,.go,.rs"
                class="absolute inset-0 cursor-pointer opacity-0"
                (change)="onFileSelect($event)"
              />
              <ng-icon name="lucideUpload" class="mx-auto h-10 w-10 text-muted-foreground" />
              <p class="mt-2 font-medium">Upload Files</p>
              <p class="text-sm text-muted-foreground">
                Drag & drop or click to select files
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                Supports .txt, .md, .js, .ts, .py, .json, and more
              </p>
            </div>

            <!-- GitHub Import -->
            <div class="rounded-lg border p-6">
              <ng-icon name="lucideGithub" class="mx-auto h-10 w-10 text-muted-foreground" />
              <p class="mt-2 text-center font-medium">Import from GitHub</p>
              <div class="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="https://github.com/owner/repo"
                  class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="githubUrl()"
                  (input)="onGithubUrlInput($event)"
                />
                <input
                  type="password"
                  placeholder="GitHub token (optional, for private repos)"
                  class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="githubToken()"
                  (input)="onGithubTokenInput($event)"
                />
                <button
                  hlmBtn
                  class="w-full"
                  [disabled]="!githubUrl() || importing()"
                  (click)="importFromGitHub()"
                >
                  @if (importing()) {
                    <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  }
                  Import Repository
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Documents List -->
        <div class="mt-8">
          <h2 class="text-lg font-semibold">Documents</h2>
          @if (importing()) {
            <!-- Skeleton loader while importing -->
            <div class="mt-4 space-y-2">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="flex items-center justify-between rounded-lg border bg-card p-4 animate-pulse">
                  <div class="flex items-center gap-3">
                    <div class="h-5 w-5 rounded bg-muted"></div>
                    <div class="space-y-2">
                      <div class="h-4 w-32 rounded bg-muted"></div>
                      <div class="h-3 w-48 rounded bg-muted"></div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="h-6 w-20 rounded-full bg-muted"></div>
                    <div class="h-8 w-8 rounded bg-muted"></div>
                  </div>
                </div>
              }
              <p class="text-center text-sm text-muted-foreground mt-4">
                <ng-icon name="lucideLoader2" class="inline h-4 w-4 animate-spin mr-2" />
                Importing repository files...
              </p>
            </div>
          } @else if (service.documents().length === 0) {
            <div class="mt-4 rounded-lg border border-dashed bg-muted/50 p-8 text-center">
              <ng-icon name="lucideFileText" class="mx-auto h-10 w-10 text-muted-foreground" />
              <p class="mt-2 text-muted-foreground">
                No documents yet. Upload files or import from GitHub to get started.
              </p>
            </div>
          } @else {
            <div class="mt-4 space-y-2">
              @for (doc of service.documents(); track doc.id) {
                <div class="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div class="flex items-center gap-3">
                    <ng-icon
                      [name]="doc.source === 'github' ? 'lucideGithub' : 'lucideFileText'"
                      class="h-5 w-5 text-muted-foreground"
                    />
                    <div>
                      <p class="font-medium">{{ doc.name }}</p>
                      <p class="text-sm text-muted-foreground">
                        {{ doc.chunkCount }} chunks
                        @if (doc.sourceMetadata.path) {
                          · {{ doc.sourceMetadata.path }}
                        }
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span [class]="getDocStatusClasses(doc.status)">
                      @switch (doc.status) {
                        @case ('indexed') {
                          <ng-icon name="lucideCheck" class="h-3 w-3" />
                        }
                        @case ('processing') {
                          <ng-icon name="lucideLoader2" class="h-3 w-3 animate-spin" />
                        }
                        @case ('error') {
                          <ng-icon name="lucideAlertCircle" class="h-3 w-3" />
                        }
                        @default {
                          <ng-icon name="lucideClock" class="h-3 w-3" />
                        }
                      }
                      {{ doc.status }}
                    </span>
                    @if (doc.status === 'error' || doc.status === 'pending') {
                      <button
                        hlmBtn
                        variant="ghost"
                        size="icon"
                        (click)="reprocessDocument(doc)"
                        [title]="doc.status === 'error' ? 'Retry' : 'Reprocess'"
                      >
                        <ng-icon name="lucideRefreshCw" class="h-4 w-4 text-primary" />
                      </button>
                    }
                    <button
                      hlmBtn
                      variant="ghost"
                      size="icon"
                      (click)="deleteDocument(doc)"
                      title="Delete"
                    >
                      <ng-icon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class KnowledgeBaseDetailComponent implements OnInit, OnDestroy {
  protected service = inject(KnowledgeBaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected kb = signal<KnowledgeBase | null>(null);
  protected isDragging = signal(false);
  protected githubUrl = signal('');
  protected githubToken = signal('');
  protected importing = signal(false);
  protected isEditing = signal(false);
  protected editName = signal('');
  protected saving = signal(false);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 3000;

  ngOnInit(): void {
    const id = parseInt(this.route.snapshot.params['id']);
    this.loadKnowledgeBase(id);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      if (this.kb() && this.service.hasProcessingDocuments()) {
        await this.service.loadDocuments(this.kb()!.id);
        // Also refresh KB stats
        const updated = await this.service.getKnowledgeBase(this.kb()!.id);
        if (updated) this.kb.set(updated);
      } else {
        this.stopPolling();
      }
    }, this.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private checkAndStartPolling(): void {
    if (this.service.hasProcessingDocuments()) {
      this.startPolling();
    }
  }

  private async loadKnowledgeBase(id: number): Promise<void> {
    const kb = await this.service.getKnowledgeBase(id);
    this.kb.set(kb);
    if (kb) {
      await this.service.loadDocuments(kb.id);
      this.checkAndStartPolling();
    }
  }

  protected goBack(): void {
    this.router.navigate(['/knowledge-bases']);
  }

  protected startEdit(): void {
    if (this.kb()) {
      this.editName.set(this.kb()!.name);
      this.isEditing.set(true);
    }
  }

  protected cancelEdit(): void {
    this.isEditing.set(false);
    this.editName.set('');
  }

  protected onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editName.set(input.value);
  }

  protected async saveName(): Promise<void> {
    if (!this.kb() || !this.editName().trim()) return;

    const newName = this.editName().trim();
    if (newName === this.kb()!.name) {
      this.cancelEdit();
      return;
    }

    this.saving.set(true);
    try {
      const updated = await this.service.updateKnowledgeBase(this.kb()!.id, { name: newName });
      if (updated) {
        this.kb.set(updated);
      }
      this.isEditing.set(false);
      this.editName.set('');
    } finally {
      this.saving.set(false);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragging.set(false);

    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0 && this.kb()) {
      await this.service.uploadFiles(this.kb()!.id, files);
      await this.loadKnowledgeBase(this.kb()!.id);
    }
  }

  protected async onFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length > 0 && this.kb()) {
      await this.service.uploadFiles(this.kb()!.id, files);
      await this.loadKnowledgeBase(this.kb()!.id);
      input.value = '';
    }
  }

  protected async importFromGitHub(): Promise<void> {
    if (!this.kb() || !this.githubUrl()) return;

    this.importing.set(true);
    try {
      await this.service.importFromGitHub(this.kb()!.id, {
        repoUrl: this.githubUrl(),
        token: this.githubToken() || undefined,
      });
      this.githubUrl.set('');
      this.githubToken.set('');
      await this.loadKnowledgeBase(this.kb()!.id);
    } finally {
      this.importing.set(false);
    }
  }

  protected async deleteDocument(doc: Document): Promise<void> {
    if (!this.kb()) return;
    if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      await this.service.deleteDocument(this.kb()!.id, doc.id);
      await this.loadKnowledgeBase(this.kb()!.id);
    }
  }

  protected async reprocessDocument(doc: Document): Promise<void> {
    if (!this.kb()) return;
    await this.service.reprocessDocument(this.kb()!.id, doc.id);
    this.checkAndStartPolling();
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

  protected getDocStatusClasses(status: string): string {
    const base = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium';
    switch (status) {
      case 'indexed':
        return `${base} bg-green-100 text-green-700`;
      case 'processing':
        return `${base} bg-yellow-100 text-yellow-700`;
      case 'error':
        return `${base} bg-red-100 text-red-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  }

  protected onGithubUrlInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.githubUrl.set(input.value);
  }

  protected onGithubTokenInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.githubToken.set(input.value);
  }
}
