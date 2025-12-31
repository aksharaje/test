import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  DefectManagerSession,
  CreateSessionRequest,
  TriageResult,
  PreventionRecommendation,
  AnalysisStatusResponse,
  IntegrationCheckResponse,
} from './defect-manager.types';

@Injectable({ providedIn: 'root' })
export class DefectManagerService {
  private http = inject(HttpClient);
  private apiUrl = '/api/defect-manager';

  // State signals
  sessions = signal<DefectManagerSession[]>([]);
  currentSession = signal<DefectManagerSession | null>(null);
  triageResult = signal<TriageResult | null>(null);
  recommendations = signal<PreventionRecommendation[]>([]);
  integrationCheck = signal<IntegrationCheckResponse | null>(null);

  loading = signal(false);
  analyzing = signal(false);
  error = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed properties
  hasValidIntegration = computed(() => this.integrationCheck()?.hasValidIntegration ?? false);
  isReady = computed(() => this.currentSession()?.status === 'ready');
  isAnalyzing = computed(() => this.currentSession()?.status === 'analyzing' || this.analyzing());

  // =========================================================================
  // INTEGRATION CHECK
  // =========================================================================

  async checkIntegrations(): Promise<IntegrationCheckResponse | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<IntegrationCheckResponse>(`${this.apiUrl}/integrations/check`)
      );
      this.integrationCheck.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to check integrations';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // SESSION CRUD
  // =========================================================================

  async loadSessions(): Promise<DefectManagerSession[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<DefectManagerSession[]>(`${this.apiUrl}/sessions`)
      );
      this.sessions.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load sessions';
      this.error.set(message);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async createSession(data: CreateSessionRequest): Promise<DefectManagerSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<DefectManagerSession>(`${this.apiUrl}/sessions`, data)
      );
      this.currentSession.set(result);
      this.sessions.update((s) => [result, ...s]);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create session';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async getSession(sessionId: number): Promise<DefectManagerSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<DefectManagerSession>(`${this.apiUrl}/sessions/${sessionId}`)
      );
      this.currentSession.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load session';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.http.delete<{ success: boolean }>(`${this.apiUrl}/sessions/${sessionId}`)
      );
      this.sessions.update((sessions) => sessions.filter((s) => s.id !== sessionId));
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.set(null);
      }
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete session';
      this.error.set(message);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // ANALYSIS
  // =========================================================================

  async analyzeSession(sessionId: number): Promise<AnalysisStatusResponse | null> {
    this.analyzing.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<AnalysisStatusResponse>(`${this.apiUrl}/sessions/${sessionId}/analyze`, {})
      );

      // Update current session status
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.update((s) =>
          s
            ? {
                ...s,
                status: result.status as DefectManagerSession['status'],
                progressStep: result.progressStep,
                progressMessage: result.progressMessage,
                errorMessage: result.errorMessage,
              }
            : null
        );
      }

      // If still analyzing, start polling
      if (result.status === 'analyzing') {
        this.startPolling(sessionId);
      }

      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to start analysis';
      this.error.set(message);
      return null;
    } finally {
      this.analyzing.set(false);
    }
  }

  async getAnalysisStatus(sessionId: number): Promise<AnalysisStatusResponse | null> {
    try {
      const result = await firstValueFrom(
        this.http.get<AnalysisStatusResponse>(`${this.apiUrl}/sessions/${sessionId}/status`)
      );

      // Update current session status
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.update((s) =>
          s
            ? {
                ...s,
                status: result.status as DefectManagerSession['status'],
                progressStep: result.progressStep,
                progressMessage: result.progressMessage,
                errorMessage: result.errorMessage,
              }
            : null
        );
      }

      return result;
    } catch {
      return null;
    }
  }

  startPolling(sessionId: number, intervalMs = 2000): void {
    this.stopPolling();

    this.pollInterval = setInterval(async () => {
      const status = await this.getAnalysisStatus(sessionId);
      if (status && (status.status === 'ready' || status.status === 'error')) {
        this.stopPolling();

        // Reload data if analysis completed successfully
        if (status.status === 'ready') {
          await Promise.all([
            this.getSession(sessionId),
            this.loadTriageResult(sessionId),
            this.loadRecommendations(sessionId),
          ]);
        }
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // =========================================================================
  // TRIAGE & RECOMMENDATIONS
  // =========================================================================

  async loadTriageResult(sessionId: number): Promise<TriageResult | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<TriageResult>(`${this.apiUrl}/sessions/${sessionId}/triage`)
      );
      this.triageResult.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load triage result';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async loadRecommendations(sessionId: number): Promise<PreventionRecommendation[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<PreventionRecommendation[]>(`${this.apiUrl}/sessions/${sessionId}/recommendations`)
      );
      this.recommendations.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load recommendations';
      this.error.set(message);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  clearError(): void {
    this.error.set(null);
  }

  reset(): void {
    this.stopPolling();
    this.sessions.set([]);
    this.currentSession.set(null);
    this.triageResult.set(null);
    this.recommendations.set([]);
    this.integrationCheck.set(null);
    this.loading.set(false);
    this.analyzing.set(false);
    this.error.set(null);
  }
}
