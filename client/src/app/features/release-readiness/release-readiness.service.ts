import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ReleaseReadinessSession,
  CreateSessionRequest,
  DefectStatusReport,
  WorkCompletionReport,
  AssessmentResult,
  AssessmentStatusResponse,
  IntegrationCheckResponse,
  ProjectOption,
  FixVersionOption,
  SprintOption,
  LabelOption,
} from './release-readiness.types';

@Injectable({ providedIn: 'root' })
export class ReleaseReadinessService {
  private http = inject(HttpClient);
  private apiUrl = '/api/release-readiness';

  // State signals
  sessions = signal<ReleaseReadinessSession[]>([]);
  currentSession = signal<ReleaseReadinessSession | null>(null);
  defectReport = signal<DefectStatusReport | null>(null);
  completionReport = signal<WorkCompletionReport | null>(null);
  assessment = signal<AssessmentResult | null>(null);
  integrationCheck = signal<IntegrationCheckResponse | null>(null);

  // Integration lookup options
  projects = signal<ProjectOption[]>([]);
  fixVersions = signal<FixVersionOption[]>([]);
  sprints = signal<SprintOption[]>([]);
  labels = signal<LabelOption[]>([]);

  loading = signal(false);
  loadingOptions = signal(false);
  assessing = signal(false);
  error = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed properties
  hasValidIntegration = computed(() => this.integrationCheck()?.has_valid_integration ?? false);
  isReady = computed(() => this.currentSession()?.status === 'ready');
  isAssessing = computed(() => this.currentSession()?.status === 'assessing' || this.assessing());

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
  // INTEGRATION LOOKUPS
  // =========================================================================

  async loadProjects(integrationId: number): Promise<ProjectOption[]> {
    this.loadingOptions.set(true);
    try {
      const result = await firstValueFrom(
        this.http.get<ProjectOption[]>(`${this.apiUrl}/integrations/${integrationId}/projects`)
      );
      this.projects.set(result);
      return result;
    } catch {
      this.projects.set([]);
      return [];
    } finally {
      this.loadingOptions.set(false);
    }
  }

  async loadFixVersions(integrationId: number, projectKey: string): Promise<FixVersionOption[]> {
    this.loadingOptions.set(true);
    try {
      const result = await firstValueFrom(
        this.http.get<FixVersionOption[]>(
          `${this.apiUrl}/integrations/${integrationId}/fix-versions`,
          { params: { project_key: projectKey } }
        )
      );
      this.fixVersions.set(result);
      return result;
    } catch {
      this.fixVersions.set([]);
      return [];
    } finally {
      this.loadingOptions.set(false);
    }
  }

  async loadSprints(integrationId: number): Promise<SprintOption[]> {
    this.loadingOptions.set(true);
    try {
      const result = await firstValueFrom(
        this.http.get<SprintOption[]>(`${this.apiUrl}/integrations/${integrationId}/sprints`)
      );
      this.sprints.set(result);
      return result;
    } catch {
      this.sprints.set([]);
      return [];
    } finally {
      this.loadingOptions.set(false);
    }
  }

  async loadLabels(integrationId: number, projectKey?: string): Promise<LabelOption[]> {
    this.loadingOptions.set(true);
    try {
      const params: Record<string, string> = {};
      if (projectKey) {
        params['project_key'] = projectKey;
      }
      const result = await firstValueFrom(
        this.http.get<LabelOption[]>(`${this.apiUrl}/integrations/${integrationId}/labels`, { params })
      );
      this.labels.set(result);
      return result;
    } catch {
      this.labels.set([]);
      return [];
    } finally {
      this.loadingOptions.set(false);
    }
  }

  clearOptions(): void {
    this.projects.set([]);
    this.fixVersions.set([]);
    this.sprints.set([]);
    this.labels.set([]);
  }

  // =========================================================================
  // SESSION CRUD
  // =========================================================================

  async loadSessions(): Promise<ReleaseReadinessSession[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<ReleaseReadinessSession[]>(`${this.apiUrl}/sessions`)
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

  async createSession(data: CreateSessionRequest): Promise<ReleaseReadinessSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<ReleaseReadinessSession>(`${this.apiUrl}/sessions`, data)
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

  async getSession(sessionId: number): Promise<ReleaseReadinessSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<ReleaseReadinessSession>(`${this.apiUrl}/sessions/${sessionId}`)
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
  // ASSESSMENT
  // =========================================================================

  async assessRelease(sessionId: number): Promise<AssessmentStatusResponse | null> {
    this.assessing.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<AssessmentStatusResponse>(`${this.apiUrl}/sessions/${sessionId}/assess`, {})
      );

      // Update current session status
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.update((s) =>
          s
            ? {
                ...s,
                status: result.status as ReleaseReadinessSession['status'],
                progressStep: result.progressStep,
                progressMessage: result.progressMessage,
                errorMessage: result.errorMessage,
              }
            : null
        );
      }

      // If still assessing, start polling
      if (result.status === 'assessing') {
        this.startPolling(sessionId);
      }

      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to start assessment';
      this.error.set(message);
      return null;
    } finally {
      this.assessing.set(false);
    }
  }

  async getAssessmentStatus(sessionId: number): Promise<AssessmentStatusResponse | null> {
    try {
      const result = await firstValueFrom(
        this.http.get<AssessmentStatusResponse>(`${this.apiUrl}/sessions/${sessionId}/status`)
      );

      // Update current session status
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.update((s) =>
          s
            ? {
                ...s,
                status: result.status as ReleaseReadinessSession['status'],
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
      const status = await this.getAssessmentStatus(sessionId);
      if (status && (status.status === 'ready' || status.status === 'error')) {
        this.stopPolling();

        // Reload data if assessment completed successfully
        if (status.status === 'ready') {
          await Promise.all([
            this.getSession(sessionId),
            this.loadDefectReport(sessionId),
            this.loadCompletionReport(sessionId),
            this.loadAssessment(sessionId),
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
  // REPORTS
  // =========================================================================

  async loadDefectReport(sessionId: number): Promise<DefectStatusReport | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<DefectStatusReport>(`${this.apiUrl}/sessions/${sessionId}/defects`)
      );
      this.defectReport.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load defect report';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async loadCompletionReport(sessionId: number): Promise<WorkCompletionReport | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<WorkCompletionReport>(`${this.apiUrl}/sessions/${sessionId}/completion`)
      );
      this.completionReport.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load completion report';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async loadAssessment(sessionId: number): Promise<AssessmentResult | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<AssessmentResult>(`${this.apiUrl}/sessions/${sessionId}/assessment`)
      );
      this.assessment.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load assessment';
      this.error.set(message);
      return null;
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
    this.defectReport.set(null);
    this.completionReport.set(null);
    this.assessment.set(null);
    this.integrationCheck.set(null);
    this.loading.set(false);
    this.assessing.set(false);
    this.error.set(null);
  }
}
