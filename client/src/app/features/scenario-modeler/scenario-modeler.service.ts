import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  ScenarioSession,
  ScenarioVariant,
  ScenarioSessionResponse,
  ScenarioSessionCreate,
  ScenarioVariantCreate,
  ScenarioComparisonReport,
  ScenarioTemplate,
} from './scenario-modeler.types';

@Injectable({
  providedIn: 'root',
})
export class ScenarioModelerService {
  private http = inject(HttpClient);
  private baseUrl = '/api/scenario-modeler';

  // State signals
  sessions = signal<ScenarioSession[]>([]);
  currentSession = signal<ScenarioSessionResponse | null>(null);
  templates = signal<ScenarioTemplate[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Session Management
  async loadSessions(roadmapSessionId?: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const url = roadmapSessionId
        ? `${this.baseUrl}/sessions?roadmap_session_id=${roadmapSessionId}`
        : `${this.baseUrl}/sessions`;
      const sessions = await this.http.get<ScenarioSession[]>(url).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load sessions');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createSession(data: ScenarioSessionCreate): Promise<ScenarioSession> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http
        .post<ScenarioSession>(`${this.baseUrl}/sessions`, data)
        .toPromise();
      return session!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create session');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadSession(sessionId: number): Promise<ScenarioSessionResponse> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await this.http
        .get<ScenarioSessionResponse>(`${this.baseUrl}/sessions/${sessionId}`)
        .toPromise();
      this.currentSession.set(response || null);
      return response!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load session');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteSession(sessionId: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.http.delete(`${this.baseUrl}/sessions/${sessionId}`).toPromise();
      this.sessions.update((s) => s.filter((session) => session.id !== sessionId));
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete session');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getSessionStatus(
    sessionId: number
  ): Promise<{ status: string; progressStep: number; progressTotal: number; progressMessage?: string; errorMessage?: string }> {
    const response = await this.http
      .get<any>(`${this.baseUrl}/sessions/${sessionId}/status`)
      .toPromise();
    return response;
  }

  // Pipeline
  async generateScenarios(sessionId: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.http
        .post(`${this.baseUrl}/sessions/${sessionId}/generate`, {})
        .toPromise();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to start scenario generation');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Variant Management
  async createVariant(
    sessionId: number,
    data: ScenarioVariantCreate
  ): Promise<ScenarioVariant> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const variant = await this.http
        .post<ScenarioVariant>(`${this.baseUrl}/sessions/${sessionId}/variants`, data)
        .toPromise();
      return variant!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create variant');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createVariantFromTemplate(
    sessionId: number,
    templateName: string
  ): Promise<ScenarioVariant> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const variant = await this.http
        .post<ScenarioVariant>(
          `${this.baseUrl}/sessions/${sessionId}/variants/from-template?template_name=${templateName}`,
          {}
        )
        .toPromise();
      return variant!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create variant from template');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteVariant(sessionId: number, variantId: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.http
        .delete(`${this.baseUrl}/sessions/${sessionId}/variants/${variantId}`)
        .toPromise();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete variant');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async promoteVariant(sessionId: number, variantId: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.http
        .post(
          `${this.baseUrl}/sessions/${sessionId}/variants/${variantId}/promote`,
          {}
        )
        .toPromise();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to promote variant');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Comparison
  async getComparison(sessionId: number): Promise<ScenarioComparisonReport> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const comparison = await this.http
        .get<ScenarioComparisonReport>(`${this.baseUrl}/sessions/${sessionId}/comparison`)
        .toPromise();
      return comparison!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to get comparison');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Templates
  async loadTemplates(): Promise<void> {
    try {
      const templates = await this.http
        .get<ScenarioTemplate[]>(`${this.baseUrl}/templates`)
        .toPromise();
      this.templates.set(templates || []);
    } catch (err: any) {
      console.error('Failed to load templates', err);
    }
  }
}
