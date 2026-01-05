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
            (click)="exportAllToPdf()"
            class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ng-icon name="lucideFileText" class="h-4 w-4" />
            Export All PDF
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

                      @if (decision.alternativesConsidered.length) {
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

  exportAllToPdf(): void {
    const session = this.session();
    const releaseNotes = this.activeReleaseNotes();
    const decisions = this.activeDecisions();
    const debtItems = this.activeDebtItems();
    const storiesList = this.stories();

    if (!session) return;

    // Helper functions for badge colors
    const getCategoryBadgeStyle = (category: ReleaseNoteCategory): string => {
      const styles: Record<ReleaseNoteCategory, string> = {
        feature: 'background: #dbeafe; color: #1e40af;',
        improvement: 'background: #dcfce7; color: #166534;',
        fix: 'background: #fef3c7; color: #92400e;',
        security: 'background: #fee2e2; color: #991b1b;',
        performance: 'background: #f3e8ff; color: #6b21a8;',
        breaking_change: 'background: #fee2e2; color: #991b1b;',
      };
      return styles[category] || 'background: #f1f5f9; color: #475569;';
    };

    const getDecisionTypeBadgeStyle = (type: string): string => {
      const styles: Record<string, string> = {
        technical: 'background: #dbeafe; color: #1e40af;',
        architectural: 'background: #f3e8ff; color: #6b21a8;',
        product: 'background: #dcfce7; color: #166534;',
        process: 'background: #fef3c7; color: #92400e;',
        security: 'background: #fee2e2; color: #991b1b;',
      };
      return styles[type] || 'background: #f1f5f9; color: #475569;';
    };

    const getImpactBadgeStyle = (level: ImpactLevel): string => {
      const styles: Record<ImpactLevel, string> = {
        critical: 'background: #fee2e2; color: #991b1b;',
        high: 'background: #fef3c7; color: #92400e;',
        medium: 'background: #fef9c3; color: #854d0e;',
        low: 'background: #dcfce7; color: #166534;',
      };
      return styles[level] || 'background: #f1f5f9; color: #475569;';
    };

    const getDebtTypeBadgeStyle = (type: string): string => {
      return 'background: #f1f5f9; color: #475569;';
    };

    const getStoryTypeBadgeStyle = (type: string): string => {
      const styles: Record<string, string> = {
        epic: 'background: #f3e8ff; color: #6b21a8;',
        feature: 'background: #dbeafe; color: #1e40af;',
        user_story: 'background: #dcfce7; color: #166534;',
        manual: 'background: #f1f5f9; color: #475569;',
      };
      return styles[type] || 'background: #f1f5f9; color: #475569;';
    };

    const getBorderColor = (category: ReleaseNoteCategory): string => {
      const colors: Record<ReleaseNoteCategory, string> = {
        feature: '#3b82f6',
        improvement: '#22c55e',
        fix: '#f59e0b',
        security: '#ef4444',
        performance: '#a855f7',
        breaking_change: '#ef4444',
      };
      return colors[category] || '#e2e8f0';
    };

    const getDebtBorderColor = (level: ImpactLevel): string => {
      const colors: Record<ImpactLevel, string> = {
        critical: '#ef4444',
        high: '#f59e0b',
        medium: '#eab308',
        low: '#22c55e',
      };
      return colors[level] || '#e2e8f0';
    };

    const formatCategory = (category: string): string => {
      return category.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Release Prep - ${session.releaseName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 48px;
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid #6366f1;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #64748b;
    }

    .quality-scores {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }

    .quality-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }

    .quality-card .label {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .quality-card .value {
      font-size: 24px;
      font-weight: 700;
    }

    .quality-card .value.blue { color: #3b82f6; }
    .quality-card .value.purple { color: #a855f7; }
    .quality-card .value.amber { color: #f59e0b; }

    .quality-card .progress-bar {
      margin-top: 8px;
      height: 6px;
      background: #f1f5f9;
      border-radius: 3px;
      overflow: hidden;
    }

    .quality-card .progress-bar .fill {
      height: 100%;
      border-radius: 3px;
    }

    .quality-card .progress-bar .fill.blue { background: #3b82f6; }
    .quality-card .progress-bar .fill.purple { background: #a855f7; }
    .quality-card .progress-bar .fill.amber { background: #f59e0b; }

    .quality-card .progress-text {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
    }

    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .section-header {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-header .count {
      font-size: 14px;
      color: #64748b;
      font-weight: 400;
    }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .card.bordered-left {
      border-left: 4px solid;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
    }

    .star {
      color: #f59e0b;
      font-size: 14px;
    }

    .card-description {
      font-size: 14px;
      color: #475569;
      margin-bottom: 8px;
    }

    .card-meta {
      font-size: 13px;
      color: #64748b;
    }

    .card-meta strong {
      color: #475569;
    }

    .rationale-box {
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 12px;
    }

    .rationale-box .label {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }

    .rationale-box p {
      font-size: 13px;
      color: #64748b;
    }

    .alternatives {
      margin-top: 12px;
    }

    .alternatives .label {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }

    .alternatives ul {
      margin-left: 20px;
      font-size: 13px;
      color: #64748b;
    }

    .alternatives li {
      margin-bottom: 2px;
    }

    .risk-box {
      background: #fef2f2;
      padding: 10px 14px;
      border-radius: 8px;
      margin-top: 12px;
      font-size: 13px;
      color: #991b1b;
    }

    .story-content {
      font-size: 13px;
      color: #64748b;
      white-space: pre-wrap;
      margin-top: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: #94a3b8;
      font-size: 14px;
      font-style: italic;
    }

    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }

    @media print {
      body { padding: 24px; }
      .section { break-inside: avoid; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.releaseName}</h1>
    <div class="subtitle">Release Prep Report</div>
  </div>

  <!-- Quality Scores -->
  <div class="quality-scores">
    <div class="quality-card">
      <div class="label">Release Notes</div>
      <div class="value blue">${releaseNotes.length}</div>
      ${session.releaseNotesCompleteness ? `
        <div class="progress-bar"><div class="fill blue" style="width: ${session.releaseNotesCompleteness}%;"></div></div>
        <div class="progress-text"><span>Quality</span><span>${session.releaseNotesCompleteness}%</span></div>
      ` : ''}
    </div>
    <div class="quality-card">
      <div class="label">Decisions</div>
      <div class="value purple">${decisions.length}</div>
      ${session.decisionLogCompleteness ? `
        <div class="progress-bar"><div class="fill purple" style="width: ${session.decisionLogCompleteness}%;"></div></div>
        <div class="progress-text"><span>Quality</span><span>${session.decisionLogCompleteness}%</span></div>
      ` : ''}
    </div>
    <div class="quality-card">
      <div class="label">Debt Items</div>
      <div class="value amber">${debtItems.length}</div>
      ${session.debtInventoryCompleteness ? `
        <div class="progress-bar"><div class="fill amber" style="width: ${session.debtInventoryCompleteness}%;"></div></div>
        <div class="progress-text"><span>Quality</span><span>${session.debtInventoryCompleteness}%</span></div>
      ` : ''}
    </div>
  </div>

  <!-- Release Notes Section -->
  <div class="section">
    <h2 class="section-header">Release Notes <span class="count">(${releaseNotes.length})</span></h2>
    ${releaseNotes.length === 0 ? '<div class="empty-state">No release notes generated.</div>' : releaseNotes.map(note => `
      <div class="card bordered-left" style="border-left-color: ${getBorderColor(note.category)};">
        <div class="card-header">
          ${note.isHighlighted ? '<span class="star">&#9733;</span>' : ''}
          <span class="card-title">${note.title}</span>
          <span class="badge" style="${getCategoryBadgeStyle(note.category)}">${formatCategory(note.category)}</span>
        </div>
        <p class="card-description">${note.description}</p>
        ${note.userImpact ? `<p class="card-meta"><strong>Impact:</strong> ${note.userImpact}</p>` : ''}
      </div>
    `).join('')}
  </div>

  <!-- Decision Log Section -->
  <div class="section">
    <h2 class="section-header">Decision Log <span class="count">(${decisions.length})</span></h2>
    ${decisions.length === 0 ? '<div class="empty-state">No decisions extracted.</div>' : decisions.map(decision => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${decision.title}</span>
          <span class="badge" style="${getDecisionTypeBadgeStyle(decision.decisionType)}">${decision.decisionType.charAt(0).toUpperCase() + decision.decisionType.slice(1)}</span>
          <span class="badge" style="${getImpactBadgeStyle(decision.impactLevel)}">${decision.impactLevel.charAt(0).toUpperCase() + decision.impactLevel.slice(1)}</span>
        </div>
        <p class="card-description">${decision.description}</p>
        ${decision.rationale ? `
          <div class="rationale-box">
            <div class="label">Rationale</div>
            <p>${decision.rationale}</p>
          </div>
        ` : ''}
        ${decision.alternativesConsidered && decision.alternativesConsidered.length > 0 ? `
          <div class="alternatives">
            <div class="label">Alternatives Considered</div>
            <ul>
              ${decision.alternativesConsidered.map(alt => `<li>${alt}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  <!-- Technical Debt Section -->
  <div class="section">
    <h2 class="section-header">Technical Debt <span class="count">(${debtItems.length})</span></h2>
    ${debtItems.length === 0 ? '<div class="empty-state">No technical debt items identified.</div>' : debtItems.map(item => `
      <div class="card bordered-left" style="border-left-color: ${getDebtBorderColor(item.impactLevel)};">
        <div class="card-header">
          <span class="card-title">${item.title}</span>
          <span class="badge" style="${getDebtTypeBadgeStyle(item.debtType)}">${item.debtType.charAt(0).toUpperCase() + item.debtType.slice(1)}</span>
          <span class="badge" style="${getImpactBadgeStyle(item.impactLevel)}">${item.impactLevel.charAt(0).toUpperCase() + item.impactLevel.slice(1)}</span>
        </div>
        <p class="card-description">${item.description}</p>
        ${item.affectedArea ? `<p class="card-meta"><strong>Area:</strong> ${item.affectedArea}</p>` : ''}
        ${item.effortEstimate ? `<p class="card-meta"><strong>Effort:</strong> ${item.effortEstimate}</p>` : ''}
        ${item.riskIfUnaddressed ? `
          <div class="risk-box">
            <strong>Risk:</strong> ${item.riskIfUnaddressed}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  <!-- Stories Section -->
  <div class="section">
    <h2 class="section-header">Stories <span class="count">(${storiesList.length})</span></h2>
    ${storiesList.length === 0 ? '<div class="empty-state">No stories included in this release.</div>' : storiesList.map(story => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${story.title}</span>
          <span class="badge" style="${getStoryTypeBadgeStyle(story.storyType)}">${story.storyType === 'user_story' ? 'Story' : (story.storyType.charAt(0).toUpperCase() + story.storyType.slice(1))}</span>
        </div>
        <div class="story-content">${story.content}</div>
      </div>
    `).join('')}
  </div>

  <div class="footer">
    Generated by Product Studio &bull; ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}
