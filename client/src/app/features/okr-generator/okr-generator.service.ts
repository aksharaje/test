import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { OkrSession, Objective, Kpi, OkrSessionCreate, OkrFullResponse } from './okr-generator.types';
import type { GoalSettingSession, Goal } from '../goal-setting/goal-setting.types';

export interface GoalForSelection extends Goal {
  selected: boolean;
}

@Injectable({ providedIn: 'root' })
export class OkrGeneratorService {
  private http = inject(HttpClient);
  private baseUrl = '/api/okr-generator';

  sessions = signal<OkrSession[]>([]);
  currentSession = signal<OkrSession | null>(null);
  objectives = signal<Objective[]>([]);
  kpis = signal<Kpi[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Goal Setting integration
  goalSettingSessions = signal<GoalSettingSession[]>([]);
  selectedGoalSession = signal<GoalSettingSession | null>(null);
  private _goalsForSelection = signal<GoalForSelection[]>([]);
  readonly goalsForSelection = this._goalsForSelection.asReadonly();

  async loadSessions(skip = 0, limit = 20): Promise<void> {
    this.isLoading.set(true);
    try {
      const sessions = await this.http.get<OkrSession[]>(`${this.baseUrl}/sessions`, {
        params: { skip: skip.toString(), limit: limit.toString() },
      }).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load sessions');
    } finally {
      this.isLoading.set(false);
    }
  }

  async createSession(data: OkrSessionCreate): Promise<OkrSession | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http.post<OkrSession>(`${this.baseUrl}/sessions`, data).toPromise();
      if (session) this.sessions.update((s) => [session, ...s]);
      return session || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.message || 'Failed to create session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getSession(sessionId: number): Promise<OkrSession | null> {
    try {
      const session = await this.http.get<OkrSession>(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load session');
      return null;
    }
  }

  async getSessionFull(sessionId: number): Promise<OkrFullResponse | null> {
    this.isLoading.set(true);
    try {
      const response = await this.http.get<OkrFullResponse>(`${this.baseUrl}/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.currentSession.set(response.session);
        this.objectives.set(response.objectives);
        this.kpis.set(response.kpis);
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

  async retrySession(sessionId: number): Promise<OkrSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http.post<OkrSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {}).toPromise();
      if (session) this.sessions.update((s) => s.map((sess) => (sess.id === sessionId ? session : sess)));
      return session || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to retry session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Goal Setting integration methods
  async loadGoalSettingSessions(): Promise<void> {
    try {
      const sessions = await this.http.get<GoalSettingSession[]>('/api/goal-setting/sessions', {
        params: { limit: '50' },
      }).toPromise();
      // Only show completed sessions
      this.goalSettingSessions.set((sessions || []).filter(s => s.status === 'completed'));
    } catch (err: any) {
      console.error('Failed to load goal setting sessions:', err);
    }
  }

  async loadGoalsForSession(sessionId: number): Promise<void> {
    try {
      const response = await this.http.get<{ session: GoalSettingSession; goals: Goal[] }>(
        `/api/goal-setting/sessions/${sessionId}/full`
      ).toPromise();
      if (response) {
        this.selectedGoalSession.set(response.session);
        // Convert to GoalForSelection with all selected by default
        this._goalsForSelection.set(response.goals.map(g => ({ ...g, selected: true })));
      }
    } catch (err: any) {
      console.error('Failed to load goals:', err);
      this._goalsForSelection.set([]);
    }
  }

  clearGoalSelection(): void {
    this.selectedGoalSession.set(null);
    this._goalsForSelection.set([]);
  }

  // Goal selection methods
  toggleGoalSelection(goalId: number): void {
    this._goalsForSelection.update((goals) =>
      goals.map((g) => (g.id === goalId ? { ...g, selected: !g.selected } : g))
    );
  }

  selectAllGoals(): void {
    this._goalsForSelection.update((goals) =>
      goals.map((g) => ({ ...g, selected: true }))
    );
  }

  deselectAllGoals(): void {
    this._goalsForSelection.update((goals) =>
      goals.map((g) => ({ ...g, selected: false }))
    );
  }

  buildGoalDescription(): string {
    const goals = this._goalsForSelection().filter(g => g.selected);
    if (goals.length === 0) return '';

    return goals.map((g, i) =>
      `Goal ${i + 1}: ${g.title}\n${g.description}`
    ).join('\n\n');
  }
}
