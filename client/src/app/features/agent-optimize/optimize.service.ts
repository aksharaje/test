import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  FlowItem,
  FlowOptimizationDetails,
  GeneratedOptimization,
  VersionInfo,
  FeedbackItem,
} from './optimize.types';

@Injectable({
  providedIn: 'root',
})
export class OptimizeService {
  private http = inject(HttpClient);

  // State
  private _flows = signal<FlowItem[]>([]);
  private _selectedFlow = signal<FlowOptimizationDetails | null>(null);
  private _generatedOptimization = signal<GeneratedOptimization | null>(null);
  private _feedbackList = signal<FeedbackItem[]>([]);
  private _loading = signal(false);
  private _generating = signal(false);
  private _error = signal<string | null>(null);

  // Public readonly signals
  readonly flows = this._flows.asReadonly();
  readonly selectedFlow = this._selectedFlow.asReadonly();
  readonly generatedOptimization = this._generatedOptimization.asReadonly();
  readonly feedbackList = this._feedbackList.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly generating = this._generating.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed
  readonly hasFlows = computed(() => this._flows().length > 0);
  readonly flowsWithNegativeFeedback = computed(() =>
    this._flows().filter((f) => f.feedbackStats.negativePercent > 30)
  );
  readonly agentFlows = computed(() =>
    this._flows().filter((f) => f.type === 'agent')
  );
  readonly storyGeneratorFlows = computed(() =>
    this._flows().filter((f) => f.type.startsWith('story_generator'))
  );

  /**
   * Load all flows with their feedback statistics
   */
  async loadFlows(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const flows = await firstValueFrom(
        this.http.get<FlowItem[]>('/api/optimize/flows')
      );
      this._flows.set(flows);
    } catch (err) {
      this._error.set('Failed to load flows');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Get optimization details for a specific flow
   */
  async getFlowDetails(flowId: string): Promise<FlowOptimizationDetails | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const encodedId = encodeURIComponent(flowId);
      const details = await firstValueFrom(
        this.http.get<FlowOptimizationDetails>(`/api/optimize/flows/${encodedId}`)
      );
      this._selectedFlow.set(details);
      return details;
    } catch (err) {
      this._error.set('Failed to load flow details');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Generate feedback summary for a flow
   */
  async getFeedbackSummary(flowId: string): Promise<string | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const encodedId = encodeURIComponent(flowId);
      const response = await firstValueFrom(
        this.http.post<{ summary: string }>(`/api/optimize/flows/${encodedId}/feedback-summary`, {})
      );
      return response.summary;
    } catch (err) {
      this._error.set('Failed to generate feedback summary');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Generate an optimized prompt based on feedback
   */
  async generateOptimizedPrompt(flowId: string): Promise<GeneratedOptimization | null> {
    this._generating.set(true);
    this._error.set(null);

    try {
      const encodedId = encodeURIComponent(flowId);
      const result = await firstValueFrom(
        this.http.post<GeneratedOptimization>(`/api/optimize/flows/${encodedId}/generate`, {})
      );
      this._generatedOptimization.set(result);
      return result;
    } catch (err) {
      this._error.set('Failed to generate optimized prompt');
      console.error(err);
      return null;
    } finally {
      this._generating.set(false);
    }
  }

  /**
   * Save an optimized prompt as a new draft version
   */
  async saveOptimizedPrompt(flowId: string, prompt: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const encodedId = encodeURIComponent(flowId);
      await firstValueFrom(
        this.http.post(`/api/optimize/flows/${encodedId}/save`, { prompt })
      );
      // Refresh flow details
      await this.getFlowDetails(flowId);
    } catch (err) {
      this._error.set('Failed to save optimized prompt');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Activate a prompt version (make it the default)
   */
  async activateVersion(flowId: string, versionId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const encodedId = encodeURIComponent(flowId);
      await firstValueFrom(
        this.http.post(`/api/optimize/flows/${encodedId}/activate/${versionId}`, {})
      );
      // Refresh flow details and list
      await this.getFlowDetails(flowId);
      await this.loadFlows();
    } catch (err) {
      this._error.set('Failed to activate version');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Create a split test for a flow
   */
  async createSplitTest(flowId: string, name: string, versionIds: number[]): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const encodedId = encodeURIComponent(flowId);
      await firstValueFrom(
        this.http.post(`/api/optimize/flows/${encodedId}/split-test`, {
          name,
          versionIds,
        })
      );
      // Refresh flow details
      await this.getFlowDetails(flowId);
    } catch (err) {
      this._error.set('Failed to create split test');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // UTILITIES
  // ==================

  clearError(): void {
    this._error.set(null);
  }

  clearGeneratedOptimization(): void {
    this._generatedOptimization.set(null);
  }

  clearSelectedFlow(): void {
    this._selectedFlow.set(null);
    this._generatedOptimization.set(null);
    this._feedbackList.set([]);
  }

  /**
   * Get feedback list for a flow
   */
  async getFlowFeedback(flowId: string): Promise<FeedbackItem[]> {
    try {
      const encodedId = encodeURIComponent(flowId);
      const feedback = await firstValueFrom(
        this.http.get<FeedbackItem[]>(`/api/optimize/flows/${encodedId}/feedback`)
      );
      this._feedbackList.set(feedback);
      return feedback;
    } catch (err) {
      console.error('Failed to load feedback:', err);
      return [];
    }
  }

  /**
   * Get icon name for a flow type
   */
  getFlowIcon(type: string): string {
    if (type === 'agent') return 'lucideBot';
    if (type.startsWith('story_generator')) return 'lucideLayoutList';
    return 'lucideZap';
  }

  /**
   * Get display label for a flow type
   */
  getFlowTypeLabel(type: string): string {
    switch (type) {
      case 'agent':
        return 'Agent';
      case 'story_generator_epic':
        return 'Epic Generator';
      case 'story_generator_feature':
        return 'Feature Generator';
      case 'story_generator_user_story':
        return 'User Story Generator';
      default:
        return 'Flow';
    }
  }
}
