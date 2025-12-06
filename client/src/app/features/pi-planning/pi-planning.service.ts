import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  PiSession,
  PiSessionBoard,
  PiPlannedItem,
  PiPlanningView,
  CreateSessionRequest,
  HolidayConfig,
  KanbanBoardView,
  PiPlanVersion,
  AddBoardRequest,
  AssignFeatureRequest,
  CreateVersionRequest,
  PiFeature,
  AiPlanningResult,
  PlannedAssignment,
} from './pi-planning.types';

@Injectable({
  providedIn: 'root',
})
export class PiPlanningService {
  private http = inject(HttpClient);
  private baseUrl = '/api/pi-planning';

  // State
  private _sessions = signal<PiSession[]>([]);
  private _selectedSession = signal<PiSession | null>(null);
  private _planningView = signal<PiPlanningView | null>(null);
  private _kanbanView = signal<KanbanBoardView | null>(null);
  private _holidayConfigs = signal<HolidayConfig[]>([]);
  private _versions = signal<PiPlanVersion[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Computed
  readonly sessions = this._sessions.asReadonly();
  readonly selectedSession = this._selectedSession.asReadonly();
  readonly planningView = this._planningView.asReadonly();
  readonly kanbanView = this._kanbanView.asReadonly();
  readonly holidayConfigs = this._holidayConfigs.asReadonly();
  readonly versions = this._versions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasSessions = computed(() => this._sessions().length > 0);

  // ==================
  // Holiday Configs
  // ==================

  async loadHolidayConfigs(): Promise<void> {
    try {
      const configs = await firstValueFrom(
        this.http.get<HolidayConfig[]>(`${this.baseUrl}/holiday-configs`)
      );
      this._holidayConfigs.set(configs);
    } catch (err) {
      console.error('Failed to load holiday configs:', err);
    }
  }

  async seedHolidayConfigs(): Promise<void> {
    try {
      const configs = await firstValueFrom(
        this.http.post<HolidayConfig[]>(`${this.baseUrl}/holiday-configs/seed`, {})
      );
      this._holidayConfigs.set(configs);
    } catch (err) {
      console.error('Failed to seed holiday configs:', err);
    }
  }

  // ==================
  // Sessions
  // ==================

  async loadSessions(integrationId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const sessions = await firstValueFrom(
        this.http.get<PiSession[]>(`${this.baseUrl}/${integrationId}/sessions`)
      );
      this._sessions.set(sessions);
    } catch (err) {
      this._error.set('Failed to load PI sessions');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  async createSession(
    integrationId: number,
    request: CreateSessionRequest
  ): Promise<PiSession | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<{ id: number }>(`${this.baseUrl}/${integrationId}/sessions`, request)
      );
      // Fetch the full session
      const session = await this.getSession(integrationId, result.id);
      if (session) {
        this._sessions.update((sessions) => [session, ...sessions]);
      }
      return session;
    } catch (err) {
      this._error.set('Failed to create PI session');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async getSession(integrationId: number, sessionId: number): Promise<PiSession | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.get<PiSession>(`${this.baseUrl}/${integrationId}/sessions/${sessionId}`)
      );
      this._selectedSession.set(session);
      return session;
    } catch (err) {
      this._error.set('Failed to load PI session');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async updateSession(
    integrationId: number,
    sessionId: number,
    updates: Partial<PiSession>
  ): Promise<PiSession | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.patch<PiSession>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}`,
          updates
        )
      );
      this._sessions.update((sessions) =>
        sessions.map((s) => (s.id === sessionId ? session : s))
      );
      if (this._selectedSession()?.id === sessionId) {
        this._selectedSession.set(session);
      }
      return session;
    } catch (err) {
      this._error.set('Failed to update PI session');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteSession(integrationId: number, sessionId: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${integrationId}/sessions/${sessionId}`)
      );
      this._sessions.update((sessions) => sessions.filter((s) => s.id !== sessionId));
      if (this._selectedSession()?.id === sessionId) {
        this._selectedSession.set(null);
        this._planningView.set(null);
        this._kanbanView.set(null);
      }
      return true;
    } catch (err) {
      this._error.set('Failed to delete PI session');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Boards
  // ==================

  async addBoard(
    integrationId: number,
    sessionId: number,
    request: AddBoardRequest
  ): Promise<{ id: number } | null> {
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<{ id: number }>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/boards`,
          request
        )
      );
      // Reload session to get updated boards
      await this.getSession(integrationId, sessionId);
      return result;
    } catch (err) {
      this._error.set('Failed to add board to session');
      console.error(err);
      return null;
    }
  }

  async updateTeamCapabilities(
    integrationId: number,
    sessionId: number,
    boardId: number,
    capabilities: { canWorkOnAll: boolean; allowedFeatureKeys?: string[] }
  ): Promise<void> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.patch(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/boards/${boardId}/capabilities`,
          capabilities
        )
      );
    } catch (err) {
      this._error.set('Failed to update team capabilities');
      console.error(err);
    }
  }

  // ==================
  // Features
  // ==================

  async importFeatures(
    integrationId: number,
    sessionId: number,
    options?: { jql?: string; projectKey?: string }
  ): Promise<{ imported: number }> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<{ imported: number }>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/features/import`,
          options || {}
        )
      );
      // Reload session to get imported features
      await this.getSession(integrationId, sessionId);
      return result;
    } catch (err) {
      this._error.set('Failed to import features');
      console.error(err);
      return { imported: 0 };
    } finally {
      this._loading.set(false);
    }
  }

  async updateFeature(
    integrationId: number,
    sessionId: number,
    featureId: number,
    updates: Partial<Pick<PiFeature, 'totalPoints' | 'estimatedSprints' | 'priorityOrder'>>
  ): Promise<void> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.patch(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/features/${featureId}`,
          updates
        )
      );
    } catch (err) {
      this._error.set('Failed to update feature');
      console.error(err);
    }
  }

  // ==================
  // Assignments
  // ==================

  async assignFeature(
    integrationId: number,
    sessionId: number,
    request: AssignFeatureRequest
  ): Promise<{ id: number } | null> {
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<{ id: number }>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/assignments`,
          request
        )
      );
      // Reload kanban view
      await this.loadKanbanView(integrationId, sessionId);
      return result;
    } catch (err) {
      this._error.set('Failed to assign feature');
      console.error(err);
      return null;
    }
  }

  async unassignFeature(
    integrationId: number,
    sessionId: number,
    featureId: number
  ): Promise<boolean> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/assignments/${featureId}`
        )
      );
      // Reload kanban view
      await this.loadKanbanView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to unassign feature');
      console.error(err);
      return false;
    }
  }

  // ==================
  // Kanban Board View
  // ==================

  async loadKanbanView(integrationId: number, sessionId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const view = await firstValueFrom(
        this.http.get<KanbanBoardView>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/board-view`
        )
      );
      this._kanbanView.set(view);
    } catch (err) {
      this._error.set('Failed to load board view');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Versions
  // ==================

  async loadVersions(integrationId: number, sessionId: number): Promise<void> {
    try {
      const versions = await firstValueFrom(
        this.http.get<PiPlanVersion[]>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/versions`
        )
      );
      this._versions.set(versions);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }

  async createVersion(
    integrationId: number,
    sessionId: number,
    request: CreateVersionRequest
  ): Promise<{ id: number } | null> {
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<{ id: number }>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/versions`,
          request
        )
      );
      await this.loadVersions(integrationId, sessionId);
      return result;
    } catch (err) {
      this._error.set('Failed to create version');
      console.error(err);
      return null;
    }
  }

  async restoreVersion(
    integrationId: number,
    sessionId: number,
    versionId: number
  ): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/versions/${versionId}/restore`,
          {}
        )
      );
      await this.loadKanbanView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to restore version');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Legacy Planning View
  // ==================

  async loadPlanningView(integrationId: number, sessionId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const view = await firstValueFrom(
        this.http.get<PiPlanningView>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/view`
        )
      );
      this._planningView.set(view);
      this._selectedSession.set(view.session);
    } catch (err) {
      this._error.set('Failed to load planning view');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Legacy Items (for backwards compatibility)
  // ==================

  async addItem(
    integrationId: number,
    sessionId: number,
    item: Partial<PiPlannedItem>
  ): Promise<PiPlannedItem | null> {
    this._error.set(null);

    try {
      const created = await firstValueFrom(
        this.http.post<PiPlannedItem>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/items`,
          item
        )
      );
      await this.loadPlanningView(integrationId, sessionId);
      return created;
    } catch (err) {
      this._error.set('Failed to add item');
      console.error(err);
      return null;
    }
  }

  async updateItem(
    integrationId: number,
    sessionId: number,
    itemId: number,
    updates: Partial<PiPlannedItem>
  ): Promise<PiPlannedItem | null> {
    this._error.set(null);

    try {
      const updated = await firstValueFrom(
        this.http.patch<PiPlannedItem>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/items/${itemId}`,
          updates
        )
      );
      await this.loadPlanningView(integrationId, sessionId);
      return updated;
    } catch (err) {
      this._error.set('Failed to update item');
      console.error(err);
      return null;
    }
  }

  async deleteItem(
    integrationId: number,
    sessionId: number,
    itemId: number
  ): Promise<boolean> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/items/${itemId}`
        )
      );
      await this.loadPlanningView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to delete item');
      console.error(err);
      return false;
    }
  }

  async importFromBacklog(
    integrationId: number,
    sessionId: number,
    boardId: number,
    issueKeys?: string[]
  ): Promise<PiPlannedItem[]> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(
        this.http.post<PiPlannedItem[]>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/import-backlog`,
          { boardId, issueKeys }
        )
      );
      await this.loadPlanningView(integrationId, sessionId);
      return items;
    } catch (err) {
      this._error.set('Failed to import from backlog');
      console.error(err);
      return [];
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // AI Planning
  // ==================

  async generateAiPlan(
    integrationId: number,
    sessionId: number,
    options?: { respectDependencies?: boolean; balanceLoad?: boolean; preferEarlierSprints?: boolean }
  ): Promise<AiPlanningResult | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<AiPlanningResult>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/ai-plan/preview`,
          options || {}
        )
      );
      return result;
    } catch (err) {
      this._error.set('Failed to generate AI plan');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async applyAiPlan(
    integrationId: number,
    sessionId: number,
    assignments: PlannedAssignment[]
  ): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/ai-plan/apply`,
          { assignments }
        )
      );
      // Reload the board view
      await this.loadKanbanView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to apply AI plan');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async runAutoAiPlan(
    integrationId: number,
    sessionId: number,
    options?: { respectDependencies?: boolean; balanceLoad?: boolean; preferEarlierSprints?: boolean }
  ): Promise<AiPlanningResult | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<AiPlanningResult>(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/ai-plan/auto`,
          options || {}
        )
      );
      // Reload the board view
      await this.loadKanbanView(integrationId, sessionId);
      return result;
    } catch (err) {
      this._error.set('Failed to run AI planning');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Jira Boards
  // ==================

  async getJiraBoards(
    integrationId: number
  ): Promise<Array<{ id: number; name: string; type: string }>> {
    try {
      const boards = await firstValueFrom(
        this.http.get<Array<{ id: number; name: string; type: string }>>(
          `/api/jira/${integrationId}/boards`
        )
      );
      return boards;
    } catch (err) {
      console.error('Failed to fetch Jira boards:', err);
      return [];
    }
  }

  async getJiraBoardVelocity(
    integrationId: number,
    jiraBoardId: number
  ): Promise<number> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ velocity: number }>(
          `${this.baseUrl}/${integrationId}/boards/${jiraBoardId}/velocity`
        )
      );
      return result.velocity;
    } catch (err) {
      console.error('Failed to fetch velocity:', err);
      return 21; // Default velocity
    }
  }

  async updateBoardVelocity(
    integrationId: number,
    sessionId: number,
    boardId: number,
    velocity: number
  ): Promise<boolean> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.patch(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/boards/${boardId}`,
          { defaultVelocity: velocity }
        )
      );
      // Reload kanban view to reflect changes
      await this.loadKanbanView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to update velocity');
      console.error(err);
      return false;
    }
  }

  async removeBoard(
    integrationId: number,
    sessionId: number,
    boardId: number
  ): Promise<boolean> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(
          `${this.baseUrl}/${integrationId}/sessions/${sessionId}/boards/${boardId}`
        )
      );
      // Reload kanban view to reflect changes
      await this.loadKanbanView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to remove board');
      console.error(err);
      return false;
    }
  }

  // ==================
  // Helpers
  // ==================

  selectSession(session: PiSession | null): void {
    this._selectedSession.set(session);
  }

  clearError(): void {
    this._error.set(null);
  }

  clearKanbanView(): void {
    this._kanbanView.set(null);
  }
}
