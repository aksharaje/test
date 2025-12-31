import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { ScopeMonitorSession, ScopeChange, ImpactAssessment, ScopeAlert, ScopeMonitorSessionCreate, ScopeMonitorFullResponse } from './scope-monitor.types';
import type { ScopeDefinitionSession, ScopeItem, ScopeDefinitionFullResponse } from '../scope-definition/scope-definition.types';

@Injectable({ providedIn: 'root' })
export class ScopeMonitorService {
  private http = inject(HttpClient);
  private baseUrl = '/api/scope-monitor';

  sessions = signal<ScopeMonitorSession[]>([]);
  currentSession = signal<ScopeMonitorSession | null>(null);
  scopeCreepChanges = signal<ScopeChange[]>([]);
  otherChanges = signal<ScopeChange[]>([]);
  impactAssessments = signal<ImpactAssessment[]>([]);
  alerts = signal<ScopeAlert[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Scope Definition data for import
  scopeDefinitionSessions = signal<ScopeDefinitionSession[]>([]);
  selectedScopeDefinition = signal<ScopeDefinitionSession | null>(null);
  scopeDefinitionItems = signal<ScopeItem[]>([]);

  async loadSessions(skip = 0, limit = 20): Promise<void> {
    this.isLoading.set(true);
    try {
      const sessions = await this.http.get<ScopeMonitorSession[]>(`${this.baseUrl}/sessions`, { params: { skip: skip.toString(), limit: limit.toString() } }).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) { this.error.set(err.message); } finally { this.isLoading.set(false); }
  }

  async createSession(data: ScopeMonitorSessionCreate): Promise<ScopeMonitorSession | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http.post<ScopeMonitorSession>(`${this.baseUrl}/sessions`, data).toPromise();
      if (session) this.sessions.update((s) => [session, ...s]);
      return session || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; } finally { this.isLoading.set(false); }
  }

  async getSession(sessionId: number): Promise<ScopeMonitorSession | null> {
    try {
      const session = await this.http.get<ScopeMonitorSession>(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) { this.error.set(err.message); return null; }
  }

  async getSessionFull(sessionId: number): Promise<ScopeMonitorFullResponse | null> {
    this.isLoading.set(true);
    try {
      const response = await this.http.get<ScopeMonitorFullResponse>(`${this.baseUrl}/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.currentSession.set(response.session);
        this.scopeCreepChanges.set(response.scope_creep_changes || []);
        this.otherChanges.set(response.other_changes || []);
        this.impactAssessments.set(response.impact_assessments || []);
        this.alerts.set(response.alerts || []);
      }
      return response || null;
    } catch (err: any) { this.error.set(err.message); return null; } finally { this.isLoading.set(false); }
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      await this.http.delete(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      this.sessions.update((s) => s.filter((session) => session.id !== sessionId));
      return true;
    } catch (err: any) { this.error.set(err.message); return false; }
  }

  async retrySession(sessionId: number): Promise<ScopeMonitorSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http.post<ScopeMonitorSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {}).toPromise();
      if (session) this.sessions.update((s) => s.map((sess) => (sess.id === sessionId ? session : sess)));
      return session || null;
    } catch (err: any) { this.error.set(err.message); return null; } finally { this.isLoading.set(false); }
  }

  // Scope Definition methods for import functionality
  async loadScopeDefinitionSessions(): Promise<void> {
    try {
      const sessions = await this.http.get<ScopeDefinitionSession[]>('/api/scope-definition/sessions', { params: { limit: '50' } }).toPromise();
      // Filter to only completed sessions
      this.scopeDefinitionSessions.set((sessions || []).filter((s) => s.status === 'completed'));
    } catch (err: any) { this.error.set(err.error?.detail || err.statusText || 'Failed to load scope definitions'); }
  }

  async loadScopeDefinitionFull(sessionId: number): Promise<void> {
    try {
      const response = await this.http.get<ScopeDefinitionFullResponse>(`/api/scope-definition/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.selectedScopeDefinition.set(response.session);
        this.scopeDefinitionItems.set(response.in_scope_items);
      }
    } catch (err: any) { this.error.set(err.error?.detail || err.statusText || 'Failed to load scope definition'); }
  }
}
