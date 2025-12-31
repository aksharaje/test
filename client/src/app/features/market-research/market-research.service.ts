import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  MarketResearchSession,
  CreateMarketResearchRequest,
  FocusAreaOption,
  IndustryOption,
  SessionStatus,
  IdeationSessionSummary,
  OkrSessionSummary,
  ScopeDefinitionSummary,
} from './market-research.types';
import type { IdeationSession } from '../ideation/ideation.types';
import type { ScopeDefinitionSession } from '../scope-definition/scope-definition.types';

@Injectable({ providedIn: 'root' })
export class MarketResearchService {
  private http = inject(HttpClient);
  private baseUrl = '/api/market-research';

  // State
  sessions = signal<MarketResearchSession[]>([]);
  currentSession = signal<MarketResearchSession | null>(null);
  focusAreas = signal<FocusAreaOption[]>([]);
  industries = signal<IndustryOption[]>([]);
  ideationSessions = signal<IdeationSessionSummary[]>([]);
  okrSessions = signal<OkrSessionSummary[]>([]);
  scopeDefinitions = signal<ScopeDefinitionSummary[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Pagination
  private skip = 0;
  private limit = 20;
  hasMore = signal(true);

  async loadFocusAreas(): Promise<void> {
    try {
      const areas = await firstValueFrom(
        this.http.get<FocusAreaOption[]>(`${this.baseUrl}/focus-areas`)
      );
      this.focusAreas.set(areas);
    } catch (err) {
      console.error('Failed to load focus areas:', err);
    }
  }

  async loadIndustries(): Promise<void> {
    try {
      const industries = await firstValueFrom(
        this.http.get<IndustryOption[]>(`${this.baseUrl}/industries`)
      );
      this.industries.set(industries);
    } catch (err) {
      console.error('Failed to load industries:', err);
    }
  }

  async loadIdeationSessions(): Promise<void> {
    try {
      const sessions = await firstValueFrom(
        this.http.get<IdeationSession[]>('/api/ideation/sessions')
      );

      const completedSessions: IdeationSessionSummary[] = sessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          id: s.id,
          problemStatement: s.problemStatement,
          ideaCount: 0,
          createdAt: s.createdAt,
        }));

      this.ideationSessions.set(completedSessions);
    } catch (err) {
      this.ideationSessions.set([]);
    }
  }

  async loadOkrSessions(): Promise<void> {
    try {
      const sessions = await firstValueFrom(
        this.http.get<any[]>('/api/okr-generator/sessions')
      );

      const completedSessions: OkrSessionSummary[] = sessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          id: s.id,
          goalDescription: s.goalDescription || s.goal_description,
          objectiveCount: s.objectiveCount || 0,
          createdAt: s.createdAt || s.created_at,
        }));

      this.okrSessions.set(completedSessions);
    } catch (err) {
      this.okrSessions.set([]);
    }
  }

  async loadScopeDefinitions(): Promise<void> {
    try {
      const sessions = await firstValueFrom(
        this.http.get<ScopeDefinitionSession[]>('/api/scope-definition/sessions')
      );

      const completedSessions: ScopeDefinitionSummary[] = sessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          id: s.id,
          projectName: s.projectName,
          productVision: s.productVision,
          createdAt: s.createdAt,
        }));

      this.scopeDefinitions.set(completedSessions);
    } catch (err) {
      this.scopeDefinitions.set([]);
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
        this.http.get<MarketResearchSession[]>(
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
    data: CreateMarketResearchRequest
  ): Promise<MarketResearchSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<MarketResearchSession>(
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

  async getSession(id: number): Promise<MarketResearchSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.get<MarketResearchSession>(`${this.baseUrl}/sessions/${id}`)
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

  async retrySession(id: number): Promise<MarketResearchSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.post<MarketResearchSession>(
          `${this.baseUrl}/sessions/${id}/retry`,
          {}
        )
      );
      // Update current session (for results page)
      this.currentSession.set(session);
      // Update in list
      this.sessions.update((current) =>
        current.map((s) => (s.id === id ? session : s))
      );
      return session;
    } catch (err) {
      return null;
    }
  }

  getFocusAreaLabel(value: string): string {
    const area = this.focusAreas().find((a) => a.value === value);
    return area?.label || value;
  }

  getIndustryLabel(value: string): string {
    const industry = this.industries().find((i) => i.value === value);
    return industry?.label || value;
  }
}
