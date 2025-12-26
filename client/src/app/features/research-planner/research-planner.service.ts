/**
 * Research Planner Service
 *
 * Handles API calls and state management for the CX Research Planner feature.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ResearchPlanSession,
  SessionDetail,
  SessionStatusResponse,
  CreateSessionRequest,
  SelectMethodsRequest,
  GenerateInstrumentsRequest,
  InterviewGuide,
  Survey,
  SurveyQuestion,
} from './research-planner.types';

@Injectable({ providedIn: 'root' })
export class ResearchPlannerService {
  private http = inject(HttpClient);
  private baseUrl = '/api/cx/research-planner';

  // State signals
  private _currentSession = signal<SessionDetail | null>(null);
  private _sessions = signal<ResearchPlanSession[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Readonly accessors
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // --- Session Management ---

  async createSession(request: CreateSessionRequest): Promise<ResearchPlanSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<ResearchPlanSession>(`${this.baseUrl}/sessions`, request)
      );
      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async pollSessionStatus(sessionId: number): Promise<SessionStatusResponse> {
    const response = await firstValueFrom(
      this.http.get<SessionStatusResponse>(`${this.baseUrl}/sessions/${sessionId}/status`)
    );
    return response;
  }

  async getSessionDetail(sessionId: number): Promise<SessionDetail> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(
        this.http.get<SessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
      );
      this._currentSession.set(detail);
      return detail;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async loadSessions(reset = false, userId?: number): Promise<void> {
    if (reset) {
      this._sessions.set([]);
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      let url = `${this.baseUrl}/sessions`;
      if (userId) {
        url += `?user_id=${userId}`;
      }
      const sessions = await firstValueFrom(this.http.get<ResearchPlanSession[]>(url));
      this._sessions.set(sessions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      this._error.set(message);
    } finally {
      this._loading.set(false);
    }
  }

  async selectMethods(sessionId: number, methodNames: string[]): Promise<ResearchPlanSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const request: SelectMethodsRequest = { methodNames };
      const session = await firstValueFrom(
        this.http.post<ResearchPlanSession>(
          `${this.baseUrl}/sessions/${sessionId}/select-methods`,
          request
        )
      );
      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to select methods';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async generateInstruments(
    sessionId: number,
    request: GenerateInstrumentsRequest
  ): Promise<{ success: boolean; message: string }> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${this.baseUrl}/sessions/${sessionId}/generate-instruments`,
          request
        )
      );
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate instruments';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async retrySession(sessionId: number): Promise<ResearchPlanSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<ResearchPlanSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
      );
      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retry session';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/sessions/${sessionId}`));
      // Update local state
      this._sessions.update((sessions) => sessions.filter((s) => s.id !== sessionId));
      if (this._currentSession()?.session.id === sessionId) {
        this._currentSession.set(null);
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      this._error.set(message);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Instrument Updates ---

  async updateInterviewGuide(guideId: number, contentMarkdown: string): Promise<InterviewGuide> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const guide = await firstValueFrom(
        this.http.patch<InterviewGuide>(`${this.baseUrl}/interview-guides/${guideId}`, {
          contentMarkdown,
        })
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        const updatedGuides = current.interviewGuides.map((g) => (g.id === guideId ? guide : g));
        this._currentSession.set({ ...current, interviewGuides: updatedGuides });
      }

      return guide;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update interview guide';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async updateSurvey(surveyId: number, questions: SurveyQuestion[]): Promise<Survey> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const survey = await firstValueFrom(
        this.http.patch<Survey>(`${this.baseUrl}/surveys/${surveyId}`, { questions })
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        const updatedSurveys = current.surveys.map((s) => (s.id === surveyId ? survey : s));
        this._currentSession.set({ ...current, surveys: updatedSurveys });
      }

      return survey;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update survey';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- State Management ---

  clearError(): void {
    this._error.set(null);
  }

  clearCurrentSession(): void {
    this._currentSession.set(null);
  }
}
