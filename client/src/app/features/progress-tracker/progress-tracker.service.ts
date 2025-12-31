import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  TrackerSession,
  CreateSessionRequest,
  UpdateSessionRequest,
  MetricsData,
  BlockersResponse,
  TrackedWorkItem,
  SyncStatusResponse,
  IntegrationCheckResponse,
  TemplateInfo,
  SprintOption,
} from './progress-tracker.types';

@Injectable({ providedIn: 'root' })
export class ProgressTrackerService {
  private http = inject(HttpClient);
  private apiUrl = '/api/progress-tracker';

  // State signals
  sessions = signal<TrackerSession[]>([]);
  currentSession = signal<TrackerSession | null>(null);
  metrics = signal<MetricsData | null>(null);
  blockers = signal<BlockersResponse | null>(null);
  items = signal<TrackedWorkItem[]>([]);
  templates = signal<TemplateInfo[]>([]);
  sprints = signal<SprintOption[]>([]);
  integrationCheck = signal<IntegrationCheckResponse | null>(null);

  loading = signal(false);
  syncing = signal(false);
  error = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed properties
  hasValidIntegration = computed(() => this.integrationCheck()?.hasValidIntegration ?? false);
  isReady = computed(() => this.currentSession()?.status === 'ready');
  isSyncing = computed(() => this.currentSession()?.status === 'syncing' || this.syncing());

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
  // TEMPLATES
  // =========================================================================

  async loadTemplates(provider?: string): Promise<TemplateInfo[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const params: Record<string, string> = {};
      if (provider) {
        params['provider'] = provider;
      }
      const result = await firstValueFrom(
        this.http.get<TemplateInfo[]>(`${this.apiUrl}/templates`, { params })
      );
      this.templates.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load templates';
      this.error.set(message);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // SPRINTS
  // =========================================================================

  async loadSprints(integrationId: number): Promise<SprintOption[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<SprintOption[]>(`${this.apiUrl}/integrations/${integrationId}/sprints`)
      );
      this.sprints.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load sprints';
      this.error.set(message);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // SESSION CRUD
  // =========================================================================

  async loadSessions(): Promise<TrackerSession[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<TrackerSession[]>(`${this.apiUrl}/sessions`)
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

  async createSession(data: CreateSessionRequest): Promise<TrackerSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<TrackerSession>(`${this.apiUrl}/sessions`, data)
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

  async getSession(sessionId: number): Promise<TrackerSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<TrackerSession>(`${this.apiUrl}/sessions/${sessionId}`)
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

  async updateSession(
    sessionId: number,
    data: UpdateSessionRequest
  ): Promise<TrackerSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.patch<TrackerSession>(`${this.apiUrl}/sessions/${sessionId}`, data)
      );
      this.currentSession.set(result);
      this.sessions.update((sessions) =>
        sessions.map((s) => (s.id === sessionId ? result : s))
      );
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update session';
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
  // SYNC & DATA
  // =========================================================================

  async syncSession(sessionId: number): Promise<SyncStatusResponse | null> {
    this.syncing.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<SyncStatusResponse>(`${this.apiUrl}/sessions/${sessionId}/sync`, {})
      );

      // Update current session status
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.update((s) =>
          s
            ? {
                ...s,
                status: result.status as TrackerSession['status'],
                progressStep: result.progressStep,
                progressMessage: result.progressMessage,
                errorMessage: result.errorMessage,
                itemsSynced: result.itemsSynced,
                lastSyncAt: result.lastSyncAt,
              }
            : null
        );
      }

      // If still syncing, start polling
      if (result.status === 'syncing') {
        this.startPolling(sessionId);
      }

      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to sync session';
      this.error.set(message);
      return null;
    } finally {
      this.syncing.set(false);
    }
  }

  async getSyncStatus(sessionId: number): Promise<SyncStatusResponse | null> {
    try {
      const result = await firstValueFrom(
        this.http.get<SyncStatusResponse>(`${this.apiUrl}/sessions/${sessionId}/status`)
      );

      // Update current session status
      if (this.currentSession()?.id === sessionId) {
        this.currentSession.update((s) =>
          s
            ? {
                ...s,
                status: result.status as TrackerSession['status'],
                progressStep: result.progressStep,
                progressMessage: result.progressMessage,
                errorMessage: result.errorMessage,
                itemsSynced: result.itemsSynced,
                lastSyncAt: result.lastSyncAt,
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
      const status = await this.getSyncStatus(sessionId);
      if (status && (status.status === 'ready' || status.status === 'error')) {
        this.stopPolling();

        // Reload data if sync completed successfully
        if (status.status === 'ready') {
          await Promise.all([
            this.getSession(sessionId),
            this.loadMetrics(sessionId),
            this.loadBlockers(sessionId),
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
  // METRICS & BLOCKERS
  // =========================================================================

  async loadMetrics(sessionId: number): Promise<MetricsData | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<MetricsData>(`${this.apiUrl}/sessions/${sessionId}/metrics`)
      );
      this.metrics.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load metrics';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async loadBlockers(sessionId: number): Promise<BlockersResponse | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<BlockersResponse>(`${this.apiUrl}/sessions/${sessionId}/blockers`)
      );
      this.blockers.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load blockers';
      this.error.set(message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async loadItems(
    sessionId: number,
    filters?: { statusCategory?: string; isBlocked?: boolean }
  ): Promise<TrackedWorkItem[]> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const params: Record<string, string> = {};
      if (filters?.statusCategory) {
        params['status_category'] = filters.statusCategory;
      }
      if (filters?.isBlocked !== undefined) {
        params['is_blocked'] = String(filters.isBlocked);
      }

      const result = await firstValueFrom(
        this.http.get<TrackedWorkItem[]>(`${this.apiUrl}/sessions/${sessionId}/items`, {
          params,
        })
      );
      this.items.set(result);
      return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load items';
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
    this.metrics.set(null);
    this.blockers.set(null);
    this.items.set([]);
    this.templates.set([]);
    this.sprints.set([]);
    this.integrationCheck.set(null);
    this.loading.set(false);
    this.syncing.set(false);
    this.error.set(null);
  }
}
