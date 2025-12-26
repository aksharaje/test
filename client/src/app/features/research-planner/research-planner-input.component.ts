/**
 * Research Planner Input Component
 *
 * First step: User enters research objective, optional constraints,
 * and optional context from knowledge bases and prior agentic flows.
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronDown,
  lucideChevronUp,
  lucideLoader2,
  lucideAlertCircle,
  lucideHelpCircle,
  lucideDatabase,
  lucideLightbulb,
  lucideCheckCircle,
  lucideBarChart,
  lucideX,
  lucideCheck,
} from '@ng-icons/lucide';

import { ResearchPlannerService } from './research-planner.service';
import {
  Constraints,
  AvailableContextSources,
} from './research-planner.types';

@Component({
  selector: 'app-research-planner-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideSearch,
      lucideChevronDown,
      lucideChevronUp,
      lucideLoader2,
      lucideAlertCircle,
      lucideHelpCircle,
      lucideDatabase,
      lucideLightbulb,
      lucideCheckCircle,
      lucideBarChart,
      lucideX,
      lucideCheck,
    }),
  ],
  template: `
    <div class="container mx-auto max-w-3xl px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-foreground">CX Research Planner</h1>
        <p class="mt-2 text-muted-foreground">
          Get AI-powered research method recommendations and generate professional research
          instruments based on your objectives.
        </p>
      </div>

      <!-- Form -->
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- Research Objective -->
        <div class="rounded-lg border border-border bg-card p-6">
          <label for="objective" class="block text-sm font-medium text-foreground">
            Research Objective
            <span class="text-destructive">*</span>
          </label>
          <p class="mt-1 text-sm text-muted-foreground">
            Describe what you want to learn from your customers. Be specific about the problem or
            question you're trying to answer.
          </p>
          <textarea
            id="objective"
            formControlName="objective"
            rows="4"
            placeholder="e.g., Why are enterprise customers dropping off during onboarding? We've seen a 30% drop in completion rates over the past quarter."
            class="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          ></textarea>
          @if (form.get('objective')?.invalid && form.get('objective')?.touched) {
            <p class="mt-1 text-sm text-destructive">
              Please enter a research objective (at least 10 characters)
            </p>
          }

          <!-- Example objectives -->
          <div class="mt-4">
            <button
              type="button"
              (click)="showExamples.set(!showExamples())"
              class="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ng-icon [name]="showExamples() ? 'lucideChevronUp' : 'lucideChevronDown'" size="16" />
              {{ showExamples() ? 'Hide' : 'Show' }} example objectives
            </button>
            @if (showExamples()) {
              <div class="mt-2 space-y-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                <p
                  class="cursor-pointer hover:text-foreground"
                  (click)="setExample('Why are enterprise customers abandoning the checkout process? Our analytics show 45% cart abandonment.')"
                >
                  "Why are enterprise customers abandoning the checkout process?"
                </p>
                <p
                  class="cursor-pointer hover:text-foreground"
                  (click)="setExample('What pain points do users experience when setting up integrations? We receive frequent support tickets about integration issues.')"
                >
                  "What pain points do users experience when setting up integrations?"
                </p>
                <p
                  class="cursor-pointer hover:text-foreground"
                  (click)="setExample('How do small business owners make decisions about which project management tool to use?')"
                >
                  "How do small business owners make decisions about which project management tool
                  to use?"
                </p>
              </div>
            }
          </div>
        </div>

        <!-- Context Sources (Optional) -->
        <div class="rounded-lg border border-border bg-card">
          <button
            type="button"
            (click)="toggleContextSources()"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div class="flex items-center gap-3">
              <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary" />
              <div>
                <span class="text-sm font-medium text-foreground">Add Context (Optional)</span>
                <p class="mt-1 text-sm text-muted-foreground">
                  Enrich recommendations with knowledge bases and prior analysis.
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
            <div class="border-t border-border px-6 pb-6 pt-4 space-y-5">
              @if (loadingContextSources()) {
                <div class="flex items-center justify-center py-8">
                  <ng-icon name="lucideLoader2" size="24" class="animate-spin text-muted-foreground" />
                </div>
              } @else if (!hasAnyContextSources()) {
                <p class="text-sm text-muted-foreground text-center py-4">
                  No context sources available. Create knowledge bases or run other analyses first.
                </p>
              } @else {
                <!-- Knowledge Bases - Multi-select Dropdown -->
                @if (contextSources()?.knowledgeBases?.length) {
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                      <ng-icon name="lucideDatabase" size="16" class="text-blue-500" />
                      Knowledge Bases
                    </label>
                    <div class="relative">
                      <button
                        type="button"
                        class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
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
                        <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg">
                          <div class="p-2 border-b">
                            <div class="relative">
                              <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Filter knowledge bases..."
                                class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                                <span class="truncate flex-1 text-left">{{ kb.name }}</span>
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

                <!-- Ideation Sessions - Single-select with Checkbox (toggleable) -->
                @if (contextSources()?.ideationSessions?.length) {
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                      <ng-icon name="lucideLightbulb" size="16" class="text-yellow-500" />
                      Ideation Session
                      <span class="text-xs text-muted-foreground font-normal">(select one)</span>
                    </label>
                    <div class="relative">
                      <button
                        type="button"
                        class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                        (click)="toggleDropdown('ideation')"
                      >
                        <span class="truncate text-left">
                          @if (!selectedIdeationSession()) {
                            <span class="text-muted-foreground">Select an ideation session...</span>
                          } @else {
                            {{ getIdeationLabel(selectedIdeationSession()!) }}
                          }
                        </span>
                        <ng-icon
                          name="lucideChevronDown"
                          class="h-4 w-4 text-muted-foreground transition-transform"
                          [class.rotate-180]="ideationDropdownOpen()"
                        />
                      </button>

                      @if (ideationDropdownOpen()) {
                        <div class="fixed inset-0 z-40" (click)="closeAllDropdowns()"></div>
                        <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg">
                          <div class="p-2 border-b">
                            <div class="relative">
                              <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Filter ideation sessions..."
                                class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                [value]="ideationSearchFilter()"
                                (input)="ideationSearchFilter.set(getInputValue($event))"
                                (click)="$event.stopPropagation()"
                              />
                            </div>
                          </div>
                          <div class="max-h-48 overflow-y-auto p-1">
                            @for (session of filteredIdeationSessions(); track session.id) {
                              <button
                                type="button"
                                class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted text-left"
                                [class.bg-primary/10]="selectedIdeationSession() === session.id"
                                [disabled]="selectedIdeationSession() !== null && selectedIdeationSession() !== session.id"
                                [class.opacity-50]="selectedIdeationSession() !== null && selectedIdeationSession() !== session.id"
                                [class.cursor-not-allowed]="selectedIdeationSession() !== null && selectedIdeationSession() !== session.id"
                                (click)="toggleIdeation(session.id); $event.stopPropagation()"
                              >
                                <div
                                  class="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                                  [class.bg-primary]="selectedIdeationSession() === session.id"
                                  [class.border-primary]="selectedIdeationSession() === session.id"
                                >
                                  @if (selectedIdeationSession() === session.id) {
                                    <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                                  }
                                </div>
                                <span class="truncate flex-1">{{ session.problemStatement || 'Ideation #' + session.id }}</span>
                              </button>
                            }
                            @if (filteredIdeationSessions().length === 0) {
                              <div class="p-3 text-center text-sm text-muted-foreground">
                                No ideation sessions found
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Feasibility Sessions - Single-select with Checkbox (toggleable) -->
                @if (contextSources()?.feasibilitySessions?.length) {
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                      <ng-icon name="lucideCheckCircle" size="16" class="text-green-500" />
                      Feasibility Analysis
                      <span class="text-xs text-muted-foreground font-normal">(select one)</span>
                    </label>
                    <div class="relative">
                      <button
                        type="button"
                        class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                        (click)="toggleDropdown('feasibility')"
                      >
                        <span class="truncate text-left">
                          @if (!selectedFeasibilitySession()) {
                            <span class="text-muted-foreground">Select a feasibility analysis...</span>
                          } @else {
                            {{ getFeasibilityLabel(selectedFeasibilitySession()!) }}
                          }
                        </span>
                        <ng-icon
                          name="lucideChevronDown"
                          class="h-4 w-4 text-muted-foreground transition-transform"
                          [class.rotate-180]="feasibilityDropdownOpen()"
                        />
                      </button>

                      @if (feasibilityDropdownOpen()) {
                        <div class="fixed inset-0 z-40" (click)="closeAllDropdowns()"></div>
                        <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg">
                          <div class="p-2 border-b">
                            <div class="relative">
                              <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Filter feasibility analyses..."
                                class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                [value]="feasibilitySearchFilter()"
                                (input)="feasibilitySearchFilter.set(getInputValue($event))"
                                (click)="$event.stopPropagation()"
                              />
                            </div>
                          </div>
                          <div class="max-h-48 overflow-y-auto p-1">
                            @for (session of filteredFeasibilitySessions(); track session.id) {
                              <button
                                type="button"
                                class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted text-left"
                                [class.bg-primary/10]="selectedFeasibilitySession() === session.id"
                                [disabled]="selectedFeasibilitySession() !== null && selectedFeasibilitySession() !== session.id"
                                [class.opacity-50]="selectedFeasibilitySession() !== null && selectedFeasibilitySession() !== session.id"
                                [class.cursor-not-allowed]="selectedFeasibilitySession() !== null && selectedFeasibilitySession() !== session.id"
                                (click)="toggleFeasibility(session.id); $event.stopPropagation()"
                              >
                                <div
                                  class="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                                  [class.bg-primary]="selectedFeasibilitySession() === session.id"
                                  [class.border-primary]="selectedFeasibilitySession() === session.id"
                                >
                                  @if (selectedFeasibilitySession() === session.id) {
                                    <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                                  }
                                </div>
                                <span class="truncate flex-1">{{ session.featureDescription || 'Analysis #' + session.id }}</span>
                                @if (session.goDecision) {
                                  <span
                                    class="text-xs px-1.5 py-0.5 rounded"
                                    [class.bg-green-100]="session.goDecision === 'go'"
                                    [class.text-green-700]="session.goDecision === 'go'"
                                    [class.bg-red-100]="session.goDecision === 'no_go'"
                                    [class.text-red-700]="session.goDecision === 'no_go'"
                                    [class.bg-yellow-100]="session.goDecision === 'conditional'"
                                    [class.text-yellow-700]="session.goDecision === 'conditional'"
                                  >
                                    {{ formatGoDecision(session.goDecision) }}
                                  </span>
                                }
                              </button>
                            }
                            @if (filteredFeasibilitySessions().length === 0) {
                              <div class="p-3 text-center text-sm text-muted-foreground">
                                No feasibility analyses found
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Business Case Sessions - Single-select with Checkbox (toggleable) -->
                @if (contextSources()?.businessCaseSessions?.length) {
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                      <ng-icon name="lucideBarChart" size="16" class="text-purple-500" />
                      Business Case
                      <span class="text-xs text-muted-foreground font-normal">(select one)</span>
                    </label>
                    <div class="relative">
                      <button
                        type="button"
                        class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                        (click)="toggleDropdown('businessCase')"
                      >
                        <span class="truncate text-left">
                          @if (!selectedBusinessCaseSession()) {
                            <span class="text-muted-foreground">Select a business case...</span>
                          } @else {
                            {{ getBusinessCaseLabel(selectedBusinessCaseSession()!) }}
                          }
                        </span>
                        <ng-icon
                          name="lucideChevronDown"
                          class="h-4 w-4 text-muted-foreground transition-transform"
                          [class.rotate-180]="businessCaseDropdownOpen()"
                        />
                      </button>

                      @if (businessCaseDropdownOpen()) {
                        <div class="fixed inset-0 z-40" (click)="closeAllDropdowns()"></div>
                        <div class="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-lg">
                          <div class="p-2 border-b">
                            <div class="relative">
                              <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Filter business cases..."
                                class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                [value]="businessCaseSearchFilter()"
                                (input)="businessCaseSearchFilter.set(getInputValue($event))"
                                (click)="$event.stopPropagation()"
                              />
                            </div>
                          </div>
                          <div class="max-h-48 overflow-y-auto p-1">
                            @for (session of filteredBusinessCaseSessions(); track session.id) {
                              <button
                                type="button"
                                class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted text-left"
                                [class.bg-primary/10]="selectedBusinessCaseSession() === session.id"
                                [disabled]="selectedBusinessCaseSession() !== null && selectedBusinessCaseSession() !== session.id"
                                [class.opacity-50]="selectedBusinessCaseSession() !== null && selectedBusinessCaseSession() !== session.id"
                                [class.cursor-not-allowed]="selectedBusinessCaseSession() !== null && selectedBusinessCaseSession() !== session.id"
                                (click)="toggleBusinessCase(session.id); $event.stopPropagation()"
                              >
                                <div
                                  class="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                                  [class.bg-primary]="selectedBusinessCaseSession() === session.id"
                                  [class.border-primary]="selectedBusinessCaseSession() === session.id"
                                >
                                  @if (selectedBusinessCaseSession() === session.id) {
                                    <ng-icon name="lucideCheck" class="h-3 w-3 text-primary-foreground" />
                                  }
                                </div>
                                <span class="truncate flex-1">{{ session.featureName || 'Business Case #' + session.id }}</span>
                                @if (session.recommendation) {
                                  <span
                                    class="text-xs px-1.5 py-0.5 rounded"
                                    [class.bg-green-100]="session.recommendation === 'invest'"
                                    [class.text-green-700]="session.recommendation === 'invest'"
                                    [class.bg-yellow-100]="session.recommendation === 'defer'"
                                    [class.text-yellow-700]="session.recommendation === 'defer'"
                                    [class.bg-red-100]="session.recommendation === 'reject'"
                                    [class.text-red-700]="session.recommendation === 'reject'"
                                  >
                                    {{ formatRecommendation(session.recommendation) }}
                                  </span>
                                }
                              </button>
                            }
                            @if (filteredBusinessCaseSessions().length === 0) {
                              <div class="p-3 text-center text-sm text-muted-foreground">
                                No business cases found
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          }
        </div>

        <!-- Constraints (Collapsible) -->
        <div class="rounded-lg border border-border bg-card">
          <button
            type="button"
            (click)="showConstraints.set(!showConstraints())"
            class="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <span class="text-sm font-medium text-foreground">Constraints (Optional)</span>
              <p class="mt-1 text-sm text-muted-foreground">
                Set budget, timeline, and other constraints to get more relevant recommendations.
              </p>
            </div>
            <ng-icon
              [name]="showConstraints() ? 'lucideChevronUp' : 'lucideChevronDown'"
              class="h-5 w-5 text-muted-foreground"
            />
          </button>

          @if (showConstraints()) {
            <div class="border-t border-border px-6 pb-6 pt-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <!-- Budget -->
                <div>
                  <label for="budget" class="block text-sm font-medium text-foreground">
                    Budget
                  </label>
                  <select
                    id="budget"
                    formControlName="budget"
                    class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Not specified</option>
                    <option value="limited">Limited (&lt; $5k)</option>
                    <option value="moderate">Moderate ($5k - $20k)</option>
                    <option value="flexible">Flexible (&gt; $20k)</option>
                  </select>
                </div>

                <!-- Timeline -->
                <div>
                  <label for="timeline" class="block text-sm font-medium text-foreground">
                    Timeline
                  </label>
                  <select
                    id="timeline"
                    formControlName="timeline"
                    class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Not specified</option>
                    <option value="urgent">Urgent (&lt; 2 weeks)</option>
                    <option value="normal">Normal (2-6 weeks)</option>
                    <option value="flexible">Flexible (&gt; 6 weeks)</option>
                  </select>
                </div>

                <!-- User Access -->
                <div>
                  <label class="block text-sm font-medium text-foreground">
                    Do you have access to users?
                  </label>
                  <div class="mt-2 flex gap-4">
                    <label class="flex items-center gap-2">
                      <input
                        type="radio"
                        formControlName="userAccess"
                        [value]="true"
                        class="h-4 w-4 border-input text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-foreground">Yes</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input
                        type="radio"
                        formControlName="userAccess"
                        [value]="false"
                        class="h-4 w-4 border-input text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-foreground">No</span>
                    </label>
                  </div>
                </div>

                <!-- Remote Only -->
                <div>
                  <label class="block text-sm font-medium text-foreground">Remote only?</label>
                  <div class="mt-2 flex gap-4">
                    <label class="flex items-center gap-2">
                      <input
                        type="radio"
                        formControlName="remoteOnly"
                        [value]="true"
                        class="h-4 w-4 border-input text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-foreground">Yes</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input
                        type="radio"
                        formControlName="remoteOnly"
                        [value]="false"
                        class="h-4 w-4 border-input text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-foreground">No</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Error Message -->
        @if (error()) {
          <div
            class="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <ng-icon name="lucideAlertCircle" size="16" />
            {{ error() }}
          </div>
        }

        <!-- Submit Button -->
        <div class="flex justify-end">
          <button
            type="submit"
            [disabled]="form.invalid || isSubmitting()"
            class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            @if (isSubmitting()) {
              <ng-icon name="lucideLoader2" size="16" class="animate-spin" />
              Analyzing...
            } @else {
              <ng-icon name="lucideSearch" size="16" />
              Get Recommendations
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ResearchPlannerInputComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private service = inject(ResearchPlannerService);

  showExamples = signal(false);
  showConstraints = signal(false);
  showContextSources = signal(false);
  isSubmitting = signal(false);
  loadingContextSources = signal(false);
  error = signal<string | null>(null);

  // Context sources
  contextSources = signal<AvailableContextSources | null>(null);
  selectedKnowledgeBases = signal<number[]>([]);
  selectedIdeationSession = signal<number | null>(null);
  selectedFeasibilitySession = signal<number | null>(null);
  selectedBusinessCaseSession = signal<number | null>(null);

  // Dropdown states
  kbDropdownOpen = signal(false);
  ideationDropdownOpen = signal(false);
  feasibilityDropdownOpen = signal(false);
  businessCaseDropdownOpen = signal(false);

  // Search filters
  kbSearchFilter = signal('');
  ideationSearchFilter = signal('');
  feasibilitySearchFilter = signal('');
  businessCaseSearchFilter = signal('');

  form = this.fb.group({
    objective: ['', [Validators.required, Validators.minLength(10)]],
    budget: [''],
    timeline: [''],
    userAccess: [null as boolean | null],
    remoteOnly: [null as boolean | null],
  });

  selectedContextCount = () => {
    let count = this.selectedKnowledgeBases().length;
    if (this.selectedIdeationSession()) count++;
    if (this.selectedFeasibilitySession()) count++;
    if (this.selectedBusinessCaseSession()) count++;
    return count;
  };

  hasAnyContextSources = computed(() => {
    const sources = this.contextSources();
    if (!sources) return false;
    return (
      (sources.knowledgeBases?.length || 0) > 0 ||
      (sources.ideationSessions?.length || 0) > 0 ||
      (sources.feasibilitySessions?.length || 0) > 0 ||
      (sources.businessCaseSessions?.length || 0) > 0
    );
  });

  filteredKnowledgeBases = computed(() => {
    const sources = this.contextSources();
    if (!sources?.knowledgeBases) return [];
    const filter = this.kbSearchFilter().toLowerCase();
    if (!filter) return sources.knowledgeBases;
    return sources.knowledgeBases.filter((kb) =>
      kb.name.toLowerCase().includes(filter)
    );
  });

  filteredIdeationSessions = computed(() => {
    const sources = this.contextSources();
    if (!sources?.ideationSessions) return [];
    const filter = this.ideationSearchFilter().toLowerCase();
    if (!filter) return sources.ideationSessions;
    return sources.ideationSessions.filter((s) =>
      (s.problemStatement || '').toLowerCase().includes(filter)
    );
  });

  filteredFeasibilitySessions = computed(() => {
    const sources = this.contextSources();
    if (!sources?.feasibilitySessions) return [];
    const filter = this.feasibilitySearchFilter().toLowerCase();
    if (!filter) return sources.feasibilitySessions;
    return sources.feasibilitySessions.filter((s) =>
      (s.featureDescription || '').toLowerCase().includes(filter)
    );
  });

  filteredBusinessCaseSessions = computed(() => {
    const sources = this.contextSources();
    if (!sources?.businessCaseSessions) return [];
    const filter = this.businessCaseSearchFilter().toLowerCase();
    if (!filter) return sources.businessCaseSessions;
    return sources.businessCaseSessions.filter((s) =>
      (s.featureName || '').toLowerCase().includes(filter)
    );
  });

  async ngOnInit(): Promise<void> {
    this.loadingContextSources.set(true);
    try {
      const sources = await this.service.loadContextSources();
      this.contextSources.set(sources);
    } catch {
      // Silent fail - context sources are optional
    } finally {
      this.loadingContextSources.set(false);
    }
  }

  toggleContextSources(): void {
    this.showContextSources.set(!this.showContextSources());
  }

  setExample(text: string): void {
    this.form.patchValue({ objective: text });
    this.showExamples.set(false);
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // Dropdown management
  toggleDropdown(type: 'kb' | 'ideation' | 'feasibility' | 'businessCase'): void {
    this.closeAllDropdowns();
    switch (type) {
      case 'kb':
        this.kbDropdownOpen.set(true);
        break;
      case 'ideation':
        this.ideationDropdownOpen.set(true);
        break;
      case 'feasibility':
        this.feasibilityDropdownOpen.set(true);
        break;
      case 'businessCase':
        this.businessCaseDropdownOpen.set(true);
        break;
    }
  }

  closeAllDropdowns(): void {
    this.kbDropdownOpen.set(false);
    this.ideationDropdownOpen.set(false);
    this.feasibilityDropdownOpen.set(false);
    this.businessCaseDropdownOpen.set(false);
  }

  // Knowledge bases (multi-select)
  toggleKnowledgeBase(id: number): void {
    const current = this.selectedKnowledgeBases();
    if (current.includes(id)) {
      this.selectedKnowledgeBases.set(current.filter(kbId => kbId !== id));
    } else {
      this.selectedKnowledgeBases.set([...current, id]);
    }
  }

  getKbName(id: number): string {
    const kb = this.contextSources()?.knowledgeBases?.find(k => k.id === id);
    return kb?.name || `KB #${id}`;
  }

  // Single-select toggle handlers (checkbox style - click to select, click again to deselect)
  toggleIdeation(id: number): void {
    if (this.selectedIdeationSession() === id) {
      // Uncheck - deselect
      this.selectedIdeationSession.set(null);
    } else {
      // Check - select (only if nothing else is selected)
      this.selectedIdeationSession.set(id);
    }
  }

  toggleFeasibility(id: number): void {
    if (this.selectedFeasibilitySession() === id) {
      // Uncheck - deselect
      this.selectedFeasibilitySession.set(null);
    } else {
      // Check - select (only if nothing else is selected)
      this.selectedFeasibilitySession.set(id);
    }
  }

  toggleBusinessCase(id: number): void {
    if (this.selectedBusinessCaseSession() === id) {
      // Uncheck - deselect
      this.selectedBusinessCaseSession.set(null);
    } else {
      // Check - select (only if nothing else is selected)
      this.selectedBusinessCaseSession.set(id);
    }
  }

  // Label getters
  getIdeationLabel(id: number): string {
    const session = this.contextSources()?.ideationSessions?.find(s => s.id === id);
    return session?.problemStatement || `Ideation #${id}`;
  }

  getFeasibilityLabel(id: number): string {
    const session = this.contextSources()?.feasibilitySessions?.find(s => s.id === id);
    return session?.featureDescription || `Analysis #${id}`;
  }

  getBusinessCaseLabel(id: number): string {
    const session = this.contextSources()?.businessCaseSessions?.find(s => s.id === id);
    return session?.featureName || `Business Case #${id}`;
  }

  formatGoDecision(decision: string): string {
    const labels: Record<string, string> = {
      go: 'Go',
      no_go: 'No-Go',
      conditional: 'Conditional',
    };
    return labels[decision] || decision;
  }

  formatRecommendation(recommendation: string): string {
    const labels: Record<string, string> = {
      invest: 'Invest',
      defer: 'Defer',
      reject: 'Reject',
    };
    return labels[recommendation] || recommendation;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      const formValue = this.form.value;

      const constraints: Constraints = {};
      if (formValue.budget) constraints.budget = formValue.budget as Constraints['budget'];
      if (formValue.timeline) constraints.timeline = formValue.timeline as Constraints['timeline'];
      if (formValue.userAccess !== null) constraints.userAccess = formValue.userAccess;
      if (formValue.remoteOnly !== null) constraints.remoteOnly = formValue.remoteOnly;

      const session = await this.service.createSession({
        objective: formValue.objective || '',
        constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        knowledgeBaseIds: this.selectedKnowledgeBases().length > 0 ? this.selectedKnowledgeBases() : undefined,
        ideationSessionId: this.selectedIdeationSession() || undefined,
        feasibilitySessionId: this.selectedFeasibilitySession() || undefined,
        businessCaseSessionId: this.selectedBusinessCaseSession() || undefined,
      });

      // Navigate to processing page
      this.router.navigate(['/research-planner/processing', session.id]);
    } catch (err) {
      this.error.set('Failed to create research plan. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
