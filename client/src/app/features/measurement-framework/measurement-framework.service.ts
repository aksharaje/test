import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { MeasurementFrameworkSession, FrameworkMetric, FrameworkDataSource, FrameworkDashboard, MeasurementFrameworkSessionCreate, MeasurementFrameworkFullResponse } from './measurement-framework.types';
import type { OkrSession, Objective } from '../okr-generator/okr-generator.types';

@Injectable({ providedIn: 'root' })
export class MeasurementFrameworkService {
  private http = inject(HttpClient);
  private baseUrl = '/api/measurement-framework';

  sessions = signal<MeasurementFrameworkSession[]>([]);
  currentSession = signal<MeasurementFrameworkSession | null>(null);
  metrics = signal<FrameworkMetric[]>([]);
  dataSources = signal<FrameworkDataSource[]>([]);
  dashboards = signal<FrameworkDashboard[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // OKR session data for import
  okrSessions = signal<OkrSession[]>([]);
  selectedOkrSession = signal<OkrSession | null>(null);
  okrObjectives = signal<Objective[]>([]);

  async loadSessions(skip = 0, limit = 20): Promise<void> {
    this.isLoading.set(true);
    try {
      const sessions = await this.http.get<MeasurementFrameworkSession[]>(`${this.baseUrl}/sessions`, { params: { skip: skip.toString(), limit: limit.toString() } }).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) { this.error.set(err.message); } finally { this.isLoading.set(false); }
  }

  async createSession(data: MeasurementFrameworkSessionCreate): Promise<MeasurementFrameworkSession | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http.post<MeasurementFrameworkSession>(`${this.baseUrl}/sessions`, data).toPromise();
      if (session) this.sessions.update((s) => [session, ...s]);
      return session || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; } finally { this.isLoading.set(false); }
  }

  async getSession(sessionId: number): Promise<MeasurementFrameworkSession | null> {
    try {
      const session = await this.http.get<MeasurementFrameworkSession>(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      if (session) this.currentSession.set(session);
      return session || null;
    } catch (err: any) { this.error.set(err.message); return null; }
  }

  async getSessionFull(sessionId: number): Promise<MeasurementFrameworkFullResponse | null> {
    this.isLoading.set(true);
    try {
      const response = await this.http.get<MeasurementFrameworkFullResponse>(`${this.baseUrl}/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.currentSession.set(response.session);
        this.metrics.set(response.metrics);
        this.dataSources.set(response.data_sources);
        this.dashboards.set(response.dashboards);
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

  async retrySession(sessionId: number): Promise<MeasurementFrameworkSession | null> {
    this.isLoading.set(true);
    try {
      const session = await this.http.post<MeasurementFrameworkSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {}).toPromise();
      if (session) this.sessions.update((s) => s.map((sess) => (sess.id === sessionId ? session : sess)));
      return session || null;
    } catch (err: any) { this.error.set(err.message); return null; } finally { this.isLoading.set(false); }
  }

  // OKR session methods for import functionality
  async loadOkrSessions(): Promise<void> {
    try {
      const sessions = await this.http.get<OkrSession[]>('/api/okr-generator/sessions', { params: { limit: '50' } }).toPromise();
      // Filter to only completed sessions
      this.okrSessions.set((sessions || []).filter((s) => s.status === 'completed'));
    } catch (err: any) { this.error.set(err.error?.detail || err.statusText || 'Failed to load OKR sessions'); }
  }

  async loadOkrSessionFull(sessionId: number): Promise<void> {
    try {
      const response = await this.http.get<{ session: OkrSession; objectives: Objective[] }>(`/api/okr-generator/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.selectedOkrSession.set(response.session);
        this.okrObjectives.set(response.objectives);
      }
    } catch (err: any) { this.error.set(err.error?.detail || err.statusText || 'Failed to load OKR session'); }
  }

  // Build objectives description from OKR session data
  buildDescriptionFromOkr(): string {
    const session = this.selectedOkrSession();
    const objectives = this.okrObjectives();
    if (!session || objectives.length === 0) return '';

    let description = `Timeframe: ${session.timeframe}\n\nObjectives:\n`;
    for (const obj of objectives) {
      description += `- ${obj.title}\n`;
      if (obj.keyResults && obj.keyResults.length > 0) {
        for (const kr of obj.keyResults) {
          description += `  • ${kr.title} (Target: ${kr.targetValue})\n`;
        }
      }
    }
    return description;
  }
}
