import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  CommunicatorSession,
  GeneratedPresentation,
  CommunicatorSessionResponse,
  CommunicatorSessionCreate,
  PresentationConfig,
  AudienceType,
} from './roadmap-communicator.types';

@Injectable({
  providedIn: 'root',
})
export class RoadmapCommunicatorService {
  private http = inject(HttpClient);
  private baseUrl = '/api/roadmap-communicator';

  // State signals
  sessions = signal<CommunicatorSession[]>([]);
  currentSession = signal<CommunicatorSessionResponse | null>(null);
  audienceTypes = signal<AudienceType[]>([]);
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
      const sessions = await this.http.get<CommunicatorSession[]>(url).toPromise();
      this.sessions.set(sessions || []);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load sessions');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createSession(data: CommunicatorSessionCreate): Promise<CommunicatorSession> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.http
        .post<CommunicatorSession>(`${this.baseUrl}/sessions`, data)
        .toPromise();
      return session!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create session');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadSession(sessionId: number): Promise<CommunicatorSessionResponse> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await this.http
        .get<CommunicatorSessionResponse>(`${this.baseUrl}/sessions/${sessionId}`)
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

  // Presentation Generation
  async generatePresentation(
    sessionId: number,
    config: PresentationConfig
  ): Promise<GeneratedPresentation> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const presentation = await this.http
        .post<GeneratedPresentation>(
          `${this.baseUrl}/sessions/${sessionId}/generate`,
          config
        )
        .toPromise();
      return presentation!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to generate presentation');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getPresentation(presentationId: number): Promise<GeneratedPresentation> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const presentation = await this.http
        .get<GeneratedPresentation>(`${this.baseUrl}/presentations/${presentationId}`)
        .toPromise();
      return presentation!;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to get presentation');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deletePresentation(presentationId: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.http.delete(`${this.baseUrl}/presentations/${presentationId}`).toPromise();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete presentation');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Export
  getExportUrl(presentationId: number, format: string): string {
    return `${this.baseUrl}/presentations/${presentationId}/export/${format}`;
  }

  async exportPresentation(presentationId: number, format: string): Promise<Blob> {
    const response = await this.http
      .get(`${this.baseUrl}/presentations/${presentationId}/export/${format}`, {
        responseType: 'blob',
      })
      .toPromise();
    return response!;
  }

  // Audience Types
  async loadAudienceTypes(): Promise<void> {
    try {
      const types = await this.http
        .get<AudienceType[]>(`${this.baseUrl}/audience-types`)
        .toPromise();
      this.audienceTypes.set(types || []);
    } catch (err: any) {
      console.error('Failed to load audience types', err);
    }
  }
}
