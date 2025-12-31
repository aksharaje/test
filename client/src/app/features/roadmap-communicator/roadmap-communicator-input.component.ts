import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePresentation,
  lucideCheck,
  lucideLoader2,
  lucidePlus,
  lucideTrash2,
  lucidePlay,
  lucideInfo,
  lucideHistory,
  lucideChevronRight,
  lucideArrowRight,
  lucideEye,
  lucideUsers,
  lucideCode,
  lucideBriefcase,
  lucideBuilding2,
  lucideUserCircle,
  lucideRotateCw,
} from '@ng-icons/lucide';
import { RoadmapCommunicatorService } from './roadmap-communicator.service';
import { RoadmapPlannerService } from '../roadmap-planner/roadmap-planner.service';
import type { CommunicatorSession, AudienceType, PresentationConfig } from './roadmap-communicator.types';
import type { RoadmapSession } from '../roadmap-planner/roadmap-planner.types';

@Component({
  selector: 'app-roadmap-communicator-input',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucidePresentation,
      lucideCheck,
      lucideLoader2,
      lucidePlus,
      lucideTrash2,
      lucidePlay,
      lucideInfo,
      lucideHistory,
      lucideChevronRight,
      lucideArrowRight,
      lucideEye,
      lucideUsers,
      lucideCode,
      lucideBriefcase,
      lucideBuilding2,
      lucideUserCircle,
      lucideRotateCw,
    }),
  ],
  template: `
    <div class="flex h-full">
      <!-- Left Panel: Input Form -->
      <div class="w-1/2 border-r p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucidePresentation" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold text-foreground">Roadmap Communicator</h1>
          </div>
          <p class="text-muted-foreground mb-6">
            Generate audience-tailored presentations with narratives and talking points.
          </p>

          <!-- Select Roadmap -->
          <div class="mb-6">
            <label class="text-sm font-medium mb-2 block">Select Roadmap</label>
            @if (roadmaps().length === 0) {
              <div class="border border-dashed rounded-lg p-4 text-center text-muted-foreground">
                <p>No roadmaps available.</p>
                <a href="/roadmapping/planner" class="text-primary hover:underline text-sm">
                  Create a roadmap first
                </a>
              </div>
            } @else {
              <select
                [ngModel]="selectedRoadmapId()"
                (ngModelChange)="onRoadmapSelected($event)"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option [value]="null">Select a roadmap...</option>
                @for (roadmap of roadmaps(); track roadmap.id) {
                  <option [value]="roadmap.id">{{ roadmap.name }}</option>
                }
              </select>
            }
          </div>

          @if (selectedRoadmapId()) {
            <!-- Session Name -->
            <div class="mb-6">
              <label class="text-sm font-medium">Presentation Session Name</label>
              <input
                type="text"
                [(ngModel)]="sessionName"
                class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Q1 2025 Stakeholder Presentations"
              />
            </div>

            <!-- Audience Selection -->
            <div class="mb-6">
              <label class="text-sm font-medium mb-2 block">Select Target Audience</label>
              <div class="grid grid-cols-2 gap-3">
                @for (audience of audienceTypes(); track audience.id) {
                  <button
                    (click)="selectAudience(audience)"
                    class="flex items-start gap-3 p-4 border rounded-lg text-left hover:bg-slate-50 transition-colors"
                    [class.ring-2]="selectedAudienceId() === audience.id"
                    [class.ring-primary]="selectedAudienceId() === audience.id"
                    [class.bg-primary/5]="selectedAudienceId() === audience.id"
                  >
                    <ng-icon
                      [name]="getAudienceIcon(audience.id)"
                      class="h-5 w-5 text-primary mt-0.5"
                    />
                    <div>
                      <p class="font-medium">{{ audience.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ audience.description }}</p>
                    </div>
                  </button>
                }
              </div>
            </div>

            @if (selectedAudienceId()) {
              <!-- Presentation Options -->
              <div class="mb-6">
                <label class="text-sm font-medium mb-2 block">Presentation Tone</label>
                <div class="flex gap-2">
                  @for (tone of tones; track tone.value) {
                    <button
                      (click)="selectedTone = tone.value"
                      class="px-4 py-2 border rounded-lg text-sm"
                      [class.bg-primary]="selectedTone === tone.value"
                      [class.text-white]="selectedTone === tone.value"
                      [class.border-primary]="selectedTone === tone.value"
                    >
                      {{ tone.label }}
                    </button>
                  }
                </div>
              </div>

              <!-- Generate Button -->
              <button
                (click)="createAndGenerate()"
                [disabled]="!canGenerate() || isLoading()"
                class="w-full px-6 py-3 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                @if (isLoading()) {
                  <ng-icon name="lucideLoader2" class="h-5 w-5 animate-spin" />
                  Generating Presentation...
                } @else {
                  <ng-icon name="lucidePlay" class="h-5 w-5" />
                  Generate Presentation
                }
              </button>
            }
          }
        </div>
      </div>

      <!-- Right Panel: History -->
      <div class="w-1/2 flex flex-col bg-muted/30">
        <div class="border-b bg-white p-4">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
            <h2 class="font-semibold">Presentation History</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            View and manage your past presentation sessions
          </p>
        </div>

        <div class="flex-1 overflow-y-auto">
          @if (previousSessions().length === 0) {
            <div class="flex-1 flex items-center justify-center p-6 h-64">
              <div class="text-center">
                <ng-icon name="lucideHistory" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                  Your presentation sessions will appear here.
                </p>
              </div>
            </div>
          } @else {
            <div class="p-4 space-y-2">
              @for (session of previousSessions(); track session.id) {
                <div
                  class="group rounded-lg border bg-white p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  (click)="viewSession(session.id)"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="session.status === 'generating'"
                          [class.text-yellow-700]="session.status === 'generating'"
                          [class.bg-red-100]="session.status === 'failed'"
                          [class.text-red-700]="session.status === 'failed'"
                          [class.bg-slate-100]="session.status === 'draft'"
                          [class.text-slate-700]="session.status === 'draft'"
                        >
                          {{ getStatusLabel(session.status) }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {{ session.createdAt | date:'MMM d, yyyy' }}
                        </span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-foreground">
                        {{ session.name }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ session.totalPresentations }} presentation(s)
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
                        class="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        (click)="deleteSessionClick($event, session)"
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
  styles: `:host { display: block; height: 100%; }`,
})
export class RoadmapCommunicatorInputComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private communicatorService = inject(RoadmapCommunicatorService);
  private roadmapService = inject(RoadmapPlannerService);

  // State
  roadmaps = signal<RoadmapSession[]>([]);
  selectedRoadmapId = signal<number | null>(null);
  sessionName = '';
  audienceTypes = this.communicatorService.audienceTypes;
  previousSessions = signal<CommunicatorSession[]>([]);
  isLoading = this.communicatorService.isLoading;

  // Selected options
  selectedAudienceId = signal<string | null>(null);
  selectedTone: 'professional' | 'collaborative' | 'inspirational' = 'professional';
  scenarioVariantId: number | null = null;

  tones = [
    { value: 'professional' as const, label: 'Professional' },
    { value: 'collaborative' as const, label: 'Collaborative' },
    { value: 'inspirational' as const, label: 'Inspirational' },
  ];

  canGenerate = computed(() => {
    return this.selectedRoadmapId() !== null && this.selectedAudienceId() !== null;
  });

  async ngOnInit() {
    // Load roadmaps (returns Observable, need to convert to Promise)
    const roadmaps = await this.roadmapService.loadSessions().toPromise();
    this.roadmaps.set(roadmaps || []);

    // Load audience types
    await this.communicatorService.loadAudienceTypes();

    // Load previous sessions
    await this.communicatorService.loadSessions();
    this.previousSessions.set(this.communicatorService.sessions());

    // Check for query params
    const roadmapId = this.route.snapshot.queryParams['roadmapId'];
    const scenarioVariantId = this.route.snapshot.queryParams['scenarioVariantId'];

    if (roadmapId) {
      this.selectedRoadmapId.set(Number(roadmapId));
      await this.onRoadmapSelected(Number(roadmapId));
    }
    if (scenarioVariantId) {
      this.scenarioVariantId = Number(scenarioVariantId);
    }
  }

  async onRoadmapSelected(roadmapId: number | null) {
    this.selectedRoadmapId.set(roadmapId);
    if (roadmapId) {
      await this.communicatorService.loadSessions(roadmapId);
      this.previousSessions.set(this.communicatorService.sessions());
    }
  }

  getAudienceIcon(audienceId: string): string {
    const icons: Record<string, string> = {
      executive: 'lucideBriefcase',
      product_team: 'lucideUsers',
      engineering: 'lucideCode',
      customer: 'lucideUserCircle',
      board: 'lucideBuilding2',
    };
    return icons[audienceId] || 'lucideUsers';
  }

  selectAudience(audience: AudienceType) {
    this.selectedAudienceId.set(audience.id);
  }

  async createAndGenerate() {
    if (!this.selectedRoadmapId() || !this.selectedAudienceId()) return;

    try {
      // Create session
      const session = await this.communicatorService.createSession({
        roadmapSessionId: this.selectedRoadmapId()!,
        scenarioVariantId: this.scenarioVariantId || undefined,
        name: this.sessionName || 'Presentation Session',
      });

      // Generate presentation
      const config: PresentationConfig = {
        audienceType: this.selectedAudienceId()!,
        tone: this.selectedTone,
        format: 'html',
      };

      await this.communicatorService.generatePresentation(session.id, config);

      // Navigate to results
      this.router.navigate(['/roadmapping/communicator/session', session.id]);
    } catch (err) {
      console.error('Failed to create presentation session', err);
    }
  }

  viewSession(sessionId: number) {
    this.router.navigate(['/roadmapping/communicator/session', sessionId]);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      generating: 'Generating',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  async retrySession(event: Event, session: CommunicatorSession) {
    event.stopPropagation();
    // Navigate back to create a new presentation for this session
    this.router.navigate(['/roadmapping/communicator'], {
      queryParams: { roadmapId: session.roadmapSessionId },
    });
  }

  async deleteSessionClick(event: Event, session: CommunicatorSession) {
    event.stopPropagation();
    if (confirm(`Delete "${session.name}"? This cannot be undone.`)) {
      try {
        await this.communicatorService.deleteSession(session.id);
        this.previousSessions.update((sessions) =>
          sessions.filter((s) => s.id !== session.id)
        );
      } catch (err) {
        console.error('Failed to delete session', err);
      }
    }
  }
}
