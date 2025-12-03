import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileText,
  lucideChevronRight,
  lucideChevronDown,
  lucideSearch,
  lucideCheck,
  lucideX,
  lucideUpload,
  lucideTrash2,
  lucideSparkles,
  lucideLoader2,
  lucideAlertCircle,
  lucideBookOpen,
  lucideUsers,
  lucideBuilding,
  lucideTarget,
  lucideUser,
} from '@ng-icons/lucide';
import { PrdGeneratorService } from './prd-generator.service';
import type {
  WizardStep,
  PrdTemplate,
  PrdGenerateRequest,
  KnowledgeBase,
} from './prd-generator.types';

// 50 common US industries (sorted A-Z)
const INDUSTRIES = [
  'Aerospace & Defense',
  'Aerospace Manufacturing',
  'Agriculture',
  'Artificial Intelligence',
  'Automotive',
  'Banking & Financial Services',
  'Biotechnology',
  'Chemicals',
  'Cloud Computing',
  'Construction',
  'Consumer Electronics',
  'Consumer Goods',
  'Cybersecurity',
  'E-Commerce',
  'Edtech',
  'Education',
  'Energy & Utilities',
  'Entertainment & Media',
  'Environmental Services',
  'Fashion & Apparel',
  'Fintech',
  'Food & Beverage',
  'Government & Public Sector',
  'Healthcare',
  'Healthtech',
  'Hospitality & Tourism',
  'Information Technology',
  'Insurance',
  'Legal Services',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Marketing & Advertising',
  'Medical Devices',
  'Mining & Metals',
  'Non-Profit',
  'Oil & Gas',
  'Pharmaceuticals',
  'Professional Services',
  'Proptech',
  'Real Estate',
  'Renewable Energy',
  'Retail',
  'Semiconductors',
  'Software & SaaS',
  'Sports & Recreation',
  'Telecommunications',
  'Transportation',
  'Venture Capital & Private Equity',
  'Wealth Management',
  'Wholesale & Distribution',
];

// Common business value metrics (sorted A-Z)
const PRIMARY_METRICS = [
  'Accelerate Time to Market',
  'Enhance Customer Satisfaction',
  'Enhance User Engagement',
  'Improve Customer Retention',
  'Improve Operational Efficiency',
  'Increase Market Share',
  'Increase Revenue',
  'Reduce Customer Acquisition Cost',
  'Reduce Operating Expenses',
  'Reduce Risk & Compliance Issues',
];

