import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePresentation,
  lucideLoader2,
  lucideCheck,
  lucideX,
  lucideAlertTriangle,
  lucideDownload,
  lucideRefreshCw,
  lucidePlus,
  lucideChevronRight,
  lucideMessageCircle,
  lucideFileText,
  lucideUsers,
  lucideCode,
  lucideBriefcase,
  lucideBuilding2,
  lucideUserCircle,
  lucideCopy,
} from '@ng-icons/lucide';
import { RoadmapCommunicatorService } from './roadmap-communicator.service';
import type {
  CommunicatorSession,
  GeneratedPresentation,
} from './roadmap-communicator.types';

@Component({
  selector: 'app-roadmap-communicator-results',
  standalone: true,
  imports: [CommonModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucidePresentation,
      lucideLoader2,
      lucideCheck,
      lucideX,
      lucideAlertTriangle,
      lucideDownload,
      lucideRefreshCw,
      lucidePlus,
      lucideChevronRight,
      lucideMessageCircle,
      lucideFileText,
      lucideUsers,
      lucideCode,
      lucideBriefcase,
      lucideBuilding2,
      lucideUserCircle,
      lucideCopy,
    }),
  ],
  template: `
    <div class="min-h-full bg-slate-50">
      <!-- Header -->
      <div class="bg-white border-b px-6 py-4">
        <div class="flex items-center justify-between max-w-7xl mx-auto">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucidePresentation" class="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 class="text-xl font-bold">{{ session()?.name || 'Presentations' }}</h1>
              <p class="text-sm text-muted-foreground">
                {{ presentations().length }} presentation(s) generated
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing State -->
      @if (isProcessing()) {
        <div class="flex flex-col items-center justify-center py-24">
          <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin mb-4" />
          <h2 class="text-lg font-semibold mb-2">Generating Presentation...</h2>
          <p class="text-muted-foreground mb-4">{{ session()?.progressMessage }}</p>
          <div class="w-64 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-300"
              [style.width.%]="progressPercent()"
            ></div>
          </div>
          <p class="text-sm text-muted-foreground mt-2">
            Step {{ session()?.progressStep }} of {{ session()?.progressTotal }}
          </p>
        </div>
      } @else {
        <div class="max-w-7xl mx-auto p-6">
          <div class="flex gap-6">
            <!-- Presentation List Sidebar -->
            <div class="w-64 flex-shrink-0">
              <h3 class="text-sm font-medium text-muted-foreground mb-3">Presentations</h3>
              <div class="space-y-2">
                @for (pres of presentations(); track pres.id) {
                  <button
                    (click)="selectPresentation(pres.id)"
                    class="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
                    [class.bg-white]="selectedPresentationId() === pres.id"
                    [class.shadow-sm]="selectedPresentationId() === pres.id"
                    [class.border]="selectedPresentationId() === pres.id"
                    [class.hover:bg-white]="selectedPresentationId() !== pres.id"
                  >
                    <ng-icon
                      [name]="getAudienceIcon(pres.audienceType)"
                      class="h-5 w-5 text-primary"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-sm truncate">{{ pres.audienceName }}</p>
                    </div>
                    @if (pres.status === 'completed') {
                      <ng-icon name="lucideCheck" class="h-4 w-4 text-green-600" />
                    } @else if (pres.status === 'failed') {
                      <ng-icon name="lucideX" class="h-4 w-4 text-red-600" />
                    }
                  </button>
                }
              </div>
            </div>

            <!-- Selected Presentation Content -->
            <div class="flex-1">
              @if (selectedPresentation()) {
                <div class="bg-white border rounded-lg">
                  <!-- Tabs -->
                  <div class="border-b px-4">
                    <div class="flex gap-4">
                      <button
                        (click)="activeTab = 'content'"
                        class="py-3 px-2 text-sm font-medium border-b-2 transition-colors"
                        [class.border-primary]="activeTab === 'content'"
                        [class.text-primary]="activeTab === 'content'"
                        [class.border-transparent]="activeTab !== 'content'"
                        [class.text-muted-foreground]="activeTab !== 'content'"
                      >
                        <div class="flex items-center gap-2">
                          <ng-icon name="lucideFileText" class="h-4 w-4" />
                          Presentation
                        </div>
                      </button>
                      <button
                        (click)="activeTab = 'talking-points'"
                        class="py-3 px-2 text-sm font-medium border-b-2 transition-colors"
                        [class.border-primary]="activeTab === 'talking-points'"
                        [class.text-primary]="activeTab === 'talking-points'"
                        [class.border-transparent]="activeTab !== 'talking-points'"
                        [class.text-muted-foreground]="activeTab !== 'talking-points'"
                      >
                        <div class="flex items-center gap-2">
                          <ng-icon name="lucideMessageCircle" class="h-4 w-4" />
                          Talking Points
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="p-6">
                    @if (activeTab === 'content') {
                      <!-- Export Options -->
                      <div class="flex items-center justify-between mb-4">
                        <h2 class="font-semibold">
                          {{ selectedPresentation()?.audienceName }} Presentation
                        </h2>
                        <div class="flex items-center gap-2">
                          <button
                            (click)="copyContent()"
                            class="px-3 py-1.5 border rounded text-sm flex items-center gap-1 hover:bg-slate-50"
                          >
                            <ng-icon name="lucideCopy" class="h-4 w-4" />
                            Copy
                          </button>
                          <button
                            (click)="downloadPresentation('html')"
                            class="px-3 py-1.5 border rounded text-sm flex items-center gap-1 hover:bg-slate-50"
                          >
                            <ng-icon name="lucideDownload" class="h-4 w-4" />
                            Download
                          </button>
                        </div>
                      </div>

                      <!-- Rendered Content -->
                      <div
                        class="prose prose-slate prose-sm max-w-none w-full"
                        [innerHTML]="sanitizedContent()"
                      ></div>
                    } @else {
                      <!-- Talking Points -->
                      <div class="space-y-6">
                        <!-- Key Messages -->
                        <div>
                          <h3 class="font-semibold mb-3">Key Messages</h3>
                          <div class="space-y-4">
                            @for (msg of selectedPresentation()?.talkingPoints?.keyMessages || []; track msg.message) {
                              <div class="border rounded-lg p-4">
                                <p class="font-medium text-primary mb-2">{{ msg.message }}</p>
                                <ul class="text-sm text-muted-foreground space-y-1">
                                  @for (point of msg.supportingPoints; track point) {
                                    <li class="flex items-start gap-2">
                                      <ng-icon name="lucideChevronRight" class="h-4 w-4 mt-0.5" />
                                      {{ point }}
                                    </li>
                                  }
                                </ul>
                                @if (msg.dataPoint) {
                                  <p class="text-xs text-primary mt-2 italic">
                                    Data: {{ msg.dataPoint }}
                                  </p>
                                }
                              </div>
                            }
                          </div>
                        </div>

                        <!-- Anticipated Q&A -->
                        <div>
                          <h3 class="font-semibold mb-3">Anticipated Q&A</h3>
                          <div class="space-y-3">
                            @for (qa of selectedPresentation()?.talkingPoints?.anticipatedQa || []; track qa.question) {
                              <div class="bg-slate-50 rounded-lg p-4">
                                <p class="font-medium text-sm mb-2">Q: {{ qa.question }}</p>
                                <p class="text-sm text-muted-foreground">A: {{ qa.suggestedResponse }}</p>
                                @if (qa.backupData) {
                                  <p class="text-xs text-primary mt-2">
                                    Backup: {{ qa.backupData }}
                                  </p>
                                }
                              </div>
                            }
                          </div>
                        </div>

                        <!-- Transition Phrases -->
                        @if (selectedPresentation()?.talkingPoints?.transitionPhrases?.length) {
                          <div>
                            <h3 class="font-semibold mb-3">Transition Phrases</h3>
                            <div class="flex flex-wrap gap-2">
                              @for (phrase of selectedPresentation()?.talkingPoints?.transitionPhrases; track phrase) {
                                <span class="px-3 py-1 bg-slate-100 rounded-full text-sm">
                                  "{{ phrase }}"
                                </span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="flex flex-col items-center justify-center py-24 text-muted-foreground">
                  <ng-icon name="lucidePresentation" class="h-12 w-12 mb-3 opacity-30" />
                  <p>Select a presentation to view</p>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RoadmapCommunicatorResultsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private communicatorService = inject(RoadmapCommunicatorService);
  private sanitizer = inject(DomSanitizer);

  session = signal<CommunicatorSession | null>(null);
  presentations = signal<GeneratedPresentation[]>([]);
  selectedPresentationId = signal<number | null>(null);

  activeTab: 'content' | 'talking-points' = 'content';
  private pollInterval: any;

  isProcessing = computed(() => {
    return this.session()?.status === 'generating';
  });

  progressPercent = computed(() => {
    const s = this.session();
    if (!s || !s.progressTotal) return 0;
    return (s.progressStep / s.progressTotal) * 100;
  });

  selectedPresentation = computed(() => {
    const id = this.selectedPresentationId();
    return this.presentations().find((p) => p.id === id) || null;
  });

  sanitizedContent = computed((): SafeHtml => {
    const content = this.selectedPresentation()?.formattedContent || '';
    return this.sanitizer.bypassSecurityTrustHtml(content);
  });

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.params['id']);
    await this.loadData(sessionId);

    if (this.isProcessing()) {
      this.startPolling(sessionId);
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  async loadData(sessionId: number) {
    try {
      const response = await this.communicatorService.loadSession(sessionId);
      this.session.set(response.session);
      this.presentations.set(response.presentations);

      // Select first presentation by default
      if (response.presentations.length > 0) {
        this.selectedPresentationId.set(response.presentations[0].id);
      }
    } catch (err) {
      console.error('Failed to load session', err);
    }
  }

  startPolling(sessionId: number) {
    this.pollInterval = setInterval(async () => {
      const status = await this.communicatorService.getSessionStatus(sessionId);
      this.session.update((s) =>
        s
          ? {
              ...s,
              status: status.status as any,
              progressStep: status.progressStep,
              progressMessage: status.progressMessage || s.progressMessage,
              errorMessage: status.errorMessage,
            }
          : null
      );

      if (status.status === 'completed' || status.status === 'failed') {
        this.stopPolling();
        await this.loadData(sessionId);
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getAudienceIcon(audienceType: string): string {
    const icons: Record<string, string> = {
      executive: 'lucideBriefcase',
      product_team: 'lucideUsers',
      engineering: 'lucideCode',
      customer: 'lucideUserCircle',
      board: 'lucideBuilding2',
    };
    return icons[audienceType] || 'lucideUsers';
  }

  selectPresentation(presentationId: number) {
    this.selectedPresentationId.set(presentationId);
    this.activeTab = 'content';
  }

  copyContent() {
    const content = this.selectedPresentation()?.formattedContent;
    if (content) {
      navigator.clipboard.writeText(content);
    }
  }

  async downloadPresentation(format: string) {
    const pres = this.selectedPresentation();
    if (!pres) return;

    try {
      const blob = await this.communicatorService.exportPresentation(pres.id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadmap-${pres.audienceType}-${pres.id}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download presentation', err);
    }
  }

}
