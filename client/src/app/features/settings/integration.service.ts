import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Integration,
  FieldMapping,
  JiraField,
  JiraProject,
  JiraBoard,
  OAuthStartResponse,
  MappableField,
} from './integration.types';

@Injectable({
  providedIn: 'root',
})
export class IntegrationService {
  private http = inject(HttpClient);
  private baseUrl = '/api/integrations';
  private jiraBaseUrl = '/api/jira';

  // State
  private _integrations = signal<Integration[]>([]);
  private _selectedIntegration = signal<Integration | null>(null);
  private _fieldMappings = signal<FieldMapping[]>([]);
  private _availableFields = signal<JiraField[]>([]);
  private _projects = signal<JiraProject[]>([]);
  private _boards = signal<JiraBoard[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Computed
  readonly integrations = this._integrations.asReadonly();
  readonly selectedIntegration = this._selectedIntegration.asReadonly();
  readonly fieldMappings = this._fieldMappings.asReadonly();
  readonly availableFields = this._availableFields.asReadonly();
  readonly projects = this._projects.asReadonly();
  readonly boards = this._boards.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasIntegrations = computed(() => this._integrations().length > 0);
  readonly connectedIntegrations = computed(() =>
    this._integrations().filter((i) => i.status === 'connected')
  );

  // ==================
  // Integration CRUD
  // ==================

  async loadIntegrations(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const integrations = await firstValueFrom(
        this.http.get<Integration[]>(this.baseUrl)
      );
      this._integrations.set(integrations);
    } catch (err) {
      this._error.set('Failed to load integrations');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  async getIntegration(id: number): Promise<Integration | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const integration = await firstValueFrom(
        this.http.get<Integration>(`${this.baseUrl}/${id}`)
      );
      this._selectedIntegration.set(integration);
      return integration;
    } catch (err) {
      this._error.set('Failed to load integration');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteIntegration(id: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
      this._integrations.update((integrations) =>
        integrations.filter((i) => i.id !== id)
      );
      if (this._selectedIntegration()?.id === id) {
        this._selectedIntegration.set(null);
      }
      return true;
    } catch (err) {
      this._error.set('Failed to disconnect integration');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async syncIntegration(id: number): Promise<Integration | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const integration = await firstValueFrom(
        this.http.post<Integration>(`${this.baseUrl}/${id}/sync`, {})
      );
      this._integrations.update((integrations) =>
        integrations.map((i) => (i.id === id ? integration : i))
      );
      if (this._selectedIntegration()?.id === id) {
        this._selectedIntegration.set(integration);
      }
      return integration;
    } catch (err) {
      this._error.set('Failed to sync integration');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // OAuth Flow
  // ==================

  async startOAuthFlow(returnUrl?: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<OAuthStartResponse>(`${this.baseUrl}/jira/oauth/start`, {
          returnUrl,
        })
      );

      // Redirect to Jira OAuth
      window.location.href = response.authUrl;
    } catch (err) {
      this._error.set('Failed to start OAuth flow');
      console.error(err);
      this._loading.set(false);
    }
  }

  // ==================
  // PAT Connection
  // ==================

  async connectWithPAT(
    baseUrl: string,
    pat: string,
    name?: string
  ): Promise<Integration | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const integration = await firstValueFrom(
        this.http.post<Integration>(`${this.baseUrl}/jira/pat`, {
          baseUrl,
          pat,
          name,
        })
      );
      this._integrations.update((integrations) => [integration, ...integrations]);
      return integration;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { error?: { error?: string } })?.error?.error ||
            'Failed to connect with PAT';
      this._error.set(errorMessage);
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Field Mappings
  // ==================

  async loadFieldMappings(integrationId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const mappings = await firstValueFrom(
        this.http.get<FieldMapping[]>(`${this.baseUrl}/${integrationId}/mappings`)
      );
      this._fieldMappings.set(mappings);
    } catch (err) {
      this._error.set('Failed to load field mappings');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  async updateFieldMapping(
    integrationId: number,
    ourField: MappableField,
    providerFieldId: string,
    providerFieldName: string,
    providerFieldType?: string
  ): Promise<FieldMapping | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const mapping = await firstValueFrom(
        this.http.put<FieldMapping>(
          `${this.baseUrl}/${integrationId}/mappings/${ourField}`,
          {
            providerFieldId,
            providerFieldName,
            providerFieldType,
          }
        )
      );
      this._fieldMappings.update((mappings) => {
        const existingIndex = mappings.findIndex((m) => m.ourField === ourField);
        if (existingIndex >= 0) {
          const updated = [...mappings];
          updated[existingIndex] = mapping;
          return updated;
        }
        return [...mappings, mapping];
      });
      return mapping;
    } catch (err) {
      this._error.set('Failed to update field mapping');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteFieldMapping(
    integrationId: number,
    ourField: MappableField
  ): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${integrationId}/mappings/${ourField}`)
      );
      this._fieldMappings.update((mappings) =>
        mappings.filter((m) => m.ourField !== ourField)
      );
      return true;
    } catch (err) {
      this._error.set('Failed to delete field mapping');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async loadAvailableFields(integrationId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const fields = await firstValueFrom(
        this.http.get<JiraField[]>(`${this.baseUrl}/${integrationId}/fields`)
      );
      this._availableFields.set(fields);
    } catch (err) {
      this._error.set('Failed to load available fields');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Projects & Boards
  // ==================

  async loadProjects(integrationId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const projects = await firstValueFrom(
        this.http.get<JiraProject[]>(`${this.jiraBaseUrl}/${integrationId}/projects`)
      );
      this._projects.set(projects);
    } catch (err) {
      this._error.set('Failed to load projects');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  async loadBoards(integrationId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const boards = await firstValueFrom(
        this.http.get<JiraBoard[]>(`${this.jiraBaseUrl}/${integrationId}/boards`)
      );
      this._boards.set(boards);
    } catch (err) {
      this._error.set('Failed to load boards');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // ==================
  // Helpers
  // ==================

  selectIntegration(integration: Integration | null): void {
    this._selectedIntegration.set(integration);
  }

  clearError(): void {
    this._error.set(null);
  }

  getFieldMappingForField(ourField: MappableField): FieldMapping | undefined {
    return this._fieldMappings().find((m) => m.ourField === ourField);
  }
}
