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
  lucideAlertTriangle,
  lucideUsers,
  lucideSettings,
  lucideSave,
  lucideHistory,
  lucideSparkles,
  lucideLink,
  lucideChevronRight,
  lucideLoader2,
  lucideRefreshCw,
  lucideX,
  lucideTrash2,
  lucideCheck,
} from '@ng-icons/lucide';
import { PiPlanningService } from './pi-planning.service';
import type {
  KanbanBoardView,
  BoardViewFeature,
  BoardViewSprint,
  TeamView,
  UnassignedFeature,
  PiDependency,
  AiPlanningResult,
  PlannedAssignment,
} from './pi-planning.types';

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
      lucideAlertTriangle,
      lucideUsers,
      lucideSettings,
      lucideSave,
      lucideHistory,
      lucideSparkles,
      lucideLink,
      lucideChevronRight,
      lucideLoader2,
      lucideRefreshCw,
      lucideX,
      lucideTrash2,
      lucideCheck,
    }),
  ],
  template: `
    <div class="h-screen flex flex-col bg-background">
      <!-- Header -->
      <div class="border-b p-4 flex items-center justify-between bg-card shrink-0">
        <div class="flex items-center gap-4">
          <button hlmBtn variant="ghost" size="sm" (click)="goBack()">
            <ng-icon hlmIcon name="lucideArrowLeft" class="h-4 w-4" />
          </button>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-bold">
                {{ service.kanbanView()?.session?.name || 'PI Planning' }}
              </h1>
              @if (service.kanbanView()?.session?.currentVersion) {
                <span class="text-xs bg-muted px-2 py-0.5 rounded">
                  v{{ service.kanbanView()?.session?.currentVersion }}
                </span>
              }
            </div>
            <p class="text-sm text-muted-foreground">
              {{ getSessionStatusText() }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            hlmBtn
            variant="outline"
            size="sm"
            (click)="showTeamPanel.set(!showTeamPanel())"
          >
            <ng-icon hlmIcon name="lucideUsers" class="mr-2 h-4 w-4" />
            Teams
          </button>
          <button
            hlmBtn
            variant="outline"
            size="sm"
            (click)="showImportDialog.set(true)"
            [disabled]="service.loading()"
          >
            <ng-icon hlmIcon name="lucideDownload" class="mr-2 h-4 w-4" />
            Import Features
          </button>
          <button
            hlmBtn
            variant="outline"
            size="sm"
            (click)="showVersionDialog.set(true)"
          >
            <ng-icon hlmIcon name="lucideSave" class="mr-2 h-4 w-4" />
            Save Version
          </button>
          <button
            hlmBtn
            variant="default"
            size="sm"
            (click)="runAiPlanning()"
            [disabled]="service.loading()"
          >
            <ng-icon hlmIcon name="lucideSparkles" class="mr-2 h-4 w-4" />
            AI Plan
          </button>
        </div>
      </div>

      @if (service.error()) {
        <div class="p-4 bg-red-50 border-b border-red-200 shrink-0">
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <div class="flex-1 flex overflow-hidden">
        <!-- Team Config Panel (Collapsible) -->
        @if (showTeamPanel()) {
          <div class="w-80 border-r bg-card p-4 overflow-y-auto shrink-0">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">Teams</h3>
              <button hlmBtn variant="ghost" size="sm" (click)="openAddTeamDialog()">
                <ng-icon hlmIcon name="lucidePlus" class="h-4 w-4" />
              </button>
            </div>

            @if (service.kanbanView()?.teams?.length) {
              <div class="space-y-3">
                @for (team of service.kanbanView()!.teams; track team.id) {
                  <div class="p-3 bg-muted/50 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-medium text-sm truncate flex-1">{{ team.name }}</span>
                      <div class="flex items-center gap-1 shrink-0">
                        <button
                          hlmBtn
                          variant="ghost"
                          size="sm"
                          (click)="editTeamVelocity(team)"
                          title="Edit velocity"
                        >
                          <ng-icon hlmIcon name="lucideSettings" class="h-3 w-3" />
                        </button>
                        <button
                          hlmBtn
                          variant="ghost"
                          size="sm"
                          (click)="removeTeam(team)"
                          title="Remove team"
                          class="text-red-500 hover:text-red-600"
                        >
                          <ng-icon hlmIcon name="lucideTrash2" class="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <!-- Velocity (editable) -->
                    @if (editingTeamId() === team.id) {
                      <div class="flex items-center gap-2 mb-2">
                        <input
                          type="number"
                          [(ngModel)]="editVelocityValue"
                          min="1"
                          max="200"
                          class="w-20 px-2 py-1 text-sm border rounded bg-background"
                        />
                        <span class="text-xs text-muted-foreground">pts/sprint</span>
                        <button
                          hlmBtn
                          variant="ghost"
                          size="sm"
                          (click)="saveTeamVelocity(team)"
                          [disabled]="savingVelocity()"
                        >
                          @if (savingVelocity()) {
                            <ng-icon hlmIcon name="lucideLoader2" class="h-3 w-3 animate-spin" />
                          } @else {
                            <ng-icon hlmIcon name="lucideCheck" class="h-3 w-3 text-green-500" />
                          }
                        </button>
                        <button
                          hlmBtn
                          variant="ghost"
                          size="sm"
                          (click)="cancelEditVelocity()"
                        >
                          <ng-icon hlmIcon name="lucideX" class="h-3 w-3" />
                        </button>
                      </div>
                    } @else {
                      <div class="text-sm text-muted-foreground">
                        Velocity: {{ team.velocity }} pts/sprint
                      </div>
                    }

                    <!-- Capacity Summary -->
                    <div class="mt-2 space-y-1">
                      @for (cap of team.sprintCapacities; track cap.sprintNum) {
                        <div class="flex items-center gap-2 text-xs">
                          <span class="w-8">S{{ cap.sprintNum }}</span>
                          <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              class="h-full transition-all"
                              [class.bg-green-500]="!cap.isOverCapacity"
                              [class.bg-red-500]="cap.isOverCapacity"
                              [style.width.%]="Math.min((cap.allocatedPoints / cap.capacityPoints) * 100, 100)"
                            ></div>
                          </div>
                          <span class="w-12 text-right">
                            {{ cap.allocatedPoints }}/{{ cap.capacityPoints }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="text-center py-8 text-muted-foreground">
                <ng-icon hlmIcon name="lucideUsers" class="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p class="text-sm">No teams added yet</p>
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  class="mt-2"
                  (click)="openAddTeamDialog()"
                >
                  Add Team
                </button>
              </div>
            }
          </div>
        }

        <!-- Main Board Area -->
        <div class="flex-1 flex flex-col overflow-hidden">
          @if (service.loading() && !service.kanbanView()) {
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
          } @else if (service.kanbanView()) {
            <!-- Unassigned Features Bar -->
            <div class="border-b p-4 bg-muted/30 shrink-0">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-medium flex items-center gap-2">
                  <ng-icon hlmIcon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground" />
                  Unassigned Features
                  <span class="text-sm text-muted-foreground">
                    ({{ service.kanbanView()?.unassignedFeatures?.length || 0 }})
                  </span>
                </h3>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  (click)="showUnassignedExpanded.set(!showUnassignedExpanded())"
                >
                  <ng-icon
                    hlmIcon
                    name="lucideChevronRight"
                    class="h-4 w-4 transition-transform"
                    [class.rotate-90]="showUnassignedExpanded()"
                  />
                </button>
              </div>

              @if (showUnassignedExpanded()) {
                <div class="flex gap-2 overflow-x-auto py-2">
                  @for (feature of service.kanbanView()?.unassignedFeatures || []; track feature.id) {
                    <div
                      class="bg-card p-3 rounded-lg border min-w-[200px] max-w-[250px] cursor-pointer hover:border-primary/50"
                      draggable="true"
                      (dragstart)="onDragStart($event, feature)"
                      (click)="selectFeature(feature)"
                    >
                      <div class="flex items-start gap-2">
                        <ng-icon hlmIcon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground mt-0.5 cursor-grab" />
                        <div class="flex-1 min-w-0">
                          @if (feature.jiraKey) {
                            <span class="text-xs text-muted-foreground">{{ feature.jiraKey }}</span>
                          }
                          <p class="text-sm font-medium truncate">{{ feature.title }}</p>
                          <div class="flex items-center gap-2 mt-1">
                            @if (feature.totalPoints) {
                              <span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                {{ feature.totalPoints }} pts
                              </span>
                            }
                            @if (feature.estimatedSprints > 1) {
                              <span class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                {{ feature.estimatedSprints }} sprints
                              </span>
                            }
                            @if (feature.dependencies.length) {
                              <span class="text-xs text-orange-600 flex items-center gap-0.5">
                                <ng-icon hlmIcon name="lucideLink" class="h-3 w-3" />
                                {{ feature.dependencies.length }}
                              </span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                  @if (!service.kanbanView()?.unassignedFeatures?.length) {
                    <div class="text-sm text-muted-foreground py-2">
                      No unassigned features. Import features from Jira to get started.
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Sprint Columns with Team Rows -->
            <div class="flex-1 overflow-auto p-4">
              <div class="min-w-max">
                <!-- Header Row: Sprint Names -->
                <div class="flex gap-2 mb-2 sticky top-0 bg-background z-10 pb-2">
                  <div class="w-32 shrink-0"></div>
                  @for (sprint of service.kanbanView()?.sprints || []; track sprint.id) {
                    <div
                      class="w-48 shrink-0 p-2 bg-card rounded-t-lg border border-b-0 text-center"
                      [class.bg-blue-50]="sprint.isIpSprint"
                    >
                      <div class="font-medium text-sm">{{ sprint.name }}</div>
                      <div class="text-xs text-muted-foreground">
                        {{ formatSprintDates(sprint) }}
                      </div>
                      @if (sprint.holidays.length) {
                        <div class="text-xs text-orange-600">
                          {{ sprint.workingDays }} working days
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Team Rows -->
                @for (team of service.kanbanView()?.teams || []; track team.id) {
                  <div class="flex gap-2 mb-2">
                    <!-- Team Label -->
                    <div class="w-32 shrink-0 p-2 bg-card rounded-l-lg border flex items-center">
                      <span class="font-medium text-sm truncate">{{ team.name }}</span>
                    </div>

                    <!-- Sprint Cells for this Team -->
                    @for (sprint of service.kanbanView()?.sprints || []; track sprint.id) {
                      <div
                        class="w-48 shrink-0 p-2 bg-muted/30 rounded-lg border min-h-[100px] relative"
                        [class.bg-blue-50/50]="sprint.isIpSprint"
                        (dragover)="onDragOver($event)"
                        (drop)="onDrop($event, team, sprint)"
                      >
                        <!-- Capacity indicator -->
                        @if (getTeamSprintCapacity(team, sprint.number)) {
                          @let cap = getTeamSprintCapacity(team, sprint.number);
                          <div class="absolute top-1 right-1 text-xs">
                            <span
                              [class.text-green-600]="!cap!.isOverCapacity"
                              [class.text-red-600]="cap!.isOverCapacity"
                            >
                              {{ cap!.allocatedPoints }}/{{ cap!.capacityPoints }}
                            </span>
                          </div>
                        }

                        <!-- Features in this cell -->
                        <div class="space-y-1 mt-4">
                          @for (feature of getFeaturesForTeamSprint(team.id, sprint.number); track feature.id) {
                            <div
                              class="p-2 rounded text-xs cursor-pointer transition-colors"
                              [class.bg-primary/10]="!feature.assignment?.isManualOverride"
                              [class.bg-yellow-100]="feature.assignment?.isManualOverride"
                              [class.border-l-4]="feature.assignment?.spansSprints"
                              [class.border-primary]="feature.assignment?.spansSprints"
                              (click)="selectFeature(feature)"
                            >
                              @if (feature.jiraKey) {
                                <span class="text-muted-foreground">{{ feature.jiraKey }}</span>
                              }
                              <p class="font-medium truncate">{{ feature.title }}</p>
                              @if (feature.assignment?.spansSprints) {
                                <span class="text-purple-600">
                                  S{{ feature.assignment!.startSprintNum }}-S{{ feature.assignment!.endSprintNum }}
                                </span>
                              }
                            </div>
                          }
                        </div>

                        @if (getFeaturesForTeamSprint(team.id, sprint.number).length === 0) {
                          <div class="text-xs text-muted-foreground text-center py-4 mt-2">
                            Drop here
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                @if (!service.kanbanView()?.teams?.length) {
                  <div class="text-center py-12 text-muted-foreground">
                    <ng-icon hlmIcon name="lucideUsers" class="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 class="font-medium mb-2">No teams configured</h3>
                    <p class="text-sm mb-4">Add teams to start planning features across sprints.</p>
                    <button
                      hlmBtn
                      variant="default"
                      (click)="showAddTeamDialog.set(true)"
                    >
                      <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
                      Add Team
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Add Team Dialog -->
      @if (showAddTeamDialog()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="closeAddTeamDialog()"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-4">Add Team</h2>
            <p class="text-sm text-muted-foreground mb-4">
              Select a Jira board to add as a team to this PI session.
            </p>

            @if (loadingBoards()) {
              <div class="flex items-center justify-center py-8">
                <ng-icon hlmIcon name="lucideLoader2" class="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            } @else if (availableBoards().length === 0) {
              <div class="text-center py-8 text-muted-foreground">
                <p class="text-sm">No available boards found.</p>
                <p class="text-xs mt-1">All boards may already be added to this session.</p>
              </div>
            } @else {
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">Select Board</label>
                  <div class="space-y-2 max-h-48 overflow-y-auto">
                    @for (board of availableBoards(); track board.id) {
                      <label
                        class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        [class.border-primary]="selectedBoard()?.id === board.id"
                        [class.bg-primary/5]="selectedBoard()?.id === board.id"
                      >
                        <input
                          type="radio"
                          [value]="board.id"
                          [checked]="selectedBoard()?.id === board.id"
                          (change)="selectBoard(board)"
                          class="h-4 w-4"
                        />
                        <div class="flex-1">
                          <div class="font-medium text-sm">{{ board.name }}</div>
                          <div class="text-xs text-muted-foreground">{{ board.type }} board</div>
                        </div>
                      </label>
                    }
                  </div>
                </div>

                @if (selectedBoard()) {
                  <div>
                    <label class="block text-sm font-medium mb-1">Team Velocity (pts/sprint)</label>
                    <input
                      type="number"
                      [(ngModel)]="newTeamVelocity"
                      min="1"
                      max="200"
                      class="w-full px-3 py-2 border rounded-md bg-background"
                    />
                    <p class="text-xs text-muted-foreground mt-1">
                      Estimated points the team can complete per sprint
                    </p>
                  </div>
                }
              </div>
            }

            <div class="mt-6 flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="closeAddTeamDialog()">
                Cancel
              </button>
              <button
                hlmBtn
                variant="default"
                (click)="addSelectedBoard()"
                [disabled]="!selectedBoard() || addingBoard()"
              >
                @if (addingBoard()) {
                  <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                } @else {
                  <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
                  Add Team
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Import Features Dialog -->
      @if (showImportDialog()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="showImportDialog.set(false)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-4">Import Features</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">JQL Filter (optional)</label>
                <input
                  type="text"
                  [(ngModel)]="importJql"
                  placeholder='e.g., project = PROJ AND type = Epic'
                  class="w-full px-3 py-2 border rounded-md bg-background text-sm"
                />
                <p class="text-xs text-muted-foreground mt-1">
                  Leave empty to import all features from the project
                </p>
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="showImportDialog.set(false)">
                Cancel
              </button>
              <button
                hlmBtn
                variant="default"
                (click)="importFeatures()"
                [disabled]="importing()"
              >
                @if (importing()) {
                  <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                } @else {
                  <ng-icon hlmIcon name="lucideDownload" class="mr-2 h-4 w-4" />
                  Import
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Save Version Dialog -->
      @if (showVersionDialog()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="showVersionDialog.set(false)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-4">Save Version</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Version Number</label>
                <input
                  type="text"
                  [(ngModel)]="versionNumber"
                  placeholder="e.g., 1.0, 2.0-draft"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Comment (optional)</label>
                <textarea
                  [(ngModel)]="versionComment"
                  placeholder="What changed in this version?"
                  rows="2"
                  class="w-full px-3 py-2 border rounded-md bg-background"
                ></textarea>
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="showVersionDialog.set(false)">
                Cancel
              </button>
              <button
                hlmBtn
                variant="default"
                (click)="saveVersion()"
                [disabled]="!versionNumber || savingVersion()"
              >
                @if (savingVersion()) {
                  <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                } @else {
                  <ng-icon hlmIcon name="lucideSave" class="mr-2 h-4 w-4" />
                  Save
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Feature Detail Panel -->
      @if (selectedFeature()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="selectedFeature.set(null)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                @if (getFeatureJiraKey()) {
                  <span class="text-sm text-muted-foreground">
                    {{ getFeatureJiraKey() }}
                  </span>
                }
                <h2 class="text-xl font-semibold">{{ selectedFeature()?.title }}</h2>
              </div>
              <button hlmBtn variant="ghost" size="sm" (click)="selectedFeature.set(null)">
                <ng-icon hlmIcon name="lucideX" class="h-4 w-4" />
              </button>
            </div>

            <div class="space-y-4">
              <div class="flex gap-4">
                @if (selectedFeature()?.totalPoints) {
                  <div class="text-center">
                    <div class="text-2xl font-bold">{{ selectedFeature()?.totalPoints }}</div>
                    <div class="text-xs text-muted-foreground">Points</div>
                  </div>
                }
                <div class="text-center">
                  <div class="text-2xl font-bold">{{ selectedFeature()?.estimatedSprints || 1 }}</div>
                  <div class="text-xs text-muted-foreground">Sprints</div>
                </div>
              </div>

              @if (getFeatureDependencies().length) {
                <div>
                  <h4 class="font-medium text-sm mb-2 flex items-center gap-1">
                    <ng-icon hlmIcon name="lucideLink" class="h-4 w-4" />
                    Dependencies
                  </h4>
                  <div class="space-y-1">
                    @for (dep of getFeatureDependencies(); track dep.issueKey) {
                      <div class="text-sm p-2 bg-muted/50 rounded flex items-center justify-between">
                        <span>{{ dep.issueKey }}</span>
                        <span class="text-xs text-muted-foreground">{{ dep.type }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (getSelectedFeatureAssignment()) {
                @let assignment = getSelectedFeatureAssignment();
                <div class="p-3 bg-muted/50 rounded-lg">
                  <h4 class="font-medium text-sm mb-2">Current Assignment</h4>
                  <div class="text-sm space-y-1">
                    <div>Team: {{ assignment!.boardName }}</div>
                    <div>
                      Sprint: {{ assignment!.startSprintNum }}
                      @if (assignment!.endSprintNum !== assignment!.startSprintNum) {
                        - {{ assignment!.endSprintNum }}
                      }
                    </div>
                    @if (assignment!.aiRationale) {
                      <div class="mt-2 p-2 bg-blue-50 rounded text-xs">
                        <span class="font-medium">AI Rationale:</span> {{ assignment!.aiRationale }}
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="flex gap-2">
                @if (getSelectedFeatureAssignment()) {
                  <button
                    hlmBtn
                    variant="outline"
                    class="flex-1"
                    (click)="unassignFeature()"
                  >
                    Unassign
                  </button>
                }
                <button
                  hlmBtn
                  variant="default"
                  class="flex-1"
                  (click)="selectedFeature.set(null)"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- AI Planning Dialog -->
      @if (showAiPlanDialog()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="closeAiPlanDialog()"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
            (click)="$event.stopPropagation()"
          >
            <div class="p-6 border-b shrink-0">
              <div class="flex items-center gap-2">
                <ng-icon hlmIcon name="lucideSparkles" class="h-5 w-5 text-primary" />
                <h2 class="text-xl font-semibold">AI Planning</h2>
              </div>
              <p class="text-sm text-muted-foreground mt-1">
                Let AI suggest optimal feature assignments based on capacity and dependencies
              </p>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
              @if (!aiPlanResult()) {
                <!-- Options -->
                <div class="space-y-4 mb-6">
                  <h3 class="font-medium">Planning Options</h3>
                  <label class="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="aiOptions.respectDependencies"
                      class="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div class="font-medium text-sm">Respect Dependencies</div>
                      <div class="text-xs text-muted-foreground">
                        Schedule blocked features after their dependencies
                      </div>
                    </div>
                  </label>
                  <label class="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="aiOptions.balanceLoad"
                      class="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div class="font-medium text-sm">Balance Load</div>
                      <div class="text-xs text-muted-foreground">
                        Distribute work evenly across teams
                      </div>
                    </div>
                  </label>
                  <label class="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="aiOptions.preferEarlierSprints"
                      class="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div class="font-medium text-sm">Prefer Earlier Sprints</div>
                      <div class="text-xs text-muted-foreground">
                        Front-load work when capacity allows
                      </div>
                    </div>
                  </label>
                </div>
              } @else {
                <!-- Results -->
                <div class="space-y-4">
                  <!-- Summary -->
                  <div class="grid grid-cols-4 gap-3">
                    <div class="text-center p-3 bg-muted/50 rounded-lg">
                      <div class="text-2xl font-bold">{{ aiPlanResult()?.summary?.totalFeatures || 0 }}</div>
                      <div class="text-xs text-muted-foreground">Total Features</div>
                    </div>
                    <div class="text-center p-3 bg-green-50 rounded-lg">
                      <div class="text-2xl font-bold text-green-600">{{ aiPlanResult()?.summary?.assignedFeatures || 0 }}</div>
                      <div class="text-xs text-muted-foreground">Assigned</div>
                    </div>
                    <div class="text-center p-3 bg-muted/50 rounded-lg">
                      <div class="text-2xl font-bold">{{ aiPlanResult()?.summary?.totalPoints || 0 }}</div>
                      <div class="text-xs text-muted-foreground">Total Points</div>
                    </div>
                    <div class="text-center p-3 bg-blue-50 rounded-lg">
                      <div class="text-2xl font-bold text-blue-600">{{ aiPlanResult()?.summary?.assignedPoints || 0 }}</div>
                      <div class="text-xs text-muted-foreground">Planned Points</div>
                    </div>
                  </div>

                  <!-- Warnings -->
                  @if (aiPlanResult()?.warnings?.length) {
                    <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div class="flex items-center gap-2 mb-2">
                        <ng-icon hlmIcon name="lucideAlertTriangle" class="h-4 w-4 text-yellow-600" />
                        <span class="font-medium text-yellow-800">Warnings</span>
                      </div>
                      <ul class="list-disc list-inside text-sm text-yellow-700 space-y-1">
                        @for (warning of aiPlanResult()?.warnings || []; track warning) {
                          <li>{{ warning }}</li>
                        }
                      </ul>
                    </div>
                  }

                  <!-- Assignments -->
                  @if (aiPlanResult()?.assignments?.length) {
                    <div>
                      <h4 class="font-medium mb-2">Planned Assignments</h4>
                      <div class="space-y-2 max-h-48 overflow-y-auto">
                        @for (assignment of aiPlanResult()?.assignments || []; track assignment.featureId) {
                          <div class="p-2 bg-muted/30 rounded text-sm flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                              @if (assignment.featureKey) {
                                <span class="text-xs text-muted-foreground mr-1">{{ assignment.featureKey }}</span>
                              }
                              <span class="truncate">{{ assignment.featureTitle }}</span>
                            </div>
                            <div class="shrink-0 text-xs text-muted-foreground ml-2">
                              {{ assignment.boardName }} · S{{ assignment.startSprintNum }}
                              @if (assignment.endSprintNum !== assignment.startSprintNum) {
                                -S{{ assignment.endSprintNum }}
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Unassigned -->
                  @if (aiPlanResult()?.unassignedFeatures?.length) {
                    <div>
                      <h4 class="font-medium mb-2 text-orange-600">Could Not Assign ({{ aiPlanResult()?.unassignedFeatures?.length }})</h4>
                      <div class="space-y-2 max-h-32 overflow-y-auto">
                        @for (item of aiPlanResult()?.unassignedFeatures || []; track item.id) {
                          <div class="p-2 bg-orange-50 rounded text-sm">
                            <div class="font-medium">{{ item.title }}</div>
                            <div class="text-xs text-orange-600">{{ item.reason }}</div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Rationale (first few) -->
                  @if (aiPlanResult()?.assignments?.length) {
                    <div>
                      <h4 class="font-medium mb-2">AI Rationale (Sample)</h4>
                      <div class="space-y-2">
                        @for (assignment of getTopAssignments(); track assignment.featureId) {
                          <div class="p-2 bg-blue-50 rounded text-sm">
                            <div class="font-medium text-xs text-blue-800">{{ assignment.featureTitle }}</div>
                            <div class="text-xs text-blue-600 mt-1">{{ assignment.rationale }}</div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="p-6 border-t shrink-0 flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="closeAiPlanDialog()">
                Cancel
              </button>
              @if (!aiPlanResult()) {
                <button
                  hlmBtn
                  variant="outline"
                  (click)="generateAiPlanPreview()"
                  [disabled]="generatingAiPlan()"
                >
                  @if (generatingAiPlan()) {
                    <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  } @else {
                    Preview Plan
                  }
                </button>
                <button
                  hlmBtn
                  variant="default"
                  (click)="runAutoAiPlanning()"
                  [disabled]="generatingAiPlan()"
                >
                  @if (generatingAiPlan()) {
                    <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  } @else {
                    <ng-icon hlmIcon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  }
                  Auto Plan
                </button>
              } @else {
                <button
                  hlmBtn
                  variant="outline"
                  (click)="resetAiPlan()"
                >
                  <ng-icon hlmIcon name="lucideRefreshCw" class="mr-2 h-4 w-4" />
                  New Plan
                </button>
                @if (!aiPlanResult()?.applied) {
                  <button
                    hlmBtn
                    variant="default"
                    (click)="applyAiPlan()"
                    [disabled]="applyingAiPlan()"
                  >
                    @if (applyingAiPlan()) {
                      <ng-icon hlmIcon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    } @else {
                      Apply Plan
                    }
                  </button>
                } @else {
                  <button
                    hlmBtn
                    variant="default"
                    (click)="closeAiPlanDialog()"
                  >
                    Done
                  </button>
                }
              }
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

  showTeamPanel = signal(true);
  showUnassignedExpanded = signal(true);
  showAddTeamDialog = signal(false);
  showImportDialog = signal(false);
  showVersionDialog = signal(false);
  showAiPlanDialog = signal(false);

  selectedFeature = signal<BoardViewFeature | UnassignedFeature | null>(null);
  draggedFeature = signal<UnassignedFeature | null>(null);
  aiPlanResult = signal<AiPlanningResult | null>(null);

  importing = signal(false);
  savingVersion = signal(false);
  generatingAiPlan = signal(false);
  applyingAiPlan = signal(false);
  loadingBoards = signal(false);
  addingBoard = signal(false);
  savingVelocity = signal(false);

  // Team configuration
  availableBoards = signal<Array<{ id: number; name: string; type: string }>>([]);
  selectedBoard = signal<{ id: number; name: string; type: string } | null>(null);
  editingTeamId = signal<number | null>(null);

  importJql = '';
  versionNumber = '';
  versionComment = '';
  newTeamVelocity = 21;
  editVelocityValue = 21;

  aiOptions = {
    respectDependencies: true,
    balanceLoad: true,
    preferEarlierSprints: true,
  };

  async ngOnInit() {
    const integrationId = parseInt(this.route.snapshot.params['integrationId']);
    const sessionId = parseInt(this.route.snapshot.params['sessionId']);

    if (!isNaN(integrationId) && !isNaN(sessionId)) {
      this.integrationId.set(integrationId);
      this.sessionId.set(sessionId);

      await this.service.loadKanbanView(integrationId, sessionId);
    }
  }

  getSessionStatusText(): string {
    const view = this.service.kanbanView();
    if (!view) return '';

    const teamCount = view.teams?.length || 0;
    const featureCount = (view.features?.length || 0) + (view.unassignedFeatures?.length || 0);
    const sprintCount = view.sprints?.length || 0;

    return `${teamCount} team${teamCount !== 1 ? 's' : ''} · ${featureCount} feature${featureCount !== 1 ? 's' : ''} · ${sprintCount} sprint${sprintCount !== 1 ? 's' : ''}`;
  }

  formatSprintDates(sprint: BoardViewSprint): string {
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  getTeamSprintCapacity(team: TeamView, sprintNum: number) {
    return team.sprintCapacities?.find(c => c.sprintNum === sprintNum);
  }

  getFeaturesForTeamSprint(teamId: number, sprintNum: number): BoardViewFeature[] {
    const view = this.service.kanbanView();
    if (!view?.features) return [];

    return view.features.filter(f =>
      f.assignment &&
      f.assignment.boardId === teamId &&
      sprintNum >= f.assignment.startSprintNum &&
      sprintNum <= f.assignment.endSprintNum
    );
  }

  getFeatureDependencies(): PiDependency[] {
    const feature = this.selectedFeature();
    if (!feature) return [];
    return feature.dependencies || [];
  }

  getFeatureJiraKey(): string | undefined {
    const feature = this.selectedFeature();
    if (!feature) return undefined;
    // Both BoardViewFeature and UnassignedFeature have jiraKey
    return feature.jiraKey;
  }

  getSelectedFeatureAssignment() {
    const feature = this.selectedFeature();
    if (!feature || !('assignment' in feature)) return null;
    return (feature as BoardViewFeature).assignment;
  }

  selectFeature(feature: BoardViewFeature | UnassignedFeature): void {
    this.selectedFeature.set(feature);
  }

  // Drag and drop
  onDragStart(event: DragEvent, feature: UnassignedFeature): void {
    this.draggedFeature.set(feature);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', feature.id.toString());
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  async onDrop(event: DragEvent, team: TeamView, sprint: BoardViewSprint): Promise<void> {
    event.preventDefault();
    const feature = this.draggedFeature();
    if (!feature) return;

    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    // Calculate end sprint based on estimated sprints
    const endSprintNum = Math.min(
      sprint.number + feature.estimatedSprints - 1,
      (this.service.kanbanView()?.sprints?.length || sprint.number)
    );

    await this.service.assignFeature(integrationId, sessionId, {
      featureId: feature.id,
      boardId: team.id,
      startSprintNum: sprint.number,
      endSprintNum,
      allocatedPoints: feature.totalPoints,
    });

    this.draggedFeature.set(null);
  }

  async unassignFeature(): Promise<void> {
    const feature = this.selectedFeature();
    if (!feature || !('assignment' in feature)) return;

    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    await this.service.unassignFeature(integrationId, sessionId, feature.id);
    this.selectedFeature.set(null);
  }

  async importFeatures(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    this.importing.set(true);
    try {
      await this.service.importFeatures(integrationId, sessionId, {
        jql: this.importJql || undefined,
      });
      this.showImportDialog.set(false);
      this.importJql = '';
      // Reload the board
      await this.service.loadKanbanView(integrationId, sessionId);
    } finally {
      this.importing.set(false);
    }
  }

  async saveVersion(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId || !this.versionNumber) return;

    this.savingVersion.set(true);
    try {
      await this.service.createVersion(integrationId, sessionId, {
        versionNumber: this.versionNumber,
        comment: this.versionComment || undefined,
      });
      this.showVersionDialog.set(false);
      this.versionNumber = '';
      this.versionComment = '';
    } finally {
      this.savingVersion.set(false);
    }
  }

  // Team Configuration Methods
  async openAddTeamDialog(): Promise<void> {
    this.selectedBoard.set(null);
    this.newTeamVelocity = 21;
    this.showAddTeamDialog.set(true);
    await this.loadAvailableBoards();
  }

  closeAddTeamDialog(): void {
    this.showAddTeamDialog.set(false);
    this.selectedBoard.set(null);
    this.availableBoards.set([]);
  }

  async loadAvailableBoards(): Promise<void> {
    const integrationId = this.integrationId();
    if (!integrationId) return;

    this.loadingBoards.set(true);
    try {
      const allBoards = await this.service.getJiraBoards(integrationId);

      // Filter out boards already added to this session
      const existingBoardIds = new Set(
        (this.service.kanbanView()?.teams || []).map(t => t.jiraBoardId)
      );
      const available = allBoards.filter(b => !existingBoardIds.has(b.id));

      this.availableBoards.set(available);
    } finally {
      this.loadingBoards.set(false);
    }
  }

  async selectBoard(board: { id: number; name: string; type: string }): Promise<void> {
    this.selectedBoard.set(board);

    // Fetch velocity for this board
    const integrationId = this.integrationId();
    if (integrationId) {
      const velocity = await this.service.getJiraBoardVelocity(integrationId, board.id);
      this.newTeamVelocity = velocity;
    }
  }

  async addSelectedBoard(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    const board = this.selectedBoard();
    if (!integrationId || !sessionId || !board) return;

    this.addingBoard.set(true);
    try {
      await this.service.addBoard(integrationId, sessionId, {
        jiraBoardId: board.id,
        boardName: board.name,
        defaultVelocity: this.newTeamVelocity,
      });
      this.closeAddTeamDialog();
      // Reload the kanban view to show the new team
      await this.service.loadKanbanView(integrationId, sessionId);
    } finally {
      this.addingBoard.set(false);
    }
  }

  editTeamVelocity(team: TeamView): void {
    this.editingTeamId.set(team.id);
    this.editVelocityValue = team.velocity;
  }

  cancelEditVelocity(): void {
    this.editingTeamId.set(null);
  }

  async saveTeamVelocity(team: TeamView): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    this.savingVelocity.set(true);
    try {
      await this.service.updateBoardVelocity(
        integrationId,
        sessionId,
        team.id,
        this.editVelocityValue
      );
      this.editingTeamId.set(null);
    } finally {
      this.savingVelocity.set(false);
    }
  }

  async removeTeam(team: TeamView): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    if (confirm(`Remove ${team.name} from this PI session? This will unassign all features from this team.`)) {
      await this.service.removeBoard(integrationId, sessionId, team.id);
    }
  }

  // AI Planning Methods
  runAiPlanning(): void {
    this.aiPlanResult.set(null);
    this.showAiPlanDialog.set(true);
  }

  async generateAiPlanPreview(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    this.generatingAiPlan.set(true);
    try {
      const result = await this.service.generateAiPlan(integrationId, sessionId, this.aiOptions);
      if (result) {
        this.aiPlanResult.set(result);
      }
    } finally {
      this.generatingAiPlan.set(false);
    }
  }

  async runAutoAiPlanning(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    if (!integrationId || !sessionId) return;

    this.generatingAiPlan.set(true);
    try {
      const result = await this.service.runAutoAiPlan(integrationId, sessionId, this.aiOptions);
      if (result) {
        this.aiPlanResult.set({ ...result, applied: true });
      }
    } finally {
      this.generatingAiPlan.set(false);
    }
  }

  async applyAiPlan(): Promise<void> {
    const integrationId = this.integrationId();
    const sessionId = this.sessionId();
    const result = this.aiPlanResult();
    if (!integrationId || !sessionId || !result?.assignments) return;

    this.applyingAiPlan.set(true);
    try {
      const success = await this.service.applyAiPlan(integrationId, sessionId, result.assignments);
      if (success) {
        this.aiPlanResult.set({ ...result, applied: true });
      }
    } finally {
      this.applyingAiPlan.set(false);
    }
  }

  closeAiPlanDialog(): void {
    this.showAiPlanDialog.set(false);
    this.aiPlanResult.set(null);
  }

  resetAiPlan(): void {
    this.aiPlanResult.set(null);
  }

  getTopAssignments(): PlannedAssignment[] {
    const result = this.aiPlanResult();
    if (!result?.assignments) return [];
    return result.assignments.slice(0, 3);
  }

  goBack(): void {
    this.router.navigate(['/pi-planning']);
  }
}
