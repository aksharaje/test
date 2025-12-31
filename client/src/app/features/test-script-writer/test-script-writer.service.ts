import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  TestScriptWriterSession,
  CreateTestScriptWriterRequest,
  SourceTypeOption,
  NfrOption,
  SessionStatus,
  ArtifactSummary,
  ArtifactDetails,
} from './test-script-writer.types';

@Injectable({ providedIn: 'root' })
export class TestScriptWriterService {
  private http = inject(HttpClient);
  private baseUrl = '/api/test-script-writer';

  // State
  sessions = signal<TestScriptWriterSession[]>([]);
  currentSession = signal<TestScriptWriterSession | null>(null);
  sourceTypes = signal<SourceTypeOption[]>([]);
  nfrOptions = signal<NfrOption[]>([]);
  epics = signal<ArtifactSummary[]>([]);
  features = signal<ArtifactSummary[]>([]);
  userStories = signal<ArtifactSummary[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Pagination
  private skip = 0;
  private limit = 20;
  hasMore = signal(true);

  async loadSourceTypes(): Promise<void> {
    try {
      const types = await firstValueFrom(
        this.http.get<SourceTypeOption[]>(`${this.baseUrl}/source-types`)
      );
      this.sourceTypes.set(types);
    } catch (err) {
      console.error('Failed to load source types:', err);
    }
  }

  async loadNfrOptions(): Promise<void> {
    try {
      const options = await firstValueFrom(
        this.http.get<NfrOption[]>(`${this.baseUrl}/nfr-options`)
      );
      this.nfrOptions.set(options);
    } catch (err) {
      console.error('Failed to load NFR options:', err);
    }
  }

  async loadEpics(): Promise<void> {
    try {
      const epics = await firstValueFrom(
        this.http.get<ArtifactSummary[]>(`${this.baseUrl}/artifacts/epics`)
      );
      this.epics.set(epics);
    } catch (err) {
      this.epics.set([]);
    }
  }

  async loadFeatures(): Promise<void> {
    try {
      const features = await firstValueFrom(
        this.http.get<ArtifactSummary[]>(`${this.baseUrl}/artifacts/features`)
      );
      this.features.set(features);
    } catch (err) {
      this.features.set([]);
    }
  }

  async loadUserStories(): Promise<void> {
    try {
      const stories = await firstValueFrom(
        this.http.get<ArtifactSummary[]>(`${this.baseUrl}/artifacts/user-stories`)
      );
      this.userStories.set(stories);
    } catch (err) {
      this.userStories.set([]);
    }
  }

  async loadArtifactDetails(id: number): Promise<ArtifactDetails | null> {
    try {
      return await firstValueFrom(
        this.http.get<ArtifactDetails>(`${this.baseUrl}/artifacts/${id}`)
      );
    } catch (err) {
      return null;
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
        this.http.get<TestScriptWriterSession[]>(
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
    data: CreateTestScriptWriterRequest,
    files: File[] = []
  ): Promise<TestScriptWriterSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const formData = new FormData();
      formData.append('data', JSON.stringify(data));

      // Append files
      for (const file of files) {
        formData.append('files', file);
      }

      const session = await firstValueFrom(
        this.http.post<TestScriptWriterSession>(
          `${this.baseUrl}/sessions`,
          formData
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

  async getSession(id: number): Promise<TestScriptWriterSession | null> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.get<TestScriptWriterSession>(`${this.baseUrl}/sessions/${id}`)
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

  async retrySession(id: number): Promise<TestScriptWriterSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.post<TestScriptWriterSession>(
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

  getSourceTypeLabel(value: string): string {
    const type = this.sourceTypes().find((t) => t.value === value);
    return type?.label || value;
  }

  getNfrLabel(value: string): string {
    const nfr = this.nfrOptions().find((n) => n.value === value);
    return nfr?.label || value;
  }
}
