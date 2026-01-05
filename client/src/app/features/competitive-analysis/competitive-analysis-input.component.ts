import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideHistory,
  lucideLoader2,
  lucideSparkles,
  lucideTrash2,
  lucideX,
  lucidePlus,
  lucideRotateCw,
  lucideSearch,
  lucideTarget,
  lucideTrendingUp,
  lucideBuilding2,
  lucideCode,
  lucideCheck,
  lucideDatabase,
  lucideLayers,
  lucideFileText,
  lucideLightbulb,
  lucideClipboardList,
} from '@ng-icons/lucide';
import { CompetitiveAnalysisService } from './competitive-analysis.service';
import type { CompetitiveAnalysisSession, EpicOrFeature, ScopeDefinitionSummary, IdeationSessionSummary } from './competitive-analysis.types';
import { HlmButtonDirective } from '../../ui/button';

type InputSourceType = 'none' | 'epic_feature' | 'ideation' | 'code_repository';
type FocusAreaSourceType = 'manual' | 'ideation' | 'okr' | 'scope_definition';

@Component({
  selector: 'app-competitive-analysis-input',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideHistory,
      lucideLoader2,
      lucideSparkles,
      lucideTrash2,
      lucideX,
      lucidePlus,
      lucideRotateCw,
      lucideSearch,
      lucideTarget,
      lucideTrendingUp,
      lucideBuilding2,
      lucideCode,
      lucideCheck,
      lucideDatabase,
      lucideLayers,
      lucideFileText,
      lucideLightbulb,
      lucideClipboardList,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <h1 class="text-2xl font-bold text-foreground">Competitive Analysis</h1>
          <p class="mt-1 text-muted-foreground">
            Learn how others solve the same challenge — without manual research.
          </p>

          @if (service.error()) {
            <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p class="text-sm text-destructive">{{ service.error() }}</p>
            </div>
          }

          <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
            <!-- Step 1: Focus Area -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideTarget" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 1: Select Focus Area</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Choose a focus area from existing work or enter one manually
              </p>

              <!-- Focus Area Source Type Tabs -->
              @if (hasFocusAreaSources()) {
                <div class="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="focusAreaSourceType() === 'manual'"
                    [class.text-primary-foreground]="focusAreaSourceType() === 'manual'"
                    [class.bg-muted]="focusAreaSourceType() !== 'manual'"
                    [class.hover:bg-muted/80]="focusAreaSourceType() !== 'manual'"
                    (click)="setFocusAreaSourceType('manual')"
                  >
                    Manual
                  </button>
                  @if (service.ideationSessions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="focusAreaSourceType() === 'ideation'"
                      [class.text-primary-foreground]="focusAreaSourceType() === 'ideation'"
                      [class.bg-muted]="focusAreaSourceType() !== 'ideation'"
                      [class.hover:bg-muted/80]="focusAreaSourceType() !== 'ideation'"
                      (click)="setFocusAreaSourceType('ideation')"
                    >
                      <ng-icon name="lucideLightbulb" class="h-3.5 w-3.5" />
                      Ideation
                    </button>
                  }
                  @if (service.okrSessions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="focusAreaSourceType() === 'okr'"
                      [class.text-primary-foreground]="focusAreaSourceType() === 'okr'"
                      [class.bg-muted]="focusAreaSourceType() !== 'okr'"
                      [class.hover:bg-muted/80]="focusAreaSourceType() !== 'okr'"
                      (click)="setFocusAreaSourceType('okr')"
                    >
                      <ng-icon name="lucideTarget" class="h-3.5 w-3.5" />
                      OKRs
                    </button>
                  }
                  @if (service.scopeDefinitions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="focusAreaSourceType() === 'scope_definition'"
                      [class.text-primary-foreground]="focusAreaSourceType() === 'scope_definition'"
                      [class.bg-muted]="focusAreaSourceType() !== 'scope_definition'"
                      [class.hover:bg-muted/80]="focusAreaSourceType() !== 'scope_definition'"
                      (click)="setFocusAreaSourceType('scope_definition')"
                    >
                      <ng-icon name="lucideFileText" class="h-3.5 w-3.5" />
                      Scope Definition
                    </button>
                  }
                </div>
              }

              <!-- Manual Focus Area Selection -->
              @if (focusAreaSourceType() === 'manual') {
                <div class="relative">
                  <button
                    type="button"
                    class="w-full flex items-center justify-between rounded-lg border bg-background p-3 text-sm text-left"
                    [class.text-muted-foreground]="!focusArea()"
                    (click)="toggleFocusAreaDropdown()"
                  >
                    <span>{{ selectedFocusAreaLabel() || 'Please select a focus area...' }}</span>
                    <ng-icon [name]="focusAreaDropdownOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                  </button>

                  @if (focusAreaDropdownOpen()) {
                    <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg">
                      <div class="p-2 border-b">
                        <div class="relative">
                          <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="text"
                            class="w-full rounded border bg-muted/30 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Type to filter..."
                            [value]="focusAreaFilter()"
                            (input)="onFocusAreaFilterInput($event)"
                          />
                        </div>
                      </div>
                      <div class="max-h-64 overflow-y-auto p-1">
                        @for (area of filteredFocusAreas(); track area.value) {
                          <button
                            type="button"
                            class="w-full flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50 text-left"
                            [class.bg-primary/10]="focusArea() === area.value"
                            (click)="selectFocusArea(area.value)"
                          >
                            @if (focusArea() === area.value) {
                              <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
                            } @else {
                              <div class="h-4 w-4"></div>
                            }
                            <span>{{ area.label }}</span>
                          </button>
                        }
                        @if (filteredFocusAreas().length === 0) {
                          <p class="p-2 text-sm text-muted-foreground text-center">No matching focus areas</p>
                        }
                      </div>
                    </div>
                  }
                </div>

                @if (focusArea() === 'other') {
                  <input
                    type="text"
                    class="mt-3 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Describe your focus area..."
                    [value]="customFocusArea()"
                    (input)="onCustomFocusAreaInput($event)"
                  />
                }
              }

              <!-- Ideation Session Selection -->
              @if (focusAreaSourceType() === 'ideation') {
                <select
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedFocusAreaSourceId()"
                  (change)="onFocusAreaIdeationSelect($event)"
                >
                  <option value="">Select an ideation session...</option>
                  @for (session of service.ideationSessions(); track session.id) {
                    <option [value]="session.id">
                      {{ truncate(session.problemStatement, 60) }}
                    </option>
                  }
                </select>
              }

              <!-- OKR Session Selection -->
              @if (focusAreaSourceType() === 'okr') {
                <select
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedFocusAreaSourceId()"
                  (change)="onFocusAreaOkrSelect($event)"
                >
                  <option value="">Select an OKR session...</option>
                  @for (session of service.okrSessions(); track session.id) {
                    <option [value]="session.id">
                      {{ truncate(session.goalDescription, 60) }}
                    </option>
                  }
                </select>
              }

              <!-- Scope Definition Selection -->
              @if (focusAreaSourceType() === 'scope_definition') {
                <select
                  class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  [value]="selectedFocusAreaSourceId()"
                  (change)="onFocusAreaScopeSelect($event)"
                >
                  <option value="">Select a scope definition...</option>
                  @for (session of service.scopeDefinitions(); track session.id) {
                    <option [value]="session.id">
                      {{ session.projectName }}
                    </option>
                  }
                </select>
              }

              <!-- Focus Area Context Preview -->
              @if (focusAreaSourceType() !== 'manual' && focusAreaContext()) {
                <div class="mt-3 rounded-lg border bg-muted/30 p-3">
                  <p class="text-xs text-muted-foreground mb-1">Focus Area Context:</p>
                  <p class="text-sm whitespace-pre-line line-clamp-3">{{ focusAreaContext() }}</p>
                </div>
              }
            </div>

            <!-- Step 2: Direct Competitors -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideBuilding2" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 2: Direct Competitors</h2>
              </div>
              <p class="text-xs text-muted-foreground mb-4">
                Add specific companies or products you want to compare against
              </p>

              <!-- Competitor chips -->
              <div class="flex flex-wrap gap-2 mb-3">
                @for (company of referenceCompetitors(); track company) {
                  <span class="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm font-medium">
                    {{ company }}
                    <button
                      type="button"
                      class="p-0.5 hover:bg-background rounded-full"
                      (click)="removeCompetitor(company)"
                    >
                      <ng-icon name="lucideX" class="h-3 w-3" />
                    </button>
                  </span>
                }
              </div>

              <div class="flex gap-2">
                <input
                  type="text"
                  class="flex-1 rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Stripe, Shopify, Square..."
                  [value]="newCompetitor()"
                  (input)="onNewCompetitorInput($event)"
                  (keydown.enter)="addCompetitor($event)"
                />
                <button
                  type="button"
                  hlmBtn
                  variant="outline"
                  size="sm"
                  (click)="addCompetitor()"
                  [disabled]="!newCompetitor().trim()"
                >
                  <ng-icon name="lucidePlus" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Step 3: Analysis Options -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideTrendingUp" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 3: Analysis Options</h2>
              </div>

              <div class="space-y-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    [checked]="includeBestInClass()"
                    (change)="toggleBestInClass()"
                  />
                  <span class="text-sm">Include best-in-class digital products</span>
                </label>

                <div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      [checked]="includeIndustrySolutions()"
                      (change)="toggleIndustrySolutions()"
                    />
                    <span class="text-sm">Include industry-specific solutions</span>
                  </label>

                  @if (includeIndustrySolutions()) {
                    <div class="mt-2 ml-6">
                      <select
                        class="w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        [value]="targetIndustry()"
                        (change)="onIndustrySelect($event)"
                      >
                        <option value="">Select an industry...</option>
                        @for (ind of service.industries(); track ind.value) {
                          <option [value]="ind.value">{{ ind.label }}</option>
                        }
                      </select>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Step 4: Product Context (Optional) -->
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-center gap-2 mb-1">
                <ng-icon name="lucideClipboardList" class="h-5 w-5 text-primary" />
                <h2 class="font-semibold">Step 4: Product Context</h2>
                <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Optional</span>
              </div>
              <p class="text-xs text-muted-foreground mb-3">
                Add context from existing work or your codebase to get more targeted competitive insights
              </p>

              @if (hasInputSources()) {
                <!-- Source Type Tabs -->
                <div class="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                    [class.bg-primary]="inputSourceType() === 'none'"
                    [class.text-primary-foreground]="inputSourceType() === 'none'"
                    [class.bg-muted]="inputSourceType() !== 'none'"
                    [class.hover:bg-muted/80]="inputSourceType() !== 'none'"
                    (click)="setInputSourceType('none')"
                  >
                    None
                  </button>
                  @if (service.epicsAndFeatures().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="inputSourceType() === 'epic_feature'"
                      [class.text-primary-foreground]="inputSourceType() === 'epic_feature'"
                      [class.bg-muted]="inputSourceType() !== 'epic_feature'"
                      [class.hover:bg-muted/80]="inputSourceType() !== 'epic_feature'"
                      (click)="setInputSourceType('epic_feature')"
                    >
                      <ng-icon name="lucideLayers" class="h-3.5 w-3.5" />
                      Epic/Feature
                    </button>
                  }
                  @if (service.ideationSessions().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="inputSourceType() === 'ideation'"
                      [class.text-primary-foreground]="inputSourceType() === 'ideation'"
                      [class.bg-muted]="inputSourceType() !== 'ideation'"
                      [class.hover:bg-muted/80]="inputSourceType() !== 'ideation'"
                      (click)="setInputSourceType('ideation')"
                    >
                      <ng-icon name="lucideLightbulb" class="h-3.5 w-3.5" />
                      Ideation
                    </button>
                  }
                  @if (service.codeKnowledgeBases().length > 0) {
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                      [class.bg-primary]="inputSourceType() === 'code_repository'"
                      [class.text-primary-foreground]="inputSourceType() === 'code_repository'"
                      [class.bg-muted]="inputSourceType() !== 'code_repository'"
                      [class.hover:bg-muted/80]="inputSourceType() !== 'code_repository'"
                      (click)="setInputSourceType('code_repository')"
                    >
                      <ng-icon name="lucideCode" class="h-3.5 w-3.5" />
                      Code Repository
                    </button>
                  }
                </div>

                <!-- Epic/Feature Selection -->
                @if (inputSourceType() === 'epic_feature') {
                  <select
                    class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    [value]="selectedInputSourceId()"
                    (change)="onEpicFeatureSelect($event)"
                  >
                    <option value="">Select an epic or feature...</option>
                    @for (item of service.epicsAndFeatures(); track item.id) {
                      <option [value]="item.id">
                        [{{ item.type.toUpperCase() }}] {{ item.title }}
                      </option>
                    }
                  </select>
                }

                <!-- Ideation Selection -->
                @if (inputSourceType() === 'ideation') {
                  <select
                    class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    [value]="selectedInputSourceId()"
                    (change)="onIdeationSelect($event)"
                  >
                    <option value="">Select an ideation session...</option>
                    @for (session of service.ideationSessions(); track session.id) {
                      <option [value]="session.id">
                        {{ truncate(session.problemStatement, 60) }}
                      </option>
                    }
                  </select>
                }

                <!-- Code Repository Selection -->
                @if (inputSourceType() === 'code_repository') {
                  <div class="relative">
                    <button
                      type="button"
                      class="w-full flex items-center justify-between rounded-lg border bg-background p-3 text-sm"
                      (click)="toggleKbDropdown()"
                    >
                      <span class="flex items-center gap-2">
                        <ng-icon name="lucideDatabase" class="h-4 w-4 text-muted-foreground" />
                        @if (!selectedKnowledgeBaseId()) {
                          <span class="text-muted-foreground">Select a code repository...</span>
                        } @else {
                          <span>{{ getSelectedKbName() }}</span>
                        }
                      </span>
                      <ng-icon [name]="kbDropdownOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                    </button>

                    @if (kbDropdownOpen()) {
                      <div class="absolute z-10 mt-1 w-full rounded-lg border bg-background shadow-lg">
                        <div class="max-h-48 overflow-y-auto p-1">
                          @for (kb of service.codeKnowledgeBases(); track kb.id) {
                            <button
                              type="button"
                              class="w-full flex items-start gap-2 rounded p-2 text-sm hover:bg-muted/50 text-left"
                              [class.bg-primary/10]="selectedKnowledgeBaseId() === kb.id"
                              (click)="selectKnowledgeBase(kb.id)"
                            >
                              <ng-icon name="lucideDatabase" class="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <div class="flex-1 min-w-0">
                                <p class="font-medium truncate">{{ kb.name }}</p>
                                @if (kb.repoUrl) {
                                  <p class="text-xs text-muted-foreground truncate">{{ kb.repoUrl }}</p>
                                }
                              </div>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                  <p class="mt-2 text-xs text-muted-foreground">
                    Compare your implementation against industry best practices
                  </p>
                }

                @if (inputSourceType() !== 'none' && inputSourceType() !== 'code_repository' && inputSourceDescription()) {
                  <div class="mt-3 rounded-lg border bg-muted/30 p-3">
                    <p class="text-xs text-muted-foreground mb-1">Context Preview:</p>
                    <p class="text-sm line-clamp-3">{{ inputSourceDescription() }}</p>
                  </div>
                }
              } @else {
                <div class="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
                  <ng-icon name="lucideClipboardList" class="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p class="mt-2 text-sm text-muted-foreground">
                    No existing work available to import.
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    Create Epics/Features, Ideation sessions, or import a code repository first.
                  </p>
                </div>
              }
            </div>

            <!-- Analyze Button -->
            <div class="mt-6">
              <button
                hlmBtn
                class="w-full"
                type="submit"
                [disabled]="!canSubmit() || service.loading()"
              >
                @if (service.loading()) {
                  <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  Running Analysis...
                } @else {
                  <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                  Run Competitive Analysis
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <!-- History Header -->
        <div class="border-b bg-background p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Analysis History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past competitive analyses
          </p>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto">
          @if (service.loading() && service.sessions().length === 0) {
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <div class="rounded-lg border bg-background p-4">
                    <div class="h-4 bg-muted rounded w-3/4"></div>
                    <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (service.sessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-full">
              <div class="text-center">
                <ng-icon name="lucideSearch" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your competitive analyses will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of service.sessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status === 'analyzing'"
                          [class.text-yellow-700]="session.status === 'analyzing'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-gray-100]="session.status === 'pending'"
                          [class.text-gray-700]="session.status === 'pending'"
                        >
                          {{ formatStatus(session.status) }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDate(session.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-foreground">
                        {{ getFocusAreaLabel(session) }}
                      </p>
                      @if (session.referenceCompetitors.length > 0) {
                        <p class="mt-0.5 text-xs text-muted-foreground truncate">
                          vs. {{ session.referenceCompetitors.join(', ') }}
                        </p>
                      }
                    </div>
                    <div class="flex items-center gap-1 ml-2">
                      @if (session.status === 'failed') {
                        <button
                          type="button"
                          class="p-1 text-muted-foreground hover:text-primary transition-colors"
                          (click)="retrySession($event, session)"
                          title="Retry Analysis"
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

              @if (service.hasMore()) {
                <div class="pt-2 pb-4 text-center">
                  <button
                    hlmBtn
                    variant="ghost"
                    size="sm"
                    (click)="loadMoreSessions()"
                    [disabled]="service.loading()"
                  >
                    @if (service.loading()) {
                      <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                    }
                    Load More
                  </button>
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
      height: 100%;
    }
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class CompetitiveAnalysisInputComponent implements OnInit {
  service = inject(CompetitiveAnalysisService);
  private router = inject(Router);

  // Focus area source selection (Step 1)
  focusAreaSourceType = signal<FocusAreaSourceType>('manual');
  selectedFocusAreaSourceId = signal<number | null>(null);
  focusAreaContext = signal('');

  // Focus area selection (for manual mode)
  focusArea = signal('');
  customFocusArea = signal('');
  focusAreaDropdownOpen = signal(false);
  focusAreaFilter = signal('');

  // Competitors
  referenceCompetitors = signal<string[]>([]);
  newCompetitor = signal('');

  // Options
  includeBestInClass = signal(true);
  includeIndustrySolutions = signal(false);
  targetIndustry = signal('');

  // Input source
  inputSourceType = signal<InputSourceType>('none');
  selectedInputSourceId = signal<number | null>(null);
  inputSourceDescription = signal('');

  // Knowledge base (code comparison)
  selectedKnowledgeBaseId = signal<number | null>(null);
  kbDropdownOpen = signal(false);

  // Computed
  filteredFocusAreas = computed(() => {
    const filter = this.focusAreaFilter().toLowerCase();
    return this.service.focusAreas().filter(
      (a) => a.label.toLowerCase().includes(filter) || a.value.toLowerCase().includes(filter)
    );
  });

  selectedFocusAreaLabel = computed(() => {
    if (!this.focusArea()) return '';
    const area = this.service.focusAreas().find((a) => a.value === this.focusArea());
    return area?.label || '';
  });

  hasInputSources = computed(() =>
    this.service.epicsAndFeatures().length > 0 ||
    this.service.ideationSessions().length > 0 ||
    this.service.codeKnowledgeBases().length > 0
  );

  hasFocusAreaSources = computed(() =>
    this.service.ideationSessions().length > 0 ||
    this.service.okrSessions().length > 0 ||
    this.service.scopeDefinitions().length > 0
  );

  canSubmit = computed(() => {
    const sourceType = this.focusAreaSourceType();
    if (sourceType === 'manual') {
      if (!this.focusArea()) return false;
      if (this.focusArea() === 'other') {
        return this.customFocusArea().trim().length > 0;
      }
      return true;
    } else {
      // Source-based focus area requires a selection and context
      return this.selectedFocusAreaSourceId() !== null && this.focusAreaContext().trim().length > 0;
    }
  });

  async ngOnInit() {
    await Promise.all([
      this.service.loadFocusAreas(),
      this.service.loadIndustries(),
      this.service.loadCodeKnowledgeBases(),
      this.service.loadEpicsAndFeatures(),
      this.service.loadScopeDefinitions(),
      this.service.loadIdeationSessions(),
      this.service.loadOkrSessions(),
      this.service.loadSessions(true),
    ]);
  }

  // Focus area methods
  toggleFocusAreaDropdown() {
    this.focusAreaDropdownOpen.update((v) => !v);
    if (this.focusAreaDropdownOpen()) {
      this.focusAreaFilter.set('');
    }
  }

  onFocusAreaFilterInput(event: Event) {
    this.focusAreaFilter.set((event.target as HTMLInputElement).value);
  }

  selectFocusArea(value: string) {
    this.focusArea.set(value);
    this.focusAreaDropdownOpen.set(false);
    this.focusAreaFilter.set('');
  }

  onCustomFocusAreaInput(event: Event) {
    this.customFocusArea.set((event.target as HTMLInputElement).value);
  }

  // Focus area source methods
  setFocusAreaSourceType(type: FocusAreaSourceType) {
    this.focusAreaSourceType.set(type);
    this.selectedFocusAreaSourceId.set(null);
    this.focusAreaContext.set('');
    // Clear manual focus area when switching to source-based
    if (type !== 'manual') {
      this.focusArea.set('source_based');
      this.customFocusArea.set('');
    } else {
      this.focusArea.set('');
    }
  }

  onFocusAreaIdeationSelect(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedFocusAreaSourceId.set(null);
      this.focusAreaContext.set('');
      return;
    }

    const session = this.service.ideationSessions().find((s) => s.id === id);
    if (session) {
      this.selectedFocusAreaSourceId.set(id);
      this.focusAreaContext.set(`Problem Statement: ${session.problemStatement}`);
    }
  }

  onFocusAreaOkrSelect(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedFocusAreaSourceId.set(null);
      this.focusAreaContext.set('');
      return;
    }

    const session = this.service.okrSessions().find((s) => s.id === id);
    if (session) {
      this.selectedFocusAreaSourceId.set(id);
      this.focusAreaContext.set(`Goal: ${session.goalDescription}`);
    }
  }

  onFocusAreaScopeSelect(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedFocusAreaSourceId.set(null);
      this.focusAreaContext.set('');
      return;
    }

    const session = this.service.scopeDefinitions().find((s) => s.id === id);
    if (session) {
      this.selectedFocusAreaSourceId.set(id);
      this.focusAreaContext.set(`Project: ${session.projectName}\n\nVision: ${session.productVision}`);
    }
  }

  // Competitor methods
  onNewCompetitorInput(event: Event) {
    this.newCompetitor.set((event.target as HTMLInputElement).value);
  }

  addCompetitor(event?: Event) {
    event?.preventDefault();
    const name = this.newCompetitor().trim();
    if (name && !this.referenceCompetitors().includes(name)) {
      this.referenceCompetitors.update((list) => [...list, name]);
      this.newCompetitor.set('');
    }
  }

  removeCompetitor(name: string) {
    this.referenceCompetitors.update((list) => list.filter((c) => c !== name));
  }

  // Option toggles
  toggleBestInClass() {
    this.includeBestInClass.update((v) => !v);
  }

  toggleIndustrySolutions() {
    this.includeIndustrySolutions.update((v) => !v);
    if (!this.includeIndustrySolutions()) {
      this.targetIndustry.set('');
    }
  }

  onIndustrySelect(event: Event) {
    this.targetIndustry.set((event.target as HTMLSelectElement).value);
  }

  // Input source methods
  setInputSourceType(type: InputSourceType) {
    this.inputSourceType.set(type);
    this.selectedInputSourceId.set(null);
    this.inputSourceDescription.set('');
    // Clear knowledge base if switching away from code_repository
    if (type !== 'code_repository') {
      this.selectedKnowledgeBaseId.set(null);
    }
    this.kbDropdownOpen.set(false);
  }

  onEpicFeatureSelect(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedInputSourceId.set(null);
      this.inputSourceDescription.set('');
      return;
    }

    const item = this.service.epicsAndFeatures().find((e) => e.id === id);
    if (item) {
      this.selectedInputSourceId.set(id);
      this.inputSourceDescription.set(`${item.title}\n\n${item.description}`);
    }
  }

  onIdeationSelect(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (!id) {
      this.selectedInputSourceId.set(null);
      this.inputSourceDescription.set('');
      return;
    }

    const session = this.service.ideationSessions().find((s) => s.id === id);
    if (session) {
      this.selectedInputSourceId.set(id);
      this.inputSourceDescription.set(`Problem: ${session.problemStatement}`);
    }
  }

  truncate(str: string, len: number): string {
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  // Knowledge base methods
  toggleKbDropdown() {
    this.kbDropdownOpen.update((v) => !v);
  }

  selectKnowledgeBase(id: number | null) {
    this.selectedKnowledgeBaseId.set(id);
    this.kbDropdownOpen.set(false);
  }

  getSelectedKbName(): string {
    const kb = this.service.codeKnowledgeBases().find((k) => k.id === this.selectedKnowledgeBaseId());
    return kb?.name || '';
  }

  // Close dropdowns on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.focusAreaDropdownOpen.set(false);
      this.kbDropdownOpen.set(false);
    }
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const sourceType = this.focusAreaSourceType();
    const session = await this.service.createSession({
      focusArea: sourceType === 'manual' ? this.focusArea() : 'source_based',
      customFocusArea:
        this.focusArea() === 'other' ? this.customFocusArea() : undefined,
      focusAreaSourceType: sourceType !== 'manual' ? sourceType : undefined,
      focusAreaSourceId: this.selectedFocusAreaSourceId() || undefined,
      focusAreaContext: this.focusAreaContext() || undefined,
      referenceCompetitors: this.referenceCompetitors(),
      includeBestInClass: this.includeBestInClass(),
      includeAdjacentIndustries: this.includeIndustrySolutions(),
      targetIndustry: this.includeIndustrySolutions() ? this.targetIndustry() || undefined : undefined,
      inputSourceType: this.inputSourceType() !== 'none' ? this.inputSourceType() : undefined,
      inputSourceId: this.selectedInputSourceId() || undefined,
      inputSourceDescription: this.inputSourceDescription() || undefined,
      knowledgeBaseId: this.selectedKnowledgeBaseId() || undefined,
    });

    if (session) {
      this.router.navigate(['/research/competitive-analysis/results', session.id]);
    }
  }

  viewSession(session: CompetitiveAnalysisSession) {
    this.router.navigate(['/research/competitive-analysis/results', session.id]);
  }

  async deleteSession(event: Event, session: CompetitiveAnalysisSession) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this analysis?')) {
      await this.service.deleteSession(session.id);
    }
  }

  async retrySession(event: Event, session: CompetitiveAnalysisSession) {
    event.stopPropagation();
    await this.service.retrySession(session.id);
    this.router.navigate(['/research/competitive-analysis/results', session.id]);
  }

  loadMoreSessions() {
    this.service.loadSessions();
  }

  getFocusAreaLabel(session: CompetitiveAnalysisSession): string {
    // Handle source-based focus areas
    if (session.focusArea === 'source_based' && session.focusAreaContext) {
      // Extract first line of context as label
      const firstLine = session.focusAreaContext.split('\n')[0];
      return this.truncate(firstLine, 60);
    }
    if (session.focusArea === 'other' && session.customFocusArea) {
      return session.customFocusArea;
    }
    return this.service.getFocusAreaLabel(session.focusArea);
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      analyzing: 'Analyzing',
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
