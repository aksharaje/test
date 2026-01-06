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
import { MarkdownComponent } from 'ngx-markdown';
import {
  lucideLoader2,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideChevronDown,
  lucideChevronUp,
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
  lucideFileText,
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgIcon, MarkdownComponent],
  viewProviders: [
    provideIcons({
      lucideLoader2,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideChevronDown,
      lucideChevronUp,
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
      lucideFileText,
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
            Set Up Details
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
            <h2 class="text-lg font-semibold text-foreground">Ways to Learn From Your Users</h2>
            <p class="text-sm text-muted-foreground">
              Pick the methods that work best for you. We'll create the materials you need for each one.
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
                Continue
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
                <h2 class="text-lg font-semibold text-foreground">Set Up Your Research</h2>
                <p class="text-sm text-muted-foreground">
                  Tell us more about who you want to learn from so we can create the right materials.
                </p>
              </div>
              <button
                (click)="goBackToMethodSelection()"
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
                  One-on-One Conversation Setup
                </h3>
                <p class="text-sm text-muted-foreground mb-4">Help us prepare questions for your conversations with users.</p>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="block text-sm font-medium text-foreground">Who will you be talking to? <span class="text-destructive">*</span></label>
                    <input
                      type="text"
                      [(ngModel)]="interviewConfig.participantType"
                      placeholder="Click a suggestion or type your own"
                      [class.border-destructive]="hasAttemptedSubmit() && !interviewConfig.participantType.trim()"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    @if (hasAttemptedSubmit() && !interviewConfig.participantType.trim()) {
                      <p class="mt-1 text-xs text-destructive">Please specify who you'll be talking to</p>
                    }
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      @for (participant of suggestedParticipants(); track participant) {
                        <button
                          type="button"
                          (click)="setParticipantType(participant)"
                          [class]="interviewConfig.participantType === participant ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'"
                          class="rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          {{ participant }}
                        </button>
                      }
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-foreground">How long should each chat be?</label>
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
                    <label class="block text-sm font-medium text-foreground">What topics do you want to cover? (optional)</label>
                    <input
                      type="text"
                      [(ngModel)]="interviewConfig.focusAreasText"
                      placeholder="Click suggestions below or type your own"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p class="mt-1 text-xs text-muted-foreground">Separate each topic with a comma</p>
                    <!-- Suggested topics -->
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span class="text-xs text-muted-foreground">Suggestions:</span>
                      @for (topic of suggestedTopics(); track topic) {
                        <button
                          type="button"
                          (click)="addFocusTopic(topic)"
                          class="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          + {{ topic }}
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- Survey Config -->
            @if (selectedMethods().includes('surveys')) {
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="mb-4 flex items-center gap-2 font-medium text-foreground">
                  <ng-icon name="lucideClipboardList" size="20" />
                  Questionnaire Setup
                </h3>
                <p class="text-sm text-muted-foreground mb-4">We'll create a questionnaire to collect feedback at scale.</p>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="block text-sm font-medium text-foreground">Who should answer this? <span class="text-destructive">*</span></label>
                    <input
                      type="text"
                      [(ngModel)]="surveyConfig.targetAudience"
                      placeholder="e.g., Current customers"
                      [class.border-destructive]="hasAttemptedSubmit() && !surveyConfig.targetAudience.trim()"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    @if (hasAttemptedSubmit() && !surveyConfig.targetAudience.trim()) {
                      <p class="mt-1 text-xs text-destructive">Please specify who should answer</p>
                    }
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-foreground">How long should it be?</label>
                    <select
                      [(ngModel)]="surveyConfig.surveyLength"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="short">Quick (5-10 questions, ~3 min)</option>
                      <option value="medium">Standard (10-20 questions, ~7 min)</option>
                      <option value="long">Detailed (20+ questions, ~15 min)</option>
                    </select>
                  </div>
                </div>
              </div>
            }

            <!-- Recruiting Config -->
            <div class="rounded-lg border border-border bg-card p-6">
              <h3 class="mb-4 flex items-center gap-2 font-medium text-foreground">
                <ng-icon name="lucideUsers" size="20" />
                Finding the Right People
              </h3>
              <p class="text-sm text-muted-foreground mb-4">Help us find people who match your target audience.</p>

              <!-- B2B Fields -->
              @if (!isB2C()) {
                <div class="grid gap-4 sm:grid-cols-2 mb-4">
                  <div>
                    <label class="block text-sm font-medium text-foreground">What's their job title or role? <span class="text-destructive">*</span></label>
                    <input
                      type="text"
                      [(ngModel)]="recruitingConfig.role"
                      placeholder="Click a suggestion or type your own"
                      [class.border-destructive]="hasAttemptedSubmit() && !recruitingConfig.role.trim()"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    @if (hasAttemptedSubmit() && !recruitingConfig.role.trim()) {
                      <p class="mt-1 text-xs text-destructive">Please specify the job title or role</p>
                    }
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      @for (segment of suggestedSegments(); track segment) {
                        <button
                          type="button"
                          (click)="setRole(segment)"
                          [class]="recruitingConfig.role === segment ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'"
                          class="rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          {{ segment }}
                        </button>
                      }
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-foreground">What size company do they work at?</label>
                    <input
                      type="text"
                      [(ngModel)]="recruitingConfig.companySize"
                      placeholder="e.g., 200+ employees"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      @for (size of ['Startup (1-50)', '50-200', '200-1000', '1000+', 'Enterprise']; track size) {
                        <button
                          type="button"
                          (click)="recruitingConfig.companySize = size"
                          [class]="recruitingConfig.companySize === size ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'"
                          class="rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          {{ size }}
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }

              <!-- B2C Fields -->
              @if (isB2C()) {
                <div class="grid gap-4 sm:grid-cols-2 mb-4">
                  <div>
                    <label class="block text-sm font-medium text-foreground">Who are you looking for? <span class="text-destructive">*</span></label>
                    <input
                      type="text"
                      [(ngModel)]="recruitingConfig.role"
                      placeholder="Describe your target segment"
                      [class.border-destructive]="hasAttemptedSubmit() && !recruitingConfig.role.trim()"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    @if (hasAttemptedSubmit() && !recruitingConfig.role.trim()) {
                      <p class="mt-1 text-xs text-destructive">Please describe your target segment</p>
                    }
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      @for (segment of suggestedSegments(); track segment) {
                        <button
                          type="button"
                          (click)="setRole(segment)"
                          [class]="recruitingConfig.role === segment ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'"
                          class="rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          {{ segment }}
                        </button>
                      }
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-foreground">Any demographic requirements?</label>
                    <input
                      type="text"
                      [(ngModel)]="recruitingConfig.companySize"
                      placeholder="e.g., Ages 25-40, Urban areas"
                      class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      @for (demo of ['18-24', '25-34', '35-44', '45-54', '55+', 'All ages']; track demo) {
                        <button
                          type="button"
                          (click)="recruitingConfig.companySize = demo"
                          [class]="recruitingConfig.companySize === demo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'"
                          class="rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          {{ demo }}
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }

              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-foreground">How many people do you need?</label>
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
                (click)="goBackToMethodSelection()"
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
                  Creating...
                } @else {
                  Create My Research Materials
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
                <h2 class="text-lg font-semibold text-foreground">Your Research Materials</h2>
                <p class="text-sm text-muted-foreground">
                  Here's what we created for you. Review and customize as needed.
                </p>
              </div>
              <button
                (click)="exportToPdf()"
                class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <ng-icon name="lucideFileText" size="16" />
                Export PDF
              </button>
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
                    Conversation Guide
                  </button>
                }
                @if (sessionDetail()!.surveys.length > 0) {
                  <button
                    (click)="activeTab.set('survey')"
                    [class]="activeTab() === 'survey' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                    class="border-b-2 px-4 py-2 text-sm font-medium"
                  >
                    Questionnaire
                  </button>
                }
                @if (sessionDetail()!.recruitingPlans.length > 0) {
                  <button
                    (click)="activeTab.set('recruiting')"
                    [class]="activeTab() === 'recruiting' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                    class="border-b-2 px-4 py-2 text-sm font-medium"
                  >
                    Finding People
                  </button>
                }
              </div>
            </div>

            <!-- Interview Guide Tab -->
            @if (activeTab() === 'interview' && sessionDetail()!.interviewGuides[0]) {
              <div class="rounded-lg border border-border bg-card">
                <div class="border-b border-border p-4">
                  <h3 class="font-medium text-foreground">Conversation Guide</h3>
                </div>
                <div class="p-4">
                  <markdown
                    class="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground"
                    [data]="getGuideContent(sessionDetail()!.interviewGuides[0])"
                  ></markdown>
                </div>
              </div>
            }

            <!-- Survey Tab -->
            @if (activeTab() === 'survey' && sessionDetail()!.surveys[0]) {
              <div class="rounded-lg border border-border bg-card">
                <div class="flex items-center justify-between border-b border-border p-4">
                  <h3 class="font-medium text-foreground">Your Questions</h3>
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
                    <h4 class="mb-2 text-sm font-medium text-foreground">How to Make Sense of Responses</h4>
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
                  <h4 class="mb-3 font-medium text-foreground">Who You're Looking For</h4>
                  @if (sessionDetail()!.recruitingPlans[0].detailedCriteria?.mustHave?.length || sessionDetail()!.recruitingPlans[0].detailedCriteria?.niceToHave?.length) {
                    <div class="space-y-2 text-sm">
                      @if (sessionDetail()!.recruitingPlans[0].detailedCriteria?.mustHave?.length) {
                        <div>
                          <span class="font-medium text-foreground">Must have:</span>
                          <ul class="mt-1 list-inside list-disc text-muted-foreground">
                            @for (item of sessionDetail()!.recruitingPlans[0].detailedCriteria!.mustHave; track item) {
                              <li>{{ item }}</li>
                            }
                          </ul>
                        </div>
                      }
                      @if (sessionDetail()!.recruitingPlans[0].detailedCriteria?.niceToHave?.length) {
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
                  } @else {
                    <p class="text-sm text-muted-foreground">Based on your inputs, we'll help you find participants that match your target audience.</p>
                  }
                </div>

                <!-- Screener Questions -->
                @if (sessionDetail()!.recruitingPlans[0].screenerQuestions?.length) {
                  <div class="rounded-lg border border-border bg-card p-4">
                    <h4 class="mb-3 font-medium text-foreground">Questions to Find the Right People</h4>
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
                    <p class="text-sm text-muted-foreground">People to Reach Out To</p>
                  </div>
                  <div class="rounded-lg border border-border bg-card p-4 text-center">
                    <p class="text-2xl font-bold text-foreground">{{ (sessionDetail()!.recruitingPlans[0].expectedResponseRate * 100).toFixed(0) }}%</p>
                    <p class="text-sm text-muted-foreground">Expected to Say Yes</p>
                  </div>
                  <div class="rounded-lg border border-border bg-card p-4 text-center">
                    <p class="text-lg font-bold text-foreground">{{ sessionDetail()!.recruitingPlans[0].incentiveRecommendation || 'Not specified' }}</p>
                    <p class="text-sm text-muted-foreground">Thank You Gift</p>
                  </div>
                </div>

                <!-- Email Templates -->
                @if (sessionDetail()!.recruitingPlans[0].emailTemplates?.length) {
                  <div class="rounded-lg border border-border bg-card p-4">
                    <h4 class="mb-3 font-medium text-foreground">Ready-to-Use Emails</h4>
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
                  No materials created yet. Let's go back and set things up.
                </p>
                <button
                  (click)="currentStep.set(1)"
                  class="mt-4 text-sm text-primary hover:underline"
                >
                  Choose methods to get started
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

  // Research context from user selection (b2b or b2c)
  researchContext = computed(() => {
    return this.sessionDetail()?.session?.researchContext || 'b2b';
  });

  isB2C = computed(() => this.researchContext() === 'b2c');

  // Track if user has attempted to submit (for showing validation errors)
  hasAttemptedSubmit = signal(false);

  // Validation methods
  isInterviewConfigValid(): boolean {
    if (!this.selectedMethods().includes('user_interviews')) return true;
    return !!this.interviewConfig.participantType.trim();
  }

  isSurveyConfigValid(): boolean {
    if (!this.selectedMethods().includes('surveys')) return true;
    return !!this.surveyConfig.targetAudience.trim();
  }

  isRecruitingConfigValid(): boolean {
    return !!this.recruitingConfig.role.trim() && this.recruitingConfig.participantCount > 0;
  }

  isConfigValid(): boolean {
    return this.isInterviewConfigValid() && this.isSurveyConfigValid() && this.isRecruitingConfigValid();
  }

  goBackToMethodSelection(): void {
    this.hasAttemptedSubmit.set(false);
    this.currentStep.set(1);
  }

  suggestedTopics = computed(() => {
    const metadata = this.sessionDetail()?.session?.generationMetadata;
    const topics = metadata?.['suggested_topics'] as string[] | undefined;
    return topics?.length ? topics : [
      'Pain points',
      'Current workflow',
      'Onboarding experience',
      'Feature requests',
      'Unmet needs',
      'Competitor comparison',
    ];
  });

  suggestedParticipants = computed(() => {
    const metadata = this.sessionDetail()?.session?.generationMetadata;
    const participants = metadata?.['suggested_participants'] as string[] | undefined;
    return participants?.length ? participants : [
      'Current customers',
      'Prospective users',
      'Power users',
      'New users',
      'Churned users',
    ];
  });

  // For recruiting - segments work for both B2B (roles) and B2C (demographics/behaviors)
  suggestedSegments = computed(() => {
    const metadata = this.sessionDetail()?.session?.generationMetadata;
    const segments = metadata?.['suggested_segments'] as string[] | undefined;
    if (segments?.length) return segments;

    // Fallback based on context
    return this.isB2C() ? [
      'Daily active users',
      'First-time users (last 30 days)',
      'Churned users',
      'Power users',
      'Budget-conscious shoppers',
    ] : [
      'Product Manager',
      'End User',
      'Team Lead',
      'Decision Maker',
      'Technical Lead',
    ];
  });

  addFocusTopic(topic: string): void {
    const current = this.interviewConfig.focusAreasText.trim();
    if (current.toLowerCase().includes(topic.toLowerCase())) {
      return; // Already added
    }
    this.interviewConfig.focusAreasText = current
      ? `${current}, ${topic}`
      : topic;
  }

  setParticipantType(value: string): void {
    this.interviewConfig.participantType = value;
  }

  setRole(value: string): void {
    this.recruitingConfig.role = value;
  }

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

    // Trigger validation display
    this.hasAttemptedSubmit.set(true);

    // Check if config is valid
    if (!this.isConfigValid()) {
      return;
    }

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

  exportToPdf(): void {
    const detail = this.sessionDetail();
    if (!detail) return;

    const session = detail.session;
    const interviewGuide = detail.interviewGuides[0];
    const survey = detail.surveys[0];
    const recruitingPlan = detail.recruitingPlans[0];

    // Build conversation guide section
    let conversationGuideHtml = '';
    if (interviewGuide) {
      const guideContent = this.getGuideContent(interviewGuide);
      // Convert markdown to HTML (simple conversion for common patterns)
      const guideHtml = this.markdownToHtml(guideContent);
      conversationGuideHtml = `
        <div class="section">
          <h2 class="section-title">
            <span class="section-icon">&#128172;</span>
            Conversation Guide
          </h2>
          <div class="content-box">
            ${guideHtml}
          </div>
        </div>
      `;
    }

    // Build questionnaire section
    let questionnaireHtml = '';
    if (survey && survey.questions) {
      const questionsHtml = survey.questions.map((q, i) => `
        <div class="question-item">
          <div class="question-header">
            <span class="question-number">${i + 1}</span>
            <div class="question-content">
              <p class="question-text">${q.text}</p>
              <div class="question-meta">
                <span class="question-type">${q.type}</span>
                ${q.required ? '<span class="question-required">Required</span>' : ''}
              </div>
              ${q.options && q.options.length > 0 ? `
                <ul class="options-list">
                  ${q.options.map(opt => `<li>${opt}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');

      questionnaireHtml = `
        <div class="section">
          <h2 class="section-title">
            <span class="section-icon">&#128203;</span>
            Questionnaire
          </h2>
          <p class="section-subtitle">Estimated completion time: ${survey.estimatedCompletionTime}</p>
          <div class="content-box">
            ${questionsHtml}
          </div>
          ${survey.analysisPlan ? `
            <div class="analysis-plan">
              <h4>How to Make Sense of Responses</h4>
              <p>${survey.analysisPlan}</p>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Build recruiting section
    let recruitingHtml = '';
    if (recruitingPlan) {
      const criteriaHtml = recruitingPlan.detailedCriteria ? `
        <div class="criteria-box">
          <h4>Who You're Looking For</h4>
          ${recruitingPlan.detailedCriteria.mustHave.length ? `
            <div class="criteria-section">
              <strong>Must have:</strong>
              <ul>
                ${recruitingPlan.detailedCriteria.mustHave.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${recruitingPlan.detailedCriteria.niceToHave.length ? `
            <div class="criteria-section">
              <strong>Nice to have:</strong>
              <ul>
                ${recruitingPlan.detailedCriteria.niceToHave.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      ` : '';

      const screenerHtml = recruitingPlan.screenerQuestions?.length ? `
        <div class="screener-box">
          <h4>Questions to Find the Right People</h4>
          ${recruitingPlan.screenerQuestions.map((q, i) => `
            <div class="screener-question">
              <p><strong>${i + 1}. ${q.question}</strong></p>
              <p class="qualifying-answer">Qualifying answer: <span class="green-text">${q.qualifyingAnswer}</span></p>
            </div>
          `).join('')}
        </div>
      ` : '';

      const emailsHtml = recruitingPlan.emailTemplates?.length ? `
        <div class="emails-box">
          <h4>Ready-to-Use Emails</h4>
          ${recruitingPlan.emailTemplates.map(template => `
            <div class="email-template">
              <p class="email-type">${template.type.toUpperCase()}</p>
              <p class="email-subject"><strong>Subject:</strong> ${template.subject}</p>
              <pre class="email-body">${template.body}</pre>
            </div>
          `).join('')}
        </div>
      ` : '';

      recruitingHtml = `
        <div class="section">
          <h2 class="section-title">
            <span class="section-icon">&#128101;</span>
            Finding People
          </h2>
          ${criteriaHtml}
          ${screenerHtml}
          <div class="stats-grid">
            <div class="stat-box">
              <p class="stat-value">${recruitingPlan.contactsNeeded}</p>
              <p class="stat-label">People to Reach Out To</p>
            </div>
            <div class="stat-box">
              <p class="stat-value">${(recruitingPlan.expectedResponseRate * 100).toFixed(0)}%</p>
              <p class="stat-label">Expected to Say Yes</p>
            </div>
            <div class="stat-box">
              <p class="stat-value">${recruitingPlan.incentiveRecommendation}</p>
              <p class="stat-label">Thank You Gift</p>
            </div>
          </div>
          ${emailsHtml}
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Research Plan - ${session.objective}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: #ffffff;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            border-bottom: 3px solid #006450;
            padding-bottom: 24px;
            margin-bottom: 32px;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #006450;
            margin-bottom: 8px;
          }
          .header .objective {
            font-size: 16px;
            color: #666;
          }
          .header .date {
            font-size: 12px;
            color: #999;
            margin-top: 8px;
          }
          .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #006450;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #e5e5e5;
            padding-bottom: 8px;
          }
          .section-icon {
            font-size: 24px;
          }
          .section-subtitle {
            font-size: 14px;
            color: #666;
            margin-bottom: 16px;
          }
          .content-box {
            background: #f9fafb;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 20px;
          }
          .content-box h1, .content-box h2, .content-box h3, .content-box h4 {
            color: #006450;
            margin-top: 16px;
            margin-bottom: 8px;
          }
          .content-box h1 { font-size: 20px; }
          .content-box h2 { font-size: 18px; }
          .content-box h3 { font-size: 16px; }
          .content-box h4 { font-size: 14px; }
          .content-box p {
            margin-bottom: 12px;
            color: #444;
          }
          .content-box ul, .content-box ol {
            margin-left: 20px;
            margin-bottom: 12px;
          }
          .content-box li {
            margin-bottom: 6px;
            color: #444;
          }
          .question-item {
            padding: 16px 0;
            border-bottom: 1px solid #e5e5e5;
          }
          .question-item:last-child {
            border-bottom: none;
          }
          .question-header {
            display: flex;
            gap: 12px;
          }
          .question-number {
            width: 24px;
            height: 24px;
            background: #006450;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
          }
          .question-content {
            flex: 1;
          }
          .question-text {
            font-weight: 500;
            margin-bottom: 8px;
          }
          .question-meta {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }
          .question-type {
            background: #e5e5e5;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
          }
          .question-required {
            color: #dc2626;
            font-size: 12px;
            font-weight: 500;
          }
          .options-list {
            margin-left: 20px;
            margin-top: 8px;
          }
          .options-list li {
            color: #666;
            font-size: 14px;
          }
          .analysis-plan {
            background: #f0fdf4;
            border: 1px solid #86efac;
            border-radius: 8px;
            padding: 16px;
            margin-top: 16px;
          }
          .analysis-plan h4 {
            color: #166534;
            margin-bottom: 8px;
          }
          .analysis-plan p {
            color: #166534;
            font-size: 14px;
          }
          .criteria-box, .screener-box, .emails-box {
            background: #f9fafb;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
          }
          .criteria-box h4, .screener-box h4, .emails-box h4 {
            color: #006450;
            margin-bottom: 12px;
          }
          .criteria-section {
            margin-bottom: 12px;
          }
          .criteria-section ul {
            margin-left: 20px;
            margin-top: 4px;
          }
          .screener-question {
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e5e5e5;
          }
          .screener-question:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .qualifying-answer {
            color: #666;
            font-size: 14px;
            margin-top: 4px;
          }
          .green-text {
            color: #16a34a;
            font-weight: 500;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 16px;
          }
          .stat-box {
            background: #f9fafb;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }
          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #006450;
          }
          .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
          }
          .email-template {
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 12px;
          }
          .email-template:last-child {
            margin-bottom: 0;
          }
          .email-type {
            font-size: 10px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .email-subject {
            font-size: 14px;
            margin-bottom: 8px;
          }
          .email-body {
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            color: #666;
            white-space: pre-wrap;
            background: #f9fafb;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
          }
          .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid #e5e5e5;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          .footer .brand {
            color: #006450;
            font-weight: 600;
          }
          @media print {
            body {
              padding: 20px;
            }
            .section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Research Plan</h1>
          <p class="objective">${session.objective}</p>
          <p class="date">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        ${conversationGuideHtml}
        ${questionnaireHtml}
        ${recruitingHtml}

        <div class="footer">
          <p>Generated by <span class="brand">Product Studio</span></p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      // Delay print to allow fonts to load
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }

  private markdownToHtml(markdown: string): string {
    // Simple markdown to HTML conversion
    let html = markdown
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Line breaks to paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap in paragraph if not already
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  }
}
