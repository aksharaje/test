import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  GoalSettingSession,
  Goal,
  GoalSettingSessionCreate,
  GoalSettingFullResponse,
} from './goal-setting.types';

@Injectable({ providedIn: 'root' })
export class GoalSettingService {
  private http = inject(HttpClient);
  private baseUrl = '/api/goal-setting';

  // State
  sessions = signal<GoalSettingSession[]>([]);
  currentSession = signal<GoalSettingSession | null>(null);
  goals = signal<Goal[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  async loadSessions(skip = 0, limit = 20): Promise<void> {
    this.isLoading.set(true);
    try {
      const sessions = await this.http
        .get<GoalSettingSession[]>(`${this.baseUrl}/sessions`, {
          params: { skip: skip.toString(), limit: limit.toString() },
        })
        .toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load sessions');
    } finally {
      this.isLoading.set(false);
    }
  }

  async createSession(data: GoalSettingSessionCreate): Promise<GoalSettingSession | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http
        .post<GoalSettingSession>(`${this.baseUrl}/sessions`, data)
        .toPromise();
      if (session) {
        this.sessions.update((s) => [session, ...s]);
      }
      return session || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.message || 'Failed to create session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getSession(sessionId: number): Promise<GoalSettingSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http
        .get<GoalSettingSession>(`${this.baseUrl}/sessions/${sessionId}`)
        .toPromise();
      if (session) {
        this.currentSession.set(session);
      }
      return session || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getSessionFull(sessionId: number): Promise<GoalSettingFullResponse | null> {
    this.isLoading.set(true);
    try {
      const response = await this.http
        .get<GoalSettingFullResponse>(`${this.baseUrl}/sessions/${sessionId}/full`)
        .toPromise();
      if (response) {
        this.currentSession.set(response.session);
        this.goals.set(response.goals);
      }
      return response || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      await this.http.delete(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      this.sessions.update((s) => s.filter((session) => session.id !== sessionId));
      return true;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete session');
      return false;
    }
  }

  async retrySession(sessionId: number): Promise<GoalSettingSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http
        .post<GoalSettingSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
        .toPromise();
      if (session) {
        this.sessions.update((s) =>
          s.map((sess) => (sess.id === sessionId ? session : sess))
        );
      }
      return session || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to retry session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async pollSession(sessionId: number, intervalMs = 2000): Promise<GoalSettingSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    if (session.status === 'pending' || session.status === 'generating') {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      return this.pollSession(sessionId, intervalMs);
    }

    return session;
  }
}
