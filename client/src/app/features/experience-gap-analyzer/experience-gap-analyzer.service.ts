/**
 * Experience Gap Analyzer Service
 *
 * Handles API calls and state management for the Experience Gap Analyzer feature.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  GapAnalysisSession,
  GapAnalysisSessionDetail,
  SessionStatusResponse,
  ContextSources,
  CreateGapAnalysisRequest,
  UpdateGapRequest,
  AddGapRequest,
  ReorderRoadmapRequest,
  GapItem,
} from './experience-gap-analyzer.types';

@Injectable({ providedIn: 'root' })
export class ExperienceGapAnalyzerService {
  private http = inject(HttpClient);
  private baseUrl = '/api/cx/gap-analyzer';

  // State signals
  private _currentSession = signal<GapAnalysisSessionDetail | null>(null);
  private _sessions = signal<GapAnalysisSession[]>([]);
  private _contextSources = signal<ContextSources | null>(null);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Pagination
  private _page = signal(0);
  private _hasMore = signal(true);
  private readonly pageSize = 20;

  // Readonly accessors
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly contextSources = this._contextSources.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();

  // --- Context Sources ---

  async loadContextSources(userId?: number): Promise<ContextSources> {
    this._loading.set(true);
    this._error.set(null);

    try {
      let url = `${this.baseUrl}/context-sources`;
      if (userId) {
        url += `?user_id=${userId}`;
      }
      const sources = await firstValueFrom(
        this.http.get<ContextSources>(url)
      );
      this._contextSources.set(sources);
      return sources;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load context sources';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Session Management ---

  async createSession(request: CreateGapAnalysisRequest): Promise<GapAnalysisSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<GapAnalysisSession>(`${this.baseUrl}/sessions`, request)
      );
      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async getSession(sessionId: number): Promise<GapAnalysisSessionDetail> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(
        this.http.get<GapAnalysisSessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
      );
      this._currentSession.set(detail);
      return detail;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async getSessionStatus(sessionId: number): Promise<SessionStatusResponse> {
    try {
      const status = await firstValueFrom(
        this.http.get<SessionStatusResponse>(`${this.baseUrl}/sessions/${sessionId}/status`)
      );
      return status;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get session status';
      this._error.set(message);
      throw err;
    }
  }

  async listSessions(userId?: number, reset = false): Promise<GapAnalysisSession[]> {
    if (reset) {
      this._page.set(0);
      this._hasMore.set(true);
      this._sessions.set([]);
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const skip = this._page() * this.pageSize;
      let url = `${this.baseUrl}/sessions?skip=${skip}&limit=${this.pageSize}`;
      if (userId) {
        url += `&user_id=${userId}`;
      }

      const sessions = await firstValueFrom(
        this.http.get<GapAnalysisSession[]>(url)
      );

      if (sessions.length < this.pageSize) {
        this._hasMore.set(false);
      }

      if (reset) {
        this._sessions.set(sessions);
      } else {
        this._sessions.set([...this._sessions(), ...sessions]);
      }
      this._page.set(this._page() + 1);

      return sessions;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list sessions';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteSession(sessionId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sessions/${sessionId}`)
      );

      // Remove from local state
      this._sessions.set(this._sessions().filter(s => s.id !== sessionId));
      if (this._currentSession()?.session.id === sessionId) {
        this._currentSession.set(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async retrySession(sessionId: number): Promise<GapAnalysisSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<GapAnalysisSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
      );
      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retry session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Gap Management ---

  async updateGap(gapId: number, updates: UpdateGapRequest): Promise<GapItem> {
    this._error.set(null);

    try {
      const gap = await firstValueFrom(
        this.http.patch<GapItem>(`${this.baseUrl}/gaps/${gapId}`, updates)
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        const updatedGaps = current.gaps.map(g => g.id === gapId ? gap : g);
        this._currentSession.set({ ...current, gaps: updatedGaps });
      }

      return gap;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update gap';
      this._error.set(message);
      throw err;
    }
  }

  async addGap(sessionId: number, request: AddGapRequest): Promise<GapItem> {
    this._error.set(null);

    try {
      const gap = await firstValueFrom(
        this.http.post<GapItem>(`${this.baseUrl}/sessions/${sessionId}/gaps`, request)
      );

      // Update local state
      const current = this._currentSession();
      if (current && current.session.id === sessionId) {
        this._currentSession.set({ ...current, gaps: [...current.gaps, gap] });
      }

      return gap;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add gap';
      this._error.set(message);
      throw err;
    }
  }

  async deleteGap(gapId: number): Promise<void> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/gaps/${gapId}`)
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        const updatedGaps = current.gaps.filter(g => g.id !== gapId);
        this._currentSession.set({ ...current, gaps: updatedGaps });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete gap';
      this._error.set(message);
      throw err;
    }
  }

  // --- Roadmap Management ---

  async reorderRoadmap(sessionId: number, request: ReorderRoadmapRequest): Promise<GapAnalysisSessionDetail> {
    this._error.set(null);

    try {
      const detail = await firstValueFrom(
        this.http.post<GapAnalysisSessionDetail>(
          `${this.baseUrl}/sessions/${sessionId}/reorder-roadmap`,
          request
        )
      );

      this._currentSession.set(detail);
      return detail;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reorder roadmap';
      this._error.set(message);
      throw err;
    }
  }

  // --- Export ---

  async exportAnalysis(sessionId: number, format: 'json' | 'pdf' = 'json'): Promise<GapAnalysisSessionDetail> {
    try {
      const result = await firstValueFrom(
        this.http.get<GapAnalysisSessionDetail>(
          `${this.baseUrl}/sessions/${sessionId}/export?format=${format}`
        )
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export analysis';
      this._error.set(message);
      throw err;
    }
  }

  // --- Polling ---

  async pollUntilComplete(
    sessionId: number,
    onProgress?: (status: SessionStatusResponse) => void,
    intervalMs = 2000,
    maxAttempts = 150
  ): Promise<GapAnalysisSessionDetail> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getSessionStatus(sessionId);
      onProgress?.(status);

      if (status.status === 'completed') {
        return this.getSession(sessionId);
      }

      if (status.status === 'failed') {
        throw new Error(status.errorMessage || 'Analysis failed');
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }

    throw new Error('Analysis timed out');
  }

  // --- State Management ---

  clearCurrentSession(): void {
    this._currentSession.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }
}
