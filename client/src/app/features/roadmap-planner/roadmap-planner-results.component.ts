import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideMap,
  lucideCalendar,
  lucideGitBranch,
  lucideLayers,
  lucideFlag,
  lucideLoader2,
  lucideDownload,
  lucideRefreshCw,
  lucideArrowLeft,
  lucideAlertTriangle,
  lucideCheckCircle,
  lucideAlertCircle,
} from '@ng-icons/lucide';
import { RoadmapPlannerService } from './roadmap-planner.service';
import {
  RoadmapSessionResponse,
  RoadmapItem,
  RoadmapItemSegment,
  SprintSummary,
  RoadmapTheme,
  RoadmapDependency,
  PipelineStatus,
  GanttSegment,
} from './roadmap-planner.types';

type TabType = 'timeline' | 'dependencies' | 'themes';

interface GanttRow {
  team: number | null;
  teamLabel: string;
  segments: GanttSegment[];
}

interface SprintColumn {
  number: number;
  startDate?: Date;
  endDate?: Date;
  label: string;
}

@Component({
  selector: 'app-roadmap-planner-results',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideMap,
      lucideCalendar,
      lucideGitBranch,
      lucideLayers,
      lucideFlag,
      lucideLoader2,
      lucideDownload,
      lucideRefreshCw,
      lucideArrowLeft,
      lucideAlertTriangle,
      lucideCheckCircle,
      lucideAlertCircle,
    }),
  ],
  template: `
    <div class="h-full flex flex-col">
      <!-- Processing View -->
      @if (isProcessing()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md">
            <ng-icon name="lucideLoader2" class="h-16 w-16 text-primary animate-spin mx-auto mb-6" />
            <h2 class="text-xl font-semibold text-slate-900 mb-2">
              {{ pipelineStatus()?.progressMessage || 'Processing...' }}
            </h2>
            <p class="text-slate-600 mb-6">
              Step {{ pipelineStatus()?.progressStep || 0 }} of {{ pipelineStatus()?.progressTotal || 5 }}
            </p>

            <!-- Progress bar -->
            <div class="w-full bg-slate-200 rounded-full h-2 mb-4">
              <div
                class="bg-primary h-2 rounded-full transition-all duration-500"
                [style.width.%]="progressPercent()"
              ></div>
            </div>

            <!-- Stage indicators -->
            <div class="flex justify-between text-xs text-slate-500">
              <span [class.text-primary]="(pipelineStatus()?.progressStep || 0) >= 1">Sequencing</span>
              <span [class.text-primary]="(pipelineStatus()?.progressStep || 0) >= 2">Dependencies</span>
              <span [class.text-primary]="(pipelineStatus()?.progressStep || 0) >= 3">Themes</span>
              <span [class.text-primary]="(pipelineStatus()?.progressStep || 0) >= 4">Capacity</span>
              <span [class.text-primary]="(pipelineStatus()?.progressStep || 0) >= 5">Milestones</span>
            </div>
          </div>
        </div>
      }

      <!-- Error View -->
      @else if (hasError()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md">
            <ng-icon name="lucideAlertTriangle" class="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h2 class="text-xl font-semibold text-slate-900 mb-2">Pipeline Failed</h2>
            <p class="text-slate-600 mb-6">
              {{ currentSession()?.session?.errorMessage || 'An error occurred during processing.' }}
            </p>
            <button
              (click)="retry()"
              class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 mx-auto"
            >
              <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      }

      <!-- Results View -->
      @else if (currentSession()) {
        <!-- Header -->
        <div class="border-b border-slate-200 bg-white px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button
                (click)="goBack()"
                class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ng-icon name="lucideArrowLeft" class="h-5 w-5 text-slate-600" />
              </button>
              <div>
                <h1 class="text-xl font-semibold text-slate-900">
                  {{ currentSession()?.session?.name }}
                </h1>
                <p class="text-sm text-slate-500">
                  {{ currentSession()?.items?.length }} items across
                  {{ totalSprints() }} sprints
                  @if (hasMultipleTeams()) {
                    <span class="mx-1">·</span>
                    {{ currentSession()?.session?.teamCount }} teams
                  }
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button
                (click)="exportCsv()"
                class="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm"
              >
                <ng-icon name="lucideDownload" class="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-slate-200 bg-white px-6">
          <div class="flex gap-6">
            <button
              (click)="activeTab.set('timeline')"
              class="py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2"
              [class.border-primary]="activeTab() === 'timeline'"
              [class.text-primary]="activeTab() === 'timeline'"
              [class.border-transparent]="activeTab() !== 'timeline'"
              [class.text-slate-600]="activeTab() !== 'timeline'"
            >
              <ng-icon name="lucideCalendar" class="h-4 w-4" />
              <span>Timeline</span>
            </button>

            <button
              (click)="activeTab.set('dependencies')"
              class="py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2"
              [class.border-primary]="activeTab() === 'dependencies'"
              [class.text-primary]="activeTab() === 'dependencies'"
              [class.border-transparent]="activeTab() !== 'dependencies'"
              [class.text-slate-600]="activeTab() !== 'dependencies'"
            >
              <ng-icon name="lucideGitBranch" class="h-4 w-4" />
              <span>Dependencies</span>
              @if (currentSession()?.dependencies?.length) {
                <span class="px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                  {{ currentSession()?.dependencies?.length }}
                </span>
              }
            </button>

            <button
              (click)="activeTab.set('themes')"
              class="py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2"
              [class.border-primary]="activeTab() === 'themes'"
              [class.text-primary]="activeTab() === 'themes'"
              [class.border-transparent]="activeTab() !== 'themes'"
              [class.text-slate-600]="activeTab() !== 'themes'"
            >
              <ng-icon name="lucideLayers" class="h-4 w-4" />
              <span>Themes</span>
              @if (currentSession()?.themes?.length) {
                <span class="px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                  {{ currentSession()?.themes?.length }}
                </span>
              }
            </button>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-auto bg-slate-50 p-6">
          @switch (activeTab()) {
            @case ('timeline') {
              @if (ganttRows().length > 0) {
                <!-- Gantt Chart -->
                <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div class="overflow-x-auto">
                    <div class="min-w-max">
                      <!-- Header Row with Sprint Columns -->
                      <div class="flex border-b border-slate-200 bg-slate-50">
                        <div class="w-32 flex-shrink-0 px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                          Team
                        </div>
                        @for (sprint of sprintColumns(); track sprint.number) {
                          <div
                            class="flex-1 min-w-[160px] px-3 py-3 text-center border-r border-slate-100 last:border-r-0"
                          >
                            <div class="font-semibold text-slate-700">Sprint {{ sprint.number }}</div>
                            <div class="text-xs text-slate-500">{{ sprint.label }}</div>
                          </div>
                        }
                      </div>

                      <!-- Team Rows (Swimlanes) -->
                      @for (row of ganttRows(); track row.team) {
                        <div
                          class="flex border-b border-slate-100 last:border-b-0"
                          [style.min-height.px]="getRowHeight(row.segments.length)"
                        >
                          <!-- Team Label -->
                          <div class="w-32 flex-shrink-0 px-4 py-3 bg-blue-50 border-r border-slate-200 flex items-center">
                            <span class="font-medium text-blue-700">{{ row.teamLabel }}</span>
                          </div>

                          <!-- Sprint Cells (Drop Zones) -->
                          <div class="flex-1 flex relative">
                            <!-- Grid columns for sprints - these are drop zones -->
                            @for (sprint of sprintColumns(); track sprint.number) {
                              <div
                                class="flex-1 min-w-[160px] border-r border-slate-50 last:border-r-0 transition-colors"
                                [class.bg-primary/10]="isDropTarget(row.team, sprint.number)"
                                (dragover)="onDragOver($event, row.team, sprint.number)"
                                (dragleave)="onDragLeave($event)"
                                (drop)="onDrop($event, row.team, sprint.number)"
                              ></div>
                            }

                            <!-- Segment bars (positioned absolutely, draggable) -->
                            <div class="absolute inset-0 py-2 px-1 pointer-events-none">
                              @for (segment of row.segments; track segment.id; let i = $index) {
                                <div
                                  class="absolute h-12 rounded-lg shadow-sm border cursor-grab hover:shadow-md transition-shadow overflow-hidden flex items-center px-3 gap-2 pointer-events-auto"
                                  [class.opacity-50]="draggedSegment()?.id === segment.id"
                                  [class.cursor-grabbing]="draggedSegment()?.id === segment.id"
                                  [style.left.px]="getSegmentLeft(segment)"
                                  [style.width.px]="getSegmentWidth(segment)"
                                  [style.top.px]="8 + (i * 52)"
                                  [style.background-color]="segment.displayColor"
                                  [style.border-color]="darkenColor(segment.displayColor, 20)"
                                  [title]="segment.item.title + (segment.label ? ' - ' + segment.label : '') + ' (' + segment.effortPoints + ' pts, ' + segment.sprintCount + ' sprint' + (segment.sprintCount > 1 ? 's' : '') + ')'"
                                  draggable="true"
                                  (dragstart)="onDragStart($event, segment)"
                                  (dragend)="onDragEnd($event)"
                                >
                                  <div class="flex-1 min-w-0">
                                    <div class="font-medium text-slate-900 text-sm truncate">
                                      {{ segment.label || segment.item.title }}
                                    </div>
                                    <div class="text-xs text-slate-600">{{ segment.effortPoints }} pts</div>
                                  </div>
                                  @if (segment.sprintCount > 1) {
                                    <div class="flex-shrink-0 text-xs text-slate-500 bg-white/50 px-1.5 py-0.5 rounded">
                                      {{ segment.sprintCount }}s
                                    </div>
                                  }
                                </div>
                              }
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <!-- Legend -->
                <div class="mt-4 flex items-center gap-6 text-sm text-slate-600">
                  <div class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded bg-slate-200 border border-slate-300"></div>
                    <span>No theme</span>
                  </div>
                  @for (theme of currentSession()?.themes; track theme.id) {
                    <div class="flex items-center gap-2">
                      <div
                        class="w-4 h-4 rounded"
                        [style.background-color]="theme.color"
                      ></div>
                      <span>{{ theme.name }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center py-12 text-slate-500">
                  No items have been assigned to sprints yet.
                </div>
              }
            }

            @case ('dependencies') {
              <div class="space-y-6">
                <!-- Internal Dependencies -->
                @if (internalDependencies().length > 0) {
                  <div class="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 class="font-semibold text-slate-900 mb-4">Internal Dependencies</h3>
                    <p class="text-sm text-slate-500 mb-4">Dependencies between selected items</p>
                    <div class="space-y-3">
                      @for (dep of internalDependencies(); track dep.id) {
                        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div class="flex-1">
                            <span class="font-medium">{{ getItemTitle(dep.fromItemId) }}</span>
                          </div>
                          <div
                            class="px-2 py-1 rounded text-xs font-medium"
                            [class.bg-red-100]="dep.dependencyType === 'blocks'"
                            [class.text-red-700]="dep.dependencyType === 'blocks'"
                            [class.bg-blue-100]="dep.dependencyType !== 'blocks'"
                            [class.text-blue-700]="dep.dependencyType !== 'blocks'"
                          >
                            {{ dep.dependencyType }}
                          </div>
                          <div class="flex-1 text-right">
                            <span class="font-medium">{{ getItemTitle(dep.toItemId) }}</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- External Dependencies (Prerequisites) -->
                @if (externalDependencies().length > 0) {
                  <div class="bg-white rounded-xl border border-amber-200 p-6">
                    <div class="flex items-center gap-2 mb-4">
                      <ng-icon name="lucideAlertCircle" class="h-5 w-5 text-amber-500" />
                      <h3 class="font-semibold text-slate-900">External Prerequisites</h3>
                    </div>
                    <p class="text-sm text-slate-500 mb-4">
                      Work that may be needed but is not included in this roadmap
                    </p>
                    <div class="space-y-3">
                      @for (dep of externalDependencies(); track dep.id) {
                        <div class="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                          <div class="flex-1">
                            <div class="font-medium text-slate-900">{{ getItemTitle(dep.fromItemId) }}</div>
                            <div class="text-sm text-slate-600 mt-1">
                              <span class="font-medium text-amber-700">{{ dep.rationale || 'External dependency' }}</span>
                            </div>
                          </div>
                          <div class="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            {{ formatPrerequisiteType(dep.dependencyType) }}
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (internalDependencies().length === 0 && externalDependencies().length === 0) {
                  <div class="text-center py-12 text-slate-500">
                    No dependencies identified between items.
                  </div>
                }
              </div>
            }

            @case ('themes') {
              @if (currentSession()?.themes?.length) {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (theme of currentSession()?.themes; track theme.id) {
                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div
                        class="h-2"
                        [style.background-color]="theme.color"
                      ></div>
                      <div class="p-4">
                        <h3 class="font-semibold text-slate-900 mb-1">{{ theme.name }}</h3>
                        @if (theme.description) {
                          <p class="text-sm text-slate-600 mb-3">{{ theme.description }}</p>
                        }
                        <div class="flex items-center gap-4 text-sm text-slate-500">
                          <span>{{ theme.totalItems }} items</span>
                          <span>{{ theme.totalEffortPoints }} pts</span>
                        </div>
                        @if (theme.businessObjective) {
                          <div class="mt-3 pt-3 border-t border-slate-100">
                            <div class="text-xs text-slate-500 uppercase tracking-wide mb-1">Objective</div>
                            <div class="text-sm text-slate-700">{{ theme.businessObjective }}</div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center py-12 text-slate-500">
                  No themes have been identified.
                </div>
              }
            }
          }
        </div>
      }

      <!-- Loading -->
      @else {
        <div class="flex-1 flex items-center justify-center">
          <ng-icon name="lucideLoader2" class="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    </div>
  `,
})
export class RoadmapPlannerResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(RoadmapPlannerService);

  currentSession = this.service.currentSession;
  pipelineStatus = this.service.pipelineStatus;
  sprintSummaries = this.service.sprintSummaries;

  activeTab = signal<TabType>('timeline');

  Math = Math;

  private sessionId = 0;
  private readonly SPRINT_COLUMN_WIDTH = 160; // pixels per sprint column

  // Drag and drop state
  draggedSegment = signal<GanttSegment | null>(null);
  dropTargetTeam = signal<number | null>(null);
  dropTargetSprint = signal<number | null>(null)

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sessionId = parseInt(id, 10);
        this.loadSession();
      }
    });
  }

  loadSession(): void {
    this.service.fetchSession(this.sessionId);

    // Check status and poll if processing
    this.service.getStatus(this.sessionId).subscribe({
      next: (status) => {
        this.service.pipelineStatus.set(status);
        if (status.status !== 'completed' && status.status !== 'failed') {
          this.service.pollStatus(this.sessionId);
        } else if (status.status === 'completed') {
          this.service.fetchSprintSummaries(this.sessionId);
        }
      },
    });
  }

  isProcessing = computed(() => {
    const status = this.pipelineStatus()?.status;
    return (
      status &&
      status !== 'completed' &&
      status !== 'failed' &&
      status !== 'draft'
    );
  });

  hasError = computed(() => {
    return this.pipelineStatus()?.status === 'failed';
  });

  progressPercent = computed(() => {
    const status = this.pipelineStatus();
    if (!status) return 0;
    return (status.progressStep / status.progressTotal) * 100;
  });

  hasMultipleTeams(): boolean {
    const session = this.currentSession()?.session;
    return (session?.teamCount || 1) > 1;
  }

  // Calculate total sprints from segments (or items as fallback)
  totalSprints = computed(() => {
    const segments = this.currentSession()?.segments || [];
    const items = this.currentSession()?.items || [];

    let maxSprint = 0;

    // Try segments first
    if (segments.length > 0) {
      for (const segment of segments) {
        const endSprint = segment.startSprint + segment.sprintCount - 1;
        maxSprint = Math.max(maxSprint, endSprint);
      }
    } else {
      // Fallback to items if no segments
      for (const item of items) {
        if (item.assignedSprint) {
          const endSprint = item.assignedSprint + (item.sprintSpan || 1) - 1;
          maxSprint = Math.max(maxSprint, endSprint);
        }
      }
    }

    return maxSprint;
  });

  // Generate sprint column headers
  sprintColumns = computed((): SprintColumn[] => {
    const total = this.totalSprints();
    const session = this.currentSession()?.session;
    const startDate = session?.startDate ? new Date(session.startDate) : new Date();
    const sprintWeeks = session?.sprintLengthWeeks || 2;

    const columns: SprintColumn[] = [];
    for (let i = 1; i <= total; i++) {
      const sprintStart = new Date(startDate);
      sprintStart.setDate(startDate.getDate() + (i - 1) * sprintWeeks * 7);
      const sprintEnd = new Date(sprintStart);
      sprintEnd.setDate(sprintStart.getDate() + sprintWeeks * 7 - 1);

      columns.push({
        number: i,
        startDate: sprintStart,
        endDate: sprintEnd,
        label: this.formatDateRange(sprintStart, sprintEnd),
      });
    }
    return columns;
  });

  // Transform segments into GanttSegments with item and theme info
  ganttSegments = computed((): GanttSegment[] => {
    const rawSegments = this.currentSession()?.segments || [];
    const items = this.currentSession()?.items || [];
    const themes = this.currentSession()?.themes || [];

    const itemMap = new Map(items.map(i => [i.id, i]));
    const themeMap = new Map(themes.map(t => [t.id, t]));

    // If no segments, fall back to creating segments from items
    if (rawSegments.length === 0) {
      return items
        .filter(i => i.assignedSprint && !i.isExcluded)
        .map(item => {
          const theme = item.themeId ? themeMap.get(item.themeId) : undefined;
          return {
            id: item.id * 1000,  // Fake ID for item-based segment
            itemId: item.id,
            assignedTeam: item.assignedTeam || 1,
            startSprint: item.assignedSprint!,
            sprintCount: item.sprintSpan || 1,
            effortPoints: item.effortPoints,
            sequenceOrder: 0,
            rowIndex: 0,
            status: 'planned' as const,
            isManuallyPositioned: false,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            item,
            theme,
            endSprint: (item.assignedSprint || 1) + (item.sprintSpan || 1) - 1,
            displayColor: theme?.color || '#e2e8f0',
          };
        });
    }

    const result: GanttSegment[] = [];
    for (const seg of rawSegments) {
      const item = itemMap.get(seg.itemId);
      if (!item) continue;

      const theme = item.themeId ? themeMap.get(item.themeId) : undefined;
      result.push({
        ...seg,
        item,
        theme,
        endSprint: seg.startSprint + seg.sprintCount - 1,
        displayColor: seg.colorOverride || theme?.color || '#e2e8f0',
      });
    }
    return result;
  });

  // Generate Gantt rows (one per team) using segments
  ganttRows = computed((): GanttRow[] => {
    const segments = this.ganttSegments();
    const session = this.currentSession()?.session;
    const teamCount = session?.teamCount || 1;

    if (teamCount === 1) {
      // Single team - one row
      return [{
        team: null,
        teamLabel: 'Team',
        segments: segments,
      }];
    }

    // Multiple teams - one row per team
    const rows: GanttRow[] = [];
    for (let t = 1; t <= teamCount; t++) {
      rows.push({
        team: t,
        teamLabel: `Team ${t}`,
        segments: segments.filter(s => s.assignedTeam === t),
      });
    }
    return rows;
  });

  // Calculate row height based on number of items (to prevent overflow)
  getRowHeight(itemCount: number): number {
    const itemHeight = 52; // height + gap
    const padding = 16; // top + bottom padding
    return Math.max(60, itemCount * itemHeight + padding);
  }

  // Calculate segment position in Gantt chart
  getSegmentLeft(segment: GanttSegment): number {
    return (segment.startSprint - 1) * this.SPRINT_COLUMN_WIDTH;
  }

  getSegmentWidth(segment: GanttSegment): number {
    return segment.sprintCount * this.SPRINT_COLUMN_WIDTH - 8; // -8 for padding
  }

  // Legacy methods (keep for backward compatibility)
  getItemLeft(item: RoadmapItem): number {
    const sprint = item.assignedSprint || 1;
    return (sprint - 1) * this.SPRINT_COLUMN_WIDTH;
  }

  getItemWidth(item: RoadmapItem): number {
    const span = item.sprintSpan || 1;
    return span * this.SPRINT_COLUMN_WIDTH - 8;
  }

  getThemeColor(themeId?: number): string {
    if (!themeId) return '#e2e8f0';
    const theme = this.currentSession()?.themes?.find((t) => t.id === themeId);
    return theme?.color || '#e2e8f0';
  }

  getThemeBorderColor(themeId?: number): string {
    if (!themeId) return '#cbd5e1';
    const theme = this.currentSession()?.themes?.find((t) => t.id === themeId);
    if (!theme?.color) return '#cbd5e1';
    return this.darkenColor(theme.color, 20);
  }

  // Darken a hex color by a percentage (public for use in template)
  darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  getItemTitle(itemId: number): string {
    const item = this.currentSession()?.items?.find((i) => i.id === itemId);
    return item?.title || `Item ${itemId}`;
  }

  // Split dependencies into internal (between items) and external (prerequisites)
  internalDependencies = computed((): RoadmapDependency[] => {
    const deps = this.currentSession()?.dependencies || [];
    // Internal: both from and to are valid items (to_item_id is not null)
    return deps.filter(d => d.toItemId !== null && d.toItemId !== undefined);
  });

  externalDependencies = computed((): RoadmapDependency[] => {
    const deps = this.currentSession()?.dependencies || [];
    // External: to_item_id = null indicates external prerequisite
    return deps.filter(d => d.toItemId === null || d.toItemId === undefined);
  });

  // Format external dependency type for display
  formatPrerequisiteType(depType: string): string {
    return depType
      .replace('requires_', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  retry(): void {
    this.service.startPipeline(this.sessionId).subscribe({
      next: () => {
        this.service.pollStatus(this.sessionId);
      },
    });
  }

  exportCsv(): void {
    window.open(this.service.getExportCsvUrl(this.sessionId), '_blank');
  }

  goBack(): void {
    this.router.navigate(['/roadmapping/planner']);
  }

  private formatDateRange(start: Date, end: Date): string {
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }

  // =========================================================================
  // Drag and Drop for Segments
  // =========================================================================

  onDragStart(event: DragEvent, segment: GanttSegment): void {
    this.draggedSegment.set(segment);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', segment.id.toString());
    }
  }

  onDragEnd(event: DragEvent): void {
    this.draggedSegment.set(null);
    this.dropTargetTeam.set(null);
    this.dropTargetSprint.set(null);
  }

  onDragOver(event: DragEvent, team: number | null, sprint: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dropTargetTeam.set(team);
    this.dropTargetSprint.set(sprint);
  }

  onDragLeave(event: DragEvent): void {
    this.dropTargetTeam.set(null);
    this.dropTargetSprint.set(null);
  }

  onDrop(event: DragEvent, targetTeam: number | null, targetSprint: number): void {
    event.preventDefault();
    const segment = this.draggedSegment();
    if (!segment) return;

    // Calculate new position
    const newTeam = targetTeam || 1;
    const newStartSprint = targetSprint;

    // Only update if position actually changed
    if (segment.assignedTeam === newTeam && segment.startSprint === newStartSprint) {
      this.draggedSegment.set(null);
      return;
    }

    // Call bulk update API
    this.service.updateSegmentsBulk(this.sessionId, {
      segments: [{
        id: segment.id,
        assignedTeam: newTeam,
        startSprint: newStartSprint,
      }]
    }).subscribe({
      next: () => {
        // Refresh session data to get updated segments
        this.service.fetchSession(this.sessionId);
      },
      error: (err) => {
        console.error('Failed to update segment:', err);
      }
    });

    this.draggedSegment.set(null);
    this.dropTargetTeam.set(null);
    this.dropTargetSprint.set(null);
  }

  isDropTarget(team: number | null, sprint: number): boolean {
    return this.dropTargetTeam() === team && this.dropTargetSprint() === sprint;
  }
}
