import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  GeneratedPrd,
  PrdTemplate,
  KnowledgeBase,
  PrdGenerateRequest,
} from './prd-generator.types';

@Injectable({
  providedIn: 'root',
})
export class PrdGeneratorService {
  private http = inject(HttpClient);
  private baseUrl = '/api/prd-generator';
  private kbUrl = '/api/knowledge-bases';

  // State
  private _prds = signal<GeneratedPrd[]>([]);
  private _currentPrd = signal<GeneratedPrd | null>(null);
  private _templates = signal<PrdTemplate[]>([]);
  private _knowledgeBases = signal<KnowledgeBase[]>([]);
  private _loading = signal(false);
  private _generating = signal(false);
  private _error = signal<string | null>(null);

  // Readonly accessors
  readonly prds = this._prds.asReadonly();
  readonly currentPrd = this._currentPrd.asReadonly();
  readonly templates = this._templates.asReadonly();
  readonly knowledgeBases = this._knowledgeBases.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly generating = this._generating.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed
  readonly hasPrds = computed(() => this._prds().length > 0);
  readonly defaultTemplate = computed(() =>
    this._templates().find(t => t.isDefault === 1) || this._templates()[0]
  );

  // Load templates
  async loadTemplates(): Promise<void> {
    try {
      const templates = await firstValueFrom(
        this.http.get<PrdTemplate[]>(`${this.baseUrl}/templates`)
      );
      this._templates.set(templates);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }

  // Load knowledge bases for selection
  async loadKnowledgeBases(): Promise<void> {
    try {
      const kbs = await firstValueFrom(
        this.http.get<KnowledgeBase[]>(this.kbUrl)
      );
      this._knowledgeBases.set(kbs);
    } catch (err) {
      console.error('Failed to load knowledge bases:', err);
    }
  }

  // Generate new PRD
  async generate(request: PrdGenerateRequest): Promise<GeneratedPrd | null> {
    this._generating.set(true);
    this._error.set(null);

    try {
      const formData = new FormData();
      formData.append('concept', request.concept);

      if (request.targetProject) formData.append('targetProject', request.targetProject);
      if (request.targetPersona) formData.append('targetPersona', request.targetPersona);
      if (request.industryContext) formData.append('industryContext', request.industryContext);
      if (request.primaryMetric) formData.append('primaryMetric', request.primaryMetric);
      if (request.userStoryRole) formData.append('userStoryRole', request.userStoryRole);
      if (request.userStoryGoal) formData.append('userStoryGoal', request.userStoryGoal);
      if (request.userStoryBenefit) formData.append('userStoryBenefit', request.userStoryBenefit);
      if (request.knowledgeBaseIds) {
        formData.append('knowledgeBaseIds', JSON.stringify(request.knowledgeBaseIds));
      }
      if (request.templateId) {
        formData.append('templateId', String(request.templateId));
      }
      if (request.files) {
        for (const file of request.files) {
          formData.append('files', file);
        }
      }

      const prd = await firstValueFrom(
        this.http.post<GeneratedPrd>(`${this.baseUrl}/generate`, formData)
      );

      this._currentPrd.set(prd);
      this._prds.update((arr) => [prd, ...arr]);
      return prd;
    } catch (err: any) {
      const message = err?.error?.error || err?.message || 'Generation failed';
      this._error.set(message);
      console.error('PRD generation error:', err);
      return null;
    } finally {
      this._generating.set(false);
    }
  }

  // Refine existing PRD
  async refine(prdId: number, prompt: string): Promise<GeneratedPrd | null> {
    this._generating.set(true);
    this._error.set(null);

    try {
      const prd = await firstValueFrom(
        this.http.post<GeneratedPrd>(`${this.baseUrl}/${prdId}/refine`, { prompt })
      );

      this._currentPrd.set(prd);
      this._prds.update((arr) =>
        arr.map((p) => (p.id === prdId ? prd : p))
      );
      return prd;
    } catch (err: any) {
      const message = err?.error?.error || err?.message || 'Refine failed';
      this._error.set(message);
      console.error('PRD refine error:', err);
      return null;
    } finally {
      this._generating.set(false);
    }
  }

  // Load all PRDs
  async loadPrds(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const prds = await firstValueFrom(
        this.http.get<GeneratedPrd[]>(this.baseUrl)
      );
      this._prds.set(prds);
    } catch (err) {
      this._error.set('Failed to load PRDs');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // Get single PRD
  async getPrd(id: number): Promise<GeneratedPrd | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const prd = await firstValueFrom(
        this.http.get<GeneratedPrd>(`${this.baseUrl}/${id}`)
      );
      this._currentPrd.set(prd);
      return prd;
    } catch (err) {
      this._error.set('Failed to load PRD');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Update PRD
  async updatePrd(
    id: number,
    data: { title?: string; content?: string; status?: 'draft' | 'final' }
  ): Promise<GeneratedPrd | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const prd = await firstValueFrom(
        this.http.patch<GeneratedPrd>(`${this.baseUrl}/${id}`, data)
      );

      this._currentPrd.set(prd);
      this._prds.update((arr) =>
        arr.map((p) => (p.id === id ? prd : p))
      );
      return prd;
    } catch (err) {
      this._error.set('Failed to update PRD');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Delete PRD
  async deletePrd(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${id}`)
      );

      this._prds.update((arr) => arr.filter((p) => p.id !== id));
      if (this._currentPrd()?.id === id) {
        this._currentPrd.set(null);
      }
      return true;
    } catch (err) {
      this._error.set('Failed to delete PRD');
      console.error(err);
      return false;
    }
  }

  // Set current PRD
  setCurrentPrd(prd: GeneratedPrd | null): void {
    this._currentPrd.set(prd);
  }

  // Clear error
  clearError(): void {
    this._error.set(null);
  }
}
