import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideCalendar,
  lucideUsers,
  lucidePlay,
  lucideLock,
  lucideCheck,
  lucideTrash2,
} from '@ng-icons/lucide';
import { PiPlanningService } from './pi-planning.service';
import { IntegrationService } from '../settings/integration.service';
import type { PiSession } from './pi-planning.types';
import type { JiraBoard } from '../settings/integration.types';

@Component({
  selector: 'app-pi-planning-list',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucidePlus,
      lucideCalendar,
      lucideUsers,
      lucidePlay,
      lucideLock,
      lucideCheck,
      lucideTrash2,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-6xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">PI Planning</h1>
          <p class="text-muted-foreground mt-1">
            Plan work across multiple teams and sprints
          </p>
        </div>
        @if (hasIntegration()) {
          <button
            hlmBtn
            variant="default"
            (click)="showCreateDialog.set(true)"
            [disabled]="service.loading()"
          >
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            New PI Session
          </button>
        }
      </div>

      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      @if (!hasIntegration()) {
        <div class="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <ng-icon hlmIcon name="lucideUsers" class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 class="font-medium text-lg mb-2">No Jira Integration</h3>
          <p class="text-muted-foreground mb-4">
            Connect your Jira account to start PI Planning.
          </p>
          <button hlmBtn variant="default" (click)="goToIntegrations()">
            Connect Jira
          </button>
        </div>
      } @else if (service.loading() && !service.hasSessions()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="bg-card rounded-lg border p-6 animate-pulse">
              <div class="h-6 bg-muted rounded w-1/3 mb-3"></div>
              <div class="h-4 bg-muted rounded w-1/2"></div>
            </div>
          }
        </div>
      } @else if (service.hasSessions()) {
        <div class="space-y-4">
          @for (session of service.sessions(); track session.id) {
            <div
              class="bg-card rounded-lg border p-6 hover:border-primary/50 transition-colors cursor-pointer"
              (click)="openSession(session)"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-lg">{{ session.name }}</h3>
                    @switch (session.status) {
                      @case ('draft') {
                        <span class="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      }
                      @case ('active') {
                        <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ng-icon hlmIcon name="lucidePlay" class="h-3 w-3" />
                          Active
                        </span>
                      }
                      @case ('locked') {
                        <span class="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ng-icon hlmIcon name="lucideLock" class="h-3 w-3" />
                          Locked
                        </span>
                      }
                      @case ('completed') {
                        <span class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ng-icon hlmIcon name="lucideCheck" class="h-3 w-3" />
                          Completed
                        </span>
                      }
                    }
                  </div>
                  @if (session.description) {
                    <p class="text-muted-foreground mt-1">{{ session.description }}</p>
                  }
                  <div class="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span class="flex items-center gap-1">
                      <ng-icon hlmIcon name="lucideUsers" class="h-4 w-4" />
                      {{ session.boards?.length || 0 }} teams
                    </span>
                    <span class="flex items-center gap-1">
                      <ng-icon hlmIcon name="lucideCalendar" class="h-4 w-4" />
                      {{ session.sprintCount }} sprints
                    </span>
                    @if (session.startDate) {
                      <span>
                        {{ formatDate(session.startDate) }}
                        @if (session.endDate) {
                          - {{ formatDate(session.endDate) }}
                        }
                      </span>
                    }
                  </div>
                </div>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  (click)="confirmDelete(session, $event)"
                >
                  <ng-icon hlmIcon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <ng-icon hlmIcon name="lucideCalendar" class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 class="font-medium text-lg mb-2">No PI Sessions</h3>
          <p class="text-muted-foreground mb-4">
            Create your first PI planning session to start planning work across teams.
          </p>
          <button hlmBtn variant="default" (click)="showCreateDialog.set(true)">
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            New PI Session
          </button>
        </div>
      }

      <!-- Create Dialog -->
      @if (showCreateDialog()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="showCreateDialog.set(false)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-lg mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-4">Create PI Planning Session</h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.name"
                  placeholder="PI 2024.1"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Description</label>
                <textarea
                  [(ngModel)]="createForm.description"
                  placeholder="Q1 2024 Planning"
                  rows="2"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    [(ngModel)]="createForm.startDate"
                    class="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    [(ngModel)]="createForm.endDate"
                    class="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Sprint Count</label>
                <input
                  type="number"
                  [(ngModel)]="createForm.sprintCount"
                  min="1"
                  max="12"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Teams (Boards) *</label>
                <div class="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  @for (board of boards(); track board.jiraId) {
                    <label class="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted/50 rounded">
                      <input
                        type="checkbox"
                        [checked]="createForm.boardIds.includes(board.jiraId)"
                        (change)="toggleBoard(board.jiraId)"
                        class="rounded"
                      />
                      <span>{{ board.name }}</span>
                      <span class="text-xs text-muted-foreground">({{ board.type }})</span>
                    </label>
                  }
                  @if (boards().length === 0) {
                    <p class="text-sm text-muted-foreground p-2">No boards found. Sync your integration first.</p>
                  }
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="showCreateDialog.set(false)">
                Cancel
              </button>
              <button
                hlmBtn
                variant="default"
                (click)="createSession()"
                [disabled]="!createForm.name || createForm.boardIds.length === 0 || service.loading()"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation -->
      @if (deleteCandidate()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="deleteCandidate.set(null)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-2">Delete PI Session</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete
              <strong>{{ deleteCandidate()?.name }}</strong>? This will remove all
              planned items in this session.
            </p>
            <div class="flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="deleteCandidate.set(null)">
                Cancel
              </button>
              <button
                hlmBtn
                variant="destructive"
                (click)="deleteSession()"
                [disabled]="service.loading()"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PiPlanningListComponent implements OnInit {
  protected service = inject(PiPlanningService);
  private integrationService = inject(IntegrationService);
  private router = inject(Router);

  showCreateDialog = signal(false);
  deleteCandidate = signal<PiSession | null>(null);
  boards = signal<JiraBoard[]>([]);
  integrationId = signal<number | null>(null);

  createForm = {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    sprintCount: 5,
    boardIds: [] as number[],
  };

  async ngOnInit() {
    await this.integrationService.loadIntegrations();

    const connected = this.integrationService.connectedIntegrations();
    if (connected.length > 0) {
      const integration = connected[0];
      this.integrationId.set(integration.id);
      await this.service.loadSessions(integration.id);
      await this.integrationService.loadBoards(integration.id);
      this.boards.set(this.integrationService.boards() as unknown as JiraBoard[]);
    }
  }

  hasIntegration(): boolean {
    return this.integrationId() !== null;
  }

  toggleBoard(boardId: number): void {
    const ids = [...this.createForm.boardIds];
    const idx = ids.indexOf(boardId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(boardId);
    }
    this.createForm.boardIds = ids;
  }

  async createSession(): Promise<void> {
    const integrationId = this.integrationId();
    if (!integrationId) return;

    const session = await this.service.createSession(integrationId, {
      name: this.createForm.name,
      description: this.createForm.description || undefined,
      startDate: this.createForm.startDate || undefined,
      endDate: this.createForm.endDate || undefined,
      sprintCount: this.createForm.sprintCount,
      boardIds: this.createForm.boardIds,
    });

    if (session) {
      this.showCreateDialog.set(false);
      this.createForm = {
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        sprintCount: 5,
        boardIds: [],
      };
      this.openSession(session);
    }
  }

  openSession(session: PiSession): void {
    const integrationId = this.integrationId();
    if (integrationId) {
      this.router.navigate(['/pi-planning', integrationId, session.id]);
    }
  }

  confirmDelete(session: PiSession, event: Event): void {
    event.stopPropagation();
    this.deleteCandidate.set(session);
  }

  async deleteSession(): Promise<void> {
    const integrationId = this.integrationId();
    const session = this.deleteCandidate();
    if (!integrationId || !session) return;

    await this.service.deleteSession(integrationId, session.id);
    this.deleteCandidate.set(null);
  }

  goToIntegrations(): void {
    this.router.navigate(['/settings/integrations']);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
