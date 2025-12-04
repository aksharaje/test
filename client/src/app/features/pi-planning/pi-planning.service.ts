import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  PiSession,
  PiSessionBoard,
  PiPlannedItem,
  PiPlanningView,
  CreateSessionRequest,
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
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Computed
  readonly sessions = this._sessions.asReadonly();
  readonly selectedSession = this._selectedSession.asReadonly();
  readonly planningView = this._planningView.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasSessions = computed(() => this._sessions().length > 0);

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
      const session = await firstValueFrom(
        this.http.post<PiSession>(`${this.baseUrl}/${integrationId}/sessions`, request)
      );
      this._sessions.update((sessions) => [session, ...sessions]);
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
  // Planning View
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
  // Items
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
      // Reload planning view to reflect changes
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
      // Reload planning view to reflect changes
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
      // Reload planning view to reflect changes
      await this.loadPlanningView(integrationId, sessionId);
      return true;
    } catch (err) {
      this._error.set('Failed to delete item');
      console.error(err);
      return false;
    }
  }

  // ==================
  // Import
  // ==================

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
      // Reload planning view to reflect changes
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
  // Helpers
  // ==================

  selectSession(session: PiSession | null): void {
    this._selectedSession.set(session);
  }

  clearError(): void {
    this._error.set(null);
  }
}
