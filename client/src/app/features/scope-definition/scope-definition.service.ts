import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { ScopeDefinitionSession, ScopeItem, ScopeAssumption, ScopeConstraint, ScopeDeliverable, ScopeDefinitionSessionCreate, ScopeDefinitionFullResponse } from './scope-definition.types';
import type { IdeationSession, GeneratedIdea } from '../ideation/ideation.types';
import type { OkrSession, Objective } from '../okr-generator/okr-generator.types';
import type { KnowledgeBase } from '../knowledge-bases/knowledge-base.types';

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

  // Ideation session data for import
  ideationSessions = signal<IdeationSession[]>([]);
  selectedIdeationSession = signal<IdeationSession | null>(null);
  selectedIdeas = signal<GeneratedIdea[]>([]);

  // OKR session data for import
  okrSessions = signal<OkrSession[]>([]);
  selectedOkrSession = signal<OkrSession | null>(null);
  okrObjectives = signal<Objective[]>([]);

  // Knowledge bases
  knowledgeBases = signal<KnowledgeBase[]>([]);

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

  // Ideation session methods for import
  async loadIdeationSessions(): Promise<void> {
    try {
      const sessions = await this.http.get<IdeationSession[]>('/api/ideation/sessions', { params: { limit: '50' } }).toPromise();
      this.ideationSessions.set((sessions || []).filter((s) => s.status === 'completed'));
    } catch (err: any) {
      console.error('Failed to load ideation sessions:', err);
    }
  }

  async loadIdeationSessionFull(sessionId: number): Promise<void> {
    try {
      const response = await this.http.get<{ session: IdeationSession; ideas: GeneratedIdea[] }>(`/api/ideation/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.selectedIdeationSession.set(response.session);
        this.selectedIdeas.set(response.ideas || []);
      }
    } catch (err: any) {
      this.error.set(err.error?.detail || 'Failed to load ideation session');
    }
  }

  buildVisionFromIdeation(): { projectName: string; vision: string } {
    const session = this.selectedIdeationSession();
    const ideas = this.selectedIdeas();
    if (!session) return { projectName: '', vision: '' };

    const topIdeas = ideas.slice(0, 5);
    let vision = `Problem: ${session.problemStatement}\n\n`;
    if (session.goals) vision += `Goals: ${session.goals}\n\n`;
    if (topIdeas.length > 0) {
      vision += `Top Ideas:\n`;
      for (const idea of topIdeas) {
        vision += `- ${idea.title}: ${idea.description}\n`;
      }
    }
    return { projectName: session.structuredProblem?.what || 'New Project', vision };
  }

  clearIdeationSelection(): void {
    this.selectedIdeationSession.set(null);
    this.selectedIdeas.set([]);
  }

  // OKR session methods for import
  async loadOkrSessions(): Promise<void> {
    try {
      const sessions = await this.http.get<OkrSession[]>('/api/okr-generator/sessions', { params: { limit: '50' } }).toPromise();
      this.okrSessions.set((sessions || []).filter((s) => s.status === 'completed'));
    } catch (err: any) {
      console.error('Failed to load OKR sessions:', err);
    }
  }

  async loadOkrSessionFull(sessionId: number): Promise<void> {
    try {
      const response = await this.http.get<{ session: OkrSession; objectives: Objective[] }>(`/api/okr-generator/sessions/${sessionId}/full`).toPromise();
      if (response) {
        this.selectedOkrSession.set(response.session);
        this.okrObjectives.set(response.objectives || []);
      }
    } catch (err: any) {
      this.error.set(err.error?.detail || 'Failed to load OKR session');
    }
  }

  buildVisionFromOkr(): { projectName: string; vision: string } {
    const session = this.selectedOkrSession();
    const objectives = this.okrObjectives();
    if (!session) return { projectName: '', vision: '' };

    let vision = `Goal: ${session.goalDescription}\nTimeframe: ${session.timeframe}\n\n`;
    if (objectives.length > 0) {
      vision += `Objectives:\n`;
      for (const obj of objectives) {
        vision += `- ${obj.title}\n`;
        if (obj.keyResults && obj.keyResults.length > 0) {
          for (const kr of obj.keyResults) {
            vision += `  • ${kr.title} (Target: ${kr.targetValue})\n`;
          }
        }
      }
    }
    return { projectName: session.goalDescription.substring(0, 50), vision };
  }

  clearOkrSelection(): void {
    this.selectedOkrSession.set(null);
    this.okrObjectives.set([]);
  }

  // Knowledge base methods (only ready KBs for select dropdown)
  async loadKnowledgeBases(): Promise<void> {
    try {
      const kbs = await this.http.get<KnowledgeBase[]>('/api/knowledge-bases/selectable').toPromise();
      this.knowledgeBases.set(kbs || []);
    } catch (err: any) {
      console.error('Failed to load knowledge bases:', err);
    }
  }

  // Item CRUD methods
  async createScopeItem(sessionId: number, data: Partial<ScopeItem>): Promise<ScopeItem | null> {
    try {
      return await this.http.post<ScopeItem>(`${this.baseUrl}/sessions/${sessionId}/items`, data).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async createAssumption(sessionId: number, data: Partial<ScopeAssumption>): Promise<ScopeAssumption | null> {
    try {
      return await this.http.post<ScopeAssumption>(`${this.baseUrl}/sessions/${sessionId}/assumptions`, data).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async createConstraint(sessionId: number, data: Partial<ScopeConstraint>): Promise<ScopeConstraint | null> {
    try {
      return await this.http.post<ScopeConstraint>(`${this.baseUrl}/sessions/${sessionId}/constraints`, data).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async createDeliverable(sessionId: number, data: Partial<ScopeDeliverable>): Promise<ScopeDeliverable | null> {
    try {
      return await this.http.post<ScopeDeliverable>(`${this.baseUrl}/sessions/${sessionId}/deliverables`, data).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async updateScopeItem(itemId: number, updates: Partial<ScopeItem>): Promise<ScopeItem | null> {
    try {
      return await this.http.patch<ScopeItem>(`${this.baseUrl}/items/${itemId}`, updates).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async deleteScopeItem(itemId: number): Promise<boolean> {
    try {
      await this.http.delete(`${this.baseUrl}/items/${itemId}`).toPromise();
      return true;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return false; }
  }

  async updateAssumption(id: number, updates: Partial<ScopeAssumption>): Promise<ScopeAssumption | null> {
    try {
      return await this.http.patch<ScopeAssumption>(`${this.baseUrl}/assumptions/${id}`, updates).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async deleteAssumption(id: number): Promise<boolean> {
    try {
      await this.http.delete(`${this.baseUrl}/assumptions/${id}`).toPromise();
      return true;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return false; }
  }

  async updateConstraint(id: number, updates: Partial<ScopeConstraint>): Promise<ScopeConstraint | null> {
    try {
      return await this.http.patch<ScopeConstraint>(`${this.baseUrl}/constraints/${id}`, updates).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async deleteConstraint(id: number): Promise<boolean> {
    try {
      await this.http.delete(`${this.baseUrl}/constraints/${id}`).toPromise();
      return true;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return false; }
  }

  async updateDeliverable(id: number, updates: Partial<ScopeDeliverable>): Promise<ScopeDeliverable | null> {
    try {
      return await this.http.patch<ScopeDeliverable>(`${this.baseUrl}/deliverables/${id}`, updates).toPromise() || null;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return null; }
  }

  async deleteDeliverable(id: number): Promise<boolean> {
    try {
      await this.http.delete(`${this.baseUrl}/deliverables/${id}`).toPromise();
      return true;
    } catch (err: any) { this.error.set(err.error?.detail || err.message); return false; }
  }
}
