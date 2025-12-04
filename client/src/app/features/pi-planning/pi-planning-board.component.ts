import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucidePlus,
  lucideDownload,
  lucideGripVertical,
  lucideX,
  lucideAlertTriangle,
} from '@ng-icons/lucide';
import { PiPlanningService } from './pi-planning.service';
import type { PiPlannedItem, BoardView, SprintView } from './pi-planning.types';

@Component({
  selector: 'app-pi-planning-board',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmIconDirective, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePlus,
      lucideDownload,
      lucideGripVertical,
      lucideX,
      lucideAlertTriangle,
    }),
  ],
  template: `
    <div class="h-screen flex flex-col">
      <!-- Header -->
      <div class="border-b p-4 flex items-center justify-between bg-card">
        <div class="flex items-center gap-4">
          <button hlmBtn variant="ghost" size="sm" (click)="goBack()">
            <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          </button>
          <div>
            <h1 class="text-xl font-bold">
              {{ service.selectedSession()?.name || 'PI Planning' }}
            </h1>
            <p class="text-sm text-muted-foreground">
              {{ service.selectedSession()?.description }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          @if (selectedBoard()) {
            <button
              hlmBtn
              variant="outline"
              size="sm"
              (click)="importFromBacklog()"
              [disabled]="service.loading()"
            >
              <ng-icon hlmIcon name="lucideDownload" class="mr-2 h-4 w-4" />
              Import Backlog
            </button>
          }
          <button
            hlmBtn
            variant="default"
            size="sm"
            (click)="showAddItemDialog.set(true)"
          >
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      @if (service.error()) {
        <div class="p-4 bg-red-50 border-b border-red-200">
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      @if (service.loading() && !service.planningView()) {
        <div class="flex-1 p-6">
          <div class="animate-pulse space-y-4">
            <div class="h-8 bg-muted rounded w-1/4"></div>
            <div class="grid grid-cols-5 gap-4">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="h-64 bg-muted rounded"></div>
              }
            </div>
          </div>
        </div>
      } @else if (service.planningView()) {
        <!-- Team Tabs -->
        <div class="border-b bg-muted/30">
          <div class="flex overflow-x-auto p-1">
            @for (board of service.planningView()!.boards; track board.boardId) {
              <button
                class="px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors"
                [class.bg-card]="selectedBoard()?.boardId === board.boardId"
                [class.border]="selectedBoard()?.boardId === board.boardId"
                [class.border-b-0]="selectedBoard()?.boardId === board.boardId"
                [class.text-muted-foreground]="selectedBoard()?.boardId !== board.boardId"
                (click)="selectBoard(board)"
              >
                {{ board.boardName }}
                <span class="ml-2 text-xs text-muted-foreground">
                  ({{ board.velocity || 0 }} pts/sprint)
                </span>
              </button>
            }
          </div>
        </div>

        <!-- Sprint Columns -->
        @if (selectedBoard()) {
          <div class="flex-1 overflow-x-auto p-4">
            <div class="flex gap-4 min-w-max">
              <!-- Backlog Column -->
              <div class="w-72 bg-muted/30 rounded-lg flex flex-col">
                <div class="p-3 border-b font-medium flex items-center justify-between">
                  <span>Backlog</span>
                  <span class="text-xs text-muted-foreground">
                    {{ backlogPoints() }} pts
                  </span>
                </div>
                <div class="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-250px)]">
                  @for (item of selectedBoard()!.backlog; track item.id) {
                    <div
                      class="bg-card p-3 rounded border hover:border-primary/50 cursor-pointer"
                      (click)="editItem(item)"
                    >
                      <div class="flex items-start gap-2">
                        <ng-icon hlmIcon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div class="flex-1 min-w-0">
                          @if (item.jiraIssueKey) {
                            <span class="text-xs text-muted-foreground">{{ item.jiraIssueKey }}</span>
                          }
                          <p class="text-sm font-medium truncate">{{ item.title }}</p>
                          @if (item.estimatedPoints) {
                            <span class="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              {{ item.estimatedPoints }} pts
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                  @if (selectedBoard()!.backlog.length === 0) {
                    <p class="text-sm text-muted-foreground text-center py-4">
                      No backlog items
                    </p>
                  }
                </div>
              </div>

              <!-- Sprint Columns -->
              @for (sprint of selectedBoard()!.sprints; track sprint.jiraId) {
                <div class="w-72 bg-muted/30 rounded-lg flex flex-col">
                  <div class="p-3 border-b">
                    <div class="flex items-center justify-between">
                      <span class="font-medium">{{ sprint.name }}</span>
                      @if (sprint.state === 'active') {
                        <span class="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      }
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                      <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          class="h-full transition-all"
                          [class.bg-green-500]="getCapacityPercent(sprint) <= 100"
                          [class.bg-yellow-500]="getCapacityPercent(sprint) > 100 && getCapacityPercent(sprint) <= 120"
                          [class.bg-red-500]="getCapacityPercent(sprint) > 120"
                          [style.width.%]="Math.min(getCapacityPercent(sprint), 100)"
                        ></div>
                      </div>
                      <span class="text-xs text-muted-foreground whitespace-nowrap">
                        {{ sprint.plannedPoints }}/{{ sprint.capacity }}
                      </span>
                    </div>
                    @if (getCapacityPercent(sprint) > 100) {
                      <div class="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                        <ng-icon hlmIcon name="lucideAlertTriangle" class="h-3 w-3" />
                        Over capacity
                      </div>
                    }
                  </div>
                  <div class="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                    @for (item of sprint.items; track item.id) {
                      <div
                        class="bg-card p-3 rounded border hover:border-primary/50 cursor-pointer"
                        (click)="editItem(item)"
                      >
                        <div class="flex items-start gap-2">
                          <ng-icon hlmIcon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div class="flex-1 min-w-0">
                            @if (item.jiraIssueKey) {
                              <span class="text-xs text-muted-foreground">{{ item.jiraIssueKey }}</span>
                            }
                            <p class="text-sm font-medium truncate">{{ item.title }}</p>
                            @if (item.estimatedPoints) {
                              <span class="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                {{ item.estimatedPoints }} pts
                              </span>
                            }
                          </div>
                        </div>
                      </div>
                    }
                    @if (sprint.items.length === 0) {
                      <p class="text-sm text-muted-foreground text-center py-4">
                        Drop items here
                      </p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }

      <!-- Add/Edit Item Dialog -->
      @if (showAddItemDialog() || editingItem()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="closeItemDialog()"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-4">
              {{ editingItem() ? 'Edit Item' : 'Add Item' }}
            </h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  [(ngModel)]="itemForm.title"
                  placeholder="As a user, I want to..."
                  class="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">Story Points</label>
                  <input
                    type="number"
                    [(ngModel)]="itemForm.estimatedPoints"
                    min="0"
                    class="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Confidence %</label>
                  <input
                    type="number"
                    [(ngModel)]="itemForm.confidence"
                    min="0"
                    max="100"
                    class="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Target Sprint</label>
                <select
                  [(ngModel)]="itemForm.targetSprintId"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option [ngValue]="null">Backlog</option>
                  @for (sprint of selectedBoard()?.sprints || []; track sprint.jiraId) {
                    <option [ngValue]="sprint.jiraId">{{ sprint.name }}</option>
                  }
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  [(ngModel)]="itemForm.notes"
                  rows="2"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                ></textarea>
              </div>
            </div>

            <div class="mt-6 flex justify-between">
              @if (editingItem()) {
                <button
                  hlmBtn
                  variant="destructive"
                  (click)="deleteItem()"
                  [disabled]="service.loading()"
                >
                  Delete
                </button>
              } @else {
                <div></div>
              }
              <div class="flex gap-2">
                <button hlmBtn variant="ghost" (click)="closeItemDialog()">
                  Cancel
                </button>
                <button
                  hlmBtn
                  variant="default"
                  (click)="saveItem()"
                  [disabled]="!itemForm.title || service.loading()"
                >
                  {{ editingItem() ? 'Save' : 'Add' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PiPlanningBoardComponent implements OnInit {
  protected service = inject(PiPlanningService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected Math = Math;

  integrationId = signal<number | null>(null);
  sessionId = signal<number | null>(null);
  selectedBoard = signal<BoardView | null>(null);
  showAddItemDialog = signal(false);
  editingItem = signal<PiPlannedItem | null>(null);

  itemForm = {
    title: '',
    estimatedPoints: null as number | null,
    confidence: null as number | null,
    targetSprintId: null as number | null,
    notes: '',
  };

  backlogPoints = computed(() => {
    const board = this.selectedBoard();
    if (!board) return 0;
    return board.backlog.reduce((sum, item) => sum + (item.estimatedPoints || 0), 0);
  });

  async ngOnInit() {
    const integrationId = parseInt(this.route.snapshot.params['integrationId']);
    const sessionId = parseInt(this.route.snapshot.params['sessionId']);

    if (!isNaN(integrationId) && !isNaN(sessionId)) {
      this.integrationId.set(integrationId);
      this.sessionId.set(sessionId);

      await this.service.loadPlanningView(integrationId, sessionId);

      // Select first board by default
      const view = this.service.planningView();
      if (view?.boards?.length) {
        this.selectedBoard.set(view.boards[0]);
      }
    }
  }

  selectBoard(board: BoardView): void {
    this.selectedBoard.set(board);
  }

  getCapacityPercent(sprint: SprintView): number {
    if (!sprint.capacity) return 0;
    return Math.round((sprint.plannedPoints / sprint.capacity) * 100);
  }

  editItem(item: PiPlannedItem): void {
    this.editingItem.set(item);
    this.itemForm = {
      title: item.title,
      estimatedPoints: item.estimatedPoints,
      confidence: item.confidence,
      targetSprintId: item.targetSprintId,
      notes: item.notes || '',
    };
  }

  closeItemDialog(): void {
    this.showAddItemDialog.set(false);
    this.editingItem.set(null);
    this.itemForm = {
      title: '',
      estimatedPoints: null,
      confidence: null,
      targetSprintId: null,
      notes: '',
    };
  }

  async saveItem(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    const board = this.selectedBoard();
    const editing = this.editingItem();

    if (!integrationId || !sessionId || !board) return;

    if (editing) {
      await this.service.updateItem(integrationId, sessionId, editing.id, {
        title: this.itemForm.title,
        estimatedPoints: this.itemForm.estimatedPoints,
        confidence: this.itemForm.confidence,
        targetSprintId: this.itemForm.targetSprintId,
        notes: this.itemForm.notes || null,
      });
    } else {
      await this.service.addItem(integrationId, sessionId, {
        title: this.itemForm.title,
        assignedBoardId: board.boardId,
        estimatedPoints: this.itemForm.estimatedPoints,
        confidence: this.itemForm.confidence,
        targetSprintId: this.itemForm.targetSprintId,
        notes: this.itemForm.notes || undefined,
      });
    }

    // Refresh the selected board
    const view = this.service.planningView();
    if (view) {
      const updatedBoard = view.boards.find(b => b.boardId === board.boardId);
      if (updatedBoard) {
        this.selectedBoard.set(updatedBoard);
      }
    }

    this.closeItemDialog();
  }

  async deleteItem(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    const item = this.editingItem();
    const board = this.selectedBoard();

    if (!integrationId || !sessionId || !item) return;

    await this.service.deleteItem(integrationId, sessionId, item.id);

    // Refresh the selected board
    const view = this.service.planningView();
    if (view && board) {
      const updatedBoard = view.boards.find(b => b.boardId === board.boardId);
      if (updatedBoard) {
        this.selectedBoard.set(updatedBoard);
      }
    }

    this.closeItemDialog();
  }

  async importFromBacklog(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    const board = this.selectedBoard();

    if (!integrationId || !sessionId || !board) return;

    await this.service.importFromBacklog(integrationId, sessionId, board.boardId);

    // Refresh the selected board
    const view = this.service.planningView();
    if (view) {
      const updatedBoard = view.boards.find(b => b.boardId === board.boardId);
      if (updatedBoard) {
        this.selectedBoard.set(updatedBoard);
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/pi-planning']);
  }
}
