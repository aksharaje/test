/**
 * Opportunity Linker Service
 *
 * HTTP service and state management for opportunity mapping workflow.
 * Manages prioritization sessions that map ideas to opportunities and
 * calculate priority scores using AI agents.
 *
 * @example
 * ```typescript
 * // Create a new prioritization session
 * const session = await service.createSession({ ideationSessionId: 123 });
 *
 * // Poll for completion
 * const status = await service.pollSessionStatus(session.id);
 *
 * // Get full results
 * const detail = await service.getSessionDetail(session.id);
 * ```
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  PrioritizationSession,
  SessionDetail,
  CreateSessionRequest,
} from './opportunity-linker.types';

@Injectable({
  providedIn: 'root',
})
export class OpportunityLinkerService {
  private http = inject(HttpClient);
  private baseUrl = '/api/opportunity-linker';

  /** Private signal for current session detail */
  private _currentSession = signal<SessionDetail | null>(null);

  /** Private signal for all sessions list */
  private _sessions = signal<PrioritizationSession[]>([]);

  /** Private signal for loading state */
  private _loading = signal(false);

  /** Private signal for error messages */
  private _error = signal<string | null>(null);

  /** Current session detail with prioritized ideas (readonly) */
  readonly currentSession = this._currentSession.asReadonly();

  /** List of all prioritization sessions (readonly) */
  readonly sessions = this._sessions.asReadonly();

  /** Loading state indicator (readonly) */
  readonly loading = this._loading.asReadonly();

  /** Error message from last operation (readonly) */
  readonly error = this._error.asReadonly();

  /**
   * Create a new prioritization session and start background processing.
   *
   * Initiates the opportunity mapping workflow on a completed ideation session.
   * Processing happens in the background via 4 AI agents.
   *
   * @param request - Contains ideationSessionId to process
   * @returns Created session with "pending" status, or null on error
   *
   * @example
   * ```typescript
   * const session = await service.createSession({ ideationSessionId: 123 });
   * if (session) {
   *   console.log('Session created:', session.id);
   * }
   * ```
   */
  async createSession(request: CreateSessionRequest): Promise<PrioritizationSession | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/sessions`, request)
      );
      return session;
    } catch (err: any) {
      const message = err?.error?.detail || 'Failed to create prioritization session';
      this._error.set(message);
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Poll session status for progress updates.
   *
   * Use this to check if background processing has completed.
   * Does not update the service's state signals.
   *
   * @param sessionId - Session ID to poll
   * @returns Session status object or null on error
   *
   * @example
   * ```typescript
   * const status = await service.pollSessionStatus(123);
   * if (status?.status === 'completed') {
   *   // Processing finished, load full results
   * }
   * ```
   */
  async pollSessionStatus(sessionId: number): Promise<PrioritizationSession | null> {
    try {
      return await firstValueFrom(
        this.http.get<PrioritizationSession>(`${this.baseUrl}/sessions/${sessionId}/status`)
      );
    } catch (err) {
      console.error('Poll error:', err);
      return null;
    }
  }

  /**
   * Get full session detail with all prioritized ideas.
   *
   * Fetches the complete results including session metadata,
   * prioritized ideas with scores, and portfolio summary.
   * Updates the currentSession signal.
   *
   * @param sessionId - Session ID to fetch
   * @returns Session detail with ideas array, or null on error
   *
   * @example
   * ```typescript
   * const detail = await service.getSessionDetail(123);
   * if (detail) {
   *   console.log('Ideas:', detail.ideas.length);
   *   console.log('Portfolio:', detail.session.portfolioSummary);
   * }
   * ```
   */
  async getSessionDetail(sessionId: number): Promise<SessionDetail | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(
        this.http.get<SessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
      );
      this._currentSession.set(detail);
      return detail;
    } catch (err) {
      this._error.set('Failed to load prioritization session');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Load all prioritization sessions.
   *
   * Fetches session list and updates the sessions signal.
   * Sessions are ordered by creation date (newest first).
   *
   * @example
   * ```typescript
   * await service.loadSessions();
   * console.log('Sessions:', service.sessions().length);
   * ```
   */
  async loadSessions(): Promise<void> {
    this._loading.set(true);
    try {
      const sessions = await firstValueFrom(
        this.http.get<PrioritizationSession[]>(`${this.baseUrl}/sessions`)
      );
      this._sessions.set(sessions);
    } catch (err) {
      this._error.set('Failed to load sessions');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Delete a prioritization session and all its prioritized ideas.
   *
   * Removes the session from the sessions signal on success.
   *
   * @param sessionId - Session ID to delete
   * @returns true on success, false on error
   *
   * @example
   * ```typescript
   * const deleted = await service.deleteSession(123);
   * if (deleted) {
   *   console.log('Session deleted successfully');
   * }
   * ```
   */
  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sessions/${sessionId}`)
      );
      this._sessions.update(arr => arr.filter(s => s.id !== sessionId));
      return true;
    } catch (err) {
      console.error('Delete error:', err);
      return false;
    }
  }

  /**
   * Clear the current error message.
   *
   * @example
   * ```typescript
   * service.clearError();
   * ```
   */
  clearError(): void {
    this._error.set(null);
  }
}
