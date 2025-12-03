import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader2,
  lucideThumbsUp,
  lucideThumbsDown,
  lucideMessageSquare,
  lucideInbox,
  lucideBot,
  lucideLayoutList,
} from '@ng-icons/lucide';
import { OptimizeService } from './optimize.service';
import { HlmButtonDirective } from '../../ui/button';
import type { FeedbackItem } from './optimize.types';

@Component({
  selector: 'app-feedback-page',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideLoader2,
      lucideThumbsUp,
      lucideThumbsDown,
      lucideMessageSquare,
      lucideInbox,
      lucideBot,
      lucideLayoutList,
    }),
  ],
  template: `
    <div class="p-6 lg:p-8">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          (click)="goBack()"
        >
          <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
        </button>
        <div>
          <h1 class="text-2xl font-bold text-foreground">Feedback</h1>
          @if (flowName()) {
            <p class="mt-1 text-muted-foreground">
              {{ flowName() }} - {{ service.getFlowTypeLabel(flowType()) }}
            </p>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="mt-8 flex items-center justify-center py-12">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      } @else if (feedback().length === 0) {
        <!-- Empty state -->
        <div class="mt-8 rounded-lg border border-dashed bg-muted/50 p-12 text-center">
          <ng-icon name="lucideInbox" class="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 class="mt-4 text-lg font-semibold">No feedback yet</h3>
          <p class="mt-2 text-muted-foreground max-w-md mx-auto">
            Users haven't provided any feedback for this flow yet. Feedback will appear here once users interact with and rate the generated content.
          </p>
          <button
            hlmBtn
            variant="outline"
            class="mt-6"
            (click)="goBack()"
          >
            <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
            Back to Optimize
          </button>
        </div>
      } @else {
        <!-- Stats -->
        <div class="mt-6 grid gap-4 sm:grid-cols-3">
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideMessageSquare" class="h-4 w-4" />
              <span class="text-sm">Total Feedback</span>
            </div>
            <p class="mt-2 text-2xl font-bold">{{ feedback().length }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-green-600">
              <ng-icon name="lucideThumbsUp" class="h-4 w-4" />
              <span class="text-sm">Positive</span>
            </div>
            <p class="mt-2 text-2xl font-bold text-green-600">{{ positiveCount() }}</p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="flex items-center gap-2 text-red-600">
              <ng-icon name="lucideThumbsDown" class="h-4 w-4" />
              <span class="text-sm">Negative</span>
            </div>
            <p class="mt-2 text-2xl font-bold text-red-600">{{ negativeCount() }}</p>
          </div>
        </div>

        <!-- Feedback list -->
        <div class="mt-6 space-y-4">
          @for (item of feedback(); track item.id) {
            <div class="rounded-lg border bg-card p-4">
              <div class="flex items-start gap-4">
                <div
                  [class]="item.sentiment === 'positive'
                    ? 'rounded-full bg-green-100 p-2'
                    : 'rounded-full bg-red-100 p-2'"
                >
                  <ng-icon
                    [name]="item.sentiment === 'positive' ? 'lucideThumbsUp' : 'lucideThumbsDown'"
                    [class]="item.sentiment === 'positive' ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-red-600'"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-4">
                    <span [class]="item.sentiment === 'positive'
                      ? 'inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                      : 'inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'"
                    >
                      {{ item.sentiment === 'positive' ? 'Positive' : 'Negative' }}
                    </span>
                    <span class="text-sm text-muted-foreground">
                      {{ formatDate(item.createdAt) }}
                    </span>
                  </div>
                  @if (item.artifactTitle) {
                    <p class="mt-2 text-sm text-muted-foreground">
                      Artifact: <span class="font-medium text-foreground">{{ item.artifactTitle }}</span>
                    </p>
                  }
                  @if (item.text) {
                    <p class="mt-2 text-foreground">{{ item.text }}</p>
                  } @else {
                    <p class="mt-2 text-muted-foreground italic">No comment provided</p>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class FeedbackPageComponent implements OnInit {
  protected service = inject(OptimizeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected loading = signal(true);
  protected feedback = signal<FeedbackItem[]>([]);
  protected flowName = signal<string>('');
  protected flowType = signal<string>('');

  protected positiveCount = computed(() =>
    this.feedback().filter((f) => f.sentiment === 'positive').length
  );
  protected negativeCount = computed(() =>
    this.feedback().filter((f) => f.sentiment === 'negative').length
  );

  async ngOnInit(): Promise<void> {
    const flowId = this.route.snapshot.paramMap.get('flowId');
    if (!flowId) {
      this.router.navigate(['/optimize']);
      return;
    }

    const decodedId = decodeURIComponent(flowId);

    // Load flow details to get name and type
    const details = await this.service.getFlowDetails(decodedId);
    if (details) {
      this.flowName.set(details.name);
      this.flowType.set(details.type);
    }

    // Load feedback
    const feedbackData = await this.service.getFlowFeedback(decodedId);
    this.feedback.set(feedbackData);
    this.loading.set(false);
  }

  goBack(): void {
    this.router.navigate(['/optimize']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
