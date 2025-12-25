/**
 * Ideation Service
 *
 * HTTP service and state management for ideation workflow.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  IdeationSession,
  SessionDetail,
  GeneratedIdea,
  CreateSessionRequest,
} from './ideation.types';
import type { KnowledgeBase } from '../knowledge-bases/knowledge-base.types';

@Injectable({
  providedIn: 'root',
})
export class IdeationService {
  private http = inject(HttpClient);
  private baseUrl = '/api/ideation';

  // State
  private _currentSession = signal<SessionDetail | null>(null);
  private _sessions = signal<IdeationSession[]>([]);
  private _knowledgeBases = signal<KnowledgeBase[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _hasMore = signal(true);
  private _page = signal(0);
  private readonly pageSize = 20;

  // Readonly accessors
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly knowledgeBases = this._knowledgeBases.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();

  // Create session and start processing
  async createSession(request: CreateSessionRequest): Promise<IdeationSession | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<IdeationSession>(`${this.baseUrl}/sessions`, request)
      );
      // Prepend to current list
      this._sessions.update(current => [session, ...current]);
      return session;
    } catch (err: any) {
      const message = err?.error?.detail || 'Failed to create session';
      this._error.set(message);
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Poll session status
  async pollSessionStatus(sessionId: number): Promise<IdeationSession | null> {
    try {
      return await firstValueFrom(
        this.http.get<IdeationSession>(`${this.baseUrl}/sessions/${sessionId}/status`)
      );
    } catch (err) {
      console.error('Poll error:', err);
      return null;
    }
  }

  // Get session detail (results)
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
      this._error.set('Failed to load session');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // List sessions (Pagination support)
  async loadSessions(reset = false): Promise<void> {
    if (this._loading() && !reset) return; // Prevent concurrent loads unless resetting
    this._loading.set(true);

    if (reset) {
      this._page.set(0);
      this._hasMore.set(true);
      this._sessions.set([]);
    }

    try {
      const skip = this._page() * this.pageSize;
      const sessions = await firstValueFrom(
        this.http.get<IdeationSession[]>(`${this.baseUrl}/sessions?skip=${skip}&limit=${this.pageSize}`)
      );

      if (sessions.length < this.pageSize) {
        this._hasMore.set(false);
      }

      this._sessions.update(current => reset ? sessions : [...current, ...sessions]);
      this._page.update(p => p + 1);

    } catch (err) {
      this._error.set('Failed to load sessions');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // Retry session
  async retrySession(sessionId: number): Promise<IdeationSession | null> {
    this._loading.set(true);
    try {
      const session = await firstValueFrom(
        this.http.post<IdeationSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
      );

      // Update in local list
      this._sessions.update(current =>
        current.map(s => s.id === sessionId ? session : s)
      );

      return session;
    } catch (err) {
      console.error('Retry error:', err);
      this._error.set('Failed to retry session');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Update idea
  async updateIdea(ideaId: number, data: Partial<GeneratedIdea>): Promise<GeneratedIdea | null> {
    try {
      const updated = await firstValueFrom(
        this.http.patch<GeneratedIdea>(`${this.baseUrl}/ideas/${ideaId}`, data)
      );

      // Update in current session
      const current = this._currentSession();
      if (current) {
        const updatedIdeas = current.ideas.map(idea =>
          idea.id === ideaId ? updated : idea
        );
        this._currentSession.set({ ...current, ideas: updatedIdeas });
      }

      return updated;
    } catch (err) {
      console.error('Update error:', err);
      return null;
    }
  }

  // Delete session
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

  // Load knowledge bases
  async loadKnowledgeBases(): Promise<void> {
    try {
      const kbs = await firstValueFrom(
        this.http.get<KnowledgeBase[]>('/api/knowledge-bases')
      );
      this._knowledgeBases.set(kbs);
    } catch (err) {
      console.error('Failed to load knowledge bases:', err);
    }
  }

  clearError(): void {
    this._error.set(null);
  }
}
