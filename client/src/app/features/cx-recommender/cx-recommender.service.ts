/**
 * CX Improvement Recommender Service
 *
 * Handles API calls and state management for the CX Improvement Recommender feature.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  RecommenderSession,
  RecommenderSessionDetail,
  SessionStatusResponse,
  ContextSources,
  CreateSessionRequest,
  UpdateRecommendationRequest,
  AddCustomRecommendationRequest,
  Recommendation,
} from './cx-recommender.types';

@Injectable({ providedIn: 'root' })
export class CxRecommenderService {
  private http = inject(HttpClient);
  private baseUrl = '/api/cx/recommender';

  // State signals
  private _currentSession = signal<RecommenderSessionDetail | null>(null);
  private _sessions = signal<RecommenderSession[]>([]);
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

  async createSession(request: CreateSessionRequest): Promise<RecommenderSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<RecommenderSession>(`${this.baseUrl}/sessions`, request)
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

  async getSession(sessionId: number): Promise<RecommenderSessionDetail> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(
        this.http.get<RecommenderSessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
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

  async listSessions(userId?: number, reset = false): Promise<RecommenderSession[]> {
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
        this.http.get<RecommenderSession[]>(url)
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

  async retrySession(sessionId: number): Promise<RecommenderSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<RecommenderSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
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

  // --- Recommendation Management ---

  async updateRecommendation(recId: number, updates: UpdateRecommendationRequest): Promise<Recommendation> {
    this._error.set(null);

    try {
      const rec = await firstValueFrom(
        this.http.patch<Recommendation>(`${this.baseUrl}/recommendations/${recId}`, updates)
      );

      // Update local state
      this.updateRecommendationInState(rec);

      return rec;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update recommendation';
      this._error.set(message);
      throw err;
    }
  }

  async addCustomRecommendation(sessionId: number, request: AddCustomRecommendationRequest): Promise<Recommendation> {
    this._error.set(null);

    try {
      const rec = await firstValueFrom(
        this.http.post<Recommendation>(`${this.baseUrl}/sessions/${sessionId}/recommendations`, request)
      );

      // Update local state
      const current = this._currentSession();
      if (current && current.session.id === sessionId) {
        const category = rec.displayCategory;
        const newRecs = { ...current.recommendations };
        if (category === 'quick_wins') {
          newRecs.quickWins = [...newRecs.quickWins, rec];
        } else if (category === 'high_impact') {
          newRecs.highImpact = [...newRecs.highImpact, rec];
        } else {
          newRecs.strategic = [...newRecs.strategic, rec];
        }
        this._currentSession.set({ ...current, recommendations: newRecs });
      }

      return rec;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add recommendation';
      this._error.set(message);
      throw err;
    }
  }

  async dismissRecommendation(recId: number): Promise<void> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/recommendations/${recId}`)
      );

      // Remove from local state
      const current = this._currentSession();
      if (current) {
        const newRecs = {
          quickWins: current.recommendations.quickWins.filter(r => r.id !== recId),
          highImpact: current.recommendations.highImpact.filter(r => r.id !== recId),
          strategic: current.recommendations.strategic.filter(r => r.id !== recId),
        };
        this._currentSession.set({ ...current, recommendations: newRecs });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss recommendation';
      this._error.set(message);
      throw err;
    }
  }

  async restoreRecommendation(recId: number): Promise<Recommendation> {
    this._error.set(null);

    try {
      const rec = await firstValueFrom(
        this.http.post<Recommendation>(`${this.baseUrl}/recommendations/${recId}/restore`, {})
      );

      // Update local state
      this.updateRecommendationInState(rec);

      return rec;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to restore recommendation';
      this._error.set(message);
      throw err;
    }
  }

  private updateRecommendationInState(rec: Recommendation): void {
    const current = this._currentSession();
    if (!current) return;

    // Remove from old category
    const newRecs = {
      quickWins: current.recommendations.quickWins.filter(r => r.id !== rec.id),
      highImpact: current.recommendations.highImpact.filter(r => r.id !== rec.id),
      strategic: current.recommendations.strategic.filter(r => r.id !== rec.id),
    };

    // Add to new category
    const category = rec.displayCategory;
    if (category === 'quick_wins') {
      newRecs.quickWins = [...newRecs.quickWins, rec];
    } else if (category === 'high_impact') {
      newRecs.highImpact = [...newRecs.highImpact, rec];
    } else {
      newRecs.strategic = [...newRecs.strategic, rec];
    }

    this._currentSession.set({ ...current, recommendations: newRecs });
  }

  // --- Export ---

  async exportSession(sessionId: number, format: 'json' | 'csv' = 'json'): Promise<RecommenderSessionDetail> {
    try {
      const result = await firstValueFrom(
        this.http.get<RecommenderSessionDetail>(
          `${this.baseUrl}/sessions/${sessionId}/export?format=${format}`
        )
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export session';
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
  ): Promise<RecommenderSessionDetail> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getSessionStatus(sessionId);
      onProgress?.(status);

      if (status.status === 'completed') {
        return this.getSession(sessionId);
      }

      if (status.status === 'failed') {
        throw new Error(status.errorMessage || 'Recommendation generation failed');
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }

    throw new Error('Recommendation generation timed out');
  }

  // --- State Management ---

  clearCurrentSession(): void {
    this._currentSession.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }
}
