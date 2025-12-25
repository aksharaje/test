import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  BusinessCaseSession,
  SessionDetail,
  CostItem,
  BenefitItem,
  RateAssumption,
  CreateSessionRequest,
  UpdateCostRequest,
  UpdateBenefitRequest,
  UpdateRateRequest,
  SaveLearningRequest,
  SessionStatusResponse
} from './business-case.types';
import type { FeasibilitySession } from '../feasibility/feasibility.types';
import type { GeneratedArtifact, StructuredContent, EpicNode, FeatureNode } from '../story-generator/story-generator.types';
import type { IdeationSession, SessionDetail as IdeationSessionDetail } from '../ideation/ideation.types';

export interface FeasibilitySessionSummary {
  id: number;
  featureDescription: string;
  fullDescription: string; // Full description for use when selected
  goNoGoRecommendation: string | null;
  createdAt: string;
}

export interface EpicOrFeature {
  id: number;
  type: 'epic' | 'feature';
  title: string;
  description: string;
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
export class BusinessCaseService {
  private http = inject(HttpClient);
  private baseUrl = '/api/business-case';

  // State signals
  private _currentSession = signal<SessionDetail | null>(null);
  private _sessions = signal<BusinessCaseSession[]>([]);
  private _feasibilitySessions = signal<FeasibilitySessionSummary[]>([]);
  private _epicsAndFeatures = signal<EpicOrFeature[]>([]);
  private _ideationSessions = signal<IdeationSessionSummary[]>([]);
  private _selectedIdeationIdeas = signal<IdeaForSelection[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Readonly accessors
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly feasibilitySessions = this._feasibilitySessions.asReadonly();
  readonly epicsAndFeatures = this._epicsAndFeatures.asReadonly();
  readonly ideationSessions = this._ideationSessions.asReadonly();
  readonly selectedIdeationIdeas = this._selectedIdeationIdeas.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async createSession(request: CreateSessionRequest): Promise<BusinessCaseSession | null> {
    try {
      this._loading.set(true);
      this._error.set(null);

      const session = await firstValueFrom(
        this.http.post<BusinessCaseSession>(`${this.baseUrl}/sessions`, request)
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

  async loadSessions(userId?: number): Promise<void> {
    try {
      this._loading.set(true);
      this._error.set(null);

      const url = userId
        ? `${this.baseUrl}/sessions?user_id=${userId}`
        : `${this.baseUrl}/sessions`;

      const sessions = await firstValueFrom(
        this.http.get<BusinessCaseSession[]>(url)
      );

      this._sessions.set(sessions);
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  async loadFeasibilitySessions(): Promise<void> {
    try {
      const sessions = await firstValueFrom(
        this.http.get<FeasibilitySession[]>('/api/feasibility/sessions')
      );

      // Filter to only completed sessions
      const completedSessions: FeasibilitySessionSummary[] = sessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          id: s.id,
          featureDescription: s.featureDescription.substring(0, 200) + (s.featureDescription.length > 200 ? '...' : ''),
          fullDescription: s.featureDescription,
          goNoGoRecommendation: s.goNoGoRecommendation,
          createdAt: s.createdAt,
        }));

      this._feasibilitySessions.set(completedSessions);
    } catch {
      // Don't set error - this is optional data
      this._feasibilitySessions.set([]);
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
    } catch {
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
    } catch {
      // Don't set error - this is optional data
      this._ideationSessions.set([]);
    }
  }

  async loadIdeationSessionIdeas(sessionId: number): Promise<void> {
    try {
      const detail = await firstValueFrom(
        this.http.get<IdeationSessionDetail>(`/api/ideation/sessions/${sessionId}`)
      );

      const ideas: IdeaForSelection[] = (detail.ideas || []).map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        effortEstimate: idea.effortEstimate,
        impactEstimate: idea.impactEstimate,
        selected: true, // Pre-select all ideas
      }));

      this._selectedIdeationIdeas.set(ideas);
    } catch {
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
    const selectedIdeas = this._selectedIdeationIdeas().filter((i) => i.selected);
    if (selectedIdeas.length === 0) return '';

    const parts = selectedIdeas.map((idea) => {
      return `## ${idea.title}\n${idea.description}\n- Category: ${idea.category}\n- Effort: ${idea.effortEstimate}\n- Impact: ${idea.impactEstimate}`;
    });

    return parts.join('\n\n');
  }

  async updateCost(
    costId: number,
    data: UpdateCostRequest
  ): Promise<CostItem | null> {
    try {
      const cost = await firstValueFrom(
        this.http.patch<CostItem>(`${this.baseUrl}/costs/${costId}`, data)
      );

      // Refresh current session
      if (this._currentSession()) {
        await this.getSessionDetail(this._currentSession()!.session.id);
      }

      return cost;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    }
  }

  async updateBenefit(
    benefitId: number,
    data: UpdateBenefitRequest
  ): Promise<BenefitItem | null> {
    try {
      const benefit = await firstValueFrom(
        this.http.patch<BenefitItem>(`${this.baseUrl}/benefits/${benefitId}`, data)
      );

      // Refresh current session
      if (this._currentSession()) {
        await this.getSessionDetail(this._currentSession()!.session.id);
      }

      return benefit;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    }
  }

  async updateRate(
    rateId: number,
    data: UpdateRateRequest
  ): Promise<RateAssumption | null> {
    try {
      const rate = await firstValueFrom(
        this.http.patch<RateAssumption>(`${this.baseUrl}/rates/${rateId}`, data)
      );

      // Refresh current session
      if (this._currentSession()) {
        await this.getSessionDetail(this._currentSession()!.session.id);
      }

      return rate;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return null;
    }
  }

  async saveLearning(
    sessionId: number,
    request: SaveLearningRequest
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/sessions/${sessionId}/learning`, request)
      );
      return true;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return false;
    }
  }

  async recalculateFinancials(sessionId: number): Promise<boolean> {
    try {
      this._loading.set(true);
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/sessions/${sessionId}/recalculate`, {})
      );
      return true;
    } catch (err) {
      this._error.set(this.getErrorMessage(err));
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sessions/${sessionId}`)
      );

      // Refresh sessions list
      await this.loadSessions();

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
