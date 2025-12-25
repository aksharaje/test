import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  FeasibilitySession,
  SessionDetail,
  TechnicalComponent,
  CreateSessionRequest,
  UpdateComponentRequest,
  CaptureActualsRequest,
  SessionStatusResponse
} from './feasibility.types';
import type { GeneratedArtifact, StructuredContent, EpicNode, FeatureNode } from '../story-generator/story-generator.types';
import type { IdeationSession, GeneratedIdea, SessionDetail as IdeationSessionDetail } from '../ideation/ideation.types';

export interface EpicOrFeature {
  id: number;
  type: 'epic' | 'feature';
  title: string;
  description: string;  // AI-generated description from the structured content
}

export interface IdeationSessionSummary {
  id: number;
  problemStatement: string;
  ideaCount: number;
  createdAt: string;
}

export interface IdeaForSelection {
  id: number;
  title: string;
  description: string;
  category: string;
  effortEstimate: string;
  impactEstimate: string;
  selected: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeasibilityService {
  private http = inject(HttpClient);
  private baseUrl = '/api/feasibility';

  // State signals
  private _currentSession = signal<SessionDetail | null>(null);
  private _sessions = signal<FeasibilitySession[]>([]);
  private _epicsAndFeatures = signal<EpicOrFeature[]>([]);
  private _ideationSessions = signal<IdeationSessionSummary[]>([]);
  private _selectedIdeationIdeas = signal<IdeaForSelection[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Pagination state
  private _page = signal(0);
  private _hasMore = signal(true);
  private readonly pageSize = 20;

  // Readonly accessors
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly epicsAndFeatures = this._epicsAndFeatures.asReadonly();
  readonly ideationSessions = this._ideationSessions.asReadonly();
  readonly selectedIdeationIdeas = this._selectedIdeationIdeas.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();

  async createSession(request: CreateSessionRequest): Promise<FeasibilitySession | null> {
    try {
      this._loading.set(true);
      this._error.set(null);

      const session = await firstValueFrom(
        this.http.post<FeasibilitySession>(`${this.baseUrl}/sessions`, request)
      );

      return session;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async pollSessionStatus(sessionId: number): Promise<SessionStatusResponse | null> {
    try {
      const status = await firstValueFrom(
        this.http.get<SessionStatusResponse>(`${this.baseUrl}/sessions/${sessionId}/status`)
      );
      return status;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    }
  }

  async getSessionDetail(sessionId: number): Promise<SessionDetail | null> {
    try {
      this._loading.set(true);
      this._error.set(null);

      const detail = await firstValueFrom(
        this.http.get<SessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
      );

      this._currentSession.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async loadSessions(reset = false, userId?: number): Promise<void> {
    try {
      if (reset) {
        this._page.set(0);
        this._hasMore.set(true);
        this._sessions.set([]);
      }

      if (!this._hasMore() && !reset) return;

      this._loading.set(true);
      this._error.set(null);

      const skip = this._page() * this.pageSize;
      const url = userId
        ? `${this.baseUrl}/sessions?user_id=${userId}&skip=${skip}&limit=${this.pageSize}`
        : `${this.baseUrl}/sessions?skip=${skip}&limit=${this.pageSize}`;

      const newSessions = await firstValueFrom(
        this.http.get<FeasibilitySession[]>(url)
      );

      if (newSessions.length < this.pageSize) {
        this._hasMore.set(false);
      } else {
        this._page.update(p => p + 1);
      }

      this._sessions.update(current => reset ? newSessions : [...current, ...newSessions]);
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  async retrySession(sessionId: number): Promise<void> {
    try {
      this._loading.set(true);
      const updatedSession = await firstValueFrom(
        this.http.post<FeasibilitySession>(`${this.baseUrl}/sessions/${sessionId}/retry`, {})
      );

      // Update the session in the list
      this._sessions.update(sessions =>
        sessions.map(s => s.id === sessionId ? updatedSession : s)
      );

    } catch (err) {
      this._error.set(this.getErrorMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  async loadEpicsAndFeatures(): Promise<void> {
    try {
      const artifacts = await firstValueFrom(
        this.http.get<GeneratedArtifact[]>('/api/story-generator')
      );

      // Filter to only epics and features, and transform to simplified format
      const epicsAndFeatures: EpicOrFeature[] = artifacts
        .filter((a) => a.type === 'epic' || a.type === 'feature')
        .map((a) => {
          // Parse the structured content to get the AI-generated description
          let description = '';
          try {
            const content: StructuredContent = JSON.parse(a.content);

            if (a.type === 'epic' && content.epic) {
              description = this.buildEpicDescription(content.epic);
            } else if (a.type === 'feature' && content.feature) {
              description = this.buildFeatureDescription(content.feature);
            }
          } catch {
            // Fallback to inputDescription if parsing fails
            description = a.inputDescription;
          }

          return {
            id: a.id,
            type: a.type as 'epic' | 'feature',
            title: a.title,
            description,
          };
        });

      this._epicsAndFeatures.set(epicsAndFeatures);
    } catch (err) {
      // Don't set error - this is optional data
      this._epicsAndFeatures.set([]);
    }
  }

  private buildEpicDescription(epic: EpicNode): string {
    const parts: string[] = [];

    if (epic.vision) {
      parts.push(`Vision: ${epic.vision}`);
    }

    if (epic.goals?.length) {
      parts.push(`Goals:\n${epic.goals.map(g => `- ${g}`).join('\n')}`);
    }

    if (epic.successMetrics?.length) {
      parts.push(`Success Metrics:\n${epic.successMetrics.map(m => `- ${m}`).join('\n')}`);
    }

    if (epic.risksAndDependencies) {
      parts.push(`Risks & Dependencies: ${epic.risksAndDependencies}`);
    }

    if (epic.features?.length) {
      parts.push(`Features (${epic.features.length}):\n${epic.features.map(f => `- ${f.title}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  private buildFeatureDescription(feature: FeatureNode): string {
    const parts: string[] = [];

    if (feature.purpose) {
      parts.push(`Purpose: ${feature.purpose}`);
    }

    if (feature.summary) {
      parts.push(`Summary: ${feature.summary}`);
    }

    if (feature.businessValue) {
      parts.push(`Business Value: ${feature.businessValue}`);
    }

    if (feature.functionalRequirements) {
      parts.push(`Functional Requirements: ${feature.functionalRequirements}`);
    }

    if (feature.nonFunctionalRequirements) {
      parts.push(`Non-Functional Requirements: ${feature.nonFunctionalRequirements}`);
    }

    if (feature.dependencies) {
      parts.push(`Dependencies: ${feature.dependencies}`);
    }

    if (feature.assumptions) {
      parts.push(`Assumptions: ${feature.assumptions}`);
    }

    return parts.join('\n\n');
  }

  async loadIdeationSessions(): Promise<void> {
    try {
      const sessions = await firstValueFrom(
        this.http.get<IdeationSession[]>('/api/ideation/sessions')
      );

      // Filter to only completed sessions and transform to summary format
      const completedSessions: IdeationSessionSummary[] = sessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          id: s.id,
          problemStatement: s.problemStatement,
          ideaCount: 0, // Will be updated when session is selected
          createdAt: s.createdAt,
        }));

      this._ideationSessions.set(completedSessions);
    } catch (err) {
      // Don't set error - this is optional data
      this._ideationSessions.set([]);
    }
  }

  async loadIdeationSessionIdeas(sessionId: number): Promise<void> {
    try {
      const detail = await firstValueFrom(
        this.http.get<IdeationSessionDetail>(`/api/ideation/sessions/${sessionId}`)
      );

      // Transform ideas for selection (all selected by default)
      const ideas: IdeaForSelection[] = detail.ideas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        category: this.formatIdeaCategory(idea.category),
        effortEstimate: idea.effortEstimate,
        impactEstimate: idea.impactEstimate,
        selected: true,
      }));

      this._selectedIdeationIdeas.set(ideas);

      // Update the session's idea count
      this._ideationSessions.update((sessions) =>
        sessions.map((s) =>
          s.id === sessionId ? { ...s, ideaCount: ideas.length } : s
        )
      );
    } catch (err) {
      this._selectedIdeationIdeas.set([]);
    }
  }

  toggleIdeaSelection(ideaId: number): void {
    this._selectedIdeationIdeas.update((ideas) =>
      ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, selected: !idea.selected } : idea
      )
    );
  }

  selectAllIdeas(): void {
    this._selectedIdeationIdeas.update((ideas) =>
      ideas.map((idea) => ({ ...idea, selected: true }))
    );
  }

  deselectAllIdeas(): void {
    this._selectedIdeationIdeas.update((ideas) =>
      ideas.map((idea) => ({ ...idea, selected: false }))
    );
  }

  clearIdeationSelection(): void {
    this._selectedIdeationIdeas.set([]);
  }

  buildIdeationDescription(): string {
    const selectedIdeas = this._selectedIdeationIdeas().filter((idea) => idea.selected);

    if (selectedIdeas.length === 0) {
      return '';
    }

    const parts = selectedIdeas.map((idea, index) => {
      const lines = [
        `## ${index + 1}. ${idea.title}`,
        '',
        idea.description,
        '',
        `- Category: ${idea.category}`,
        `- Effort: ${idea.effortEstimate}`,
        `- Impact: ${idea.impactEstimate}`,
      ];
      return lines.join('\n');
    });

    return parts.join('\n\n---\n\n');
  }

  private formatIdeaCategory(category: string): string {
    const labels: Record<string, string> = {
      quick_wins: 'Quick Wins',
      strategic_bets: 'Strategic Bets',
      incremental: 'Incremental',
      moonshots: 'Moonshots',
    };
    return labels[category] || category;
  }

  async updateComponent(
    componentId: number,
    data: UpdateComponentRequest
  ): Promise<TechnicalComponent | null> {
    try {
      const component = await firstValueFrom(
        this.http.patch<TechnicalComponent>(
          `${this.baseUrl}/components/${componentId}`,
          data
        )
      );

      // Refresh current session if it contains this component
      if (this._currentSession()) {
        await this.getSessionDetail(this._currentSession()!.session.id);
      }

      return component;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    }
  }

  async captureActuals(
    sessionId: number,
    request: CaptureActualsRequest
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/sessions/${sessionId}/actuals`, request)
      );
      return true;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return false;
    }
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sessions/${sessionId}`)
      );

      // Remove from sessions list locally
      this._sessions.update(sessions => sessions.filter(s => s.id !== sessionId));

      // Clear current session if it was deleted
      if (this._currentSession()?.session.id === sessionId) {
        this._currentSession.set(null);
      }

      return true;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return false;
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.detail || err.message || 'An error occurred';
    }
    return 'An unexpected error occurred';
  }
}
