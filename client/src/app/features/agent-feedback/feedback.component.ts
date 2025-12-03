import { Component, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideThumbsUp,
  lucideThumbsDown,
  lucideLoader2,
  lucideSend,
  lucideCheck,
  lucideX,
  lucideDatabase,
} from '@ng-icons/lucide';
import { FeedbackService } from './feedback.service';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective],
  viewProviders: [
    provideIcons({
      lucideThumbsUp,
      lucideThumbsDown,
      lucideLoader2,
      lucideSend,
      lucideCheck,
      lucideX,
      lucideDatabase,
    }),
  ],
  template: `
    <div class="rounded-lg border bg-card p-4">
      <!-- Initial feedback buttons -->
      @if (!feedbackSubmitted()) {
        <div class="flex items-center gap-4">
          <span class="text-sm text-muted-foreground">Was this response helpful?</span>
          <div class="flex gap-2">
            <button
              hlmBtn
              variant="outline"
              size="sm"
              [disabled]="service.loading()"
              (click)="submitPositive()"
              class="hover:bg-green-50 hover:border-green-500 hover:text-green-600"
            >
              <ng-icon name="lucideThumbsUp" class="mr-1 h-4 w-4" />
              Yes
            </button>
            <button
              hlmBtn
              variant="outline"
              size="sm"
              [disabled]="service.loading()"
              (click)="showNegativeForm()"
              class="hover:bg-red-50 hover:border-red-500 hover:text-red-600"
            >
              <ng-icon name="lucideThumbsDown" class="mr-1 h-4 w-4" />
              No
            </button>
          </div>
        </div>
      }

      <!-- Negative feedback form -->
      @if (showingNegativeForm() && !feedbackSubmitted()) {
        <div class="mt-4 space-y-3">
          <label class="text-sm font-medium">How can this be improved?</label>
          <textarea
            class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
            placeholder="Tell us what went wrong or how we can improve..."
            [value]="feedbackText()"
            (input)="onTextInput($event)"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button
              hlmBtn
              variant="outline"
              size="sm"
              (click)="cancelNegative()"
              [disabled]="service.loading()"
            >
              Cancel
            </button>
            <button
              hlmBtn
              size="sm"
              [disabled]="service.loading()"
              (click)="submitNegative()"
            >
              @if (service.loading()) {
                <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
              } @else {
                <ng-icon name="lucideSend" class="mr-2 h-4 w-4" />
              }
              Submit
            </button>
          </div>
        </div>
      }

      <!-- Thank you message -->
      @if (feedbackSubmitted() && !service.showFactPrompt()) {
        <div class="flex items-center gap-2 text-sm text-green-600">
          <ng-icon name="lucideCheck" class="h-4 w-4" />
          <span>Thanks for your feedback!</span>
        </div>
      }

      <!-- Analyzing feedback -->
      @if (service.analyzing()) {
        <div class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader2" class="h-4 w-4 animate-spin" />
          <span>Analyzing your feedback...</span>
        </div>
      }

      <!-- Fact extraction prompt -->
      @if (service.showFactPrompt() && service.factAnalysis(); as analysis) {
        <div class="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div class="flex items-start gap-3">
            <ng-icon name="lucideDatabase" class="mt-0.5 h-5 w-5 text-primary" />
            <div class="flex-1">
              <h4 class="font-medium text-sm">Add to Knowledge Base?</h4>
              <p class="mt-1 text-sm text-muted-foreground">
                We detected a factual statement in your feedback:
              </p>
              <p class="mt-2 text-sm font-medium italic">
                "{{ analysis.extractedFact }}"
              </p>
              <p class="mt-2 text-sm text-muted-foreground">
                Would you like to add this fact to help improve future responses?
              </p>
              <div class="mt-3 flex gap-2">
                <button
                  hlmBtn
                  size="sm"
                  [disabled]="service.loading()"
                  (click)="approveFactClicked()"
                >
                  @if (service.loading()) {
                    <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                  } @else {
                    <ng-icon name="lucideCheck" class="mr-2 h-4 w-4" />
                  }
                  Yes, add it
                </button>
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  [disabled]="service.loading()"
                  (click)="rejectFactClicked()"
                >
                  <ng-icon name="lucideX" class="mr-2 h-4 w-4" />
                  No thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Error message -->
      @if (service.error()) {
        <div class="mt-4 text-sm text-red-600">
          {{ service.error() }}
        </div>
      }
    </div>
  `,
})
export class FeedbackComponent {
  protected service = inject(FeedbackService);

  // Inputs
  executionId = input.required<number>();
  knowledgeBaseId = input<number | null>(null);

  // Outputs
  feedbackSubmittedEvent = output<{ sentiment: 'positive' | 'negative'; text?: string }>();
  factApproved = output<{ factId: number; knowledgeBaseId: number }>();

  // Local state
  protected showingNegativeForm = signal(false);
  protected feedbackText = signal('');
  protected feedbackSubmitted = signal(false);

  async submitPositive(): Promise<void> {
    const feedback = await this.service.submitFeedback(this.executionId(), {
      sentiment: 'positive',
    });

    if (feedback) {
      this.feedbackSubmitted.set(true);
      this.feedbackSubmittedEvent.emit({ sentiment: 'positive' });
    }
  }

  showNegativeForm(): void {
    this.showingNegativeForm.set(true);
  }

  cancelNegative(): void {
    this.showingNegativeForm.set(false);
    this.feedbackText.set('');
  }

  async submitNegative(): Promise<void> {
    const feedback = await this.service.submitFeedback(this.executionId(), {
      sentiment: 'negative',
      text: this.feedbackText() || undefined,
    });

    if (feedback) {
      this.feedbackSubmitted.set(true);
      this.feedbackSubmittedEvent.emit({
        sentiment: 'negative',
        text: this.feedbackText() || undefined,
      });

      // If there's text, analyze for facts
      if (feedback.text) {
        await this.service.analyzeFeedback(feedback.id);
      }
    }
  }

  async approveFactClicked(): Promise<void> {
    const analysis = this.service.factAnalysis();
    const kbId = this.knowledgeBaseId();

    if (!analysis?.factId) return;

    // If no KB ID provided, we need to select one
    // For now, just emit and let parent handle
    if (kbId) {
      const success = await this.service.approveFact(analysis.factId, kbId);
      if (success) {
        this.factApproved.emit({ factId: analysis.factId, knowledgeBaseId: kbId });
      }
    } else {
      // TODO: Show KB selection dialog
      console.warn('No knowledge base ID provided for fact approval');
    }
  }

  async rejectFactClicked(): Promise<void> {
    const analysis = this.service.factAnalysis();
    if (analysis?.factId) {
      await this.service.rejectFact(analysis.factId);
    }
  }

  onTextInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.feedbackText.set(textarea.value);
  }
}
