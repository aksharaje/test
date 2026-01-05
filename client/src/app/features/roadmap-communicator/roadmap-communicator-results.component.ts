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
          @if (session()?.status === 'completed' && presentations().length > 0) {
            <button
              (click)="exportAllToPdf()"
              class="px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50"
            >
              <ng-icon name="lucideFileText" class="h-4 w-4" />
              Export All PDF
            </button>
          }
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

  exportAllToPdf() {
    const session = this.session();
    const presentations = this.presentations();
    if (!session || presentations.length === 0) return;

    const getAudienceLabel = (type: string) => {
      const labels: Record<string, string> = {
        executive: 'Executive Leadership',
        product_team: 'Product Team',
        engineering: 'Engineering',
        customer: 'Customer',
        board: 'Board',
      };
      return labels[type] || type;
    };

    const presentationsHtml = presentations.map(pres => {
      const keyMessagesHtml = pres.talkingPoints?.keyMessages?.map(msg => `
        <div class="message-card">
          <p class="message-text">${msg.message}</p>
          <ul class="supporting-points">
            ${msg.supportingPoints?.map(point => `<li>${point}</li>`).join('') || ''}
          </ul>
          ${msg.dataPoint ? `<p class="data-point">Data: ${msg.dataPoint}</p>` : ''}
        </div>
      `).join('') || '';

      const qaHtml = pres.talkingPoints?.anticipatedQa?.map(qa => `
        <div class="qa-card">
          <p class="question">Q: ${qa.question}</p>
          <p class="answer">A: ${qa.suggestedResponse}</p>
          ${qa.backupData ? `<p class="backup-data">Backup: ${qa.backupData}</p>` : ''}
        </div>
      `).join('') || '';

      const transitionsHtml = pres.talkingPoints?.transitionPhrases?.map(phrase =>
        `<span class="transition-phrase">"${phrase}"</span>`
      ).join('') || '';

      return `
        <div class="presentation page-break">
          <div class="pres-header">
            <h2>${getAudienceLabel(pres.audienceType)}</h2>
            <span class="audience-badge">${pres.audienceName || pres.audienceType}</span>
          </div>

          <div class="pres-section">
            <h3>Presentation Content</h3>
            <div class="formatted-content">${pres.formattedContent || '<p class="muted">No content generated</p>'}</div>
          </div>

          ${keyMessagesHtml ? `
          <div class="pres-section">
            <h3>Key Messages</h3>
            ${keyMessagesHtml}
          </div>
          ` : ''}

          ${qaHtml ? `
          <div class="pres-section">
            <h3>Anticipated Q&A</h3>
            ${qaHtml}
          </div>
          ` : ''}

          ${transitionsHtml ? `
          <div class="pres-section">
            <h3>Transition Phrases</h3>
            <div class="transitions-container">${transitionsHtml}</div>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${session.name || 'Roadmap Presentations'}</title>
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
    .presentation {
      margin-bottom: 48px;
      padding-bottom: 32px;
      border-bottom: 2px solid #e2e8f0;
    }
    .page-break { page-break-before: always; }
    .page-break:first-of-type { page-break-before: avoid; }
    .pres-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #6366f1;
    }
    .pres-header h2 { font-size: 20px; font-weight: 700; color: #6366f1; }
    .audience-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    .pres-section {
      margin-bottom: 24px;
    }
    .pres-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .formatted-content {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      font-size: 13px;
    }
    .formatted-content h1, .formatted-content h2, .formatted-content h3 {
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .formatted-content h1 { font-size: 18px; }
    .formatted-content h2 { font-size: 16px; }
    .formatted-content h3 { font-size: 14px; }
    .formatted-content p { margin-bottom: 8px; }
    .formatted-content ul, .formatted-content ol { margin-left: 20px; margin-bottom: 12px; }
    .formatted-content li { margin-bottom: 4px; }
    .message-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .message-text {
      font-weight: 600;
      color: #6366f1;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .supporting-points {
      margin-left: 20px;
      font-size: 13px;
      color: #64748b;
    }
    .supporting-points li { margin-bottom: 4px; }
    .data-point {
      font-size: 12px;
      color: #6366f1;
      font-style: italic;
      margin-top: 8px;
    }
    .qa-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .question {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .answer {
      font-size: 13px;
      color: #64748b;
    }
    .backup-data {
      font-size: 12px;
      color: #6366f1;
      margin-top: 8px;
    }
    .transitions-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .transition-phrase {
      background: #f1f5f9;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      color: #475569;
    }
    .muted { color: #94a3b8; font-style: italic; }
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
      .presentation { break-inside: avoid; }
      .page-break { page-break-before: always; }
      .page-break:first-of-type { page-break-before: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.name || 'Roadmap Presentations'}</h1>
    <div class="subtitle">${presentations.length} presentation(s) for different audiences</div>
  </div>

  ${presentationsHtml}

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