@Component({
  selector: 'app-prd-generator',
  standalone: true,
  imports: [FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideFileText,
      lucideChevronRight,
      lucideChevronDown,
      lucideSearch,
      lucideCheck,
      lucideX,
      lucideUpload,
      lucideTrash2,
      lucideSparkles,
      lucideLoader2,
      lucideAlertCircle,
      lucideBookOpen,
      lucideUsers,
      lucideBuilding,
      lucideTarget,
      lucideUser,
    }),
  ],
  template: `
    <div class="min-h-screen bg-background p-6">
      <div class="mx-auto max-w-4xl">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-foreground">PRD Generator</h1>
          <p class="text-muted-foreground">
            Generate professional Product Requirements Documents with AI
          </p>
        </div>

        <!-- Progress Steps -->
        <div class="mb-8">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
              [class]="currentStep() === 'input' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            >
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-background/20 text-xs">1</span>
              Input
            </div>
            <ng-icon name="lucideChevronRight" class="h-4 w-4 text-muted-foreground" />
            <div
              class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
              [class]="currentStep() === 'template' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            >
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-background/20 text-xs">2</span>
              Template
            </div>
            <ng-icon name="lucideChevronRight" class="h-4 w-4 text-muted-foreground" />
            <div
              class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
              [class]="currentStep() === 'generating' || currentStep() === 'output' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            >
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-background/20 text-xs">3</span>
              Generate
            </div>
          </div>
        </div>

        <!-- Step Content -->
        @switch (currentStep()) {
          @case ('input') {
            <div class="space-y-6">
              <!-- Business Requirements Text Area -->
              <div class="rounded-lg border border-border bg-card p-6">
                <label class="mb-2 block text-sm font-medium text-foreground">
                  Business Requirements <span class="text-destructive">*</span>
                </label>
                <textarea
                  [(ngModel)]="concept"
                  placeholder="Enter your business requirements, problem statements, or describe the desired outcomes..."
                  rows="4"
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                ></textarea>
              </div>

              <!-- Project Context -->
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="mb-4 text-sm font-medium text-foreground">Project Context (Optional)</h3>
                <div class="grid gap-4 md:grid-cols-2">
                  <!-- Target Project/Team -->
                  <div>
                    <label class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <ng-icon name="lucideUsers" class="h-4 w-4" />
                      Target Project/Team
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="targetProject"
                      placeholder="e.g., Mobile App Team"
                      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <!-- Target Persona -->
                  <div>
                    <label class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <ng-icon name="lucideUser" class="h-4 w-4" />
                      Target Persona
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="targetPersona"
                      placeholder="e.g., Enterprise Admin"
                      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <!-- Industry Context -->
                  <div class="relative">
                    <label class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <ng-icon name="lucideBuilding" class="h-4 w-4" />
                      Industry Context
                    </label>
                    <button
                      (click)="toggleIndustryDropdown()"
                      class="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span [class]="industryContext ? 'text-foreground' : 'text-muted-foreground'">
                        {{ industryContext || 'Select industry...' }}
                      </span>
                      <ng-icon
                        name="lucideChevronDown"
                        class="h-4 w-4 text-muted-foreground transition-transform"
                        [class.rotate-180]="industryDropdownOpen()"
                      />
                    </button>
                    @if (industryDropdownOpen()) {
                      <div class="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover shadow-lg">
                        <div class="border-b border-border p-2">
                          <div class="relative">
                            <ng-icon
                              name="lucideSearch"
                              class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                              type="text"
                              [ngModel]="industrySearchFilter()"
                              (ngModelChange)="onIndustrySearchInput($event)"
                              placeholder="Search industries..."
                              class="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                        </div>
                        <div class="max-h-48 overflow-y-auto p-1">
                          @for (industry of filteredIndustries(); track industry) {
                            <button
                              (click)="selectIndustry(industry)"
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                              [class.bg-accent]="industryContext === industry"
                            >
                              {{ industry }}
                            </button>
                          } @empty {
                            <div class="px-2 py-4 text-center text-sm text-muted-foreground">
                              No industries found
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Primary Metric -->
                  <div class="relative">
                    <label class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <ng-icon name="lucideTarget" class="h-4 w-4" />
                      Primary Metric
                    </label>
                    <button
                      (click)="toggleMetricDropdown()"
                      class="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span [class]="primaryMetric ? 'text-foreground' : 'text-muted-foreground'">
                        {{ primaryMetric || 'Select primary metric...' }}
                      </span>
                      <ng-icon
                        name="lucideChevronDown"
                        class="h-4 w-4 text-muted-foreground transition-transform"
                        [class.rotate-180]="metricDropdownOpen()"
                      />
                    </button>
                    @if (metricDropdownOpen()) {
                      <div class="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover shadow-lg">
                        <div class="border-b border-border p-2">
                          <div class="relative">
                            <ng-icon
                              name="lucideSearch"
                              class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                              type="text"
                              [ngModel]="metricSearchFilter()"
                              (ngModelChange)="onMetricSearchInput($event)"
                              placeholder="Search metrics..."
                              class="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                        </div>
                        <div class="max-h-48 overflow-y-auto p-1">
                          @for (metric of filteredMetrics(); track metric) {
                            <button
                              (click)="selectMetric(metric)"
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                              [class.bg-accent]="primaryMetric === metric"
                            >
                              {{ metric }}
                            </button>
                          } @empty {
                            <div class="px-2 py-4 text-center text-sm text-muted-foreground">
                              No metrics found
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- User Story Generator (Optional) -->
              <div class="rounded-lg border border-border bg-card p-6">
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="text-sm font-medium text-foreground">User Story Generator (Optional)</h3>
                  <button
                    (click)="toggleUserStory()"
                    class="text-sm text-primary hover:underline"
                  >
                    {{ showUserStory() ? 'Hide' : 'Add User Story' }}
                  </button>
                </div>
                @if (showUserStory()) {
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <span class="w-16 text-sm font-medium text-muted-foreground">As a</span>
                      <input
                        type="text"
                        [(ngModel)]="userStoryRole"
                        placeholder="type of user"
                        class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-16 text-sm font-medium text-muted-foreground">I want</span>
                      <input
                        type="text"
                        [(ngModel)]="userStoryGoal"
                        placeholder="goal or action"
                        class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-16 text-sm font-medium text-muted-foreground">So that</span>
                      <input
                        type="text"
                        [(ngModel)]="userStoryBenefit"
                        placeholder="benefit or outcome"
                        class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                }
              </div>

              <!-- Knowledge Bases -->
              <div class="rounded-lg border border-border bg-card p-6">
                <label class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <ng-icon name="lucideBookOpen" class="h-4 w-4" />
                  Knowledge Bases
                </label>
                <div class="relative">
                  <button
                    (click)="toggleKbDropdown()"
                    class="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span class="text-muted-foreground">
                      @if (selectedKnowledgeBases().length === 0) {
                        Select knowledge bases...
                      } @else {
                        {{ selectedKnowledgeBases().length }} selected
                      }
                    </span>
                    <ng-icon
                      name="lucideChevronDown"
                      class="h-4 w-4 text-muted-foreground transition-transform"
                      [class.rotate-180]="kbDropdownOpen()"
                    />
                  </button>

                  @if (kbDropdownOpen()) {
                    <div class="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-popover shadow-lg">
                      <!-- Search -->
                      <div class="border-b border-border p-2">
                        <div class="relative">
                          <ng-icon
                            name="lucideSearch"
                            class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            type="text"
                            [ngModel]="kbSearchFilter()"
                            (ngModelChange)="onKbSearchInput($event)"
                            placeholder="Search knowledge bases..."
                            class="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                      <!-- Options -->
                      <div class="max-h-48 overflow-y-auto p-1">
                        @for (kb of filteredKnowledgeBases(); track kb.id) {
                          <button
                            (click)="toggleKnowledgeBase(kb.id)"
                            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <div
                              class="flex h-4 w-4 items-center justify-center rounded border"
                              [class]="selectedKbIds().has(kb.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                            >
                              @if (selectedKbIds().has(kb.id)) {
                                <ng-icon name="lucideCheck" class="h-3 w-3" />
                              }
                            </div>
                            <span>{{ kb.name }}</span>
                            <span class="ml-auto text-xs text-muted-foreground">
                              {{ kb.documentCount }} docs
                            </span>
                          </button>
                        } @empty {
                          <div class="px-2 py-4 text-center text-sm text-muted-foreground">
                            No knowledge bases found
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- Selected KB tags -->
                @if (selectedKnowledgeBases().length > 0) {
                  <div class="mt-2 flex flex-wrap gap-2">
                    @for (kb of selectedKnowledgeBases(); track kb.id) {
                      <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                        {{ kb.name }}
                        <button
                          (click)="toggleKnowledgeBase(kb.id)"
                          class="hover:text-primary/80"
                        >
                          <ng-icon name="lucideX" class="h-3 w-3" />
                        </button>
                      </span>
                    }
                  </div>
                }
              </div>

              <!-- File Upload -->
              <div class="rounded-lg border border-border bg-card p-6">
                <label class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <ng-icon name="lucideUpload" class="h-4 w-4" />
                  Attachments (Optional)
                </label>
                <div
                  class="rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50"
                  (dragover)="onDragOver($event)"
                  (drop)="onDrop($event)"
                >
                  <input
                    type="file"
                    #fileInput
                    (change)="onFileSelect($event)"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.md"
                    class="hidden"
                  />
                  <button
                    (click)="fileInput.click()"
                    class="text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ng-icon name="lucideUpload" class="mx-auto mb-2 h-8 w-8" />
                    <p>Click to upload or drag and drop</p>
                    <p class="text-xs">Images, PDFs, Word docs (max 20MB)</p>
                  </button>
                </div>

                @if (uploadedFiles().length > 0) {
                  <div class="mt-4 space-y-2">
                    @for (file of uploadedFiles(); track file.name) {
                      <div class="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                        <span class="text-sm">{{ file.name }}</span>
                        <button
                          (click)="removeFile(file)"
                          class="text-muted-foreground hover:text-destructive"
                        >
                          <ng-icon name="lucideTrash2" class="h-4 w-4" />
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Next Button -->
              <div class="flex justify-end">
                <button
                  (click)="goToTemplateStep()"
                  [disabled]="!concept.trim()"
                  class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next: Select Template
                  <ng-icon name="lucideChevronRight" class="h-4 w-4" />
                </button>
              </div>
            </div>
          }

          @case ('template') {
            <div class="space-y-6">
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="mb-4 text-lg font-medium text-foreground">Select a Template</h3>
                <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  @for (template of service.templates(); track template.id) {
                    <button
                      (click)="selectTemplate(template)"
                      class="rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50"
                      [class]="selectedTemplate()?.id === template.id ? 'border-primary bg-primary/5' : 'border-border'"
                    >
                      <div class="mb-2 flex items-center gap-2">
                        <ng-icon name="lucideFileText" class="h-5 w-5 text-primary" />
                        <span class="font-medium">{{ template.name }}</span>
                        @if (template.isDefault) {
                          <span class="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Default</span>
                        }
                      </div>
                      <p class="text-sm text-muted-foreground">{{ template.description }}</p>
                    </button>
                  }

                  <!-- Upload Custom Template -->
                  <button
                    class="rounded-lg border-2 border-dashed border-border p-4 text-left transition-all hover:border-primary/50"
                  >
                    <div class="mb-2 flex items-center gap-2">
                      <ng-icon name="lucideUpload" class="h-5 w-5 text-muted-foreground" />
                      <span class="font-medium text-muted-foreground">Upload Custom</span>
                    </div>
                    <p class="text-sm text-muted-foreground">Use your own template</p>
                  </button>
                </div>
              </div>

              <!-- Navigation Buttons -->
              <div class="flex justify-between">
                <button
                  (click)="goToInputStep()"
                  class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-2 text-sm font-medium hover:bg-accent"
                >
                  Back
                </button>
                <button
                  (click)="generatePrd()"
                  [disabled]="!selectedTemplate()"
                  class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ng-icon name="lucideSparkles" class="h-4 w-4" />
                  Generate PRD
                </button>
              </div>
            </div>
          }

          @case ('generating') {
            <div class="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12">
              <ng-icon name="lucideLoader2" class="h-12 w-12 animate-spin text-primary" />
              <h3 class="mt-4 text-lg font-medium text-foreground">Generating your PRD...</h3>
              <p class="text-muted-foreground">This may take a moment</p>
            </div>
          }

          @case ('output') {
            <!-- Error State -->
            @if (service.error()) {
              <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
                <div class="flex items-start gap-3">
                  <ng-icon name="lucideAlertCircle" class="h-5 w-5 text-destructive" />
                  <div>
                    <h3 class="font-medium text-destructive">Generation Failed</h3>
                    <p class="text-sm text-destructive/80">{{ service.error() }}</p>
                    <button
                      (click)="retryGeneration()"
                      class="mt-4 inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            } @else if (service.currentPrd()) {
              <!-- Success - Redirect to output page -->
              <div class="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12">
                <ng-icon name="lucideCheck" class="h-12 w-12 text-green-500" />
                <h3 class="mt-4 text-lg font-medium text-foreground">PRD Generated Successfully!</h3>
                <p class="text-muted-foreground">Redirecting to your PRD...</p>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class PrdGeneratorComponent implements OnInit {
  protected service = inject(PrdGeneratorService);
  private router = inject(Router);

  // Static data
  protected readonly industries = INDUSTRIES;
  protected readonly metrics = PRIMARY_METRICS;

  // Wizard state
  protected currentStep = signal<WizardStep>('input');

  // Form fields
  protected concept = '';
  protected targetProject = '';
  protected targetPersona = '';
  protected industryContext = '';
  protected primaryMetric = '';
  protected userStoryRole = '';
  protected userStoryGoal = '';
  protected userStoryBenefit = '';
  protected showUserStory = signal(false);
  protected uploadedFiles = signal<File[]>([]);
  protected selectedTemplate = signal<PrdTemplate | null>(null);

  // Knowledge base dropdown
  protected kbDropdownOpen = signal(false);
  protected kbSearchFilter = signal('');
  protected selectedKbIds = signal<Set<number>>(new Set());

  // Industry dropdown
  protected industryDropdownOpen = signal(false);
  protected industrySearchFilter = signal('');

  // Metric dropdown
  protected metricDropdownOpen = signal(false);
  protected metricSearchFilter = signal('');

  // Computed
  protected filteredKnowledgeBases = computed(() => {
    const filter = this.kbSearchFilter().toLowerCase().trim();
    const kbs = this.service.knowledgeBases();
    if (!filter) return kbs;
    return kbs.filter(kb => kb.name.toLowerCase().includes(filter));
  });

  protected selectedKnowledgeBases = computed(() => {
    const ids = this.selectedKbIds();
    return this.service.knowledgeBases().filter(kb => ids.has(kb.id));
  });

  protected filteredIndustries = computed(() => {
    const filter = this.industrySearchFilter().toLowerCase().trim();
    if (!filter) return this.industries;
    return this.industries.filter(i => i.toLowerCase().includes(filter));
  });

  protected filteredMetrics = computed(() => {
    const filter = this.metricSearchFilter().toLowerCase().trim();
    if (!filter) return this.metrics;
    return this.metrics.filter(m => m.toLowerCase().includes(filter));
  });

  protected canProceedToTemplate = computed(() => {
    return this.concept.trim().length > 0;
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.service.loadTemplates(),
      this.service.loadKnowledgeBases(),
    ]);

    // Set default template
    const defaultTemplate = this.service.defaultTemplate();
    if (defaultTemplate) {
      this.selectedTemplate.set(defaultTemplate);
    }
  }

  // User story toggle
  toggleUserStory(): void {
    this.showUserStory.update(v => !v);
  }

  // Knowledge base dropdown methods
  toggleKbDropdown(): void {
    this.kbDropdownOpen.update(v => !v);
  }

  closeKbDropdown(): void {
    this.kbDropdownOpen.set(false);
  }

  onKbSearchInput(value: string): void {
    this.kbSearchFilter.set(value);
  }

  toggleKnowledgeBase(id: number): void {
    this.selectedKbIds.update(ids => {
      const newIds = new Set(ids);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return newIds;
    });
  }

  // Industry dropdown methods
  toggleIndustryDropdown(): void {
    this.industryDropdownOpen.update(v => !v);
    // Close other dropdowns
    this.metricDropdownOpen.set(false);
    this.kbDropdownOpen.set(false);
  }

  onIndustrySearchInput(value: string): void {
    this.industrySearchFilter.set(value);
  }

  selectIndustry(industry: string): void {
    this.industryContext = industry;
    this.industryDropdownOpen.set(false);
    this.industrySearchFilter.set('');
  }

  // Metric dropdown methods
  toggleMetricDropdown(): void {
    this.metricDropdownOpen.update(v => !v);
    // Close other dropdowns
    this.industryDropdownOpen.set(false);
    this.kbDropdownOpen.set(false);
  }

  onMetricSearchInput(value: string): void {
    this.metricSearchFilter.set(value);
  }

  selectMetric(metric: string): void {
    this.primaryMetric = metric;
    this.metricDropdownOpen.set(false);
    this.metricSearchFilter.set('');
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

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
  }

  private addFiles(newFiles: File[]): void {
    this.uploadedFiles.update(files => [...files, ...newFiles]);
  }

  removeFile(file: File): void {
    this.uploadedFiles.update(files => files.filter(f => f !== file));
  }

  // Template selection
  selectTemplate(template: PrdTemplate): void {
    this.selectedTemplate.set(template);
  }

  // Navigation
  goToInputStep(): void {
    this.currentStep.set('input');
  }

  goToTemplateStep(): void {
    if (this.canProceedToTemplate()) {
      this.currentStep.set('template');
    }
  }

  // Generation
  async generatePrd(): Promise<void> {
    const template = this.selectedTemplate();
    if (!template) return;

    this.currentStep.set('generating');

    const request: PrdGenerateRequest = {
      concept: this.concept.trim(),
      targetProject: this.targetProject.trim() || undefined,
      targetPersona: this.targetPersona.trim() || undefined,
      industryContext: this.industryContext.trim() || undefined,
      primaryMetric: this.primaryMetric.trim() || undefined,
      userStoryRole: this.showUserStory() ? this.userStoryRole.trim() || undefined : undefined,
      userStoryGoal: this.showUserStory() ? this.userStoryGoal.trim() || undefined : undefined,
      userStoryBenefit: this.showUserStory() ? this.userStoryBenefit.trim() || undefined : undefined,
      knowledgeBaseIds: Array.from(this.selectedKbIds()),
      files: this.uploadedFiles(),
      templateId: template.id,
    };

    const prd = await this.service.generate(request);

    this.currentStep.set('output');

    if (prd) {
      // Navigate to output page
      setTimeout(() => {
        this.router.navigate(['/prd-generator/output', prd.id]);
      }, 1500);
    }
  }

  retryGeneration(): void {
    this.service.clearError();
    this.generatePrd();
  }
}
