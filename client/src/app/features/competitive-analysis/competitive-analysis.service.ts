import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  CompetitiveAnalysisSession,
  CreateCompetitiveAnalysisRequest,
  ProblemAreaOption,
  SessionStatus,
} from './competitive-analysis.types';

@Injectable({ providedIn: 'root' })
export class CompetitiveAnalysisService {
  private http = inject(HttpClient);
  private baseUrl = '/api/competitive-analysis';

  // State
  sessions = signal<CompetitiveAnalysisSession[]>([]);
  currentSession = signal<CompetitiveAnalysisSession | null>(null);
  problemAreas = signal<ProblemAreaOption[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Pagination
  private skip = 0;
  private limit = 20;
  hasMore = signal(true);

  async loadProblemAreas(): Promise<void> {
    try {
      const areas = await firstValueFrom(
        this.http.get<ProblemAreaOption[]>(`${this.baseUrl}/problem-areas`)
      );
      this.problemAreas.set(areas);
    } catch (err) {
      console.error('Failed to load problem areas:', err);
    }
  }

  async loadSessions(reset = false): Promise<void> {
    if (reset) {
      this.skip = 0;
      this.sessions.set([]);
      this.hasMore.set(true);
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const sessions = await firstValueFrom(
        this.http.get<CompetitiveAnalysisSession[]>(
          `${this.baseUrl}/sessions?skip=${this.skip}&limit=${this.limit}`
        )
      );

      if (reset) {
        this.sessions.set(sessions);
      } else {
        this.sessions.update((current) => [...current, ...sessions]);
      }

      this.hasMore.set(sessions.length === this.limit);
      this.skip += sessions.length;
    } catch (err: any) {
      this.error.set(err?.message || 'Failed to load sessions');
    } finally {
      this.loading.set(false);
    }
  }

  async createSession(
    data: CreateCompetitiveAnalysisRequest
  ): Promise<CompetitiveAnalysisSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<CompetitiveAnalysisSession>(
          `${this.baseUrl}/sessions`,
          data
        )
      );
      // Add to the beginning of the list
      this.sessions.update((current) => [session, ...current]);
      return session;
    } catch (err: any) {
      this.error.set(err?.error?.detail || err?.message || 'Failed to create session');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async getSession(id: number): Promise<CompetitiveAnalysisSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.get<CompetitiveAnalysisSession>(`${this.baseUrl}/sessions/${id}`)
      );
      this.currentSession.set(session);
      return session;
    } catch (err: any) {
      this.error.set(err?.message || 'Failed to load session');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async getSessionStatus(id: number): Promise<SessionStatus | null> {
    try {
      return await firstValueFrom(
        this.http.get<SessionStatus>(`${this.baseUrl}/sessions/${id}/status`)
      );
    } catch (err) {
      return null;
    }
  }

  async deleteSession(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sessions/${id}`)
      );
      this.sessions.update((current) =>
        current.filter((s) => s.id !== id)
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  async retrySession(id: number): Promise<CompetitiveAnalysisSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.post<CompetitiveAnalysisSession>(
          `${this.baseUrl}/sessions/${id}/retry`,
          {}
        )
      );
      // Update in list
      this.sessions.update((current) =>
        current.map((s) => (s.id === id ? session : s))
      );
      return session;
    } catch (err) {
      return null;
    }
  }

  getProblemAreaLabel(value: string): string {
    const area = this.problemAreas().find((a) => a.value === value);
    return area?.label || value;
  }
}
