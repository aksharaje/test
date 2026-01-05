import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEdit2, lucideSave, lucideX, lucideSparkles, lucideArrowLeft, lucideFileText } from '@ng-icons/lucide';
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
      lucideFileText,
    }),
  ],
  template: `
    <div class="p-6">
      <div class="max-w-6xl mx-auto mb-6">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold text-foreground">Prioritized Backlog</h1>
            <p class="mt-2 text-muted-foreground">
              {{ totalIdeas() }} unique ideas clustered into {{ totalClusters() }} themes
            </p>
          </div>
          @if (clusters().length > 0) {
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
              (click)="exportToPdf()"
            >
              <ng-icon name="lucideFileText" class="h-4 w-4" />
              Export PDF
            </button>
          }
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

  exportToPdf() {
    const clusters = this.clusters();
    const session = this.session();
    if (clusters.length === 0) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prioritized Backlog</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 48px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid #6366f1;
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { font-size: 14px; color: #64748b; }
    .cluster {
      margin-bottom: 32px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .cluster-header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .cluster-header h2 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .cluster-header .count { font-size: 13px; color: #64748b; }
    .idea {
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .idea:last-child { border-bottom: none; }
    .idea-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .idea-title { font-size: 15px; font-weight: 600; }
    .tag {
      font-size: 11px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 12px;
      background: #dcfce7;
      color: #166534;
    }
    .idea-desc { font-size: 13px; color: #475569; margin-bottom: 12px; }
    .scores {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    .score {
      text-align: center;
      padding: 8px 16px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .score-value { font-size: 18px; font-weight: 700; color: #6366f1; }
    .score-label { font-size: 11px; color: #64748b; }
    .details-section { margin-top: 12px; }
    .details-title { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; }
    .details-list { list-style: disc; margin-left: 20px; font-size: 12px; color: #64748b; }
    .details-list li { margin-bottom: 4px; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 24px; }
      .cluster { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Prioritized Backlog</h1>
    <div class="subtitle">${this.totalIdeas()} ideas in ${this.totalClusters()} themes</div>
  </div>

  ${clusters.map(cluster => `
  <div class="cluster">
    <div class="cluster-header">
      <h2>${cluster.themeName}</h2>
      <div class="count">${cluster.ideaCount} ideas</div>
    </div>
    ${cluster.ideas.map(idea => `
    <div class="idea">
      <div class="idea-header">
        <span class="idea-title">${idea.title}</span>
        <span class="tag">${this.categoryLabel(idea.category)}</span>
      </div>
      <p class="idea-desc">${idea.description}</p>
      ${idea.compositeScore ? `
      <div class="scores">
        <div class="score">
          <div class="score-value">${idea.compositeScore.toFixed(1)}</div>
          <div class="score-label">Composite</div>
        </div>
        <div class="score">
          <div class="score-value">${idea.impactScore}/10</div>
          <div class="score-label">Impact</div>
        </div>
        <div class="score">
          <div class="score-value">${idea.feasibilityScore}/10</div>
          <div class="score-label">Feasibility</div>
        </div>
      </div>
      ` : ''}
      ${idea.useCases.length > 0 ? `
      <div class="details-section">
        <div class="details-title">Use Cases</div>
        <ul class="details-list">
          ${idea.useCases.map(uc => `<li>${uc}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      ${idea.edgeCases.length > 0 ? `
      <div class="details-section">
        <div class="details-title">Edge Cases</div>
        <ul class="details-list">
          ${idea.edgeCases.map(ec => `<li>${ec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      ${idea.implementationNotes.length > 0 ? `
      <div class="details-section">
        <div class="details-title">Implementation Notes</div>
        <ul class="details-list">
          ${idea.implementationNotes.map(n => `<li>${n}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    `).join('')}
  </div>
  `).join('')}

  <div class="footer">
    Generated by Product Studio • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }
}
