/**
 * Journey Mapper Component
 *
 * Landing page with mode selection, journey input form, and session history.
 * Follows patterns from research-planner for consistent UX.
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRoute,
  lucideUsers,
  lucideSwords,
  lucideUpload,
  lucideX,
  lucideLoader2,
  lucidePlus,
  lucideTrash2,
  lucideDatabase,
  lucideArrowRight,
  lucideAlertTriangle,
  lucideChevronDown,
  lucideChevronUp,
  lucideChevronRight,
  lucideHistory,
  lucideSearch,
  lucideCheck,
  lucideLightbulb,
  lucideClipboardCheck,
  lucideDollarSign,
  lucideRotateCw,
} from '@ng-icons/lucide';

import { JourneyMapperService } from './journey-mapper.service';
import {
  JourneyMode,
  JourneyMapSession,
  MODE_CARDS,
  ModeCard,
  AvailableContextSources,
  PersonaInput,
} from './journey-mapper.types';

@Component({
  selector: 'app-journey-mapper',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideRoute,
      lucideUsers,
      lucideSwords,
      lucideUpload,
      lucideX,
      lucideLoader2,
      lucidePlus,
      lucideTrash2,
      lucideDatabase,
      lucideArrowRight,
      lucideAlertTriangle,
      lucideChevronDown,
      lucideChevronUp,
      lucideChevronRight,
      lucideHistory,
      lucideSearch,
      lucideCheck,
      lucideLightbulb,
      lucideClipboardCheck,
      lucideDollarSign,
      lucideRotateCw,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Split Layout (form + history) -->
      <div class="flex h-[calc(100vh-64px)]">
        <!-- Left Panel: Input Form -->
        <div class="w-1/2 overflow-y-auto border-r border-border">
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-primary/10 rounded-lg">
                <ng-icon name="lucideRoute" class="text-primary" size="24" />
              </div>
              <div>
                <h2 class="font-semibold text-foreground">Journey & Pain Point Mapper</h2>
                <p class="text-sm text-muted-foreground">Create AI-powered customer journey maps from research data</p>
              </div>
            </div>

              <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
                <!-- Journey Description -->
                <div>
                  <label class="block text-sm font-medium text-foreground mb-1">
                    Journey Description <span class="text-destructive">*</span>
                  </label>
                  <textarea
                    formControlName="journeyDescription"
                    rows="3"
                    class="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g., Enterprise onboarding from signup to first successful use"
                  ></textarea>
                  <p class="text-xs text-muted-foreground mt-1">
                    Describe the customer journey you want to map (min 5 characters)
                  </p>
                  @if (form.get('journeyDescription')?.invalid && form.get('journeyDescription')?.touched) {
                    <p class="text-xs text-destructive mt-1">Journey description is required (min 5 characters)</p>
                  }
                </div>

                <!-- File Upload -->
                <div>
                    <label class="block text-sm font-medium text-foreground mb-1">
                      Data Sources (Optional)
                    </label>
                    <div
                      class="border-2 border-dashed border-input rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                      (click)="fileInput.click()"
                      (dragover)="onDragOver($event)"
                      (drop)="onDrop($event)"
                    >
                      <input
                        #fileInput
                        type="file"
                        multiple
                        accept=".pdf,.docx,.txt,.csv,.xlsx,.json"
                        (change)="onFilesSelected($event)"
                        class="hidden"
                      />
                      <ng-icon name="lucideUpload" class="text-muted-foreground mx-auto mb-2" size="32" />
                      <p class="text-sm text-muted-foreground">
                        Drop files here or click to upload
                      </p>
                      <p class="text-xs text-muted-foreground mt-1">
                        Supports PDF, DOCX, TXT, CSV, XLSX, JSON
                      </p>
                    </div>
                    @if (selectedFiles().length > 0) {
                      <div class="mt-3 space-y-2">
                        @for (file of selectedFiles(); track file.name) {
                          <div class="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <span class="text-sm text-foreground truncate">{{ file.name }}</span>
                            <button
                              type="button"
                              (click)="removeFile(file)"
                              class="text-muted-foreground hover:text-destructive"
                            >
                              <ng-icon name="lucideX" size="16" />
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>

                <!-- Context Sources (Collapsible) -->
                <div class="rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    (click)="toggleContextSources()"
                    class="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div class="flex items-center gap-3">
                      <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary" />
                      <div>
                        <span class="text-sm font-medium text-foreground">Add Context (Optional)</span>
                        <p class="text-xs text-muted-foreground">
                          Enrich journey with knowledge bases and prior analysis
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      @if (selectedContextCount() > 0) {
                        <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {{ selectedContextCount() }} selected
                        </span>
                      }
                      <ng-icon
                        [name]="showContextSources() ? 'lucideChevronUp' : 'lucideChevronDown'"
                        class="h-5 w-5 text-muted-foreground"
                      />
                    </div>
                  </button>

                  @if (showContextSources()) {
                    <div class="border-t border-border px-4 pb-4 pt-3 space-y-4">
                      <!-- Knowledge Bases -->
                      @if (contextSources()?.knowledgeBases?.length) {
                        <div>
                          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                            Knowledge Bases
                          </label>
                          <div class="relative">
                            <button
                              type="button"
                              class="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                              (click)="toggleDropdown('kb')"
                            >
                              <span class="truncate text-left">
                                @if (selectedKnowledgeBases().length === 0) {
                                  <span class="text-muted-foreground">Select knowledge bases...</span>
                                } @else if (selectedKnowledgeBases().length === 1) {
                                  {{ getKbName(selectedKnowledgeBases()[0]) }}
                                } @else {
                                  {{ selectedKnowledgeBases().length }} knowledge bases selected
                                }
                              </span>
                              <ng-icon
                                name="lucideChevronDown"
                                class="h-4 w-4 text-muted-foreground transition-transform"
                                [class.rotate-180]="kbDropdownOpen()"
                              />
                            </button>

                            @if (kbDropdownOpen()) {
                              <div class="fixed inset-0 z-40" (click)="closeAllDropdowns()"></div>
                              <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-lg">
                                <div class="p-2 border-b border-border">
                                  <div class="relative">
                                    <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                      type="text"
                                      placeholder="Filter knowledge bases..."
                                      class="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      [value]="kbSearchFilter()"
                                      (input)="kbSearchFilter.set(getInputValue($event))"
                                      (click)="$event.stopPropagation()"
                                    />
                                  </div>
                                </div>
                                <div class="max-h-48 overflow-y-auto p-1">
                                  @for (kb of filteredKnowledgeBases(); track kb.id) {
                                    <button
                                      type="button"
                                      class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                                      [class.bg-primary/10]="selectedKnowledgeBases().includes(kb.id)"
                                      (click)="toggleKnowledgeBase(kb.id); $event.stopPropagation()"
                                    >
                                      <div
                                        class="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                                        [class.bg-primary]="selectedKnowledgeBases().includes(kb.id)"
                                        [class.border-primary]="selectedKnowledgeBases().includes(kb.id)"
                                      >
                                        @if (selectedKnowledgeBases().includes(kb.id)) {
                                          <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                                        }
                                      </div>
                                      <span class="truncate flex-1 text-left text-foreground">{{ kb.name }}</span>
                                      <span class="text-xs text-muted-foreground">{{ kb.documentCount }} docs</span>
                                    </button>
                                  }
                                  @if (filteredKnowledgeBases().length === 0) {
                                    <div class="p-3 text-center text-sm text-muted-foreground">
                                      No knowledge bases found
                                    </div>
                                  }
                                </div>
                              </div>
                            }
                          </div>
                        </div>
                      }

                      <!-- Ideation Sessions -->
                      @if (contextSources()?.ideationSessions?.length) {
                        <div>
                          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                            <ng-icon name="lucideLightbulb" class="inline h-3 w-3 mr-1" />
                            Ideation Session
                          </label>
                          <select
                            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            [value]="selectedIdeationSession() || ''"
                            (change)="selectedIdeationSession.set(getSelectValue($event))"
                          >
                            <option value="">None</option>
                            @for (session of contextSources()?.ideationSessions; track session.id) {
                              <option [value]="session.id">{{ session.problemStatement }}</option>
                            }
                          </select>
                        </div>
                      }

                      <!-- Feasibility Sessions -->
                      @if (contextSources()?.feasibilitySessions?.length) {
                        <div>
                          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                            <ng-icon name="lucideClipboardCheck" class="inline h-3 w-3 mr-1" />
                            Feasibility Analysis
                          </label>
                          <select
                            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            [value]="selectedFeasibilitySession() || ''"
                            (change)="selectedFeasibilitySession.set(getSelectValue($event))"
                          >
                            <option value="">None</option>
                            @for (session of contextSources()?.feasibilitySessions; track session.id) {
                              <option [value]="session.id">{{ session.featureName }}</option>
                            }
                          </select>
                        </div>
                      }

                      <!-- Business Case Sessions -->
                      @if (contextSources()?.businessCaseSessions?.length) {
                        <div>
                          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                            <ng-icon name="lucideDollarSign" class="inline h-3 w-3 mr-1" />
                            Business Case
                          </label>
                          <select
                            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            [value]="selectedBusinessCaseSession() || ''"
                            (change)="selectedBusinessCaseSession.set(getSelectValue($event))"
                          >
                            <option value="">None</option>
                            @for (session of contextSources()?.businessCaseSessions; track session.id) {
                              <option [value]="session.id">{{ session.featureName }}</option>
                            }
                          </select>
                        </div>
                      }

                      @if (!hasAnyContextSources()) {
                        <p class="text-sm text-muted-foreground text-center py-4">
                          No context sources available yet. Create knowledge bases or complete other analyses first.
                        </p>
                      }
                    </div>
                  }
                </div>

                <!-- Error Message -->
                @if (service.error()) {
                  <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {{ service.error() }}
                  </div>
                }

                <!-- Submit Button -->
                <div class="flex justify-end pt-4 border-t border-border">
                  <button
                    type="submit"
                    [disabled]="form.invalid || service.loading()"
                    class="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    @if (service.loading()) {
                      <ng-icon name="lucideLoader2" class="animate-spin" size="18" />
                      Creating...
                    } @else {
                      Generate Journey Map
                      <ng-icon name="lucideArrowRight" size="18" />
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Right Panel: Session History -->
          <div class="w-1/2 flex flex-col bg-muted/30">
            <div class="border-b bg-background p-4">
              <div class="flex items-center gap-2">
                <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
                <h2 class="font-semibold">Journey History</h2>
              </div>
              <p class="text-xs text-muted-foreground mt-1 ml-7">View and continue past journey maps</p>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              @if (loadingSessions() && service.sessions().length === 0) {
                <div class="space-y-3">
                  @for (i of [1, 2, 3, 4, 5]; track i) {
                    <div class="rounded-lg border border-border bg-card p-4 animate-pulse">
                      <div class="flex items-center justify-between mb-2">
                        <div class="h-5 w-20 bg-muted rounded"></div>
                        <div class="h-4 w-16 bg-muted rounded"></div>
                      </div>
                      <div class="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                  }
                </div>
              } @else if (service.sessions().length === 0) {
                <div class="flex flex-col items-center justify-center h-full text-center py-12">
                  <ng-icon name="lucideRoute" class="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 class="text-lg font-medium text-foreground mb-2">No journey maps yet</h3>
                  <p class="text-sm text-muted-foreground max-w-xs">
                    Start by describing a customer journey to get an AI-generated journey map.
                  </p>
                </div>
              } @else {
                <div class="space-y-3">
                  @for (session of service.sessions(); track session.id) {
                    <div
                      class="group rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                      (click)="viewSession(session)"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <span
                          class="text-xs font-medium px-2 py-0.5 rounded-full"
                          [class.bg-green-100]="session.status === 'completed'"
                          [class.text-green-700]="session.status === 'completed'"
                          [class.bg-yellow-100]="isProcessing(session.status)"
                          [class.text-yellow-700]="isProcessing(session.status)"
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

                      <p class="text-sm text-foreground line-clamp-2 mb-2">
                        {{ session.journeyDescription }}
                      </p>

                      <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <span>v{{ session.version }}</span>
                      </div>

                      <div class="flex items-center justify-between mt-3">
                        <div class="flex items-center gap-2">
                          @if (session.status === 'failed') {
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              (click)="retrySession(session, $event)"
                            >
                              <ng-icon name="lucideRotateCw" size="14" />
                              Retry
                            </button>
                          }
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            (click)="deleteSession(session, $event)"
                          >
                            <ng-icon name="lucideTrash2" size="14" />
                            Delete
                          </button>
                        </div>
                        <ng-icon name="lucideChevronRight" class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  }

                  @if (service.hasMore()) {
                    <div class="flex justify-center pt-2">
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
                        [disabled]="loadingSessions()"
                        (click)="loadMoreSessions()"
                      >
                        @if (loadingSessions()) {
                          <ng-icon name="lucideLoader2" size="16" class="animate-spin" />
                          Loading...
                        } @else {
                          Load More
                        }
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
})
export class JourneyMapperComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  service = inject(JourneyMapperService);

  modeCards = MODE_CARDS;
  selectedMode = signal<JourneyMode | null>('standard'); // Always use standard mode
  selectedFiles = signal<File[]>([]);
  selectedKnowledgeBases = signal<number[]>([]);
  selectedIdeationSession = signal<number | null>(null);
  selectedFeasibilitySession = signal<number | null>(null);
  selectedBusinessCaseSession = signal<number | null>(null);
  contextSources = signal<AvailableContextSources | null>(null);

  showContextSources = signal(false);
  kbDropdownOpen = signal(false);
  kbSearchFilter = signal('');
  loadingSessions = signal(false);

  form: FormGroup = this.fb.group({
    journeyDescription: ['', [Validators.required, Validators.minLength(5)]],
    competitorName: [''],
    personas: this.fb.array([]),
  });

  get personas(): FormArray {
    return this.form.get('personas') as FormArray;
  }

  filteredKnowledgeBases = computed(() => {
    const kbs = this.contextSources()?.knowledgeBases || [];
    const filter = this.kbSearchFilter().toLowerCase();
    if (!filter) return kbs;
    return kbs.filter(kb => kb.name.toLowerCase().includes(filter));
  });

  selectedContextCount = computed(() => {
    let count = this.selectedKnowledgeBases().length;
    if (this.selectedIdeationSession()) count++;
    if (this.selectedFeasibilitySession()) count++;
    if (this.selectedBusinessCaseSession()) count++;
    return count;
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  async loadInitialData(): Promise<void> {
    this.loadingSessions.set(true);
    try {
      await Promise.all([
        this.service.loadContextSources().then(sources => this.contextSources.set(sources)),
        this.service.loadSessions(true)
      ]);
    } finally {
      this.loadingSessions.set(false);
    }
  }

  selectMode(mode: JourneyMode): void {
    this.selectedMode.set(mode);
    if (mode === 'multi_persona') {
      this.personas.clear();
      this.addPersona();
      this.addPersona();
    }
  }

  clearMode(): void {
    this.selectedMode.set(null);
    this.form.reset();
    this.selectedFiles.set([]);
    this.selectedKnowledgeBases.set([]);
    this.selectedIdeationSession.set(null);
    this.selectedFeasibilitySession.set(null);
    this.selectedBusinessCaseSession.set(null);
    this.personas.clear();
  }

  getSelectedModeCard(): ModeCard | undefined {
    return this.modeCards.find((c) => c.mode === this.selectedMode());
  }

  addPersona(): void {
    if (this.personas.length < 5) {
      this.personas.push(
        this.fb.group({
          name: ['', Validators.required],
          description: [''],
        })
      );
    }
  }

  removePersona(index: number): void {
    if (this.personas.length > 2) {
      this.personas.removeAt(index);
    }
  }

  getPersonaControl(index: number, field: string): any {
    return (this.personas.at(index) as FormGroup).get(field);
  }

  // File handling
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
  }

  addFiles(files: File[]): void {
    const validExtensions = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.json'];
    const validFiles = files.filter((f) =>
      validExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    this.selectedFiles.update((current) => [...current, ...validFiles]);
  }

  removeFile(file: File): void {
    this.selectedFiles.update((current) => current.filter((f) => f !== file));
  }

  // Context sources
  toggleContextSources(): void {
    this.showContextSources.update(v => !v);
  }

  toggleDropdown(type: string): void {
    if (type === 'kb') {
      this.kbDropdownOpen.update(v => !v);
    }
  }

  closeAllDropdowns(): void {
    this.kbDropdownOpen.set(false);
  }

  toggleKnowledgeBase(kbId: number): void {
    this.selectedKnowledgeBases.update((current) => {
      if (current.includes(kbId)) {
        return current.filter((id) => id !== kbId);
      }
      return [...current, kbId];
    });
  }

  getKbName(kbId: number): string {
    const kb = this.contextSources()?.knowledgeBases?.find(k => k.id === kbId);
    return kb?.name || 'Unknown';
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  getSelectValue(event: Event): number | null {
    const value = (event.target as HTMLSelectElement).value;
    return value ? parseInt(value, 10) : null;
  }

  hasAnyContextSources(): boolean {
    const sources = this.contextSources();
    if (!sources) return false;
    return (sources.knowledgeBases?.length || 0) > 0 ||
      (sources.ideationSessions?.length || 0) > 0 ||
      (sources.feasibilitySessions?.length || 0) > 0 ||
      (sources.businessCaseSessions?.length || 0) > 0;
  }

  // Session history
  async loadMoreSessions(): Promise<void> {
    this.loadingSessions.set(true);
    try {
      await this.service.loadSessions(false);
    } finally {
      this.loadingSessions.set(false);
    }
  }

  isProcessing(status: string): boolean {
    return status === 'processing' || status === 'pending';
  }

  formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
    };
    return statusMap[status] || status;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
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

  viewSession(session: JourneyMapSession): void {
    if (session.status === 'completed') {
      this.router.navigate(['/journey-mapper/results', session.id]);
    } else if (session.status === 'processing' || session.status === 'pending') {
      this.router.navigate(['/journey-mapper/processing', session.id]);
    }
  }

  async retrySession(session: JourneyMapSession, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.service.retrySession(session.id);
      this.router.navigate(['/journey-mapper/processing', session.id]);
    } catch (err) {
      console.error('Failed to retry:', err);
    }
  }

  async deleteSession(session: JourneyMapSession, event: Event): Promise<void> {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this journey map?')) {
      await this.service.deleteSession(session.id);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    try {
      const session = await this.service.createSession({
        mode: 'standard',
        journeyDescription: this.form.get('journeyDescription')?.value,
        knowledgeBaseIds: this.selectedKnowledgeBases().length > 0 ? this.selectedKnowledgeBases() : undefined,
        ideationSessionId: this.selectedIdeationSession() || undefined,
        feasibilitySessionId: this.selectedFeasibilitySession() || undefined,
        businessCaseSessionId: this.selectedBusinessCaseSession() || undefined,
        files: this.selectedFiles().length > 0 ? this.selectedFiles() : undefined,
      });

      this.router.navigate(['/journey-mapper/processing', session.id]);
    } catch (err) {
      console.error('Failed to create journey session:', err);
    }
  }
}
