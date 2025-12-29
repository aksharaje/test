import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideMap,
  lucideCheck,
  lucideLoader2,
  lucideCalendar,
  lucideUsers,
  lucideSettings,
  lucideArrowRight,
  lucideFileText,
  lucideLayers,
  lucideInfo,
  lucideHistory,
  lucideChevronRight,
  lucideSearch,
  lucideX,
  lucideRotateCw,
  lucideTrash2,
  lucideEye,
  lucidePlus,
  lucideCheckCircle,
  lucideAlertTriangle,
  lucideEdit,
} from '@ng-icons/lucide';
import { RoadmapPlannerService } from './roadmap-planner.service';
import type {
  AvailableArtifactForRoadmap,
  AvailableFeasibilityForRoadmap,
  CustomRoadmapItem,
  RoadmapSession,
} from './roadmap-planner.types';

type SourceTab = 'feasibility' | 'artifact' | 'custom';

@Component({
  selector: 'app-roadmap-planner-input',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideMap,
      lucideCheck,
      lucideLoader2,
      lucideCalendar,
      lucideUsers,
      lucideSettings,
      lucideArrowRight,
      lucideFileText,
      lucideLayers,
      lucideInfo,
      lucideHistory,
      lucideChevronRight,
      lucideSearch,
      lucideX,
      lucideRotateCw,
      lucideTrash2,
      lucideEye,
      lucidePlus,
      lucideCheckCircle,
      lucideAlertTriangle,
      lucideEdit,
    }),
  ],
  template: `
    <div class="flex min-h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideMap" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold text-foreground">Roadmap Planner</h1>
          </div>
          <p class="text-muted-foreground mb-6">
            Transform your epics, features, and ideas into a sequenced, capacity-matched roadmap.
          </p>

          <!-- Roadmap Name -->
          <div class="mb-6">
            <label class="text-sm font-medium">Roadmap Name</label>
            <input
              type="text"
              [(ngModel)]="roadmapName"
              class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Q1 2025 Roadmap"
            />
          </div>

          <!-- Source Selection Tabs -->
          <div class="mb-6">
            <label class="text-sm font-medium mb-2 block">Select Feature Source</label>
            <div class="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                (click)="activeSourceTab.set('feasibility')"
                class="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors"
                [class.bg-primary]="activeSourceTab() === 'feasibility'"
                [class.text-white]="activeSourceTab() === 'feasibility'"
                [class.bg-slate-100]="activeSourceTab() !== 'feasibility'"
                [class.text-slate-700]="activeSourceTab() !== 'feasibility'"
                [class.hover:bg-slate-200]="activeSourceTab() !== 'feasibility'"
              >
                <ng-icon name="lucideCheckCircle" class="h-4 w-4" />
                Feasibility Analysis
              </button>
              <button
                type="button"
                (click)="activeSourceTab.set('artifact')"
                class="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors"
                [class.bg-primary]="activeSourceTab() === 'artifact'"
                [class.text-white]="activeSourceTab() === 'artifact'"
                [class.bg-slate-100]="activeSourceTab() !== 'artifact'"
                [class.text-slate-700]="activeSourceTab() !== 'artifact'"
                [class.hover:bg-slate-200]="activeSourceTab() !== 'artifact'"
              >
                <ng-icon name="lucideLayers" class="h-4 w-4" />
                Epic/Feature
              </button>
              <button
                type="button"
                (click)="activeSourceTab.set('custom')"
                class="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors"
                [class.bg-primary]="activeSourceTab() === 'custom'"
                [class.text-white]="activeSourceTab() === 'custom'"
                [class.bg-slate-100]="activeSourceTab() !== 'custom'"
                [class.text-slate-700]="activeSourceTab() !== 'custom'"
                [class.hover:bg-slate-200]="activeSourceTab() !== 'custom'"
              >
                <ng-icon name="lucideEdit" class="h-4 w-4" />
                Write Custom
              </button>
            </div>

            <!-- Source Content -->
            @if (loading()) {
              <div class="flex items-center justify-center py-8 text-muted-foreground border rounded-lg">
                <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin mr-2" />
                Loading sources...
              </div>
            } @else {
              <!-- Feasibility Tab -->
              @if (activeSourceTab() === 'feasibility') {
                <div>
                  <p class="text-xs text-muted-foreground mb-2">
                    Development estimates will be imported from the feasibility analysis.
                  </p>
                  @if (selectedFeasibilityIds().length > 0) {
                    <div class="flex flex-wrap gap-2 mb-2">
                      @for (id of selectedFeasibilityIds(); track id) {
                        @if (getFeasibilityById(id); as item) {
                          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                            {{ item.title | slice:0:40 }}{{ item.title.length > 40 ? '...' : '' }}
                            <button type="button" (click)="toggleFeasibility(id)" class="hover:text-primary/70">
                              <ng-icon name="lucideX" class="h-3 w-3" />
                            </button>
                          </span>
                        }
                      }
                    </div>
                  }
                  <div class="relative">
                    <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search feasibility analyses..."
                      class="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      [value]="searchFilter()"
                      (input)="onSearchInput($event)"
                      (focus)="dropdownOpen.set(true)"
                      (blur)="onBlur()"
                    />
                    @if (dropdownOpen() && activeSourceTab() === 'feasibility') {
                      <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-white shadow-lg max-h-64 overflow-y-auto">
                        @if (filteredFeasibility().length === 0) {
                          <div class="p-3 text-center text-sm text-muted-foreground">No feasibility analyses available</div>
                        } @else {
                          @for (item of filteredFeasibility(); track item.id) {
                            <button
                              type="button"
                              class="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b last:border-b-0"
                              [class.bg-primary/10]="isFeasibilitySelected(item.id)"
                              (mousedown)="toggleFeasibility(item.id); $event.preventDefault()"
                            >
                              <div
                                class="mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                                [class.bg-primary]="isFeasibilitySelected(item.id)"
                                [class.border-primary]="isFeasibilitySelected(item.id)"
                              >
                                @if (isFeasibilitySelected(item.id)) {
                                  <ng-icon name="lucideCheck" class="h-3 w-3 text-white" />
                                }
                              </div>
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="font-medium text-sm">{{ item.title }}</span>
                                  @if (item.goNoGo) {
                                    <span
                                      class="px-2 py-0.5 text-xs rounded-full"
                                      [class.bg-green-100]="item.goNoGo === 'go'"
                                      [class.text-green-700]="item.goNoGo === 'go'"
                                      [class.bg-red-100]="item.goNoGo === 'no_go'"
                                      [class.text-red-700]="item.goNoGo === 'no_go'"
                                      [class.bg-yellow-100]="item.goNoGo === 'conditional'"
                                      [class.text-yellow-700]="item.goNoGo === 'conditional'"
                                    >
                                      {{ item.goNoGo === 'go' ? 'Go' : item.goNoGo === 'no_go' ? 'No Go' : 'Conditional' }}
                                    </span>
                                  }
                                </div>
                                @if (item.totalWeeks) {
                                  <p class="mt-1 text-xs text-muted-foreground">
                                    Est. {{ item.totalWeeks }} weeks · {{ item.totalHours || 0 }} hours
                                  </p>
                                }
                              </div>
                            </button>
                          }
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Artifact Tab -->
              @if (activeSourceTab() === 'artifact') {
                <div>
                  <p class="text-xs text-muted-foreground mb-2">
                    Select epics or features from the Story Generator.
                  </p>
                  @if (selectedArtifactIds().length > 0) {
                    <div class="flex flex-wrap gap-2 mb-2">
                      @for (id of selectedArtifactIds(); track id) {
                        @if (getArtifactById(id); as item) {
                          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                            {{ item.title | slice:0:40 }}{{ item.title.length > 40 ? '...' : '' }}
                            <button type="button" (click)="toggleArtifact(id)" class="hover:text-primary/70">
                              <ng-icon name="lucideX" class="h-3 w-3" />
                            </button>
                          </span>
                        }
                      }
                    </div>
                  }
                  <div class="relative">
                    <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search epics and features..."
                      class="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      [value]="searchFilter()"
                      (input)="onSearchInput($event)"
                      (focus)="dropdownOpen.set(true)"
                      (blur)="onBlur()"
                    />
                    @if (dropdownOpen() && activeSourceTab() === 'artifact') {
                      <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-white shadow-lg max-h-64 overflow-y-auto">
                        @if (filteredArtifacts().length === 0) {
                          <div class="p-3 text-center text-sm text-muted-foreground">No epics or features available</div>
                        } @else {
                          @for (item of filteredArtifacts(); track item.id) {
                            <button
                              type="button"
                              class="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b last:border-b-0"
                              [class.bg-primary/10]="isArtifactSelected(item.id)"
                              (mousedown)="toggleArtifact(item.id); $event.preventDefault()"
                            >
                              <div
                                class="mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                                [class.bg-primary]="isArtifactSelected(item.id)"
                                [class.border-primary]="isArtifactSelected(item.id)"
                              >
                                @if (isArtifactSelected(item.id)) {
                                  <ng-icon name="lucideCheck" class="h-3 w-3 text-white" />
                                }
                              </div>
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="font-medium text-sm">{{ item.title }}</span>
                                  <span
                                    class="px-2 py-0.5 text-xs rounded-full"
                                    [class.bg-purple-100]="item.type === 'epic'"
                                    [class.text-purple-700]="item.type === 'epic'"
                                    [class.bg-blue-100]="item.type === 'feature'"
                                    [class.text-blue-700]="item.type === 'feature'"
                                  >
                                    {{ item.type | titlecase }}
                                  </span>
                                </div>
                                <p class="mt-1 text-xs text-muted-foreground line-clamp-1">
                                  {{ item.preview }}
                                </p>
                                @if (item.effortEstimate || item.childCount) {
                                  <p class="mt-1 text-xs text-muted-foreground">
                                    @if (item.effortEstimate) { {{ item.effortEstimate }} pts }
                                    @if (item.childCount) { · {{ item.childCount }} items }
                                  </p>
                                }
                              </div>
                            </button>
                          }
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Custom Tab -->
              @if (activeSourceTab() === 'custom') {
                <div>
                  <p class="text-xs text-muted-foreground mb-2">
                    Add custom items that aren't in other systems.
                  </p>
                  @for (item of customItems(); track $index; let i = $index) {
                    <div class="border rounded-lg p-3 mb-3 bg-slate-50">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-muted-foreground">Custom Item {{ i + 1 }}</span>
                        <button
                          type="button"
                          (click)="removeCustomItem(i)"
                          class="text-destructive hover:text-destructive/80"
                        >
                          <ng-icon name="lucideTrash2" class="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        [ngModel]="item.title"
                        (ngModelChange)="updateCustomItem(i, 'title', $event)"
                        placeholder="Title"
                        class="w-full px-3 py-2 text-sm border rounded-md mb-2"
                      />
                      <textarea
                        [ngModel]="item.description"
                        (ngModelChange)="updateCustomItem(i, 'description', $event)"
                        rows="2"
                        placeholder="Description (optional)"
                        class="w-full px-3 py-2 text-sm border rounded-md mb-2"
                      ></textarea>
                      <input
                        type="number"
                        [ngModel]="item.effortEstimate"
                        (ngModelChange)="updateCustomItem(i, 'effortEstimate', $event)"
                        placeholder="Effort estimate (story points)"
                        class="w-full px-3 py-2 text-sm border rounded-md"
                      />
                    </div>
                  }
                  <button
                    type="button"
                    (click)="addCustomItem()"
                    class="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                  >
                    <ng-icon name="lucidePlus" class="h-4 w-4" />
                    Add Custom Item
                  </button>
                </div>
              }
            }
          </div>

          <!-- Selection Summary -->
          @if (totalSelectedCount() > 0) {
            <div class="p-3 bg-slate-50 rounded-lg mb-6">
              <p class="text-sm font-medium text-slate-700 mb-1">Selected Items ({{ totalSelectedCount() }})</p>
              <div class="text-xs text-muted-foreground">
                @if (selectedFeasibilityIds().length > 0) {
                  <span>{{ selectedFeasibilityIds().length }} feasibility</span>
                }
                @if (selectedArtifactIds().length > 0) {
                  <span class="ml-2">{{ selectedArtifactIds().length }} epics/features</span>
                }
                @if (customItems().length > 0) {
                  <span class="ml-2">{{ customItems().length }} custom</span>
                }
              </div>
            </div>
          }

          <!-- Configuration -->
          <div class="bg-white rounded-lg border p-4 mb-6">
            <h3 class="text-sm font-semibold mb-4 flex items-center gap-2">
              <ng-icon name="lucideSettings" class="h-4 w-4" />
              Configuration
            </h3>
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">
                  <ng-icon name="lucideCalendar" class="h-3 w-3 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  [(ngModel)]="startDate"
                  class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">Sprint Length</label>
                <select
                  [(ngModel)]="sprintLengthWeeks"
                  class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20"
                >
                  <option [value]="1">1 week</option>
                  <option [value]="2">2 weeks</option>
                  <option [value]="3">3 weeks</option>
                  <option [value]="4">4 weeks</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">
                  <ng-icon name="lucideUsers" class="h-3 w-3 inline mr-1" />
                  Teams
                </label>
                <input
                  type="number"
                  [(ngModel)]="teamCount"
                  min="1"
                  max="20"
                  class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">Velocity/Team</label>
                <input
                  type="number"
                  [(ngModel)]="teamVelocity"
                  min="1"
                  class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">Buffer %</label>
                <input
                  type="number"
                  [(ngModel)]="bufferPercentage"
                  min="0"
                  max="50"
                  class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div class="mt-3 p-2 bg-slate-50 rounded text-xs text-muted-foreground">
              <ng-icon name="lucideInfo" class="h-3 w-3 inline mr-1" />
              Effective capacity: <span class="font-medium">{{ effectiveCapacity() }} pts/sprint</span>
              ({{ teamCount }} team{{ teamCount > 1 ? 's' : '' }} × {{ teamVelocity }} pts × {{ 100 - bufferPercentage }}%)
            </div>
          </div>

          <!-- Generate Button -->
          <button
            (click)="generateRoadmap()"
            [disabled]="totalSelectedCount() === 0 || generating()"
            class="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            @if (generating()) {
              <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin" />
              Creating Roadmap...
            } @else {
              Generate Roadmap
              <ng-icon name="lucideArrowRight" class="h-5 w-5" />
            }
          </button>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30 min-h-full">
        <div class="border-b bg-white p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Roadmap History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past roadmap sessions
          </p>
        </div>

        <div class="flex-1 overflow-y-auto">
          @if (service.loading() && service.sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3]; track i) {
                  <div class="rounded-lg border bg-white p-4">
                    <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (service.sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-64">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your roadmap sessions will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-white p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="isProcessing(session.status)"
                          [class.text-yellow-700]="isProcessing(session.status)"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-slate-100]="session.status === 'draft'"
                          [class.text-slate-700]="session.status === 'draft'"
                        >
                          {{ getStatusLabel(session.status) }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-foreground">
                        {{ session.name }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ session.totalItems }} items · {{ session.totalSprints }} sprints
                      </p>
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed' || session.status === 'draft') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry"
                        >
                          <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                        </button>
                      }
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        (click)="deleteSession($event, session)"
                        title="Delete"
                      >
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                      <ng-icon name="lucideChevronRight" class="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100%;
    }
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class RoadmapPlannerInputComponent implements OnInit {
  private router = inject(Router);
  service = inject(RoadmapPlannerService);

  // Loading and generating states
  loading = signal(false);
  generating = signal(false);

  // Active source tab
  activeSourceTab = signal<SourceTab>('feasibility');

  // Search and dropdown
  searchFilter = signal('');
  dropdownOpen = signal(false);

  // Selected items from each source
  selectedFeasibilityIds = signal<number[]>([]);
  selectedArtifactIds = signal<number[]>([]);
  customItems = signal<CustomRoadmapItem[]>([]);

  // Configuration
  roadmapName = 'Q1 2025 Roadmap';
  startDate = this.formatDateString(new Date());
  sprintLengthWeeks = 2;
  teamCount = 1;
  teamVelocity = 40;
  bufferPercentage = 20;

  // Computed filtered lists based on search
  filteredFeasibility = computed(() => {
    const filter = this.searchFilter().toLowerCase();
    const items = this.service.availableFeasibility();
    if (!filter) return items;
    return items.filter(
      (i) => i.title.toLowerCase().includes(filter) || i.featureDescription.toLowerCase().includes(filter)
    );
  });

  filteredArtifacts = computed(() => {
    const filter = this.searchFilter().toLowerCase();
    const items = this.service.availableArtifacts();
    if (!filter) return items;
    return items.filter(
      (i) => i.title.toLowerCase().includes(filter) || i.preview.toLowerCase().includes(filter)
    );
  });

  totalSelectedCount = computed(() => {
    return (
      this.selectedFeasibilityIds().length +
      this.selectedArtifactIds().length +
      this.customItems().filter((i) => i.title).length
    );
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.service.fetchAllAvailableSources();
    this.service.fetchSessions();
    // Wait for loading to finish
    setTimeout(() => this.loading.set(false), 500);
  }

  private formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  effectiveCapacity(): number {
    return Math.round(this.teamCount * this.teamVelocity * (1 - this.bufferPercentage / 100));
  }

  // Search
  onSearchInput(event: Event): void {
    this.searchFilter.set((event.target as HTMLInputElement).value);
  }

  onBlur(): void {
    setTimeout(() => this.dropdownOpen.set(false), 200);
  }

  // Feasibility selection
  isFeasibilitySelected(id: number): boolean {
    return this.selectedFeasibilityIds().includes(id);
  }

  toggleFeasibility(id: number): void {
    this.selectedFeasibilityIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  getFeasibilityById(id: number): AvailableFeasibilityForRoadmap | undefined {
    return this.service.availableFeasibility().find((i) => i.id === id);
  }

  // Artifact selection
  isArtifactSelected(id: number): boolean {
    return this.selectedArtifactIds().includes(id);
  }

  toggleArtifact(id: number): void {
    this.selectedArtifactIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  getArtifactById(id: number): AvailableArtifactForRoadmap | undefined {
    return this.service.availableArtifacts().find((i) => i.id === id);
  }

  // Custom items
  addCustomItem(): void {
    this.customItems.update((items) => [
      ...items,
      { title: '', description: '', effortEstimate: undefined },
    ]);
  }

  removeCustomItem(index: number): void {
    this.customItems.update((items) => items.filter((_, i) => i !== index));
  }

  updateCustomItem(index: number, field: keyof CustomRoadmapItem, value: any): void {
    this.customItems.update((items) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  // Generate roadmap
  generateRoadmap(): void {
    console.log('generateRoadmap called');
    console.log('totalSelectedCount:', this.totalSelectedCount());
    console.log('selectedFeasibilityIds:', this.selectedFeasibilityIds());
    console.log('selectedArtifactIds:', this.selectedArtifactIds());
    console.log('customItems:', this.customItems());

    if (this.totalSelectedCount() === 0) {
      console.log('No items selected, returning early');
      return;
    }

    this.generating.set(true);
    console.log('Starting session creation...');

    const validCustomItems = this.customItems().filter((i) => i.title);

    const payload = {
      name: this.roadmapName,
      artifactIds: this.selectedArtifactIds(),
      feasibilityIds: this.selectedFeasibilityIds(),
      ideationIds: [],  // Ideation disabled for now
      customItems: validCustomItems,
      sprintLengthWeeks: this.sprintLengthWeeks,
      teamVelocity: this.teamVelocity,
      teamCount: this.teamCount,
      bufferPercentage: this.bufferPercentage,
      startDate: this.startDate,
    };
    console.log('Payload:', payload);

    this.service
      .createSession(payload)
      .subscribe({
        next: (session) => {
          this.service.startPipeline(session.id).subscribe({
            next: () => {
              this.router.navigate(['/roadmapping/planner/session', session.id]);
            },
            error: (err) => {
              console.error('Failed to start pipeline', err);
              this.generating.set(false);
            },
          });
        },
        error: (err) => {
          console.error('Failed to create session', err);
          this.generating.set(false);
        },
      });
  }

  // History methods
  viewSession(session: RoadmapSession): void {
    if (session.status === 'completed') {
      this.router.navigate(['/roadmapping/planner/session', session.id]);
    } else if (this.isProcessing(session.status)) {
      this.router.navigate(['/roadmapping/planner/session', session.id]);
    }
  }

  retrySession(event: Event, session: RoadmapSession): void {
    event.stopPropagation();
    this.service.startPipeline(session.id).subscribe({
      next: () => {
        this.router.navigate(['/roadmapping/planner/session', session.id]);
      },
      error: (err) => console.error('Failed to retry:', err),
    });
  }

  deleteSession(event: Event, session: RoadmapSession): void {
    event.stopPropagation();
    if (confirm('Delete this roadmap session?')) {
      this.service.deleteSession(session.id).subscribe({
        next: () => this.service.fetchSessions(),
        error: (err) => console.error('Failed to delete:', err),
      });
    }
  }

  isProcessing(status: string): boolean {
    return [
      'processing',
      'sequencing',
      'analyzing_dependencies',
      'clustering_themes',
      'matching_capacity',
      'generating_milestones',
    ].includes(status);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      processing: 'Processing',
      sequencing: 'Sequencing',
      analyzing_dependencies: 'Analyzing',
      clustering_themes: 'Clustering',
      matching_capacity: 'Matching',
      generating_milestones: 'Finalizing',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
