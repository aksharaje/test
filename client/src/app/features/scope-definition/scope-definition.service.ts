import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { ScopeDefinitionSession, ScopeItem, ScopeAssumption, ScopeConstraint, ScopeDeliverable, ScopeDefinitionSessionCreate, ScopeDefinitionFullResponse } from './scope-definition.types';

@Injectable({ providedIn: 'root' })
export class ScopeDefinitionService {
  private http = inject(HttpClient);
  private baseUrl = '/api/scope-definition';

  sessions = signal<ScopeDefinitionSession[]>([]);
  currentSession = signal<ScopeDefinitionSession | null>(null);
  inScopeItems = signal<ScopeItem[]>([]);
  outOfScopeItems = signal<ScopeItem[]>([]);
  deferredItems = signal<ScopeItem[]>([]);
  assumptions = signal<ScopeAssumption[]>([]);
  constraints = signal<ScopeConstraint[]>([]);
  deliverables = signal<ScopeDeliverable[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  async loadSessions(skip = 0, limit = 20): Promise<void> {
    this.isLoading.set(true);
    try {
      const sessions = await this.http.get<ScopeDefinitionSession[]>(`${this.baseUrl}/sessions`, { params: { skip: skip.toString(), limit: limit.toString() } }).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) { this.error.set(err.message); } finally { this.isLoading.set(false); }
  }

  async createSession(data: ScopeDefinitionSessionCreate): Promise<ScopeDefinitionSession | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http.post<ScopeDefinitionSession>(`${this.baseUrl}/sessions`, data).toPromise();
      if (session) this.sessions.update((s) => [session, ...s]);
      return session || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; } finally { this.isLoading.set(false); }
  }

  async getSession(sessionId: number): Promise<ScopeDefinitionSession | null> {
    try {
      const session = await this.http.get<ScopeDefinitionSession>(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) { this.error.set(err.message); return null; }
  }

  async getSessionFull(sessionId: number): Promise<ScopeDefinitionFullResponse | null> {
    this.isLoading.set(true);
    try {
      const response = await this.http.get<ScopeDefinitionFullResponse>(`${this.baseUrl}/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.currentSession.set(response.session);
        this.inScopeItems.set(response.in_scope_items);
        this.outOfScopeItems.set(response.out_of_scope_items);
        this.deferredItems.set(response.deferred_items);
        this.assumptions.set(response.assumptions);
        this.constraints.set(response.constraints);
        this.deliverables.set(response.deliverables);
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

  async retrySession(sessionId: number): Promise<ScopeDefinitionSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http.post<ScopeDefinitionSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {}).toPromise();
      if (session) this.sessions.update((s) => s.map((sess) => (sess.id === sessionId ? session : sess)));
      return session || null;
    } catch (err: any) { this.error.set(err.message); return null; } finally { this.isLoading.set(false); }
  }
}
