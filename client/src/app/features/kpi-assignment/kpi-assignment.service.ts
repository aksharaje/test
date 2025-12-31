import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  KpiAssignmentSession,
  KpiAssignment,
  KeyResultWithAssignment,
  GoalWithKpi,
  KpiAssignmentSessionCreate,
  KpiAssignmentCreate,
  KpiAssignmentFullResponse,
  KpiAssignmentFullItem,
} from './kpi-assignment.types';
import type { GoalSettingSession, Goal } from '../goal-setting/goal-setting.types';

@Injectable({ providedIn: 'root' })
export class KpiAssignmentService {
  private http = inject(HttpClient);
  private baseUrl = '/api/kpi-assignment';

  sessions = signal<KpiAssignmentSession[]>([]);
  currentSession = signal<KpiAssignmentSession | null>(null);
  assignments = signal<KpiAssignmentFullItem[]>([]);
  items = signal<KeyResultWithAssignment[]>([]);  // Legacy
  goals = signal<GoalWithKpi[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Goal Setting integration
  goalSettingSessions = signal<GoalSettingSession[]>([]);
  selectedGoalSession = signal<GoalSettingSession | null>(null);
  selectedGoals = signal<Goal[]>([]);

  async loadSessions(skip = 0, limit = 20): Promise<void> {
    this.isLoading.set(true);
    try {
      const sessions = await this.http.get<KpiAssignmentSession[]>(`${this.baseUrl}/sessions`, {
        params: { skip: skip.toString(), limit: limit.toString() },
      }).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load sessions');
    } finally {
      this.isLoading.set(false);
    }
  }

  async createSession(data: KpiAssignmentSessionCreate): Promise<KpiAssignmentSession | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http.post<KpiAssignmentSession>(`${this.baseUrl}/sessions`, data).toPromise();
      if (session) this.sessions.update((s) => [session, ...s]);
      return session || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.message || 'Failed to create session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getSession(sessionId: number): Promise<KpiAssignmentSession | null> {
    try {
      const session = await this.http.get<KpiAssignmentSession>(
        `${this.baseUrl}/sessions/${sessionId}`
      ).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.statusText || 'Failed to load session');
      return null;
    }
  }

  async getSessionByOkr(okrSessionId: number): Promise<KpiAssignmentSession | null> {
    try {
      const session = await this.http.get<KpiAssignmentSession>(
        `${this.baseUrl}/sessions/by-okr/${okrSessionId}`
      ).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.statusText || 'Failed to load session');
      return null;
    }
  }

  async getSessionFull(sessionId: number): Promise<KpiAssignmentFullResponse | null> {
    this.isLoading.set(true);
    try {
      const response = await this.http.get<KpiAssignmentFullResponse>(
        `${this.baseUrl}/sessions/${sessionId}/full`
      ).toPromise();
      if (response) {
        this.currentSession.set(response.session);
        this.assignments.set(response.assignments || []);
      }
      return response || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.statusText || 'Failed to load session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async retrySession(sessionId: number): Promise<KpiAssignmentSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http.post<KpiAssignmentSession>(
        `${this.baseUrl}/sessions/${sessionId}/retry`,
        {}
      ).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.statusText || 'Failed to retry session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveAssignment(sessionId: number, data: KpiAssignmentCreate): Promise<KpiAssignment | null> {
    try {
      const assignment = await this.http.post<KpiAssignment>(
        `${this.baseUrl}/sessions/${sessionId}/assignments`,
        data
      ).toPromise();
      // Update local state
      if (assignment) {
        this.items.update((items) =>
          items.map((item) =>
            item.keyResult.id === data.keyResultId
              ? {
                  ...item,
                  assignment: {
                    id: assignment.id,
                    primaryKpi: assignment.primaryKpi,
                    measurementUnit: assignment.measurementUnit,
                    secondaryKpi: assignment.secondaryKpi,
                    checkFrequency: assignment.checkFrequency,
                  },
                }
              : item
          )
        );
      }
      return assignment || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to save assignment');
      return null;
    }
  }

  async completeSession(sessionId: number): Promise<KpiAssignmentSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http.post<KpiAssignmentSession>(
        `${this.baseUrl}/sessions/${sessionId}/complete`,
        {}
      ).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to complete session');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getKpiSuggestions(keyResultId: number): Promise<string[]> {
    try {
      const suggestions = await this.http.get<string[]>(
        `${this.baseUrl}/key-results/${keyResultId}/suggestions`
      ).toPromise();
      return suggestions || [];
    } catch {
      return [];
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
        this.selectedGoals.set(response.goals);
        // Convert to GoalWithKpi format
        this.goals.set(response.goals.map(goal => ({
          goal: {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            category: goal.category,
            priority: goal.priority,
            timeframe: goal.timeframe,
          },
          assignment: null,
        })));
      }
    } catch (err: any) {
      console.error('Failed to load goals:', err);
      this.selectedGoals.set([]);
      this.goals.set([]);
    }
  }

  async getSessionByGoal(goalSessionId: number): Promise<KpiAssignmentSession | null> {
    try {
      const session = await this.http.get<KpiAssignmentSession>(
        `${this.baseUrl}/sessions/by-goal/${goalSessionId}`
      ).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) {
      // If not found, create a new session
      if (err.status === 404) {
        return this.createSession({ goalSessionId });
      }
      this.error.set(err.error?.detail || err.statusText || 'Failed to load session');
      return null;
    }
  }

  async saveGoalAssignment(sessionId: number, data: KpiAssignmentCreate): Promise<KpiAssignment | null> {
    try {
      const assignment = await this.http.post<KpiAssignment>(
        `${this.baseUrl}/sessions/${sessionId}/assignments`,
        data
      ).toPromise();
      // Update local goals state
      if (assignment) {
        this.goals.update((goals) =>
          goals.map((item) =>
            item.goal.id === data.goalId
              ? {
                  ...item,
                  assignment: {
                    id: assignment.id,
                    primaryKpi: assignment.primaryKpi,
                    measurementUnit: assignment.measurementUnit,
                    secondaryKpi: assignment.secondaryKpi,
                    checkFrequency: assignment.checkFrequency,
                  },
                }
              : item
          )
        );
      }
      return assignment || null;
    } catch (err: any) {
      this.error.set(err.error?.detail || err.statusText || 'Failed to save assignment');
      return null;
    }
  }

  clearGoalSelection(): void {
    this.selectedGoalSession.set(null);
    this.selectedGoals.set([]);
    this.goals.set([]);
  }
}
