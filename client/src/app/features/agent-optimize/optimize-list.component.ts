import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBot,
  lucideLoader2,
  lucideTrendingUp,
  lucideTrendingDown,
  lucideActivity,
  lucideChevronRight,
  lucideFlaskConical,
  lucideLayoutList,
  lucideZap,
  lucideBeaker,
} from '@ng-icons/lucide';
import { OptimizeService } from './optimize.service';
import { HlmButtonDirective } from '../../ui/button';
import type { FlowItem } from './optimize.types';

@Component({
  selector: 'app-optimize-list',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideBot,
      lucideLoader2,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideActivity,
      lucideChevronRight,
      lucideFlaskConical,
      lucideLayoutList,
      lucideZap,
      lucideBeaker,
    }),
  ],
  template: `
    <div class="p-6 lg:p-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">Flow Optimization</h1>
          <p class="mt-1 text-muted-foreground">
            Monitor performance and optimize prompts based on user feedback across all flows.
          </p>
        </div>
      </div>

      @if (service.loading()) {
        <div class="mt-8 flex items-center justify-center py-12">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (service.flows().length === 0) {
        <div class="mt-8 rounded-lg border border-dashed bg-muted/50 p-12 text-center">
          <ng-icon name="lucideFlaskConical" class="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 class="mt-4 text-lg font-semibold">No flows found</h3>
          <p class="mt-2 text-muted-foreground">
            Generate content with the Story Generator or create agents to start collecting feedback.
          </p>
        </div>
      } @else {
        <!-- Stats overview -->
        <div class="mt-8 grid gap-4 sm:grid-cols-4">
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideZap" class="h-4 w-4" />
              <span class="text-sm">Total Flows</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ service.flows().length }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideLayoutList" class="h-4 w-4" />
              <span class="text-sm">Story Generators</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ service.storyGeneratorFlows().length }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-red-500">
              <ng-icon name="lucideTrendingDown" class="h-4 w-4" />
              <span class="text-sm">Need Attention</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ service.flowsWithNegativeFeedback().length }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideActivity" class="h-4 w-4" />
              <span class="text-sm">Total Feedback</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ getTotalFeedback() }}</p>
          </div>
        </div>

        <!-- Flows table -->
        <div class="mt-8 rounded-lg border bg-card overflow-hidden">
          <table class="w-full">
            <thead class="border-b bg-muted/50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Flow</th>
                <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sentiment</th>
                <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Feedback</th>
                <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th class="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (flow of service.flows(); track flow.id) {
                <tr class="hover:bg-muted/50 transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div class="rounded-lg bg-primary/10 p-2">
                        <ng-icon [name]="getFlowIcon(flow)" class="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p class="font-medium">{{ flow.name }}</p>
                        @if (flow.description) {
                          <p class="text-sm text-muted-foreground line-clamp-1">{{ flow.description }}</p>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span [class]="getTypeClasses(flow)">
                      {{ service.getFlowTypeLabel(flow.type) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <!-- Sentiment bar -->
                      <div class="h-2 w-24 rounded-full bg-muted overflow-hidden">
                        <div
                          class="h-full bg-green-500"
                          [style.width.%]="flow.feedbackStats.positivePercent"
                        ></div>
                      </div>
                      <span class="text-sm" [class]="getSentimentClass(flow)">
                        {{ flow.feedbackStats.positivePercent }}%
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3 text-sm">
                      <span class="flex items-center gap-1 text-green-600">
                        <ng-icon name="lucideTrendingUp" class="h-3 w-3" />
                        {{ flow.feedbackStats.positive }}
                      </span>
                      <span class="flex items-center gap-1 text-red-600">
                        <ng-icon name="lucideTrendingDown" class="h-3 w-3" />
                        {{ flow.feedbackStats.negative }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span [class]="getStatusClasses(flow)">
                      {{ getStatusText(flow) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      (click)="navigateToDetail(flow)"
                    >
                      <ng-icon name="lucideFlaskConical" class="mr-2 h-4 w-4" />
                      Optimize
                      <ng-icon name="lucideChevronRight" class="ml-1 h-4 w-4" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class OptimizeListComponent implements OnInit {
  protected service = inject(OptimizeService);
  private router = inject(Router);

  ngOnInit(): void {
    this.service.loadFlows();
  }

  navigateToDetail(flow: FlowItem): void {
    // Encode the flow ID for the URL
    const encodedId = encodeURIComponent(flow.id);
    this.router.navigate(['/optimize', encodedId]);
  }

  getTotalFeedback(): number {
    return this.service.flows().reduce((sum, f) => sum + f.feedbackStats.total, 0);
  }

  getFlowIcon(flow: FlowItem): string {
    return this.service.getFlowIcon(flow.type);
  }

  getTypeClasses(flow: FlowItem): string {
    const base = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium';
    if (flow.type === 'agent') {
      return `${base} bg-blue-100 text-blue-700`;
    }
    if (flow.type.startsWith('story_generator')) {
      return `${base} bg-purple-100 text-purple-700`;
    }
    return `${base} bg-gray-100 text-gray-700`;
  }

  getSentimentClass(flow: FlowItem): string {
    if (flow.feedbackStats.positivePercent >= 80) return 'text-green-600';
    if (flow.feedbackStats.positivePercent >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  getStatusClasses(flow: FlowItem): string {
    const base = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium';
    if (flow.feedbackStats.total === 0) {
      return `${base} bg-gray-100 text-gray-700`;
    }
    if (flow.feedbackStats.positivePercent >= 80) {
      return `${base} bg-green-100 text-green-700`;
    }
    if (flow.feedbackStats.positivePercent >= 60) {
      return `${base} bg-yellow-100 text-yellow-700`;
    }
    return `${base} bg-red-100 text-red-700`;
  }

  getStatusText(flow: FlowItem): string {
    if (flow.feedbackStats.total === 0) return 'No feedback';
    if (flow.feedbackStats.positivePercent >= 80) return 'Performing well';
    if (flow.feedbackStats.positivePercent >= 60) return 'Needs review';
    return 'Needs optimization';
  }
}
