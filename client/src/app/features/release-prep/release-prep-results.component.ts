/**
 * Release Prep Results Component
 *
 * Displays the generated release artifacts: Release Notes, Decision Log,
 * and Technical Debt Inventory with inline editing capabilities.
 */
import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileText,
  lucideBookOpen,
  lucideAlertTriangle,
  lucideDownload,
  lucideCopy,
  lucideEdit,
  lucideSave,
  lucideX,
  lucideEye,
  lucideEyeOff,
  lucidePlus,
  lucideChevronDown,
  lucideChevronRight,
  lucideStar,
  lucideCheck,
  lucideUndo2,
  lucideListChecks,
} from '@ng-icons/lucide';

import { ReleasePrepService } from './release-prep.service';
import type {
  ReleaseNote,
  Decision,
  TechnicalDebtItem,
  ReleaseNoteCategory,
  ImpactLevel,
} from './release-prep.types';

type ActiveTab = 'release-notes' | 'decisions' | 'debt' | 'stories';

@Component({
  selector: 'app-release-prep-results',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideFileText,
      lucideBookOpen,
      lucideAlertTriangle,
      lucideDownload,
      lucideCopy,
      lucideEdit,
      lucideSave,
      lucideX,
      lucideEye,
      lucideEyeOff,
      lucidePlus,
      lucideChevronDown,
      lucideChevronRight,
      lucideStar,
      lucideCheck,
      lucideUndo2,
      lucideListChecks,
    }),
  ],
  template: `
    <div class="max-w-6xl mx-auto p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            {{ session()?.releaseName || 'Release Prep Results' }}
          </h1>
        </div>

        <div class="flex items-center gap-3">
          <button
            (click)="unreleaseStories()"
            class="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
            title="Allow stories from this release to be included in future releases"
          >
            <ng-icon name="lucideUndo2" class="h-4 w-4" />
            Unrelease Stories
          </button>
          <button
            (click)="exportCurrentTab()"
            class="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ng-icon name="lucideDownload" class="h-4 w-4" />
            Export
          </button>
          <button
            (click)="copyToClipboard()"
            class="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ng-icon name="lucideCopy" class="h-4 w-4" />
            Copy
          </button>
        </div>
      </div>

      <!-- Quality Scores -->
      @if (session()) {
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-white rounded-lg border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">Release Notes</span>
              <span class="text-lg font-bold text-blue-600">
                {{ releaseNotes().length }}
              </span>
            </div>
            @if (session()?.releaseNotesCompleteness) {
              <div class="mt-2">
                <div class="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Quality</span>
                  <span>{{ session()?.releaseNotesCompleteness }}%</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full">
                  <div
                    class="h-full bg-blue-500 rounded-full"
                    [style.width.%]="session()?.releaseNotesCompleteness"
                  ></div>
                </div>
              </div>
            }
          </div>

          <div class="bg-white rounded-lg border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">Decisions</span>
              <span class="text-lg font-bold text-purple-600">
                {{ decisions().length }}
              </span>
            </div>
            @if (session()?.decisionLogCompleteness) {
              <div class="mt-2">
                <div class="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Quality</span>
                  <span>{{ session()?.decisionLogCompleteness }}%</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full">
                  <div
                    class="h-full bg-purple-500 rounded-full"
                    [style.width.%]="session()?.decisionLogCompleteness"
                  ></div>
                </div>
              </div>
            }
          </div>

          <div class="bg-white rounded-lg border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">Debt Items</span>
              <span class="text-lg font-bold text-amber-600">
                {{ debtItems().length }}
              </span>
            </div>
            @if (session()?.debtInventoryCompleteness) {
              <div class="mt-2">
                <div class="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Quality</span>
                  <span>{{ session()?.debtInventoryCompleteness }}%</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full">
                  <div
                    class="h-full bg-amber-500 rounded-full"
                    [style.width.%]="session()?.debtInventoryCompleteness"
                  ></div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="border-b border-slate-200 mb-6">
        <nav class="flex gap-6">
          <button
            (click)="activeTab.set('release-notes')"
            class="pb-3 text-sm font-medium border-b-2 transition-colors"
            [class.border-primary]="activeTab() === 'release-notes'"
            [class.text-primary]="activeTab() === 'release-notes'"
            [class.border-transparent]="activeTab() !== 'release-notes'"
            [class.text-slate-600]="activeTab() !== 'release-notes'"
          >
            <ng-icon name="lucideFileText" class="h-4 w-4 inline mr-1" />
            Release Notes ({{ activeReleaseNotes().length }})
          </button>
          <button
            (click)="activeTab.set('decisions')"
            class="pb-3 text-sm font-medium border-b-2 transition-colors"
            [class.border-primary]="activeTab() === 'decisions'"
            [class.text-primary]="activeTab() === 'decisions'"
            [class.border-transparent]="activeTab() !== 'decisions'"
            [class.text-slate-600]="activeTab() !== 'decisions'"
          >
            <ng-icon name="lucideBookOpen" class="h-4 w-4 inline mr-1" />
            Decision Log ({{ activeDecisions().length }})
          </button>
          <button
            (click)="activeTab.set('debt')"
            class="pb-3 text-sm font-medium border-b-2 transition-colors"
            [class.border-primary]="activeTab() === 'debt'"
            [class.text-primary]="activeTab() === 'debt'"
            [class.border-transparent]="activeTab() !== 'debt'"
            [class.text-slate-600]="activeTab() !== 'debt'"
          >
            <ng-icon name="lucideAlertTriangle" class="h-4 w-4 inline mr-1" />
            Technical Debt ({{ activeDebtItems().length }})
          </button>
          <button
            (click)="activeTab.set('stories')"
            class="pb-3 text-sm font-medium border-b-2 transition-colors"
            [class.border-primary]="activeTab() === 'stories'"
            [class.text-primary]="activeTab() === 'stories'"
            [class.border-transparent]="activeTab() !== 'stories'"
            [class.text-slate-600]="activeTab() !== 'stories'"
          >
            <ng-icon name="lucideListChecks" class="h-4 w-4 inline mr-1" />
            Stories ({{ stories().length }})
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      @if (loading()) {
        <div class="text-center py-12 text-slate-500">Loading...</div>
      } @else {
        @switch (activeTab()) {
          @case ('release-notes') {
            <div class="space-y-4">
              @for (note of activeReleaseNotes(); track note.id) {
                <div
                  class="bg-white rounded-lg border border-slate-200 p-4"
                  [class.border-l-4]="true"
                  [class.border-l-blue-500]="note.category === 'feature'"
                  [class.border-l-green-500]="note.category === 'improvement'"
                  [class.border-l-amber-500]="note.category === 'fix'"
                  [class.border-l-red-500]="note.category === 'security' || note.category === 'breaking_change'"
                  [class.border-l-purple-500]="note.category === 'performance'"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        @if (note.isHighlighted) {
                          <ng-icon name="lucideStar" class="h-4 w-4 text-amber-500" />
                        }
                        <h3 class="font-semibold text-slate-900">{{ note.title }}</h3>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full"
                          [class]="getCategoryClasses(note.category)"
                        >
                          {{ formatCategory(note.category) }}
                        </span>
                        @if (note.isUserEdited) {
                          <span class="text-xs text-slate-500 italic">edited</span>
                        }
                      </div>
                      <p class="text-slate-600">{{ note.description }}</p>
                      @if (note.userImpact) {
                        <p class="mt-2 text-sm text-slate-500">
                          <strong>Impact:</strong> {{ note.userImpact }}
                        </p>
                      }
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                      <button
                        (click)="toggleNoteExcluded(note)"
                        [title]="note.isExcluded ? 'Include' : 'Exclude'"
                        class="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <ng-icon
                          [name]="note.isExcluded ? 'lucideEyeOff' : 'lucideEye'"
                          class="h-4 w-4"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (activeReleaseNotes().length === 0) {
                <div class="text-center py-12 text-slate-500">
                  No release notes generated.
                </div>
              }
            </div>
          }

          @case ('decisions') {
            <div class="space-y-4">
              @for (decision of activeDecisions(); track decision.id) {
                <div class="bg-white rounded-lg border border-slate-200 p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-semibold text-slate-900">{{ decision.title }}</h3>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full"
                          [class]="getDecisionTypeClasses(decision.decisionType)"
                        >
                          {{ decision.decisionType | titlecase }}
                        </span>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full"
                          [class]="getImpactClasses(decision.impactLevel)"
                        >
                          {{ decision.impactLevel | titlecase }}
                        </span>
                      </div>
                      <p class="text-slate-600">{{ decision.description }}</p>

                      @if (decision.rationale) {
                        <div class="mt-3 p-3 bg-slate-50 rounded-lg">
                          <p class="text-sm font-medium text-slate-700">Rationale</p>
                          <p class="text-sm text-slate-600 mt-1">{{ decision.rationale }}</p>
                        </div>
                      }

                      @if (decision.alternativesConsidered?.length) {
                        <div class="mt-3">
                          <p class="text-sm font-medium text-slate-700 mb-1">
                            Alternatives Considered
                          </p>
                          <ul class="text-sm text-slate-600 list-disc list-inside">
                            @for (alt of decision.alternativesConsidered; track alt) {
                              <li>{{ alt }}</li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                      <button
                        (click)="toggleDecisionExcluded(decision)"
                        [title]="decision.isExcluded ? 'Include' : 'Exclude'"
                        class="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <ng-icon
                          [name]="decision.isExcluded ? 'lucideEyeOff' : 'lucideEye'"
                          class="h-4 w-4"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (activeDecisions().length === 0) {
                <div class="text-center py-12 text-slate-500">
                  No decisions extracted.
                </div>
              }
            </div>
          }

          @case ('debt') {
            <div class="mb-4 flex justify-end">
              <button
                (click)="showAddDebtForm.set(true)"
                class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <ng-icon name="lucidePlus" class="h-4 w-4" />
                Add Debt Item
              </button>
            </div>

            @if (showAddDebtForm()) {
              <div class="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                <h3 class="font-semibold text-slate-900 mb-3">Add New Debt Item</h3>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Title</label>
                    <input
                      [(ngModel)]="newDebtItem.title"
                      type="text"
                      class="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      [(ngModel)]="newDebtItem.description"
                      rows="3"
                      class="w-full px-3 py-2 border border-slate-300 rounded-md"
                    ></textarea>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <select
                        [(ngModel)]="newDebtItem.debtType"
                        class="w-full px-3 py-2 border border-slate-300 rounded-md"
                      >
                        <option value="code">Code</option>
                        <option value="design">Design</option>
                        <option value="architecture">Architecture</option>
                        <option value="testing">Testing</option>
                        <option value="documentation">Documentation</option>
                        <option value="infrastructure">Infrastructure</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-700 mb-1">Impact</label>
                      <select
                        [(ngModel)]="newDebtItem.impactLevel"
                        class="w-full px-3 py-2 border border-slate-300 rounded-md"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button
                      (click)="showAddDebtForm.set(false)"
                      class="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      (click)="addDebtItem()"
                      [disabled]="!newDebtItem.title || !newDebtItem.description"
                      class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      Add Item
                    </button>
                  </div>
                </div>
              </div>
            }

            <div class="space-y-4">
              @for (item of activeDebtItems(); track item.id) {
                <div
                  class="bg-white rounded-lg border border-slate-200 p-4"
                  [class.border-l-4]="true"
                  [class.border-l-red-500]="item.impactLevel === 'critical'"
                  [class.border-l-amber-500]="item.impactLevel === 'high'"
                  [class.border-l-yellow-500]="item.impactLevel === 'medium'"
                  [class.border-l-green-500]="item.impactLevel === 'low'"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-semibold text-slate-900">{{ item.title }}</h3>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700"
                        >
                          {{ item.debtType | titlecase }}
                        </span>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full"
                          [class]="getImpactClasses(item.impactLevel)"
                        >
                          {{ item.impactLevel | titlecase }}
                        </span>
                        @if (item.isUserAdded) {
                          <span class="text-xs text-slate-500 italic">manually added</span>
                        }
                      </div>
                      <p class="text-slate-600">{{ item.description }}</p>

                      @if (item.affectedArea) {
                        <p class="mt-2 text-sm text-slate-500">
                          <strong>Area:</strong> {{ item.affectedArea }}
                        </p>
                      }

                      @if (item.effortEstimate) {
                        <p class="mt-1 text-sm text-slate-500">
                          <strong>Effort:</strong> {{ item.effortEstimate }}
                        </p>
                      }

                      @if (item.riskIfUnaddressed) {
                        <div class="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          <strong>Risk:</strong> {{ item.riskIfUnaddressed }}
                        </div>
                      }
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                      <button
                        (click)="toggleDebtExcluded(item)"
                        [title]="item.isExcluded ? 'Include' : 'Exclude'"
                        class="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <ng-icon
                          [name]="item.isExcluded ? 'lucideEyeOff' : 'lucideEye'"
                          class="h-4 w-4"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (activeDebtItems().length === 0) {
                <div class="text-center py-12 text-slate-500">
                  No technical debt items identified.
                </div>
              }
            </div>
          }

          @case ('stories') {
            <div class="space-y-4">
              <p class="text-sm text-slate-600 mb-4">
                Stories included in this release. These will be filtered out of future release prep sessions.
              </p>
              @for (story of stories(); track story.id) {
                <div class="bg-white rounded-lg border border-slate-200 p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-semibold text-slate-900">{{ story.title }}</h3>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full"
                          [class.bg-purple-100]="story.storyType === 'epic'"
                          [class.text-purple-700]="story.storyType === 'epic'"
                          [class.bg-blue-100]="story.storyType === 'feature'"
                          [class.text-blue-700]="story.storyType === 'feature'"
                          [class.bg-green-100]="story.storyType === 'user_story'"
                          [class.text-green-700]="story.storyType === 'user_story'"
                          [class.bg-slate-100]="story.storyType === 'manual'"
                          [class.text-slate-700]="story.storyType === 'manual'"
                        >
                          {{ story.storyType === 'user_story' ? 'Story' : (story.storyType | titlecase) }}
                        </span>
                      </div>
                      <p class="text-slate-600 text-sm whitespace-pre-wrap">{{ story.content }}</p>
                    </div>
                  </div>
                </div>
              }

              @if (stories().length === 0) {
                <div class="text-center py-12 text-slate-500">
                  No stories included in this release.
                </div>
              }
            </div>
          }
        }
      }

      <!-- Toast notification -->
      @if (showToast()) {
        <div
          class="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <ng-icon name="lucideCheck" class="h-4 w-4" />
          {{ toastMessage() }}
        </div>
      }
    </div>
  `,
})
export class ReleasePrepResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ReleasePrepService);

  readonly loading = signal(true);
  readonly activeTab = signal<ActiveTab>('release-notes');
  readonly showAddDebtForm = signal(false);
  readonly showToast = signal(false);
  readonly toastMessage = signal('');

  readonly session = computed(() => this.service.currentSession()?.session);
  readonly releaseNotes = this.service.releaseNotes;
  readonly decisions = this.service.decisions;
  readonly debtItems = this.service.debtItems;
  readonly activeReleaseNotes = this.service.activeReleaseNotes;
  readonly activeDecisions = this.service.activeDecisions;
  readonly activeDebtItems = this.service.activeDebtItems;
  readonly stories = computed(() => this.service.currentSession()?.stories ?? []);

  newDebtItem = {
    title: '',
    description: '',
    debtType: 'code',
    impactLevel: 'medium' as ImpactLevel,
  };

  ngOnInit(): void {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (sessionId) {
      this.service.loadSession(sessionId).subscribe({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
    }
  }

  // Category styling
  getCategoryClasses(category: ReleaseNoteCategory): string {
    const classes: Record<ReleaseNoteCategory, string> = {
      feature: 'bg-blue-100 text-blue-700',
      improvement: 'bg-green-100 text-green-700',
      fix: 'bg-amber-100 text-amber-700',
      security: 'bg-red-100 text-red-700',
      performance: 'bg-purple-100 text-purple-700',
      breaking_change: 'bg-red-100 text-red-700',
    };
    return classes[category] || 'bg-slate-100 text-slate-700';
  }

  formatCategory(category: ReleaseNoteCategory): string {
    return category.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  getDecisionTypeClasses(type: string): string {
    const classes: Record<string, string> = {
      technical: 'bg-blue-100 text-blue-700',
      architectural: 'bg-purple-100 text-purple-700',
      product: 'bg-green-100 text-green-700',
      process: 'bg-amber-100 text-amber-700',
      security: 'bg-red-100 text-red-700',
    };
    return classes[type] || 'bg-slate-100 text-slate-700';
  }

  getImpactClasses(level: ImpactLevel): string {
    const classes: Record<ImpactLevel, string> = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-amber-100 text-amber-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700',
    };
    return classes[level] || 'bg-slate-100 text-slate-700';
  }

  // Toggle excluded status
  toggleNoteExcluded(note: ReleaseNote): void {
    this.service
      .updateReleaseNote(note.id, { isExcluded: !note.isExcluded })
      .subscribe();
  }

  toggleDecisionExcluded(decision: Decision): void {
    this.service
      .updateDecision(decision.id, { isExcluded: !decision.isExcluded })
      .subscribe();
  }

  toggleDebtExcluded(item: TechnicalDebtItem): void {
    this.service
      .updateDebtItem(item.id, { isExcluded: !item.isExcluded })
      .subscribe();
  }

  // Add new debt item
  addDebtItem(): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    this.service
      .createDebtItem(sessionId, {
        title: this.newDebtItem.title,
        description: this.newDebtItem.description,
        debtType: this.newDebtItem.debtType as any,
        impactLevel: this.newDebtItem.impactLevel,
      })
      .subscribe({
        next: () => {
          this.newDebtItem = {
            title: '',
            description: '',
            debtType: 'code',
            impactLevel: 'medium',
          };
          this.showAddDebtForm.set(false);
        },
      });
  }

  // Export
  exportCurrentTab(): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    switch (this.activeTab()) {
      case 'release-notes':
        this.service.exportReleaseNotes(sessionId).subscribe((res) => {
          this.service.downloadMarkdown(
            res.content,
            `release-notes-${this.session()?.releaseName || sessionId}.md`
          );
        });
        break;
      case 'decisions':
        this.service.exportDecisionLog(sessionId).subscribe((res) => {
          this.service.downloadMarkdown(
            res.content,
            `decision-log-${this.session()?.releaseName || sessionId}.md`
          );
        });
        break;
      case 'debt':
        this.service.exportDebtInventory(sessionId).subscribe((res) => {
          this.service.downloadMarkdown(
            res.content,
            `debt-inventory-${this.session()?.releaseName || sessionId}.md`
          );
        });
        break;
      case 'stories':
        // Stories tab doesn't support export
        break;
    }
  }

  copyToClipboard(): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    let exportFn;
    switch (this.activeTab()) {
      case 'release-notes':
        exportFn = this.service.exportReleaseNotes(sessionId);
        break;
      case 'decisions':
        exportFn = this.service.exportDecisionLog(sessionId);
        break;
      case 'debt':
        exportFn = this.service.exportDebtInventory(sessionId);
        break;
      case 'stories':
        // Stories tab doesn't support export/copy
        return;
    }

    exportFn.subscribe((res) => {
      this.service.copyToClipboard(res.content);
      this.showToastMessage('Copied to clipboard');
    });
  }

  unreleaseStories(): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    if (confirm('This will allow stories from this release to be selected for future releases. Continue?')) {
      this.service.unreleaseSessionArtifacts(sessionId).subscribe({
        next: (res) => {
          this.showToastMessage(`${res.count} stories unreleased`);
        },
      });
    }
  }

  private showToastMessage(message: string): void {
    this.toastMessage.set(message);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 2000);
  }
}
