import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBot,
  lucideLoader2,
  lucideArrowLeft,
  lucideSparkles,
  lucideSave,
  lucidePlay,
  lucideCheck,
  lucideX,
  lucideTrendingUp,
  lucideTrendingDown,
  lucideEdit,
  lucideFileText,
  lucideLayoutList,
  lucideBeaker,
  lucideZap,
  lucideMessageSquare,
  lucideThumbsUp,
  lucideThumbsDown,
  lucidePlus,
} from '@ng-icons/lucide';
import { OptimizeService } from './optimize.service';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-optimize-detail',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideBot,
      lucideLoader2,
      lucideArrowLeft,
      lucideSparkles,
      lucideSave,
      lucidePlay,
      lucideCheck,
      lucideX,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideEdit,
      lucideFileText,
      lucideLayoutList,
      lucideBeaker,
      lucideZap,
      lucideMessageSquare,
      lucideThumbsUp,
      lucideThumbsDown,
      lucidePlus,
    }),
  ],
  template: `
    <div class="p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button hlmBtn variant="ghost" size="icon" (click)="goBack()">
          <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
        </button>
        <div>
          <h1 class="text-2xl font-bold text-foreground">
            @if (service.selectedFlow(); as flow) {
              {{ flow.name }}
            } @else {
              Loading...
            }
          </h1>
          <p class="text-muted-foreground">Optimize prompt based on user feedback</p>
        </div>
      </div>

      @if (service.loading() && !service.selectedFlow()) {
        <div class="mt-8 flex items-center justify-center py-12">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (service.selectedFlow(); as details) {
        <!-- Stats cards -->
        <div class="mt-8 grid gap-4 sm:grid-cols-4">
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideFileText" class="h-4 w-4" />
              <span class="text-sm">Total Feedback</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ details.feedbackStats.total }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-green-600">
              <ng-icon name="lucideTrendingUp" class="h-4 w-4" />
              <span class="text-sm">Positive</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ details.feedbackStats.positive }}</p>
            <p class="text-sm text-muted-foreground">{{ details.feedbackStats.positivePercent }}%</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-red-600">
              <ng-icon name="lucideTrendingDown" class="h-4 w-4" />
              <span class="text-sm">Negative</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ details.feedbackStats.negative }}</p>
            <p class="text-sm text-muted-foreground">{{ details.feedbackStats.negativePercent }}%</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideBeaker" class="h-4 w-4" />
              <span class="text-sm">Versions</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ details.versions.length }}</p>
          </div>
        </div>

        <!-- Split Test Status (if active) -->
        @if (details.splitTest) {
          <div class="mt-6 rounded-lg border p-4" [class]="details.splitTest.significance.reached ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ng-icon name="lucideBeaker" [class]="details.splitTest.significance.reached ? 'text-green-600' : 'text-blue-600'" class="h-5 w-5" />
                <span class="font-medium">A/B Test: {{ details.splitTest.name }}</span>
                <span class="text-sm px-2 py-0.5 rounded-full" [class]="details.splitTest.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'">
                  {{ details.splitTest.status }}
                </span>
              </div>
              <span class="text-sm">
                Confidence: {{ (details.splitTest.significance.confidence * 100).toFixed(1) }}%
              </span>
            </div>
            <p class="mt-2 text-sm" [class]="details.splitTest.significance.reached ? 'text-green-700' : 'text-blue-700'">
              {{ details.splitTest.significance.message }}
            </p>
          </div>
        }

        <!-- Main content -->
        @if (shouldShowInstructions(details)) {
          <div class="mt-8 grid gap-6 lg:grid-cols-2">
          <!-- Current prompt -->
          <div class="rounded-lg border bg-card">
            <div class="border-b p-4">
              <h3 class="font-semibold flex items-center gap-2">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">A</span>
                Current Instructions
              </h3>
            </div>
            <div class="p-4">
              <pre class="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg max-h-80 overflow-y-auto">{{ details.currentPrompt }}</pre>
            </div>
          </div>

          <!-- New/Draft prompt -->
          <div class="rounded-lg border bg-card">
            <div class="border-b p-4 flex items-center justify-between">
              <h3 class="font-semibold flex items-center gap-2">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">B</span>
                New Instructions
              </h3>
              @if (!service.generatedOptimization() && !details.draftPrompt) {
                <button
                  hlmBtn
                  size="sm"
                  [disabled]="service.generating() || details.feedbackStats.negative === 0"
                  (click)="generateOptimization()"
                >
                  @if (service.generating()) {
                    <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  } @else {
                    <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                    Generate
                  }
                </button>
              }
            </div>
            <div class="p-4">
              @if (service.generatedOptimization(); as opt) {
                <!-- Generated optimization -->
                <div class="space-y-4">
                  <!-- Feedback summary -->
                  <div class="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <h4 class="font-medium text-amber-800 text-sm">Feedback Summary</h4>
                    <p class="mt-2 text-sm text-amber-700 whitespace-pre-wrap">{{ opt.feedbackSummary }}</p>
                  </div>

                  <!-- New prompt -->
                  @if (isEditing()) {
                    <textarea
                      class="w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[200px] focus:outline-none focus:ring-2 focus:ring-primary"
                      [value]="editedPrompt()"
                      (input)="onPromptInput($event)"
                    ></textarea>
                  } @else {
                    <pre class="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg max-h-80 overflow-y-auto">{{ opt.newPrompt }}</pre>
                  }

                  <!-- Actions -->
                  <div class="flex gap-2 justify-end">
                    @if (!isEditing()) {
                      <button hlmBtn variant="outline" size="sm" (click)="startEditing()">
                        <ng-icon name="lucideEdit" class="mr-2 h-4 w-4" />
                        Revise
                      </button>
                    } @else {
                      <button hlmBtn variant="outline" size="sm" (click)="cancelEditing()">
                        <ng-icon name="lucideX" class="mr-2 h-4 w-4" />
                        Cancel
                      </button>
                    }
                    <button
                      hlmBtn
                      size="sm"
                      [disabled]="service.loading()"
                      (click)="saveNewVersion()"
                    >
                      @if (service.loading()) {
                        <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                      } @else {
                        <ng-icon name="lucideSave" class="mr-2 h-4 w-4" />
                      }
                      Save New Version
                    </button>
                  </div>
                </div>
              } @else if (details.draftPrompt) {
                <!-- Existing draft -->
                <div class="space-y-4">
                  <pre class="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg max-h-80 overflow-y-auto">{{ details.draftPrompt }}</pre>
                  <div class="flex gap-2 justify-end">
                    <button
                      hlmBtn
                      size="sm"
                      [disabled]="service.loading()"
                      (click)="activateDraft()"
                    >
                      @if (service.loading()) {
                        <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                      } @else {
                        <ng-icon name="lucidePlay" class="mr-2 h-4 w-4" />
                      }
                      Activate Version
                    </button>
                  </div>
                </div>
              } @else {
                <div class="text-center py-8 text-muted-foreground">
                  <ng-icon name="lucideSparkles" class="mx-auto h-8 w-8 mb-2" />
                  @if (details.feedbackStats.negative > 0) {
                    <p class="text-sm">Click "Generate" to create an optimized prompt</p>
                    <p class="text-xs mt-1">Based on {{ details.feedbackStats.negative }} negative feedback items</p>
                  } @else {
                    <p class="text-sm">No negative feedback yet</p>
                    <p class="text-xs mt-1">Collect feedback to generate optimizations</p>
                  }
                </div>
              }
            </div>
          </div>
          </div>
        }

        <!-- Version history -->
        @if (details.versions.length > 0) {
          <div class="mt-8">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Version History</h3>
              @if (details.versions.length >= 2 && !details.splitTest) {
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  [disabled]="service.loading() || showABTestForm()"
                  (click)="toggleABTestForm()"
                >
                  <ng-icon name="lucideBeaker" class="mr-2 h-4 w-4" />
                  Create A/B Test
                </button>
              }
            </div>

            <!-- A/B Test Creation Form -->
            @if (showABTestForm()) {
              <div class="mb-4 rounded-lg border bg-blue-50 border-blue-200 p-4">
                <h4 class="font-medium text-blue-800 mb-3">Create A/B Test</h4>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-blue-700 mb-1">Test Name</label>
                    <input
                      type="text"
                      class="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Prompt optimization test"
                      [value]="abTestName()"
                      (input)="onABTestNameInput($event)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-blue-700 mb-1">Select versions to test (at least 2)</label>
                    <div class="space-y-2">
                      @for (version of details.versions; track version.id) {
                        <label class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            [checked]="selectedVersionIds().includes(version.id)"
                            (change)="toggleVersionSelection(version.id)"
                          />
                          <span class="text-sm">v{{ version.version }} ({{ version.status }})</span>
                        </label>
                      }
                    </div>
                  </div>
                  <div class="flex gap-2 justify-end">
                    <button hlmBtn variant="outline" size="sm" (click)="toggleABTestForm()">
                      Cancel
                    </button>
                    <button
                      hlmBtn
                      size="sm"
                      [disabled]="!canCreateABTest() || service.loading()"
                      (click)="createABTest()"
                    >
                      @if (service.loading()) {
                        <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                      } @else {
                        <ng-icon name="lucidePlus" class="mr-2 h-4 w-4" />
                      }
                      Create Test
                    </button>
                  </div>
                </div>
              </div>
            }

            <div class="rounded-lg border bg-card overflow-hidden">
              <table class="w-full">
                <thead class="border-b bg-muted/50">
                  <tr>
                    <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Version</th>
                    <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Feedback</th>
                    <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created</th>
                    <th class="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  @for (version of details.versions; track version.id) {
                    <tr class="hover:bg-muted/50">
                      <td class="px-4 py-3 font-medium">v{{ version.version }}</td>
                      <td class="px-4 py-3">
                        <span [class]="getVersionStatusClasses(version.status)">
                          {{ version.status }}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3 text-xs">
                          <span class="flex items-center gap-1 text-green-600" title="Positive">
                            <ng-icon name="lucideThumbsUp" class="h-3 w-3" />
                            {{ version.feedbackStats.positive }}
                          </span>
                          <span class="flex items-center gap-1 text-red-600" title="Negative">
                            <ng-icon name="lucideThumbsDown" class="h-3 w-3" />
                            {{ version.feedbackStats.negative }}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm text-muted-foreground">
                        {{ formatDate(version.createdAt) }}
                      </td>
                      <td class="px-4 py-3 text-right">
                        @if (version.status !== 'active') {
                          <button
                            hlmBtn
                            variant="ghost"
                            size="sm"
                            [disabled]="service.loading()"
                            (click)="activateVersion(version.id)"
                            title="Revert to this version"
                          >
                            <ng-icon name="lucidePlay" class="mr-1 h-4 w-4" />
                            Activate
                          </button>
                        } @else {
                          <span class="text-sm text-green-600 flex items-center justify-end gap-1">
                            <ng-icon name="lucideCheck" class="h-4 w-4" />
                            Active
                          </span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Feedback List -->
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <ng-icon name="lucideMessageSquare" class="h-5 w-5" />
              Feedback
            </h3>
            @if (!feedbackLoaded()) {
              <button hlmBtn variant="outline" size="sm" (click)="loadFeedback()">
                Load Feedback
              </button>
            }
          </div>

          @if (feedbackLoaded()) {
            @if (service.feedbackList().length === 0) {
              <div class="rounded-lg border border-dashed bg-muted/50 p-8 text-center">
                <ng-icon name="lucideMessageSquare" class="mx-auto h-8 w-8 text-muted-foreground" />
                <p class="mt-2 text-muted-foreground">No feedback yet</p>
              </div>
            } @else {
              <div class="space-y-3">
                @for (item of service.feedbackList(); track item.id) {
                  <div class="rounded-lg border bg-card p-4">
                    <div class="flex items-start gap-3">
                      <div [class]="item.sentiment === 'positive' ? 'text-green-600' : 'text-red-600'">
                        <ng-icon [name]="item.sentiment === 'positive' ? 'lucideThumbsUp' : 'lucideThumbsDown'" class="h-5 w-5" />
                      </div>
                      <div class="flex-1">
                        @if (item.artifactTitle) {
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm font-medium text-muted-foreground">{{ item.artifactTitle }}</span>
                            @if (item.version) {
                              <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border">
                                v{{ item.version }}
                              </span>
                            }
                          </div>
                        }
                        @if (item.text) {
                          <p class="text-sm">{{ item.text }}</p>
                        } @else {
                          <p class="text-sm text-muted-foreground italic">No comment provided</p>
                        }
                        <p class="text-xs text-muted-foreground mt-2">{{ formatDate(item.createdAt) }}</p>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class OptimizeDetailComponent implements OnInit {
  protected service = inject(OptimizeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected isEditing = signal(false);
  protected editedPrompt = signal('');
  protected feedbackLoaded = signal(false);
  protected showABTestForm = signal(false);
  protected abTestName = signal('');
  protected selectedVersionIds = signal<number[]>([]);
  private flowId = '';

  ngOnInit(): void {
    this.flowId = decodeURIComponent(this.route.snapshot.params['flowId'] || this.route.snapshot.params['agentId']);
    if (this.flowId) {
      // Handle legacy agentId route
      if (this.route.snapshot.params['agentId'] && !this.route.snapshot.params['flowId']) {
        this.flowId = `agent:${this.flowId}`;
      }
      this.service.getFlowDetails(this.flowId);
    }
  }

  goBack(): void {
    this.service.clearSelectedFlow();
    this.router.navigate(['/optimize']);
  }

  async generateOptimization(): Promise<void> {
    await this.service.generateOptimizedPrompt(this.flowId);
  }

  startEditing(): void {
    const opt = this.service.generatedOptimization();
    if (opt) {
      this.editedPrompt.set(opt.newPrompt);
      this.isEditing.set(true);
    }
  }

  cancelEditing(): void {
    this.isEditing.set(false);
    this.editedPrompt.set('');
  }

  onPromptInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editedPrompt.set(textarea.value);
  }

  async saveNewVersion(): Promise<void> {
    const opt = this.service.generatedOptimization();
    if (!opt) return;

    const prompt = this.isEditing() ? this.editedPrompt() : opt.newPrompt;
    await this.service.saveOptimizedPrompt(this.flowId, prompt);
    this.service.clearGeneratedOptimization();
    this.isEditing.set(false);
  }

  async activateDraft(): Promise<void> {
    const flow = this.service.selectedFlow();
    if (flow?.draftVersionId) {
      await this.service.activateVersion(this.flowId, flow.draftVersionId);
    }
  }

  async activateVersion(versionId: number): Promise<void> {
    await this.service.activateVersion(this.flowId, versionId);
  }

  getVersionStatusClasses(status: string): string {
    const base = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium';
    switch (status) {
      case 'active':
        return `${base} bg-green-100 text-green-700`;
      case 'draft':
        return `${base} bg-yellow-100 text-yellow-700`;
      case 'archived':
        return `${base} bg-gray-100 text-gray-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Feedback methods
  async loadFeedback(): Promise<void> {
    await this.service.getFlowFeedback(this.flowId);
    this.feedbackLoaded.set(true);
  }

  // A/B Test methods
  toggleABTestForm(): void {
    this.showABTestForm.update((v) => !v);
    if (!this.showABTestForm()) {
      this.abTestName.set('');
      this.selectedVersionIds.set([]);
    }
  }

  onABTestNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.abTestName.set(input.value);
  }

  toggleVersionSelection(versionId: number): void {
    this.selectedVersionIds.update((ids) => {
      if (ids.includes(versionId)) {
        return ids.filter((id) => id !== versionId);
      } else {
        return [...ids, versionId];
      }
    });
  }

  canCreateABTest(): boolean {
    return this.abTestName().trim().length > 0 && this.selectedVersionIds().length >= 2;
  }

  async createABTest(): Promise<void> {
    if (!this.canCreateABTest()) return;

    await this.service.createSplitTest(
      this.flowId,
      this.abTestName().trim(),
      this.selectedVersionIds()
    );

    this.showABTestForm.set(false);
    this.abTestName.set('');
    this.selectedVersionIds.set([]);
  }

  shouldShowInstructions(_details: { id: string }): boolean {
    return false;
  }
}
