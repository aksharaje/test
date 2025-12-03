import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  KnowledgeBase,
  Document,
  CreateKnowledgeBaseRequest,
  GitHubImportRequest,
  SearchResponse,
} from './knowledge-base.types';

@Injectable({
  providedIn: 'root',
})
export class KnowledgeBaseService {
  private http = inject(HttpClient);
  private baseUrl = '/api/knowledge-bases';

  // State
  private _knowledgeBases = signal<KnowledgeBase[]>([]);
  private _selectedKnowledgeBase = signal<KnowledgeBase | null>(null);
  private _documents = signal<Document[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Computed
  readonly knowledgeBases = this._knowledgeBases.asReadonly();
  readonly selectedKnowledgeBase = this._selectedKnowledgeBase.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasKnowledgeBases = computed(() => this._knowledgeBases().length > 0);

  // CRUD Operations
  async loadKnowledgeBases(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const kbs = await firstValueFrom(
        this.http.get<KnowledgeBase[]>(this.baseUrl)
      );
      this._knowledgeBases.set(kbs);
    } catch (err) {
      this._error.set('Failed to load knowledge bases');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  async createKnowledgeBase(data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase | null> {
    // Don't set global loading - let the component handle its own loading state
    this._error.set(null);

    try {
      const kb = await firstValueFrom(
        this.http.post<KnowledgeBase>(this.baseUrl, data)
      );
      this._knowledgeBases.update((kbs) => [kb, ...kbs]);
      return kb;
    } catch (err) {
      this._error.set('Failed to create knowledge base');
      console.error(err);
      return null;
    }
  }

  async getKnowledgeBase(id: number): Promise<KnowledgeBase | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const kb = await firstValueFrom(
        this.http.get<KnowledgeBase>(`${this.baseUrl}/${id}`)
      );
      this._selectedKnowledgeBase.set(kb);
      return kb;
    } catch (err) {
      this._error.set('Failed to load knowledge base');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async updateKnowledgeBase(
    id: number,
    data: Partial<CreateKnowledgeBaseRequest>
  ): Promise<KnowledgeBase | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const kb = await firstValueFrom(
        this.http.patch<KnowledgeBase>(`${this.baseUrl}/${id}`, data)
      );
      this._knowledgeBases.update((kbs) =>
        kbs.map((k) => (k.id === id ? kb : k))
      );
      if (this._selectedKnowledgeBase()?.id === id) {
        this._selectedKnowledgeBase.set(kb);
      }
      return kb;
    } catch (err) {
      this._error.set('Failed to update knowledge base');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async deleteKnowledgeBase(id: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${id}`)
      );
      this._knowledgeBases.update((kbs) => kbs.filter((k) => k.id !== id));
      if (this._selectedKnowledgeBase()?.id === id) {
        this._selectedKnowledgeBase.set(null);
      }
      return true;
    } catch (err) {
      this._error.set('Failed to delete knowledge base');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // Document Operations
  async loadDocuments(knowledgeBaseId: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const docs = await firstValueFrom(
        this.http.get<Document[]>(`${this.baseUrl}/${knowledgeBaseId}/documents`)
      );
      this._documents.set(docs);
    } catch (err) {
      this._error.set('Failed to load documents');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  async uploadFiles(knowledgeBaseId: number, files: File[]): Promise<Document[]> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      const response = await firstValueFrom(
        this.http.post<{ message: string; documents: Document[] }>(
          `${this.baseUrl}/${knowledgeBaseId}/upload`,
          formData
        )
      );

      this._documents.update((docs) => [...response.documents, ...docs]);
      await this.refreshKnowledgeBase(knowledgeBaseId);
      return response.documents;
    } catch (err) {
      this._error.set('Failed to upload files');
      console.error(err);
      return [];
    } finally {
      this._loading.set(false);
    }
  }

  async importFromGitHub(
    knowledgeBaseId: number,
    data: GitHubImportRequest
  ): Promise<Document[]> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<{ message: string; documents: Document[] }>(
          `${this.baseUrl}/${knowledgeBaseId}/github`,
          data
        )
      );

      this._documents.update((docs) => [...response.documents, ...docs]);
      await this.refreshKnowledgeBase(knowledgeBaseId);
      return response.documents;
    } catch (err) {
      this._error.set('Failed to import from GitHub');
      console.error(err);
      return [];
    } finally {
      this._loading.set(false);
    }
  }

  async deleteDocument(knowledgeBaseId: number, documentId: number): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${knowledgeBaseId}/documents/${documentId}`)
      );
      this._documents.update((docs) => docs.filter((d) => d.id !== documentId));
      await this.refreshKnowledgeBase(knowledgeBaseId);
      return true;
    } catch (err) {
      this._error.set('Failed to delete document');
      console.error(err);
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // Search
  async search(
    knowledgeBaseId: number,
    query: string,
    limit: number = 5
  ): Promise<SearchResponse | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<SearchResponse>(`${this.baseUrl}/${knowledgeBaseId}/query`, {
          query,
          limit,
        })
      );
      return response;
    } catch (err) {
      this._error.set('Failed to search knowledge base');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Helpers
  private async refreshKnowledgeBase(id: number): Promise<void> {
    const kb = await firstValueFrom(
      this.http.get<KnowledgeBase>(`${this.baseUrl}/${id}`)
    );
    this._knowledgeBases.update((kbs) =>
      kbs.map((k) => (k.id === id ? kb : k))
    );
    if (this._selectedKnowledgeBase()?.id === id) {
      this._selectedKnowledgeBase.set(kb);
    }
  }

  selectKnowledgeBase(kb: KnowledgeBase | null): void {
    this._selectedKnowledgeBase.set(kb);
  }

  clearError(): void {
    this._error.set(null);
  }
}
