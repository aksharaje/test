import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface StoryToCodeRequest {
    stories: string;
    techStack?: string;
    knowledgeBaseIds?: number[]; // IDs
    title?: string;
}

export interface GeneratedArtifact {
    id: number;
    title: string;
    type: string;
    content: string; // JSON string of filename->content
    inputDescription: string;
    createdAt: string;
    generationMetadata?: {
        model?: string;
        techStack?: string;
    };
    // Helper to get parsed files
    parsedFiles?: Record<string, string>;
}

@Injectable({
    providedIn: 'root'
})
export class StoryToCodeService {
    private http = inject(HttpClient);
    private apiUrl = '/api/v1/story-to-code';

    // State signals
    history = signal<GeneratedArtifact[]>([]);
    currentArtifact = signal<GeneratedArtifact | null>(null);
    isLoading = signal<boolean>(false);

    loadHistory() {
        this.http.get<GeneratedArtifact[]>(`${this.apiUrl}/history`).subscribe(data => {
            this.history.set(data);
        });
    }

    getGeneration(id: number) {
        this.isLoading.set(true);
        this.http.get<GeneratedArtifact>(`${this.apiUrl}/${id}`).subscribe({
            next: (data) => {
                this.setCurrentArtifact(data);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false)
        });
    }

    generate(req: StoryToCodeRequest): Observable<GeneratedArtifact> {
        this.isLoading.set(true);
        return new Observable(observer => {
            this.http.post<GeneratedArtifact>(`${this.apiUrl}/generate`, req).subscribe({
                next: (data) => {
                    this.setCurrentArtifact(data);
                    // Update history
                    this.history.update(h => [data, ...h]);
                    this.isLoading.set(false);
                    observer.next(data);
                    observer.complete();
                },
                error: (err) => {
                    this.isLoading.set(false);
                    observer.error(err);
                }
            });
        });
    }

    downloadZip(id: number) {
        window.open(`${this.apiUrl}/${id}/download`, '_blank');
    }

    private setCurrentArtifact(data: GeneratedArtifact) {
        try {
            data.parsedFiles = JSON.parse(data.content);
        } catch (e) {
            console.error('Failed to parse content JSON', e);
            data.parsedFiles = {};
        }
        this.currentArtifact.set(data);
    }
}
