/**
 * Journey Mapper Service
 *
 * Handles API calls and state management for the Journey & Pain Point Mapper feature.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  JourneyMapSession,
  JourneySessionDetail,
  SessionStatusResponse,
  CreateJourneyRequest,
  AvailableContextSources,
  JourneyPainPoint,
  UpdatePainPointRequest,
  AddPainPointRequest,
  UpdateStageRequest,
  AddStageRequest,
  AddObservationRequest,
  CompetitorObservation,
} from './journey-mapper.types';

@Injectable({ providedIn: 'root' })
export class JourneyMapperService {
  private http = inject(HttpClient);
  private baseUrl = '/api/cx/journey-mapper';

  // State signals
  private _currentSession = signal<JourneySessionDetail | null>(null);
  private _sessions = signal<JourneyMapSession[]>([]);
  private _contextSources = signal<AvailableContextSources | null>(null);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Pagination
  private _page = signal(0);
  private _hasMore = signal(true);
  private readonly pageSize = 20;

  // Readonly accessors
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly contextSources = this._contextSources.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();

  // --- Context Sources ---

  async loadContextSources(userId?: number): Promise<AvailableContextSources> {
    this._loading.set(true);
    this._error.set(null);

    try {
      let url = `${this.baseUrl}/context-sources`;
      if (userId) {
        url += `?user_id=${userId}`;
      }
      const sources = await firstValueFrom(
        this.http.get<AvailableContextSources>(url)
      );
      this._contextSources.set(sources);
      return sources;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load context sources';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Session Management ---

  async createSession(request: CreateJourneyRequest): Promise<JourneyMapSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const formData = new FormData();
      formData.append('mode', request.mode);
      formData.append('journeyDescription', request.journeyDescription);

      if (request.competitorName) {
        formData.append('competitorName', request.competitorName);
      }
      if (request.userId) {
        formData.append('userId', request.userId.toString());
      }
      if (request.knowledgeBaseIds) {
        formData.append('knowledgeBaseIds', JSON.stringify(request.knowledgeBaseIds));
      }
      if (request.ideationSessionId) {
        formData.append('ideationSessionId', request.ideationSessionId.toString());
      }
      if (request.feasibilitySessionId) {
        formData.append('feasibilitySessionId', request.feasibilitySessionId.toString());
      }
      if (request.businessCaseSessionId) {
        formData.append('businessCaseSessionId', request.businessCaseSessionId.toString());
      }
      if (request.personas) {
        formData.append('personas', JSON.stringify(request.personas));
      }
      if (request.files) {
        for (const file of request.files) {
          formData.append('files', file);
        }
      }

      const session = await firstValueFrom(
        this.http.post<JourneyMapSession>(`${this.baseUrl}/sessions`, formData)
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

  async getSessionDetail(sessionId: number): Promise<JourneySessionDetail> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(
        this.http.get<JourneySessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
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
      this._page.set(0);
      this._hasMore.set(true);
      this._sessions.set([]);
    }

    if (!this._hasMore() && !reset) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      const skip = this._page() * this.pageSize;
      let url = `${this.baseUrl}/sessions?skip=${skip}&limit=${this.pageSize}`;
      if (userId) {
        url += `&user_id=${userId}`;
      }

      const sessions = await firstValueFrom(this.http.get<JourneyMapSession[]>(url));

      if (sessions.length < this.pageSize) {
        this._hasMore.set(false);
      }

      this._sessions.update((current) =>
        reset ? sessions : [...current, ...sessions]
      );
      this._page.update((p) => p + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      this._error.set(message);
    } finally {
      this._loading.set(false);
    }
  }

  async retrySession(sessionId: number): Promise<JourneyMapSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<JourneyMapSession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
      );

      this._sessions.update((sessions) =>
        sessions.map((s) => (s.id === sessionId ? session : s))
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

  // --- Pain Point Management ---

  async updatePainPoint(painPointId: number, updates: UpdatePainPointRequest): Promise<JourneyPainPoint> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const painPoint = await firstValueFrom(
        this.http.patch<JourneyPainPoint>(`${this.baseUrl}/pain-points/${painPointId}`, updates)
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        const updatedPainPoints = current.painPoints.map((pp) =>
          pp.id === painPointId ? painPoint : pp
        );
        this._currentSession.set({ ...current, painPoints: updatedPainPoints });
      }

      return painPoint;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update pain point';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async addPainPoint(sessionId: number, request: AddPainPointRequest): Promise<JourneyPainPoint> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const painPoint = await firstValueFrom(
        this.http.post<JourneyPainPoint>(`${this.baseUrl}/sessions/${sessionId}/pain-points`, request)
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        this._currentSession.set({
          ...current,
          painPoints: [...current.painPoints, painPoint],
        });
      }

      return painPoint;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add pain point';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async deletePainPoint(painPointId: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/pain-points/${painPointId}`));

      // Update local state
      const current = this._currentSession();
      if (current) {
        this._currentSession.set({
          ...current,
          painPoints: current.painPoints.filter((pp) => pp.id !== painPointId),
        });
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete pain point';
      this._error.set(message);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Stage Management ---

  async updateStage(sessionId: number, stageId: string, updates: UpdateStageRequest): Promise<JourneyMapSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.patch<JourneyMapSession>(
          `${this.baseUrl}/sessions/${sessionId}/stages/${stageId}`,
          updates
        )
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        this._currentSession.set({ ...current, session });
      }

      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update stage';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async addStage(sessionId: number, request: AddStageRequest): Promise<JourneyMapSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<JourneyMapSession>(`${this.baseUrl}/sessions/${sessionId}/stages`, request)
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        this._currentSession.set({ ...current, session });
      }

      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add stage';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteStage(sessionId: number, stageId: string): Promise<JourneyMapSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.delete<JourneyMapSession>(`${this.baseUrl}/sessions/${sessionId}/stages/${stageId}`)
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        this._currentSession.set({
          ...current,
          session,
          painPoints: current.painPoints.filter((pp) => pp.stageId !== stageId),
        });
      }

      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete stage';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Competitive Journey ---

  async addObservation(sessionId: number, request: AddObservationRequest): Promise<CompetitorObservation> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const observation = await firstValueFrom(
        this.http.post<CompetitorObservation>(
          `${this.baseUrl}/sessions/${sessionId}/observations`,
          request
        )
      );

      // Update local state
      const current = this._currentSession();
      if (current) {
        this._currentSession.set({
          ...current,
          competitorObservations: [...current.competitorObservations, observation],
        });
      }

      return observation;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add observation';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async generateFromObservations(sessionId: number): Promise<{ success: boolean; message: string }> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${this.baseUrl}/sessions/${sessionId}/generate-from-observations`,
          {}
        )
      );
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate from observations';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Version Control ---

  async createNewVersion(
    sessionId: number,
    updateType: 'refresh' | 'expand' | 'correct',
    knowledgeBaseIds?: number[],
    files?: File[]
  ): Promise<JourneyMapSession> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const formData = new FormData();
      formData.append('updateType', updateType);

      if (knowledgeBaseIds) {
        formData.append('knowledgeBaseIds', JSON.stringify(knowledgeBaseIds));
      }
      if (files) {
        for (const file of files) {
          formData.append('files', file);
        }
      }

      const session = await firstValueFrom(
        this.http.post<JourneyMapSession>(
          `${this.baseUrl}/sessions/${sessionId}/new-version`,
          formData
        )
      );
      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create new version';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async compareVersions(
    versionId1: number,
    versionId2: number
  ): Promise<{ version1: JourneySessionDetail; version2: JourneySessionDetail; deltaSummary?: object }> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<{ version1: JourneySessionDetail; version2: JourneySessionDetail; deltaSummary?: object }>(
          `${this.baseUrl}/sessions/${versionId1}/compare/${versionId2}`
        )
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to compare versions';
      this._error.set(message);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  // --- Export ---

  async exportJourney(sessionId: number, format: 'json' | 'pdf' | 'png' = 'json'): Promise<JourneySessionDetail> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<JourneySessionDetail>(`${this.baseUrl}/sessions/${sessionId}/export?format=${format}`)
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export journey';
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

  setCurrentSession(detail: JourneySessionDetail): void {
    this._currentSession.set(detail);
  }
}
