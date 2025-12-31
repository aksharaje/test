import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  CompetitiveAnalysisSession,
  CreateCompetitiveAnalysisRequest,
  FocusAreaOption,
  IndustryOption,
  SessionStatus,
  CodeKnowledgeBase,
  EpicOrFeature,
  ScopeDefinitionSummary,
  IdeationSessionSummary,
} from './competitive-analysis.types';
import type { GeneratedArtifact, StructuredContent, EpicNode, FeatureNode } from '../story-generator/story-generator.types';
import type { ScopeDefinitionSession } from '../scope-definition/scope-definition.types';
import type { IdeationSession } from '../ideation/ideation.types';

@Injectable({ providedIn: 'root' })
export class CompetitiveAnalysisService {
  private http = inject(HttpClient);
  private baseUrl = '/api/competitive-analysis';

  // State
  sessions = signal<CompetitiveAnalysisSession[]>([]);
  currentSession = signal<CompetitiveAnalysisSession | null>(null);
  focusAreas = signal<FocusAreaOption[]>([]);
  industries = signal<IndustryOption[]>([]);
  codeKnowledgeBases = signal<CodeKnowledgeBase[]>([]);
  epicsAndFeatures = signal<EpicOrFeature[]>([]);
  scopeDefinitions = signal<ScopeDefinitionSummary[]>([]);
  ideationSessions = signal<IdeationSessionSummary[]>([]);
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

  async loadCodeKnowledgeBases(): Promise<void> {
    try {
      const kbs = await firstValueFrom(
        this.http.get<CodeKnowledgeBase[]>(`${this.baseUrl}/code-knowledge-bases`)
      );
      this.codeKnowledgeBases.set(kbs);
    } catch (err) {
      console.error('Failed to load code knowledge bases:', err);
    }
  }

  async loadEpicsAndFeatures(): Promise<void> {
    try {
      const artifacts = await firstValueFrom(
        this.http.get<GeneratedArtifact[]>('/api/story-generator')
      );

      const epicsAndFeatures: EpicOrFeature[] = artifacts
        .filter((a) => a.type === 'epic' || a.type === 'feature')
        .map((a) => {
          let description = '';
          try {
            const content: StructuredContent = JSON.parse(a.content);
            if (a.type === 'epic' && content.epic) {
              description = this.buildEpicDescription(content.epic);
            } else if (a.type === 'feature' && content.feature) {
              description = this.buildFeatureDescription(content.feature);
            }
          } catch {
            description = a.inputDescription;
          }
          return {
            id: a.id,
            type: a.type as 'epic' | 'feature',
            title: a.title,
            description,
          };
        });

      this.epicsAndFeatures.set(epicsAndFeatures);
    } catch (err) {
      this.epicsAndFeatures.set([]);
    }
  }

  private buildEpicDescription(epic: EpicNode): string {
    const parts: string[] = [];
    if (epic.vision) parts.push(`Vision: ${epic.vision}`);
    if (epic.goals?.length) parts.push(`Goals: ${epic.goals.join(', ')}`);
    if (epic.features?.length) parts.push(`Features (${epic.features.length}): ${epic.features.map(f => f.title).join(', ')}`);
    return parts.join('\n');
  }

  private buildFeatureDescription(feature: FeatureNode): string {
    const parts: string[] = [];
    if (feature.purpose) parts.push(`Purpose: ${feature.purpose}`);
    if (feature.summary) parts.push(`Summary: ${feature.summary}`);
    if (feature.businessValue) parts.push(`Business Value: ${feature.businessValue}`);
    return parts.join('\n');
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
        this.http.get<CompetitiveAnalysisSession[]>(
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
    data: CreateCompetitiveAnalysisRequest
  ): Promise<CompetitiveAnalysisSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<CompetitiveAnalysisSession>(
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

  async getSession(id: number): Promise<CompetitiveAnalysisSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.get<CompetitiveAnalysisSession>(`${this.baseUrl}/sessions/${id}`)
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

  async retrySession(id: number): Promise<CompetitiveAnalysisSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.post<CompetitiveAnalysisSession>(
          `${this.baseUrl}/sessions/${id}/retry`,
          {}
        )
      );
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
}
