import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Feedback,
  ExtractedFact,
  FactAnalysisResult,
  SubmitFeedbackRequest,
  ApprovFactRequest,
} from './feedback.types';

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private http = inject(HttpClient);

  // State
  private _currentFeedback = signal<Feedback | null>(null);
  private _factAnalysis = signal<FactAnalysisResult | null>(null);
  private _loading = signal(false);
  private _analyzing = signal(false);
  private _error = signal<string | null>(null);

  // Public readonly signals
  readonly currentFeedback = this._currentFeedback.asReadonly();
  readonly factAnalysis = this._factAnalysis.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly analyzing = this._analyzing.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed
  readonly showFactPrompt = computed(
    () => this._factAnalysis()?.isFact && this._factAnalysis()?.factId
  );

  /**
   * Submit feedback for an execution
   */
  async submitFeedback(
    executionId: number,
    data: SubmitFeedbackRequest
  ): Promise<Feedback | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const feedback = await firstValueFrom(
        this.http.post<Feedback>(`/api/executions/${executionId}/feedback`, data)
      );
      this._currentFeedback.set(feedback);
      return feedback;
    } catch (err) {
      this._error.set('Failed to submit feedback');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Analyze feedback for factual content
   * Should be called after negative feedback with text is submitted
   */
  async analyzeFeedback(feedbackId: number): Promise<FactAnalysisResult | null> {
    this._analyzing.set(true);
    this._error.set(null);

    try {
      const analysis = await firstValueFrom(
        this.http.post<FactAnalysisResult>(`/api/feedback/${feedbackId}/analyze`, {})
      );
      this._factAnalysis.set(analysis);
      return analysis;
    } catch (err) {
      this._error.set('Failed to analyze feedback');
      console.error(err);
      return null;
    } finally {
      this._analyzing.set(false);
    }
  }

  /**
   * Approve an extracted fact and add to knowledge base
   */
  async approveFact(
    factId: number,
    knowledgeBaseId: number
  ): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.post(`/api/facts/${factId}/approve`, { knowledgeBaseId })
      );
      this._factAnalysis.set(null);
      return true;
    } catch (err) {
      this._error.set('Failed to approve fact');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Reject an extracted fact
   */
  async rejectFact(factId: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.post(`/api/facts/${factId}/reject`, {})
      );
      this._factAnalysis.set(null);
      return true;
    } catch (err) {
      this._error.set('Failed to reject fact');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Reset state
   */
  reset(): void {
    this._currentFeedback.set(null);
    this._factAnalysis.set(null);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }
}
