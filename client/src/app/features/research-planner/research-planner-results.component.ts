/**
 * Research Planner Results Component
 *
 * Shows recommended methods, allows selection, and displays generated instruments.
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideChevronDown,
  lucideChevronUp,
  lucideDownload,
  lucideEdit2,
  lucideUsers,
  lucideClipboardList,
  lucideMessageSquare,
  lucideBarChart2,
  lucideTarget,
  lucideRefreshCw,
  lucideCheck,
  lucideX,
  lucideDatabase,
  lucideLightbulb,
  lucideInfo,
} from '@ng-icons/lucide';

import { ResearchPlannerService } from './research-planner.service';
import {
  SessionDetail,
  RecommendedMethod,
  InterviewGuide,
  Survey,
  RecruitingPlan,
  InterviewGuideConfig,
  SurveyConfig,
  RecruitingConfig,
} from './research-planner.types';

@Component({
  selector: 'app-research-planner-results',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideChevronDown,
      lucideChevronUp,
      lucideDownload,
      lucideEdit2,
      lucideUsers,
      lucideClipboardList,
      lucideMessageSquare,
      lucideBarChart2,
      lucideTarget,
      lucideRefreshCw,
      lucideCheck,
      lucideX,
      lucideDatabase,
      lucideLightbulb,
      lucideInfo,
    }),
  ],
  template: `
    <div class="container mx-auto max-w-5xl px-4 py-8">
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <ng-icon name="lucideLoader2" size="32" class="animate-spin text-primary" />
        </div>
      } @else if (error()) {
        <div
          class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive"
        >
          <ng-icon name="lucideAlertCircle" size="24" class="mx-auto mb-2" />
          <p>{{ error() }}</p>
          <button (click)="loadSession()" class="mt-4 text-sm underline hover:no-underline">
            Try again
          </button>
        </div>
      } @else if (sessionDetail()) {
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-foreground">Research Plan</h1>
          <p class="mt-2 text-muted-foreground">{{ sessionDetail()!.session.objective }}</p>
        </div>

        <!-- Context Sources Used (if any) -->
        @if (hasContextSources()) {
          <div class="mb-6 rounded-lg border border-border bg-muted/30 p-4">
            <div class="flex items-center gap-2 mb-3">
              <ng-icon name="lucideInfo" size="16" class="text-primary" />
              <span class="text-sm font-medium text-foreground">Context Sources Used</span>
            </div>
            <div class="flex flex-wrap gap-2">
              @if (sessionDetail()!.session.contextSummary?.knowledgeBases?.length) {
                @for (kb of sessionDetail()!.session.contextSummary!.knowledgeBases; track kb.id) {
                  <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <ng-icon name="lucideDatabase" size="12" />
                    {{ kb.name }} ({{ kb.chunksUsed }} chunks)
                  </span>
                }
              }
              @if (sessionDetail()!.session.contextSummary?.ideation) {
                <span class="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300">
                  <ng-icon name="lucideLightbulb" size="12" />
                  Ideation ({{ sessionDetail()!.session.contextSummary!.ideation!.ideaCount }} ideas)
                </span>
              }
              @if (sessionDetail()!.session.contextSummary?.feasibility) {
                <span class="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                  <ng-icon name="lucideCheckCircle" size="12" />
                  Feasibility ({{ sessionDetail()!.session.contextSummary!.feasibility!.goDecision || 'analyzed' }})
                </span>
              }
              @if (sessionDetail()!.session.contextSummary?.businessCase) {
                <span class="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300">
                  <ng-icon name="lucideBarChart2" size="12" />
                  Business Case ({{ sessionDetail()!.session.contextSummary!.businessCase!.recommendation || 'analyzed' }})
                </span>
              }
            </div>
          </div>
        }

        <!-- Step Indicator -->
        <div class="mb-8 flex items-center gap-4 rounded-lg border border-border bg-card p-4">
          <div
            [class]="currentStep() >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
          >
            @if (currentStep() > 1) {
              <ng-icon name="lucideCheck" size="16" />
            } @else {
              1
            }
          </div>
          <span [class]="currentStep() >= 1 ? 'text-foreground' : 'text-muted-foreground'" class="text-sm font-medium">
            Select Methods
          </span>
          <div class="h-0.5 flex-1 bg-muted"></div>
          <div
            [class]="currentStep() >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
          >
            @if (currentStep() > 2) {
              <ng-icon name="lucideCheck" size="16" />
            } @else {
              2
            }
          </div>
          <span [class]="currentStep() >= 2 ? 'text-foreground' : 'text-muted-foreground'" class="text-sm font-medium">
            Configure Instruments
          </span>
          <div class="h-0.5 flex-1 bg-muted"></div>
          <div
            [class]="currentStep() >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
          >
            3
          </div>
          <span [class]="currentStep() >= 3 ? 'text-foreground' : 'text-muted-foreground'" class="text-sm font-medium">
            View Results
          </span>
        </div>

        <!-- Step 1: Method Selection -->
        @if (currentStep() === 1) {
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-foreground">Recommended Research Methods</h2>
            <p class="text-sm text-muted-foreground">
              Select the methods you want to use for your research. We'll generate the appropriate
              instruments for each.
            </p>

            <!-- Method Cards -->
            <div class="grid gap-4 md:grid-cols-2">
              @for (method of sessionDetail()!.recommendedMethods; track method.id) {
                <div
                  (click)="toggleMethodSelection(method.methodName)"
                  [class]="selectedMethods().includes(method.methodName) ? 'border-primary ring-1 ring-primary' : 'border-border'"
                  class="cursor-pointer rounded-lg border bg-card p-4 transition-all hover:border-primary/50"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <div
                        [class]="selectedMethods().includes(method.methodName) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                        class="flex h-10 w-10 items-center justify-center rounded-lg"
                      >
                        <ng-icon [name]="getMethodIcon(method.methodName)" size="20" />
                      </div>
                      <div>
                        <h3 class="font-medium text-foreground">{{ method.methodLabel }}</h3>
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            [class]="getEffortClass(method.effort)"
                            class="rounded px-1.5 py-0.5"
                          >
                            {{ method.effort }} effort
                          </span>
                          <span>{{ method.timeline }}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      [class]="selectedMethods().includes(method.methodName) ? 'bg-primary text-primary-foreground' : 'border-2 border-muted'"
                      class="flex h-5 w-5 items-center justify-center rounded"
                    >
                      @if (selectedMethods().includes(method.methodName)) {
                        <ng-icon name="lucideCheck" size="14" />
                      }
                    </div>
                  </div>

                  <p class="mt-3 text-sm text-muted-foreground">{{ method.rationale }}</p>

                  <div class="mt-3 flex items-center justify-between text-xs">
                    <span class="text-muted-foreground">{{ method.participantCount }}</span>
                    <span class="text-muted-foreground">{{ method.costEstimate }}</span>
                    <div class="flex items-center gap-1">
                      <div
                        class="h-1.5 w-12 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          [style.width.%]="method.confidenceScore * 100"
                          class="h-full bg-primary"
                        ></div>
                      </div>
                      <span class="text-muted-foreground">
                        {{ (method.confidenceScore * 100).toFixed(0) }}%
                      </span>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Continue Button -->
            <div class="flex justify-end pt-4">
              <button
                (click)="proceedToConfiguration()"
                [disabled]="selectedMethods().length === 0"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Configure Instruments
                <ng-icon name="lucideChevronDown" size="16" class="-rotate-90" />
              </button>
            </div>
          </div>
        }

        <!-- Step 2: Configuration -->
        @if (currentStep() === 2) {
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-foreground">Configure Research Instruments</h2>
                <p class="text-sm text-muted-foreground">
                  Customize the instruments for your selected methods.
                </p>
              </div>
              <button
                (click)="currentStep.set(1)"
                class="text-sm text-primary hover:underline"
              >
                Back to method selection
              </button>
            </div>

            <!-- Interview Guide Config -->
            @if (selectedMethods().includes('user_interviews')) {
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="mb-4 flex items-center gap-2 font-medium text-foreground">
                  <ng-icon name="lucideMessageSquare" size="20" />
                  Interview Guide Configuration
                </h3>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="block text-sm font-medium text-foreground">Participant Type</label>
                    <input
                      type="text"
                      [(ngModel)]="interviewConfig.participantType"
                      placeholder="e.g., Enterprise customers"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-foreground">Duration (minutes)</label>
                    <select
                      [(ngModel)]="interviewConfig.durationMinutes"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option [value]="30">30 minutes</option>
                      <option [value]="45">45 minutes</option>
                      <option [value]="60">60 minutes</option>
                    </select>
                  </div>
                  <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-foreground">Focus Areas (optional)</label>
                    <input
                      type="text"
                      [(ngModel)]="interviewConfig.focusAreasText"
                      placeholder="e.g., Onboarding experience, Pain points, Feature requests"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p class="mt-1 text-xs text-muted-foreground">Comma-separated list</p>
                  </div>
                </div>
              </div>
            }

            <!-- Survey Config -->
            @if (selectedMethods().includes('surveys')) {
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="mb-4 flex items-center gap-2 font-medium text-foreground">
                  <ng-icon name="lucideClipboardList" size="20" />
                  Survey Configuration
                </h3>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="block text-sm font-medium text-foreground">Target Audience</label>
                    <input
                      type="text"
                      [(ngModel)]="surveyConfig.targetAudience"
                      placeholder="e.g., Current customers"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-foreground">Survey Length</label>
                    <select
                      [(ngModel)]="surveyConfig.surveyLength"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="short">Short (5-10 questions)</option>
                      <option value="medium">Medium (10-20 questions)</option>
                      <option value="long">Long (20+ questions)</option>
                    </select>
                  </div>
                </div>
              </div>
            }

            <!-- Recruiting Config -->
            <div class="rounded-lg border border-border bg-card p-6">
              <h3 class="mb-4 flex items-center gap-2 font-medium text-foreground">
                <ng-icon name="lucideUsers" size="20" />
                Recruiting Plan Configuration
              </h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-foreground">Participant Role</label>
                  <input
                    type="text"
                    [(ngModel)]="recruitingConfig.role"
                    placeholder="e.g., Product Manager"
                    class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-foreground">Company Size</label>
                  <input
                    type="text"
                    [(ngModel)]="recruitingConfig.companySize"
                    placeholder="e.g., 200+ employees"
                    class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-foreground">Participants Needed</label>
                  <input
                    type="number"
                    [(ngModel)]="recruitingConfig.participantCount"
                    min="1"
                    class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <!-- Generate Button -->
            <div class="flex justify-end gap-4 pt-4">
              <button
                (click)="currentStep.set(1)"
                class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Back
              </button>
              <button
                (click)="generateInstruments()"
                [disabled]="isGenerating()"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                @if (isGenerating()) {
                  <ng-icon name="lucideLoader2" size="16" class="animate-spin" />
                  Generating...
                } @else {
                  Generate Instruments
                }
              </button>
            </div>
          </div>
        }

        <!-- Step 3: Results -->
        @if (currentStep() === 3) {
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-foreground">Your Research Instruments</h2>
                <p class="text-sm text-muted-foreground">
                  Review and edit your generated instruments.
                </p>
              </div>
            </div>

            <!-- Tabs -->
            <div class="border-b border-border">
              <div class="flex gap-4">
                @if (sessionDetail()!.interviewGuides.length > 0) {
                  <button
                    (click)="activeTab.set('interview')"
                    [class]="activeTab() === 'interview' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                    class="border-b-2 px-4 py-2 text-sm font-medium"
                  >
                    Interview Guide
                  </button>
                }
                @if (sessionDetail()!.surveys.length > 0) {
                  <button
                    (click)="activeTab.set('survey')"
                    [class]="activeTab() === 'survey' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                    class="border-b-2 px-4 py-2 text-sm font-medium"
                  >
                    Survey
                  </button>
                }
                @if (sessionDetail()!.recruitingPlans.length > 0) {
                  <button
                    (click)="activeTab.set('recruiting')"
                    [class]="activeTab() === 'recruiting' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                    class="border-b-2 px-4 py-2 text-sm font-medium"
                  >
                    Recruiting Plan
                  </button>
                }
              </div>
            </div>

            <!-- Interview Guide Tab -->
            @if (activeTab() === 'interview' && sessionDetail()!.interviewGuides[0]) {
              <div class="rounded-lg border border-border bg-card">
                <div class="flex items-center justify-between border-b border-border p-4">
                  <h3 class="font-medium text-foreground">Interview Guide</h3>
                  <div class="flex gap-2">
                    <button
                      (click)="downloadMarkdown(sessionDetail()!.interviewGuides[0])"
                      class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <ng-icon name="lucideDownload" size="14" />
                      Download
                    </button>
                  </div>
                </div>
                <div class="p-4">
                  <div class="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                    {{ getGuideContent(sessionDetail()!.interviewGuides[0]) }}
                  </div>
                </div>
              </div>
            }

            <!-- Survey Tab -->
            @if (activeTab() === 'survey' && sessionDetail()!.surveys[0]) {
              <div class="rounded-lg border border-border bg-card">
                <div class="flex items-center justify-between border-b border-border p-4">
                  <h3 class="font-medium text-foreground">Survey Questions</h3>
                  <span class="text-sm text-muted-foreground">
                    {{ sessionDetail()!.surveys[0].estimatedCompletionTime }}
                  </span>
                </div>
                <div class="divide-y divide-border">
                  @for (question of sessionDetail()!.surveys[0].questions; track question.questionId; let i = $index) {
                    <div class="p-4">
                      <div class="flex items-start gap-3">
                        <span class="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {{ i + 1 }}
                        </span>
                        <div class="flex-1">
                          <p class="font-medium text-foreground">{{ question.text }}</p>
                          <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span class="rounded bg-muted px-1.5 py-0.5">{{ question.type }}</span>
                            @if (question.required) {
                              <span class="text-destructive">Required</span>
                            }
                          </div>
                          @if (question.options && question.options.length > 0) {
                            <ul class="mt-2 space-y-1 text-sm text-muted-foreground">
                              @for (option of question.options; track option) {
                                <li class="flex items-center gap-2">
                                  <span class="h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>
                                  {{ option }}
                                </li>
                              }
                            </ul>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
                @if (sessionDetail()!.surveys[0].analysisPlan) {
                  <div class="border-t border-border p-4">
                    <h4 class="mb-2 text-sm font-medium text-foreground">Analysis Plan</h4>
                    <p class="text-sm text-muted-foreground">{{ sessionDetail()!.surveys[0].analysisPlan }}</p>
                  </div>
                }
              </div>
            }

            <!-- Recruiting Tab -->
            @if (activeTab() === 'recruiting' && sessionDetail()!.recruitingPlans[0]) {
              <div class="space-y-4">
                <!-- Criteria -->
                <div class="rounded-lg border border-border bg-card p-4">
                  <h4 class="mb-3 font-medium text-foreground">Participant Criteria</h4>
                  @if (sessionDetail()!.recruitingPlans[0].detailedCriteria) {
                    <div class="space-y-2 text-sm">
                      @if (sessionDetail()!.recruitingPlans[0].detailedCriteria!.mustHave?.length) {
                        <div>
                          <span class="font-medium text-foreground">Must have:</span>
                          <ul class="mt-1 list-inside list-disc text-muted-foreground">
                            @for (item of sessionDetail()!.recruitingPlans[0].detailedCriteria!.mustHave; track item) {
                              <li>{{ item }}</li>
                            }
                          </ul>
                        </div>
                      }
                      @if (sessionDetail()!.recruitingPlans[0].detailedCriteria!.niceToHave?.length) {
                        <div>
                          <span class="font-medium text-foreground">Nice to have:</span>
                          <ul class="mt-1 list-inside list-disc text-muted-foreground">
                            @for (item of sessionDetail()!.recruitingPlans[0].detailedCriteria!.niceToHave; track item) {
                              <li>{{ item }}</li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Screener Questions -->
                @if (sessionDetail()!.recruitingPlans[0].screenerQuestions?.length) {
                  <div class="rounded-lg border border-border bg-card p-4">
                    <h4 class="mb-3 font-medium text-foreground">Screener Questions</h4>
                    <div class="space-y-3">
                      @for (q of sessionDetail()!.recruitingPlans[0].screenerQuestions; track q.question; let i = $index) {
                        <div class="text-sm">
                          <p class="font-medium text-foreground">{{ i + 1 }}. {{ q.question }}</p>
                          <p class="mt-1 text-muted-foreground">
                            Qualifying answer: <span class="text-green-600">{{ q.qualifyingAnswer }}</span>
                          </p>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Stats -->
                <div class="grid gap-4 sm:grid-cols-3">
                  <div class="rounded-lg border border-border bg-card p-4 text-center">
                    <p class="text-2xl font-bold text-foreground">{{ sessionDetail()!.recruitingPlans[0].contactsNeeded }}</p>
                    <p class="text-sm text-muted-foreground">Contacts Needed</p>
                  </div>
                  <div class="rounded-lg border border-border bg-card p-4 text-center">
                    <p class="text-2xl font-bold text-foreground">{{ (sessionDetail()!.recruitingPlans[0].expectedResponseRate * 100).toFixed(0) }}%</p>
                    <p class="text-sm text-muted-foreground">Expected Response Rate</p>
                  </div>
                  <div class="rounded-lg border border-border bg-card p-4 text-center">
                    <p class="text-lg font-bold text-foreground">{{ sessionDetail()!.recruitingPlans[0].incentiveRecommendation }}</p>
                    <p class="text-sm text-muted-foreground">Recommended Incentive</p>
                  </div>
                </div>

                <!-- Email Templates -->
                @if (sessionDetail()!.recruitingPlans[0].emailTemplates?.length) {
                  <div class="rounded-lg border border-border bg-card p-4">
                    <h4 class="mb-3 font-medium text-foreground">Email Templates</h4>
                    @for (template of sessionDetail()!.recruitingPlans[0].emailTemplates; track template.type) {
                      <div class="rounded-md bg-muted/50 p-3">
                        <p class="text-xs font-medium uppercase text-muted-foreground">{{ template.type }}</p>
                        <p class="mt-1 font-medium text-foreground">{{ template.subject }}</p>
                        <p class="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{{ template.body }}</p>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- No Instruments Yet -->
            @if (sessionDetail()!.interviewGuides.length === 0 && sessionDetail()!.surveys.length === 0 && sessionDetail()!.recruitingPlans.length === 0) {
              <div class="rounded-lg border border-border bg-card p-8 text-center">
                <ng-icon name="lucideClipboardList" size="32" class="mx-auto text-muted-foreground" />
                <p class="mt-2 text-muted-foreground">
                  No instruments generated yet. Go back to configure and generate.
                </p>
                <button
                  (click)="currentStep.set(1)"
                  class="mt-4 text-sm text-primary hover:underline"
                >
                  Select methods and configure
                </button>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ResearchPlannerResultsComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private service = inject(ResearchPlannerService);

  private sessionId: number | null = null;

  sessionDetail = signal<SessionDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isGenerating = signal(false);

  currentStep = signal(1);
  selectedMethods = signal<string[]>([]);
  activeTab = signal<'interview' | 'survey' | 'recruiting'>('interview');

  // Check if context sources were used
  hasContextSources = () => {
    const session = this.sessionDetail()?.session;
    if (!session?.contextSummary) return false;
    const cs = session.contextSummary;
    return !!(
      cs.knowledgeBases?.length ||
      cs.ideation ||
      cs.feasibility ||
      cs.businessCase
    );
  };

  // Configuration forms
  interviewConfig = {
    participantType: '',
    durationMinutes: 45,
    focusAreasText: '',
  };

  surveyConfig = {
    targetAudience: '',
    surveyLength: 'medium' as 'short' | 'medium' | 'long',
  };

  recruitingConfig = {
    role: '',
    companySize: '',
    participantCount: 12,
  };

  ngOnInit(): void {
    const sessionIdParam = this.route.snapshot.paramMap.get('sessionId');
    if (sessionIdParam) {
      this.sessionId = parseInt(sessionIdParam, 10);
      this.loadSession();
    } else {
      this.router.navigate(['/research-planner']);
    }
  }

  async loadSession(): Promise<void> {
    if (!this.sessionId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const detail = await this.service.getSessionDetail(this.sessionId);
      this.sessionDetail.set(detail);

      // Set selected methods from session
      if (detail.session.selectedMethods) {
        this.selectedMethods.set(detail.session.selectedMethods);
      }

      // Determine current step based on status
      if (detail.session.status === 'completed') {
        this.currentStep.set(3);
        // Set active tab based on what's available
        if (detail.interviewGuides.length > 0) {
          this.activeTab.set('interview');
        } else if (detail.surveys.length > 0) {
          this.activeTab.set('survey');
        } else if (detail.recruitingPlans.length > 0) {
          this.activeTab.set('recruiting');
        }
      } else if (detail.session.selectedMethods && detail.session.selectedMethods.length > 0) {
        this.currentStep.set(2);
      }
    } catch (err) {
      this.error.set('Failed to load session. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleMethodSelection(methodName: string): void {
    this.selectedMethods.update((methods) => {
      if (methods.includes(methodName)) {
        return methods.filter((m) => m !== methodName);
      }
      return [...methods, methodName];
    });
  }

  async proceedToConfiguration(): Promise<void> {
    if (!this.sessionId || this.selectedMethods().length === 0) return;

    try {
      await this.service.selectMethods(this.sessionId, this.selectedMethods());
      this.currentStep.set(2);
    } catch (err) {
      this.error.set('Failed to save method selection.');
    }
  }

  async generateInstruments(): Promise<void> {
    if (!this.sessionId) return;

    this.isGenerating.set(true);
    this.error.set(null);

    try {
      const request: {
        interviewGuideConfig?: InterviewGuideConfig;
        surveyConfig?: SurveyConfig;
        recruitingConfig?: RecruitingConfig;
      } = {};

      if (this.selectedMethods().includes('user_interviews')) {
        request.interviewGuideConfig = {
          participantType: this.interviewConfig.participantType || 'Target users',
          durationMinutes: this.interviewConfig.durationMinutes,
          focusAreas: this.interviewConfig.focusAreasText
            ? this.interviewConfig.focusAreasText.split(',').map((s) => s.trim())
            : undefined,
        };
      }

      if (this.selectedMethods().includes('surveys')) {
        request.surveyConfig = {
          targetAudience: this.surveyConfig.targetAudience || 'Target users',
          surveyLength: this.surveyConfig.surveyLength,
        };
      }

      request.recruitingConfig = {
        participantCriteria: {
          role: this.recruitingConfig.role || undefined,
          companySize: this.recruitingConfig.companySize || undefined,
        },
        participantCount: this.recruitingConfig.participantCount,
      };

      await this.service.generateInstruments(this.sessionId, request);

      // Poll for completion
      this.currentStep.set(3);
      await this.pollForCompletion();
    } catch (err) {
      this.error.set('Failed to generate instruments.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  private async pollForCompletion(): Promise<void> {
    if (!this.sessionId) return;

    const maxAttempts = 60; // 3 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.service.pollSessionStatus(this.sessionId);

        if (status.status === 'completed') {
          await this.loadSession();
          return;
        }

        if (status.status === 'failed') {
          this.error.set(status.errorMessage || 'Generation failed.');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;
      } catch (err) {
        // Continue polling on transient errors
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;
      }
    }

    this.error.set('Generation timed out. Please refresh the page.');
  }

  getMethodIcon(methodName: string): string {
    const icons: Record<string, string> = {
      user_interviews: 'lucideMessageSquare',
      surveys: 'lucideClipboardList',
      usability_testing: 'lucideTarget',
      session_replay_analysis: 'lucideBarChart2',
      competitive_analysis: 'lucideBarChart2',
      focus_groups: 'lucideUsers',
      diary_studies: 'lucideEdit2',
      analytics_analysis: 'lucideBarChart2',
    };
    return icons[methodName] || 'lucideClipboardList';
  }

  getEffortClass(effort: string): string {
    const classes: Record<string, string> = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700',
    };
    return classes[effort] || 'bg-muted text-muted-foreground';
  }

  getGuideContent(guide: InterviewGuide): string {
    return guide.userEditedContent || guide.contentMarkdown;
  }

  downloadMarkdown(guide: InterviewGuide): void {
    const content = this.getGuideContent(guide);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interview-guide.md';
    a.click();
    URL.revokeObjectURL(url);
  }
}
