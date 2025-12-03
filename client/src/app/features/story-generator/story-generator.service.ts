import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ArtifactType,
  GeneratedArtifact,
  InputConfig,
  KnowledgeBase,
} from './story-generator.types';

@Injectable({
  providedIn: 'root',
})
export class StoryGeneratorService {
  private http = inject(HttpClient);
  private baseUrl = '/api/story-generator';
  private kbUrl = '/api/knowledge-bases';

  // State
  private _artifacts = signal<GeneratedArtifact[]>([]);
  private _currentArtifact = signal<GeneratedArtifact | null>(null);
  private _knowledgeBases = signal<KnowledgeBase[]>([]);
  private _loading = signal(false);
  private _generating = signal(false);
  private _error = signal<string | null>(null);

  // Readonly accessors
  readonly artifacts = this._artifacts.asReadonly();
  readonly currentArtifact = this._currentArtifact.asReadonly();
  readonly knowledgeBases = this._knowledgeBases.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly generating = this._generating.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed
  readonly hasArtifacts = computed(() => this._artifacts().length > 0);

  // Get input config for artifact type
  async getInputConfig(type: ArtifactType): Promise<InputConfig> {
    try {
      return await firstValueFrom(
        this.http.get<InputConfig>(`${this.baseUrl}/config/${type}`)
      );
    } catch {
      // Fallback config
      const configs: Record<ArtifactType, InputConfig> = {
        epic: {
          label: 'Describe the initiative',
          placeholder: 'What is the big-picture goal? What outcomes are you trying to achieve?',
        },
        feature: {
          label: 'Describe the features you need',
          placeholder: 'What capabilities do you need to add? What should users be able to do?',
        },
        user_story: {
          label: 'Describe the user needs',
          placeholder: "What does the user need to accomplish? What's the context?",
        },
      };
      return configs[type];
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

  // Generate new artifact
  async generate(
    type: ArtifactType,
    title: string,
    description: string,
    files: File[] = [],
    knowledgeBaseIds: number[] = []
  ): Promise<GeneratedArtifact | null> {
    this._generating.set(true);
    this._error.set(null);

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('knowledgeBaseIds', JSON.stringify(knowledgeBaseIds));

      for (const file of files) {
        formData.append('files', file);
      }

      const artifact = await firstValueFrom(
        this.http.post<GeneratedArtifact>(`${this.baseUrl}/generate`, formData)
      );

      this._currentArtifact.set(artifact);
      this._artifacts.update((arr) => [artifact, ...arr]);
      return artifact;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      this._error.set(message);
      console.error('Generation error:', err);
      return null;
    } finally {
      this._generating.set(false);
    }
  }

  // Regenerate with modifications
  async regenerate(artifactId: number, prompt: string): Promise<GeneratedArtifact | null> {
    this._generating.set(true);
    this._error.set(null);

    try {
      const artifact = await firstValueFrom(
        this.http.post<GeneratedArtifact>(`${this.baseUrl}/${artifactId}/regenerate`, {
          prompt,
        })
      );

      this._currentArtifact.set(artifact);
      this._artifacts.update((arr) =>
        arr.map((a) => (a.id === artifactId ? artifact : a))
      );
      return artifact;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regeneration failed';
      this._error.set(message);
      console.error('Regeneration error:', err);
      return null;
    } finally {
      this._generating.set(false);
    }
  }

  // Load all artifacts
  async loadArtifacts(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const artifacts = await firstValueFrom(
        this.http.get<GeneratedArtifact[]>(this.baseUrl)
      );
      this._artifacts.set(artifacts);
    } catch (err) {
      this._error.set('Failed to load artifacts');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // Get single artifact
  async getArtifact(id: number): Promise<GeneratedArtifact | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const artifact = await firstValueFrom(
        this.http.get<GeneratedArtifact>(`${this.baseUrl}/${id}`)
      );
      this._currentArtifact.set(artifact);
      return artifact;
    } catch (err) {
      this._error.set('Failed to load artifact');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Update artifact (edit content)
  async updateArtifact(
    id: number,
    data: { title?: string; content?: string; status?: 'draft' | 'final' }
  ): Promise<GeneratedArtifact | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const artifact = await firstValueFrom(
        this.http.patch<GeneratedArtifact>(`${this.baseUrl}/${id}`, data)
      );

      this._currentArtifact.set(artifact);
      this._artifacts.update((arr) =>
        arr.map((a) => (a.id === id ? artifact : a))
      );
      return artifact;
    } catch (err) {
      this._error.set('Failed to update artifact');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Delete artifact
  async deleteArtifact(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${id}`)
      );

      this._artifacts.update((arr) => arr.filter((a) => a.id !== id));
      if (this._currentArtifact()?.id === id) {
        this._currentArtifact.set(null);
      }
      return true;
    } catch (err) {
      this._error.set('Failed to delete artifact');
      console.error(err);
      return false;
    }
  }

  // Set current artifact
  setCurrentArtifact(artifact: GeneratedArtifact | null): void {
    this._currentArtifact.set(artifact);
  }

  // Clear error
  clearError(): void {
    this._error.set(null);
  }
}
