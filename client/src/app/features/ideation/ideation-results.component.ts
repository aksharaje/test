import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEdit2, lucideSave, lucideX, lucideSparkles, lucideArrowLeft } from '@ng-icons/lucide';
import { IdeationService } from './ideation.service';
import type { GeneratedIdea } from './ideation.types';

@Component({
  selector: 'app-ideation-results',
  standalone: true,
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      lucideEdit2,
      lucideSave,
      lucideX,
      lucideSparkles,
      lucideArrowLeft,
    }),
  ],
  template: `
    <div class="p-6">
      <div class="max-w-6xl mx-auto mb-6">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Prioritized Backlog</h1>
          <p class="mt-2 text-muted-foreground">
            {{ totalIdeas() }} unique ideas clustered into {{ totalClusters() }} themes
          </p>
        </div>
      </div>

      <div class="max-w-6xl mx-auto space-y-6">
        @for (cluster of clusters(); track cluster.id) {
          <div class="border rounded-lg overflow-hidden">
            <button
              type="button"
              class="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted"
              (click)="toggleCluster(cluster.id)"
            >
              <div>
                <h2 class="font-semibold text-lg">{{ cluster.themeName }}</h2>
                <p class="text-sm text-muted-foreground">{{ cluster.ideaCount }} ideas</p>
              </div>
              <span>{{ expandedClusters().has(cluster.id) ? '▼' : '▶' }}</span>
            </button>

            @if (expandedClusters().has(cluster.id)) {
              <div class="divide-y">
                @for (idea of cluster.ideas; track idea.id) {
                  <div class="p-4">
                    @if (editingIdeaId() === idea.id) {
                      <!-- Edit Mode -->
                      <div class="space-y-4">
                        <div class="flex items-center justify-between">
                          <h3 class="font-semibold">Edit Idea</h3>
                          <div class="flex gap-2">
                            <button
                              type="button"
                              class="p-2 rounded hover:bg-muted transition-colors"
                              (click)="saveIdea(idea.id)"
                              title="Save"
                            >
                              <ng-icon name="lucideSave" class="h-4 w-4 text-green-600" />
                            </button>
                            <button
                              type="button"
                              class="p-2 rounded hover:bg-muted transition-colors"
                              (click)="cancelEdit()"
                              title="Cancel"
                            >
                              <ng-icon name="lucideX" class="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label class="text-sm font-medium">Title</label>
                          <input
                            type="text"
                            class="mt-1 w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            [value]="editForm().title"
                            (input)="updateEditForm('title', $event)"
                          />
                        </div>

                        <div>
                          <label class="text-sm font-medium">Description</label>
                          <textarea
                            class="mt-1 w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                            [value]="editForm().description"
                            (input)="updateEditForm('description', $event)"
                          ></textarea>
                        </div>

                        <div>
                          <label class="text-sm font-medium">Use Cases (one per line)</label>
                          <textarea
                            class="mt-1 w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                            [value]="(editForm().useCases || []).join('\\n')"
                            (input)="updateEditFormArray('useCases', $event)"
                          ></textarea>
                        </div>

                        <div>
                          <label class="text-sm font-medium">Edge Cases (one per line)</label>
                          <textarea
                            class="mt-1 w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                            [value]="(editForm().edgeCases || []).join('\\n')"
                            (input)="updateEditFormArray('edgeCases', $event)"
                          ></textarea>
                        </div>

                        <div>
                          <label class="text-sm font-medium">Implementation Notes (one per line)</label>
                          <textarea
                            class="mt-1 w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                            [value]="(editForm().implementationNotes || []).join('\\n')"
                            (input)="updateEditFormArray('implementationNotes', $event)"
                          ></textarea>
                        </div>
                      </div>
                    } @else {
                      <!-- View Mode -->
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <h3 class="font-semibold">{{ idea.title }}</h3>
                          <span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            {{ categoryLabel(idea.category) }}
                          </span>
                          <p class="mt-2 text-sm text-muted-foreground">{{ idea.description }}</p>
                        </div>
                        <button
                          type="button"
                          class="ml-4 p-2 rounded hover:bg-muted transition-colors"
                          (click)="startEdit(idea)"
                          title="Edit idea"
                        >
                          <ng-icon name="lucideEdit2" class="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>

                      @if (idea.compositeScore) {
                        <div class="mt-4 grid grid-cols-3 gap-3">
                          <div class="text-center p-2 rounded bg-muted/50">
                            <p class="text-2xl font-bold text-primary">{{ idea.compositeScore.toFixed(1) }}</p>
                            <p class="text-xs text-muted-foreground">Composite</p>
                          </div>
                          <div class="text-center p-2 rounded bg-muted/50">
                            <p class="text-lg font-semibold">{{ idea.impactScore }}/10</p>
                            <p class="text-xs text-muted-foreground">Impact</p>
                          </div>
                          <div class="text-center p-2 rounded bg-muted/50">
                            <p class="text-lg font-semibold">{{ idea.feasibilityScore }}/10</p>
                            <p class="text-xs text-muted-foreground">Feasibility</p>
                          </div>
                        </div>
                      }

                      <details class="mt-4">
                        <summary class="cursor-pointer text-sm font-medium text-primary">View Details</summary>
                        <div class="mt-3 space-y-3 text-sm">
                          @if (idea.useCases.length > 0) {
                            <div>
                              <p class="font-medium">Use Cases:</p>
                              <ul class="mt-1 list-disc list-inside">
                                @for (useCase of idea.useCases; track $index) {
                                  <li>{{ useCase }}</li>
                                }
                              </ul>
                            </div>
                          }
                          @if (idea.edgeCases.length > 0) {
                            <div>
                              <p class="font-medium">Edge Cases:</p>
                              <ul class="mt-1 list-disc list-inside">
                                @for (edgeCase of idea.edgeCases; track $index) {
                                  <li>{{ edgeCase }}</li>
                                }
                              </ul>
                            </div>
                          }
                          @if (idea.implementationNotes.length > 0) {
                            <div>
                              <p class="font-medium">Implementation Notes:</p>
                              <ul class="mt-1 list-disc list-inside">
                                @for (note of idea.implementationNotes; track $index) {
                                  <li>{{ note }}</li>
                                }
                              </ul>
                            </div>
                          }
                        </div>
                      </details>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class IdeationResultsComponent implements OnInit {
  private service = inject(IdeationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  session = computed(() => this.service.currentSession()?.session);
  clusters = computed(() => this.service.currentSession()?.clusters ?? []);
  totalIdeas = computed(() => this.service.currentSession()?.ideas.length ?? 0);
  totalClusters = computed(() => this.clusters().length);
  prioritizedBacklog = computed(() => this.service.currentSession()?.prioritizedBacklog);

  expandedClusters = signal<Set<number>>(new Set());
  editingIdeaId = signal<number | null>(null);
  editForm = signal<Partial<GeneratedIdea>>({
    title: '',
    description: '',
    useCases: [],
    edgeCases: [],
    implementationNotes: [],
  });

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (sessionId) {
      await this.service.getSessionDetail(sessionId);
      if (this.clusters().length > 0) {
        this.expandedClusters.set(new Set([this.clusters()[0].id]));
      }
    }
  }

  toggleCluster(clusterId: number) {
    this.expandedClusters.update(set => {
      const newSet = new Set(set);
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId);
      } else {
        newSet.add(clusterId);
      }
      return newSet;
    });
  }

  startEdit(idea: GeneratedIdea) {
    this.editingIdeaId.set(idea.id);
    this.editForm.set({
      title: idea.title,
      description: idea.description,
      useCases: [...idea.useCases],
      edgeCases: [...idea.edgeCases],
      implementationNotes: [...idea.implementationNotes],
    });
  }

  cancelEdit() {
    this.editingIdeaId.set(null);
    this.editForm.set({
      title: '',
      description: '',
      useCases: [],
      edgeCases: [],
      implementationNotes: [],
    });
  }

  updateEditForm(field: string, event: Event) {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.editForm.update(form => ({ ...form, [field]: value }));
  }

  updateEditFormArray(field: string, event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    const array = value.split('\n').filter(line => line.trim().length > 0);
    this.editForm.update(form => ({ ...form, [field]: array }));
  }

  async saveIdea(ideaId: number) {
    const updated = await this.service.updateIdea(ideaId, this.editForm());
    if (updated) {
      this.cancelEdit();
    }
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      quick_wins: 'Quick Win',
      strategic_bets: 'Strategic Bet',
      incremental: 'Incremental',
      moonshots: 'Moonshot',
    };
    return labels[category] || category;
  }
}
